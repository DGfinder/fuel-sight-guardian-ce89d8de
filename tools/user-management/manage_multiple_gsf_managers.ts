// Practical Script: Managing Multiple GSF Depot Managers
// This script shows how to assign different managers to different subgroups

import { supabase } from './src/lib/supabase';
import { 
  updateUserSubgroupPermissions, 
  getUserRoles 
} from './src/scripts/manage-user-roles';

// First, let's create a function to discover all subgroups in GSF Depots
async function discoverGSFSubgroups() {
  try {
    console.log('📋 Discovering all subgroups in GSF Depots...\n');
    
    // Get GSF Depots group ID
    const { data: group, error: groupError } = await supabase
      .from('tank_groups')
      .select('id, name')
      .eq('name', 'GSF Depots')
      .single();

    if (groupError || !group) {
      throw new Error('GSF Depots group not found');
    }

    // Get all subgroups in GSF Depots
    const { data: tanks, error: tanksError } = await supabase
      .from('fuel_tanks')
      .select('subgroup')
      .eq('group_id', group.id)
      .not('subgroup', 'is', null);

    if (tanksError) {
      throw new Error(`Failed to fetch subgroups: ${tanksError.message}`);
    }

    const uniqueSubgroups = [...new Set(tanks.map(t => t.subgroup))].sort();
    
    console.log(`✅ Found ${uniqueSubgroups.length} subgroups in GSF Depots:`);
    uniqueSubgroups.forEach((subgroup, index) => {
      console.log(`   ${index + 1}. "${subgroup}"`);
    });
    
    return uniqueSubgroups;
  } catch (error) {
    console.error('❌ Error discovering subgroups:', error);
    throw error;
  }
}

// Function to assign a manager to a specific GSF subgroup
async function assignManagerToSubgroup(userEmail: string, subgroupName: string) {
  try {
    console.log(`\n🔐 Assigning ${userEmail} to "${subgroupName}" subgroup...`);
    
    // Get user by email
    const { data: authUsers, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      throw new Error(`Failed to list users: ${userError.message}`);
    }
    
    const user = authUsers.users.find(u => u.email === userEmail);
    if (!user) {
      throw new Error(`User not found: ${userEmail}`);
    }

    // Assign subgroup-level access
    const result = await updateUserSubgroupPermissions(
      user.id,
      'manager', // Keep as manager role
      [
        {
          groupName: 'GSF Depots',
          subgroups: [subgroupName] // Only this specific subgroup
        }
      ]
    );

    console.log(`✅ Successfully assigned ${userEmail} to "${subgroupName}"`);
    console.log(`   - User will only see tanks in the "${subgroupName}" subgroup`);
    console.log(`   - User retains all manager privileges within their subgroup`);
    
    return result;
  } catch (error) {
    console.error(`❌ Error assigning ${userEmail} to ${subgroupName}:`, error);
    throw error;
  }
}

// Function to assign multiple managers to different subgroups at once
async function assignMultipleManagers(assignments: Array<{email: string, subgroup: string}>) {
  try {
    console.log(`\n🚀 Assigning ${assignments.length} managers to their respective subgroups...\n`);
    
    const results: Array<{email: string, subgroup: string, success: boolean, result?: any, error?: string}> = [];
    
    for (const assignment of assignments) {
      try {
        const result = await assignManagerToSubgroup(assignment.email, assignment.subgroup);
        results.push({ ...assignment, success: true, result });
      } catch (error) {
        console.error(`Failed to assign ${assignment.email} to ${assignment.subgroup}:`, error);
        results.push({ ...assignment, success: false, error: error.message });
      }
    }
    
    // Summary
    console.log('\n📊 Assignment Summary:');
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`   ✅ Successful: ${successful}`);
    console.log(`   ❌ Failed: ${failed}`);
    
    if (failed > 0) {
      console.log('\n❌ Failed assignments:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`   - ${r.email} → ${r.subgroup}: ${r.error}`);
      });
    }
    
    return results;
  } catch (error) {
    console.error('❌ Error in bulk assignment:', error);
    throw error;
  }
}

