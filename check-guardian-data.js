import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.log('❌ VITE_SUPABASE_ANON_KEY not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGuardianEvents() {
  console.log('🔍 Checking guardian_events table...');
  
  try {
    // Check table existence and count
    const { count, error: countError } = await supabase
      .from('guardian_events')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.log('❌ Error checking guardian_events:', countError.message);
      return;
    }
    
    console.log(`📊 guardian_events table exists with ${count} records`);
    
    if (count > 0) {
      // Get sample records
      const { data: sample, error: sampleError } = await supabase
        .from('guardian_events')
        .select('*')
        .limit(3);
        
      if (sampleError) {
        console.log('❌ Error fetching sample:', sampleError.message);
      } else {
        console.log('📋 Sample records:');
        console.log(JSON.stringify(sample, null, 2));
      }
      
      // Get fleet breakdown
      const { data: allRecords, error: fleetError } = await supabase
        .from('guardian_events')
        .select('fleet');
      
      if (!fleetError && allRecords) {
        const fleets = {};
        allRecords.forEach(record => {
          fleets[record.fleet] = (fleets[record.fleet] || 0) + 1;
        });
        console.log('🏢 Fleet breakdown:', fleets);
      }
    } else {
      console.log('📝 Table is empty - need to import Guardian events data');
    }
    
  } catch (error) {
    console.log('❌ Unexpected error:', error.message);
  }
}

async function checkAgbotReadingsHistory() {
  console.log('\n🤖 Checking agbot_readings_history table...');
  
  try {
    // Check table existence and count
    const { count, error: countError } = await supabase
      .from('agbot_readings_history')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.log('❌ Error checking agbot_readings_history:', countError.message);
      return;
    }
    
    console.log(`📊 agbot_readings_history table exists with ${count?.toLocaleString() || 0} records`);
    
    if (count > 0) {
      // Get date range
      const { data: earliest, error: earlyError } = await supabase
        .from('agbot_readings_history')
        .select('reading_timestamp')
        .order('reading_timestamp', { ascending: true })
        .limit(1);
      
      const { data: latest, error: latestError } = await supabase
        .from('agbot_readings_history')
        .select('reading_timestamp')
        .order('reading_timestamp', { ascending: false })
        .limit(1);
        
      if (!earlyError && !latestError && earliest?.length && latest?.length) {
        console.log(`📅 Date range: ${earliest[0].reading_timestamp} to ${latest[0].reading_timestamp}`);
        
        // Calculate age of most recent reading
        const latestTime = new Date(latest[0].reading_timestamp);
        const ageHours = Math.floor((Date.now() - latestTime.getTime()) / (1000 * 60 * 60));
        console.log(`🕐 Most recent reading: ${ageHours} hours ago`);
      }
      
      // Get sample recent records
      const { data: sample, error: sampleError } = await supabase
        .from('agbot_readings_history')
        .select('asset_id, calibrated_fill_percentage, reading_timestamp, device_online')
        .order('reading_timestamp', { ascending: false })
        .limit(3);
        
      if (!sampleError && sample?.length) {
        console.log('📋 Recent readings sample:');
        sample.forEach((reading, i) => {
          const assetShort = reading.asset_id.substring(0, 8);
          console.log(`   ${i + 1}. Asset ${assetShort}: ${reading.calibrated_fill_percentage}% (${reading.device_online ? 'online' : 'offline'}) - ${reading.reading_timestamp}`);
        });
      }
      
      // Get asset count
      const { data: assets, error: assetError } = await supabase
        .from('agbot_readings_history')
        .select('asset_id')
        .order('asset_id');
      
      if (!assetError && assets?.length) {
        const uniqueAssets = [...new Set(assets.map(a => a.asset_id))];
        console.log(`🛠️ Data from ${uniqueAssets.length} unique assets`);
      }
      
    } else {
      console.log('📝 Table is empty - no agbot historical readings stored');
      console.log('💡 This could mean:');
      console.log('   - No agbot data sync has been performed yet');
      console.log('   - Agbot webhook is not configured');
      console.log('   - CSV import has not been run');
    }
    
  } catch (error) {
    console.log('❌ Unexpected error:', error.message);
  }
}

async function main() {
  console.log('🔍 DATA DIAGNOSTIC TOOL');
  console.log('='.repeat(50));
  
  await checkGuardianEvents();
  await checkAgbotReadingsHistory();
  
  console.log('\n✅ Diagnostic complete');
}

main().then(() => process.exit(0));