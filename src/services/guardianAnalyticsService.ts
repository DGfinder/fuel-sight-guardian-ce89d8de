import { supabase } from '../lib/supabase';

/**
 * Guardian Analytics Service
 * Provides data fetching for Guardian compliance dashboard
 */

export interface CriticalFatigueEvent {
  id: string;
  external_event_id: string;
  vehicle_registration: string;
  detection_time: string;
  event_type: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  duration_seconds: number | null;
  speed_kph: number | null;
  verified: boolean;
  confirmation: string | null;
  fleet: string;

  // Driver correlation
  driver_id: string | null;
  driver_name: string | null;
  correlation_method: string | null;
  confidence: number | null;

  // Primary driver info
  primary_driver_name: string | null;
  assignment_percentage: number | null;
}

export interface ComplianceMetrics {
  distraction: {
    total: number;
    verified: number;
    verificationRate: number;
    trend: number; // % change vs previous period
    driverAttributionRate: number;
  };
  fatigue: {
    total: number;
    verified: number;
    verificationRate: number;
    trend: number;
    driverAttributionRate: number;
    last24h: number; // NEW: count from last 24 hours
  };
}

export interface MonthlyTrend {
  month: string;
  total: number;
  verified: number;
}

export interface FatigueTrend {
  current: number; // last 7 days
  previous: number; // previous 7 days
  change: number; // percentage change
  changeDirection: 'up' | 'down' | 'stable';
}

export class GuardianAnalyticsService {

  /**
   * Get critical fatigue events (fatigue + microsleep)
   */
  async getCriticalFatigueEvents(
    fleet?: 'Stevemacs' | 'Great Southern Fuels',
    hours: number = 168 // 7 days default
  ): Promise<CriticalFatigueEvent[]> {
    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - hours);

      let query = supabase
        .from('guardian_events')
        .select(`
          id,
          external_event_id,
          vehicle_registration,
          detection_time,
          event_type,
          severity,
          duration_seconds,
          speed_kph,
          verified,
          confirmation,
          fleet
        `)
        .gte('detection_time', cutoffTime.toISOString())
        .or('event_type.ilike.%fatigue%,event_type.ilike.%microsleep%')
        .order('detection_time', { ascending: false });

      if (fleet) {
        query = query.eq('fleet', fleet);
      }

      const { data: events, error } = await query;

      if (error) {
        console.error('Error fetching critical fatigue events:', error);
        throw error;
      }

      if (!events || events.length === 0) {
        return [];
      }

      // Get event IDs for correlation lookup
      const eventIds = events.map(e => e.id);

      // Fetch driver correlations
      const { data: correlations } = await supabase
        .from('driver_event_correlation')
        .select('guardian_event_id, driver_id, driver_name, correlation_method, confidence')
        .in('guardian_event_id', eventIds);

      // Fetch primary drivers for vehicles
      const vehicleRegs = [...new Set(events.map(e => e.vehicle_registration.toUpperCase().trim()))];
      const { data: primaryDrivers } = await supabase
        .from('vehicle_primary_drivers')
        .select('vehicle_registration, primary_driver_name, assignment_percentage')
        .in('vehicle_registration', vehicleRegs);

      // Build correlation maps
      const correlationMap = new Map();
      correlations?.forEach(c => {
        correlationMap.set(c.guardian_event_id, c);
      });

      const primaryDriverMap = new Map();
      primaryDrivers?.forEach(pd => {
        primaryDriverMap.set(pd.vehicle_registration, pd);
      });

      // Merge data
      const enrichedEvents: CriticalFatigueEvent[] = events.map(event => {
        const correlation = correlationMap.get(event.id);
        const primaryDriver = primaryDriverMap.get(event.vehicle_registration.toUpperCase().trim());

        return {
          ...event,
          driver_id: correlation?.driver_id || null,
          driver_name: correlation?.driver_name || null,
          correlation_method: correlation?.correlation_method || null,
          confidence: correlation?.confidence || null,
          primary_driver_name: primaryDriver?.primary_driver_name || null,
          assignment_percentage: primaryDriver?.assignment_percentage || null,
        };
      });

