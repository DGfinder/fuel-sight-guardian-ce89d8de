import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * API Route: Consumption History
 *
 * GET: Fetch consumption history with optional date range
 * Query params:
 *   - tankId (optional): specific tank, or all tanks if omitted
 *   - startDate (optional): ISO date string
 *   - endDate (optional): ISO date string
 *   - days (optional): number of days to fetch (default 7)
 *   - includeStats (optional): boolean to include statistics
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    const { tankId, startDate, endDate, days, includeStats } = req.query;

    // Get customer's tank IDs
    const { data: tankAccess, error: accessError } = await supabase
      .from('customer_tank_access')
      .select('agbot_location_id')
      .eq('customer_account_id', customerAccount.id);

    if (accessError) {
      return res.status(500).json({ error: accessError.message });
    }

    const allowedTankIds = tankAccess.map((access) => access.agbot_location_id);

    if (allowedTankIds.length === 0) {
      return res.status(200).json({ readings: [], stats: null });
    }

    // Verify tankId if provided
    if (tankId && typeof tankId === 'string' && !allowedTankIds.includes(tankId)) {
      return res.status(403).json({ error: 'Access denied to this tank' });
    }

    // Calculate date range
    let queryStartDate: Date;
    let queryEndDate: Date = new Date();

    if (startDate && typeof startDate === 'string') {
      queryStartDate = new Date(startDate);
    } else if (days && typeof days === 'string') {
      queryStartDate = new Date();
      queryStartDate.setDate(queryStartDate.getDate() - parseInt(days, 10));
    } else {
      queryStartDate = new Date();
      queryStartDate.setDate(queryStartDate.getDate() - 7); // Default 7 days
    }

    if (endDate && typeof endDate === 'string') {
      queryEndDate = new Date(endDate);
    }

    // Fetch tank locations with assets
    const { data: tanks, error: tanksError } = await supabase
      .from('ta_agbot_locations')
      .select(`
        id,
        name,
        address,
        ta_agbot_assets (
          id,
          serial_number
        )
      `)
      .in('id', tankId && typeof tankId === 'string' ? [tankId] : allowedTankIds);

    if (tanksError) {
      return res.status(500).json({ error: tanksError.message });
    }

    // Get asset IDs
    const assetIds = tanks
      .map((tank) => {
        const assets = Array.isArray(tank.ta_agbot_assets) ? tank.ta_agbot_assets : [];
        return assets[0]?.id;
      })
      .filter(Boolean);

    if (assetIds.length === 0) {
      return res.status(200).json({ readings: [], stats: null });
    }

    // Fetch readings
    const { data: readings, error: readingsError } = await supabase
      .from('ta_agbot_readings')
      .select('asset_id, level_percent, reading_at, is_online')
      .in('asset_id', assetIds)
      .gte('reading_at', queryStartDate.toISOString())
      .lte('reading_at', queryEndDate.toISOString())
      .order('reading_at', { ascending: true });

    if (readingsError) {
      return res.status(500).json({ error: readingsError.message });
    }

    // Map readings with tank info
    const enrichedReadings = readings.map((reading) => {
      const tank = tanks.find((t) => {
        const assets = Array.isArray(t.ta_agbot_assets) ? t.ta_agbot_assets : [];
        return assets[0]?.id === reading.asset_id;
      });

      return {
        ...reading,
        tank_id: tank?.id,
        tank_name: tank?.name,
        tank_address: tank?.address,
      };
    });

    // Calculate statistics if requested
    let stats = null;
    if (includeStats === 'true' && readings.length > 0) {
      const levels = readings.map((r) => r.level_percent).filter((l) => l !== null);

      if (levels.length > 0) {
        // Calculate consumption (change in level over time)
        const consumptionData: number[] = [];
        for (let i = 1; i < readings.length; i++) {
          const prev = readings[i - 1].level_percent;
          const curr = readings[i].level_percent;
          if (prev !== null && curr !== null && prev > curr) {
            consumptionData.push(prev - curr);
          }
        }

        stats = {
          total_readings: readings.length,
          avg_level: levels.reduce((a, b) => a + b, 0) / levels.length,
          min_level: Math.min(...levels),
          max_level: Math.max(...levels),
          current_level: readings[readings.length - 1].level_percent,
          level_change: readings.length > 1
            ? (readings[readings.length - 1].level_percent ?? 0) - (readings[0].level_percent ?? 0)
            : 0,
          avg_daily_consumption: consumptionData.length > 0
            ? consumptionData.reduce((a, b) => a + b, 0) / consumptionData.length
            : 0,
          date_range: {
            start: queryStartDate.toISOString(),
            end: queryEndDate.toISOString(),
          },
        };
      }
    }

    return res.status(200).json({
      readings: enrichedReadings,
      stats,
    });
  } catch (error) {
    console.error('Consumption history API error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    });
  }
}
