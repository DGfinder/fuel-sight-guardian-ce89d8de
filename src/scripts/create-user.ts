import { supabase } from '@/integrations/supabase/client';

async function createUser() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'hayden@stevemacs.com.au',
    password: 'admin',
    email_confirm: true,
  });

  if (error) {
    console.error('Error creating user:', error.message);
    return;
  }

  console.log('User created successfully:', data);

  // Add user role
  const { error: roleError } = await supabase
    .from('user_roles')
    .insert([
      {
        user_id: data.user.id,
        role: 'admin',
        depot_id: null
      }
    ]);

  if (roleError) {
    console.error('Error adding user role:', roleError.message);
    return;
  }

  console.log('User role added successfully');
}

createUser().catch(console.error); 