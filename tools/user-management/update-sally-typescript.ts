#!/usr/bin/env tsx
/**
 * Update Sally Moore's permissions to GSFS Narrogin only
 * User ID: c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b
 * Email: sally.moore@gsfs.com.au
 */

import { updateUserSubgroupPermissions, getUserRoles } from './src/scripts/manage-user-roles';

async function updateSallyPermissions() {
  const sallyUserId = 'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b';
  const sallyEmail = 'sally.moore@gsfs.com.au';

  console.log('🔄 Updating Sally Moore\'s permissions to GSFS Narrogin only...\n');

  try {
    // Step 1: Check current permissions
    console.log('📋 Current permissions:');
    try {
      const currentPermissions = await getUserRoles(sallyUserId);
      console.log('Role:', currentPermissions.role);
      console.log('Full group access:', currentPermissions.groups.map(g => g.name));
      console.log('Subgroup access:', currentPermissions.subgroups.map(s => `${s.group.name} > ${s.subgroup}`));
    } catch (error) {
      console.log('Could not fetch current permissions:', error);
    }

    console.log('\n🔧 Applying new permissions...');

    // Step 2: Apply GSFS Narrogin-only access
    const result = await updateUserSubgroupPermissions(
      sallyUserId,
      'manager', // Ensure Sally has manager role
      [
        {
          groupName: 'GSF Depots',
          subgroups: ['GSFS Narrogin'] // Only GSFS Narrogin subgroup
        }
      ]
    );

    console.log('✅ Successfully updated Sally\'s permissions!');
    console.log('New permissions:', result.subgroupPermissions);

    // Step 3: Verify the changes
    console.log('\n🔍 Verifying new permissions:');
    const newPermissions = await getUserRoles(sallyUserId);
    console.log('Role:', newPermissions.role);
    console.log('Full group access:', newPermissions.groups.map(g => g.name));
    console.log('Subgroup access:', newPermissions.subgroups.map(s => `${s.group.name} > ${s.subgroup}`));

    console.log('\n🎉 Sally Moore now has access to GSFS Narrogin only!');
    console.log('📧 Email: sally.moore@gsfs.com.au');
    console.log('🆔 User ID: c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b');
    console.log('🏢 Access: GSF Depots > GSFS Narrogin only');

  } catch (error) {
    console.error('❌ Error updating Sally\'s permissions:', error);
    throw error;
  }
}

// Run the update
if (require.main === module) {
  updateSallyPermissions().catch(console.error);
}

export { updateSallyPermissions };