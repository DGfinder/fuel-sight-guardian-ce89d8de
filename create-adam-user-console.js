// Copy and paste this script into the browser console of your running Fuel Sight Guardian application
// Make sure you're logged in as an admin user first

async function createAdamUser() {
  try {
    console.log('🚀 Creating user: adam.panetta@gsfs.com.au');
    
    // 1. Create the user account
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'adam.panetta@gsfs.com.au',
      password: 'admin',
      email_confirm: true,
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
    
    return {
      success: true,
      user: authData.user,
      roles: userRoles
    };
    
  } catch (error) {
    console.error('❌ Error creating user:', error);
    throw error;
  }
}

// Alternative method if admin.createUser doesn't work
async function createAdamUserAlternative() {
  try {
    console.log('🚀 Creating user (alternative method): adam.panetta@gsfs.com.au');
    
    // 1. Create the user account using signUp
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: 'adam.panetta@gsfs.com.au',
      password: 'admin',
      options: {
        emailRedirectTo: undefined,
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
    
    return {
      success: true,
      user: authData.user,
      roles: userRoles
    };
    
  } catch (error) {
    console.error('❌ Error creating user:', error);
    throw error;
  }
}

// Instructions for usage
console.log(`
📝 INSTRUCTIONS:
1. Make sure you're logged into the Fuel Sight Guardian application as an admin user
2. Open the browser console (F12 → Console tab)
3. Copy and paste this entire script
4. Run: createAdamUser() or createAdamUserAlternative() if the first one doesn't work
5. The user will be created with access to both Swan Transit and BGC depots

🔑 Login credentials will be:
Email: adam.panetta@gsfs.com.au
Password: admin
`);

// Export the functions so they can be called
window.createAdamUser = createAdamUser;
window.createAdamUserAlternative = createAdamUserAlternative; 