      // Sort: 24h events first, then by severity, then by time
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      return enrichedEvents.sort((a, b) => {
        const aIsRecent = new Date(a.detection_time) >= twentyFourHoursAgo;
        const bIsRecent = new Date(b.detection_time) >= twentyFourHoursAgo;

        if (aIsRecent !== bIsRecent) {
          return aIsRecent ? -1 : 1;
        }

        // Sort by severity
        const severityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0) return severityDiff;

        // Finally by time (most recent first)
        return new Date(b.detection_time).getTime() - new Date(a.detection_time).getTime();
      });

    } catch (error) {
      console.error('Error in getCriticalFatigueEvents:', error);
      return [];
    }
  }

  /**
   * Get compliance metrics for KPI cards
   */
  async getComplianceMetrics(
    fleet?: 'Stevemacs' | 'Great Southern Fuels',
    dateRange?: { start: string; end: string }
  ): Promise<ComplianceMetrics> {
    try {
      const now = new Date();
      const defaultStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      const start = dateRange?.start || defaultStart.toISOString();
      const end = dateRange?.end || now.toISOString();

      // Calculate previous period for trend
      const periodDuration = new Date(end).getTime() - new Date(start).getTime();
      const previousStart = new Date(new Date(start).getTime() - periodDuration).toISOString();
      const previousEnd = start;

      // Current period query
      let currentQuery = supabase
        .from('guardian_events')
        .select('id, event_type, verified, confirmation, driver_id, detection_time')
        .gte('detection_time', start)
        .lte('detection_time', end);

      if (fleet) {
        currentQuery = currentQuery.eq('fleet', fleet);
      }

      const { data: currentEvents } = await currentQuery;

      // Previous period query
      let previousQuery = supabase
        .from('guardian_events')
        .select('id, event_type')
        .gte('detection_time', previousStart)
        .lt('detection_time', previousEnd);

      if (fleet) {
        previousQuery = previousQuery.eq('fleet', fleet);
      }

      const { data: previousEvents } = await previousQuery;

      // Get driver correlations for current events
      const eventIds = currentEvents?.map(e => e.id) || [];
      const { data: correlations } = await supabase
        .from('driver_event_correlation')
        .select('guardian_event_id, driver_id')
        .in('guardian_event_id', eventIds);

      const correlationMap = new Map();
      correlations?.forEach(c => {
        correlationMap.set(c.guardian_event_id, c.driver_id);
      });

      // Calculate metrics
      const distractionEvents = currentEvents?.filter(e =>
        e.event_type.toLowerCase().includes('distraction')
      ) || [];

      const distractionVerified = distractionEvents.filter(e =>
        e.verified || e.confirmation === 'verified'
      );

      const distractionWithDriver = distractionEvents.filter(e =>
        e.driver_id || correlationMap.has(e.id)
      );

      const fatigueEvents = currentEvents?.filter(e =>
        e.event_type.toLowerCase().includes('fatigue') ||
        e.event_type.toLowerCase().includes('microsleep')
      ) || [];

      const fatigueVerified = fatigueEvents.filter(e =>
        e.verified || e.confirmation === 'verified'
      );

      const fatigueWithDriver = fatigueEvents.filter(e =>
        e.driver_id || correlationMap.has(e.id)
      );

      // Last 24h fatigue count
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const fatigueLast24h = fatigueEvents.filter(e =>
        new Date(e.detection_time) >= twentyFourHoursAgo
      ).length;

      // Previous period counts for trend
      const previousDistraction = previousEvents?.filter(e =>
        e.event_type.toLowerCase().includes('distraction')
      ).length || 0;

      const previousFatigue = previousEvents?.filter(e =>
        e.event_type.toLowerCase().includes('fatigue') ||
        e.event_type.toLowerCase().includes('microsleep')
      ).length || 0;

      // Calculate trends
      const distractionTrend = previousDistraction > 0
        ? ((distractionEvents.length - previousDistraction) / previousDistraction) * 100
        : 0;

      const fatigueTrend = previousFatigue > 0
        ? ((fatigueEvents.length - previousFatigue) / previousFatigue) * 100
        : 0;

      return {
        distraction: {
          total: distractionEvents.length,
          verified: distractionVerified.length,
          verificationRate: distractionEvents.length > 0
            ? (distractionVerified.length / distractionEvents.length) * 100
            : 0,
          trend: distractionTrend,
          driverAttributionRate: distractionEvents.length > 0
            ? (distractionWithDriver.length / distractionEvents.length) * 100
            : 0,
        },
        fatigue: {
          total: fatigueEvents.length,
          verified: fatigueVerified.length,
          verificationRate: fatigueEvents.length > 0
            ? (fatigueVerified.length / fatigueEvents.length) * 100
            : 0,
          trend: fatigueTrend,
          driverAttributionRate: fatigueEvents.length > 0
            ? (fatigueWithDriver.length / fatigueEvents.length) * 100
            : 0,
          last24h: fatigueLast24h,
        },
      };

    } catch (error) {
      console.error('Error in getComplianceMetrics:', error);
      // Return empty metrics on error
      return {
        distraction: { total: 0, verified: 0, verificationRate: 0, trend: 0, driverAttributionRate: 0 },
        fatigue: { total: 0, verified: 0, verificationRate: 0, trend: 0, driverAttributionRate: 0, last24h: 0 },
      };
    }
  }

  /**
   * Get monthly trends for charts
   */
  async getMonthlyTrends(
    eventType: 'distraction' | 'fatigue',
    fleet?: 'Stevemacs' | 'Great Southern Fuels',
    dateRange?: { start: string; end: string }
  ): Promise<MonthlyTrend[]> {
    try {
      const now = new Date();
      const defaultStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      const start = dateRange?.start || defaultStart.toISOString();
      const end = dateRange?.end || now.toISOString();

      let query = supabase
        .from('guardian_events')
        .select('detection_time, event_type, verified, confirmation')
        .gte('detection_time', start)
        .lte('detection_time', end);

      if (fleet) {
        query = query.eq('fleet', fleet);
      }

      if (eventType === 'distraction') {
        query = query.ilike('event_type', '%distraction%');
      } else {
        query = query.or('event_type.ilike.%fatigue%,event_type.ilike.%microsleep%');
      }

      const { data: events, error } = await query;

      if (error) {
        console.error('Error fetching monthly trends:', error);
        return [];
      }

      // Group by month
      const monthlyGroups: Record<string, { total: number; verified: number }> = {};

      events?.forEach(event => {
        const date = new Date(event.detection_time);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyGroups[monthKey]) {
          monthlyGroups[monthKey] = { total: 0, verified: 0 };
        }

        monthlyGroups[monthKey].total++;
        if (event.verified || event.confirmation === 'verified') {
          monthlyGroups[monthKey].verified++;
        }
      });

      // Convert to array and format
      const trends: MonthlyTrend[] = Object.entries(monthlyGroups).map(([monthKey, data]) => {
        const [year, month] = monthKey.split('-');
        const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('default', {
          month: 'short',
          year: 'numeric'
        });

        return {
          month: monthName,
          total: data.total,
          verified: data.verified,
        };
      });

      // Sort by date
      return trends.sort((a, b) => {
        const aDate = new Date(a.month);
        const bDate = new Date(b.month);
        return aDate.getTime() - bDate.getTime();
      });

    } catch (error) {
      console.error('Error in getMonthlyTrends:', error);
      return [];
    }
  }

  /**
   * Get 7-day fatigue trend
   */
  async getFatigueTrend(
    fleet?: 'Stevemacs' | 'Great Southern Fuels'
  ): Promise<FatigueTrend> {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      // Current 7 days
      let currentQuery = supabase
        .from('guardian_events')
        .select('id', { count: 'exact', head: true })
        .gte('detection_time', sevenDaysAgo.toISOString())
        .or('event_type.ilike.%fatigue%,event_type.ilike.%microsleep%');

      if (fleet) {
        currentQuery = currentQuery.eq('fleet', fleet);
      }

      const { count: currentCount } = await currentQuery;

      // Previous 7 days
      let previousQuery = supabase
        .from('guardian_events')
        .select('id', { count: 'exact', head: true })
        .gte('detection_time', fourteenDaysAgo.toISOString())
        .lt('detection_time', sevenDaysAgo.toISOString())
        .or('event_type.ilike.%fatigue%,event_type.ilike.%microsleep%');

      if (fleet) {
        previousQuery = previousQuery.eq('fleet', fleet);
      }

      const { count: previousCount } = await previousQuery;

      const current = currentCount || 0;
      const previous = previousCount || 0;

      const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
      const changeDirection: 'up' | 'down' | 'stable' =
        Math.abs(change) < 5 ? 'stable' : change > 0 ? 'up' : 'down';

      return {
        current,
        previous,
        change,
        changeDirection,
      };

    } catch (error) {
      console.error('Error in getFatigueTrend:', error);
      return {
        current: 0,
        previous: 0,
        change: 0,
        changeDirection: 'stable',
      };
    }
  }
}

// Export singleton instance
export const guardianAnalytics = new GuardianAnalyticsService();
