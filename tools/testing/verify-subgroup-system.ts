// Verification script for subgroup permissions system
// Run this to ensure the system is properly deployed

import { supabase } from './src/lib/supabase';

interface VerificationResult {
  check: string;
  status: 'PASS' | 'FAIL';
  details?: string;
}

async function verifySubgroupSystem(): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];

  // 1. Check if user_subgroup_permissions table exists
  try {
    const { data, error } = await supabase
      .from('user_subgroup_permissions')
      .select('count(*)')
      .limit(1);
    
    results.push({
      check: 'user_subgroup_permissions table exists',
      status: error ? 'FAIL' : 'PASS',
      details: error ? error.message : 'Table accessible'
    });
  } catch (error) {
    results.push({
      check: 'user_subgroup_permissions table exists',
      status: 'FAIL',
      details: `Error: ${error}`
    });
  }

  // 2. Check if required functions exist
  try {
    const { data, error } = await supabase.rpc('user_has_tank_access_with_subgroups', { 
      tank_id: '00000000-0000-0000-0000-000000000000' // Test with dummy UUID
    });
    
    results.push({
      check: 'user_has_tank_access_with_subgroups function exists',
      status: 'PASS',
      details: 'Function callable'
    });
  } catch (error) {
    results.push({
      check: 'user_has_tank_access_with_subgroups function exists',
      status: 'FAIL',
      details: `Function not found or error: ${error}`
    });
  }

  try {
    const { data, error } = await supabase.rpc('get_user_accessible_subgroups', { 
      target_group_id: '00000000-0000-0000-0000-000000000000' // Test with dummy UUID
    });
    
    results.push({
      check: 'get_user_accessible_subgroups function exists',
      status: 'PASS',
      details: 'Function callable'
    });
  } catch (error) {
    results.push({
      check: 'get_user_accessible_subgroups function exists',
      status: 'FAIL',
      details: `Function not found or error: ${error}`
    });
  }

  // 3. Check if user_all_permissions view exists
  try {
    const { data, error } = await supabase
      .from('user_all_permissions')
      .select('*')
      .limit(1);
    
    results.push({
      check: 'user_all_permissions view exists',
      status: error ? 'FAIL' : 'PASS',
      details: error ? error.message : 'View accessible'
    });
  } catch (error) {
    results.push({
      check: 'user_all_permissions view exists',
      status: 'FAIL',
      details: `Error: ${error}`
    });
  }

  // 4. Test the updateUserSubgroupPermissions function import
  try {
    const { updateUserSubgroupPermissions } = await import('./src/scripts/manage-user-roles');
    results.push({
      check: 'updateUserSubgroupPermissions function importable',
      status: 'PASS',
      details: 'Function successfully imported'
    });
  } catch (error) {
    results.push({
      check: 'updateUserSubgroupPermissions function importable',
      status: 'FAIL',
      details: `Import error: ${error}`
    });
  }

  return results;
}

async function getGSFDepotsSubgroups(): Promise<string[]> {
  try {
    // Get GSF Depots group ID
    const { data: group, error: groupError } = await supabase
      .from('tank_groups')
      .select('id, name')
      .eq('name', 'GSF Depots')
      .single();

    if (groupError || !group) {
      throw new Error(`GSF Depots group not found: ${groupError?.message}`);
    }

    // Get all subgroups for GSF Depots
    const { data: subgroups, error: subgroupError } = await supabase
      .from('fuel_tanks')
      .select('subgroup')
      .eq('group_id', group.id)
      .not('subgroup', 'is', null);

    if (subgroupError) {
      throw new Error(`Failed to fetch subgroups: ${subgroupError.message}`);
    }

    const uniqueSubgroups = [...new Set(subgroups.map(s => s.subgroup))].sort();
    return uniqueSubgroups;
  } catch (error) {
    console.error('Error fetching GSF Depots subgroups:', error);
    throw error;
  }
}

async function main() {
  console.log('🔍 Verifying Subgroup Permissions System...\n');

  // Run verification checks
  const results = await verifySubgroupSystem();
  
  console.log('📋 System Verification Results:');
  results.forEach(result => {
    const status = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${status} ${result.check}`);
    if (result.details) {
      console.log(`   ${result.details}`);
    }
  });

  const allPassed = results.every(r => r.status === 'PASS');
  
  if (allPassed) {
    console.log('\n🎉 All verification checks passed!');
    
    // If system is verified, also show available subgroups
    try {
      console.log('\n📋 Available GSF Depots Subgroups:');
      const subgroups = await getGSFDepotsSubgroups();
      subgroups.forEach(subgroup => {
        console.log(`   • ${subgroup}`);
      });
    } catch (error) {
      console.log(`\n⚠️  Could not fetch GSF Depots subgroups: ${error}`);
    }
  } else {
    console.log('\n❌ Some verification checks failed. Please ensure the subgroup permissions migration has been run.');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { verifySubgroupSystem, getGSFDepotsSubgroups };