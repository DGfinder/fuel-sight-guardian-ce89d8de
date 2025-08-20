#!/usr/bin/env node

/**
 * Test Trip Correlation System
 * Verifies that MTdata trips can be matched to captive payment records
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testTripCorrelation() {
  console.log('🔍 Testing Trip Correlation System...\n');

  try {
    // 1. Check if correlation table exists and has data
    console.log('1. Checking correlation table status...');
    const { data: correlationCount, error: countError } = await supabase
      .from('mtdata_captive_correlations')
      .select('id', { count: 'exact' });

    if (countError) {
      console.error('❌ Error checking correlations:', countError.message);
      return;
    }

    console.log(`   📊 Found ${correlationCount.length} existing correlations`);

    // 2. Check if we have MTdata trips
    console.log('\n2. Checking MTdata trips...');
    const { data: trips, error: tripsError } = await supabase
      .from('mtdata_trip_history')
      .select('id, trip_external_id, start_location, end_location, trip_date_computed, group_name')
      .not('start_location', 'is', null)
      .limit(5);

    if (tripsError) {
      console.error('❌ Error fetching trips:', tripsError.message);
      return;
    }

    console.log(`   🚛 Found ${trips.length} trips with location data`);
    trips.forEach(trip => {
      console.log(`      - ${trip.trip_external_id}: ${trip.start_location} → ${trip.end_location} (${trip.group_name})`);
    });

    // 3. Check if we have captive deliveries
    console.log('\n3. Checking captive deliveries...');
    const { data: deliveries, error: deliveriesError } = await supabase
      .from('captive_deliveries')
      .select('delivery_key, customer, terminal, delivery_date, carrier')
      .limit(5);

    if (deliveriesError) {
      console.error('❌ Error fetching deliveries:', deliveriesError.message);
      return;
    }

    console.log(`   📦 Found ${deliveries.length} captive deliveries`);
    deliveries.forEach(delivery => {
      console.log(`      - ${delivery.delivery_key}: ${delivery.customer} at ${delivery.terminal} (${delivery.carrier})`);
    });

    // 4. Test the hybrid correlation function on a single trip
    if (trips.length > 0) {
      console.log('\n4. Testing hybrid correlation function...');
      const testTrip = trips[0];
      
      const { data: correlations, error: corrError } = await supabase
        .rpc('hybrid_correlate_trip_with_deliveries', {
          trip_id_input: testTrip.id,
          date_tolerance_days: 3,
          max_distance_km: 150,
          min_confidence: 50,
          enable_geospatial: true,
          enable_text_matching: true,
          enable_lookup_boost: true
        });

      if (corrError) {
        console.error('❌ Error running correlation:', corrError.message);
        console.log('   💡 This might mean the function needs to be created or there are permission issues');
      } else {
        console.log(`   ✅ Correlation function working! Found ${correlations.length} potential matches`);
        if (correlations.length > 0) {
          const bestMatch = correlations[0];
          console.log(`   🎯 Best match: ${bestMatch.customer_name} at ${bestMatch.terminal_name} (${bestMatch.overall_confidence}% confidence)`);
          console.log(`      - Text confidence: ${bestMatch.text_confidence}%`);
          console.log(`      - Geo confidence: ${bestMatch.geo_confidence}%`);
          console.log(`      - Temporal confidence: ${bestMatch.temporal_confidence}%`);
          console.log(`      - Match quality: ${bestMatch.match_quality}`);
        }
      }
    }

    // 5. Check correlation analytics summary
    console.log('\n5. Checking correlation analytics...');
    const { data: analytics, error: analyticsError } = await supabase
      .from('correlation_analytics_summary')
      .select('*')
      .limit(5);

    if (analyticsError) {
      console.log('   ⚠️  Analytics view not available yet (this is normal for new systems)');
    } else {
      console.log(`   📈 Found ${analytics.length} analytics records`);
      analytics.forEach(record => {
        console.log(`      - ${record.month}: ${record.total_correlations} correlations, avg confidence: ${record.avg_confidence_score}%`);
      });
    }

    // 6. Test batch analysis if available
    console.log('\n6. Testing batch correlation analysis...');
    const { data: batchResult, error: batchError } = await supabase
      .rpc('run_batch_correlation_analysis', {
        p_start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days ago
        p_end_date: new Date().toISOString().split('T')[0], // today
        p_fleet_filter: null,
        p_min_confidence: 60,
        p_max_trips: 10,
        p_clear_existing: false
      });

    if (batchError) {
      console.log('   ⚠️  Batch analysis function not available yet (this is normal for new systems)');
      console.log(`      Error: ${batchError.message}`);
    } else {
      console.log('   ✅ Batch analysis working!');
      console.log(`      - Processed ${batchResult.trips_processed} trips`);
      console.log(`      - Created ${batchResult.correlations_created} correlations`);
      console.log(`      - High confidence matches: ${batchResult.high_confidence_matches}`);
      console.log(`      - Manual review needed: ${batchResult.manual_review_needed}`);
      console.log(`      - Average confidence: ${batchResult.avg_confidence}%`);
    }

    console.log('\n✅ Trip correlation system test completed!');
    
    // Summary recommendations
    if (correlationCount.length === 0) {
      console.log('\n💡 Recommendations:');
      console.log('   - Run batch correlation analysis to populate initial correlations');
      console.log('   - Verify that the hybrid_correlate_trip_with_deliveries function exists');
      console.log('   - Check RLS policies on the correlation tables');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
testTripCorrelation()
  .then(() => {
    console.log('\n🏁 Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
