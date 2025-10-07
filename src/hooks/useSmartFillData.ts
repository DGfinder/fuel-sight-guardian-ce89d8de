import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { 
  getSmartFillLocations, 
  syncSmartFillData, 
  getSmartFillSyncLogs,
  getSmartFillAPIHealth,
  testSmartFillAPIConnection,
  getSmartFillCustomers,
  type SmartFillLocation,
  type SmartFillSyncResult,
  type SmartFillAPIHealth,
  type SmartFillCustomer
} from '@/services/smartfill-api';

// Combined health and data status
export interface SmartFillSystemStatus {
  data: SmartFillLocation[];
  apiHealth: SmartFillAPIHealth;
  lastSyncTime: string | null;
  dataAge: number; // minutes since last sync
  hasData: boolean;
  isStale: boolean; // data is >60 minutes old
  isHealthy: boolean; // API is working
  needsAttention: boolean; // requires manual intervention
}

// Hook to get SmartFill API health status
export function useSmartFillAPIHealth() {
  return useQuery({
    queryKey: ['smartfill-api-health'],
    queryFn: getSmartFillAPIHealth,
    refetchInterval: 60 * 1000, // Check every minute
    staleTime: 30 * 1000, // 30 seconds stale time
  });
}

// Hook to test API connectivity
export function useSmartFillAPITest() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: testSmartFillAPIConnection,
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: "SmartFill API Connection Test",
          description: `✅ SmartFill API is available (${result.responseTime}ms response time, ${result.dataCount} tanks)`,
        });
      } else {
        toast({
          title: "SmartFill API Connection Test Failed",
          description: `❌ ${result.error}`,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "SmartFill API Test Error",
        description: `Failed to test API: ${error.message}`,
        variant: "destructive",
      });
    },
  });
}

// Hook to get SmartFill customers
export function useSmartFillCustomers() {
  return useQuery({
    queryKey: ['smartfill-customers'],
    queryFn: getSmartFillCustomers,
    staleTime: 10 * 60 * 1000, // Customer data doesn't change often
  });
}

// Enhanced hook to get all SmartFill locations with health context
export function useSmartFillLocations() {
  return useQuery({
    queryKey: ['smartfill-locations'],
    queryFn: getSmartFillLocations,
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes cache time
    retry: (failureCount, error) => {
      // Don't retry if it's a configuration error
      if (error.message.includes('Invalid or missing SmartFill API credentials')) {
        return false;
      }
      // Retry up to 3 times for other errors
      return failureCount < 3;
    },
  });
}

// Hook to get sync logs
export function useSmartFillSyncLogs(limit?: number) {
  return useQuery({
    queryKey: ['smartfill-sync-logs', limit],
    queryFn: () => getSmartFillSyncLogs(limit),
    refetchInterval: 2 * 60 * 1000, // Check for new logs every 2 minutes
  });
}

// Hook to sync SmartFill data
export function useSmartFillSync() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<SmartFillSyncResult, Error, void>({
    mutationFn: syncSmartFillData,
    onSuccess: (result) => {
      // Invalidate and refetch SmartFill data
      queryClient.invalidateQueries({ queryKey: ['smartfill-locations'] });
      queryClient.invalidateQueries({ queryKey: ['smartfill-sync-logs'] });

      // Show appropriate toast based on results
      if (result.success) {
        toast({
          title: 'SmartFill sync successful',
          description: `Processed ${result.locationsProcessed} locations and ${result.tanksProcessed} tanks in ${result.duration}ms`,
        });
      } else {
        toast({
          title: 'SmartFill sync completed with errors',
          description: `${result.locationsProcessed} locations processed, ${result.errors.length} errors occurred`,
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'SmartFill sync failed',
        description: error.message || 'Failed to sync SmartFill data',
        variant: 'destructive',
      });
    },
  });
}

