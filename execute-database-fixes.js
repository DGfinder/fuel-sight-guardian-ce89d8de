#!/usr/bin/env node

// Execute database fixes using service role key
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
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_ANON_KEY; // Actually service role now

console.log('🚀 Executing Database Fixes with Service Role');
console.log(`🔗 URL: ${SUPABASE_URL}`);
console.log(`🔑 Service Key Length: ${SUPABASE_SERVICE_KEY?.length} chars`);

// Create Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testConnection() {
  console.log('\n📡 Testing service role connection...');
  
  try {
    const { data, error } = await supabase
      .from('fuel_tanks')
      .select('id, location, safe_level, min_level')
      .limit(3);
      
    if (error) {
      console.error('❌ Connection failed:', error.message);
      return false;
    }
    
    console.log('✅ Service role connection successful!');
    console.log('📊 Sample tanks:', data.map(t => `${t.location}: ${t.safe_level}L`));
    return true;
  } catch (err) {
    console.error('❌ Connection error:', err.message);
    return false;
  }
}

async function checkCurrentView() {
  console.log('\n🔍 Checking current tanks_with_rolling_avg view...');
  
  try {
    const { data, error } = await supabase
      .from('tanks_with_rolling_avg')
      .select('location, safe_level, product_type, current_level_percent')
      .limit(3);
      
    if (error) {
      console.error('❌ View query failed:', error.message);
      console.log('💡 This means we need to create/fix the view');
      return false;
    }
    
    console.log('✅ View exists and working!');
    console.log('📊 Sample view data:');
    data.forEach(tank => {
      console.log(`  ${tank.location}: ${tank.safe_level}L, ${tank.current_level_percent}%, ${tank.product_type}`);
    });
    
    // Check field names
    const firstTank = data[0];
    if (firstTank) {
      console.log('\n🔍 Field name analysis:');
      console.log(`  ✅ Has 'safe_level': ${firstTank.hasOwnProperty('safe_level')}`);
      console.log(`  ❌ Has 'safe_fill': ${firstTank.hasOwnProperty('safe_fill')}`);
      console.log(`  ✅ Has 'product_type': ${firstTank.hasOwnProperty('product_type')}`);
      console.log(`  ❌ Has 'product': ${firstTank.hasOwnProperty('product')}`);
    }
    
    return true;
  } catch (err) {
    console.error('❌ View check error:', err.message);
    return false;
  }
}

async function executeViewFix() {
  console.log('\n📜 Executing frontend_compatible_view.sql...');
  
  try {
    // Read the SQL file
    const sqlFile = join(__dirname, 'database/fixes/frontend_compatible_view.sql');
    const sqlContent = readFileSync(sqlFile, 'utf8');
    
    console.log(`📝 SQL file loaded: ${sqlContent.length} characters`);
    
    // Note: Supabase client doesn't support full SQL script execution
    // We need to execute key parts manually or use RPC
    
    console.log('⚠️ Note: Full SQL script execution requires manual steps');
    console.log('📋 Key SQL components identified:');
    console.log('  1. DROP VIEW IF EXISTS public.tanks_with_rolling_avg CASCADE;');
    console.log('  2. CREATE VIEW public.tanks_with_rolling_avg AS...');
    console.log('  3. GRANT SELECT ON public.tanks_with_rolling_avg TO authenticated;');
    
    // Test if we can use RPC to execute raw SQL
    console.log('\n🧪 Testing SQL execution capability...');
    
    const { data, error } = await supabase.rpc('sql', { 
      query: 'SELECT current_database()' 
    });
    
    if (error) {
      console.log('❌ RPC SQL execution not available:', error.message);
      console.log('💡 Manual execution required in Supabase dashboard');
    } else {
      console.log('✅ RPC available, database:', data);
    }
    
    return true;
  } catch (err) {
    console.error('❌ Error:', err.message);
    return false;
  }
}

async function showGSFSNarrogin() {
  console.log('\n🎯 Checking GSFS Narrogin tanks specifically...');
  
  try {
    const { data, error } = await supabase
      .from('tanks_with_rolling_avg')
      .select('location, safe_level, current_level, current_level_percent, subgroup')
      .ilike('subgroup', '%narrogin%')
      .limit(5);
      
    if (error) {
      console.error('❌ GSFS Narrogin query failed:', error.message);
      return false;
    }
    
    if (data.length === 0) {
      console.log('⚠️ No GSFS Narrogin tanks found');
      return false;
    }
    
    console.log('✅ GSFS Narrogin tanks found:');
    data.forEach(tank => {
      const status = tank.current_level_percent > 0 ? '✅' : '❌';
      console.log(`  ${status} ${tank.location}: ${tank.current_level_percent}% (${tank.current_level}L / ${tank.safe_level}L)`);
    });
    
    return true;
  } catch (err) {
    console.error('❌ Error:', err.message);
    return false;
  }
}

async function main() {
  console.log('🔧 Database Fixes Execution Started\n');
  
  // Step 1: Test connection
  const connected = await testConnection();
  if (!connected) {
    console.log('❌ Cannot proceed without database connection');
    process.exit(1);
  }
  
  // Step 2: Check current view status
  const viewWorking = await checkCurrentView();
  
  // Step 3: Execute view fix if needed
  if (!viewWorking) {
    await executeViewFix();
  }
  
  // Step 4: Test GSFS Narrogin specifically
  await showGSFSNarrogin();
  
  console.log('\n✅ Database analysis completed!');
  console.log('\n📋 Summary:');
  console.log('  - Service role connection: ✅ Working');
  console.log(`  - View exists: ${viewWorking ? '✅ Yes' : '❌ No'}`);
  console.log('  - Field names: Need verification');
  console.log('\n💡 Next steps:');
  console.log('  1. If view is broken, execute the SQL manually in Supabase dashboard');
  console.log('  2. Use scripts from MANUAL_RECOVERY_STEPS.md');
  console.log('  3. Test frontend after database fixes are applied');
}

main().catch(console.error);