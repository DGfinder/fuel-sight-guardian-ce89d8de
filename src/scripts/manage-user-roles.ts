import { supabase } from '../lib/supabase';

export interface CreateUserRoleParams {
  email: string;
  role: 'admin' | 'manager' | 'swan_transit' | 'gsfs_depots' | 'kalgoorlie';
  groupNames: string[]; // Array of group names (e.g., ['Swan Transit'])
}

export async function createUserWithRole(params: CreateUserRoleParams) {
  const { email, role, groupNames } = params;
  const password = process.env.VITE_DEFAULT_USER_PASSWORD;
  if (!password) {
    throw new Error('VITE_DEFAULT_USER_PASSWORD environment variable is not set.');
  }

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

    // 3. Create user role entry (single role per user)
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role
      });

    if (roleError) {
      throw new Error(`Failed to create user role: ${roleError.message}`);
    }

    // 4. Create user group permissions (separate table)
    const groupPermissions = groups.map(group => ({
      user_id: authData.user.id,
      group_id: group.id
    }));

    const { error: permissionsError } = await supabase
      .from('user_group_permissions')
      .insert(groupPermissions);

    if (permissionsError) {
      throw new Error(`Failed to create user group permissions: ${permissionsError.message}`);
    }

    return {
      success: true,
      user: authData.user,
      role,
      groupPermissions
    };

  } catch (error) {
    console.error('Error creating user with role:', error);
    throw error;
  }
}

export async function updateUserRoles(userId: string, role: string, groupNames: string[]) {
  try {
    // 1. Update the user's role (single role per user)
    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert({
        user_id: userId,
        role
      });

    if (roleError) {
      throw new Error(`Failed to update user role: ${roleError.message}`);
    }

    // 2. Delete existing group permissions
    const { error: deleteError } = await supabase
      .from('user_group_permissions')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      throw new Error(`Failed to delete existing group permissions: ${deleteError.message}`);
    }

    // 3. Get group IDs for new permissions
    const { data: groups, error: groupsError } = await supabase
      .from('tank_groups')
      .select('id, name')
      .in('name', groupNames);

    if (groupsError) {
      throw new Error(`Failed to fetch groups: ${groupsError.message}`);
    }

    // 4. Create new group permissions
    const groupPermissions = groups?.map(group => ({
      user_id: userId,
      group_id: group.id
    })) || [];

    if (groupPermissions.length > 0) {
      const { error: insertError } = await supabase
        .from('user_group_permissions')
        .insert(groupPermissions);

      if (insertError) {
        throw new Error(`Failed to create new group permissions: ${insertError.message}`);
      }
    }

    return { 
      success: true, 
      role,
      groupPermissions 
    };
  } catch (error) {
    console.error('Error updating user roles:', error);
    throw error;
  }
}

export async function getUserRoles(userId: string) {
  try {
    // 1. Get user's role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (roleError && roleError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch user role: ${roleError.message}`);
    }

    // 2. Get user's group permissions
    const { data: groupData, error: groupError } = await supabase
      .from('user_group_permissions')
      .select(`
        group_id,
        tank_groups (
          id,
          name
        )
      `)
      .eq('user_id', userId);

    if (groupError) {
      throw new Error(`Failed to fetch user group permissions: ${groupError.message}`);
    }

    return {
      role: roleData?.role || null,
      groups: groupData?.map(g => g.tank_groups).filter(Boolean) || []
    };
  } catch (error) {
    console.error('Error fetching user roles:', error);
    throw error;
  }
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
  role: 'manager', // or 'admin' for full access
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
  role: 'manager', 
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
await updateUserRoles('existing-user-id', 'manager', ['Narrogin', 'Kewdale']);

*/