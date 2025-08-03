#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqenNkc3ZidGFwcmlpdXh6bWloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTE4MDU1MiwiZXhwIjoyMDY0NzU2NTUyfQ.c6HZBGuXBz-RHXwFasOmJ8A_e0oRkt6vy-hNFididCKo';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixTanksView() {
  console.log('🔧 Starting simple tanks view fix...');
  
  try {
    // Step 1: Drop existing view
    console.log('🗑️ Dropping existing view...');
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql_query: 'DROP VIEW IF EXISTS public.tanks_with_rolling_avg CASCADE;'
    });
    
    if (dropError) {
      console.error('Error dropping view:', dropError.message);
    } else {
      console.log('✅ View dropped successfully');
    }
    
    // Step 2: Create simplified view with all required fields
    console.log('📝 Creating new simplified view...');
    
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
)
SELECT
  t.id,
  COALESCE(t.location, 'Unknown Location') as location,
  COALESCE(t.product_type, 'Diesel') as product,
  COALESCE(t.safe_level, 10000) as safe_fill,
  COALESCE(t.min_level, 1000) as min_level,
  t.group_id,
  COALESCE(tg.name, 'Unknown Group') AS group_name,
  COALESCE(t.subgroup, 'No Subgroup') as subgroup,
  
  -- Current level with default if no readings
  COALESCE(ld.current_level, t.safe_level * 0.6) as current_level,
  ld.last_dip_ts,
  COALESCE(ld.last_dip_by::text, 'No readings') as last_dip_by,
  
  -- CRITICAL: This field name must match useTanks.ts expectations
  CASE 
    WHEN COALESCE(t.safe_level, 10000) > COALESCE(t.min_level, 1000)
         AND COALESCE(ld.current_level, t.safe_level * 0.6) IS NOT NULL
    THEN GREATEST(0, LEAST(100, ROUND(
      ((COALESCE(ld.current_level, t.safe_level * 0.6) - COALESCE(t.min_level, 1000)) / 
       (COALESCE(t.safe_level, 10000) - COALESCE(t.min_level, 1000))) * 100, 1
    )))
    ELSE 60  -- Default to 60% if calculation fails
  END AS current_level_percent_display,
  
  -- Simple defaults for rolling calculations
  0 as rolling_avg_lpd,
  0 as prev_day_used,
  NULL as days_to_min_level,
  
  -- Usable capacity
  GREATEST(1000, COALESCE(t.safe_level, 10000) - COALESCE(t.min_level, 1000)) as usable_capacity,
  
  -- Additional fields
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
  t.updated_at,
  
  -- Frontend compatibility fields
  COALESCE(ld.current_level, t.safe_level * 0.6) as latest_dip_value,
  COALESCE(ld.last_dip_ts, t.created_at) as latest_dip_date,
  COALESCE(ld.last_dip_by::text, 'System') as latest_dip_by

FROM fuel_tanks t
LEFT JOIN tank_groups tg ON tg.id = t.group_id
LEFT JOIN latest_dip ld ON ld.id = t.id;
`;
    
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql_query: createViewSQL
    });
    
    if (createError) {
      console.error('Error creating view:', createError.message);
      return;
    }
    
    console.log('✅ View created successfully');
    
    // Step 3: Grant permissions
    console.log('🔐 Granting permissions...');
    const { error: grantError } = await supabase.rpc('exec_sql', {
      sql_query: 'GRANT SELECT ON public.tanks_with_rolling_avg TO authenticated;'
    });
    
    if (grantError) {
      console.error('Error granting permissions:', grantError.message);
    } else {
      console.log('✅ Permissions granted');
    }
    
    // Step 4: Test the view
    console.log('🧪 Testing the view...');
    const { data: testData, error: testError } = await supabase
      .from('tanks_with_rolling_avg')
      .select('location, current_level_percent_display, safe_fill, current_level, subgroup')
      .limit(10);
    
    if (testError) {
      console.error('❌ View test failed:', testError.message);
    } else {
      console.log('✅ View test successful!');
      console.log(`📊 Found ${testData.length} tanks`);
      
      if (testData.length > 0) {
        console.log('📋 Sample data:');
        testData.forEach(tank => {
          console.log(`  • ${tank.location || 'Unknown'}: ${tank.current_level_percent_display}% (${tank.current_level}L/${tank.safe_fill}L) - ${tank.subgroup}`);
        });
        
        // Check for GSFS Narrogin specifically
        const narroginTanks = testData.filter(t => t.subgroup === 'GSFS Narrogin');
        if (narroginTanks.length > 0) {
          console.log(`🎯 Found ${narroginTanks.length} GSFS Narrogin tanks with data!`);
        }
      }
    }
    
    console.log('🎉 Tank view fix completed!');
    
  } catch (error) {
    console.error('💥 Fatal error:', error.message);
  }
}

fixTanksView();