const { createClient } = require('@supabase/supabase-js');

async function grantLytxPermissions() {
  console.log('🔐 LYTX Permission Granting Tool\n');

  // Check environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('👥 Finding users without LYTX permissions...');
    
    // Get all users
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw usersError;
    
    console.log(`Found ${users.length} users total`);

    // Check which users need analytics permissions
    for (const user of users) {
      console.log(`\n🔍 Checking user: ${user.email} (${user.id})`);
      
      // Check existing analytics permissions
      const { data: existingPerms, error: permsError } = await supabase
        .from('analytics_permissions')
        .select('*')
        .eq('user_id', user.id)
        .eq('permission', 'view_lytx_events');
      
      if (permsError) {
        console.log('  ❌ Error checking permissions:', permsError.message);
        continue;
      }
      
      if (existingPerms && existingPerms.length > 0) {
        console.log('  ✅ Already has view_lytx_events permission');
        continue;
      }
      
      // Grant analytics permission
      const { error: grantError } = await supabase
        .from('analytics_permissions')
        .insert({
          user_id: user.id,
          permission: 'view_lytx_events',
          granted_by: 'system',
          granted_at: new Date().toISOString()
        });
      
      if (grantError) {
        console.log('  ❌ Failed to grant permission:', grantError.message);
        continue;
      }
      
      console.log('  ✅ Granted view_lytx_events permission');
      
      // Check if user has carrier group permissions
      const { data: groupPerms, error: groupError } = await supabase
        .from('user_group_permissions')
        .select('*')
        .eq('user_id', user.id);
      
      if (groupError) {
        console.log('  ⚠️  Could not check group permissions:', groupError.message);
        continue;
      }
      
      if (!groupPerms || groupPerms.length === 0) {
        console.log('  ⚠️  User has no group permissions - may need manual carrier assignment');
        
        // Try to auto-assign based on email domain or other heuristics
        const email = user.email?.toLowerCase() || '';
        let suggestedGroup = null;
        
        if (email.includes('stevemacs') || email.includes('smb')) {
          suggestedGroup = 'SMB Admin';
        } else if (email.includes('gsf') || email.includes('greatsouthern')) {
          suggestedGroup = 'GSF Admin';
        } else {
          suggestedGroup = 'All Carriers'; // Default broad access
        }
        
        // Create a basic group permission
        const { error: groupGrantError } = await supabase
          .from('user_group_permissions')
          .insert({
            user_id: user.id,
            group_name: suggestedGroup,
            role: 'manager',
            granted_at: new Date().toISOString(),
            granted_by: 'system'
          });
        
        if (groupGrantError) {
          console.log(`  ⚠️  Could not auto-assign group '${suggestedGroup}':`, groupGrantError.message);
        } else {
          console.log(`  ✅ Auto-assigned to group: ${suggestedGroup}`);
        }
      } else {
        console.log(`  ✅ Has ${groupPerms.length} group permission(s)`);
      }
    }
    
    console.log('\n🎯 Permission granting complete!');
    console.log('\n📝 Summary:');
    console.log('- Granted view_lytx_events permission to users without it');
    console.log('- Auto-assigned carrier groups where possible');
    console.log('- Users should now be able to access LYTX dashboard');
    
    console.log('\n🔄 Next steps:');
    console.log('1. Have users refresh their browser/clear cache');
    console.log('2. Test the dashboard again');
    console.log('3. Check browser console for debug logs');
    console.log('4. Use the Debug Panel in the dashboard for detailed info');
    
  } catch (error) {
    console.error('❌ Permission granting failed:', error.message);
    process.exit(1);
  }
}

// Run with command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('LYTX Permission Granting Tool');
  console.log('');
  console.log('Usage: node grant-lytx-permissions.js');
  console.log('');
  console.log('This tool will:');
  console.log('1. Find all users in the system');
  console.log('2. Grant view_lytx_events permission to users who don\'t have it');
  console.log('3. Auto-assign carrier group permissions where possible');
  console.log('');
  console.log('Required environment variables:');
  console.log('- SUPABASE_URL');
  console.log('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(0);
}

grantLytxPermissions().catch(console.error);