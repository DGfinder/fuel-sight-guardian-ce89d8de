import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { formatRelativeTime as formatRelativeTimeUtil, formatAustralianDateTime } from '@/utils/dateFormatting';
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
import { 
  formatPerthRelativeTime, 
  formatPerthDisplay, 
  getDeviceStatus, 
  validateTimestamp,
  normalizeToPerthString 
} from '@/utils/timezone';

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

// Enhanced hook to get comprehensive fleet summary statistics
export function useAgbotSummary() {
  const { data: locations, isLoading } = useAgbotLocations();
  
  if (isLoading || !locations) {
    return {
      totalLocations: 0,
      totalAssets: 0,
      onlineAssets: 0,
      averageFillPercentage: 0,
      lowFuelCount: 0,
      criticalCount: 0,
      totalCapacity: 0,
      currentFuelVolume: 0,
      fleetUtilization: 0,
      dailyConsumption: 0,
      estimatedDaysRemaining: 0,
      categories: { agricultural: 0, commercial: 0 },
      isLoading
    };
  }

  const allAssets = locations.flatMap(location => {
    if (Array.isArray(location.assets)) {
      return location.assets;
    }
    console.warn('[AGBOT] Location assets is not an array:', location.assets);
    return [];
  });
  const onlineAssets = allAssets.filter(asset => asset?.device_online);
  
  // Enhanced calculations
  const fillPercentages = allAssets
    .map(asset => asset?.latest_calibrated_fill_percentage)
    .filter(percentage => percentage !== null && percentage !== undefined && typeof percentage === 'number');
  
  const averageFillPercentage = fillPercentages.length > 0 
    ? fillPercentages.reduce((sum, percentage) => sum + percentage, 0) / fillPercentages.length
    : 0;

  const lowFuelCount = fillPercentages.filter(percentage => percentage < 20 && percentage > 0).length;
  const criticalCount = fillPercentages.filter(percentage => percentage === 0).length;
  
  // Calculate capacity and fuel volumes from asset data
  let totalCapacity = 0;
  let currentFuelVolume = 0;
  let totalDailyConsumption = 0;
  let locationsWithConsumption = 0;
  
  const categories = { agricultural: 0, commercial: 0 };

  locations.forEach(location => {
    // Get capacity from location raw_data or asset fields
    const mainAsset = location.assets?.[0];
    const capacityFromName = mainAsset?.asset_profile_name?.match(/[\d,]+/)?.[0]?.replace(/,/g, '');
    const capacity = location.raw_data?.AssetProfileWaterCapacity ||
                    mainAsset?.asset_profile_water_capacity ||
                    mainAsset?.asset_refill_capacity_litres ||
                    (capacityFromName ? parseInt(capacityFromName) : 50000); // Default to 50,000L

    const percentage = location.latest_calibrated_fill_percentage ?? mainAsset?.latest_calibrated_fill_percentage ?? 0;
    const currentVolume = (percentage / 100) * capacity;

    totalCapacity += capacity;
    currentFuelVolume += currentVolume;

    // Daily consumption from asset or location data
    const dailyConsumption = mainAsset?.asset_daily_consumption || location.location_daily_consumption;
    if (dailyConsumption && dailyConsumption > 0) {
      totalDailyConsumption += dailyConsumption;
      locationsWithConsumption++;
    }

    // Categorize locations
    const isCommercial = location.location_id?.toLowerCase().includes('depot') ||
                        location.address1?.toLowerCase().includes('depot');
    if (isCommercial) {
      categories.commercial++;
    } else {
      categories.agricultural++;
    }
  });
  
  const fleetUtilization = totalCapacity > 0 ? (currentFuelVolume / totalCapacity) * 100 : 0;
  const estimatedDaysRemaining = totalDailyConsumption > 0 && currentFuelVolume > 0 
    ? Math.round(currentFuelVolume / totalDailyConsumption) 
    : null;

  return {
    totalLocations: locations.length,
    totalAssets: allAssets.length,
    onlineAssets: onlineAssets.length,
    averageFillPercentage: Math.round(averageFillPercentage * 10) / 10,
    lowFuelCount,
    criticalCount,
    totalCapacity: Math.round(totalCapacity),
    currentFuelVolume: Math.round(currentFuelVolume),
    fleetUtilization: Math.round(fleetUtilization * 10) / 10,
    dailyConsumption: Math.round(totalDailyConsumption * 100) / 100,
    estimatedDaysRemaining,
    categories,
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

// Helper function to format timestamp with Australian timezone (Perth/AWST default)
export function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) return 'No data';

  try {
    return formatRelativeTimeUtil(timestamp);
  } catch (error) {
    console.error('Error formatting timestamp:', error, timestamp);
    return 'Invalid date';
  }
}