// Hook to get summary statistics
export function useSmartFillSummary() {
  const { data: locations, isLoading } = useSmartFillLocations();
  
  if (isLoading || !locations) {
    return {
      totalCustomers: 0,
      totalLocations: 0,
      totalTanks: 0,
      averageFillPercentage: 0,
      lowFuelCount: 0,
      totalCapacity: 0,
      totalVolume: 0,
      isLoading
    };
  }

  const allTanks = locations.flatMap(location => {
    if (Array.isArray(location.tanks)) {
      return location.tanks;
    }
    console.warn('[SMARTFILL] Location tanks is not an array:', location.tanks);
    return [];
  });
  
  const fillPercentages = allTanks
    .map(tank => tank?.latest_volume_percent)
    .filter(percentage => percentage !== null && percentage !== undefined && typeof percentage === 'number');
  
  const averageFillPercentage = fillPercentages.length > 0 
    ? fillPercentages.reduce((sum, percentage) => sum + percentage, 0) / fillPercentages.length
    : 0;

  const lowFuelCount = fillPercentages.filter(percentage => percentage < 20).length;

  const totalCapacity = allTanks
    .map(tank => tank.capacity || 0)
    .reduce((sum, capacity) => sum + capacity, 0);

  const totalVolume = allTanks
    .map(tank => tank.latest_volume || 0)
    .reduce((sum, volume) => sum + volume, 0);

  // Count unique customers
  const uniqueCustomers = new Set(locations.map(loc => loc.customer_name)).size;

  return {
    totalCustomers: uniqueCustomers,
    totalLocations: locations.length,
    totalTanks: allTanks.length,
    averageFillPercentage: Math.round(averageFillPercentage * 10) / 10,
    lowFuelCount,
    totalCapacity: Math.round(totalCapacity),
    totalVolume: Math.round(totalVolume),
    isLoading: false
  };
}

// Hook to get fuel level color based on volume percentage
export function useSmartFillPercentageColor(percentage: number | null | undefined): string {
  if (percentage === null || percentage === undefined) {
    return 'text-gray-400';
  }

  if (percentage < 20) {
    return 'text-red-600';
  } else if (percentage < 50) {
    return 'text-yellow-600';
  } else {
    return 'text-green-600';
  }
}

// Hook to get percentage background color for progress bars
export function useSmartFillPercentageBackground(percentage: number | null | undefined): string {
  if (percentage === null || percentage === undefined) {
    return 'bg-gray-200';
  }

  if (percentage < 20) {
    return 'bg-red-500';
  } else if (percentage < 50) {
    return 'bg-yellow-500';
  } else {
    return 'bg-green-500';
  }
}

import { formatRelativeTime, formatAustralianDate } from '@/utils/dateFormatting';

// Helper function to format SmartFill timestamp (Australian timezone)
export function formatSmartFillTimestamp(timestamp: string | null): string {
  if (!timestamp) return 'No data';

  try {
    return formatRelativeTime(timestamp);
  } catch (error) {
    return 'Invalid date';
  }
}

// Helper function to calculate ullage (remaining capacity)
export function calculateUllage(capacity: number | null, volume: number | null, safeLevel?: number | null): number {
  if (!capacity || !volume) return 0;
  
  if (safeLevel && safeLevel > 0) {
    return Math.max(0, safeLevel - volume);
  }
  
  return Math.max(0, capacity - volume);
}

// Hook to filter locations by various criteria
export function useFilteredSmartFillLocations(filters: {
  lowFuelOnly?: boolean;
  customerName?: string;
  unitNumber?: string;
  tankStatus?: string;
}) {
  const { data: locations, ...rest } = useSmartFillLocations();

  const filteredLocations = locations?.filter(location => {
    // Filter by customer name
    if (filters.customerName && !location.customer_name?.toLowerCase().includes(filters.customerName.toLowerCase())) {
      return false;
    }

    // Filter by unit number
    if (filters.unitNumber && !location.unit_number?.toLowerCase().includes(filters.unitNumber.toLowerCase())) {
      return false;
    }

    // Filter by low fuel (if location or any tank has <20%)
    if (filters.lowFuelOnly) {
      const hasLowFuel = location.latest_volume_percent < 20 ||
        (location.tanks || []).some(tank => tank.latest_volume_percent < 20);
      if (!hasLowFuel) {
        return false;
      }
    }

    // Filter by tank status
    if (filters.tankStatus) {
      const hasMatchingStatus = location.latest_status === filters.tankStatus ||
        (location.tanks || []).some(tank => tank.latest_status === filters.tankStatus);
      if (!hasMatchingStatus) {
        return false;
      }
    }

    return true;
  });

  return {
    data: filteredLocations,
    ...rest
  };
}

