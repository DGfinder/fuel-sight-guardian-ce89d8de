import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { 
  getAgbotLocations, 
  getAgbotLocation, 
  syncAgbotData, 
  getAgbotSyncLogs,
  getAtharaAPIHealth,
  testAtharaAPIConnection,
  type AgbotLocation,
  type AgbotSyncResult,
  type AtharaAPIHealth
} from '@/services/agbot-api';

// Combined health and data status
export interface AgbotSystemStatus {
  data: AgbotLocation[];
  apiHealth: AtharaAPIHealth;
  lastSyncTime: string | null;
  dataAge: number; // minutes since last sync
  hasData: boolean;
  isStale: boolean; // data is >60 minutes old
  isHealthy: boolean; // API is working
  needsAttention: boolean; // requires manual intervention
}

// Hook to get Athara API health status
export function useAtharaAPIHealth() {
  return useQuery({
    queryKey: ['athara-api-health'],
    queryFn: getAtharaAPIHealth,
    refetchInterval: 60 * 1000, // Check every minute
    staleTime: 30 * 1000, // 30 seconds stale time
  });
}

// Hook to test API connectivity
export function useAtharaAPITest() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: testAtharaAPIConnection,
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: "API Connection Test",
          description: `✅ Athara API is available (${result.responseTime}ms response time)`,
        });
      } else {
        toast({
          title: "API Connection Test Failed",
          description: `❌ ${result.error}`,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "API Test Error",
        description: `Failed to test API: ${error.message}`,
        variant: "destructive",
      });
    },
  });
}

// Enhanced hook to get all agbot locations with health context
export function useAgbotLocations() {
  return useQuery({
    queryKey: ['agbot-locations'],
    queryFn: getAgbotLocations,
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes for hourly cellular data
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes cache time
    retry: (failureCount, error) => {
      // Don't retry if it's a configuration error
      if (error.message.includes('Invalid or missing Athara API key')) {
        return false;
      }
      // Retry up to 3 times for other errors
      return failureCount < 3;
    },
  });
}

// Hook to get a specific agbot location
export function useAgbotLocation(locationId: string) {
  return useQuery({
    queryKey: ['agbot-location', locationId],
    queryFn: () => getAgbotLocation(locationId),
    enabled: !!locationId,
    refetchInterval: 10 * 60 * 1000, // 10 minutes for hourly data
    staleTime: 5 * 60 * 1000, // 5 minutes stale time
  });
}

// Hook to get sync logs
export function useAgbotSyncLogs(limit?: number) {
  return useQuery({
    queryKey: ['agbot-sync-logs', limit],
    queryFn: () => getAgbotSyncLogs(limit),
    refetchInterval: 2 * 60 * 1000, // Check for new logs every 2 minutes
  });
}

// Hook to sync agbot data
export function useAgbotSync() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<AgbotSyncResult, Error, void>({
    mutationFn: syncAgbotData,
    onSuccess: (result) => {
      // Invalidate and refetch agbot data
      queryClient.invalidateQueries({ queryKey: ['agbot-locations'] });
      queryClient.invalidateQueries({ queryKey: ['agbot-sync-logs'] });

      // Show appropriate toast based on results
      if (result.success) {
        toast({
          title: 'Sync successful',
          description: `Processed ${result.locationsProcessed} locations and ${result.assetsProcessed} assets in ${result.duration}ms`,
        });
      } else {
        toast({
          title: 'Sync completed with errors',
          description: `${result.locationsProcessed} locations processed, ${result.errors.length} errors occurred`,
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Sync failed',
        description: error.message || 'Failed to sync agbot data',
        variant: 'destructive',
      });
    },
  });
}

// Hook to get summary statistics
export function useAgbotSummary() {
  const { data: locations, isLoading } = useAgbotLocations();
  
  if (isLoading || !locations) {
    return {
      totalLocations: 0,
      totalAssets: 0,
      onlineAssets: 0,
      averageFillPercentage: 0,
      lowFuelCount: 0,
      isLoading
    };
  }

  const allAssets = locations.flatMap(location => location.assets || []);
  const onlineAssets = allAssets.filter(asset => asset.device_online);
  const fillPercentages = allAssets
    .map(asset => asset.latest_calibrated_fill_percentage)
    .filter(percentage => percentage !== null && percentage !== undefined);
  
  const averageFillPercentage = fillPercentages.length > 0 
    ? fillPercentages.reduce((sum, percentage) => sum + percentage, 0) / fillPercentages.length
    : 0;

  const lowFuelCount = fillPercentages.filter(percentage => percentage < 20).length;

  return {
    totalLocations: locations.length,
    totalAssets: allAssets.length,
    onlineAssets: onlineAssets.length,
    averageFillPercentage: Math.round(averageFillPercentage * 10) / 10,
    lowFuelCount,
    isLoading: false
  };
}

// Hook to get percentage color based on fuel level
export function usePercentageColor(percentage: number | null | undefined): string {
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
export function usePercentageBackground(percentage: number | null | undefined): string {
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

// Helper function to format timestamp
export function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) return 'No data';
  
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  } catch (error) {
    return 'Invalid date';
  }
}

// Hook to filter locations by status, percentage, etc.
export function useFilteredAgbotLocations(filters: {
  onlineOnly?: boolean;
  lowFuelOnly?: boolean;
  customerName?: string;
}) {
  const { data: locations, ...rest } = useAgbotLocations();

  const filteredLocations = locations?.filter(location => {
    // Filter by customer name
    if (filters.customerName && !location.customer_name?.toLowerCase().includes(filters.customerName.toLowerCase())) {
      return false;
    }

    // Filter by online status
    if (filters.onlineOnly && location.location_status !== 2) {
      return false;
    }

    // Filter by low fuel (if location or any asset has <20%)
    if (filters.lowFuelOnly) {
      const hasLowFuel = location.latest_calibrated_fill_percentage < 20 ||
        (location.assets || []).some(asset => asset.latest_calibrated_fill_percentage < 20);
      if (!hasLowFuel) {
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