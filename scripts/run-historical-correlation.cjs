#!/usr/bin/env node

/**
 * Run Historical Correlation Analysis
 * Runs correlation analysis on the overlapping period (May 31 to June 30, 2025)
 * where both MTdata trips and captive deliveries exist
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runHistoricalCorrelation() {
  console.log('🚀 Running Historical Correlation Analysis...\n');
  console.log('📅 Analyzing period: May 31, 2025 to June 30, 2025\n');

  try {
    // Step 1: Check data availability for the overlapping period
    console.log('1. Checking data availability for overlapping period...');
    
    const startDate = '2025-05-31';
    const endDate = '2025-06-30';
    
    const { data: trips, error: tripsError } = await supabase
      .from('mtdata_trip_history')
      .select('id, trip_external_id, start_location, end_location, trip_date_computed, group_name')
      .not('start_location', 'is', null)
      .gte('trip_date_computed', startDate)
      .lte('trip_date_computed', endDate);

    if (tripsError) {
      console.error('❌ Error checking trips:', tripsError.message);
      return;
    }

    console.log(`   🚛 Found ${trips.length} trips with location data in ${startDate} to ${endDate}`);

    const { data: deliveries, error: delError } = await supabase
      .from('captive_deliveries')
      .select('delivery_key, customer, terminal, delivery_date, carrier')
      .gte('delivery_date', startDate)
      .lte('delivery_date', endDate);

    if (delError) {
      console.error('❌ Error checking deliveries:', delError.message);
      return;
    }

    console.log(`   📦 Found ${deliveries.length} captive deliveries in ${startDate} to ${endDate}`);

    if (trips.length === 0 || deliveries.length === 0) {
      console.log('\n❌ Not enough data in overlapping period');
      return;
    }

    // Step 2: Show sample data for verification
    console.log('\n2. Sample data verification:');
    
    if (trips.length > 0) {
      console.log('   🚛 Sample trips:');
      trips.slice(0, 3).forEach(trip => {
        console.log(`      - ${trip.trip_external_id}: ${trip.start_location} → ${trip.end_location} (${trip.trip_date_computed})`);
      });
    }

    if (deliveries.length > 0) {
      console.log('   📦 Sample deliveries:');
      deliveries.slice(0, 3).forEach(delivery => {
        console.log(`      - ${delivery.delivery_key}: ${delivery.customer} at ${delivery.terminal} (${delivery.delivery_date})`);
      });
    }

    // Step 3: Try to run batch correlation analysis
    console.log('\n3. Running batch correlation analysis...');
    
    try {
      const { data: batchResult, error: batchError } = await supabase
        .rpc('run_batch_correlation_analysis', {
          p_start_date: startDate,
          p_end_date: endDate,
          p_fleet_filter: null,
          p_min_confidence: 50,
          p_max_trips: 200,
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

    // Step 4: Try manual correlation for sample trips
    console.log('\n4. Trying manual correlation for sample trips...');
    
    let manualCorrelations = 0;
    const sampleTrips = trips.slice(0, 10); // Test with first 10 trips
    
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
      .select('id, confidence_score, customer_name, terminal_name, trip_date', { count: 'exact' });

    if (finalError) {
      console.log('   ❌ Error checking final status:', finalError.message);
    } else {
      console.log(`   📊 Total correlations: ${finalCorrelations.length}`);
      
      if (finalCorrelations.length > 0) {
        console.log('\n   🎯 Sample correlations:');
        finalCorrelations.slice(0, 5).forEach(corr => {
          console.log(`      - ${corr.customer_name} at ${corr.terminal_name} (${corr.confidence_score}% confidence) - ${corr.trip_date}`);
        });
        
        // Show confidence distribution
        const highConf = finalCorrelations.filter(c => c.confidence_score >= 80).length;
        const mediumConf = finalCorrelations.filter(c => c.confidence_score >= 60 && c.confidence_score < 80).length;
        const lowConf = finalCorrelations.filter(c => c.confidence_score < 60).length;
        
        console.log('\n   📊 Confidence distribution:');
        console.log(`      - High (80%+): ${highConf}`);
        console.log(`      - Medium (60-79%): ${mediumConf}`);
        console.log(`      - Low (<60%): ${lowConf}`);
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
      console.log('      - There are no matching trips and deliveries in the date range');
      console.log('      - The confidence threshold is too high');
      console.log('      - Location data quality needs improvement');
    }

    console.log('\n💡 Next Steps:');
    console.log('   1. Check if correlation functions exist');
    console.log('   2. Verify location data quality in both datasets');
    console.log('   3. Adjust confidence thresholds if needed');
    console.log('   4. Import more recent captive payment data');
    console.log('   5. Set up automated correlation processing');

  } catch (error) {
    console.error('❌ Historical correlation analysis failed:', error);
  }
}

runHistoricalCorrelation()
  .then(() => {
    console.log('\n🏁 Analysis completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Analysis failed:', error);
    process.exit(1);
  });
