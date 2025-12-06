import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Default risk profiles by region and industry
// NOTE: Road risk is primarily for MINING operations (Kalgoorlie, Pilbara)
// Most FARMS have adequate road access - main concerns are operations windows, not road closures
const regionalDefaults = {
  'Kalgoorlie': { type: 'unsealed', threshold: 35, duration: 4 }, // Mining - remote sites, unsealed haul roads
  'Pilbara': { type: 'unsealed', threshold: 50, duration: 5 }, // Mining - cyclone/monsoon risk, very remote
  'Wheatbelt': { type: 'sealed', threshold: 80, duration: 1 }, // Farming - most farms on sealed or good gravel
  'Geraldton': { type: 'sealed', threshold: 80, duration: 1 }, // Farming - coastal, sealed roads
  'Perth Metro': { type: 'sealed', threshold: 100, duration: 0 }, // Urban - no risk
};

async function populateRoadRisks() {
  console.log('🔍 Fetching tank locations...');

  // Get all tank locations with lat/lng
  const { data: allLocations, error } = await supabase
    .from('ta_agbot_locations')
    .select('id, address, state, latitude, longitude');

  if (error) {
    console.error('❌ Error fetching locations:', error);
    return;
  }

  // Filter for locations with coordinates
  const locations = (allLocations || []).filter(loc =>
    loc.latitude != null && loc.longitude != null
  );

  if (locations.length === 0) {
    console.log('⚠️ No locations with coordinates found');
    return;
  }

  console.log(`📍 Found ${locations.length} locations with coordinates`);

  let successCount = 0;
  let errorCount = 0;

  for (const location of locations) {
    // Determine region from address (basic heuristic)
    const region = detectRegion(location.address);
    const defaults = regionalDefaults[region] || regionalDefaults['Wheatbelt'];

    const { error: upsertError } = await supabase.from('road_risk_profiles').upsert({
      agbot_location_id: location.id,
      access_road_type: defaults.type,
      closure_threshold_mm: defaults.threshold,
      typical_closure_duration_days: defaults.duration,
    }, {
      onConflict: 'agbot_location_id'
    });

    if (upsertError) {
      console.error(`❌ Error for location ${location.id}:`, upsertError.message);
      errorCount++;
    } else {
      successCount++;
    }
  }

  console.log(`✅ Successfully populated ${successCount} road risk profiles`);
  if (errorCount > 0) {
    console.log(`⚠️ Failed to populate ${errorCount} profiles`);
  }
}

function detectRegion(address) {
  if (!address) return 'Wheatbelt';
  const lower = address.toLowerCase();

  // Mining regions - HIGH road risk (unsealed, remote)
  if (lower.includes('kalgoorlie') || lower.includes('kambalda') || lower.includes('coolgardie')) return 'Kalgoorlie';
  if (lower.includes('karratha') || lower.includes('port hedland') || lower.includes('newman') || lower.includes('tom price')) return 'Pilbara';

  // Farming regions - LOW road risk (sealed or good gravel)
  if (lower.includes('geraldton') || lower.includes('northampton')) return 'Geraldton';
  if (lower.includes('perth') || lower.includes('fremantle') || lower.includes('rockingham')) return 'Perth Metro';

  return 'Wheatbelt'; // Default for farming areas
}

populateRoadRisks()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
