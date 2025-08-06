#!/usr/bin/env node

// Check current database state to diagnose API issues
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_ANON_KEY;

console.log('🔍 Checking Current Database State');
console.log(`🔗 URL: ${SUPABASE_URL}`);
console.log(`🔑 Service Key Length: ${SUPABASE_SERVICE_KEY?.length} chars`);

// Create Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkTableStructure(tableName) {
  console.log(`\n📋 Checking ${tableName} table structure...`);
  
  try {
    // Use rpc to execute raw SQL for schema checking
    const { data, error } = await supabase.rpc('sql', {
      query: `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = '${tableName}' 
        AND table_schema = 'public'
        ORDER BY ordinal_position;
      `
    });
    
    if (error) {
      console.error(`❌ Error checking ${tableName} schema:`, error.message);
      // Try alternative approach - just try to select from table
      try {
        const { data: sampleData, error: selectError } = await supabase
          .from(tableName)
          .select('*')
          .limit(0);
        
        if (selectError) {
          console.log(`❌ Table ${tableName} does not exist or is not accessible`);
          return false;
        } else {
          console.log(`✅ Table ${tableName} exists (structure details unavailable)`);
          return true;
        }
      } catch (err) {
        console.log(`❌ Table ${tableName} does not exist`);
        return false;
      }
    }
    
    if (!data || data.length === 0) {
      console.log(`❌ Table ${tableName} does not exist`);
      return false;
    }
    
    console.log(`✅ Table ${tableName} exists with ${data.length} columns:`);
    data.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    return data;
  } catch (err) {
    console.error(`❌ Exception checking ${tableName}:`, err.message);
    // Try basic table access as fallback
    try {
      const { data: sampleData, error: selectError } = await supabase
        .from(tableName)
        .select('*')
        .limit(0);
      
      if (selectError) {
        console.log(`❌ Table ${tableName} does not exist or is not accessible`);
        return false;
      } else {
        console.log(`✅ Table ${tableName} exists (structure details unavailable)`);
        return true;
      }
    } catch (err) {
      console.log(`❌ Table ${tableName} does not exist`);
      return false;
    }
  }
}

async function testTableAccess(tableName) {
  console.log(`\n🧪 Testing ${tableName} access...`);
  
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (error) {
      console.error(`❌ Error accessing ${tableName}:`, error.message);
      console.error(`   Code: ${error.code}, Details: ${error.details}`);
      return false;
    }
    
    console.log(`✅ ${tableName} accessible, sample count: ${data.length}`);
    return true;
  } catch (err) {
    console.error(`❌ Exception accessing ${tableName}:`, err.message);
    return false;
  }
}

async function checkRLSStatus(tableName) {
  console.log(`\n🔒 Checking RLS status for ${tableName}...`);
  
  try {
    // Use rpc to check RLS status
    const { data, error } = await supabase.rpc('sql', {
      query: `
        SELECT schemaname, tablename, rowsecurity
        FROM pg_tables 
        WHERE tablename = '${tableName}' AND schemaname = 'public';
      `
    });
    
    if (error) {
      console.error(`❌ Error checking RLS for ${tableName}:`, error.message);
      return false;
    }
    
    if (!data || data.length === 0) {
      console.log(`❌ Table ${tableName} not found in pg_tables`);
      return false;
    }
    
    const table = data[0];
    console.log(`RLS Status: ${table.rowsecurity ? '🔒 Enabled' : '🔓 Disabled'}`);
    return table.rowsecurity;
  } catch (err) {
    console.error(`❌ Exception checking RLS for ${tableName}:`, err.message);
    console.log(`⚠️ RLS status check unavailable, trying basic access test`);
    return null;
  }
}

