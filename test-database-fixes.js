#!/usr/bin/env node

// Test script to execute database fixes using our environment setup
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
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

console.log('✅ Environment variables loaded');
console.log(`🔗 Supabase URL: ${SUPABASE_URL}`);
console.log(`🔑 Key length: ${SUPABASE_ANON_KEY.length} characters`);

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testConnection() {
  console.log('\n📡 Testing database connection...');
  
  try {
    const { data, error } = await supabase
      .from('fuel_tanks')
      .select('id, location, safe_level')
      .limit(1);
      
    if (error) {
      console.error('❌ Connection test failed:', error.message);
      return false;
    }
    
    console.log('✅ Database connection successful!');
    console.log(`📊 Sample data:`, data);
    return true;
  } catch (err) {
    console.error('❌ Connection error:', err.message);
    return false;
  }
}

async function executeSQLFile(filePath) {
  console.log(`\n📜 Executing SQL file: ${filePath}`);
  
  try {
    const sqlContent = readFileSync(filePath, 'utf8');
    console.log(`📝 SQL file size: ${sqlContent.length} characters`);
    
    // For this test, we'll extract and execute key parts
    // Note: Supabase client doesn't support full SQL scripts, so we'll need to use RPC or break it down
    
    console.log('⚠️ Note: Full SQL script execution requires manual steps in Supabase dashboard');
    console.log('📋 SQL content preview:');
    console.log(sqlContent.substring(0, 500) + '...');
    
    return true;
  } catch (err) {
    console.error('❌ Error reading SQL file:', err.message);
    return false;
  }
}

async function testViewExists() {
  console.log('\n🔍 Testing if tanks_with_rolling_avg view exists...');
  
  try {
    const { data, error } = await supabase
      .from('tanks_with_rolling_avg')
      .select('id, location, safe_level, current_level_percent')
      .limit(3);
      
    if (error) {
      console.error('❌ View query failed:', error.message);
      return false;
    }
    
    console.log('✅ View exists and returned data!');
    console.log('📊 Sample view data:', data);
    return true;
  } catch (err) {
    console.error('❌ View test error:', err.message);
    return false;
  }
}

async function main() {
  console.log('🧪 Starting Database Fixes Test\n');
  
  // Test 1: Basic connection
  const connectionOk = await testConnection();
  if (!connectionOk) {
    console.log('❌ Cannot proceed without database connection');
    process.exit(1);
  }
  
  // Test 2: Check current view status
  const viewExists = await testViewExists();
  console.log(`📋 Current view status: ${viewExists ? 'EXISTS' : 'MISSING/BROKEN'}`);
  
  // Test 3: Show SQL files that need to be executed
  const viewFixFile = join(__dirname, 'database/fixes/frontend_compatible_view.sql');
  const rlsFixFile = join(__dirname, 'database/fixes/non_recursive_rls_policies.sql');
  
  console.log('\n📋 SQL Files to execute:');
  await executeSQLFile(viewFixFile);
  await executeSQLFile(rlsFixFile);
  
  console.log('\n✅ Test completed!');
  console.log('💡 Next step: Execute the SQL scripts manually in Supabase dashboard');
  console.log('📖 See MANUAL_RECOVERY_STEPS.md for detailed instructions');
}

main().catch(console.error);