// Helper function to get device online status with proper Perth timezone logic
export function getDeviceOnlineStatus(lastReading: string | null) {
  if (!lastReading) {
    return {
      isOnline: false,
      status: 'no-data',
      displayText: 'No Data',
      colorClass: 'text-gray-500 bg-gray-100',
      lastSeenText: 'No data available'
    };
  }

  const deviceStatus = getDeviceStatus(lastReading);
  
  return {
    isOnline: deviceStatus.status === 'online',
    status: deviceStatus.status,
    displayText: deviceStatus.displayText,
    colorClass: deviceStatus.colorClass,
    lastSeenText: formatPerthRelativeTime(lastReading),
    minutesAgo: deviceStatus.minutesAgo
  };
}

// Helper function to format full Perth timestamp
export function formatPerthTimestampDisplay(timestamp: string | null): string {
  if (!timestamp) return 'No data';
  
  try {
    return formatPerthDisplay(timestamp);
  } catch (error) {
    console.error('Error formatting Perth timestamp:', error, timestamp);
    return 'Invalid date';
  }
}

// Data quality validation helper
export function validateLocationData(location: any): {
  hasIssues: boolean;
  issues: string[];
  severity: 'low' | 'medium' | 'high';
} {
  const issues: string[] = [];
  let severity: 'low' | 'medium' | 'high' = 'low';

  // Validate timestamp
  if (location.last_reading_time) {
    const validation = validateTimestamp(location.last_reading_time);
    if (validation.isFuture) {
      issues.push('Last reading is in the future (timezone issue)');
      severity = 'high';
    }
    if (validation.isStale) {
      issues.push('Data is more than 4 hours old');
      if (severity === 'low') severity = 'medium';
    }
    if (!validation.isValid) {
      issues.push('Invalid timestamp format');
      severity = 'high';
    }
    issues.push(...validation.issues);
  } else {
    issues.push('No last reading time available');
    if (severity === 'low') severity = 'medium';
  }

  // Validate fuel level data
  if (location.latest_calibrated_fill_percentage > 100) {
    issues.push('Fuel level over 100% (sensor issue?)');
    severity = 'high';
  }
  
  if (location.latest_calibrated_fill_percentage < 0) {
    issues.push('Negative fuel level (sensor issue?)');
    severity = 'high';
  }

  return {
    hasIssues: issues.length > 0,
    issues,
    severity
  };
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

    // Filter by online status using proper device status logic
    if (filters.onlineOnly) {
      const deviceStatus = getDeviceOnlineStatus(location.last_reading_time);
      if (!deviceStatus.isOnline) {
        return false;
      }
    }

    // Filter by low fuel (if location or any asset has <20%)
    if (filters.lowFuelOnly) {
      const locationHasLowFuel = location.latest_calibrated_fill_percentage < 20;
      const assetsArray = Array.isArray(location.assets) ? location.assets : [];
      const assetsHaveLowFuel = assetsArray.some(asset => asset?.latest_calibrated_fill_percentage < 20);
      
      if (!locationHasLowFuel && !assetsHaveLowFuel) {
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