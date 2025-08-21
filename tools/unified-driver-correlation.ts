/*
  UNIFIED Driver Correlation Engine
  - Associates drivers across ALL systems: LYTX, MtData, Guardian
  - Uses multiple matching strategies: exact name, fuzzy match, employee ID
  - Assigns confidence scores and tracks association methods
*/

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

function getEnv(name: string, fallbackName?: string): string | undefined {
  return process.env[name] || (fallbackName ? process.env[fallbackName] : undefined);
}

interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  employee_id?: string;
  fleet: string;
  depot: string;
}

interface SystemEvent {
  id: string;
  event_id?: string;
  driver_name: string;
  employee_id?: string;
  carrier?: string;
  depot?: string;
  fleet?: string;
}

interface DriverMatch {
  driver_id: string;
  confidence: number;
  method: 'exact_match' | 'fuzzy_match' | 'employee_id_match';
  driver_name: string;
}

/**
 * Normalize name for comparison (remove extra spaces, handle case)
 */
function normalizeName(name: string | null): string {
  if (!name || typeof name !== 'string') {
    return '';
  }
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')     // Normalize spaces
    .trim();
}

/**
 * Calculate name similarity using Levenshtein distance
 */
function calculateNameSimilarity(name1: string, name2: string): number {
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);
  
  if (norm1 === norm2) return 1.0;
  
  const len1 = norm1.length;
  const len2 = norm2.length;
  
  if (len1 === 0) return len2 === 0 ? 1.0 : 0.0;
  if (len2 === 0) return 0.0;
  
  const matrix: number[][] = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));
  
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = norm1[i - 1] === norm2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return (maxLen - distance) / maxLen;
}

/**
 * Find best driver match for a system event
 */
function findBestDriverMatch(event: SystemEvent, drivers: Driver[]): DriverMatch | null {
  // Skip events with no driver name
  if (!event.driver_name || typeof event.driver_name !== 'string' || event.driver_name.trim() === '') {
    return null;
  }
  
  let bestMatch: DriverMatch | null = null;
  
  // Filter drivers by fleet/carrier if available
  let relevantDrivers = drivers;
  if (event.carrier || event.fleet) {
    const fleetFilter = event.carrier === 'Stevemacs' ? 'Stevemacs' : 'Great Southern Fuels';
    relevantDrivers = drivers.filter(driver => driver.fleet === fleetFilter);
  }
  
  for (const driver of relevantDrivers) {
    // Method 1: Employee ID match (highest confidence)
    if (event.employee_id && driver.employee_id && 
        event.employee_id === driver.employee_id) {
      return {
        driver_id: driver.id,
        confidence: 1.0,
        method: 'employee_id_match',
        driver_name: driver.full_name
      };
    }
    
    // Method 2: Exact name match
    if (normalizeName(event.driver_name) === normalizeName(driver.full_name)) {
      return {
        driver_id: driver.id,
        confidence: 0.95,
        method: 'exact_match',
        driver_name: driver.full_name
      };
    }
    
    // Method 3: Fuzzy name matching
    const similarity = calculateNameSimilarity(event.driver_name, driver.full_name);
    if (similarity >= 0.7) { // Minimum threshold for fuzzy matching
      if (!bestMatch || similarity > bestMatch.confidence) {
        bestMatch = {
          driver_id: driver.id,
          confidence: Math.min(similarity, 0.9), // Cap fuzzy matches at 0.9
          method: 'fuzzy_match',
          driver_name: driver.full_name
        };
      }
    }
  }
  
  return bestMatch;
}

