import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * API Route: Consumption History
 *
 * GET: Fetch consumption history with optional date range
 * Supports both AgBot telemetry (ta_agbot_readings) and manual dip tanks (ta_tank_dips)
 *
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

    // Get customer's tanks from unified view (supports all tank types)
    const { data: unifiedTanks, error: unifiedError } = await supabase
      .from('customer_tanks_unified')
      .select('tank_id, tank_name, address, source_type, agbot_location_id, agbot_asset_id, capacity_liters')
      .eq('customer_account_id', customerAccount.id);

    if (unifiedError) {
      return res.status(500).json({ error: unifiedError.message });
    }

    if (!unifiedTanks || unifiedTanks.length === 0) {
      return res.status(200).json({ readings: [], stats: null });
    }

    // If specific tankId requested, verify access
    if (tankId && typeof tankId === 'string') {
      const hasAccess = unifiedTanks.some(t =>
        t.tank_id === tankId || t.agbot_location_id === tankId
      );
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this tank' });
      }
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

    // Separate tanks by source type
    const agbotTanks = unifiedTanks.filter(t => t.source_type === 'agbot' && t.agbot_asset_id);
    const dipTanks = unifiedTanks.filter(t => t.source_type === 'dip' && t.tank_id);

    // Filter by specific tankId if provided
    const filterTankId = tankId && typeof tankId === 'string' ? tankId : null;

    let allReadings: Array<{
      asset_id: string;
      level_percent: number | null;
      reading_at: string;
      is_online: boolean;
      tank_id: string;
      tank_name: string;
      tank_address: string;
    }> = [];

    // Fetch AgBot readings
    if (agbotTanks.length > 0) {
      const assetIds = filterTankId
        ? agbotTanks.filter(t => t.agbot_location_id === filterTankId || t.tank_id === filterTankId).map(t => t.agbot_asset_id)
        : agbotTanks.map(t => t.agbot_asset_id);

      if (assetIds.length > 0) {
        const { data: agbotReadings, error: agbotError } = await supabase
          .from('ta_agbot_readings')
          .select('asset_id, level_percent, reading_at, is_online')
          .in('asset_id', assetIds)
          .gte('reading_at', queryStartDate.toISOString())
          .lte('reading_at', queryEndDate.toISOString())
          .order('reading_at', { ascending: true });

        if (agbotError) {
          console.error('AgBot readings error:', agbotError);
        } else if (agbotReadings) {
          const enriched = agbotReadings.map(reading => {
            const tank = agbotTanks.find(t => t.agbot_asset_id === reading.asset_id);
            return {
              ...reading,
              tank_id: tank?.agbot_location_id || tank?.tank_id || '',
              tank_name: tank?.tank_name || '',
              tank_address: tank?.address || '',
            };
          });
          allReadings.push(...enriched);
        }
      }
    }

    // Fetch Dip readings from ta_tank_dips
    if (dipTanks.length > 0) {
      const dipTankIds = filterTankId
        ? dipTanks.filter(t => t.tank_id === filterTankId).map(t => t.tank_id)
        : dipTanks.map(t => t.tank_id);

      if (dipTankIds.length > 0) {
        const { data: dipReadings, error: dipError } = await supabase
          .from('ta_tank_dips')
          .select('tank_id, level_percent, measured_at, level_liters')
          .in('tank_id', dipTankIds)
          .gte('measured_at', queryStartDate.toISOString())
          .lte('measured_at', queryEndDate.toISOString())
          .order('measured_at', { ascending: true });

        if (dipError) {
          console.error('Dip readings error:', dipError);
        } else if (dipReadings) {
          const enriched = dipReadings.map(reading => {
            const tank = dipTanks.find(t => t.tank_id === reading.tank_id);
            // Calculate level_percent from litres if not provided
            let levelPercent = reading.level_percent;
            if (levelPercent === null && reading.level_liters != null && tank?.capacity_liters) {
              levelPercent = (reading.level_liters / Number(tank.capacity_liters)) * 100;
            }
            return {
              asset_id: reading.tank_id, // Use tank_id as asset_id for consistency
              level_percent: levelPercent,
              reading_at: reading.measured_at,
              is_online: true, // Dip tanks don't have online status
              tank_id: reading.tank_id,
              tank_name: tank?.tank_name || '',
              tank_address: tank?.address || '',
            };
          });
          allReadings.push(...enriched);
        }
      }
    }

    // Sort all readings by date
    allReadings.sort((a, b) => new Date(a.reading_at).getTime() - new Date(b.reading_at).getTime());

    // Calculate statistics if requested
    let stats = null;
    if (includeStats === 'true' && allReadings.length > 0) {
      const levels = allReadings.map((r) => r.level_percent).filter((l): l is number => l !== null);

      if (levels.length > 0) {
        // Calculate consumption (change in level over time)
        const consumptionData: number[] = [];
        for (let i = 1; i < allReadings.length; i++) {
          const prev = allReadings[i - 1].level_percent;
          const curr = allReadings[i].level_percent;
          if (prev !== null && curr !== null && prev > curr) {
            consumptionData.push(prev - curr);
          }
        }

        stats = {
          total_readings: allReadings.length,
          avg_level: levels.reduce((a, b) => a + b, 0) / levels.length,
          min_level: Math.min(...levels),
          max_level: Math.max(...levels),
          current_level: allReadings[allReadings.length - 1].level_percent,
          level_change: allReadings.length > 1
            ? (allReadings[allReadings.length - 1].level_percent ?? 0) - (allReadings[0].level_percent ?? 0)
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
      readings: allReadings,
      stats,
    });
  } catch (error) {
    console.error('Consumption history API error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    });
  }
}
