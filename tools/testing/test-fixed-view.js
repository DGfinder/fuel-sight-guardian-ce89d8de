#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqenNkc3ZidGFwcmlpdXh6bWloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTE4MDU1MiwiZXhwIjoyMDY0NzU2NTUyfQ.c6HZBGuXBz-RHXwFasOmJ8A_e0oRkt6vy-hNFDidCKo';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testFixedView() {
  console.log('🧪 Testing the fixed view...');
  
  try {
    // First, see what fields are available
    console.log('🔍 Checking available fields...');
    const { data: sampleData, error: sampleError } = await supabase
      .from('tanks_with_rolling_avg')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.error('❌ Sample data error:', sampleError.message);
      return;
    }
    
    if (sampleData && sampleData.length > 0) {
      console.log('📋 Available fields in view:');
      Object.keys(sampleData[0]).forEach(key => {
        console.log(`  - ${key}`);
      });
    }
    
    // Now test GSFS Narrogin tanks specifically
    console.log('\n🎯 Testing GSFS Narrogin tanks...');
    const { data: testData, error: testError } = await supabase
      .from('tanks_with_rolling_avg')
      .select('*')
      .eq('subgroup', 'GSFS Narrogin');
    
    if (testError) {
      console.error('❌ Test failed:', testError.message);
    } else {
      console.log('✅ Test successful!');
      console.log(`📊 Found ${testData.length} GSFS Narrogin tanks`);
      
      testData.forEach(tank => {
        // Calculate expected percentage based on what we know
        const capacity = tank.safe_fill || tank.safe_level || 0;
        const current = tank.current_level || 0;
        const expectedPercent = capacity > 0 ? Math.round((current / capacity) * 100) : 0;
        
        console.log(`\n  • ${tank.location}:`);
        console.log(`    Current Level: ${current}L`);
        console.log(`    Capacity: ${capacity}L`);
        console.log(`    View Percentage: ${tank.current_level_percent}%`);
        console.log(`    Expected Percentage: ${expectedPercent}%`);
        console.log(`    Status: ${tank.current_level_percent > 0 ? '✅ HAS PERCENTAGE' : '❌ NO PERCENTAGE'}`);
        
        if (tank.current_level_percent > 0 && Math.abs(tank.current_level_percent - expectedPercent) <= 2) {
          console.log(`    🎉 CORRECTLY CALCULATED!`);
        } else if (tank.current_level_percent > 0) {
          console.log(`    ⚠️ Has percentage but calculation may be off`);
        }
      });
      
      const validTanks = testData.filter(t => t.current_level_percent > 0);
      console.log(`\n📊 Summary: ${validTanks.length}/${testData.length} tanks have valid percentages`);
      
      if (validTanks.length === testData.length) {
        console.log('🎉 ALL TANKS FIXED! Percentage calculations are working!');
      } else if (validTanks.length > 0) {
        console.log('⚠️ Partially fixed - some tanks still showing 0%');
      } else {
        console.log('❌ Fix failed - all tanks still showing 0%');
      }
    }
    
  } catch (error) {
    console.error('💥 Test error:', error.message);
  }
}

testFixedView();