// Function to check what each manager can currently see
async function auditManagerPermissions(managerEmails: string[]) {
  try {
    console.log('\n🔍 Auditing manager permissions...\n');
    
    for (const email of managerEmails) {
      try {
        // Get user by email
        const { data: authUsers, error: userError } = await supabase.auth.admin.listUsers();
        
        if (userError) {
          throw new Error(`Failed to list users: ${userError.message}`);
        }
        
        const user = authUsers.users.find(u => u.email === email);
        if (!user) {
          console.log(`❌ User not found: ${email}`);
          continue;
        }

        // Get their permissions
        const permissions = await getUserRoles(user.id);
        
        console.log(`👤 ${email}:`);
        console.log(`   Role: ${permissions.role}`);
        
        if (permissions.groups && permissions.groups.length > 0) {
          console.log(`   Full group access: ${permissions.groups.map(g => g.name).join(', ')}`);
        }
        
        if (permissions.subgroups && permissions.subgroups.length > 0) {
          console.log(`   Subgroup access: ${permissions.subgroups.map(s => `${s.group.name} > ${s.subgroup}`).join(', ')}`);
        }
        
        if ((!permissions.groups || permissions.groups.length === 0) && 
            (!permissions.subgroups || permissions.subgroups.length === 0)) {
          console.log(`   ⚠️  No permissions assigned`);
        }
        
        console.log('');
      } catch (error) {
        console.log(`❌ Error checking permissions for ${email}:`, error.message);
      }
    }
  } catch (error) {
    console.error('❌ Error in audit:', error);
    throw error;
  }
}

// Example usage scenarios
async function exampleUsage() {
  try {
    console.log('🚀 GSF Depot Manager Assignment Examples\n');
    
    // 1. First, discover what subgroups exist
    const subgroups = await discoverGSFSubgroups();
    
    // 2. Example: Assign individual managers (REPLACE WITH REAL EMAILS AND SUBGROUPS)
    /*
    console.log('\n--- Example Individual Assignments ---');
    await assignManagerToSubgroup('narrogin.manager@gsf.com', 'GSFS Narrogin');
    await assignManagerToSubgroup('kalgoorlie.manager@gsf.com', 'GSFS Kalgoorlie');
    await assignManagerToSubgroup('geraldton.manager@gsf.com', 'GSFS Geraldton');
    */
    
    // 3. Example: Bulk assignment (REPLACE WITH REAL DATA)
    /*
    console.log('\n--- Example Bulk Assignment ---');
    const assignments = [
      { email: 'narrogin.manager@gsf.com', subgroup: 'GSFS Narrogin' },
      { email: 'kalgoorlie.manager@gsf.com', subgroup: 'GSFS Kalgoorlie' },
      { email: 'geraldton.manager@gsf.com', subgroup: 'GSFS Geraldton' },
      { email: 'esperance.manager@gsf.com', subgroup: 'GSFS Esperance' },
      // Add more as needed
    ];
    
    await assignMultipleManagers(assignments);
    */
    
    // 4. Example: Audit current permissions
    /*
    console.log('\n--- Example Permission Audit ---');
    const managerEmails = [
      'narrogin.manager@gsf.com',
      'kalgoorlie.manager@gsf.com',
      'geraldton.manager@gsf.com'
    ];
    
    await auditManagerPermissions(managerEmails);
    */
    
    console.log('\n✅ Discovery completed! Update the examples above with real emails and run individual functions.');
    
  } catch (error) {
    console.error('❌ Example execution failed:', error);
  }
}

// Convenience function to quickly assign a manager (for console use)
async function quickAssign(email: string, subgroup: string) {
  try {
    await assignManagerToSubgroup(email, subgroup);
    console.log(`\n🎯 Quick assignment complete: ${email} → "${subgroup}"`);
  } catch (error) {
    console.error('❌ Quick assignment failed:', error);
  }
}

// Export functions for use
export {
  discoverGSFSubgroups,
  assignManagerToSubgroup,
  assignMultipleManagers,
  auditManagerPermissions,
  quickAssign
};

// Run discovery if this file is executed directly
if (require.main === module) {
  exampleUsage();
} 