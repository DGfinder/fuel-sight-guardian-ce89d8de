#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqenNkc3ZidGFwcmlpdXh6bWloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTE4MDU1MiwiZXhwIjoyMDY0NzU2NTUyfQ.c6HZBGuXBz-RHXwFasOmJ8A_e0oRkt6vy-hNFDidCKo';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectViewAndData() {
  console.log('🔍 Inspecting view definition and tank data...');
  
  try {
    // 1. Check the actual tank data in fuel_tanks table
    console.log('\n📊 Checking actual tank data in fuel_tanks table:');
    const { data: tankData, error: tankError } = await supabase
      .from('fuel_tanks')
      .select('id, location, safe_level, min_level, subgroup')
      .eq('subgroup', 'GSFS Narrogin');
    
    if (tankError) {
      console.error('❌ Tank data error:', tankError.message);
    } else {
      console.log(`Found ${tankData.length} GSFS Narrogin tanks in fuel_tanks:`);
      tankData.forEach(tank => {
        console.log(`  • ${tank.location}: safe_level=${tank.safe_level}L, min_level=${tank.min_level}L`);
      });
    }
    
    // 2. Check what the view returns for the same tanks
    console.log('\n🔍 Checking what the view returns:');
    const { data: viewData, error: viewError } = await supabase
      .from('tanks_with_rolling_avg')
      .select('id, location, safe_level, current_level, current_level_percent, subgroup')
      .eq('subgroup', 'GSFS Narrogin');
    
    if (viewError) {
      console.error('❌ View data error:', viewError.message);
    } else {
      console.log(`Found ${viewData.length} GSFS Narrogin tanks in view:`);
      viewData.forEach(tank => {
        console.log(`  • ${tank.location}: safe_level=${tank.safe_level}L, current_level=${tank.current_level}L, percent=${tank.current_level_percent}%`);
      });
    }
    
    // 3. Try to get the view definition
    console.log('\n📋 Attempting to get view definition:');
    const { data: viewDefData, error: viewDefError } = await supabase.rpc('exec_sql', {
      sql_query: `
        SELECT definition 
        FROM pg_views 
        WHERE schemaname = 'public' 
        AND viewname = 'tanks_with_rolling_avg';
      `
    });
    
    if (viewDefError) {
      console.error('❌ View definition error:', viewDefError.message);
    } else if (viewDefData && viewDefData.length > 0) {
      console.log('View definition found:');
      console.log(viewDefData[0].definition);
    } else {
      console.log('No view definition found or exec_sql not available');
    }
    
    // 4. Compare specific tank data
    if (tankData && viewData && tankData.length > 0 && viewData.length > 0) {
      console.log('\n🔄 Comparing tank vs view data for first tank:');
      const tank = tankData[0];
      const viewTank = viewData.find(v => v.id === tank.id);
      
      if (viewTank) {
        console.log('Tank table data:');
        console.log(`  ID: ${tank.id}`);
        console.log(`  Location: ${tank.location}`);
        console.log(`  Safe Level: ${tank.safe_level}L`);
        console.log(`  Min Level: ${tank.min_level}L`);
        
        console.log('View data:');
        console.log(`  ID: ${viewTank.id}`);
        console.log(`  Location: ${viewTank.location}`);
        console.log(`  Safe Level: ${viewTank.safe_level}L`);
        console.log(`  Current Level: ${viewTank.current_level}L`);
        console.log(`  Percentage: ${viewTank.current_level_percent}%`);
        
        // Calculate what the percentage should be
        if (tank.safe_level && tank.safe_level > 0 && viewTank.current_level) {
          const expectedPercent = Math.round(
            ((viewTank.current_level - (tank.min_level || 0)) / 
             (tank.safe_level - (tank.min_level || 0))) * 100
          );
          console.log(`Expected percentage: ${expectedPercent}%`);
          
          if (viewTank.current_level_percent !== expectedPercent) {
            console.log('❌ MISMATCH: View percentage doesn\'t match expected calculation!');
            console.log('This confirms the view\'s safe_level mapping is broken.');
          }
        }
      }
    }
    
  } catch (error) {
    console.error('💥 Inspection error:', error.message);
  }
}

inspectViewAndData();