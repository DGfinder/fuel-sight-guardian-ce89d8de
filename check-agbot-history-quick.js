#!/usr/bin/env node

// Quick check of agbot_readings_history table
import { createClient } from '@supabase/supabase-js';

// Using hardcoded credentials from other scripts for quick check
const supabaseUrl = 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqenNkc3ZidGFwcmlpdXh6bWloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTE4MDU1MiwiZXhwIjoyMDY0NzU2NTUyfQ.c6HZBGuXBz-RHXwFasOmJ8A_e0oRkt6vy-hNFDidCKo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAgbotHistory() {
  console.log('🔍 Checking Agbot Historical Data Status');
  console.log('='.repeat(50));
  
  try {
    // 1. Check if table exists and get basic count
    console.log('\n1️⃣ Table Existence and Record Count:');
    const { data: countData, error: countError } = await supabase
      .from('agbot_readings_history')
      .select('id', { count: 'exact', head: true });
      
    if (countError) {
      console.error('❌ Error accessing agbot_readings_history:', countError.message);
      return;
    }
    
    const totalRecords = countData?.length || 0;
    console.log(`✅ Table exists and accessible`);
    console.log(`📊 Total historical records: ${totalRecords.toLocaleString()}`);
    
    if (totalRecords === 0) {
      console.log('\n🚨 NO HISTORICAL DATA FOUND!');
      console.log('The agbot_readings_history table exists but contains no records.');
    }
    
    // 2. Get date range of data
    console.log('\n2️⃣ Date Range Analysis:');
    const { data: dateRangeData, error: dateError } = await supabase
      .from('agbot_readings_history')
      .select('reading_timestamp')
      .order('reading_timestamp', { ascending: true })
      .limit(1);
      
    const { data: latestData, error: latestError } = await supabase
      .from('agbot_readings_history')
      .select('reading_timestamp')
      .order('reading_timestamp', { ascending: false })
      .limit(1);
      
    if (!dateError && !latestError && dateRangeData?.length && latestData?.length) {
      const earliest = new Date(dateRangeData[0].reading_timestamp);
      const latest = new Date(latestData[0].reading_timestamp);
      const now = new Date();
      const ageHours = (now - latest) / (1000 * 60 * 60);
      
      console.log(`📅 Date range: ${earliest.toISOString().split('T')[0]} to ${latest.toISOString().split('T')[0]}`);
      console.log(`🕐 Most recent reading: ${latest.toISOString()}`);
      console.log(`⏰ Data age: ${ageHours.toFixed(1)} hours ago`);
      
      if (ageHours > 24) {
        console.log('⚠️  Data is more than 24 hours old');
      } else {
        console.log('✅ Data is recent');
      }
    }
    
    // 3. Check unique assets with data
    console.log('\n3️⃣ Asset Coverage:');
    const { data: assetData, error: assetError } = await supabase
      .from('agbot_readings_history')
      .select('asset_id', { count: 'exact' })
      .not('asset_id', 'is', null);
      
    if (!assetError) {
      const uniqueAssets = new Set();
      const { data: allAssets } = await supabase
        .from('agbot_readings_history')
        .select('asset_id')
        .not('asset_id', 'is', null);
        
      if (allAssets) {
        allAssets.forEach(record => uniqueAssets.add(record.asset_id));
      }
      
      console.log(`🛠️  Unique assets with readings: ${uniqueAssets.size}`);
    }
    
    // 4. Sample recent readings
    console.log('\n4️⃣ Sample Recent Readings:');
    const { data: sampleData, error: sampleError } = await supabase
      .from('agbot_readings_history')
      .select('*')
      .order('reading_timestamp', { ascending: false })
      .limit(3);
      
    if (!sampleError && sampleData?.length) {
      sampleData.forEach((reading, i) => {
        console.log(`\n   Reading ${i + 1}:`);
        console.log(`     Time: ${reading.reading_timestamp}`);
        console.log(`     Asset ID: ${reading.asset_id}`);
        console.log(`     Calibrated: ${reading.calibrated_fill_percentage}%`);
        console.log(`     Raw: ${reading.raw_fill_percentage}%`);
        console.log(`     Device Online: ${reading.device_online}`);
      });
    }
    
    // 5. Check related tables
    console.log('\n5️⃣ Related Tables Status:');
    
    const { data: locationCount, error: locError } = await supabase
      .from('agbot_locations')
      .select('id', { count: 'exact', head: true });
      
    const { data: assetCount, error: assetCountError } = await supabase
      .from('agbot_assets')
      .select('id', { count: 'exact', head: true });
      
    if (!locError) {
      console.log(`📍 agbot_locations: ${locationCount?.length || 0} records`);
    }
    if (!assetCountError) {
      console.log(`🔧 agbot_assets: ${assetCount?.length || 0} records`);
    }
    
    // 6. Check agbot sync logs to see if syncs have been running
    console.log('\n6️⃣ Sync Activity Check:');
    
    const { data: syncLogs, error: syncError } = await supabase
      .from('agbot_sync_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(5);
      
    if (!syncError && syncLogs?.length) {
      console.log(`📝 Recent sync logs found: ${syncLogs.length}`);
      syncLogs.forEach((log, i) => {
        console.log(`\n   Sync ${i + 1}:`);
        console.log(`     Type: ${log.sync_type}`);
        console.log(`     Status: ${log.sync_status}`);
        console.log(`     Started: ${log.started_at}`);
        console.log(`     Readings Processed: ${log.readings_processed || 0}`);
        if (log.error_message) {
          console.log(`     Error: ${log.error_message}`);
        }
      });
    } else {
      console.log('❌ No sync logs found or error accessing logs');
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Agbot Historical Data Check Complete');
    
    // Summary and diagnosis
    console.log('\n🔍 DIAGNOSIS:');
    if (totalRecords === 0) {
      console.log('❌ ISSUE: No historical readings are being stored');
      console.log('');
      console.log('Possible causes:');
      console.log('1. Webhook not receiving data from Gasbot');
      console.log('2. Sync processes not running or failing'); 
      console.log('3. Database insert errors in webhook/sync');
      console.log('4. Asset IDs not matching between assets and readings');
      console.log('');
      console.log('Next steps:');
      console.log('- Check webhook logs for incoming requests');
      console.log('- Test webhook endpoint manually');
      console.log('- Run sync process manually to see errors');
      console.log('- Check if agbot_assets table has data');
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error.message);
  }
}

checkAgbotHistory();