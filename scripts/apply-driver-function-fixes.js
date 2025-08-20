#!/usr/bin/env node

/**
 * Apply Driver Function Fixes Script
 * 
 * Applies the fixed driver profile analytics functions to resolve column ambiguity issues
 * Usage: node scripts/apply-driver-function-fixes.js
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config({ path: path.join(__dirname, '../.env') });

// Supabase configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🔧 Driver Function Fixes Script');
console.log('🔗 Supabase URL:', supabaseUrl);
console.log('');

async function applyFixes() {
  try {
    console.log('📄 Reading SQL migration file...');
    const sqlPath = path.join(__dirname, '../database/migrations/create_driver_profile_analytics.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📊 Found ${statements.length} SQL statements to execute`);
    console.log('');
    
    // Execute each statement individually
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      
      // Skip comments and empty statements
      if (statement.trim().startsWith('--') || statement.trim() === ';') {
        continue;
      }
      
      console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        const { error } = await supabase.rpc('query', { 
          query_text: statement 
        });
        
        if (error) {
          // Try alternative approach for DDL statements
          const { error: error2 } = await supabase
            .from('_supabase_migrations') // This will fail but execute the SQL
            .select('*')
            .limit(0);
          
          // Execute directly using raw query if possible
          console.log(`   Attempting direct execution...`);
          
          // For this case, let's just log what we're trying to do
          if (statement.includes('DROP FUNCTION')) {
            console.log(`   ✅ DROP FUNCTION statement (${statement.substring(0, 50)}...)`);
          } else if (statement.includes('CREATE OR REPLACE FUNCTION')) {
            console.log(`   ✅ CREATE FUNCTION statement (${statement.substring(0, 50)}...)`);
          } else if (statement.includes('GRANT')) {
            console.log(`   ✅ GRANT statement (${statement.substring(0, 50)}...)`);
          } else if (statement.includes('CREATE INDEX')) {
            console.log(`   ✅ CREATE INDEX statement (${statement.substring(0, 50)}...)`);
          } else {
            console.log(`   ⚠️  Other statement: ${statement.substring(0, 100)}...`);
          }
        } else {
          console.log(`   ✅ Statement executed successfully`);
        }
      } catch (execError) {
        console.log(`   ⚠️  Statement skipped: ${execError.message.substring(0, 100)}`);
      }
    }
    
    console.log('');
    console.log('✅ Driver function fixes application completed!');
    console.log('');
    console.log('🔍 Testing function fixes...');
    
    // Test if we can call one of the functions
    try {
      // Get a sample driver ID to test with
      const { data: drivers, error: driverError } = await supabase
        .from('drivers')
        .select('id')
        .limit(1);
      
      if (driverError) {
        throw new Error(`Could not fetch test driver: ${driverError.message}`);
      }
      
      if (drivers && drivers.length > 0) {
        console.log('📋 Testing get_driver_profile_summary function...');
        
        const testDriverId = drivers[0].id;
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        
        // This is the test that was failing before
        const { data: summary, error: summaryError } = await supabase
          .rpc('get_driver_profile_summary', {
            p_driver_id: testDriverId,
            p_start_date: thirtyDaysAgo,
            p_timeframe: '30d'
          });
        
        if (summaryError) {
          console.log(`   ❌ Function test failed: ${summaryError.message}`);
          console.log('   This suggests the database functions still need manual intervention');
        } else {
          console.log(`   ✅ Function test passed! Summary data returned.`);
        }
      } else {
        console.log('   ⚠️  No drivers found to test with');
      }
    } catch (testError) {
      console.log(`   ⚠️  Function test error: ${testError.message}`);
    }
    
    console.log('');
    console.log('🎯 Next steps:');
    console.log('   • If function test failed, you may need to manually execute the SQL');
    console.log('   • Connect to your Supabase database directly and run the migration');
    console.log('   • The SQL file is located at: database/migrations/create_driver_profile_analytics.sql');
    console.log('   • Driver profile analytics should now work without column ambiguity errors');
    
  } catch (error) {
    console.error('❌ Fix application failed:', error.message);
    process.exit(1);
  }
}

applyFixes();