#!/usr/bin/env node

/**
 * Check Data Date Ranges
 * Shows the date ranges for both MTdata trips and captive deliveries
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDataDates() {
  console.log('📅 Checking Data Date Ranges...\n');

  try {
    // Check MTdata trips date range
    console.log('1. MTdata Trips Date Range:');
    const { data: tripDates, error: tripError } = await supabase
      .from('mtdata_trip_history')
      .select('trip_date_computed')
      .order('trip_date_computed', { ascending: false });

    if (tripError) {
      console.error('   ❌ Error:', tripError.message);
    } else if (tripDates && tripDates.length > 0) {
      const latestTrip = tripDates[0].trip_date_computed;
      const earliestTrip = tripDates[tripDates.length - 1].trip_date_computed;
      console.log(`   📊 Total trips: ${tripDates.length}`);
      console.log(`   🕐 Date range: ${earliestTrip} to ${latestTrip}`);
      console.log(`   📅 Latest trip: ${latestTrip}`);
      console.log(`   📅 Earliest trip: ${earliestTrip}`);
      
      // Check recent trips
      const recentTrips = tripDates.filter(t => 
        new Date(t.trip_date_computed) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      );
      console.log(`   🔍 Trips in last 30 days: ${recentTrips.length}`);
    } else {
      console.log('   ❌ No trips found');
    }

    // Check captive deliveries date range
    console.log('\n2. Captive Deliveries Date Range:');
    const { data: deliveryDates, error: delError } = await supabase
      .from('captive_deliveries')
      .select('delivery_date')
      .order('delivery_date', { ascending: false });

    if (delError) {
      console.error('   ❌ Error:', delError.message);
    } else if (deliveryDates && deliveryDates.length > 0) {
      const latestDelivery = deliveryDates[0].delivery_date;
      const earliestDelivery = deliveryDates[deliveryDates.length - 1].delivery_date;
      console.log(`   📊 Total deliveries: ${deliveryDates.length}`);
      console.log(`   🕐 Date range: ${earliestDelivery} to ${latestDelivery}`);
      console.log(`   📅 Latest delivery: ${latestDelivery}`);
      console.log(`   📅 Earliest delivery: ${earliestDelivery}`);
      
      // Check recent deliveries
      const recentDeliveries = deliveryDates.filter(d => 
        new Date(d.delivery_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      );
      console.log(`   🔍 Deliveries in last 30 days: ${recentDeliveries.length}`);
    } else {
      console.log('   ❌ No deliveries found');
    }

    // Check captive payment records date range
    console.log('\n3. Captive Payment Records Date Range:');
    const { data: paymentDates, error: payError } = await supabase
      .from('captive_payment_records')
      .select('delivery_date')
      .order('delivery_date', { ascending: false });

    if (payError) {
      console.error('   ❌ Error:', payError.message);
    } else if (paymentDates && paymentDates.length > 0) {
      const latestPayment = paymentDates[0].delivery_date;
      const earliestPayment = paymentDates[paymentDates.length - 1].delivery_date;
      console.log(`   📊 Total payment records: ${paymentDates.length}`);
      console.log(`   🕐 Date range: ${earliestPayment} to ${latestPayment}`);
      console.log(`   📅 Latest payment: ${latestPayment}`);
      console.log(`   📅 Earliest payment: ${earliestPayment}`);
      
      // Check recent payments
      const recentPayments = paymentDates.filter(p => 
        new Date(p.delivery_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      );
      console.log(`   🔍 Payments in last 30 days: ${recentPayments.length}`);
    } else {
      console.log('   ❌ No payment records found');
    }

    // Summary and recommendations
    console.log('\n📋 Summary:');
    console.log('   The correlation system needs both MTdata trips and captive deliveries');
    console.log('   to exist in overlapping date ranges to find matches.');
    
    console.log('\n💡 Recommendations:');
    console.log('   1. Check if your data import processes are working correctly');
    console.log('   2. Verify that captive payment CSV imports are running');
    console.log('   3. Consider expanding the date range for correlation analysis');
    console.log('   4. Run correlation analysis on historical data if recent data is sparse');

  } catch (error) {
    console.error('❌ Date check failed:', error);
  }
}

checkDataDates()
  .then(() => {
    console.log('\n🏁 Date check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Date check failed:', error);
    process.exit(1);
  });
