#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqenNkc3ZidGFwcmlpdXh6bWloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTE4MDU1MiwiZXhwIjoyMDY0NzU2NTUyfQ.c6HZBGuXBz-RHXwFasOmJ8A_e0oRkt6vy-hNFDidCKo';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Transform function from useTanks.ts
const transformTankData = (rawTank) => ({
  ...rawTank,
  id: rawTank.id,
  location: rawTank.location,
  product_type: rawTank.product,
  safe_level: rawTank.safe_fill,
  min_level: rawTank.min_level,
  group_id: rawTank.group_id,
  group_name: rawTank.group_name,
  subgroup: rawTank.subgroup,
  current_level: rawTank.current_level,
  current_level_percent: rawTank.current_level_percent_display || rawTank.current_level_percent,
  rolling_avg: rawTank.rolling_avg_lpd,
  days_to_min_level: rawTank.days_to_min_level,
  usable_capacity: rawTank.usable_capacity,
  prev_day_used: rawTank.prev_day_used,
  serviced_on: rawTank.serviced_on,
  serviced_by: rawTank.serviced_by,
  address: rawTank.address,
  vehicle: rawTank.vehicle,
  discharge: rawTank.discharge,
  bp_portal: rawTank.bp_portal,
  delivery_window: rawTank.delivery_window,
  afterhours_contact: rawTank.afterhours_contact,
  notes: rawTank.notes,
  latitude: rawTank.latitude,
  longitude: rawTank.longitude,
  last_dip: (rawTank.last_dip_ts && rawTank.current_level != null) 
    ? { 
        value: rawTank.current_level, 
        created_at: rawTank.last_dip_ts, 
        recorded_by: 'Unknown' 
      } 
    : null,
});

async function testTransformation() {
  console.log('🧪 Testing tank data transformation...');
  
  try {
    const { data, error } = await supabase
      .from('tanks_with_rolling_avg')
      .select('*')
      .eq('subgroup', 'GSFS Narrogin');
    
    if (error) {
      console.error('❌ View error:', error.message);
      return;
    }
    
    console.log(`📊 Found ${data.length} GSFS Narrogin tanks`);
    
    if (data.length > 0) {
      console.log('\n📋 Raw data (first tank):');
      const firstTank = data[0];
      console.log(JSON.stringify(firstTank, null, 2));
      
      console.log('\n🔄 Transformed data:');
      const transformedTank = transformTankData(firstTank);
      console.log(JSON.stringify({
        id: transformedTank.id,
        location: transformedTank.location,
        current_level_percent: transformedTank.current_level_percent,
        safe_level: transformedTank.safe_level,
        current_level: transformedTank.current_level,
        subgroup: transformedTank.subgroup
      }, null, 2));
      
      console.log('\n📊 All GSFS Narrogin tanks summary:');
      data.forEach(tank => {
        const transformed = transformTankData(tank);
        console.log(`  • ${transformed.location}: ${transformed.current_level_percent || 0}% (${transformed.current_level || 0}L/${transformed.safe_level || 0}L)`);
      });
      
      const validPercentages = data.filter(tank => {
        const transformed = transformTankData(tank);
        return transformed.current_level_percent > 0;
      });
      
      console.log(`\n✅ ${validPercentages.length}/${data.length} tanks have valid percentage data`);
      
      if (validPercentages.length === 0) {
        console.log('⚠️ No tanks have percentage data - need to fix current_level values');
      }
    }
    
  } catch (error) {
    console.error('💥 Test error:', error.message);
  }
}

testTransformation();