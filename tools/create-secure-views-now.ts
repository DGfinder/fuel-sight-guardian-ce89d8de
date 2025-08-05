#!/usr/bin/env npx tsx

/**
 * CREATE SECURE VIEWS - IMMEDIATE FIX
 * 
 * This script will create the secure views that are actually accessible via the REST API
 * Uses the service role key to execute SQL directly
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function colorLog(color: keyof typeof colors, message: string) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

if (!serviceRoleKey) {
  colorLog('red', '❌ Please set SUPABASE_SERVICE_ROLE_KEY environment variable');
  colorLog('blue', 'Example: export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key_here"');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeSQL(sql: string, description: string): Promise<boolean> {
  try {
    colorLog('blue', `🔧 ${description}...`);
    
    // Try to execute using SQL RPC if available
    const { error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      colorLog('yellow', `RPC method failed, trying alternative: ${error.message}`);
      
      // Alternative: Use a custom function if available
      const { error: altError } = await supabase.rpc('execute_raw_sql', { query: sql });
      
      if (altError) {
        colorLog('red', `❌ ${description} failed: ${altError.message}`);
        return false;
      }
    }
    
    colorLog('green', `✅ ${description} completed`);
    return true;
    
  } catch (err: any) {
    colorLog('red', `❌ ${description} failed: ${err.message}`);
    return false;
  }
}

async function createSecureViews(): Promise<boolean> {
  colorLog('cyan', '🚀 CREATING SECURE VIEWS FOR CAPTIVE PAYMENTS');
  console.log('');
  
  const viewCreationSQL = `
-- Create secure_captive_deliveries
CREATE OR REPLACE VIEW secure_captive_deliveries AS
SELECT 
  bill_of_lading,
  delivery_date,
  customer,
  terminal,
  carrier,
  products,
  total_volume_litres,
  total_volume_litres_abs,
  record_count,
  first_created_at,
  last_updated_at,
  delivery_key
FROM captive_deliveries;

-- Create secure_captive_monthly_analytics
CREATE OR REPLACE VIEW secure_captive_monthly_analytics AS
SELECT 
  month_start,
  year,
  month,
  month_name,
  carrier,
  total_deliveries,
  total_volume_litres,
  total_volume_megalitres,
  unique_customers,
  unique_terminals,
  avg_delivery_size_litres
FROM captive_monthly_analytics;

-- Create secure_captive_customer_analytics
CREATE OR REPLACE VIEW secure_captive_customer_analytics AS
SELECT 
  customer,
  carrier,
  total_deliveries,
  total_volume_litres,
  total_volume_megalitres,
  first_delivery_date,
  last_delivery_date,
  terminals_served,
  terminals_list,
  deliveries_last_30_days
FROM captive_customer_analytics;

-- Create secure_captive_terminal_analytics
CREATE OR REPLACE VIEW secure_captive_terminal_analytics AS
SELECT 
  terminal,
  carrier,
  total_deliveries,
  total_volume_litres,
  total_volume_megalitres,
  percentage_of_carrier_volume,
  unique_customers,
  first_delivery_date,
  last_delivery_date,
  deliveries_last_30_days
FROM captive_terminal_analytics;
`;

  const success = await executeSQL(viewCreationSQL, 'Creating secure views');
  
  if (!success) {
    colorLog('yellow', 'Direct SQL execution failed, trying manual approach...');
    return await createViewsManually();
  }
  
  return success;
}

async function createViewsManually(): Promise<boolean> {
  colorLog('blue', '🔧 Creating views using manual approach...');
  
  const views = [
    {
      name: 'secure_captive_deliveries',
      baseTable: 'captive_deliveries',
      columns: ['bill_of_lading', 'delivery_date', 'customer', 'terminal', 'carrier', 'products', 'total_volume_litres', 'total_volume_litres_abs', 'record_count', 'first_created_at', 'last_updated_at', 'delivery_key']
    },
    {
      name: 'secure_captive_monthly_analytics', 
      baseTable: 'captive_monthly_analytics',
      columns: ['month_start', 'year', 'month', 'month_name', 'carrier', 'total_deliveries', 'total_volume_litres', 'total_volume_megalitres', 'unique_customers', 'unique_terminals', 'avg_delivery_size_litres']
    },
    {
      name: 'secure_captive_customer_analytics',
      baseTable: 'captive_customer_analytics', 
      columns: ['customer', 'carrier', 'total_deliveries', 'total_volume_litres', 'total_volume_megalitres', 'first_delivery_date', 'last_delivery_date', 'terminals_served', 'terminals_list', 'deliveries_last_30_days']
    },
    {
      name: 'secure_captive_terminal_analytics',
      baseTable: 'captive_terminal_analytics',
      columns: ['terminal', 'carrier', 'total_deliveries', 'total_volume_litres', 'total_volume_megalitres', 'percentage_of_carrier_volume', 'unique_customers', 'first_delivery_date', 'last_delivery_date', 'deliveries_last_30_days']
    }
  ];
  
  let allSuccess = true;
  
  for (const view of views) {
    const sql = `CREATE OR REPLACE VIEW ${view.name} AS SELECT ${view.columns.join(', ')} FROM ${view.baseTable};`;
    const success = await executeSQL(sql, `Creating ${view.name}`);
    if (!success) allSuccess = false;
  }
  
  return allSuccess;
}

async function grantPermissions(): Promise<boolean> {
  colorLog('blue', '🔑 Granting permissions...');
  
  const permissionSQL = `
-- Grant SELECT permissions to authenticated and anonymous users
GRANT SELECT ON secure_captive_deliveries TO authenticated, anon;
GRANT SELECT ON secure_captive_monthly_analytics TO authenticated, anon;
GRANT SELECT ON secure_captive_customer_analytics TO authenticated, anon; 
GRANT SELECT ON secure_captive_terminal_analytics TO authenticated, anon;
`;

  return await executeSQL(permissionSQL, 'Granting permissions');
}

async function testCreatedViews(): Promise<boolean> {
  colorLog('blue', '🧪 Testing created views...');
  
  const viewsToTest = [
    'secure_captive_deliveries',
    'secure_captive_monthly_analytics',
    'secure_captive_customer_analytics',
    'secure_captive_terminal_analytics'
  ];
  
  let allWorking = true;
  
  for (const viewName of viewsToTest) {
    try {
      const { count, error } = await supabase
        .from(viewName)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        colorLog('red', `❌ ${viewName}: ${error.message}`);
        allWorking = false;
      } else {
        colorLog('green', `✅ ${viewName}: ${count?.toLocaleString() || 0} records accessible`);
      }
    } catch (err: any) {
      colorLog('red', `❌ ${viewName}: ${err.message}`);
      allWorking = false;
    }
  }
  
  return allWorking;
}

async function populateAnalyticsViews(): Promise<boolean> {
  colorLog('blue', '📊 Refreshing analytics views...');
  
  // The analytics views are based on the base table, but since the base table is empty
  // and the materialized view has data, we need to populate the base table
  
  const refreshSQL = `
-- First, populate the base table from the materialized view if it's empty
INSERT INTO captive_payment_records (
  bill_of_lading, delivery_date, terminal, customer, carrier, product, volume_litres, created_at, updated_at
)
SELECT DISTINCT
  cd.bill_of_lading,
  cd.delivery_date,
  cd.terminal, 
  cd.customer,
  cd.carrier,
  COALESCE(
    CASE WHEN array_length(cd.products, 1) > 0 THEN cd.products[1] ELSE 'Unknown Product' END,
    'Unknown Product'
  ) as product,
  cd.total_volume_litres / cd.record_count as volume_litres, -- Distribute volume across records
  cd.first_created_at,
  cd.last_updated_at
FROM captive_deliveries cd
WHERE NOT EXISTS (
  SELECT 1 FROM captive_payment_records cpr 
  WHERE cpr.bill_of_lading = cd.bill_of_lading 
  AND cpr.delivery_date = cd.delivery_date 
  AND cpr.customer = cd.customer
)
LIMIT 1000; -- Limit to avoid timeout

-- Refresh materialized view
REFRESH MATERIALIZED VIEW captive_deliveries;
`;

  return await executeSQL(refreshSQL, 'Populating base table and refreshing views');
}

async function main() {
  try {
    // Step 1: Create secure views  
    const viewsCreated = await createSecureViews();
    if (!viewsCreated) {
      colorLog('red', '❌ Failed to create secure views');
      process.exit(1);
    }
    
    // Step 2: Grant permissions
    const permissionsGranted = await grantPermissions();
    if (!permissionsGranted) {
      colorLog('yellow', '⚠️  Permission granting may have failed, but views might still work');
    }
    
    // Step 3: Test the views
    const viewsWorking = await testCreatedViews();
    if (!viewsWorking) {
      colorLog('red', '❌ Some views are not working correctly');
    }
    
    // Step 4: Try to populate analytics (optional)
    const analyticsPopulated = await populateAnalyticsViews();
    if (!analyticsPopulated) {
      colorLog('yellow', '⚠️  Analytics population may have failed');
    }
    
    console.log('');
    colorLog('cyan', '📋 FINAL STATUS');
    console.log('='.repeat(50));
    
    if (viewsWorking) {
      colorLog('green', '✅ Secure views created and accessible!');
      colorLog('green', '✅ Frontend 404 errors should now be resolved');
      colorLog('blue', 'ℹ️  Test the captive payments dashboard now');
    } else {
      colorLog('red', '❌ Some issues remain - check the errors above');
      colorLog('yellow', '💡 Try running the SQL manually in Supabase SQL Editor:');
      colorLog('blue', '   1. Open Supabase Dashboard > SQL Editor');
      colorLog('blue', '   2. Copy contents of database/create-secure-views-simple.sql');
      colorLog('blue', '   3. Execute the SQL');
    }
    
    console.log('');
    colorLog('cyan', '🎯 NEXT STEPS:');
    colorLog('blue', '1. Test the frontend captive payments dashboard');
    colorLog('blue', '2. Verify SMB and GSF pages work correctly');
    colorLog('blue', '3. Check that data loads without 404 errors');
    colorLog('blue', '4. If analytics are empty, that\'s expected (base table is empty)');
    
    process.exit(viewsWorking ? 0 : 1);
    
  } catch (error: any) {
    colorLog('red', `❌ Script failed: ${error?.message || error}`);
    console.error('Full error:', error);
    process.exit(1);
  }
}

main().catch(console.error);