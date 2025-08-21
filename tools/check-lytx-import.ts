/*
  Check LYTX Import Results
  - Verifies if specific event IDs were imported/updated correctly
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

  // Check specific event IDs from the CSV sample
  const testEventIds = [
    'AARDT14371', // Daniel Smith
    'AARDT14435', // Brian Torpy  
    'AARDS94809', // Samuel Maclean
    'AARDS89656', // Aurelien Bonnaudin (Frenchy)
    'AARDM55066'  // Robert Waller (Resolved status)
  ];

  console.log('Checking import results for sample event IDs...\n');

  for (const eventId of testEventIds) {
    const { data, error } = await supabase
      .from('lytx_safety_events')
      .select('event_id, driver_name, vehicle_registration, status, depot, carrier, created_at, updated_at')
      .eq('event_id', eventId)
      .single();

    if (error) {
      console.log(`❌ ${eventId}: Not found or error - ${error.message}`);
    } else {
      console.log(`✅ ${eventId}:`);
      console.log(`   Driver: ${data.driver_name}`);
      console.log(`   Vehicle: ${data.vehicle_registration}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Depot: ${data.depot}`);
      console.log(`   Carrier: ${data.carrier}`);
      console.log(`   Created: ${data.created_at}`);
      console.log(`   Updated: ${data.updated_at}`);
      console.log('');
    }
  }

  // Get total count of records
  const { count } = await supabase
    .from('lytx_safety_events')
    .select('*', { count: 'exact', head: true });

  console.log(`Total LYTX events in database: ${count}`);

  // Check for any "Driver Unassigned" records
  const { data: unassignedData, count: unassignedCount } = await supabase
    .from('lytx_safety_events')
    .select('event_id, driver_name, vehicle_registration, depot')
    .eq('driver_name', 'Driver Unassigned')
    .limit(5);

  console.log(`\nRecords with "Driver Unassigned": ${unassignedCount}`);
  if (unassignedData && unassignedData.length > 0) {
    console.log('Sample unassigned records:');
    unassignedData.forEach(record => {
      console.log(`  ${record.event_id}: ${record.driver_name} (${record.depot})`);
    });
  }
}

main().catch((err) => {
  console.error('Check failed:', err.message);
  process.exit(1);
});