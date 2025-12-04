import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * API Route: Tank Thresholds
 *
 * GET: Fetch all tank thresholds for customer
 * POST: Set/update tank threshold override
 * DELETE: Remove threshold override (revert to account defaults)
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
      // Fetch all tank access records with threshold overrides
      const { data: tankAccess, error } = await supabase
        .from('customer_tank_access')
        .select(`
          id,
          agbot_location_id,
          customer_tank_thresholds (
            id,
            critical_threshold_pct,
            warning_threshold_pct,
            notes,
            created_at,
            updated_at
          )
        `)
        .eq('customer_account_id', customerAccount.id);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json(tankAccess);
    } else if (req.method === 'POST') {
      const {
        customer_tank_access_id,
        critical_threshold_pct,
        warning_threshold_pct,
        notes,
      } = req.body;

      if (!customer_tank_access_id) {
        return res.status(400).json({ error: 'customer_tank_access_id is required' });
      }

      // Verify customer owns this tank access
      const { data: tankAccess, error: accessError } = await supabase
        .from('customer_tank_access')
        .select('id')
        .eq('id', customer_tank_access_id)
        .eq('customer_account_id', customerAccount.id)
        .single();

      if (accessError || !tankAccess) {
        return res.status(403).json({ error: 'Access denied to this tank' });
      }

      // Validate thresholds
      if (
        critical_threshold_pct !== null &&
        critical_threshold_pct !== undefined &&
        (critical_threshold_pct < 0 || critical_threshold_pct > 100)
      ) {
        return res.status(400).json({ error: 'Critical threshold must be between 0 and 100' });
      }

      if (
        warning_threshold_pct !== null &&
        warning_threshold_pct !== undefined &&
        (warning_threshold_pct < 0 || warning_threshold_pct > 100)
      ) {
        return res.status(400).json({ error: 'Warning threshold must be between 0 and 100' });
      }

      if (
        critical_threshold_pct !== null &&
        critical_threshold_pct !== undefined &&
        warning_threshold_pct !== null &&
        warning_threshold_pct !== undefined &&
        critical_threshold_pct >= warning_threshold_pct
      ) {
        return res.status(400).json({
          error: 'Critical threshold must be lower than warning threshold',
        });
      }

      // Upsert threshold
      const { data: threshold, error } = await supabase
        .from('customer_tank_thresholds')
        .upsert(
          {
            customer_tank_access_id,
            critical_threshold_pct,
            warning_threshold_pct,
            notes,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'customer_tank_access_id',
          }
        )
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json(threshold);
    } else if (req.method === 'DELETE') {
      const { customer_tank_access_id } = req.query;

      if (!customer_tank_access_id || typeof customer_tank_access_id !== 'string') {
        return res.status(400).json({ error: 'customer_tank_access_id is required' });
      }

      // Verify customer owns this tank access
      const { data: tankAccess, error: accessError } = await supabase
        .from('customer_tank_access')
        .select('id')
        .eq('id', customer_tank_access_id)
        .eq('customer_account_id', customerAccount.id)
        .single();

      if (accessError || !tankAccess) {
        return res.status(403).json({ error: 'Access denied to this tank' });
      }

      // Delete threshold override
      const { error } = await supabase
        .from('customer_tank_thresholds')
        .delete()
        .eq('customer_tank_access_id', customer_tank_access_id);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true, message: 'Threshold override removed' });
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Tank thresholds API error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    });
  }
}
