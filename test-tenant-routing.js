/**
 * Test Tenant Routing
 *
 * This script tests that the multi-tenant infrastructure is working correctly.
 * Run this in the browser console after logging in.
 */

console.log('🧪 Testing Multi-Tenant Routing...\n');

// Import the supabase client (this will be the tenant-aware one if flag is enabled)
import { supabase } from './src/lib/supabase';
import { FEATURES } from './src/lib/features';

async function testTenantRouting() {
  console.log('1️⃣ Feature Flag Status:');
  console.log('   USE_TENANT_SCHEMA:', FEATURES.USE_TENANT_SCHEMA);
  console.log('   DEBUG_TENANT_ROUTING:', FEATURES.DEBUG_TENANT_ROUTING);
  console.log('');

  // Check if user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('❌ Not authenticated. Please log in first.');
    return;
  }

  console.log('2️⃣ Authenticated User:');
  console.log('   Email:', user.email);
  console.log('   User ID:', user.id);
  console.log('');

  // Test tenant context if multi-tenant mode is enabled
  if (FEATURES.USE_TENANT_SCHEMA) {
    console.log('3️⃣ Initializing Tenant Context...');
    await supabase.initialize();

    const tenantContext = supabase.getTenantContext();

    if (tenantContext) {
      console.log('✅ Tenant Context Retrieved:');
      console.log('   Company:', tenantContext.companyName);
      console.log('   Schema:', tenantContext.schemaName);
      console.log('   Role:', tenantContext.userRole);
      console.log('   Tenant ID:', tenantContext.tenantId);
      console.log('');
    } else {
      console.warn('⚠️ No tenant context - user may not be assigned to a tenant');
      console.log('');
    }
  } else {
    console.log('3️⃣ Legacy Mode - No tenant routing');
    console.log('   All queries use public schema');
    console.log('');
  }

  // Test a simple query
  console.log('4️⃣ Testing Database Query...');
  const { data: tanks, error: queryError } = await supabase
    .from('ta_tanks')
    .select('id, name')
    .limit(3);

  if (queryError) {
    console.error('❌ Query failed:', queryError);
    return;
  }

  console.log('✅ Query successful!');
  console.log('   Retrieved', tanks?.length || 0, 'tanks');
  if (tanks && tanks.length > 0) {
    console.log('   Sample:', tanks[0].name);
  }
  console.log('');

  console.log('5️⃣ Testing Search Path Function...');
  const { data: schemaName, error: schemaError } = await supabase
    .rpc('get_user_tenant_schema');

  if (schemaError) {
    console.error('❌ Failed to get tenant schema:', schemaError);
  } else {
    console.log('✅ User tenant schema:', schemaName || '(none - not assigned)');
  }
  console.log('');

  console.log('=' .repeat(50));
  console.log('🎉 Multi-Tenant Routing Test Complete!');
  console.log('=' .repeat(50));
}

// Export for manual execution
export { testTenantRouting };
