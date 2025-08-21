/*
  Check All Systems for Driver Correlation Needs
  - Identifies which systems need driver correlation
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

  console.log('🔍 CHECKING ALL SYSTEMS FOR CORRELATION NEEDS...\n');
  
  // Check all tables that might need driver correlation
  const tables = ['lytx_safety_events', 'mtdata_trip_history', 'guardian_events'];
  
  for (const table of tables) {
    try {
      // Check if table exists and has driver_name column
      const { data: sample, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
        
      if (error) {
        console.log(`${table}: Does not exist or no access`);
        console.log(`  Error: ${error.message}\n`);
        continue;
      }
      
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
        
      console.log(`${table}: ${count} records`);
      
      if (sample && sample[0]) {
        const columns = Object.keys(sample[0]);
        const hasDriverName = columns.includes('driver_name');
        const hasDriverId = columns.includes('driver_id');
        console.log(`  - Has driver_name: ${hasDriverName}`);
        console.log(`  - Has driver_id: ${hasDriverId}`);
        
        if (hasDriverName && !hasDriverId) {
          console.log(`  ⚠️  NEEDS CORRELATION: Has driver_name but no driver_id foreign key`);
        } else if (hasDriverName && hasDriverId) {
          // Check how many are already correlated
          const { count: linkedCount } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true })
            .not('driver_id', 'is', null);
            
          const correlationRate = count ? Math.round((linkedCount / count) * 100 * 100) / 100 : 0;
          console.log(`  📊 Correlation rate: ${correlationRate}% (${linkedCount}/${count})`);
          
          if (correlationRate < 100) {
            console.log(`  ⚠️  NEEDS MORE CORRELATION: ${count - linkedCount} records missing driver_id`);
          }
        }
      }
      console.log('');
    } catch (err) {
      console.log(`${table}: Error checking - ${err}`);
    }
  }

  // Also check the driver name mapping situation
  console.log('📋 DRIVER NAME MAPPING STATUS:');
  
  const { count: driversCount } = await supabase
    .from('drivers')
    .select('*', { count: 'exact', head: true });
    
  const { count: mappingsCount } = await supabase
    .from('driver_name_mappings')
    .select('*', { count: 'exact', head: true });
    
  console.log(`Drivers table: ${driversCount} drivers`);
  console.log(`Name mappings: ${mappingsCount} mappings`);
  console.log(`Expected mappings per driver: ${mappingsCount / driversCount} (should be 5-6 for different systems)`);
}

main().catch((err) => {
  console.error('Check failed:', err.message);
  process.exit(1);
});