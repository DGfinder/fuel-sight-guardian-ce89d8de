import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Validate password strength
 * Requirements: 8+ chars, uppercase, lowercase, number, special character
 */
function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must include at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must include at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must include at least one number');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must include at least one special character');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * API Route: Create Customer Portal User
 *
 * Creates a Supabase Auth user for a customer account.
 * Requires admin/manager authentication.
 *
 * POST /api/admin/create-customer-user
 * Body: { email, password, customerAccountId, customerName }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, customerAccountId, customerName } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Validate password strength (8+ chars, uppercase, lowercase, number, special)
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'Password does not meet requirements',
        details: passwordValidation.errors
      });
    }

    // Get Supabase credentials (use backend-only environment variables)
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify caller is authenticated as admin/manager
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify the token and get the user
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !callerUser) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    // Check if caller has admin/manager role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUser.id)
      .single();

    if (roleError || !roleData || !['admin', 'manager'].includes(roleData.role)) {
      return res.status(403).json({ error: 'Insufficient permissions. Admin or manager role required.' });
    }

    // Create the auth user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Skip email verification since admin is creating
      user_metadata: {
        account_type: 'customer',
        customer_name: customerName || 'Customer',
      },
    });

    if (createError) {
      console.error('Error creating user:', createError);

      // Handle common errors
      if (createError.message?.includes('already registered')) {
        return res.status(400).json({ error: 'A user with this email already exists' });
      }

      return res.status(400).json({ error: createError.message || 'Failed to create user' });
    }

    if (!newUser?.user) {
      return res.status(500).json({ error: 'User creation failed - no user returned' });
    }

    const userId = newUser.user.id;

    // If customerAccountId provided, link the user to the customer account
    if (customerAccountId) {
      const { error: updateError } = await supabaseAdmin
        .from('customer_accounts')
        .update({
          user_id: userId,
          force_password_change: true, // Customer must change password on first login
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerAccountId);

      if (updateError) {
        console.error('Error linking user to customer account:', updateError);
        // User was created but linking failed - return partial success
        return res.status(200).json({
          success: true,
          userId,
          warning: 'User created but failed to link to customer account',
          linkError: updateError.message,
        });
      }
    }

    return res.status(200).json({
      success: true,
      userId,
      email: newUser.user.email,
      message: customerAccountId
        ? 'User created and linked to customer account'
        : 'User created successfully',
    });

  } catch (error) {
    console.error('Create customer user error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    });
  }
}
