#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'fs/promises';

const supabaseUrl = 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqenNkc3ZidGFwcmlpdXh6bWloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTE4MDU1MiwiZXhwIjoyMDY0NzU2NTUyfQ.c6HZBGuXBz-RHXwFasOmJ8A_e0oRkt6vy-hNFDidCKo';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runUltraSimpleView() {
  try {
    console.log('🔧 Creating ultra-simple tanks view (Phase 1 - No complex analytics)...');
    
    // Read the ultra simple view SQL file
    const sqlContent = await readFile('./database/views/ultra_simple_working_view_final.sql', 'utf8');
    
    // Split the SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip step messages
      if (statement.startsWith('SELECT \'') && statement.includes('as step')) {
        console.log(`📋 ${statement.match(/'([^']+)'/)?.[1] || `Step ${i + 1}`}`);
        continue;
      }
      
      // Skip success messages
      if (statement.startsWith('SELECT \'') && (statement.includes('status') || statement.includes('approach') || statement.includes('capacity'))) {
        console.log(`📋 ${statement.match(/'([^']+)'/)?.[1] || `Info ${i + 1}`}`);
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
          console.error(`Statement: ${statement.substring(0, 100)}...`);
          errorCount++;
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
          successCount++;
        }
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (err) {
        console.error(`❌ Exception in statement ${i + 1}:`, err.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 Ultra-simple view execution summary:');
    console.log(`✅ Successful statements: ${successCount}`);
    console.log(`❌ Failed statements: ${errorCount}`);
    
    if (errorCount === 0) {
      console.log('🎉 Ultra-simple view created successfully!');
      
      // Test the view
      console.log('\n🧪 Testing the ultra-simple view...');
      const { data: testData, error: testError } = await supabase
        .from('tanks_with_rolling_avg')
        .select('location, current_level_percent, rolling_avg_lpd, prev_day_used, days_to_min_level, usable_capacity')
        .limit(5);
      
      if (testError) {
        console.error('❌ View test failed:', testError.message);
        console.error('This might indicate the view creation had issues.');
      } else {
        console.log('✅ View test successful! Sample data:');
        console.table(testData);
        
        console.log('\n📈 Analytics Status:');
        console.log('• rolling_avg_lpd: Should be 0 (placeholder - calculated in frontend)');
        console.log('• prev_day_used: Should be 0 (placeholder - calculated in frontend)');
        console.log('• days_to_min_level: Should be NULL (placeholder - calculated in frontend)');
        console.log('• current_level_percent: Should have real values');
        console.log('\n🎯 Next step: Implement frontend analytics calculations in useTanks.ts');
      }
    } else {
      console.log('⚠️ Some statements failed. The view may not be working correctly.');
    }
    
  } catch (error) {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  }
}

runUltraSimpleView();