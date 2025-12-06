import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: allLocations, error } = await supabase
  .from('ta_agbot_locations')
  .select('id, address, state, latitude, longitude');

console.log('Total locations:', allLocations?.length);
console.log('Error:', error);

const withCoords = allLocations?.filter(l => l.latitude !== null && l.longitude !== null);
console.log('With coordinates:', withCoords?.length);
console.log('First 3:', JSON.stringify(withCoords?.slice(0, 3), null, 2));
