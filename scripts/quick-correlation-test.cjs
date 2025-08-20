#!/usr/bin/env node

/**
 * Quick Correlation Test
 * Runs a simple correlation analysis to verify the system is working
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function quickCorrelationTest() {
  console.log('🚀 Quick Correlation Test\n');

  try {
    // Get a sample trip with location data
    console.log('1. Finding a sample trip...');
    const { data: sampleTrip, error: tripError } = await supabase
      .from('mtdata_trip_history')
      .select('id, trip_external_id, start_location, end_location, trip_date_computed, group_name, distance_km')
      .not('start_location', 'is', null)
      .gte('trip_date_computed', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .limit(1)
      .single();

    if (tripError || !sampleTrip) {
      console.error('❌ No suitable trips found for testing');
      return;
    }

    console.log(`   ✅ Found trip: ${sampleTrip.trip_external_id}`);
    console.log(`      Route: ${sampleTrip.start_location} → ${sampleTrip.end_location}`);
    console.log(`      Date: ${sampleTrip.trip_date_computed}`);
    console.log(`      Fleet: ${sampleTrip.group_name}`);
    console.log(`      Distance: ${sampleTrip.distance_km} km`);

    // Get potential captive deliveries for this trip
    console.log('\n2. Finding potential captive deliveries...');
    const { data: deliveries, error: delError } = await supabase
      .from('captive_deliveries')
      .select('delivery_key, customer, terminal, delivery_date, carrier, total_volume_litres_abs')
      .gte('delivery_date', new Date(sampleTrip.trip_date_computed).getTime() - 3 * 24 * 60 * 60 * 1000)
      .lte('delivery_date', new Date(sampleTrip.trip_date_computed).getTime() + 3 * 24 * 60 * 60 * 1000)
      .limit(10);

    if (delError) {
      console.error('❌ Error fetching deliveries:', delError.message);
      return;
    }

    console.log(`   📦 Found ${deliveries.length} potential deliveries within ±3 days`);
    deliveries.forEach(delivery => {
      const daysDiff = Math.abs(new Date(delivery.delivery_date) - new Date(sampleTrip.trip_date_computed)) / (1000 * 60 * 60 * 24);
      console.log(`      - ${delivery.customer} at ${delivery.terminal} (${delivery.carrier})`);
      console.log(`        Date: ${delivery.delivery_date}, Volume: ${delivery.total_volume_litres_abs}L, Days diff: ${daysDiff.toFixed(1)}`);
    });

    // Try to run correlation analysis
    console.log('\n3. Testing correlation analysis...');
    try {
      const { data: correlations, error: corrError } = await supabase
        .rpc('hybrid_correlate_trip_with_deliveries', {
          trip_id_input: sampleTrip.id,
          date_tolerance_days: 3,
          max_distance_km: 150,
          min_confidence: 50,
          enable_geospatial: true,
          enable_text_matching: true,
          enable_lookup_boost: true
        });

      if (corrError) {
        console.log('   ⚠️  Correlation function error:', corrError.message);
        console.log('   💡 This might mean the function needs to be created');
      } else {
        console.log(`   ✅ Correlation analysis successful! Found ${correlations.length} matches`);
        
        if (correlations.length > 0) {
          console.log('\n   🎯 Top matches:');
          correlations.slice(0, 3).forEach((match, index) => {
            console.log(`      ${index + 1}. ${match.customer_name} at ${match.terminal_name}`);
            console.log(`         Confidence: ${match.overall_confidence}% (Text: ${match.text_confidence}%, Geo: ${match.geo_confidence}%, Temp: ${match.temporal_confidence}%)`);
            console.log(`         Quality: ${match.match_quality}, Distance: ${match.terminal_distance_km}km`);
            console.log(`         Date diff: ${match.date_difference_days} days`);
          });
        }
      }
    } catch (functionError) {
      console.log('   ⚠️  Function not available or error occurred');
      console.log(`      Error: ${functionError.message}`);
    }

    // Check existing correlations for this trip
    console.log('\n4. Checking existing correlations...');
    const { data: existingCorrelations, error: existError } = await supabase
      .from('mtdata_captive_correlations')
      .select('*')
      .eq('mtdata_trip_id', sampleTrip.id)
      .order('confidence_score', { ascending: false });

    if (existError) {
      console.log('   ⚠️  Error checking existing correlations:', existError.message);
    } else {
      console.log(`   📊 Found ${existingCorrelations.length} existing correlations for this trip`);
      if (existingCorrelations.length > 0) {
        existingCorrelations.forEach(corr => {
          console.log(`      - ${corr.customer_name} (${corr.confidence_score}% confidence, ${corr.match_type})`);
        });
      }
    }

    // Summary
    console.log('\n📋 Summary:');
    console.log(`   - Trip: ${sampleTrip.trip_external_id} (${sampleTrip.start_location} → ${sampleTrip.end_location})`);
    console.log(`   - Potential deliveries: ${deliveries.length} within ±3 days`);
    console.log(`   - Existing correlations: ${existingCorrelations?.length || 0}`);
    
    if (existingCorrelations?.length === 0) {
      console.log('\n💡 Next steps:');
      console.log('   - Run the correlation migration if not done yet');
      console.log('   - Execute the batch correlation analysis');
      console.log('   - Check RLS policies on correlation tables');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

quickCorrelationTest()
  .then(() => {
    console.log('\n🏁 Quick test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
