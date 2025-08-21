/*
  Fix LYTX View Dependencies
  - Safely updates the enriched view by handling dependent views
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

  console.log('Fixing LYTX view dependencies...\n');

  // Read migration file
  const migrationPath = resolve('database/migrations/fix_lytx_view_dependencies.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');

  // Execute the entire migration as one transaction
  console.log('Executing view dependency fix migration...');
  
  try {
    // Since we can't use exec_sql, we'll need to execute this manually
    // For now, let's test if we can create a simple view first
    
    console.log('Testing view creation capability...');
    
    // Test creating a simple temporary view
    const testViewSQL = `
      CREATE OR REPLACE VIEW test_view_temp AS 
      SELECT event_id, driver_name FROM lytx_safety_events LIMIT 1;
    `;
    
    const { error: testError } = await supabase.rpc('exec_sql', { sql_query: testViewSQL });
    
    if (testError) {
      console.log('exec_sql not available, trying alternative approach...');
      console.log('Manual execution required for view updates.');
      console.log('\nPlease execute the following SQL manually in your database:');
      console.log('==========================================');
      console.log(migrationSQL);
      console.log('==========================================');
      
      // Test the current state instead
      console.log('\nTesting current view state...');
      
      const { data: currentData, error: currentError } = await supabase
        .from('lytx_events_driver_enriched')
        .select('event_id, driver_name, resolved_driver_id')
        .not('resolved_driver_id', 'is', null)
        .limit(3);

      if (currentError) {
        console.error('❌ Current view test failed:', currentError.message);
      } else {
        console.log('✅ Current view is accessible');
        console.log('Sample data:', currentData);
      }
      
    } else {
      console.log('✅ exec_sql available, executing migration...');
      
      // Drop the test view
      await supabase.rpc('exec_sql', { sql_query: 'DROP VIEW IF EXISTS test_view_temp;' });
      
      // Execute the actual migration
      const { error: migrationError } = await supabase.rpc('exec_sql', { sql_query: migrationSQL });
      
      if (migrationError) {
        console.error('❌ Migration failed:', migrationError.message);
      } else {
        console.log('✅ Migration executed successfully');
      }
    }

  } catch (err) {
    console.error('❌ Error during migration:', err);
  }

  // Test the final state regardless of execution method
  console.log('\nTesting final view state...');
  
  try {
    // Test main enriched view
    const { data: enrichedData, error: enrichedError } = await supabase
      .from('lytx_events_driver_enriched')
      .select(`
        event_id,
        driver_name,
        resolved_driver_id,
        resolved_driver_name,
        driver_association_method,
        driver_association_confidence
      `)
      .not('resolved_driver_id', 'is', null)
      .limit(3);

    if (enrichedError) {
      console.error('❌ Enriched view test failed:', enrichedError.message);
    } else {
      console.log('✅ Enhanced view working:');
      enrichedData?.forEach(row => {
        console.log(`  ${row.event_id}: "${row.driver_name}" → "${row.resolved_driver_name}" (${row.driver_association_method}, ${row.driver_association_confidence})`);
      });
    }

    // Test dependent view
    const { data: depotData, error: depotError } = await supabase
      .from('depot_manager_overview')
      .select('fleet, depot, total_drivers, lytx_events_30d')
      .limit(3);

    if (depotError) {
      console.error('❌ Depot manager view test failed:', depotError.message);
    } else {
      console.log('\n✅ Depot manager overview working:');
      depotData?.forEach(row => {
        console.log(`  ${row.fleet} - ${row.depot}: ${row.total_drivers} drivers, ${row.lytx_events_30d} LYTX events (30d)`);
      });
    }

  } catch (err) {
    console.error('❌ Final testing failed:', err);
  }

  console.log('\n📊 Getting final statistics...');
  
  const { count: totalEvents } = await supabase
    .from('lytx_safety_events')
    .select('*', { count: 'exact', head: true });

  const { count: associatedEvents } = await supabase
    .from('lytx_safety_events')
    .select('*', { count: 'exact', head: true })
    .not('driver_id', 'is', null);

  const associationRate = totalEvents ? Math.round((associatedEvents / totalEvents) * 100 * 100) / 100 : 0;

  console.log(`Total LYTX events: ${totalEvents}`);
  console.log(`Events with driver associations: ${associatedEvents}`);
  console.log(`Overall association rate: ${associationRate}%`);
}

main().catch((err) => {
  console.error('Fix failed:', err.message);
  process.exit(1);
});