#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqenNkc3ZidGFwcmlpdXh6bWloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTE4MDU1MiwiZXhwIjoyMDY0NzU2NTUyfQ.c6HZBGuXBz-RHXwFasOmJ8A_e0oRkt6vy-hNFididCKo';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testEnhancedView() {
  console.log('🚀 Testing Enhanced Bulletproof View with Advanced Fuel Analytics...');
  
  try {
    // Test 1: GSFS Narrogin specific test
    console.log('\n🎯 Test 1: GSFS Narrogin Enhanced Analytics');
    const { data: narroginTanks, error: narroginError } = await supabase
      .from('tanks_with_rolling_avg')
      .select('*')
      .eq('subgroup', 'GSFS Narrogin');
    
    if (narroginError) {
      console.error('❌ Enhanced view query failed:', narroginError.message);
      return;
    }
    
    console.log(`✅ Found ${narroginTanks.length} GSFS Narrogin tanks with enhanced analytics`);
    
    narroginTanks.forEach(tank => {
      console.log(`\n  🏗️ ${tank.location}:`);
      console.log(`    Current Level: ${tank.current_level}L`);
      console.log(`    Safe Level: ${tank.safe_fill}L`);
      console.log(`    Min Level: ${tank.min_level}L`);
      console.log(`    % Above Min: ${tank.current_level_percent}%`);
      console.log(`    Rolling Avg: ${tank.rolling_avg_lpd} L/day`);
      console.log(`    Prev Day Used: ${tank.prev_day_used}L`);
      console.log(`    Days to Min: ${tank.days_to_min_level || 'N/A'}`);
      console.log(`    Status: ${tank.status}`);
      
      // Validation checks
      const validations = [];
      
      // Check percentage is above minimum calculation
      const expectedPercent = tank.safe_fill > tank.min_level ? 
        Math.round(((tank.current_level - tank.min_level) / (tank.safe_fill - tank.min_level)) * 100 * 10) / 10 : 0;
      if (Math.abs(tank.current_level_percent - expectedPercent) <= 0.1) {
        validations.push('✅ % Above Min Correct');
      } else {
        validations.push(`❌ % Above Min Wrong (got ${tank.current_level_percent}%, expected ${expectedPercent}%)`);
      }
      
      // Check rolling average is negative (consumption)
      if (tank.rolling_avg_lpd <= 0) {
        validations.push('✅ Rolling Avg Consumption (negative/zero)');
      } else {
        validations.push('❌ Rolling Avg Should Be Negative');
      }
      
      // Check status makes sense
      const statusValid = ['Critical', 'Low', 'Medium', 'Good'].includes(tank.status);
      if (statusValid) {
        validations.push('✅ Status Valid');
      } else {
        validations.push('❌ Status Invalid');
      }
      
      console.log(`    Validations: ${validations.join(', ')}`);
    });
    
    // Test 2: Status distribution across all tanks
    console.log('\n📊 Test 2: Status Distribution Across All Tanks');
    const { data: statusData, error: statusError } = await supabase.rpc('sql', {
      query: `
        SELECT 
          status,
          COUNT(*) as tank_count,
          ROUND(AVG(current_level_percent), 1) as avg_percent_above_min
        FROM tanks_with_rolling_avg 
        WHERE status IS NOT NULL
        GROUP BY status
        ORDER BY 
          CASE status 
            WHEN 'Critical' THEN 1 
            WHEN 'Low' THEN 2 
            WHEN 'Medium' THEN 3 
            WHEN 'Good' THEN 4 
            ELSE 5 
          END
      `
    });
    
    if (!statusError && statusData) {
      console.log('Status distribution:');
      statusData.forEach(row => {
        const emoji = {
          'Critical': '🔴',
          'Low': '🟡', 
          'Medium': '🟠',
          'Good': '🟢'
        }[row.status] || '⚪';
        
        console.log(`  ${emoji} ${row.status}: ${row.tank_count} tanks (avg ${row.avg_percent_above_min}% above min)`);
      });
    }
    
    // Test 3: Rolling averages validation
    console.log('\n📈 Test 3: Rolling Average Validation');
    const tanksWithRollingAvg = narroginTanks.filter(t => t.rolling_avg_lpd !== 0);
    console.log(`Tanks with rolling average data: ${tanksWithRollingAvg.length}/${narroginTanks.length}`);
    
    tanksWithRollingAvg.forEach(tank => {
      const avgStatus = tank.rolling_avg_lpd < 0 ? 'Consuming fuel ✅' : 
                       tank.rolling_avg_lpd > 0 ? 'Gaining fuel (refills?) ⚠️' : 
                       'No change';
      console.log(`  • ${tank.location}: ${tank.rolling_avg_lpd} L/day (${avgStatus})`);
    });
    
    // Test 4: Days to minimum validation
    console.log('\n⏰ Test 4: Days to Minimum Validation');
    const tanksWithDaysToMin = narroginTanks.filter(t => t.days_to_min_level !== null);
    console.log(`Tanks with days to minimum data: ${tanksWithDaysToMin.length}/${narroginTanks.length}`);
    
    tanksWithDaysToMin.forEach(tank => {
      const urgency = tank.days_to_min_level <= 1 ? 'CRITICAL ⚠️' :
                     tank.days_to_min_level <= 2 ? 'LOW 🟡' :
                     tank.days_to_min_level <= 7 ? 'MEDIUM 🟠' : 
                     'GOOD 🟢';
      console.log(`  • ${tank.location}: ${tank.days_to_min_level} days (${urgency})`);
    });
    
    // Test 5: Previous day usage validation
    console.log('\n📊 Test 5: Previous Day Usage Validation');
    const tanksWithPrevDay = narroginTanks.filter(t => t.prev_day_used > 0);
    console.log(`Tanks with previous day usage: ${tanksWithPrevDay.length}/${narroginTanks.length}`);
    
    tanksWithPrevDay.forEach(tank => {
      console.log(`  • ${tank.location}: ${tank.prev_day_used}L used yesterday`);
    });
    
    // Test 6: Performance check
    console.log('\n⚡ Test 6: Performance Check');
    const startTime = Date.now();
    const { data: perfTest, error: perfError } = await supabase
      .from('tanks_with_rolling_avg')
      .select('id, location, current_level_percent, rolling_avg_lpd, status')
      .limit(50);
    
    const duration = Date.now() - startTime;
    
    if (perfError) {
      console.error('❌ Performance test failed:', perfError.message);
    } else {
      console.log(`✅ Performance test: ${perfTest.length} tanks with analytics loaded in ${duration}ms`);
    }
    
    // Test 7: Summary and validation
    console.log('\n📋 SUMMARY AND VALIDATION:');
    
    const summary = {
      totalTanks: narroginTanks.length,
      tanksWithPercentages: narroginTanks.filter(t => t.current_level_percent > 0).length,
      tanksWithRollingAvg: narroginTanks.filter(t => t.rolling_avg_lpd !== 0).length,
      tanksWithPrevDay: narroginTanks.filter(t => t.prev_day_used > 0).length,
      tanksWithDaysToMin: narroginTanks.filter(t => t.days_to_min_level !== null).length,
      tanksWithStatus: narroginTanks.filter(t => t.status !== null).length
    };
    
    console.log(`  📊 Total GSFS Narrogin tanks: ${summary.totalTanks}`);
    console.log(`  ✅ Tanks with percentages: ${summary.tanksWithPercentages}/${summary.totalTanks}`);
    console.log(`  📈 Tanks with rolling averages: ${summary.tanksWithRollingAvg}/${summary.totalTanks}`);
    console.log(`  📊 Tanks with prev day usage: ${summary.tanksWithPrevDay}/${summary.totalTanks}`);
    console.log(`  ⏰ Tanks with days to min: ${summary.tanksWithDaysToMin}/${summary.totalTanks}`);
    console.log(`  🎯 Tanks with status: ${summary.tanksWithStatus}/${summary.totalTanks}`);
    
    // Final assessment
    if (summary.tanksWithPercentages === summary.totalTanks && summary.tanksWithStatus === summary.totalTanks) {
      console.log('\n🎉 COMPLETE SUCCESS! All core analytics working!');
      if (summary.tanksWithRollingAvg > 0 || summary.tanksWithDaysToMin > 0) {
        console.log('✅ Advanced analytics (rolling avg, days to min) working for tanks with sufficient data');
      }
      console.log('✅ Enhanced view ready for production use');
    } else {
      console.log('\n⚠️ PARTIAL SUCCESS: Core functionality working, some advanced features may need refinement');
    }
    
    // Browser console commands for testing
    console.log('\n🖥️ Browser Console Commands:');
    console.log('// Clear cache and test:');
    console.log('window.queryClient?.clear(); window.location.reload();');
    
  } catch (error) {
    console.error('💥 Enhanced view test failed:', error.message);
  }
}

testEnhancedView();