import { supabase } from '../lib/supabase';

async function createAdamUser() {
  try {
    console.log('Creating user: adam.panetta@gsfs.com.au');
    
    // 1. Create the user account
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: 'adam.panetta@gsfs.com.au',
      password: 'admin',
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

    console.log('✅ User account created successfully!');
    console.log('User ID:', authData.user.id);

    // 2. Get the group IDs for Swan Transit and BGC
    const { data: groups, error: groupsError } = await supabase
      .from('tank_groups')
      .select('id, name')
      .in('name', ['Swan Transit', 'BGC']);

    if (groupsError) {
      throw new Error(`Failed to fetch groups: ${groupsError.message}`);
    }

    if (!groups || groups.length !== 2) {
      const foundGroups = groups?.map(g => g.name) || [];
      console.log('Found groups:', foundGroups);
      throw new Error(`Expected 2 groups (Swan Transit, BGC), found ${groups?.length || 0}`);
    }

    console.log('✅ Found groups:', groups.map(g => g.name));

    // 3. Create user role entries for each group
    const userRoles = groups.map(group => ({
      user_id: authData.user.id,
      role: 'admin',
      group_id: group.id
    }));

    const { error: rolesError } = await supabase
      .from('user_roles')
      .insert(userRoles);

    if (rolesError) {
      throw new Error(`Failed to create user roles: ${rolesError.message}`);
    }

    console.log('✅ User roles created successfully!');
    console.log('Roles created:', userRoles.length);
    
    console.log('\n📋 Login Details:');
    console.log('Email: adam.panetta@gsfs.com.au');
    console.log('Password: admin');
    console.log('\n🔐 Access granted to:');
    console.log('- Swan Transit depot');
    console.log('- BGC depot');
    
    console.log('\n🎉 User creation completed successfully!');
    
  } catch (error) {
    console.error('❌ Error creating user:', error);
    process.exit(1);
  }
}

createAdamUser().catch(console.error); 