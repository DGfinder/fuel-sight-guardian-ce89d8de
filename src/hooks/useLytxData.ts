import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { lytxApi, lytxQueryKeys, LytxSafetyEvent } from '@/services/lytxApi';
import { lytxDataTransformer, LYTXEvent } from '@/services/lytxDataTransform';
import { useEffect, useMemo } from 'react';

// Hook for safety events with transformation
export const useLytxSafetyEvents = (params: {
  page?: number;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
  vehicleId?: string;
  driverId?: string;
  statusId?: number;
  triggerId?: number;
  enabled?: boolean;
} = {}) => {
  const { enabled = true, ...apiParams } = params;

  return useQuery({
    queryKey: lytxQueryKeys.safetyEvents(apiParams),
    queryFn: async () => {
      const response = await lytxApi.getSafetyEvents(apiParams);
      return {
        events: lytxDataTransformer.transformSafetyEvents(response.data),
        totalCount: response.totalCount,
        page: response.page,
        pageSize: response.pageSize
      };
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error?.message?.includes('401') || error?.message?.includes('403')) {
        return false; // Don't retry auth errors
      }
      return failureCount < 3;
    }
  });
};

// Hook for a single safety event
export const useLytxSafetyEvent = (eventId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: lytxQueryKeys.safetyEvent(eventId),
    queryFn: async () => {
      const response = await lytxApi.getSafetyEvent(eventId);
      return lytxDataTransformer.transformSafetyEvent(response.data);
    },
    enabled: enabled && !!eventId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000 // 15 minutes
  });
};

// Hook for events with metadata (more detailed)
export const useLytxSafetyEventsWithMetadata = (params: {
  page?: number;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
} = {}) => {
  const { enabled = true, ...apiParams } = params;

  return useQuery({
    queryKey: ['lytx', 'safety', 'eventsWithMetadata', apiParams],
    queryFn: async () => {
      const response = await lytxApi.getSafetyEventsWithMetadata(apiParams);
      return {
        events: lytxDataTransformer.transformSafetyEvents(response.data),
        totalCount: response.totalCount,
        page: response.page,
        pageSize: response.pageSize
      };
    },
    enabled,
    staleTime: 1 * 60 * 1000, // 1 minute for detailed data
    gcTime: 5 * 60 * 1000 // 5 minutes
  });
};