async function correlateSystem(
  supabase: any, 
  systemName: string, 
  tableName: string, 
  drivers: Driver[], 
  minConfidence: number,
  batchSize: number,
  dryRun: boolean
) {
  console.log(`\n🔄 Processing ${systemName.toUpperCase()} (${tableName})...`);

  // Get events that need driver association (with reasonable limit to avoid timeouts)
  const { data: eventsData, error: eventsError } = await supabase
    .from(tableName)
    .select('*')
    .is('driver_id', null)
    .not('driver_name', 'is', null)  // Skip null driver names
    .order('id', { ascending: true })
    .limit(batchSize * 10);  // Process in manageable chunks

  if (eventsError) {
    throw new Error(`Failed to load ${systemName} events: ${eventsError.message}`);
  }

  if (!eventsData || eventsData.length === 0) {
    console.log(`✅ No ${systemName} events need correlation`);
    return { processed: 0, successful: 0, failed: 0 };
  }

  console.log(`Found ${eventsData.length} ${systemName} events needing driver association`);

  if (dryRun) {
    console.log(`DRY RUN - Testing first 5 ${systemName} events...`);
    const sampleEvents = eventsData.slice(0, 5);
    
    for (const event of sampleEvents) {
      const match = findBestDriverMatch(event, drivers);
      console.log(`Event ${event.id}:`);
      console.log(`  ${systemName} Driver: "${event.driver_name}"`);
      if (match && match.confidence >= minConfidence) {
        console.log(`  ✅ Match: "${match.driver_name}" (confidence: ${match.confidence.toFixed(3)}, method: ${match.method})`);
      } else {
        console.log(`  ❌ No match found`);
      }
    }
    return { processed: sampleEvents.length, successful: 0, failed: 0 };
  }

  // Process events in batches
  let processed = 0;
  let successful = 0;
  let failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < eventsData.length; i += batchSize) {
    const batch = eventsData.slice(i, i + batchSize);
    
    for (const event of batch) {
      const match = findBestDriverMatch(event, drivers);
      
      if (match && match.confidence >= minConfidence) {
        try {
          // Build update object based on available columns
          const updateData: any = { driver_id: match.driver_id };
          
          // Only add association metadata if columns exist (LYTX has them, MtData doesn't)
          if (systemName === 'LYTX' || systemName === 'Guardian') {
            updateData.driver_association_confidence = match.confidence;
            updateData.driver_association_method = match.method;
            updateData.driver_association_updated_at = new Date().toISOString();
          }
          
          const { error } = await supabase
            .from(tableName)
            .update(updateData)
            .eq('id', event.id);

          if (error) {
            console.error(`❌ Failed to update ${systemName} event ${event.id}: ${error.message}`);
            failed++;
          } else {
            successful++;
          }
        } catch (err) {
          console.error(`❌ Exception updating ${systemName} event ${event.id}: ${err}`);
          failed++;
        }
      }
    }

    processed += batch.length;
    const progress = Math.round((processed / eventsData.length) * 100);
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const rate = elapsed > 0 ? Math.round(processed / elapsed) : 0;
    
    process.stdout.write(`\r${systemName} Progress: ${processed}/${eventsData.length} (${progress}%) - ${successful} associated, ${failed} failed - ${rate} events/sec`);
  }

  console.log(''); // New line after progress
  return { processed, successful, failed };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('--dryRun');
  const batchSize = parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '500', 10);
  const minConfidence = parseFloat(args.find(arg => arg.startsWith('--min-confidence='))?.split('=')[1] || '0.7');
  
  console.log('🚀 UNIFIED Driver Correlation Engine');
  console.log(`Dry run: ${dryRun ? 'YES' : 'NO'}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Minimum confidence: ${minConfidence}`);
  console.log('');

  // Setup Supabase client
  const supabaseUrl = getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL') || '';
  const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY') || '';
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration');
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Load all drivers
  console.log('Loading drivers from database...');
  const { data: driversData, error: driversError } = await supabase
    .from('drivers')
    .select('id, first_name, last_name, employee_id, fleet, depot');

  if (driversError) {
    throw new Error(`Failed to load drivers: ${driversError.message}`);
  }

  const drivers: Driver[] = driversData.map(d => ({
    ...d,
    full_name: `${d.first_name} ${d.last_name}`
  }));

  console.log(`Loaded ${drivers.length} drivers (all status levels)`);

  // Systems to correlate
  const systems = [
    { name: 'LYTX', table: 'lytx_safety_events' },
    { name: 'MtData', table: 'mtdata_trip_history' },
    // Guardian will be added once the migration is run
    // { name: 'Guardian', table: 'guardian_events' }
  ];

  const results = [];

  for (const system of systems) {
    try {
      const result = await correlateSystem(
        supabase, 
        system.name, 
        system.table, 
        drivers, 
        minConfidence, 
        batchSize, 
        dryRun
      );
      results.push({ system: system.name, ...result });
    } catch (err) {
      console.error(`❌ Failed to correlate ${system.name}: ${err}`);
      results.push({ system: system.name, processed: 0, successful: 0, failed: 0, error: err.message });
    }
  }

  // Final summary
  console.log('\n📊 UNIFIED CORRELATION SUMMARY:');
  let totalProcessed = 0;
  let totalSuccessful = 0;
  let totalFailed = 0;

  results.forEach(result => {
    console.log(`\n${result.system}:`);
    console.log(`  ✅ Processed: ${result.processed}`);
    console.log(`  🔗 Associated: ${result.successful}`);
    console.log(`  ❌ Failed: ${result.failed}`);
    if (result.error) {
      console.log(`  ⚠️  Error: ${result.error}`);
    }
    
    totalProcessed += result.processed;
    totalSuccessful += result.successful;
    totalFailed += result.failed;
  });

  console.log(`\n🎯 GRAND TOTAL:`);
  console.log(`✅ Events processed: ${totalProcessed}`);
  console.log(`🔗 Successfully associated: ${totalSuccessful}`);
  console.log(`❌ Failed: ${totalFailed}`);

  if (!dryRun) {
    // Get final correlation statistics
    console.log('\n📈 Final correlation rates:');
    
    for (const system of systems) {
      try {
        const { count: totalCount } = await supabase
          .from(system.table)
          .select('*', { count: 'exact', head: true });

        const { count: linkedCount } = await supabase
          .from(system.table)
          .select('*', { count: 'exact', head: true })
          .not('driver_id', 'is', null);

        const rate = totalCount ? Math.round((linkedCount / totalCount) * 100 * 100) / 100 : 0;
        console.log(`${system.name}: ${rate}% (${linkedCount}/${totalCount})`);
      } catch (err) {
        console.log(`${system.name}: Error getting stats`);
      }
    }
  }
}

main().catch((err) => {
  console.error('Unified correlation failed:', err.message);
  process.exit(1);
});