// Email Preferences API Endpoint
// Allows users to view and update their email preferences
// URL: /api/email/preferences

import type { VercelRequest, VercelResponse} from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: 'Server configuration error'
    });
  }

  const token = (req.query.token as string) || req.body?.token;

  if (!token) {
    return res.status(400).json({
      error: 'Missing required parameter',
      message: 'Token is required'
    });
  }

  try {
    // GET - Retrieve current preferences
    if (req.method === 'GET') {
      const { data, error } = await supabase.rpc('get_contact_preferences', {
        token
      });

      if (error) {
        console.error('Get preferences error:', error);
        return res.status(500).json({
          error: 'Failed to fetch preferences',
          message: error.message
        });
      }

      const result = data as { success: boolean; message?: string; contact?: any; preferences?: any };

      if (!result.success) {
        return res.status(404).json({
          error: 'Invalid token',
          message: result.message
        });
      }

      return res.status(200).json({
        success: true,
        contact: result.contact,
        preferences: result.preferences
      });
    }

    // POST - Update preferences
    if (req.method === 'POST') {
      const {
        frequency,
        enabled,
        selected_tanks,
        low_fuel_only,
        critical_only
      } = req.body;

      const { data, error } = await supabase.rpc('update_email_preferences', {
        token,
        new_frequency: frequency || null,
        new_enabled: enabled !== undefined ? enabled : null,
        selected_tank_ids: selected_tanks || null,
        low_fuel_only: low_fuel_only !== undefined ? low_fuel_only : null,
        critical_only: critical_only !== undefined ? critical_only : null
      });

      if (error) {
        console.error('Update preferences error:', error);
        return res.status(500).json({
          error: 'Failed to update preferences',
          message: error.message
        });
      }

      const result = data as { success: boolean; message: string };

      if (!result.success) {
        return res.status(400).json({
          error: 'Update failed',
          message: result.message
        });
      }

      return res.status(200).json({
        success: true,
        message: result.message
      });
    }

    return res.status(405).json({
      error: 'Method not allowed',
      expected: 'GET or POST'
    });
  } catch (error) {
    console.error('Preferences handler error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: (error as Error).message
    });
  }
}
