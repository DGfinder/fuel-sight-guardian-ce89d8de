// Example Usage: Managing Subgroup Permissions
// This script demonstrates how to use the new subgroup permissions system

import { supabase } from './src/lib/supabase';
import { 
  updateUserSubgroupPermissions, 
  getUserRoles,
  updateUserRoles 
} from './src/scripts/manage-user-roles';

// Example 1: Grant a user access to only the "Narrogin" subgroup in GSF Depots
async function grantNarroginOnlyAccess(userEmail: string) {
  try {
    // First, get the user by email
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserByEmail(userEmail);
    
    if (userError || !user) {
      throw new Error(`User not found: ${userEmail}`);
    }

    // Grant subgroup-level access
    const result = await updateUserSubgroupPermissions(
      user.id,
      'manager', // User role
      [
        {
          groupName: 'GSF Depots',
          subgroups: ['Narrogin'] // Only Narrogin subgroup
        }
      ]
    );

    console.log('✅ Successfully granted Narrogin-only access to:', userEmail);
    console.log('Permissions:', result.subgroupPermissions);
    
    return result;
  } catch (error) {
    console.error('❌ Error granting Narrogin access:', error);
    throw error;
  }
}

// Example 2: Grant a user access to multiple subgroups across different groups
async function grantMultipleSubgroupAccess(userEmail: string) {
  try {
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserByEmail(userEmail);
    
    if (userError || !user) {
      throw new Error(`User not found: ${userEmail}`);
    }

    // Grant access to multiple subgroups
    const result = await updateUserSubgroupPermissions(
      user.id,
      'manager',
      [
        {
          groupName: 'GSF Depots',
          subgroups: ['Narrogin', 'Kalgoorlie'] // Multiple subgroups in GSF Depots
        },
        {
          groupName: 'Swan Transit',
          subgroups: ['Depot A', 'Depot B'] // Multiple subgroups in Swan Transit (if they exist)
        }
      ]
    );

    console.log('✅ Successfully granted multi-subgroup access to:', userEmail);
    console.log('Permissions:', result.subgroupPermissions);
    
    return result;
  } catch (error) {
    console.error('❌ Error granting multi-subgroup access:', error);
    throw error;
  }
}

// Example 3: Upgrade a user from subgroup access to full group access
async function upgradeToFullGroupAccess(userEmail: string) {
  try {
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserByEmail(userEmail);
    
    if (userError || !user) {
      throw new Error(`User not found: ${userEmail}`);
    }

    // Use the regular updateUserRoles function for full group access
    const result = await updateUserRoles(
      user.id,
      'manager',
      ['GSF Depots'] // Full access to entire GSF Depots group
    );

    console.log('✅ Successfully upgraded to full group access:', userEmail);
    console.log('Permissions:', result.groupPermissions);
    
    return result;
  } catch (error) {
    console.error('❌ Error upgrading to full group access:', error);
    throw error;
  }
}

// Example 4: Check what permissions a user currently has
async function checkUserPermissions(userEmail: string) {
  try {
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserByEmail(userEmail);
    
    if (userError || !user) {
      throw new Error(`User not found: ${userEmail}`);
    }

    const permissions = await getUserRoles(user.id);
    
    console.log('👤 User permissions for:', userEmail);
    console.log('Role:', permissions.role);
    console.log('Full group access:', permissions.groups.map(g => g.name));
    console.log('Subgroup access:', permissions.subgroups.map(s => `${s.group.name} > ${s.subgroup}`));
    
    return permissions;
  } catch (error) {
    console.error('❌ Error checking user permissions:', error);
    throw error;
  }
}

// Example 5: List all available subgroups for a specific group
async function listAvailableSubgroups(groupName: string) {
  try {
    // Get the group ID
    const { data: group, error: groupError } = await supabase
      .from('tank_groups')
      .select('id, name')
      .eq('name', groupName)
      .single();

    if (groupError || !group) {
      throw new Error(`Group not found: ${groupName}`);
    }

    // Get all subgroups for this group
    const { data: subgroups, error: subgroupError } = await supabase
      .from('fuel_tanks')
      .select('subgroup')
      .eq('group_id', group.id)
      .not('subgroup', 'is', null);

    if (subgroupError) {
      throw new Error(`Failed to fetch subgroups: ${subgroupError.message}`);
    }

    const uniqueSubgroups = [...new Set(subgroups.map(s => s.subgroup))].sort();
    
    console.log(`📋 Available subgroups in ${groupName}:`, uniqueSubgroups);
    
    return uniqueSubgroups;
  } catch (error) {
    console.error('❌ Error listing subgroups:', error);
    throw error;
  }
}

// Main execution examples
async function main() {
  try {
    console.log('🚀 Subgroup Permissions Management Examples\n');
    
    // Example usage:
    // Uncomment the function calls below to test them
    
    // 1. List available subgroups in GSF Depots
    // await listAvailableSubgroups('GSF Depots');
    
    // 2. Grant Narrogin-only access to a user
    // await grantNarroginOnlyAccess('user@example.com');
    
    // 3. Check user permissions
    // await checkUserPermissions('user@example.com');
    
    // 4. Grant multiple subgroup access
    // await grantMultipleSubgroupAccess('manager@example.com');
    
    // 5. Upgrade to full group access
    // await upgradeToFullGroupAccess('user@example.com');
    
    console.log('\n✅ Examples completed successfully!');
    
  } catch (error) {
    console.error('❌ Example execution failed:', error);
  }
}

// Export functions for use in other scripts
export {
  grantNarroginOnlyAccess,
  grantMultipleSubgroupAccess,
  upgradeToFullGroupAccess,
  checkUserPermissions,
  listAvailableSubgroups
};

// Run examples if this file is executed directly
if (require.main === module) {
  main();
} 