import { useQuery } from '@tanstack/react-query';
import { useTanks } from '@/hooks/useTanks';
import { useAgbotLocations } from '@/hooks/useAgbotData';
import { AgbotLocation } from '@/services/agbot-api';
import { Tank } from '@/hooks/useTanks';

// Enhanced map item interface that can represent both tanks and agbot devices
export interface MapItem {
  id: string;
  location: string;
  latitude?: number;
  longitude?: number;
  current_level_percent?: number | null;
  group_name?: string;
  product_type?: string;
  latest_dip_date?: string | null;
  source: 'manual' | 'agbot';
  
  // Manual tank specific fields
  safe_level?: number;
  min_level?: number;
  current_level?: number;
  days_to_min_level?: number | null;
  rolling_avg?: number;
  prev_day_used?: number;
  subgroup?: string;
  address?: string;
  vehicle?: string;
  
  // Agbot specific fields
  device_online?: boolean;
  installation_status?: number;
  installation_status_label?: string;
  location_status?: number;
  location_status_label?: string;
  customer_name?: string;
  assets?: any[];
  
  // For modal integration
  originalData?: Tank | AgbotLocation;
}

// Transform manual tank to map item
function transformTankToMapItem(tank: Tank): MapItem {
  return {
    id: tank.id,
    location: tank.location,
    latitude: tank.latitude,
    longitude: tank.longitude,
    current_level_percent: tank.current_level_percent,
    group_name: tank.group_name,
    product_type: tank.product_type,
    latest_dip_date: tank.last_dip_ts,
    source: 'manual',
    
    // Tank specific fields
    safe_level: tank.safe_level,
    min_level: tank.min_level,
    current_level: tank.current_level,
    days_to_min_level: tank.days_to_min_level,
    rolling_avg: tank.rolling_avg,
    prev_day_used: tank.prev_day_used,
    subgroup: tank.subgroup,
    address: tank.address,
    vehicle: tank.vehicle,
    
    originalData: tank
  };
}

// Transform agbot location to map item
function transformAgbotToMapItem(agbotLocation: AgbotLocation): MapItem {
  const mainAsset = agbotLocation.assets?.[0];
  const isOnline = agbotLocation.location_status === 2 && (mainAsset?.device_online ?? false);
  
  return {
    id: agbotLocation.id,
    location: agbotLocation.location_id || 'Unknown Location',
    latitude: agbotLocation.lat,
    longitude: agbotLocation.lng,
    current_level_percent: agbotLocation.latest_calibrated_fill_percentage ?? mainAsset?.latest_calibrated_fill_percentage,
    group_name: agbotLocation.customer_name,
    product_type: 'Agbot Monitored',
    latest_dip_date: agbotLocation.latest_telemetry,
    source: 'agbot',
    
    // Agbot specific fields
    device_online: isOnline,
    installation_status: agbotLocation.installation_status,
    installation_status_label: agbotLocation.installation_status_label,
    location_status: agbotLocation.location_status,
    location_status_label: agbotLocation.location_status_label,
    customer_name: agbotLocation.customer_name,
    assets: agbotLocation.assets,
    
    originalData: agbotLocation
  };
}

// Enhanced hook that provides both tank and agbot data for map display
export const useMapData = () => {
  const tanksQuery = useTanks();
  const agbotQuery = useAgbotLocations();

  // Combine data from both sources
  const combinedQuery = useQuery({
    queryKey: ['map-data', tanksQuery.data, agbotQuery.data],
    queryFn: async () => {
      const tanks = tanksQuery.data || [];
      const agbotLocations = agbotQuery.data || [];

      // Transform tanks to map items
      const tankMapItems = tanks
        .filter(tank => tank.latitude && tank.longitude)
        .map(transformTankToMapItem);

      // Transform agbot locations to map items
      const agbotMapItems = agbotLocations
        .filter(location => location.lat && location.lng)
        .map(transformAgbotToMapItem);

      return {
        allItems: [...tankMapItems, ...agbotMapItems],
        manualTanks: tankMapItems,
        agbotDevices: agbotMapItems,
        counts: {
          total: tankMapItems.length + agbotMapItems.length,
          manual: tankMapItems.length,
          agbot: agbotMapItems.length
        }
      };
    },
    enabled: !!tanksQuery.data || !!agbotQuery.data,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Calculate loading and error states
  const isLoading = tanksQuery.isLoading || agbotQuery.isLoading || combinedQuery.isLoading;
  const error = tanksQuery.error || agbotQuery.error || combinedQuery.error;

  return {
    data: combinedQuery.data,
    allItems: combinedQuery.data?.allItems || [],
    manualTanks: combinedQuery.data?.manualTanks || [],
    agbotDevices: combinedQuery.data?.agbotDevices || [],
    counts: combinedQuery.data?.counts || { total: 0, manual: 0, agbot: 0 },
    isLoading,
    error,
    refetch: () => {
      tanksQuery.refetch();
      agbotQuery.refetch();
      combinedQuery.refetch();
    },
    
    // Individual query states for debugging
    tanksQuery,
    agbotQuery,
    
    // Utility functions
    invalidate: () => {
      tanksQuery.invalidate();
      // agbotQuery uses React Query, so we need to invalidate using the same method
      // This will be handled by the respective hooks
    },
    
    // Get unique groups for filtering
    getUniqueGroups: () => {
      const allItems = combinedQuery.data?.allItems || [];
      const groups = allItems
        .map(item => item.group_name)
        .filter(Boolean) as string[];
      return Array.from(new Set(groups)).sort();
    },
    
    // Get unique product types for filtering
    getUniqueProductTypes: () => {
      const allItems = combinedQuery.data?.allItems || [];
      const types = allItems
        .map(item => item.product_type)
        .filter(Boolean) as string[];
      return Array.from(new Set(types)).sort();
    }
  };
};

// Export types for use in other components
export type { MapItem };