/*
  Run LYTX Driver Association Migration
  - Adds driver_id and confidence fields to lytx_safety_events table
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

  console.log('Running LYTX driver association migration...\n');

  // Read migration file
  const migrationPath = resolve('database/migrations/add_lytx_driver_associations.sql');
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
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
      
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

  console.log(`\nMigration complete:`);
  console.log(`✅ Successful statements: ${successCount}`);
  console.log(`❌ Failed statements: ${errorCount}`);

  // Test the new fields by checking table structure
  console.log('\nVerifying new fields...');
  
  const { data, error } = await supabase
    .from('lytx_safety_events')
    .select('driver_id, driver_association_confidence, driver_association_method')
    .limit(1);

  if (error) {
    console.error('❌ Failed to verify new fields:', error.message);
  } else {
    console.log('✅ New fields verified successfully');
    console.log('Available fields:', Object.keys(data[0] || {}));
  }

  // Check association summary
  try {
    const { data: summary, error: summaryError } = await supabase
      .from('lytx_driver_association_summary')
      .select('*')
      .single();

    if (summaryError) {
      console.error('❌ Failed to query association summary:', summaryError.message);
    } else {
      console.log('\n📊 Current association status:');
      console.log(`Total LYTX events: ${summary.total_lytx_events}`);
      console.log(`Events with driver associations: ${summary.events_with_drivers}`);
      console.log(`Events without driver associations: ${summary.events_without_drivers}`);
      console.log(`Association rate: ${summary.overall_association_rate}%`);
    }
  } catch (err) {
    console.log('Note: Association summary view not yet available');
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});