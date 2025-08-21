/*
  LYTX Driver Correlation Engine
  - Associates LYTX safety events with drivers in the database
  - Uses multiple matching strategies: exact name match, fuzzy match, employee ID
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

interface LytxEvent {
  id: string;
  event_id: string;
  driver_name: string;
  employee_id?: string;
  carrier: string;
  depot: string;
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
function normalizeName(name: string): string {
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
 * Check if names might be the same person with variations
 */
function checkNameVariations(lytxName: string, driverName: string): number {
  const lytxNorm = normalizeName(lytxName);
  const driverNorm = normalizeName(driverName);
  
  // Direct similarity
  const directSimilarity = calculateNameSimilarity(lytxNorm, driverNorm);
  if (directSimilarity >= 0.9) return directSimilarity;
  
  // Check for name order variations (First Last vs Last First)
  const lytxParts = lytxNorm.split(' ').filter(p => p.length > 0);
  const driverParts = driverNorm.split(' ').filter(p => p.length > 0);
  
  if (lytxParts.length >= 2 && driverParts.length >= 2) {
    // Try reversed order
    const lytxReversed = `${lytxParts[lytxParts.length - 1]} ${lytxParts[0]}`;
    const reversedSimilarity = calculateNameSimilarity(lytxReversed, driverNorm);
    if (reversedSimilarity >= 0.9) return reversedSimilarity * 0.95; // Slightly lower confidence
    
    // Check if any two parts match exactly
    const matchingParts = lytxParts.filter(part => driverParts.includes(part));
    if (matchingParts.length >= 2) return 0.85;
  }
  
  // Check for common nickname patterns
  const nicknameMap: Record<string, string[]> = {
    'michael': ['mike', 'mick'],
    'william': ['bill', 'will', 'billy'],
    'robert': ['rob', 'bob', 'bobby'],
    'richard': ['rick', 'dick', 'rich'],
    'james': ['jim', 'jimmy'],
    'christopher': ['chris'],
    'anthony': ['tony'],
    'benjamin': ['ben'],
    'matthew': ['matt'],
    'andrew': ['andy'],
    'david': ['dave'],
    'daniel': ['dan', 'danny'],
    'joseph': ['joe'],
    'thomas': ['tom', 'tommy']
  };
  
  for (const [fullName, nicknames] of Object.entries(nicknameMap)) {
    const hasFullInLytx = lytxNorm.includes(fullName);
    const hasNickInDriver = nicknames.some(nick => driverNorm.includes(nick));
    const hasFullInDriver = driverNorm.includes(fullName);
    const hasNickInLytx = nicknames.some(nick => lytxNorm.includes(nick));
    
    if ((hasFullInLytx && hasNickInDriver) || (hasFullInDriver && hasNickInLytx)) {
      return 0.8; // Good confidence for nickname matches
    }
  }
  
  return directSimilarity;
}

/**
 * Find best driver match for an LYTX event
 */
