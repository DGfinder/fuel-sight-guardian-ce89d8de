#!/usr/bin/env node

// Agbot Readings History Table Diagnostic Script
// Comprehensive tool to examine the current state of agbot_readings_history table

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkTableExists() {
  console.log('\n📋 Checking if agbot_readings_history table exists...');
  
  try {
    // Try to select from the table with limit 0 to check existence
    const { data, error } = await supabase
      .from('agbot_readings_history')
      .select('*')
      .limit(0);
    
    if (error) {
      console.log('❌ Table does not exist or is not accessible:', error.message);
      return false;
    }
    
    console.log('✅ Table agbot_readings_history exists and is accessible');
    return true;
  } catch (err) {
    console.log('❌ Error checking table existence:', err.message);
    return false;
  }
}

async function getTableStructure() {
  console.log('\n🔍 Analyzing table structure...');
  
  try {
    // Use RPC to get column information
    const { data, error } = await supabase.rpc('sql', {
      query: `
        SELECT 
          column_name, 
          data_type, 
          is_nullable, 
          column_default,
          ordinal_position
        FROM information_schema.columns 
        WHERE table_name = 'agbot_readings_history' 
        AND table_schema = 'public'
        ORDER BY ordinal_position;
      `
    });
    
    if (error) {
      console.log('⚠️ Could not retrieve table structure details:', error.message);
      return null;
    }
    
    if (!data || data.length === 0) {
      console.log('❌ No columns found for agbot_readings_history table');
      return null;
    }
    
    console.log(`✅ Table structure (${data.length} columns):`);
    console.log('┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ Column Name                │ Data Type    │ Nullable │ Default  │');
    console.log('├─────────────────────────────────────────────────────────────────┤');
    data.forEach(col => {
      const colName = col.column_name.padEnd(26);
      const dataType = col.data_type.padEnd(12);
      const nullable = col.is_nullable.padEnd(8);
      const defaultVal = (col.column_default || 'null').substring(0, 8).padEnd(8);
      console.log(`│ ${colName} │ ${dataType} │ ${nullable} │ ${defaultVal} │`);
    });
    console.log('└─────────────────────────────────────────────────────────────────┘');
    
    return data;
  } catch (err) {
    console.log('❌ Error analyzing table structure:', err.message);
    return null;
  }
}

async function getRecordCount() {
  console.log('\n📊 Counting total records...');
  
  try {
    const { count, error } = await supabase
      .from('agbot_readings_history')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log('❌ Error counting records:', error.message);
      return 0;
    }
    
    console.log(`📈 Total records in agbot_readings_history: ${count?.toLocaleString() || 0}`);
    return count || 0;
  } catch (err) {
    console.log('❌ Error counting records:', err.message);
    return 0;
  }
}

async function getDateRange() {
  console.log('\n📅 Finding data date range...');
  
  try {
    const { data, error } = await supabase
      .from('agbot_readings_history')
      .select('reading_timestamp, created_at')
      .order('reading_timestamp', { ascending: true })
      .limit(1);
    
    if (error) {
      console.log('❌ Error getting earliest record:', error.message);
      return null;
    }
    
    if (!data || data.length === 0) {
      console.log('📝 No records found - table is empty');
      return null;
    }
    
    const earliest = data[0];
    
    const { data: latestData, error: latestError } = await supabase
      .from('agbot_readings_history')
      .select('reading_timestamp, created_at')
      .order('reading_timestamp', { ascending: false })
      .limit(1);
    
    if (latestError) {
      console.log('❌ Error getting latest record:', latestError.message);
      return null;
    }
    
    const latest = latestData[0];
    
    console.log('📅 Data date range:');
    console.log(`   ⏮️  Earliest reading: ${earliest.reading_timestamp} (created: ${earliest.created_at})`);
    console.log(`   ⏭️  Latest reading:   ${latest.reading_timestamp} (created: ${latest.created_at})`);
    
    // Calculate span
    const earlyDate = new Date(earliest.reading_timestamp);
    const lateDate = new Date(latest.reading_timestamp);
    const spanDays = Math.ceil((lateDate.getTime() - earlyDate.getTime()) / (1000 * 60 * 60 * 24));
    
    console.log(`   ⏱️  Time span: ${spanDays} days`);
    
    return {
      earliest: earliest.reading_timestamp,
      latest: latest.reading_timestamp,
      spanDays
    };
  } catch (err) {
    console.log('❌ Error analyzing date range:', err.message);
    return null;
  }
}

