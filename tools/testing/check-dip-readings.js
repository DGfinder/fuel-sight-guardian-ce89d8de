#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqenNkc3ZidGFwcmlpdXh6bWloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTE4MDU1MiwiZXhwIjoyMDY0NzU2NTUyfQ.c6HZBGuXBz-RHXwFasOmJ8A_e0oRkt6vy-hNFDidCKo';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDipReadings() {
  console.log('🔍 Checking dip readings status...');
  
  try {
    // Check total dip readings
    const { count: totalDips } = await supabase
      .from('dip_readings')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Total dip readings in database: ${totalDips}`);
    
    // Check recent dip readings
    const { data: recentDips, error: recentError } = await supabase
      .from('dip_readings')
      .select('tank_id, value, created_at, recorded_by')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (recentError) {
      console.error('❌ Error fetching recent dips:', recentError.message);
    } else {
      console.log(`📈 Most recent ${recentDips.length} dip readings:`);
      recentDips.forEach(dip => {
        console.log(`  • Tank ${dip.tank_id.substring(0, 8)}...: ${dip.value}L on ${dip.created_at} by ${dip.recorded_by}`);
      });
    }
    
    // Check which tanks have readings
    const { data: tanksWithReadings, error: tanksError } = await supabase
      .from('dip_readings')
      .select(`
        tank_id,
        fuel_tanks!inner(location, subgroup),
        value,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (tanksError) {
      console.error('❌ Error fetching tanks with readings:', tanksError.message);
    } else {
      console.log(`🏷️ Tanks with recent readings:`);
      tanksWithReadings.forEach(reading => {
        console.log(`  • ${reading.fuel_tanks.location} (${reading.fuel_tanks.subgroup}): ${reading.value}L`);
      });
    }
    
    // Test the current view with tanks that should have readings
    console.log('\n🧪 Testing view with tanks that have readings...');
    if (tanksWithReadings.length > 0) {
      const tankId = tanksWithReadings[0].tank_id;
      const { data: viewData, error: viewError } = await supabase
        .from('tanks_with_rolling_avg')
        .select('location, current_level, current_level_percent, rolling_avg_lpd, prev_day_used, days_to_min_level')
        .eq('id', tankId)
        .single();
      
      if (viewError) {
        console.error('❌ View test error:', viewError.message);
      } else {
        console.log('✅ View data for tank with readings:');
        console.log(viewData);
        
        if (viewData.current_level === null) {
          console.log('⚠️ View shows null current_level even though dip readings exist');
          console.log('🔧 This suggests the view may need to be recreated');
        }
      }
    }
    
  } catch (error) {
    console.error('💥 Check error:', error.message);
  }
}

checkDipReadings();