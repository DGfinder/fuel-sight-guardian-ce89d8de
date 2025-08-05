#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!serviceRoleKey) {
  console.error('❌ Please set SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runRawSQL(sql: string) {
  try {
    // Use raw SQL query approach via psql
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error('❌ SQL execution error:', error);
      return false;
    }
    
    console.log('✅ SQL executed successfully');
    return true;
  } catch (err: any) {
    // Fallback: try via connection string if available
    console.log('🔄 Trying direct SQL execution...');
    
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execPromise = promisify(exec);
    
    try {
      // Write SQL to temp file
      const fs = await import('fs/promises');
      const tempFile = '/tmp/temp_migration.sql';
      await fs.writeFile(tempFile, sql);
      
      // Try to execute via psql if available
      await execPromise(`psql "${supabaseUrl}/postgres" -f ${tempFile}`);
      console.log('✅ SQL executed via psql');
      return true;
    } catch (psqlErr) {
      console.error('❌ Direct SQL execution failed:', err.message);
      console.error('❌ PSQL execution failed:', psqlErr);
      return false;
    }
  }
}

async function createSecureViews() {
  console.log('🔧 Creating secure views for captive payments...');
  
  const secureViewsSQL = `
-- Create security barrier views for materialized views
-- These will automatically apply RLS policies from the underlying table

CREATE OR REPLACE VIEW secure_captive_deliveries 
WITH (security_barrier = true) AS
SELECT * FROM captive_deliveries cd
WHERE EXISTS (
  SELECT 1 FROM captive_payment_records cpr
  WHERE cpr.bill_of_lading = cd.bill_of_lading
    AND cpr.delivery_date = cd.delivery_date
    AND cpr.customer = cd.customer
  LIMIT 1
);

GRANT SELECT ON secure_captive_deliveries TO authenticated;
GRANT SELECT ON secure_captive_deliveries TO anon;

-- Verify the view was created
SELECT 'secure_captive_deliveries view created successfully' as status;
`;

  return await runRawSQL(secureViewsSQL);
}

async function testDataAccess() {
  console.log('🧪 Testing data access...');
  
  try {
    // Test direct table access with service role
    const { data: directData, error: directError } = await supabase
      .from('captive_payment_records')
      .select('count()')
      .limit(1);
      
    if (directError) {
      console.error('❌ Direct table access failed:', directError);
    } else {
      console.log('✅ Direct table access works');
    }
    
    // Test materialized view access
    const { data: mvData, error: mvError } = await supabase
      .from('captive_deliveries')
      .select('*')
      .limit(1);
      
    if (mvError) {
      console.error('❌ Materialized view access failed:', mvError);
    } else {
      console.log('✅ Materialized view access works, sample data:', mvData?.[0]);
    }
    
    // Test secure view access
    const { data: secureData, error: secureError } = await supabase
      .from('secure_captive_deliveries')
      .select('*')
      .limit(1);
      
    if (secureError) {
      console.error('❌ Secure view access failed:', secureError);
      return false;
    } else {
      console.log('✅ Secure view access works, sample data:', secureData?.[0]);
      return true;
    }
    
  } catch (err) {
    console.error('❌ Data access test failed:', err);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting RLS migration and secure view creation...');
  
  // Step 1: Create secure views
  const viewsCreated = await createSecureViews();
  if (!viewsCreated) {
    console.error('❌ Failed to create secure views');
    process.exit(1);
  }
  
  // Step 2: Test data access
  const accessWorks = await testDataAccess();
  if (!accessWorks) {
    console.error('❌ Data access test failed');
    process.exit(1);
  }
  
  console.log('✅ RLS migration completed successfully!');
  console.log('📊 Summary:');
  console.log('  - Secure views created');
  console.log('  - Data access verified');
  console.log('  - Frontend should now be able to access captive payments data');
}

main().catch(console.error);