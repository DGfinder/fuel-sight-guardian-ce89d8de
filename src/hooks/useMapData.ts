import { useMemo } from 'react';
import { useTanks } from '@/hooks/useTanks';
import { useAgbotLocations } from '@/hooks/useAgbotData';
import { useSmartFillLocations } from '@/hooks/useSmartFillData';
import { AgbotLocation } from '@/services/agbot-api';
import { SmartFillLocation } from '@/services/smartfill-api';
import { Tank } from '@/hooks/useTanks';

// Enhanced map item interface that can represent tanks, agbot devices, and smartfill locations
export interface MapItem {
  id: string;
  location: string;
  latitude?: number;
  longitude?: number;
  current_level_percent?: number | null;
  group_name?: string;
  product_type?: string;
  latest_dip_date?: string | null;
  source: 'manual' | 'agbot' | 'smartfill';
  
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
  
  // SmartFill specific fields
  unit_number?: string;
  timezone?: string;
  tanks?: any[];
  
  // For modal integration
  originalData?: Tank | AgbotLocation | SmartFillLocation;
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

// Transform smartfill location to map item
function transformSmartFillToMapItem(smartfillLocation: SmartFillLocation): MapItem {
  // Calculate overall fill percentage from all tanks
  const tanks = Array.isArray(smartfillLocation.tanks) ? smartfillLocation.tanks : [];
  const tankFillPercentages = tanks
    .map(tank => tank?.latest_volume_percent)
    .filter(percent => typeof percent === 'number');
  
  const averageFillPercent = tankFillPercentages.length > 0
    ? tankFillPercentages.reduce((sum, percent) => sum + percent, 0) / tankFillPercentages.length
    : smartfillLocation.latest_volume_percent;

  return {
    id: smartfillLocation.id,
    location: smartfillLocation.description || `Unit ${smartfillLocation.unit_number}`,
    latitude: smartfillLocation.latitude,
    longitude: smartfillLocation.longitude,
    current_level_percent: averageFillPercent,
    group_name: smartfillLocation.customer_name,
    product_type: 'SmartFill Monitored',
    latest_dip_date: smartfillLocation.latest_update_time,
    source: 'smartfill',
    
    // SmartFill specific fields
    unit_number: smartfillLocation.unit_number,
    timezone: smartfillLocation.timezone,
    customer_name: smartfillLocation.customer_name,
    tanks: smartfillLocation.tanks,
    
    originalData: smartfillLocation
  };
}

// Enhanced hook that provides tank, agbot, and smartfill data for map display
export const useMapData = () => {
  const tanksQuery = useTanks();
  const agbotQuery = useAgbotLocations();
  const smartfillQuery = useSmartFillLocations();

  // Combine and transform data using useMemo (stable, no cache thrashing)
  const combinedData = useMemo(() => {
    const tanks = tanksQuery.data || [];
    const agbotLocations = agbotQuery.data || [];
    const smartfillLocations = smartfillQuery.data || [];

    // Transform tanks to map items
    const tankMapItems = tanks
      .filter(tank => tank.latitude && tank.longitude)
      .map(transformTankToMapItem);

    // Transform agbot locations to map items
    const agbotMapItems = agbotLocations
      .filter(location => location.lat && location.lng)
      .map(transformAgbotToMapItem);

    // Transform smartfill locations to map items (only those with GPS coordinates)
    const smartfillMapItems = smartfillLocations
      .filter(location => location.latitude && location.longitude)
      .map(transformSmartFillToMapItem);

    return {
      allItems: [...tankMapItems, ...agbotMapItems, ...smartfillMapItems],
      manualTanks: tankMapItems,
      agbotDevices: agbotMapItems,
      smartfillLocations: smartfillMapItems,
      counts: {
        total: tankMapItems.length + agbotMapItems.length + smartfillMapItems.length,
        manual: tankMapItems.length,
        agbot: agbotMapItems.length,
        smartfill: smartfillMapItems.length
      }
    };
  }, [tanksQuery.data, agbotQuery.data, smartfillQuery.data]);

  // Calculate loading and error states
  const isLoading = tanksQuery.isLoading || agbotQuery.isLoading || smartfillQuery.isLoading;
  const error = tanksQuery.error || agbotQuery.error || smartfillQuery.error;

  return {
    data: combinedData,
    allItems: combinedData.allItems,
    manualTanks: combinedData.manualTanks,
    agbotDevices: combinedData.agbotDevices,
    smartfillLocations: combinedData.smartfillLocations,
    counts: combinedData.counts,
    isLoading,
    error,
    refetch: () => {
      tanksQuery.refetch();
      agbotQuery.refetch();
      smartfillQuery.refetch();
    },

    // Individual query states for debugging
    tanksQuery,
    agbotQuery,
    smartfillQuery,

    // Utility functions
    invalidate: () => {
      tanksQuery.invalidate();
      // agbotQuery and smartfillQuery use React Query, so we need to invalidate using the same method
      // This will be handled by the respective hooks
    },

    // Get unique groups for filtering
    getUniqueGroups: () => {
      const groups = combinedData.allItems
        .map(item => item.group_name)
        .filter(Boolean) as string[];
      return Array.from(new Set(groups)).sort();
    },

    // Get unique product types for filtering
    getUniqueProductTypes: () => {
      const types = combinedData.allItems
        .map(item => item.product_type)
        .filter(Boolean) as string[];
      return Array.from(new Set(types)).sort();
    },

    // Get unique sources for filtering
    getUniqueSources: () => {
      const sources = combinedData.allItems
        .map(item => item.source)
        .filter(Boolean) as string[];
      return Array.from(new Set(sources)).sort();
    }
  };
};

// Export types for use in other components
export type { MapItem };