async function getMostRecentReadings() {
  console.log('\n🕐 Getting most recent readings...');
  
  try {
    const { data, error } = await supabase
      .from('agbot_readings_history')
      .select(`
        id,
        asset_id,
        calibrated_fill_percentage,
        raw_fill_percentage,
        reading_timestamp,
        device_online,
        created_at
      `)
      .order('reading_timestamp', { ascending: false })
      .limit(5);
    
    if (error) {
      console.log('❌ Error getting recent readings:', error.message);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('📝 No readings found');
      return;
    }
    
    console.log(`📋 Most recent ${data.length} readings:`);
    console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ Reading Time          │ Asset ID (8 chars) │ Fuel % │ Raw % │ Online │ Age    │');
    console.log('├────────────────────────────────────────────────────────────────────────────────┤');
    
    data.forEach(reading => {
      const readingTime = new Date(reading.reading_timestamp).toLocaleString().padEnd(20);
      const assetId = reading.asset_id.substring(0, 8).padEnd(18);
      const fuelPct = reading.calibrated_fill_percentage?.toFixed(1).padStart(6) || 'null  ';
      const rawPct = reading.raw_fill_percentage?.toFixed(1).padStart(5) || 'null ';
      const online = reading.device_online ? '✅ Yes' : '❌ No ';
      
      // Calculate age
      const ageMs = Date.now() - new Date(reading.reading_timestamp).getTime();
      const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
      const ageDays = Math.floor(ageHours / 24);
      const ageStr = ageDays > 0 ? `${ageDays}d ${ageHours % 24}h` : `${ageHours}h`;
      
      console.log(`│ ${readingTime} │ ${assetId} │ ${fuelPct} │ ${rawPct} │ ${online} │ ${ageStr.padEnd(6)} │`);
    });
    console.log('└────────────────────────────────────────────────────────────────────────────────┘');
    
  } catch (err) {
    console.log('❌ Error getting recent readings:', err.message);
  }
}

async function getAssetBreakdown() {
  console.log('\n🛠️ Analyzing data by assets...');
  
  try {
    const { data, error } = await supabase
      .from('agbot_readings_history')
      .select('asset_id')
      .order('asset_id');
    
    if (error) {
      console.log('❌ Error getting asset breakdown:', error.message);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('📝 No asset data found');
      return;
    }
    
    // Count readings per asset
    const assetCounts = {};
    data.forEach(reading => {
      assetCounts[reading.asset_id] = (assetCounts[reading.asset_id] || 0) + 1;
    });
    
    const assetEntries = Object.entries(assetCounts)
      .sort((a, b) => b[1] - a[1]) // Sort by count descending
      .slice(0, 10); // Top 10
    
    console.log(`📊 Readings per asset (showing top ${assetEntries.length} of ${Object.keys(assetCounts).length} total assets):`);
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│ Asset ID                             │ Reading Count      │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    
    assetEntries.forEach(([assetId, count]) => {
      const truncatedId = assetId.length > 36 ? assetId.substring(0, 33) + '...' : assetId;
      const paddedId = truncatedId.padEnd(36);
      const countStr = count.toString().padStart(18);
      console.log(`│ ${paddedId} │ ${countStr} │`);
    });
    console.log('└─────────────────────────────────────────────────────────────┘');
    
    console.log(`\n📈 Summary: ${Object.keys(assetCounts).length} unique assets with readings`);
    const totalReadings = Object.values(assetCounts).reduce((sum, count) => sum + count, 0);
    const avgReadingsPerAsset = (totalReadings / Object.keys(assetCounts).length).toFixed(1);
    console.log(`📊 Average readings per asset: ${avgReadingsPerAsset}`);
    
  } catch (err) {
    console.log('❌ Error analyzing asset breakdown:', err.message);
  }
}

async function checkDataQuality() {
  console.log('\n🔍 Checking data quality...');
  
  try {
    // Check for null values in critical fields
    const { data: nullChecks, error: nullError } = await supabase.rpc('sql', {
      query: `
        SELECT 
          COUNT(*) as total_records,
          COUNT(*) FILTER (WHERE asset_id IS NULL) as null_asset_id,
          COUNT(*) FILTER (WHERE calibrated_fill_percentage IS NULL) as null_calibrated_pct,
          COUNT(*) FILTER (WHERE reading_timestamp IS NULL) as null_reading_timestamp,
          COUNT(*) FILTER (WHERE calibrated_fill_percentage < 0) as negative_percentages,
          COUNT(*) FILTER (WHERE calibrated_fill_percentage > 100) as over_100_percentages,
          COUNT(*) FILTER (WHERE reading_timestamp > NOW()) as future_timestamps
        FROM agbot_readings_history;
      `
    });
    
    if (nullError) {
      console.log('⚠️ Could not perform data quality checks:', nullError.message);
      return;
    }
    
    if (!nullChecks || nullChecks.length === 0) {
      console.log('❌ No data quality results returned');
      return;
    }
    
    const stats = nullChecks[0];
    
    console.log('🔍 Data Quality Report:');
    console.log(`   📊 Total records: ${stats.total_records.toLocaleString()}`);
    console.log(`   🆔 Null asset_id: ${stats.null_asset_id} ${stats.null_asset_id > 0 ? '⚠️' : '✅'}`);
    console.log(`   ⛽ Null fuel percentage: ${stats.null_calibrated_pct} ${stats.null_calibrated_pct > 0 ? '⚠️' : '✅'}`);
    console.log(`   📅 Null timestamps: ${stats.null_reading_timestamp} ${stats.null_reading_timestamp > 0 ? '❌' : '✅'}`);
    console.log(`   📉 Negative percentages: ${stats.negative_percentages} ${stats.negative_percentages > 0 ? '⚠️' : '✅'}`);
    console.log(`   📈 Over 100% readings: ${stats.over_100_percentages} ${stats.over_100_percentages > 0 ? '⚠️' : '✅'}`);
    console.log(`   🔮 Future timestamps: ${stats.future_timestamps} ${stats.future_timestamps > 0 ? '❌' : '✅'}`);
    
    // Calculate data quality score
    const totalIssues = stats.null_asset_id + stats.null_calibrated_pct + stats.null_reading_timestamp + 
                        stats.negative_percentages + stats.over_100_percentages + stats.future_timestamps;
    const qualityScore = stats.total_records > 0 ? 
      ((stats.total_records - totalIssues) / stats.total_records * 100).toFixed(1) : 0;
    
    console.log(`\n📊 Data Quality Score: ${qualityScore}% ${qualityScore >= 95 ? '✅' : qualityScore >= 85 ? '⚠️' : '❌'}`);
    
  } catch (err) {
    console.log('❌ Error checking data quality:', err.message);
  }
}

