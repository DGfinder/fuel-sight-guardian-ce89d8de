#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'fs/promises';

const supabaseUrl = 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqenNkc3ZidGFwcmlpdXh6bWloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTE4MDU1MiwiZXhwIjoyMDY0NzU2NTUyfQ.c6HZBGuXBz-RHXwFasOmJ8A_e0oRkt6vy-hNFDidCKo';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runSqlFix() {
  try {
    console.log('🔧 Starting tanks rolling average view fix...');
    
    // Read the SQL fix file
    const sqlContent = await readFile('./fix_tanks_rolling_avg_final.sql', 'utf8');
    
    // Split the SQL into individual statements (rough split by semicolon)
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments and empty statements
      if (statement.startsWith('SELECT \'') && statement.includes('as step')) {
        console.log(`📋 ${statement.match(/'([^']+)'/)?.[1] || `Step ${i + 1}`}`);
        continue;
      }
      
      try {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
        
        // Use RPC to execute raw SQL
        const { data, error } = await supabase.rpc('exec_sql', { 
          sql_query: statement + ';' 
        });
        
        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
          errorCount++;
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
          successCount++;
        }
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (err) {
        console.error(`❌ Exception in statement ${i + 1}:`, err.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 Fix execution summary:');
    console.log(`✅ Successful statements: ${successCount}`);
    console.log(`❌ Failed statements: ${errorCount}`);
    
    if (errorCount === 0) {
      console.log('🎉 All statements executed successfully!');
      
      // Test the view
      console.log('\n🧪 Testing the fixed view...');
      const { data: testData, error: testError } = await supabase
        .from('tanks_with_rolling_avg')
        .select('location, current_level_percent_display, safe_fill, current_level')
        .limit(5);
      
      if (testError) {
        console.error('❌ View test failed:', testError.message);
      } else {
        console.log('✅ View test successful! Sample data:');
        console.table(testData);
      }
    } else {
      console.log('⚠️ Some statements failed. Check the errors above.');
    }
    
  } catch (error) {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  }
}

runSqlFix();