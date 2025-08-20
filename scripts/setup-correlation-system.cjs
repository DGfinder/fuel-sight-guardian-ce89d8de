#!/usr/bin/env node

/**
 * Setup Trip Correlation System
 * Helps you set up the complete correlation system step by step
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupCorrelationSystem() {
  console.log('🚀 Setting up Trip Correlation System...\n');

  try {
    // Step 1: Check if required tables exist
    console.log('1. Checking required tables...');
    
    const requiredTables = ['mtdata_trip_history', 'captive_payment_records', 'captive_deliveries'];
    const tableStatus = {};
    
    for (const tableName of requiredTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('id')
          .limit(1);
        
        if (error) {
          tableStatus[tableName] = { exists: false, error: error.message };
        } else {
          tableStatus[tableName] = { exists: true, recordCount: data?.length || 0 };
        }
      } catch (err) {
        tableStatus[tableName] = { exists: false, error: err.message };
      }
    }
    
    // Display table status
    Object.entries(tableStatus).forEach(([tableName, status]) => {
      if (status.exists) {
        console.log(`   ✅ ${tableName}: exists`);
      } else {
        console.log(`   ❌ ${tableName}: missing - ${status.error}`);
      }
    });
    
    // Check if all required tables exist
    const allTablesExist = Object.values(tableStatus).every(status => status.exists);
    if (!allTablesExist) {
      console.log('\n❌ Some required tables are missing. Please run the following migrations first:');
      if (!tableStatus['mtdata_trip_history'].exists) {
        console.log('   - create_mtdata_trip_history_system.sql');
      }
      if (!tableStatus['captive_payment_records'].exists) {
        console.log('   - create_captive_payments_system.sql');
      }
      return;
    }
    
    console.log('\n✅ All required tables exist!');

    // Step 2: Check if correlation system already exists
    console.log('\n2. Checking correlation system status...');
    
    const { data: correlationTable, error: corrError } = await supabase
      .from('mtdata_captive_correlations')
      .select('id')
      .limit(1);
    
    if (corrError && corrError.code === '42P01') {
      console.log('   ❌ Correlation table does not exist');
      console.log('   💡 Need to run: create_mtdata_captive_correlations.sql');
    } else if (corrError) {
      console.log('   ⚠️  Error checking correlation table:', corrError.message);
    } else {
      console.log('   ✅ Correlation table exists');
    }
    
    // Step 3: Check if correlation functions exist
    console.log('\n3. Checking correlation functions...');
    
    try {
      const { data: functions, error: funcError } = await supabase
        .rpc('hybrid_correlate_trip_with_deliveries', {
          trip_id_input: '00000000-0000-0000-0000-000000000000', // dummy UUID
          date_tolerance_days: 3,
          max_distance_km: 150,
          min_confidence: 50,
          enable_geospatial: true,
          enable_text_matching: true,
          enable_lookup_boost: true
        });
      
      if (funcError && funcError.code === '42883') {
        console.log('   ❌ Correlation function does not exist');
        console.log('   💡 Need to run: hybrid_correlation_engine.sql');
      } else if (funcError) {
        console.log('   ✅ Correlation function exists (but returned error as expected with dummy data)');
      } else {
        console.log('   ✅ Correlation function exists and working');
      }
    } catch (err) {
      console.log('   ❌ Correlation function not available');
      console.log('   💡 Need to run: hybrid_correlation_engine.sql');
    }
    
    // Step 4: Show data availability
    console.log('\n4. Checking data availability...');
    
    try {
      const { data: trips, error: tripsError } = await supabase
        .from('mtdata_trip_history')
        .select('id, start_location, end_location')
        .not('start_location', 'is', null)
        .limit(5);
      
      if (tripsError) {
        console.log('   ❌ Error checking trips:', tripsError.message);
      } else {
        console.log(`   📊 Found ${trips.length} trips with location data`);
      }
    } catch (err) {
      console.log('   ❌ Error checking trips:', err.message);
    }
    
    try {
      const { data: deliveries, error: delError } = await supabase
        .from('captive_deliveries')
        .select('delivery_key, customer, terminal')
        .limit(5);
      
      if (delError) {
        console.log('   ❌ Error checking deliveries:', delError.message);
      } else {
        console.log(`   📦 Found ${deliveries.length} captive deliveries`);
      }
    } catch (err) {
      console.log('   ❌ Error checking deliveries:', err.message);
    }
    
    // Step 5: Provide setup instructions
    console.log('\n📋 Setup Instructions:');
    console.log('   If the correlation system is not set up, run these files in order:');
    console.log('   1. create_mtdata_captive_correlations.sql');
    console.log('   2. hybrid_correlation_engine.sql');
    console.log('   3. upgrade_correlation_system_hybrid.sql');
    
    console.log('\n💡 Quick Setup:');
    console.log('   You can copy the SQL content from each file and run it directly in your database,');
    console.log('   or use a migration tool to execute them in sequence.');
    
    // Step 6: Test correlation if available
    if (correlationTable && !corrError) {
      console.log('\n5. Testing correlation system...');
      
      try {
        const { data: testCorrelations, error: testError } = await supabase
          .from('mtdata_captive_correlations')
          .select('*')
          .limit(5);
        
        if (testError) {
          console.log('   ❌ Error testing correlations:', testError.message);
        } else {
          console.log(`   ✅ Correlation system working! Found ${testCorrelations.length} correlations`);
          console.log('   🎯 You can now run correlation analysis and view results.');
        }
      } catch (err) {
        console.log('   ❌ Error testing correlations:', err.message);
      }
    }
    
    console.log('\n✅ Setup check completed!');
    
  } catch (error) {
    console.error('❌ Setup check failed:', error);
  }
}

setupCorrelationSystem()
  .then(() => {
    console.log('\n🏁 Setup check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Setup check failed:', error);
    process.exit(1);
  });
