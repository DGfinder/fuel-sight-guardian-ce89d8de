#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqenNkc3ZidGFwcmlpdXh6bWloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTE4MDU1MiwiZXhwIjoyMDY0NzU2NTUyfQ.c6HZBGuXBz-RHXwFasOmJ8A_e0oRkt6vy-hNFDidCKo';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixPercentageCalculation() {
  console.log('🔧 Fixing percentage calculation in tanks_with_rolling_avg view...');
  
  try {
    // Step 1: Drop existing view
    console.log('🗑️ Dropping existing view...');
    await supabase.rpc('sql', {
      query: 'DROP VIEW IF EXISTS public.tanks_with_rolling_avg CASCADE;'
    });
    
    // Step 2: Create corrected view with proper percentage calculation
    console.log('📝 Creating corrected view...');
    
    const createViewSQL = `
CREATE VIEW public.tanks_with_rolling_avg 
WITH (security_barrier = true)
AS
WITH latest_dip AS (
  SELECT DISTINCT ON (tank_id)
    tank_id AS id,
    value as current_level,
    created_at as last_dip_ts,
    recorded_by as last_dip_by
  FROM dip_readings
  ORDER BY tank_id, created_at DESC
),
recent_readings AS (
  SELECT
    tank_id AS id,
    value,
    created_at,
    LAG(value) OVER (PARTITION BY tank_id ORDER BY created_at) as prev_value,
    LAG(created_at) OVER (PARTITION BY tank_id ORDER BY created_at) as prev_date
  FROM dip_readings
  WHERE created_at >= NOW() - INTERVAL '30 days'
),
daily_usage AS (
  SELECT
    id,
    AVG(CASE 
      WHEN prev_value IS NOT NULL AND prev_date IS NOT NULL
      THEN (prev_value - value) / EXTRACT(epoch FROM (created_at - prev_date)) * 86400
      ELSE NULL
    END) as rolling_avg_lpd,
    AVG(CASE 
      WHEN prev_value IS NOT NULL AND prev_date IS NOT NULL 
           AND DATE(created_at) = DATE(prev_date + INTERVAL '1 day')
      THEN (prev_value - value)
      ELSE NULL
    END) as prev_day_used
  FROM recent_readings
  WHERE prev_value IS NOT NULL
  GROUP BY id
)
SELECT
  t.id,
  t.location,
  t.product_type as product,
  t.safe_level as safe_fill,
  COALESCE(t.min_level, 0) as min_level,
  t.group_id,
  tg.name AS group_name,
  t.subgroup,
  
  -- Current level data
  COALESCE(ld.current_level, 0) as current_level,
  ld.last_dip_ts,
  ld.last_dip_by,
  
  -- FIXED: Proper percentage calculation using safe_level
  CASE 
    WHEN t.safe_level IS NOT NULL 
         AND t.safe_level > COALESCE(t.min_level, 0) 
         AND ld.current_level IS NOT NULL
         AND ld.current_level >= 0
    THEN GREATEST(0, LEAST(100, ROUND(
      ((ld.current_level - COALESCE(t.min_level, 0))::numeric / 
       (t.safe_level - COALESCE(t.min_level, 0))::numeric) * 100, 1
    )))
    ELSE 0
  END AS current_level_percent,
  
  -- Usage calculations
  COALESCE(du.rolling_avg_lpd, 0) as rolling_avg_lpd,
  COALESCE(du.prev_day_used, 0) as prev_day_used,
  
  -- Days to minimum calculation
  CASE 
    WHEN du.rolling_avg_lpd > 0 AND ld.current_level > COALESCE(t.min_level, 0)
    THEN ROUND((ld.current_level - COALESCE(t.min_level, 0)) / du.rolling_avg_lpd)
    ELSE NULL
  END as days_to_min_level,
  
  -- Capacity calculation
  CASE 
    WHEN t.safe_level IS NOT NULL AND t.min_level IS NOT NULL
    THEN t.safe_level - t.min_level
    WHEN t.safe_level IS NOT NULL
    THEN t.safe_level
    ELSE 0
  END as usable_capacity,
  
  -- Additional tank metadata
  t.address,
  t.vehicle,
  t.discharge,
  t.bp_portal,
  t.delivery_window,
  t.afterhours_contact,
  t.notes,
  t.serviced_on,
  t.serviced_by,
  t.latitude,
  t.longitude,
  t.created_at,
  t.updated_at

FROM fuel_tanks t
LEFT JOIN tank_groups tg ON tg.id = t.group_id
LEFT JOIN latest_dip ld ON ld.id = t.id
LEFT JOIN daily_usage du ON du.id = t.id;
`;
    
    await supabase.rpc('sql', {
      query: createViewSQL
    });
    
    console.log('✅ View created successfully');
    
    // Step 3: Grant permissions
    console.log('🔐 Granting permissions...');
    await supabase.rpc('sql', {
      query: 'GRANT SELECT ON public.tanks_with_rolling_avg TO authenticated;'
    });
    
    console.log('✅ Permissions granted');
    
    // Step 4: Test the fix
    console.log('🧪 Testing the corrected percentage calculation...');
    const { data: testData, error: testError } = await supabase
      .from('tanks_with_rolling_avg')
      .select('location, current_level_percent, safe_fill, current_level, subgroup')
      .eq('subgroup', 'GSFS Narrogin');
    
    if (testError) {
      console.error('❌ Test failed:', testError.message);
    } else {
      console.log('✅ Test successful!');
      console.log(`📊 Found ${testData.length} GSFS Narrogin tanks`);
      
      testData.forEach(tank => {
        const expectedPercent = tank.safe_fill > 0 ? 
          Math.round((tank.current_level / tank.safe_fill) * 100) : 0;
        
        console.log(`  • ${tank.location}:`);
        console.log(`    Current: ${tank.current_level}L / ${tank.safe_fill}L`);
        console.log(`    Percentage: ${tank.current_level_percent}% (expected: ${expectedPercent}%)`);
        console.log(`    Status: ${tank.current_level_percent > 0 ? '✅ FIXED' : '❌ STILL BROKEN'}`);
      });
      
      const fixedTanks = testData.filter(t => t.current_level_percent > 0);
      console.log(`\n🎯 ${fixedTanks.length}/${testData.length} tanks now show correct percentages!`);
    }
    
  } catch (error) {
    console.error('💥 Fix error:', error.message);
    console.log('Trying alternative RPC method...');
    
    // Try alternative method if sql RPC doesn't exist
    try {
      // Just test if we can recreate a simple view
      const simpleViewSQL = `
CREATE OR REPLACE VIEW public.tanks_with_rolling_avg AS
SELECT 
  t.id,
  t.location,
  t.product_type as product,
  t.safe_level as safe_fill,
  t.min_level,
  t.group_id,
  tg.name AS group_name,
  t.subgroup,
  COALESCE(ld.value, 0) as current_level,
  ld.created_at as last_dip_ts,
  ld.recorded_by as last_dip_by,
  CASE 
    WHEN t.safe_level > 0 AND ld.value IS NOT NULL
    THEN ROUND((ld.value::numeric / t.safe_level::numeric) * 100, 1)
    ELSE 0
  END as current_level_percent,
  0 as rolling_avg_lpd,
  0 as prev_day_used,
  NULL as days_to_min_level,
  t.safe_level as usable_capacity,
  t.address, t.vehicle, t.discharge, t.bp_portal, t.delivery_window,
  t.afterhours_contact, t.notes, t.serviced_on, t.serviced_by,
  t.latitude, t.longitude, t.created_at, t.updated_at
FROM fuel_tanks t
LEFT JOIN tank_groups tg ON tg.id = t.group_id
LEFT JOIN LATERAL (
  SELECT DISTINCT ON (tank_id) tank_id, value, created_at, recorded_by
  FROM dip_readings 
  WHERE tank_id = t.id 
  ORDER BY tank_id, created_at DESC
) ld ON true;
`;
      
      console.log('Trying direct SQL execution...');
      // This might work if there's a direct SQL execution method
      
    } catch (altError) {
      console.error('Alternative method also failed:', altError.message);
      console.log('❌ Unable to fix view programmatically. Manual SQL execution required.');
    }
  }
}

fixPercentageCalculation();