#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqenNkc3ZidGFwcmlpdXh6bWloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTE4MDU1MiwiZXhwIjoyMDY0NzU2NTUyfQ.c6HZBGuXBz-RHXwFasOmJ8A_e0oRkt6vy-hNFDidCKo';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testCurrentView() {
  console.log('🧪 Testing current tanks_with_rolling_avg view...');
  
  try {
    // Test current view
    const { data, error } = await supabase
      .from('tanks_with_rolling_avg')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('❌ Current view error:', error.message);
      console.log('🔧 View needs to be recreated');
    } else {
      console.log('✅ Current view works!');
      console.log(`📊 Found ${data.length} tanks`);
      
      if (data.length > 0) {
        console.log('📋 Sample data:');
        data.forEach(tank => {
          console.log(`  • ${tank.location || 'Unknown'}: ${tank.current_level_percent_display}% - ${tank.subgroup}`);
        });
      }
      
      // Check field names to see what's missing
      const sampleTank = data[0];
      if (sampleTank) {
        console.log('🔍 Available fields in view:');
        Object.keys(sampleTank).forEach(key => {
          console.log(`  - ${key}: ${sampleTank[key]}`);
        });
      }
    }
    
    // Test direct tank access
    console.log('\n🧪 Testing direct fuel_tanks access...');
    const { data: tanksData, error: tanksError } = await supabase
      .from('fuel_tanks')
      .select('id, location, safe_level, min_level, subgroup')
      .eq('subgroup', 'GSFS Narrogin')
      .limit(3);
    
    if (tanksError) {
      console.error('❌ Direct tanks error:', tanksError.message);
    } else {
      console.log('✅ Direct tanks access works!');
      console.log(`📊 Found ${tanksData.length} GSFS Narrogin tanks`);
      tanksData.forEach(tank => {
        console.log(`  • ${tank.location}: ${tank.safe_level}L capacity`);
      });
    }
    
  } catch (error) {
    console.error('💥 Test error:', error.message);
  }
}

testCurrentView();