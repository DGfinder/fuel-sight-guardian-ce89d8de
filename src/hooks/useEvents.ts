import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as vehicleApi from '@/api/vehicles';
import * as eventUtils from '@/utils/eventAssociation';
import type { VehicleEvent, EventFilters } from '@/types/fleet';

// Event data hooks
export function useVehicleEvents(filters?: EventFilters) {
  return useQuery({
    queryKey: ['vehicle-events', filters],
    queryFn: () => vehicleApi.getVehicleEvents(filters),
    staleTime: 30 * 1000,
  });
}

export function useVehicleEventsByRegistration(
  registration: string,
  filters?: EventFilters
) {
  return useQuery({
    queryKey: ['vehicle-events-by-registration', registration, filters],
    queryFn: () => eventUtils.getVehicleEventsByRegistration(registration, filters),
    enabled: !!registration,
    staleTime: 30 * 1000,
  });
}

// Guardian-specific events
export function useGuardianEvents(filters?: EventFilters) {
  return useQuery({
    queryKey: ['guardian-events', filters],
    queryFn: () => vehicleApi.getVehicleEvents({ ...filters, source: 'Guardian' }),
    staleTime: 30 * 1000,
  });
}

// Lytx-specific events
export function useLytxEvents(filters?: EventFilters) {
  return useQuery({
    queryKey: ['lytx-events', filters],
    queryFn: () => vehicleApi.getVehicleEvents({ ...filters, source: 'Lytx' }),
    staleTime: 30 * 1000,
  });
}

// Event summary and statistics
export function useEventSummary(fleet?: 'Stevemacs' | 'Great Southern Fuels') {
  return useQuery({
    queryKey: ['event-summary', fleet],
    queryFn: () => eventUtils.getEventSummaryByFleet(fleet),
    staleTime: 60 * 1000, // 1 minute
  });
}

// Mutations for event management
export function useCreateVehicleEvent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (event: Omit<VehicleEvent, 'id' | 'created_at'>) =>
      vehicleApi.createVehicleEvent(event),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-events'] });
      queryClient.invalidateQueries({ queryKey: ['guardian-events'] });
      queryClient.invalidateQueries({ queryKey: ['lytx-events'] });
      queryClient.invalidateQueries({ queryKey: ['event-summary'] });
    },
  });
}

export function useUpdateEventVerification() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ eventId, verified, status }: { 
      eventId: string; 
      verified: boolean; 
      status?: string 
    }) => eventUtils.updateEventVerification(eventId, verified, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-events'] });
      queryClient.invalidateQueries({ queryKey: ['guardian-events'] });
      queryClient.invalidateQueries({ queryKey: ['lytx-events'] });
      queryClient.invalidateQueries({ queryKey: ['event-summary'] });
    },
  });
}

// Batch processing hooks
export function useAssociateGuardianEvent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ guardianUnitId, eventData }: {
      guardianUnitId: string;
      eventData: Parameters<typeof eventUtils.associateGuardianEvent>[1];
    }) => eventUtils.associateGuardianEvent(guardianUnitId, eventData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-events'] });
      queryClient.invalidateQueries({ queryKey: ['guardian-events'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['event-summary'] });
    },
  });
}

export function useAssociateLytxEvent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ lytxDeviceId, eventData }: {
      lytxDeviceId: string;
      eventData: Parameters<typeof eventUtils.associateLytxEvent>[1];
    }) => eventUtils.associateLytxEvent(lytxDeviceId, eventData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-events'] });
      queryClient.invalidateQueries({ queryKey: ['lytx-events'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['event-summary'] });
    },
  });
}

// Specialized queries for dashboard data
export function useRecentEvents(limit: number = 50) {
  return useQuery({
    queryKey: ['recent-events', limit],
    queryFn: async () => {
      const events = await vehicleApi.getVehicleEvents();
      return events.slice(0, limit);
    },
    staleTime: 30 * 1000,
  });
}

export function useUnverifiedEvents() {
  return useQuery({
    queryKey: ['unverified-events'],
    queryFn: () => vehicleApi.getVehicleEvents({ verified: false }),
    staleTime: 30 * 1000,
  });
}

export function useCriticalEvents() {
  return useQuery({
    queryKey: ['critical-events'],
    queryFn: async () => {
      const events = await vehicleApi.getVehicleEvents();
      return events.filter(event => event.severity === 'Critical');
    },
    staleTime: 30 * 1000,
  });
}

// Event trends and analytics
export function useEventTrends(timeframe: 'day' | 'week' | 'month' = 'month') {
  return useQuery({
    queryKey: ['event-trends', timeframe],
    queryFn: async () => {
      const now = new Date();
      let fromDate: Date;
      
      switch (timeframe) {
        case 'day':
          fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
        default:
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      const events = await vehicleApi.getVehicleEvents({
        from_date: fromDate.toISOString(),
        to_date: now.toISOString()
      });

      // Group events by date
      const trends = events.reduce((acc, event) => {
        const date = new Date(event.occurred_at).toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = {
            date,
            total: 0,
            guardian: 0,
            lytx: 0,
            verified: 0,
            critical: 0
          };
        }
        
        acc[date].total++;
        if (event.source === 'Guardian') acc[date].guardian++;
        if (event.source === 'Lytx') acc[date].lytx++;
        if (event.verified) acc[date].verified++;
        if (event.severity === 'Critical') acc[date].critical++;
        
        return acc;
      }, {} as Record<string, any>);

      return Object.values(trends).sort((a: any, b: any) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    },
    staleTime: 60 * 1000,
  });
}