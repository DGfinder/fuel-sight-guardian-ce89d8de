#!/usr/bin/env node

// Execute API fixes to resolve current database issues
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_ANON_KEY;

console.log('🚀 Executing API Fixes for Current Database Issues');
console.log(`🔗 URL: ${SUPABASE_URL}`);
console.log(`🔑 Service Key Length: ${SUPABASE_SERVICE_KEY?.length} chars`);

// Create Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testConnection() {
  console.log('\n📡 Testing connection...');
  
  try {
    const { data, error } = await supabase
      .from('fuel_tanks')
      .select('id, location')
      .limit(1);
      
    if (error) {
      console.error('❌ Connection failed:', error.message);
      return false;
    }
    
    console.log('✅ Connection successful!');
    return true;
  } catch (err) {
    console.error('❌ Connection error:', err.message);
    return false;
  }
}

async function checkCurrentAlertTableIssues() {
  console.log('\n🔍 Checking current alert table issues...');
  
  // Check tank_alerts for missing alert_type column
  try {
    const { data, error } = await supabase
      .from('tank_alerts')
      .select('id, tank_id, alert_type')
      .limit(1);
      
    if (error) {
      if (error.message.includes('alert_type') && error.message.includes('does not exist')) {
        console.log('❌ tank_alerts missing alert_type column - NEEDS FIX');
        return { tankAlertsNeedsFix: true, agbotAlertsExists: false };
      } else {
        console.log('❌ tank_alerts query failed:', error.message);
        return { tankAlertsNeedsFix: true, agbotAlertsExists: false };
      }
    } else {
      console.log('✅ tank_alerts has alert_type column');
    }
  } catch (err) {
    console.log('❌ tank_alerts check failed:', err.message);
  }
  
  // Check agbot_alerts table exists
  try {
    const { data, error } = await supabase
      .from('agbot_alerts')
      .select('id')
      .limit(1);
      
    if (error) {
      if (error.message.includes('relation "agbot_alerts" does not exist')) {
        console.log('❌ agbot_alerts table missing - NEEDS CREATION');
        return { tankAlertsNeedsFix: false, agbotAlertsExists: false };
      } else if (error.code === '42501') {
        console.log('⚠️ agbot_alerts exists but has permission issues - NEEDS RLS FIX');
        return { tankAlertsNeedsFix: false, agbotAlertsExists: true, needsRLSFix: true };
      } else {
        console.log('❌ agbot_alerts query failed:', error.message);
        return { tankAlertsNeedsFix: false, agbotAlertsExists: false };
      }
    } else {
      console.log('✅ agbot_alerts table exists and accessible');
      return { tankAlertsNeedsFix: false, agbotAlertsExists: true };
    }
  } catch (err) {
    console.log('❌ agbot_alerts check failed:', err.message);
    return { tankAlertsNeedsFix: false, agbotAlertsExists: false };
  }
}

async function executeAPIMigration() {
  console.log('\n📜 Executing API fixes migration...');
  
  try {
    // Read the migration SQL file
    const sqlFile = join(__dirname, 'database/fixes/fix_current_api_issues.sql');
    const sqlContent = readFileSync(sqlFile, 'utf8');
    
    console.log(`📝 Migration SQL loaded: ${sqlContent.length} characters`);
    
    // Split the SQL into statements and execute them
    const statements = sqlContent
      .split('-- ============================================================================')
      .filter(stmt => stmt.trim().length > 0 && !stmt.startsWith('--'));
    
    console.log(`🔧 Executing ${statements.length} migration sections...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement.length === 0) continue;
      
      try {
        console.log(`\n📋 Executing section ${i + 1}...`);
        
        // Use rpc to execute raw SQL if available, otherwise try direct queries
        const { data, error } = await supabase.rpc('sql', {
          query: statement
        });
        
        if (error) {
          console.log(`⚠️ RPC not available, trying alternative approach...`);
          // If RPC fails, we'll need to handle this manually
          console.log(`💡 Please run this SQL manually in Supabase dashboard:`);
          console.log(`\n${statement}\n`);
        } else {
          console.log(`✅ Section ${i + 1} executed successfully`);
        }
      } catch (err) {
        console.log(`⚠️ Section ${i + 1} execution note:`, err.message);
      }
    }
    
    return true;
  } catch (err) {
    console.error('❌ Migration execution error:', err.message);
    return false;
  }
}

async function verifyFixes() {
  console.log('\n🧪 Verifying fixes...');
  
  // Test tank_alerts with alert_type
  try {
    const { data, error } = await supabase
      .from('tank_alerts')
      .select('id, tank_id, alert_type, message')
      .limit(3);
      
    if (error) {
      console.log('❌ tank_alerts still has issues:', error.message);
    } else {
      console.log('✅ tank_alerts working with alert_type column');
      if (data.length > 0) {
        console.log(`📊 Sample alerts:`, data.map(a => `${a.alert_type}: ${a.message?.substring(0, 50)}...`));
      }
    }
  } catch (err) {
    console.log('❌ tank_alerts verification failed:', err.message);
  }
  
  // Test agbot_alerts access
  try {
    const { data, error } = await supabase
      .from('agbot_alerts')
      .select('id, agbot_asset_id, alert_type, message')
      .limit(3);
      
    if (error) {
      console.log('❌ agbot_alerts still has issues:', error.message);
    } else {
      console.log('✅ agbot_alerts working properly');
      console.log(`📊 Agbot alerts count: ${data.length}`);
    }
  } catch (err) {
    console.log('❌ agbot_alerts verification failed:', err.message);
  }
}

async function main() {
  console.log('🔧 API Issues Fix Started\n');
  
  // Step 1: Test connection
  const connected = await testConnection();
  if (!connected) {
    console.log('❌ Cannot proceed without database connection');
    process.exit(1);
  }
  
  // Step 2: Check current issues
  const issues = await checkCurrentAlertTableIssues();
  console.log('\n📋 Issues detected:', issues);
  
  // Step 3: Execute migration
  const migrationSuccess = await executeAPIMigration();
  
  // Step 4: Verify fixes
  await verifyFixes();
  
  console.log('\n✅ API Issues Fix completed!');
  console.log('\n📋 Summary:');
  console.log('  - Database connection: ✅ Working');
  console.log('  - Migration execution: ' + (migrationSuccess ? '✅ Attempted' : '❌ Failed'));
  console.log('  - tank_alerts.alert_type: Should be fixed');
  console.log('  - agbot_alerts table: Should be created');
  
  console.log('\n💡 Next steps:');
  console.log('  1. If RPC execution failed, run the SQL manually in Supabase dashboard');
  console.log('  2. Test the frontend to verify errors are resolved');
  console.log('  3. Check console for "No tanks returned" and alert_type errors');
}

main().catch(console.error);