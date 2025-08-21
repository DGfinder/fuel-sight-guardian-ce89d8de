/*
  Check Actual Table Structure
  - Verifies what columns exist in each table
*/

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

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

  console.log('🔍 CHECKING ACTUAL TABLE STRUCTURES...\n');

  const tables = ['lytx_safety_events', 'mtdata_trip_history', 'guardian_events'];
  
  for (const table of tables) {
    try {
      console.log(`📊 ${table}:`);
      
      const { data: sample } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (sample && sample[0]) {
        const columns = Object.keys(sample[0]);
        console.log(`   Total columns: ${columns.length}`);
        
        // Check for driver-related columns
        const driverColumns = columns.filter(col => col.includes('driver'));
        console.log(`   Driver columns: ${driverColumns.join(', ')}`);
        
        // Check for specific association columns we need
        const requiredCols = ['driver_id', 'driver_association_confidence', 'driver_association_method', 'driver_association_updated_at'];
        requiredCols.forEach(col => {
          const exists = columns.includes(col);
          console.log(`   ${col}: ${exists ? '✅' : '❌'}`);
        });
      } else {
        console.log(`   ❌ No data in table`);
      }
      console.log('');
    } catch (err) {
      console.log(`   ❌ Error: ${err}`);
    }
  }
}

main().catch((err) => {
  console.error('Check failed:', err.message);
  process.exit(1);
});