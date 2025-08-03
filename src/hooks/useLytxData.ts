import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { lytxApi, lytxQueryKeys, LytxSafetyEvent } from '@/services/lytxApi';
import { lytxDataTransformer, LYTXEvent } from '@/services/lytxDataTransform';
import { useEffect } from 'react';

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
      lytxDataTransformer.initializeReferenceMaps(
        statusesQuery.data.data,
        triggersQuery.data.data,
        behaviorQuery.data.data,
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

// Hook for carrier-specific events
export const useLytxCarrierEvents = (
  carrier: 'Stevemacs' | 'Great Southern Fuels',
  dateRange: { startDate: string; endDate: string }
) => {
  const eventsQuery = useLytxSafetyEvents({
    pageSize: 500,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate
  });

  // Filter events by carrier after transformation
  const carrierEvents = eventsQuery.data?.events.filter(
    event => event.carrier === carrier
  ) || [];

  const carrierMetrics = carrierEvents.length > 0 ? 
    lytxDataTransformer.getEventSummary(carrierEvents) : null;

  return {
    ...eventsQuery,
    data: {
      events: carrierEvents,
      totalCount: carrierEvents.length,
      metrics: carrierMetrics
    }
  };
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