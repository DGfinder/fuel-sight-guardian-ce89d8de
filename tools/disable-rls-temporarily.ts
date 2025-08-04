#!/usr/bin/env tsx

/**
 * Temporarily disable RLS for testing
 * This allows immediate data access while user management system is being set up
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ Please set SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function temporarilyDisableRLS() {
  console.log('🔓 Temporarily disabling RLS for captive payments data access...');
  
  try {
    // Create a simple query to disable RLS temporarily
    console.log('   📝 Creating temporary access function...');
    
    // First, let's check if we can create a simple bypass function
    const { error: functionError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Create temporary function to allow data access
        CREATE OR REPLACE FUNCTION temp_allow_captive_access()
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          -- Temporarily disable RLS
          ALTER TABLE captive_payment_records DISABLE ROW LEVEL SECURITY;
          RAISE NOTICE 'RLS temporarily disabled for captive_payment_records';
        END;
        $$;
      `
    });
    
    if (functionError) {
      console.log('   📝 Direct approach: Checking table status...');
      
      // Let's try a different approach - direct queries
      console.log('   🔍 Testing direct data access...');
      
      // Use service role to query directly  
      const { count, error: countError } = await supabase
        .from('captive_payment_records')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        console.error('❌ Service role query failed:', countError.message);
        console.log('   💡 The RLS policies may need the user_roles and user_groups tables');
        console.log('   💡 Recommend creating basic user management or temporary access method');
      } else {
        console.log(`   ✅ Service role can access data: ${count} records`);
        
        // Test sample data
        const { data: sampleData, error: sampleError } = await supabase
          .from('captive_payment_records')
          .select('carrier, customer, delivery_date, volume_litres')
          .limit(3);
        
        if (sampleError) {
          console.error('❌ Sample query failed:', sampleError);
        } else {
          console.log('   📋 Sample data accessible:');
          sampleData?.forEach((record, i) => {
            console.log(`     ${i + 1}. ${record.carrier} - ${record.customer} - ${record.delivery_date} - ${record.volume_litres}L`);
          });
        }
      }
    } else {
      console.log('   ✅ Temporary access function created');
    }
    
    console.log('\n🧪 Testing with anon key (frontend simulation)...');
    
    // Test with anon key like frontend does
    const frontendSupabase = createClient(supabaseUrl, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqenNkc3ZidGFwcmlpdXh6bWloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxODA1NTIsImV4cCI6MjA2NDc1NjU1Mn0.XJeTNtWQGIzgKRk4zIKKEAr5PXVjrg6LhKBtjr8LPYg');
    
    const { count: frontendCount, error: frontendError } = await frontendSupabase
      .from('captive_payment_records')
      .select('*', { count: 'exact', head: true });
    
    if (frontendError) {
      console.error('❌ Frontend (anon) access failed:', frontendError.message);
      console.log('   💡 This is expected - RLS is blocking unauthenticated access');
      console.log('   💡 Need to either:');
      console.log('       1. Create user_roles and user_groups tables');
      console.log('       2. Temporarily modify RLS policies');
      console.log('       3. Use authenticated user context');
    } else {
      console.log(`   ✅ Frontend can access data: ${frontendCount} records`);
    }
    
  } catch (error) {
    console.error('❌ RLS modification failed:', error);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  temporarilyDisableRLS().catch(console.error);
}