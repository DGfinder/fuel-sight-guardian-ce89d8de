import { supabase } from '../lib/supabase';

export interface CreateUserRoleParams {
  email: string;
  password: string;
  role: 'admin' | 'swan_transit' | 'gsfs_depots' | 'kalgoorlie';
  groupNames: string[]; // Array of group names (e.g., ['Swan Transit'])
}

export async function createUserWithRole(params: CreateUserRoleParams) {
  const { email, password, role, groupNames } = params;

  try {
    // 1. Create the user account
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: undefined, // Disable email confirmation for admin-created users
      }
    });

    if (authError) {
      throw new Error(`Failed to create user: ${authError.message}`);
    }

    if (!authData.user) {
      throw new Error('User creation failed - no user returned');
    }

    // 2. Get the group IDs for the specified group names
    const { data: groups, error: groupsError } = await supabase
      .from('tank_groups')
      .select('id, name')
      .in('name', groupNames);

    if (groupsError) {
      throw new Error(`Failed to fetch groups: ${groupsError.message}`);
    }

    if (!groups || groups.length !== groupNames.length) {
      const foundGroups = groups?.map(g => g.name) || [];
      const missingGroups = groupNames.filter(name => !foundGroups.includes(name));
      throw new Error(`Groups not found: ${missingGroups.join(', ')}`);
    }

    // 3. Create user role entries for each group
    const userRoles = groups.map(group => ({
      user_id: authData.user.id,
      role,
      group_id: group.id
    }));

    const { error: rolesError } = await supabase
      .from('user_roles')
      .insert(userRoles);

    if (rolesError) {
      throw new Error(`Failed to create user roles: ${rolesError.message}`);
    }

    return {
      success: true,
      user: authData.user,
      roles: userRoles
    };

  } catch (error) {
    console.error('Error creating user with role:', error);
    throw error;
  }
}

export async function updateUserRoles(userId: string, role: string, groupNames: string[]) {
  try {
    // 1. Delete existing roles
    const { error: deleteError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      throw new Error(`Failed to delete existing roles: ${deleteError.message}`);
    }

    // 2. Get group IDs
    const { data: groups, error: groupsError } = await supabase
      .from('tank_groups')
      .select('id, name')
      .in('name', groupNames);

    if (groupsError) {
      throw new Error(`Failed to fetch groups: ${groupsError.message}`);
    }

    // 3. Create new roles
    const userRoles = groups?.map(group => ({
      user_id: userId,
      role,
      group_id: group.id
    })) || [];

    const { error: insertError } = await supabase
      .from('user_roles')
      .insert(userRoles);

    if (insertError) {
      throw new Error(`Failed to create new roles: ${insertError.message}`);
    }

    return { success: true, roles: userRoles };
  } catch (error) {
    console.error('Error updating user roles:', error);
    throw error;
  }
}

export async function getUserRoles(userId: string) {
  const { data, error } = await supabase
    .from('user_roles')
    .select(`
      role,
      group_id,
      tank_groups (
        id,
        name
      )
    `)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to fetch user roles: ${error.message}`);
  }

  return data;
}

// Real-world example usage for your specific scenarios:
/*

// 1. GSF Depots user - Narrogin only
await createUserWithRole({
  email: 'narrogin.manager@gsf.com',
  password: 'SecurePassword123!',
  role: 'gsfs_depots',
  groupNames: ['Narrogin']  // Only sees Narrogin tanks
});

// 2. Kewdale supervisor - Swan Transit + BGC oversight
await createUserWithRole({
  email: 'kewdale.supervisor@company.com', 
  password: 'SecurePassword123!',
  role: 'admin', // or create custom 'kewdale' role
  groupNames: ['Swan Transit', 'BGC']
});

// 3. Single depot specialist
await createUserWithRole({
  email: 'depot.specialist@company.com',
  password: 'SecurePassword123!', 
  role: 'gsfs_depots',
  groupNames: ['Kewdale']  // Just Kewdale depot
});

// 4. Area manager - multiple GSF depots
await createUserWithRole({
  email: 'area.manager@gsf.com',
  password: 'SecurePassword123!',
  role: 'gsfs_depots', 
  groupNames: ['Narrogin', 'Kalgoorlie', 'Geraldton']
});

// 5. Regional supervisor - cross-company oversight
await createUserWithRole({
  email: 'regional.super@company.com',
  password: 'SecurePassword123!',
  role: 'admin',
  groupNames: ['Swan Transit', 'BGC', 'GSF Depots'] // Multiple companies
});

// 6. Swan Transit user - single company access
await createUserWithRole({
  email: 'swan.user@swantransit.com',
  password: 'SecurePassword123!',
  role: 'swan_transit',
  groupNames: ['Swan Transit']
});

// 7. Update existing user permissions (change access)
await updateUserRoles('existing-user-id', 'gsfs_depots', ['Narrogin', 'Kewdale']);

*/