// Hook to get tanks that need attention (low fuel, errors, stale data)
export function useSmartFillAlertsAndActions() {
  const { data: locations } = useSmartFillLocations();
  const { data: syncLogs } = useSmartFillSyncLogs(5);

  if (!locations) {
    return {
      lowFuelTanks: [],
      staleTanks: [],
      errorTanks: [],
      recentErrors: [],
      actionItems: []
    };
  }

  const allTanks = locations.flatMap(location => 
    (location.tanks || []).map(tank => ({
      ...tank,
      locationName: location.description,
      customerName: location.customer_name
    }))
  );

  const lowFuelTanks = allTanks.filter(tank => tank.latest_volume_percent < 20);
  
  const staleTanks = allTanks.filter(tank => {
    if (!tank.latest_update_time) return true;
    const hoursSinceUpdate = (Date.now() - new Date(tank.latest_update_time).getTime()) / (1000 * 60 * 60);
    return hoursSinceUpdate > 24; // More than 24 hours old
  });

  const errorTanks = allTanks.filter(tank => 
    tank.latest_status && tank.latest_status.toLowerCase().includes('error')
  );

  const recentErrors = syncLogs?.filter(log => 
    log.sync_status === 'failed' || log.error_message
  ).slice(0, 3) || [];

  // Generate action items
  const actionItems = [
    ...lowFuelTanks.map(tank => ({
      type: 'low_fuel' as const,
      priority: 'high' as const,
      message: `${tank.customerName} - Unit ${tank.unit_number}, Tank ${tank.tank_number} is at ${tank.latest_volume_percent}%`,
      tank
    })),
    ...staleTanks.map(tank => ({
      type: 'stale_data' as const,
      priority: 'medium' as const,
      message: `${tank.customerName} - Unit ${tank.unit_number}, Tank ${tank.tank_number} hasn't updated since ${formatSmartFillTimestamp(tank.latest_update_time)}`,
      tank
    })),
    ...errorTanks.map(tank => ({
      type: 'error' as const,
      priority: 'high' as const,
      message: `${tank.customerName} - Unit ${tank.unit_number}, Tank ${tank.tank_number} status: ${tank.latest_status}`,
      tank
    }))
  ].sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });

  return {
    lowFuelTanks,
    staleTanks,
    errorTanks,
    recentErrors,
    actionItems
  };
}

// Hook to get SmartFill system health overview
export function useSmartFillSystemHealth(): SmartFillSystemStatus {
  const { data: locations } = useSmartFillLocations();
  const { data: apiHealth } = useSmartFillAPIHealth();
  const { data: syncLogs } = useSmartFillSyncLogs(1);

  const lastSuccessfulSync = syncLogs?.find(log => log.sync_status === 'success');
  const lastSyncTime = lastSuccessfulSync?.completed_at || null;
  
  const dataAge = lastSyncTime 
    ? Math.floor((Date.now() - new Date(lastSyncTime).getTime()) / (1000 * 60))
    : 0;

  const hasData = locations && locations.length > 0;
  const isStale = dataAge > 60; // Data is more than 1 hour old
  const isHealthy = apiHealth?.status === 'available';
  const needsAttention = !isHealthy || isStale || (locations && locations.length === 0);

  return {
    data: locations || [],
    apiHealth: apiHealth || { status: 'unknown', lastSuccessfulCall: null, lastError: null, consecutiveFailures: 0 },
    lastSyncTime,
    dataAge,
    hasData: !!hasData,
    isStale,
    isHealthy,
    needsAttention
  };
}