function findBestDriverMatch(lytxEvent: LytxEvent, drivers: Driver[]): DriverMatch | null {
  let bestMatch: DriverMatch | null = null;
  
  // Filter drivers by carrier/fleet first for performance
  const relevantDrivers = drivers.filter(driver => {
    if (lytxEvent.carrier === 'Stevemacs') {
      return driver.fleet === 'Stevemacs';
    } else {
      return driver.fleet === 'Great Southern Fuels';
    }
  });
  
  for (const driver of relevantDrivers) {
    // Method 1: Employee ID match (highest confidence)
    if (lytxEvent.employee_id && driver.employee_id && 
        lytxEvent.employee_id === driver.employee_id) {
      return {
        driver_id: driver.id,
        confidence: 1.0,
        method: 'employee_id_match',
        driver_name: driver.full_name
      };
    }
    
    // Method 2: Exact name match
    const driverFullName = `${driver.first_name} ${driver.last_name}`;
    if (normalizeName(lytxEvent.driver_name) === normalizeName(driverFullName)) {
      return {
        driver_id: driver.id,
        confidence: 0.95,
        method: 'exact_match',
        driver_name: driverFullName
      };
    }
    
    // Method 3: Fuzzy name matching
    const similarity = checkNameVariations(lytxEvent.driver_name, driverFullName);
    if (similarity >= 0.7) { // Minimum threshold for fuzzy matching
      if (!bestMatch || similarity > bestMatch.confidence) {
        bestMatch = {
          driver_id: driver.id,
          confidence: Math.min(similarity, 0.9), // Cap fuzzy matches at 0.9
          method: 'fuzzy_match',
          driver_name: driverFullName
        };
      }
    }
  }
  
  return bestMatch;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('--dryRun');
  const batchSize = parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '1000', 10);
  const minConfidence = parseFloat(args.find(arg => arg.startsWith('--min-confidence='))?.split('=')[1] || '0.7');
  
  console.log('LYTX Driver Correlation Engine');
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
    .select('id, first_name, last_name, employee_id, fleet, depot')
    .eq('status', 'Active');

  if (driversError) {
    throw new Error(`Failed to load drivers: ${driversError.message}`);
  }

  const drivers: Driver[] = driversData.map(d => ({
    ...d,
    full_name: `${d.first_name} ${d.last_name}`
  }));

  console.log(`Loaded ${drivers.length} active drivers`);

  // Get LYTX events that need driver association
  console.log('Loading LYTX events without driver associations...');
  const { data: eventsData, error: eventsError } = await supabase
    .from('lytx_safety_events')
    .select('id, event_id, driver_name, employee_id, carrier, depot')
    .is('driver_id', null)
    .order('event_datetime', { ascending: false });

  if (eventsError) {
    throw new Error(`Failed to load LYTX events: ${eventsError.message}`);
  }

  console.log(`Found ${eventsData.length} LYTX events needing driver association`);
  console.log('');

  if (dryRun) {
    console.log('DRY RUN - Testing driver matching logic...');
    const sampleEvents = eventsData.slice(0, 10);
    
    for (const event of sampleEvents) {
      const match = findBestDriverMatch(event, drivers);
      console.log(`Event ${event.event_id}:`);
      console.log(`  LYTX Driver: "${event.driver_name}" (${event.carrier})`);
      if (match) {
        console.log(`  ✅ Match: "${match.driver_name}" (confidence: ${match.confidence.toFixed(3)}, method: ${match.method})`);
      } else {
        console.log(`  ❌ No match found`);
      }
      console.log('');
    }
    return;
  }

  // Process events in batches
  let processed = 0;
  let successful = 0;
  let failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < eventsData.length; i += batchSize) {
    const batch = eventsData.slice(i, i + batchSize);
    const updates: any[] = [];

    for (const event of batch) {
      const match = findBestDriverMatch(event, drivers);
      
      if (match && match.confidence >= minConfidence) {
        updates.push({
          event_id: event.event_id,
          driver_id: match.driver_id,
          driver_association_confidence: match.confidence,
          driver_association_method: match.method
        });
      }
    }

    if (updates.length > 0) {
      try {
        // Use update instead of upsert since we're only updating existing records
        for (const update of updates) {
          const { error } = await supabase
            .from('lytx_safety_events')
            .update({
              driver_id: update.driver_id,
              driver_association_confidence: update.driver_association_confidence,
              driver_association_method: update.driver_association_method,
              driver_association_updated_at: new Date().toISOString()
            })
            .eq('event_id', update.event_id);

          if (error) {
            console.error(`Event ${update.event_id} error:`, error.message);
            failed++;
          } else {
            successful++;
          }
        }
      } catch (err) {
        console.error(`Batch ${Math.floor(i / batchSize) + 1} exception:`, err);
        failed += updates.length;
      }
    }

    processed += batch.length;
    const progress = Math.round((processed / eventsData.length) * 100);
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const rate = Math.round(processed / elapsed);
    
    process.stdout.write(`\rProgress: ${processed}/${eventsData.length} (${progress}%) - ${successful} associated, ${failed} failed - ${rate} events/sec`);
  }

  console.log('\n\nCorrelation complete!');
  console.log(`✅ Successfully associated: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total processed: ${processed}`);
  console.log(`⏱️  Time elapsed: ${Math.round((Date.now() - startTime) / 1000)}s`);

  // Generate summary report
  const { count: totalWithDrivers } = await supabase
    .from('lytx_safety_events')
    .select('*', { count: 'exact', head: true })
    .not('driver_id', 'is', null);

  const { count: totalEvents } = await supabase
    .from('lytx_safety_events')
    .select('*', { count: 'exact', head: true });

  const associationRate = totalEvents ? Math.round((totalWithDrivers / totalEvents) * 100 * 100) / 100 : 0;

  console.log('\n📈 Final Statistics:');
  console.log(`Total LYTX events: ${totalEvents}`);
  console.log(`Events with driver associations: ${totalWithDrivers}`);
  console.log(`Overall association rate: ${associationRate}%`);
}

main().catch((err) => {
  console.error('Correlation failed:', err.message);
  process.exit(1);
});