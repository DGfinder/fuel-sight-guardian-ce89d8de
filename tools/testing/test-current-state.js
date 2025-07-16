#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqenNkc3ZidGFwcmlpdXh6bWloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTE4MDU1MiwiZXhwIjoyMDY0NzU2NTUyfQ.c6HZBGuXBz-RHXwFasOmJ8A_e0oRkt6vy-hNFDidCKo';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testCurrentState() {
  console.log('🧪 Testing current view state and percentage calculations...');
  
  try {
    // Test current view
    console.log('🔍 Testing current tanks_with_rolling_avg view...');
    const { data: viewData, error: viewError } = await supabase
      .from('tanks_with_rolling_avg')
      .select('*')
      .eq('subgroup', 'GSFS Narrogin');
    
    if (viewError) {
      console.error('❌ View error:', viewError.message);
      return;
    }
    
    console.log(`📊 Found ${viewData.length} GSFS Narrogin tanks in current view`);
    
    // Test raw tank data for comparison
    console.log('\n📋 Raw tank data from fuel_tanks:');
    const { data: tankData, error: tankError } = await supabase
      .from('fuel_tanks')
      .select('id, location, safe_level, min_level')
      .eq('subgroup', 'GSFS Narrogin');
    
    if (tankError) {
      console.error('❌ Tank data error:', tankError.message);
    } else {
      tankData.forEach(tank => {
        console.log(`  • ${tank.location}: safe_level=${tank.safe_level}L, min_level=${tank.min_level}L`);
      });
    }
    
    // Test latest dip readings
    console.log('\n💧 Latest dip readings:');
    const { data: dipData, error: dipError } = await supabase
      .from('dip_readings')
      .select('tank_id, value, created_at')
      .in('tank_id', tankData.map(t => t.id))
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (dipError) {
      console.error('❌ Dip readings error:', dipError.message);
    } else {
      dipData.forEach(dip => {
        const tank = tankData.find(t => t.id === dip.tank_id);
        console.log(`  • ${tank?.location}: ${dip.value}L at ${dip.created_at}`);
      });
    }
    
    // Analyze current view results
    console.log('\n🔍 Analyzing current view results:');
    viewData.forEach(tank => {
      const rawTank = tankData.find(t => t.id === tank.id);
      const expectedPercent = rawTank && rawTank.safe_level > 0 ? 
        Math.round(((tank.current_level - (tank.min_level || 0)) / 
                   (rawTank.safe_level - (tank.min_level || 0))) * 100 * 10) / 10 : 0;
      
      console.log(`\n  📍 ${tank.location}:`);
      console.log(`    View shows: ${tank.current_level_percent}%`);
      console.log(`    Should be: ${expectedPercent}%`);
      console.log(`    Current level: ${tank.current_level}L`);
      console.log(`    Safe level: ${tank.safe_level || rawTank?.safe_level}L`);
      console.log(`    Min level: ${tank.min_level}L`);
      console.log(`    Status: ${tank.current_level_percent > 0 ? '✅ Working' : '❌ Broken'}`);
      
      // Check if fields match frontend expectations
      const frontendFields = ['id', 'location', 'current_level_percent', 'safe_level', 'current_level', 'group_name'];
      const missingFields = frontendFields.filter(field => tank[field] === undefined);
      if (missingFields.length > 0) {
        console.log(`    ⚠️ Missing frontend fields: ${missingFields.join(', ')}`);
      }
    });
    
    // Summary
    const workingTanks = viewData.filter(t => t.current_level_percent > 0);
    console.log(`\n📊 SUMMARY:`);
    console.log(`  Working tanks: ${workingTanks.length}/${viewData.length}`);
    console.log(`  Issue: ${workingTanks.length === 0 ? 'Percentage calculation broken' : 'Partially working'}`);
    
    if (workingTanks.length === 0) {
      console.log('\n💡 SOLUTION NEEDED:');
      console.log('  1. Execute the working-view.sql file manually in Supabase SQL editor');
      console.log('  2. Or use a PostgreSQL client to run the SQL');
      console.log('  3. The view needs the correct percentage calculation formula');
    }
    
    // Check if we can manually calculate the percentage correctly
    console.log('\n🧮 Manual percentage calculation test:');
    viewData.forEach(tank => {
      const rawTank = tankData.find(t => t.id === tank.id);
      if (rawTank && tank.current_level && rawTank.safe_level) {
        const manualPercent = Math.round(
          ((tank.current_level - (tank.min_level || 0)) / 
           (rawTank.safe_level - (tank.min_level || 0))) * 100 * 10
        ) / 10;
        console.log(`  ${tank.location}: Manual calc = ${manualPercent}% (view shows ${tank.current_level_percent}%)`);
      }
    });
    
  } catch (error) {
    console.error('💥 Test error:', error.message);
  }
}

testCurrentState();