// Hook for reference data (statuses, triggers, behaviors)
export const useLytxReferenceData = () => {
  const statusesQuery = useQuery({
    queryKey: lytxQueryKeys.eventStatuses(),
    queryFn: () => lytxApi.getEventStatuses(),
    staleTime: 30 * 60 * 1000, // 30 minutes - reference data rarely changes
    gcTime: 60 * 60 * 1000, // 1 hour
  });

  const triggersQuery = useQuery({
    queryKey: lytxQueryKeys.eventTriggers(),
    queryFn: () => lytxApi.getEventTriggers(),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const behaviorQuery = useQuery({
    queryKey: lytxQueryKeys.eventBehaviors(),
    queryFn: () => lytxApi.getEventBehaviors(),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const triggerSubtypesQuery = useQuery({
    queryKey: lytxQueryKeys.eventTriggerSubtypes(),
    queryFn: () => lytxApi.getEventTriggerSubtypes(),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  // Initialize transformer when all reference data is loaded
  useEffect(() => {
    if (statusesQuery.data && triggersQuery.data && behaviorQuery.data) {
      const statusesData = Array.isArray(statusesQuery.data.data) ? statusesQuery.data.data : [];
      const triggersData = Array.isArray(triggersQuery.data.data) ? triggersQuery.data.data : [];
      const behaviorData = Array.isArray(behaviorQuery.data.data) ? behaviorQuery.data.data : [];
      
      lytxDataTransformer.initializeReferenceMaps(
        statusesData,
        triggersData,
        behaviorData,
        [] // Vehicles will be loaded separately
      );
    }
  }, [statusesQuery.data, triggersQuery.data, behaviorQuery.data]);

  return {
    statuses: statusesQuery,
    triggers: triggersQuery,
    behaviors: behaviorQuery,
    triggerSubtypes: triggerSubtypesQuery,
    isLoading: statusesQuery.isLoading || triggersQuery.isLoading || behaviorQuery.isLoading,
    isError: statusesQuery.isError || triggersQuery.isError || behaviorQuery.isError,
    error: statusesQuery.error || triggersQuery.error || behaviorQuery.error
  };
};

// Hook for vehicles
export const useLytxVehicles = (params: {
  page?: number;
  pageSize?: number;
  groupId?: string;
  enabled?: boolean;
} = {}) => {
  const { enabled = true, ...apiParams } = params;

  return useQuery({
    queryKey: lytxQueryKeys.vehicles(apiParams),
    queryFn: async () => {
      const response = await lytxApi.getVehicles(apiParams);
      
      // Update transformer with vehicle data
      await lytxDataTransformer.initializeReferenceMaps(
        [], [], [], response.data
      );
      
      return {
        vehicles: response.data,
        totalCount: response.totalCount,
        page: response.page,
        pageSize: response.pageSize
      };
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
};

// Hook for a single vehicle
export const useLytxVehicle = (vehicleId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: lytxQueryKeys.vehicle(vehicleId),
    queryFn: () => lytxApi.getVehicle(vehicleId),
    enabled: enabled && !!vehicleId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000 // 30 minutes
  });
};

// Hook for testing API connection
export const useLytxConnectionTest = () => {
  return useQuery({
    queryKey: ['lytx', 'connection', 'test'],
    queryFn: () => lytxApi.testConnection(),
    enabled: false, // Only run when manually triggered
    staleTime: 0, // Always fresh
    gcTime: 0, // Don't cache
    retry: false
  });
};

// Hook for combined dashboard data
export const useLytxDashboardData = (dateRange: { startDate: string; endDate: string }) => {
  const eventsQuery = useLytxSafetyEvents({
    pageSize: 1000, // Get more events for dashboard
    startDate: dateRange.startDate,
    endDate: dateRange.endDate
  });

  const referenceQuery = useLytxReferenceData();
  const vehiclesQuery = useLytxVehicles({ pageSize: 100 });

  // Calculate dashboard metrics
  const dashboardMetrics = eventsQuery.data ? 
    lytxDataTransformer.getEventSummary(eventsQuery.data.events) : null;

  return {
    events: eventsQuery,
    reference: referenceQuery,
    vehicles: vehiclesQuery,
    metrics: dashboardMetrics,
    isLoading: eventsQuery.isLoading || referenceQuery.isLoading,
    isError: eventsQuery.isError || referenceQuery.isError || vehiclesQuery.isError,
    error: eventsQuery.error || referenceQuery.error || vehiclesQuery.error
  };
};

// Mutation for refreshing data
export const useLytxRefreshData = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Invalidate all Lytx queries to force refresh
      await queryClient.invalidateQueries({ 
        queryKey: ['lytx'],
        refetchType: 'active'
      });
      return { success: true };
    },
    onSuccess: () => {
      console.log('Lytx data refreshed successfully');
    },
    onError: (error) => {
      console.error('Failed to refresh Lytx data:', error);
    }
  });
};

// Hook for real-time polling
export const useLytxRealTimeEvents = (intervalMs: number = 30000) => {
  const dateRange = lytxDataTransformer.createDateRange(1); // Last 24 hours
  
  return useQuery({
    queryKey: ['lytx', 'realtime', 'events'],
    queryFn: async () => {
      const response = await lytxApi.getSafetyEvents({
        pageSize: 50,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      return lytxDataTransformer.transformSafetyEvents(response.data);
    },
    refetchInterval: intervalMs,
    refetchIntervalInBackground: false,
    staleTime: 0, // Always consider stale for real-time
    gcTime: 1 * 60 * 1000, // 1 minute cache
  });
};

// Hook for carrier-specific events with enhanced analytics
export const useLytxCarrierEvents = (
  carrier: 'Stevemacs' | 'Great Southern Fuels',
  dateRange: { startDate: string; endDate: string }
) => {
  const eventsQuery = useLytxSafetyEvents({
    pageSize: 1000, // Increased for comprehensive analysis
    startDate: dateRange.startDate,
    endDate: dateRange.endDate
  });

  // Debug logging for carrier filtering
  console.log('useLytxCarrierEvents - Raw API Response:', {
    totalEvents: eventsQuery.data?.events.length || 0,
    requestedCarrier: carrier,
    sampleEvents: eventsQuery.data?.events.slice(0, 5).map(e => ({
      eventId: e.eventId,
      group: e.group,
      carrier: e.carrier,
      driver: e.driver
    }))
  });

  // Filter events by carrier after transformation
  const carrierEvents = eventsQuery.data?.events.filter(
    event => event.carrier === carrier
  ) || [];

  console.log('useLytxCarrierEvents - Filtered Results:', {
    requestedCarrier: carrier,
    filteredCount: carrierEvents.length,
    carrierBreakdown: eventsQuery.data?.events.reduce((acc, event) => {
      acc[event.carrier] = (acc[event.carrier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  });

  const carrierMetrics = carrierEvents.length > 0 ? 
    lytxDataTransformer.getEventSummary(carrierEvents) : null;

  // Enhanced analytics for GSF
  const enhancedAnalytics = useMemo(() => {
    if (carrierEvents.length === 0) return null;
    
    return {
      // Driver analytics
      driverStats: calculateDriverStatistics(carrierEvents),
      // Depot analytics
      depotStats: calculateDepotStatistics(carrierEvents),
      // Trend analytics
      trendStats: calculateTrendStatistics(carrierEvents),
      // Risk analytics
      riskStats: calculateRiskStatistics(carrierEvents)
    };
  }, [carrierEvents]);

  return {
    ...eventsQuery,
    data: {
      events: carrierEvents,
      totalCount: carrierEvents.length,
      metrics: carrierMetrics,
      analytics: enhancedAnalytics
    }
  };
};

// Helper functions for enhanced analytics
const calculateDriverStatistics = (events: LYTXEvent[]) => {
  const driverMap = new Map<string, LYTXEvent[]>();
  
  events.forEach(event => {
    if (event.driver !== 'Driver Unassigned') {
      const key = `${event.driver}-${event.employeeId}`;
      if (!driverMap.has(key)) {
        driverMap.set(key, []);
      }
      driverMap.get(key)!.push(event);
    }
  });

  return Array.from(driverMap.entries()).map(([key, driverEvents]) => {
    const totalEvents = driverEvents.length;
    const resolvedEvents = driverEvents.filter(e => e.status === 'Resolved').length;
    const avgScore = driverEvents.reduce((sum, e) => sum + e.score, 0) / totalEvents;
    
    // Calculate trend (last 30 days vs previous 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    
    const recentEvents = driverEvents.filter(e => new Date(e.date) >= thirtyDaysAgo);
    const olderEvents = driverEvents.filter(e => {
      const eventDate = new Date(e.date);
      return eventDate >= sixtyDaysAgo && eventDate < thirtyDaysAgo;
    });
    
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recentEvents.length > 0 && olderEvents.length > 0) {
      const recentAvg = recentEvents.reduce((sum, e) => sum + e.score, 0) / recentEvents.length;
      const olderAvg = olderEvents.reduce((sum, e) => sum + e.score, 0) / olderEvents.length;
      trend = recentAvg < olderAvg ? 'improving' : recentAvg > olderAvg ? 'declining' : 'stable';
    }

    return {
      driver: driverEvents[0].driver,
      employeeId: driverEvents[0].employeeId,
      depot: driverEvents[0].group,
      totalEvents,
      resolutionRate: (resolvedEvents / totalEvents) * 100,
      averageScore: avgScore,
      trend,
      riskLevel: totalEvents > 10 && avgScore > 3 ? 'high' : 
                 totalEvents > 5 && avgScore > 1 ? 'medium' : 'low'
    };
  });
};

const calculateDepotStatistics = (events: LYTXEvent[]) => {
  const depotMap = new Map<string, LYTXEvent[]>();
  
  events.forEach(event => {
    if (!depotMap.has(event.group)) {
      depotMap.set(event.group, []);
    }
    depotMap.get(event.group)!.push(event);
  });

  return Array.from(depotMap.entries()).map(([depot, depotEvents]) => {
    const totalEvents = depotEvents.length;
    const resolvedEvents = depotEvents.filter(e => e.status === 'Resolved').length;
    const avgScore = depotEvents.reduce((sum, e) => sum + e.score, 0) / totalEvents;
    const uniqueDrivers = new Set(depotEvents.filter(e => e.driver !== 'Driver Unassigned').map(e => e.driver)).size;
    
    // Top triggers for this depot
    const triggerCounts = depotEvents.reduce((acc, event) => {
      acc[event.trigger] = (acc[event.trigger] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topTriggers = Object.entries(triggerCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([trigger, count]) => ({ trigger, count }));

    return {
      depot,
      totalEvents,
      resolutionRate: (resolvedEvents / totalEvents) * 100,
      averageScore: avgScore,
      driverCount: uniqueDrivers,
      eventsPerDriver: uniqueDrivers > 0 ? totalEvents / uniqueDrivers : 0,
      topTriggers
    };
  });
};

const calculateTrendStatistics = (events: LYTXEvent[]) => {
  const monthlyStats: Record<string, { 
    month: string; 
    coachable: number; 
    driverTagged: number; 
    avgScore: number; 
    resolved: number;
    new: number;
  }> = {};
  
  events.forEach(event => {
    const date = new Date(event.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    
    if (!monthlyStats[monthKey]) {
      monthlyStats[monthKey] = { 
        month: monthName, 
        coachable: 0, 
        driverTagged: 0, 
        avgScore: 0, 
        resolved: 0,
        new: 0
      };
    }
    
    const stats = monthlyStats[monthKey];
    if (event.eventType === 'Coachable') stats.coachable++;
    else stats.driverTagged++;
    
    if (event.status === 'Resolved') stats.resolved++;
    if (event.status === 'New') stats.new++;
    stats.avgScore += event.score;
  });
  
  return Object.values(monthlyStats)
    .map(stats => ({
      ...stats,
      avgScore: stats.avgScore / (stats.coachable + stats.driverTagged) || 0,
      total: stats.coachable + stats.driverTagged
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
};

const calculateRiskStatistics = (events: LYTXEvent[]) => {
  const riskFactors = {
    highScoreEvents: events.filter(e => e.score >= 5).length,
    unassignedEvents: events.filter(e => e.driver === 'Driver Unassigned').length,
    unresolvedEvents: events.filter(e => e.status === 'New').length,
    repeatedOffenders: 0
  };

  // Calculate repeated offenders (drivers with >10 events)
  const driverCounts = events.reduce((acc, event) => {
    if (event.driver !== 'Driver Unassigned') {
      acc[event.driver] = (acc[event.driver] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  riskFactors.repeatedOffenders = Object.values(driverCounts).filter(count => count > 10).length;

  return riskFactors;
};

// Error boundary helper
export const isLytxError = (error: any): boolean => {
  return error?.message?.includes('Lytx') || 
         error?.message?.includes('API') ||
         error?.status >= 400;
};

export default {
  useLytxSafetyEvents,
  useLytxSafetyEvent,
  useLytxSafetyEventsWithMetadata,
  useLytxReferenceData,
  useLytxVehicles,
  useLytxVehicle,
  useLytxConnectionTest,
  useLytxDashboardData,
  useLytxRefreshData,
  useLytxRealTimeEvents,
  useLytxCarrierEvents,
  isLytxError
};