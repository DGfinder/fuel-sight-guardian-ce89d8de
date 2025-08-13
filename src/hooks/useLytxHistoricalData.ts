/**
 * Historical LYTX Data Hooks
 * Database-focused hooks for comprehensive analysis of 34K+ stored safety events
 * Replaces API-focused hooks with historical data analytics
 */

import { useQuery, useQueries } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useMemo } from 'react';

// Types for historical LYTX data (matching database schema)
export interface LytxHistoricalEvent {
  event_id: string;
  driver_name: string;
  vehicle_registration: string | null;
  device_serial: string | null;
  employee_id: string | null;
  group_name: string;
  depot: string;
  carrier: 'Stevemacs' | 'Great Southern Fuels';
  event_datetime: string;
  timezone: string;
  score: number;
  status: 'New' | 'Face-To-Face' | 'FYI Notify' | 'Resolved';
  trigger: string;
  behaviors: string | null;
  event_type: 'Coachable' | 'Driver Tagged';
  excluded: boolean;
  assigned_date: string | null;
  reviewed_by: string | null;
  notes: string | null;
  raw_data: any;
  created_at: string;
  updated_at: string;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface LytxAnalyticsFilters {
  carrier?: 'All' | 'Stevemacs' | 'Great Southern Fuels';
  depot?: string;
  status?: 'All' | 'New' | 'Face-To-Face' | 'FYI Notify' | 'Resolved';
  eventType?: 'All' | 'Coachable' | 'Driver Tagged';
  dateRange?: DateRange;
  driverAssigned?: 'All' | 'Assigned' | 'Unassigned';
  excluded?: boolean;
  minScore?: number;
  maxScore?: number;
}

// Hook for comprehensive historical data with filters
export const useLytxHistoricalEvents = (filters: LytxAnalyticsFilters = {}) => {
  return useQuery({
    queryKey: ['lytx', 'historical', 'events', filters],
    queryFn: async (): Promise<LytxHistoricalEvent[]> => {
      let query = supabase.from('lytx_safety_events').select('*');

      // Apply filters
      if (filters.carrier && filters.carrier !== 'All') {
        query = query.eq('carrier', filters.carrier);
      }

      if (filters.depot) {
        query = query.eq('depot', filters.depot);
      }

      if (filters.status && filters.status !== 'All') {
        query = query.eq('status', filters.status);
      }

      if (filters.eventType && filters.eventType !== 'All') {
        query = query.eq('event_type', filters.eventType);
      }

      if (filters.dateRange) {
        query = query
          .gte('event_datetime', filters.dateRange.startDate)
          .lte('event_datetime', filters.dateRange.endDate);
      }

      if (filters.driverAssigned === 'Assigned') {
        query = query.neq('driver_name', 'Driver Unassigned');
      } else if (filters.driverAssigned === 'Unassigned') {
        query = query.eq('driver_name', 'Driver Unassigned');
      }

      if (filters.excluded !== undefined) {
        query = query.eq('excluded', filters.excluded);
      }

      if (filters.minScore !== undefined) {
        query = query.gte('score', filters.minScore);
      }

      if (filters.maxScore !== undefined) {
        query = query.lte('score', filters.maxScore);
      }

      query = query.order('event_datetime', { ascending: false });

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch historical events: ${error.message}`);
      }

      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - historical data doesn't change often
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  });
};

// Hook for summary statistics
export const useLytxSummaryStats = (filters: LytxAnalyticsFilters = {}) => {
  return useQuery({
    queryKey: ['lytx', 'historical', 'summary', filters],
    queryFn: async () => {
      // Primary source: raw events table
      const { data, error } = await supabase
        .from('lytx_safety_events')
        .select('carrier, status, event_type, score, driver_name, event_datetime, excluded');

      if (error) throw error;

      let events = data || [];

      // Apply client-side filtering for complex queries
      if (filters.carrier && filters.carrier !== 'All') {
        events = events.filter(e => e.carrier === filters.carrier);
      }

      if (filters.status && filters.status !== 'All') {
        events = events.filter(e => e.status === filters.status);
      }

      if (filters.eventType && filters.eventType !== 'All') {
        events = events.filter(e => e.event_type === filters.eventType);
      }

      if (filters.dateRange) {
        events = events.filter(e => 
          e.event_datetime >= filters.dateRange!.startDate && 
          e.event_datetime <= filters.dateRange!.endDate
        );
      }

      if (filters.driverAssigned === 'Assigned') {
        events = events.filter(e => e.driver_name !== 'Driver Unassigned');
      } else if (filters.driverAssigned === 'Unassigned') {
        events = events.filter(e => e.driver_name === 'Driver Unassigned');
      }

      if (filters.excluded !== undefined) {
        events = events.filter(e => e.excluded === filters.excluded);
      }

      let totalEvents = events.length;
      let resolvedEvents = events.filter(e => e.status === 'Resolved').length;
      let coachableEvents = events.filter(e => e.event_type === 'Coachable').length;
      let driverTaggedEvents = events.filter(e => e.event_type === 'Driver Tagged').length;
      let unassignedDrivers = events.filter(e => e.driver_name === 'Driver Unassigned').length;
      let stevemacsEvents = events.filter(e => e.carrier === 'Stevemacs').length;
      let gsfEvents = events.filter(e => e.carrier === 'Great Southern Fuels').length;
      let avgScore = events.length > 0 
        ? events.reduce((sum, e) => sum + (e.score || 0), 0) / events.length 
        : 0;

      // Fallback: if the table returns 0 (edge cases with RLS or env drift),
      // derive summary from the aggregated view lytx_safety_analytics
      if (totalEvents === 0) {
        let viewQuery = supabase
          .from('lytx_safety_analytics')
          .select('carrier, year, month_num, total_events, coachable_events, driver_tagged_events, resolved_events, avg_score');

        if (filters.carrier && filters.carrier !== 'All') {
          viewQuery = viewQuery.eq('carrier', filters.carrier);
        }
        if (filters.dateRange) {
          const start = new Date(filters.dateRange.startDate);
          const end = new Date(filters.dateRange.endDate);
          const startYear = start.getFullYear();
          const startMonth = start.getMonth() + 1;
          const endYear = end.getFullYear();
          const endMonth = end.getMonth() + 1;
          // Filter by year bounds first; month filter applied client-side below
          viewQuery = viewQuery.gte('year', startYear).lte('year', endYear);
        }

        const { data: viewData, error: viewError } = await viewQuery;
        if (!viewError && viewData && viewData.length > 0) {
          const filteredView = (filters.dateRange ? viewData.filter(r => {
            const y = r.year as unknown as number; // supabase-js returns number
            const m = r.month_num as unknown as number;
            const d = new Date(y, m - 1, 1);
            return d >= new Date(filters.dateRange!.startDate) && d <= new Date(filters.dateRange!.endDate);
          }) : viewData);

          totalEvents = filteredView.reduce((s, r: any) => s + (r.total_events || 0), 0);
          coachableEvents = filteredView.reduce((s, r: any) => s + (r.coachable_events || 0), 0);
          driverTaggedEvents = filteredView.reduce((s, r: any) => s + (r.driver_tagged_events || 0), 0);
          resolvedEvents = filteredView.reduce((s, r: any) => s + (r.resolved_events || 0), 0);
          // Weighted average score
          const scoreSum = filteredView.reduce((s, r: any) => s + (r.avg_score || 0) * (r.total_events || 0), 0);
          avgScore = totalEvents > 0 ? scoreSum / totalEvents : 0;
          stevemacsEvents = filteredView.filter(r => r.carrier === 'Stevemacs').reduce((s, r: any) => s + (r.total_events || 0), 0);
          gsfEvents = filteredView.filter(r => r.carrier === 'Great Southern Fuels').reduce((s, r: any) => s + (r.total_events || 0), 0);
          unassignedDrivers = 0; // Not available in the view
        }
      }

      const statusDistribution = {
        'New': events.filter(e => e.status === 'New').length,
        'Face-To-Face': events.filter(e => e.status === 'Face-To-Face').length,
        'FYI Notify': events.filter(e => e.status === 'FYI Notify').length,
        'Resolved': events.filter(e => e.status === 'Resolved').length,
      };

      return {
        totalEvents,
        resolvedEvents,
        resolutionRate: totalEvents > 0 ? (resolvedEvents / totalEvents) * 100 : 0,
        coachableEvents,
        driverTaggedEvents,
        unassignedDrivers,
        unassignedRate: totalEvents > 0 ? (unassignedDrivers / totalEvents) * 100 : 0,
        stevemacsEvents,
        gsfEvents,
        carrierDistribution: {
          'Stevemacs': stevemacsEvents,
          'Great Southern Fuels': gsfEvents,
        },
        avgScore: Math.round(avgScore * 100) / 100,
        statusDistribution,
      };
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });
};

// Hook for monthly trend data
export const useLytxMonthlyTrends = (filters: LytxAnalyticsFilters = {}) => {
  return useQuery({
    queryKey: ['lytx', 'historical', 'monthly-trends', filters],
    queryFn: async () => {
      const { data: events, error } = await supabase
        .from('lytx_safety_events')
        .select('event_datetime, carrier, event_type, status, score, driver_name');

      if (error) throw error;

      let filteredEvents = events || [];

      // Apply filters
      if (filters.carrier && filters.carrier !== 'All') {
        filteredEvents = filteredEvents.filter(e => e.carrier === filters.carrier);
      }

      if (filters.dateRange) {
        filteredEvents = filteredEvents.filter(e => 
          e.event_datetime >= filters.dateRange!.startDate && 
          e.event_datetime <= filters.dateRange!.endDate
        );
      }

      // Group by month
      const monthlyData: Record<string, {
        month: string;
        total: number;
        coachableSMB: number;
        coachableGSF: number;
        driverTaggedSMB: number;
        driverTaggedGSF: number;
        resolved: number;
        unassigned: number;
        avgScore: number;
        scoreSum: number;
      }> = {};

      filteredEvents.forEach(event => {
        const date = new Date(event.event_datetime);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {
            month: monthName,
            total: 0,
            coachableSMB: 0,
            coachableGSF: 0,
            driverTaggedSMB: 0,
            driverTaggedGSF: 0,
            resolved: 0,
            unassigned: 0,
            avgScore: 0,
            scoreSum: 0,
          };
        }

        const data = monthlyData[monthKey];
        data.total++;
        data.scoreSum += event.score || 0;

        if (event.event_type === 'Coachable') {
          if (event.carrier === 'Stevemacs') data.coachableSMB++;
          if (event.carrier === 'Great Southern Fuels') data.coachableGSF++;
        } else {
          if (event.carrier === 'Stevemacs') data.driverTaggedSMB++;
          if (event.carrier === 'Great Southern Fuels') data.driverTaggedGSF++;
        }

        if (event.status === 'Resolved') data.resolved++;
        if (event.driver_name === 'Driver Unassigned') data.unassigned++;
      });

      // Calculate average scores and sort by month
      let sortedData = Object.values(monthlyData)
        .map(data => ({
          ...data,
          avgScore: data.total > 0 ? Math.round((data.scoreSum / data.total) * 100) / 100 : 0,
          resolutionRate: data.total > 0 ? Math.round((data.resolved / data.total) * 100 * 100) / 100 : 0,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      // Fallback: derive monthly trends from the aggregated view if table yielded nothing
      if (sortedData.length === 0) {
        let viewQuery = supabase
          .from('lytx_safety_analytics')
          .select('carrier, month, year, month_num, total_events, coachable_events, driver_tagged_events, resolved_events, avg_score');
        if (filters.carrier && filters.carrier !== 'All') {
          viewQuery = viewQuery.eq('carrier', filters.carrier);
        }
        if (filters.dateRange) {
          const start = new Date(filters.dateRange.startDate);
          const end = new Date(filters.dateRange.endDate);
          viewQuery = viewQuery.gte('year', start.getFullYear()).lte('year', end.getFullYear());
        }
        const { data: viewData } = await viewQuery;
        if (viewData && viewData.length > 0) {
          const rows = (filters.dateRange ? viewData.filter(r => {
            const d = new Date(r.year as number, (r.month_num as number) - 1, 1);
            return d >= new Date(filters.dateRange!.startDate) && d <= new Date(filters.dateRange!.endDate);
          }) : viewData);

          sortedData = rows.map((r: any) => ({
            month: `${r.month} ${r.year}`,
            total: r.total_events || 0,
            coachableSMB: r.carrier === 'Stevemacs' ? (r.coachable_events || 0) : 0,
            coachableGSF: r.carrier === 'Great Southern Fuels' ? (r.coachable_events || 0) : 0,
            driverTaggedSMB: r.carrier === 'Stevemacs' ? (r.driver_tagged_events || 0) : 0,
            driverTaggedGSF: r.carrier === 'Great Southern Fuels' ? (r.driver_tagged_events || 0) : 0,
            resolved: r.resolved_events || 0,
            unassigned: 0,
            avgScore: r.avg_score || 0,
            scoreSum: r.avg_score * (r.total_events || 0),
            resolutionRate: (r.total_events || 0) > 0 ? Math.round(((r.resolved_events || 0) / r.total_events) * 100 * 100) / 100 : 0,
          }))
          .sort((a, b) => a.month.localeCompare(b.month));
        }
      }

      return sortedData;
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });
};

// Hook for driver performance analysis
export const useLytxDriverPerformance = (filters: LytxAnalyticsFilters = {}) => {
  return useQuery({
    queryKey: ['lytx', 'historical', 'driver-performance', filters],
    queryFn: async () => {
      const { data: events, error } = await supabase
        .from('lytx_safety_events')
        .select('driver_name, score, status, event_type, event_datetime, carrier')
        .neq('driver_name', 'Driver Unassigned');

      if (error) throw error;

      let filteredEvents = events || [];

      // Apply filters
      if (filters.carrier && filters.carrier !== 'All') {
        filteredEvents = filteredEvents.filter(e => e.carrier === filters.carrier);
      }

      if (filters.dateRange) {
        filteredEvents = filteredEvents.filter(e => 
          e.event_datetime >= filters.dateRange!.startDate && 
          e.event_datetime <= filters.dateRange!.endDate
        );
      }

      // Group by driver
      const driverStats: Record<string, {
        driver: string;
        totalEvents: number;
        avgScore: number;
        resolvedEvents: number;
        resolutionRate: number;
        coachableEvents: number;
        driverTaggedEvents: number;
        carrier: string;
        latestEvent: string;
        scoreSum: number;
      }> = {};

      filteredEvents.forEach(event => {
        const driver = event.driver_name;
        
        if (!driverStats[driver]) {
          driverStats[driver] = {
            driver,
            totalEvents: 0,
            avgScore: 0,
            resolvedEvents: 0,
            resolutionRate: 0,
            coachableEvents: 0,
            driverTaggedEvents: 0,
            carrier: event.carrier,
            latestEvent: event.event_datetime,
            scoreSum: 0,
          };
        }

        const stats = driverStats[driver];
        stats.totalEvents++;
        stats.scoreSum += event.score || 0;

        if (event.status === 'Resolved') stats.resolvedEvents++;
        if (event.event_type === 'Coachable') stats.coachableEvents++;
        if (event.event_type === 'Driver Tagged') stats.driverTaggedEvents++;
        
        // Track latest event
        if (event.event_datetime > stats.latestEvent) {
          stats.latestEvent = event.event_datetime;
        }
      });

      // Calculate final metrics and sort
      const driverPerformance = Object.values(driverStats)
        .map(stats => ({
          ...stats,
          avgScore: Math.round((stats.scoreSum / stats.totalEvents) * 100) / 100,
          resolutionRate: Math.round((stats.resolvedEvents / stats.totalEvents) * 100 * 100) / 100,
        }))
        .sort((a, b) => b.totalEvents - a.totalEvents); // Sort by most events

      return driverPerformance;
    },
    staleTime: 20 * 60 * 1000, // 20 minutes
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
  });
};

// Hook for depot comparison analytics
export const useLytxDepotAnalytics = (filters: LytxAnalyticsFilters = {}) => {
  return useQuery({
    queryKey: ['lytx', 'historical', 'depot-analytics', filters],
    queryFn: async () => {
      const { data: events, error } = await supabase
        .from('lytx_safety_events')
        .select('depot, carrier, score, status, event_type, event_datetime, driver_name');

      if (error) throw error;

      let filteredEvents = events || [];

      // Apply filters
      if (filters.carrier && filters.carrier !== 'All') {
        filteredEvents = filteredEvents.filter(e => e.carrier === filters.carrier);
      }

      if (filters.dateRange) {
        filteredEvents = filteredEvents.filter(e => 
          e.event_datetime >= filters.dateRange!.startDate && 
          e.event_datetime <= filters.dateRange!.endDate
        );
      }

      // Group by depot
      const depotStats: Record<string, {
        depot: string;
        totalEvents: number;
        avgScore: number;
        resolutionRate: number;
        unassignedRate: number;
        carrier: string;
        coachableEvents: number;
        driverTaggedEvents: number;
        scoreSum: number;
        resolvedEvents: number;
        unassignedEvents: number;
      }> = {};

      filteredEvents.forEach(event => {
        const depot = event.depot || 'Unknown';
        
        if (!depotStats[depot]) {
          depotStats[depot] = {
            depot,
            totalEvents: 0,
            avgScore: 0,
            resolutionRate: 0,
            unassignedRate: 0,
            carrier: event.carrier,
            coachableEvents: 0,
            driverTaggedEvents: 0,
            scoreSum: 0,
            resolvedEvents: 0,
            unassignedEvents: 0,
          };
        }

        const stats = depotStats[depot];
        stats.totalEvents++;
        stats.scoreSum += event.score || 0;

        if (event.status === 'Resolved') stats.resolvedEvents++;
        if (event.driver_name === 'Driver Unassigned') stats.unassignedEvents++;
        if (event.event_type === 'Coachable') stats.coachableEvents++;
        if (event.event_type === 'Driver Tagged') stats.driverTaggedEvents++;
      });

      // Calculate final metrics and sort
      const depotAnalytics = Object.values(depotStats)
        .map(stats => ({
          ...stats,
          avgScore: Math.round((stats.scoreSum / stats.totalEvents) * 100) / 100,
          resolutionRate: Math.round((stats.resolvedEvents / stats.totalEvents) * 100 * 100) / 100,
          unassignedRate: Math.round((stats.unassignedEvents / stats.totalEvents) * 100 * 100) / 100,
        }))
        .sort((a, b) => b.totalEvents - a.totalEvents);

      return depotAnalytics;
    },
    staleTime: 15 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
};

// Hook for trigger analysis
export const useLytxTriggerAnalysis = (filters: LytxAnalyticsFilters = {}) => {
  return useQuery({
    queryKey: ['lytx', 'historical', 'trigger-analysis', filters],
    queryFn: async () => {
      const { data: events, error } = await supabase
        .from('lytx_safety_events')
        .select('trigger, score, status, driver_name, carrier, event_datetime');

      if (error) throw error;

      let filteredEvents = events || [];

      // Apply filters
      if (filters.carrier && filters.carrier !== 'All') {
        filteredEvents = filteredEvents.filter(e => e.carrier === filters.carrier);
      }

      if (filters.dateRange) {
        filteredEvents = filteredEvents.filter(e => 
          e.event_datetime >= filters.dateRange!.startDate && 
          e.event_datetime <= filters.dateRange!.endDate
        );
      }

      // Group by trigger
      const triggerStats: Record<string, {
        trigger: string;
        count: number;
        avgScore: number;
        resolutionRate: number;
        unassignedCount: number;
        scoreSum: number;
        resolvedCount: number;
      }> = {};

      filteredEvents.forEach(event => {
        const trigger = event.trigger || 'Unknown';
        
        if (!triggerStats[trigger]) {
          triggerStats[trigger] = {
            trigger,
            count: 0,
            avgScore: 0,
            resolutionRate: 0,
            unassignedCount: 0,
            scoreSum: 0,
            resolvedCount: 0,
          };
        }

        const stats = triggerStats[trigger];
        stats.count++;
        stats.scoreSum += event.score || 0;

        if (event.status === 'Resolved') stats.resolvedCount++;
        if (event.driver_name === 'Driver Unassigned') stats.unassignedCount++;
      });

      // Calculate final metrics and sort
      const triggerAnalysis = Object.values(triggerStats)
        .map(stats => ({
          ...stats,
          avgScore: Math.round((stats.scoreSum / stats.count) * 100) / 100,
          resolutionRate: Math.round((stats.resolvedCount / stats.count) * 100 * 100) / 100,
          percentage: Math.round((stats.count / filteredEvents.length) * 100 * 100) / 100,
        }))
        .sort((a, b) => b.count - a.count);

      return triggerAnalysis;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
};

// Utility hook for creating date ranges
export const useDateRanges = () => {
  return useMemo(() => {
    const now = new Date();
    const nowISO = now.toISOString();

    return {
      last30Days: {
        startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: nowISO,
      },
      last90Days: {
        startDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: nowISO,
      },
      last6Months: {
        startDate: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: nowISO,
      },
      lastYear: {
        startDate: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: nowISO,
      },
      year2024: {
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-12-31T23:59:59Z',
      },
      year2025: {
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-12-31T23:59:59Z',
      },
      allTime: {
        startDate: '2020-01-01T00:00:00Z',
        endDate: nowISO,
      },
    };
  }, []);
};