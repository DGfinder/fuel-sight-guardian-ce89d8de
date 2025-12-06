import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Default risk profiles by region
const regionalDefaults: Record<string, { type: 'sealed' | 'gravel' | 'unsealed', threshold: number, duration: number }> = {
  'Wheatbelt': { type: 'gravel', threshold: 40, duration: 3 },
  'Geraldton': { type: 'gravel', threshold: 35, duration: 2 },
  'Pilbara': { type: 'unsealed', threshold: 50, duration: 5 },
  'Perth Metro': { type: 'sealed', threshold: 100, duration: 0 },
};

async function populateRoadRisks() {
  console.log('🔍 Fetching tank locations...');

  // Get all tank locations with lat/lng
  const { data: locations, error } = await supabase
    .from('ta_agbot_locations')
    .select('id, address1, state, lat, lng')
    .not('lat', 'is', null)
    .not('lng', 'is', null);

  if (error) {
    console.error('❌ Error fetching locations:', error);
    return;
  }

  if (!locations || locations.length === 0) {
    console.log('⚠️ No locations with lat/lng found');
    return;
  }

  console.log(`📍 Found ${locations.length} locations with coordinates`);

  let successCount = 0;
  let errorCount = 0;

  for (const location of locations) {
    // Determine region from address (basic heuristic)
    const region = detectRegion(location.address1);
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

function detectRegion(address: string): string {
  if (!address) return 'Wheatbelt';
  const lower = address.toLowerCase();
  if (lower.includes('geraldton')) return 'Geraldton';
  if (lower.includes('karratha') || lower.includes('port hedland')) return 'Pilbara';
  if (lower.includes('perth') || lower.includes('fremantle')) return 'Perth Metro';
  return 'Wheatbelt'; // Default
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
