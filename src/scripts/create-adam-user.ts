import { createUserWithRole } from './manage-user-roles';

async function createAdamUser() {
  try {
    console.log('Creating user: adam.panetta@gsfs.com.au');
    
    const result = await createUserWithRole({
      email: 'adam.panetta@gsfs.com.au',
      password: 'admin',
      role: 'admin', // Using admin role to give access to both depots
      groupNames: ['Swan Transit', 'BGC']
    });

    console.log('✅ User created successfully!');
    console.log('User ID:', result.user.id);
    console.log('Email:', result.user.email);
    console.log('Roles created:', result.roles.length);
    console.log('Access to groups:', result.roles.map(r => r.group_id));
    
    console.log('\n📋 Login Details:');
    console.log('Email: adam.panetta@gsfs.com.au');
    console.log('Password: admin');
    console.log('\n🔐 Access granted to:');
    console.log('- Swan Transit depot');
    console.log('- BGC depot');
    
  } catch (error) {
    console.error('❌ Error creating user:', error);
    process.exit(1);
  }
}

createAdamUser().catch(console.error); 