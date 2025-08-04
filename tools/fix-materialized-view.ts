#!/usr/bin/env tsx

/**
 * Fix Materialized View Script
 * 
 * This script fixes the captive_deliveries materialized view by handling duplicate keys
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ Please set SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixMaterializedView() {
  console.log('🔧 Fixing captive_deliveries materialized view...');
  
  try {
    // Drop existing materialized view and recreate without unique constraint
    console.log('   📝 Dropping existing materialized view...');
    
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: `
        DROP MATERIALIZED VIEW IF EXISTS captive_deliveries CASCADE;
        
        -- Recreate with ROW_NUMBER to handle duplicates
        CREATE MATERIALIZED VIEW captive_deliveries AS
        SELECT 
          -- Delivery identification
          bill_of_lading,
          delivery_date,
          customer,
          terminal,
          carrier,
          
          -- Aggregated data
          array_agg(DISTINCT product ORDER BY product) as products,
          sum(volume_litres) as total_volume_litres,
          abs(sum(volume_litres)) as total_volume_litres_abs,
          count(*) as record_count,
          
          -- Metadata
          min(created_at) as first_created_at,
          max(updated_at) as last_updated_at,
          
          -- Unique delivery key for joins with row number to handle duplicates
          bill_of_lading || '-' || delivery_date || '-' || customer || '-' || 
          ROW_NUMBER() OVER (PARTITION BY bill_of_lading, delivery_date, customer ORDER BY min(created_at)) as delivery_key
          
        FROM captive_payment_records 
        GROUP BY bill_of_lading, delivery_date, customer, terminal, carrier
        ORDER BY delivery_date DESC, bill_of_lading;
        
        -- Create non-unique indexes
        CREATE INDEX idx_captive_deliveries_date ON captive_deliveries (delivery_date DESC);
        CREATE INDEX idx_captive_deliveries_carrier ON captive_deliveries (carrier);
        CREATE INDEX idx_captive_deliveries_customer ON captive_deliveries (customer);
        CREATE INDEX idx_captive_deliveries_terminal ON captive_deliveries (terminal);
      `
    });
    
    if (dropError) {
      console.error('❌ SQL execution failed:', dropError);
      // Try direct approach
      await directApproach();
      return;
    }
    
    console.log('   ✅ Materialized view recreated successfully');
    await getStats();
    
  } catch (error) {
    console.error('❌ Error fixing materialized view:', error);
    await directApproach();
  }
}

async function directApproach() {
  console.log('   🔄 Trying direct materialized view refresh...');
  
  try {
    // Just refresh the existing view
    const { error } = await supabase.rpc('refresh_captive_analytics'); 
    
    if (error) {
      console.error('   ❌ Direct refresh failed:', error.message);
      // Let's check what data we have
      await checkDataStatus();
    } else {
      console.log('   ✅ Direct refresh successful');
      await getStats();
    }
  } catch (error) {
    console.error('   ❌ Direct refresh error:', error);
    await checkDataStatus();
  }
}

async function checkDataStatus() {
  console.log('   📊 Checking current data status...');
  
  try {
    // Check captive_payment_records
    const { count: recordsCount } = await supabase
      .from('captive_payment_records')
      .select('*', { count: 'exact', head: true });
    
    console.log(`   📋 Payment Records: ${recordsCount || 0}`);
    
    // Check for duplicates that might cause unique constraint issues
    const { data: duplicates } = await supabase
      .from('captive_payment_records')
      .select('bill_of_lading, delivery_date, customer, count(*)')
      .groupBy('bill_of_lading, delivery_date, customer')
      .having('count(*) > 1')
      .limit(5);
    
    if (duplicates && duplicates.length > 0) {
      console.log(`   ⚠️  Found ${duplicates.length} potential duplicate delivery groups`);
      console.log('   📋 Sample duplicates:', duplicates);
    }
    
    // Try to query captive_deliveries view if it exists
    const { count: deliveriesCount, error: viewError } = await supabase
      .from('captive_deliveries')
      .select('*', { count: 'exact', head: true });
    
    if (viewError) {
      console.log('   ❌ Captive deliveries view not accessible:', viewError.message);
    } else {
      console.log(`   🚚 Deliveries View: ${deliveriesCount || 0}`);
    }
    
  } catch (error) {
    console.error('   ❌ Error checking data status:', error);
  }
}

async function getStats() {
  console.log('📈 Final statistics:');
  
  try {
    const { count: totalRecords } = await supabase
      .from('captive_payment_records')
      .select('*', { count: 'exact', head: true });
    
    const { count: smbRecords } = await supabase
      .from('captive_payment_records')
      .select('*', { count: 'exact', head: true })
      .eq('carrier', 'SMB');
    
    const { count: gsfRecords } = await supabase
      .from('captive_payment_records')
      .select('*', { count: 'exact', head: true })
      .eq('carrier', 'GSF');
    
    const { count: deliveries } = await supabase
      .from('captive_deliveries')
      .select('*', { count: 'exact', head: true });
    
    console.log(`   📊 Total Payment Records: ${totalRecords || 0}`);
    console.log(`   📊 SMB Records: ${smbRecords || 0}`);
    console.log(`   📊 GSF Records: ${gsfRecords || 0}`);
    console.log(`   🚚 Unique Deliveries: ${deliveries || 0}`);
    
  } catch (error) {
    console.error('   ❌ Error getting statistics:', error);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixMaterializedView().catch(console.error);
}