async function checkTankDataQuery() {
  console.log(`\n🛢️  Testing tank data query (tanks_with_rolling_avg view)...`);
  
  try {
    const { data, error } = await supabase
      .from('tanks_with_rolling_avg')
      .select('id, location, current_level_percent, safe_level')
      .limit(5);
    
    if (error) {
      console.error(`❌ Error querying tanks view:`, error.message);
      console.error(`   Code: ${error.code}, Details: ${error.details}`);
      return false;
    }
    
    console.log(`✅ Tank data accessible, found ${data.length} tanks`);
    if (data.length > 0) {
      console.log(`Sample tanks:`);
      data.forEach(tank => {
        console.log(`  - ${tank.location}: ${tank.current_level_percent}% (${tank.safe_level}L)`);
      });
    }
    return true;
  } catch (err) {
    console.error(`❌ Exception querying tank data:`, err.message);
    return false;
  }
}

async function checkAtharaAPIConfig() {
  console.log(`\n🌐 Checking Athara API configuration...`);
  
  // Check environment variables
  const atharaKey = process.env.VITE_ATHARA_API_KEY;
  const atharaUrl = process.env.VITE_ATHARA_BASE_URL;
  
  console.log(`API Key: ${atharaKey ? `${atharaKey.substring(0, 10)}...` : 'Not set'}`);
  console.log(`API URL: ${atharaUrl || 'Using default (https://api.athara.com)'}`);
  
  // Test basic connectivity (this will likely fail with cert error)
  try {
    const response = await fetch('https://api.athara.com/locations', {
      method: 'HEAD',  // Just check if endpoint responds
      headers: {
        'Authorization': `Bearer ${atharaKey || 'test'}`,
      }
    });
    
    console.log(`✅ Athara API responded with status: ${response.status}`);
    return true;
  } catch (err) {
    console.error(`❌ Athara API error:`, err.message);
    if (err.message.includes('ERR_CERT_COMMON_NAME_INVALID')) {
      console.log(`💡 SSL Certificate issue detected - API endpoint may be incorrect`);
    }
    return false;
  }
}

async function main() {
  console.log('🚀 Database State Diagnosis Started\n');
  
  // Check tank_alerts table
  console.log('=' .repeat(60));
  console.log('TANK ALERTS TABLE ANALYSIS');
  console.log('=' .repeat(60));
  
  const tankAlertsSchema = await checkTableStructure('tank_alerts');
  await testTableAccess('tank_alerts');
  await checkRLSStatus('tank_alerts');
  
  // Check for missing columns
  if (tankAlertsSchema) {
    const columnNames = tankAlertsSchema.map(col => col.column_name);
    const requiredColumns = ['alert_type', 'priority', 'message', 'tank_id'];
    const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
    
    if (missingColumns.length > 0) {
      console.log(`❌ Missing columns in tank_alerts: ${missingColumns.join(', ')}`);
    } else {
      console.log(`✅ All required columns present in tank_alerts`);
    }
  }
  
  // Check agbot_alerts table
  console.log('\n' + '=' .repeat(60));
  console.log('AGBOT ALERTS TABLE ANALYSIS');
  console.log('=' .repeat(60));
  
  const agbotAlertsSchema = await checkTableStructure('agbot_alerts');
  await testTableAccess('agbot_alerts');
  await checkRLSStatus('agbot_alerts');
  
  // Check tank data access
  console.log('\n' + '=' .repeat(60));
  console.log('TANK DATA QUERY ANALYSIS');
  console.log('=' .repeat(60));
  
  await checkTankDataQuery();
  
  // Check Athara API
  console.log('\n' + '=' .repeat(60));
  console.log('ATHARA API ANALYSIS'); 
  console.log('=' .repeat(60));
  
  await checkAtharaAPIConfig();
  
  console.log('\n✅ Database state diagnosis completed!');
  console.log('\n📋 Next Steps:');
  console.log('1. Review the missing columns and access issues above');
  console.log('2. Apply the necessary database fixes');
  console.log('3. Test the application after fixes are applied');
}

main().catch(console.error);