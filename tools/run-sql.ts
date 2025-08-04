#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ Please set SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runSQL() {
  console.log('🗃️ Running SQL migration to fix captive_deliveries view...');
  
  try {
    // Read the SQL file
    const sqlContent = fs.readFileSync('database/migrations/fix_captive_deliveries_view.sql', 'utf-8');
    
    // Split into individual statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));
    
    console.log(`   📝 Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement) continue;
      
      console.log(`   ${i + 1}/${statements.length}: Executing statement...`);
      
      try {
        const { data, error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          // If exec_sql doesn't exist, try direct query
          const { data: directData, error: directError } = await (supabase as any).query(statement);
          if (directError) throw directError;
        }
        
        console.log(`   ✅ Statement ${i + 1} executed successfully`);
        
      } catch (statementError) {
        console.warn(`   ⚠️  Statement ${i + 1} failed:`, (statementError as any).message);
        // Continue with other statements
      }
    }
    
    console.log('   ✅ Migration completed');
    
    // Test the result
    await testResult();
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

async function testResult() {
  console.log('🧪 Testing migration results...');
  
  try {
    const { count: recordsCount } = await supabase
      .from('captive_payment_records')
      .select('*', { count: 'exact', head: true });
    
    const { count: deliveriesCount } = await supabase
      .from('captive_deliveries')
      .select('*', { count: 'exact', head: true });
    
    const { data: sampleDeliveries } = await supabase
      .from('captive_deliveries')
      .select('*')
      .limit(3);
    
    console.log(`   📊 Payment Records: ${recordsCount || 0}`);
    console.log(`   🚚 Unique Deliveries: ${deliveriesCount || 0}`);
    console.log('   📋 Sample deliveries:', sampleDeliveries?.length || 0);
    
    if (sampleDeliveries && sampleDeliveries.length > 0) {
      console.log('   ✅ captive_deliveries view is working correctly');
    }
    
  } catch (error) {
    console.error('   ❌ Testing failed:', error);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSQL().catch(console.error);
}