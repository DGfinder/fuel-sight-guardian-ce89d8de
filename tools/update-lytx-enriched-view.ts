/*
  Update LYTX Events Driver Enriched View
  - Updates the view to use foreign key relationships instead of name matching
*/

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function getEnv(name: string, fallbackName?: string): string | undefined {
  return process.env[name] || (fallbackName ? process.env[fallbackName] : undefined);
}

async function main() {
  // Setup Supabase client
  const supabaseUrl = getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL') || '';
  const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY') || '';
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration');
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Updating LYTX events driver enriched view...\n');

  // Read migration file
  const migrationPath = resolve('database/migrations/update_lytx_enriched_view.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');

  // Split SQL into individual statements
  const statements = migrationSQL
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    
    // Skip comments and empty statements
    if (statement.startsWith('--') || statement.length < 10) {
      continue;
    }

    console.log(`Executing statement ${i + 1}/${statements.length}...`);
    
    try {
      // Execute SQL directly using rpc call
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: statement });
      
      if (error) {
        console.error(`❌ Error in statement ${i + 1}: ${error.message}`);
        errorCount++;
      } else {
        console.log(`✅ Statement ${i + 1} executed successfully`);
        successCount++;
      }
    } catch (err) {
      console.error(`❌ Exception in statement ${i + 1}: ${err}`);
      errorCount++;
    }
  }

  console.log(`\nView update complete:`);
  console.log(`✅ Successful statements: ${successCount}`);
  console.log(`❌ Failed statements: ${errorCount}`);

  // Test the updated view
  console.log('\nTesting updated view...');
  
  const { data: sampleData, error: sampleError } = await supabase
    .from('lytx_events_driver_enriched')
    .select(`
      event_id,
      driver_name,
      resolved_driver_name,
      driver_resolution_method,
      driver_association_confidence,
      driver_association_method
    `)
    .not('resolved_driver_id', 'is', null)
    .limit(5);

  if (sampleError) {
    console.error('❌ Failed to test view:', sampleError.message);
  } else {
    console.log('✅ Updated view working correctly');
    console.log('\nSample resolved drivers:');
    sampleData?.forEach(row => {
      console.log(`  Event ${row.event_id}:`);
      console.log(`    LYTX: "${row.driver_name}" → Resolved: "${row.resolved_driver_name}"`);
      console.log(`    Method: ${row.driver_resolution_method} (confidence: ${row.driver_association_confidence || 'N/A'})`);
      console.log('');
    });
  }

  // Get statistics
  const { count: totalEvents } = await supabase
    .from('lytx_events_driver_enriched')
    .select('*', { count: 'exact', head: true });

  const { count: resolvedEvents } = await supabase
    .from('lytx_events_driver_enriched')
    .select('*', { count: 'exact', head: true })
    .not('resolved_driver_id', 'is', null);

  const resolutionRate = totalEvents ? Math.round((resolvedEvents / totalEvents) * 100 * 100) / 100 : 0;

  console.log(`\n📊 View statistics:`);
  console.log(`Total LYTX events: ${totalEvents}`);
  console.log(`Events with resolved drivers: ${resolvedEvents}`);
  console.log(`Driver resolution rate: ${resolutionRate}%`);
}

main().catch((err) => {
  console.error('View update failed:', err.message);
  process.exit(1);
});