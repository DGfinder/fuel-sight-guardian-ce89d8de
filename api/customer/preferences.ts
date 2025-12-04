import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * API Route: Customer Preferences
 *
 * GET: Fetch customer's preferences (creates default if not exists)
 * PUT: Update customer's preferences
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Get Supabase credentials
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Missing Supabase configuration' });
  }

  // Create Supabase client with user's auth token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid authentication token' });
  }

  // Get customer account
  const { data: customerAccount, error: accountError } = await supabase
    .from('customer_accounts')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (accountError || !customerAccount) {
    return res.status(404).json({ error: 'Customer account not found' });
  }

  try {
    if (req.method === 'GET') {
      // Fetch preferences (create if doesn't exist)
      let { data: preferences, error } = await supabase
        .from('customer_account_preferences')
        .select('*')
        .eq('customer_account_id', customerAccount.id)
        .maybeSingle();

      // If no preferences exist, create default
      if (!preferences && !error) {
        const { data: newPreferences, error: createError } = await supabase
          .from('customer_account_preferences')
          .insert({
            customer_account_id: customerAccount.id,
          })
          .select()
          .single();

        if (createError) {
          return res.status(500).json({ error: 'Failed to create preferences' });
        }

        preferences = newPreferences;
      } else if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json(preferences);
    } else if (req.method === 'PUT') {
      const {
        default_critical_threshold_pct,
        default_warning_threshold_pct,
        delivery_notification_email,
        enable_low_fuel_alerts,
        enable_delivery_confirmations,
        default_chart_days,
      } = req.body;

      // Validate thresholds
      if (
        default_critical_threshold_pct !== undefined &&
        (default_critical_threshold_pct < 0 || default_critical_threshold_pct > 100)
      ) {
        return res.status(400).json({ error: 'Critical threshold must be between 0 and 100' });
      }

      if (
        default_warning_threshold_pct !== undefined &&
        (default_warning_threshold_pct < 0 || default_warning_threshold_pct > 100)
      ) {
        return res.status(400).json({ error: 'Warning threshold must be between 0 and 100' });
      }

      if (
        default_critical_threshold_pct !== undefined &&
        default_warning_threshold_pct !== undefined &&
        default_critical_threshold_pct >= default_warning_threshold_pct
      ) {
        return res.status(400).json({
          error: 'Critical threshold must be lower than warning threshold',
        });
      }

      // Validate chart days
      if (
        default_chart_days !== undefined &&
        ![7, 14, 30, 90].includes(default_chart_days)
      ) {
        return res.status(400).json({ error: 'Chart days must be 7, 14, 30, or 90' });
      }

      // Upsert preferences
      const { data: preferences, error } = await supabase
        .from('customer_account_preferences')
        .upsert(
          {
            customer_account_id: customerAccount.id,
            default_critical_threshold_pct,
            default_warning_threshold_pct,
            delivery_notification_email,
            enable_low_fuel_alerts,
            enable_delivery_confirmations,
            default_chart_days,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'customer_account_id',
          }
        )
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json(preferences);
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Preferences API error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    });
  }
}
