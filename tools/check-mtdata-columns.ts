/*
  Check MtData Trip History Column Structure
  - Identifies actual column names to fix query errors
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

  console.log('🔍 CHECKING MTDATA_TRIP_HISTORY COLUMN STRUCTURE...\n');

  try {
    // Get a sample record to see all available columns
    const { data: sample, error } = await supabase
      .from('mtdata_trip_history')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Error accessing mtdata_trip_history:', error.message);
      return;
    }

    if (!sample || sample.length === 0) {
      console.log('❌ No data found in mtdata_trip_history table');
      return;
    }

    const record = sample[0];
    const columns = Object.keys(record);
    
    console.log(`📊 Found ${columns.length} columns in mtdata_trip_history:`);
    console.log('');
    
    // Group columns by category for easier reading
    const driverColumns = columns.filter(col => col.includes('driver'));
    const volumeColumns = columns.filter(col => col.includes('volume') || col.includes('litre') || col.includes('liter'));
    const distanceColumns = columns.filter(col => col.includes('distance') || col.includes('km'));
    const timeColumns = columns.filter(col => col.includes('time') || col.includes('duration') || col.includes('hour'));
    const otherColumns = columns.filter(col => 
      !driverColumns.includes(col) && 
      !volumeColumns.includes(col) && 
      !distanceColumns.includes(col) && 
      !timeColumns.includes(col)
    );

    console.log('🚛 Driver-related columns:');
    driverColumns.forEach(col => console.log(`  - ${col}: ${typeof record[col]} = ${record[col]}`));
    
    console.log('\n🛢️  Volume-related columns:');
    volumeColumns.forEach(col => console.log(`  - ${col}: ${typeof record[col]} = ${record[col]}`));
    
    console.log('\n📏 Distance-related columns:');
    distanceColumns.forEach(col => console.log(`  - ${col}: ${typeof record[col]} = ${record[col]}`));
    
    console.log('\n⏱️  Time-related columns:');
    timeColumns.forEach(col => console.log(`  - ${col}: ${typeof record[col]} = ${record[col]}`));
    
    console.log('\n📋 Other columns:');
    otherColumns.forEach(col => console.log(`  - ${col}: ${typeof record[col]} = ${record[col]}`));

    // Check specifically for the problematic query columns
    console.log('\n🔍 QUERY VALIDATION:');
    const queryColumns = ['start_time', 'distance_km', 'duration_hours', 'total_volume_litres'];
    queryColumns.forEach(col => {
      const exists = columns.includes(col);
      console.log(`  ${col}: ${exists ? '✅ EXISTS' : '❌ MISSING'}`);
      if (!exists) {
        // Look for similar column names
        const similar = columns.filter(c => c.toLowerCase().includes(col.toLowerCase().split('_')[0]));
        if (similar.length > 0) {
          console.log(`    Similar: ${similar.join(', ')}`);
        }
      }
    });

    // Check total record count
    const { count } = await supabase
      .from('mtdata_trip_history')
      .select('*', { count: 'exact', head: true });
    
    console.log(`\n📊 Total records in table: ${count}`);

  } catch (err) {
    console.error('❌ Error checking table structure:', err);
  }
}

main().catch((err) => {
  console.error('Check failed:', err.message);
  process.exit(1);
});