async function checkRelatedTables() {
  console.log('\n🔗 Checking related agbot tables...');
  
  const tables = [
    { name: 'agbot_locations', description: 'Location data' },
    { name: 'agbot_assets', description: 'Asset/device data' },
    { name: 'agbot_sync_logs', description: 'Sync operation logs' }
  ];
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table.name)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`   ❌ ${table.name}: Not accessible (${error.message})`);
      } else {
        console.log(`   ✅ ${table.name}: ${count?.toLocaleString() || 0} records (${table.description})`);
      }
    } catch (err) {
      console.log(`   ❌ ${table.name}: Error checking (${err.message})`);
    }
  }
}

async function checkIndexes() {
  console.log('\n📇 Checking table indexes...');
  
  try {
    const { data, error } = await supabase.rpc('sql', {
      query: `
        SELECT 
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE tablename = 'agbot_readings_history' 
        AND schemaname = 'public'
        ORDER BY indexname;
      `
    });
    
    if (error) {
      console.log('⚠️ Could not retrieve index information:', error.message);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('❌ No indexes found for agbot_readings_history table');
      return;
    }
    
    console.log(`✅ Found ${data.length} indexes:`);
    data.forEach((index, i) => {
      console.log(`   ${i + 1}. ${index.indexname}`);
      console.log(`      ${index.indexdef}`);
    });
    
  } catch (err) {
    console.log('❌ Error checking indexes:', err.message);
  }
}

async function main() {
  console.log('🔍 AGBOT READINGS HISTORY TABLE DIAGNOSTIC');
  console.log('='.repeat(80));
  console.log(`📊 Examining agbot_readings_history table state`);
  console.log(`🕐 Started at: ${new Date().toLocaleString()}`);
  console.log(`🔗 Database: ${SUPABASE_URL}`);
  
  try {
    // 1. Check if table exists
    const tableExists = await checkTableExists();
    if (!tableExists) {
      console.log('\n❌ DIAGNOSIS COMPLETE: agbot_readings_history table does not exist');
      console.log('\n💡 Recommended actions:');
      console.log('   1. Run database migration: create_agbot_system.sql');
      console.log('   2. Verify database permissions');
      console.log('   3. Check Supabase connection settings');
      return;
    }
    
    // 2. Get table structure
    await getTableStructure();
    
    // 3. Count total records
    const recordCount = await getRecordCount();
    
    if (recordCount === 0) {
      console.log('\n📝 DIAGNOSIS COMPLETE: Table exists but contains no data');
      console.log('\n💡 Recommended actions:');
      console.log('   1. Import historical data from CSV or API sync');
      console.log('   2. Check agbot data sync scripts');
      console.log('   3. Verify webhook configuration if using real-time sync');
      
      // Still check related tables even if no readings
      await checkRelatedTables();
      await checkIndexes();
      return;
    }
    
    // 4. Analyze data range and content
    await getDateRange();
    await getMostRecentReadings();
    await getAssetBreakdown();
    await checkDataQuality();
    
    // 5. Check related system tables
    await checkRelatedTables();
    await checkIndexes();
    
    console.log('\n✅ DIAGNOSIS COMPLETE: agbot_readings_history table analysis finished');
    console.log('\n📊 Summary:');
    console.log(`   📈 Table exists and contains ${recordCount.toLocaleString()} historical readings`);
    console.log('   🔗 Related agbot system tables checked');
    console.log('   📇 Database indexes verified');
    console.log('   🔍 Data quality analysis completed');
    
    console.log('\n💡 Next steps:');
    console.log('   1. Review data quality issues if any were found');
    console.log('   2. Check agbot sync logs for recent sync operations');
    console.log('   3. Verify real-time data flow is working correctly');
    console.log('   4. Monitor recent readings for data freshness');
    
  } catch (error) {
    console.error('\n❌ DIAGNOSTIC FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the diagnostic
main().catch(console.error);