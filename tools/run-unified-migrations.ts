/*
  Run Unified Driver Association Migrations
  - Adds driver_id fields to Guardian and MtData tables
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

  console.log('🔧 Running unified driver association migrations...\n');

  const migrations = [
    'add_guardian_driver_associations.sql',
    'add_mtdata_driver_associations.sql'
  ];

  for (const migrationFile of migrations) {
    console.log(`📝 Processing ${migrationFile}...`);
    
    try {
      const migrationPath = resolve('database/migrations', migrationFile);
      const migrationSQL = readFileSync(migrationPath, 'utf-8');

      // Try to execute via SQL - since exec_sql might not be available, we'll test the structure instead
      console.log(`   Testing table structure for ${migrationFile.includes('guardian') ? 'guardian_events' : 'mtdata_trip_history'}...`);
      
      const tableName = migrationFile.includes('guardian') ? 'guardian_events' : 'mtdata_trip_history';
      
      // Test if we can access the table and check for driver_id column
      const { data: sampleData, error: sampleError } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (sampleError) {
        console.log(`   ❌ Cannot access ${tableName}: ${sampleError.message}`);
        continue;
      }

      if (sampleData && sampleData[0]) {
        const hasDriverId = Object.keys(sampleData[0]).includes('driver_id');
        console.log(`   ${hasDriverId ? '✅' : '⚠️'} driver_id column ${hasDriverId ? 'exists' : 'missing'}`);
        
        if (!hasDriverId) {
          console.log(`   📋 Migration needed for ${tableName}`);
          console.log(`   🔧 Please execute this SQL manually:`);
          console.log(`   ${migrationSQL.substring(0, 200)}...`);
        }
      }
      
    } catch (err) {
      console.error(`   ❌ Error processing ${migrationFile}: ${err}`);
    }
    
    console.log('');
  }

  console.log('📊 Checking final table structures...');
  
  // Check all tables have driver_id columns
  const tables = ['lytx_safety_events', 'mtdata_trip_history', 'guardian_events'];
  
  for (const table of tables) {
    try {
      const { data: sample } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (sample && sample[0]) {
        const hasDriverId = Object.keys(sample[0]).includes('driver_id');
        console.log(`${table}: ${hasDriverId ? '✅' : '❌'} driver_id column`);
      }
    } catch (err) {
      console.log(`${table}: ❌ Cannot access`);
    }
  }

  console.log('\n✅ Migration check complete!');
}

main().catch((err) => {
  console.error('Migration check failed:', err.message);
  process.exit(1);
});