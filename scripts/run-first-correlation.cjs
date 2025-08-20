#!/usr/bin/env node

/**
 * Run First Correlation Analysis
 * Populates the correlation table with initial trip-delivery matches
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runFirstCorrelation() {
  console.log('🚀 Running First Correlation Analysis...\n');

  try {
    // Step 1: Check current status
    console.log('1. Checking current correlation status...');
    const { data: currentCorrelations, error: corrError } = await supabase
      .from('mtdata_captive_correlations')
      .select('id', { count: 'exact' });

    if (corrError) {
      console.error('❌ Error checking correlations:', corrError.message);
      return;
    }

    console.log(`   📊 Current correlations: ${currentCorrelations.length}`);

    // Step 2: Check data availability
    console.log('\n2. Checking data availability...');
    
    const { data: trips, error: tripsError } = await supabase
      .from('mtdata_trip_history')
      .select('id, trip_external_id, start_location, end_location, trip_date_computed')
      .not('start_location', 'is', null)
      .gte('trip_date_computed', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) // Last 30 days
      .limit(100);

    if (tripsError) {
      console.error('❌ Error checking trips:', tripsError.message);
      return;
    }

    console.log(`   🚛 Found ${trips.length} trips with location data in last 30 days`);

    const { data: deliveries, error: delError } = await supabase
      .from('captive_deliveries')
      .select('delivery_key, customer, terminal, delivery_date')
      .gte('delivery_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) // Last 30 days
      .limit(100);

    if (delError) {
      console.error('❌ Error checking deliveries:', delError.message);
      return;
    }

    console.log(`   📦 Found ${deliveries.length} captive deliveries in last 30 days`);

    if (trips.length === 0 || deliveries.length === 0) {
      console.log('\n❌ Not enough data to run correlation analysis');
      console.log('   💡 Make sure you have both MTdata trips and captive deliveries in the last 30 days');
      return;
    }

    // Step 3: Try to run batch correlation analysis
    console.log('\n3. Running batch correlation analysis...');
    
    try {
      const { data: batchResult, error: batchError } = await supabase
        .rpc('run_batch_correlation_analysis', {
          p_start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
          p_end_date: new Date().toISOString().split('T')[0], // today
          p_fleet_filter: null,
          p_min_confidence: 50,
          p_max_trips: 100,
          p_clear_existing: false
        });

      if (batchError) {
        console.log('   ⚠️  Batch analysis function not available yet');
        console.log(`      Error: ${batchError.message}`);
        console.log('   💡 Need to run the upgrade_correlation_system_hybrid.sql migration');
      } else {
        console.log('   ✅ Batch analysis successful!');
        console.log(`      - Processed ${batchResult.trips_processed} trips`);
        console.log(`      - Created ${batchResult.correlations_created} correlations`);
        console.log(`      - High confidence matches: ${batchResult.high_confidence_matches}`);
        console.log(`      - Manual review needed: ${batchResult.manual_review_needed}`);
        console.log(`      - Average confidence: ${batchResult.avg_confidence}%`);
      }
    } catch (functionError) {
      console.log('   ❌ Batch analysis function not available');
      console.log(`      Error: ${functionError.message}`);
      console.log('   💡 Need to run the upgrade_correlation_system_hybrid.sql migration');
    }

    // Step 4: Try manual correlation for a few trips
    console.log('\n4. Trying manual correlation for sample trips...');
    
    let manualCorrelations = 0;
    const sampleTrips = trips.slice(0, 5); // Test with first 5 trips
    
    for (const trip of sampleTrips) {
      try {
        const { data: correlations, error: corrError } = await supabase
          .rpc('hybrid_correlate_trip_with_deliveries', {
            trip_id_input: trip.id,
            date_tolerance_days: 3,
            max_distance_km: 150,
            min_confidence: 50,
            enable_geospatial: true,
            enable_text_matching: true,
            enable_lookup_boost: true
          });

        if (corrError) {
          console.log(`   ⚠️  Trip ${trip.trip_external_id}: ${corrError.message}`);
        } else if (correlations && correlations.length > 0) {
          console.log(`   ✅ Trip ${trip.trip_external_id}: Found ${correlations.length} potential matches`);
          manualCorrelations += correlations.length;
          
          // Show best match
          const bestMatch = correlations[0];
          console.log(`      🎯 Best: ${bestMatch.customer_name} at ${bestMatch.terminal_name} (${bestMatch.overall_confidence}% confidence)`);
        } else {
          console.log(`   ⚠️  Trip ${trip.trip_external_id}: No matches found`);
        }
      } catch (err) {
        console.log(`   ❌ Trip ${trip.trip_external_id}: Function not available`);
        break; // Stop if function doesn't exist
      }
    }

    // Step 5: Check final status
    console.log('\n5. Checking final correlation status...');
    
    const { data: finalCorrelations, error: finalError } = await supabase
      .from('mtdata_captive_correlations')
      .select('id, confidence_score, customer_name, terminal_name', { count: 'exact' });

    if (finalError) {
      console.log('   ❌ Error checking final status:', finalError.message);
    } else {
      console.log(`   📊 Total correlations: ${finalCorrelations.length}`);
      
      if (finalCorrelations.length > 0) {
        console.log('\n   🎯 Sample correlations:');
        finalCorrelations.slice(0, 3).forEach(corr => {
          console.log(`      - ${corr.customer_name} at ${corr.terminal_name} (${corr.confidence_score}% confidence)`);
        });
      }
    }

    // Step 6: Summary and next steps
    console.log('\n📋 Summary:');
    if (finalCorrelations.length > 0) {
      console.log('   ✅ Correlation system is working!');
      console.log('   🎯 You can now view correlations in your dashboard');
      console.log('   📊 Run the test-correlation-sql.sql script to see detailed results');
    } else {
      console.log('   ⚠️  No correlations created yet');
      console.log('   💡 This might mean:');
      console.log('      - The correlation functions need to be created');
      console.log('      - There are no matching trips and deliveries');
      console.log('      - The confidence threshold is too high');
    }

    console.log('\n💡 Next Steps:');
    console.log('   1. Check if correlation functions exist');
    console.log('   2. Verify data quality and location matching');
    console.log('   3. Adjust confidence thresholds if needed');
    console.log('   4. Run regular correlation analysis');

  } catch (error) {
    console.error('❌ Correlation analysis failed:', error);
  }
}

runFirstCorrelation()
  .then(() => {
    console.log('\n🏁 Analysis completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Analysis failed:', error);
    process.exit(1);
  });
