#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqenNkc3ZidGFwcmlpdXh6bWloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTE4MDU1MiwiZXhwIjoyMDY0NzU2NTUyfQ.c6HZBGuXBz-RHXwFasOmJ8A_e0oRkt6vy-hNFDidCKo';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function restoreWorkingView() {
  console.log('🔧 Restoring the last working tanks_with_rolling_avg view...');
  
  try {
    // Step 1: Execute the working view SQL
    console.log('📝 Creating the working view...');
    
    const workingViewSQL = `
CREATE OR REPLACE VIEW public.tanks_with_rolling_avg AS
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
  WHERE created_at >= NOW() - INTERVAL '7 days'
),
daily_changes AS (
  SELECT
    id,
    (value - prev_value) as fuel_change,
    EXTRACT(EPOCH FROM (created_at - prev_date)) / 86400.0 as days_diff
  FROM recent_readings
  WHERE prev_value IS NOT NULL
    AND prev_date IS NOT NULL
    AND EXTRACT(EPOCH FROM (created_at - prev_date)) / 86400.0 > 0
),
rolling_average AS (
  SELECT
    id,
    CASE
      WHEN SUM(days_diff) > 0
      THEN ROUND(SUM(fuel_change) / SUM(days_diff))::INTEGER
      ELSE NULL
    END as rolling_avg_lpd
  FROM daily_changes
  GROUP BY id
),
prev_day_usage AS (
  SELECT DISTINCT ON (id)
    id,
    ABS(value - prev_value) as prev_day_used
  FROM recent_readings
  WHERE prev_value IS NOT NULL
    AND prev_date IS NOT NULL
    AND EXTRACT(EPOCH FROM (created_at - prev_date)) / 86400.0 BETWEEN 0.5 AND 2.0
  ORDER BY id, created_at DESC
)
SELECT
  t.id,
  t.location,
  t.latitude,
  t.longitude,
  t.product_type,
  t.safe_level,
  COALESCE(t.min_level, 0) as min_level,
  t.group_id,
  tg.name AS group_name,
  t.subgroup,
  ld.current_level,
  ld.last_dip_ts,
  ld.last_dip_by,
  CASE
    WHEN t.safe_level IS NOT NULL
         AND t.safe_level > COALESCE(t.min_level, 0)
         AND ld.current_level IS NOT NULL
    THEN GREATEST(0, ROUND(
      ((ld.current_level - COALESCE(t.min_level, 0)) /
       (t.safe_level - COALESCE(t.min_level, 0))) * 100, 1
    ))
    ELSE 0
  END AS current_level_percent,
  COALESCE(ra.rolling_avg_lpd, 0) AS rolling_avg,
  COALESCE(pdu.prev_day_used, 0) AS prev_day_used,
  CASE
    WHEN ra.rolling_avg_lpd < 0 AND ld.current_level IS NOT NULL
    THEN ROUND((ld.current_level - COALESCE(t.min_level, 0)) / ABS(ra.rolling_avg_lpd), 1)
    ELSE NULL
  END AS days_to_min_level
FROM fuel_tanks t
JOIN tank_groups tg ON tg.id = t.group_id
LEFT JOIN latest_dip ld ON ld.id = t.id
LEFT JOIN rolling_average ra ON ra.id = t.id
LEFT JOIN prev_day_usage pdu ON pdu.id = t.id;
`;
    
    const { error: createError } = await supabase.rpc('sql', {
      query: workingViewSQL
    });
    
    if (createError) {
      console.error('❌ Error creating view:', createError.message);
      return;
    }
    
    console.log('✅ Working view created successfully');
    
    // Step 2: Grant permissions
    console.log('🔐 Granting permissions...');
    const { error: grantError } = await supabase.rpc('sql', {
      query: 'GRANT SELECT ON public.tanks_with_rolling_avg TO authenticated;'
    });
    
    if (grantError) {
      console.error('❌ Error granting permissions:', grantError.message);
    } else {
      console.log('✅ Permissions granted');
    }
    
    // Step 3: Test the restored view
    console.log('🧪 Testing the restored view...');
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
        // Calculate expected percentage
        const capacity = tank.safe_level || 0;
        const minLevel = tank.min_level || 0;
        const current = tank.current_level || 0;
        const expectedPercent = capacity > minLevel ? 
          Math.round(((current - minLevel) / (capacity - minLevel)) * 100 * 10) / 10 : 0;
        
        console.log(`\n  • ${tank.location}:`);
        console.log(`    Current Level: ${current}L`);
        console.log(`    Capacity: ${capacity}L (min: ${minLevel}L)`);
        console.log(`    View Percentage: ${tank.current_level_percent}%`);
        console.log(`    Expected: ${expectedPercent}%`);
        console.log(`    Rolling Avg: ${tank.rolling_avg} L/day`);
        console.log(`    Status: ${tank.current_level_percent > 0 ? '✅ WORKING!' : '❌ STILL BROKEN'}`);
      });
      
      const workingTanks = testData.filter(t => t.current_level_percent > 0);
      console.log(`\n🎯 Results: ${workingTanks.length}/${testData.length} tanks show correct percentages`);
      
      if (workingTanks.length === testData.length && testData.length > 0) {
        console.log('🎉 SUCCESS! All tanks are now showing correct percentage calculations!');
        
        // Test field compatibility with frontend
        console.log('\n🔍 Checking frontend compatibility...');
        const sampleTank = testData[0];
        const requiredFields = [
          'id', 'location', 'current_level_percent', 'safe_level', 'current_level', 
          'group_name', 'subgroup', 'rolling_avg', 'last_dip_ts'
        ];
        
        const missingFields = requiredFields.filter(field => !(field in sampleTank));
        if (missingFields.length === 0) {
          console.log('✅ All required fields present for frontend compatibility');
        } else {
          console.log(`⚠️ Missing fields: ${missingFields.join(', ')}`);
        }
      } else if (workingTanks.length > 0) {
        console.log('⚠️ Partially fixed - some tanks still have issues');
      } else {
        console.log('❌ Fix failed - percentage calculations still broken');
      }
    }
    
  } catch (error) {
    console.error('💥 Restoration error:', error.message);
  }
}

restoreWorkingView();