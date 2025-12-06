import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xvlnksfmrfauyxfcxdof.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2bG5rc2ZtcmZhdXl4ZmN4ZG9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5NjMxNDMsImV4cCI6MjA2MDUzOTE0M30.Vbplm3vfuz5MJ1QqrdgVKoRSl85bqeoAPO2EhdDiAzQ'
);

async function checkLatLng() {
  const { data, error } = await supabase
    .from('ta_agbot_locations')
    .select('location_id, customer_name, lat, lng, address1')
    .order('customer_name');

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  const withCoords = data.filter(d => d.lat && d.lng);
  const withoutCoords = data.filter(d => !d.lat || !d.lng);

  console.log('Total AgBot locations:', data.length);
  console.log('With coordinates:', withCoords.length);
  console.log('Missing coordinates:', withoutCoords.length);

  if (withoutCoords.length > 0) {
    console.log('\n=== MISSING COORDINATES ===');
    withoutCoords.forEach(d => {
      console.log(`- ${d.location_id} (${d.customer_name}): ${d.address1 || 'No address'}`);
    });
  }

  console.log('\n=== SAMPLE WITH COORDINATES ===');
  withCoords.slice(0, 5).forEach(d => {
    console.log(`- ${d.location_id}: ${d.lat}, ${d.lng}`);
  });
}

checkLatLng();
