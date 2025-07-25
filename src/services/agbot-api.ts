import { supabase } from '@/lib/supabase';

// Athara API configuration
const ATHARA_API_KEY = '9PAUTYO9U7VZTXD40T62VNB7KJOZQZ10C8M1';
const ATHARA_BASE_URL = 'https://api.athara.com'; // Replace with actual base URL

// TypeScript interfaces based on actual API response
export interface AtharaLocation {
  id: string;
  customerName: string;
  customerGuid: string;
  locationGuid: string;
  locationId: string;
  address1: string;
  address2: string;
  state: string;
  postcode: string;
  country: string;
  latestCalibratedFillPercentage: number;
  installationStatusLabel: string;
  installationStatus: number;
  locationStatusLabel: string;
  locationStatus: number;
  latestTelemetryEpoch: number;
  latestTelemetry: string;
  lat: number;
  lng: number;
  disabled: boolean;
  assets: AtharaAsset[];
}

export interface AtharaAsset {
  assetGuid: string;
  assetSerialNumber: string;
  assetDisabled: boolean;
  assetProfileGuid: string;
  assetProfileName: string;
  deviceGuid: string;
  deviceSerialNumber: string;
  deviceId: string;
  deviceSKUGuid: string;
  deviceSensorGuid: string;
  deviceState: number;
  deviceStateLabel: string;
  helmetSerialNumber: string | null;
  subscriptionId: string;
  deviceSKUModel: number;
  deviceSKUName: string;
  deviceModelLabel: string;
  deviceModel: number;
  deviceOnline: boolean;
  deviceActivationDate: string;
  deviceActivationEpoch: number;
  deviceLatestTelemetryEventTimestamp: string;
  deviceLatestTelemetryEventEpoch: number;
  latestCalibratedFillPercentage: number;
  latestRawFillPercentage: number;
  latestTelemetryEventTimestamp: string;
  latestTelemetryEventEpoch: number;
  latestCoordinationUpdateTimestamp: string;
  latestReportedLat: number;
  latestReportedLng: number;
  myriotaDetails: any;
}

// Database types for our system
export interface AgbotLocation {
  id: string;
  location_guid: string;
  customer_name: string;
  customer_guid: string;
  location_id: string;
  address1: string;
  address2: string;
  state: string;
  postcode: string;
  country: string;
  latest_calibrated_fill_percentage: number;
  installation_status: number;
  installation_status_label: string;
  location_status: number;
  location_status_label: string;
  latest_telemetry_epoch: number;
  latest_telemetry: string;
  lat: number;
  lng: number;
  disabled: boolean;
  assets?: AgbotAsset[];
  created_at: string;
  updated_at: string;
}

export interface AgbotAsset {
  id: string;
  location_id: string;
  asset_guid: string;
  asset_serial_number: string;
  asset_disabled: boolean;
  device_serial_number: string;
  device_sku_model: number;
  device_sku_name: string;
  device_online: boolean;
  latest_calibrated_fill_percentage: number;
  latest_raw_fill_percentage: number;
  latest_telemetry_event_timestamp: string;
  created_at: string;
  updated_at: string;
}

export interface AgbotSyncResult {
  success: boolean;
  locationsProcessed: number;
  assetsProcessed: number;
  readingsProcessed: number;
  errors: string[];
  duration: number;
}

// Fetch data from Athara API
export async function fetchAtharaLocations(): Promise<AtharaLocation[]> {
  try {
    // For now, return mock data based on the JSON structure provided
    // Replace this with actual API call when endpoint is available
    const mockData: AtharaLocation = {
      id: "7840e8ab-48aa-4671-8108-45e30d200e6c",
      customerName: "Great Southern Fuel Supplies",
      customerGuid: "9d2a7cfa-530c-4048-b595-c1cb1cca61e3",
      locationGuid: "f0ef812f-9c1c-4c62-ac85-4497e9ec3cff",
      locationId: "Bruce Rock Diesel",
      address1: "1 Johnson Street",
      address2: "Bruce Rock",
      state: "Western Australia",
      postcode: "",
      country: "Western Australia",
      latestCalibratedFillPercentage: 56.36,
      installationStatusLabel: "Installed",
      installationStatus: 2,
      locationStatusLabel: "Online",
      locationStatus: 2,
      latestTelemetryEpoch: 1753401600000,
      latestTelemetry: "2025-07-25T00:00:00+00:00",
      lat: -31.87491,
      lng: 118.14936,
      disabled: false,
      assets: [{
        assetGuid: "708cfc39-19cc-4808-abc9-cd32029f8e84",
        assetSerialNumber: "Bruce Rock Diesel",
        assetDisabled: false,
        assetProfileGuid: "79d86490-cd44-46de-aec9-ceeac9e1ce10",
        assetProfileName: "Bruce Rock Diesel",
        deviceGuid: "c23009c9-ad68-4616-a020-b40267b69fc4",
        deviceSerialNumber: "0000100402",
        deviceId: "867280066307927",
        deviceSKUGuid: "82a483e4-e085-49df-8763-d4ef9c91db2e",
        deviceSensorGuid: "d5897c30-f991-4d9a-b27d-47e2ce437366",
        deviceState: 1,
        deviceStateLabel: "Active",
        helmetSerialNumber: null,
        subscriptionId: "1nLp9UbUnxHwi841Z",
        deviceSKUModel: 43111,
        deviceSKUName: "Agbot Cellular 43111",
        deviceModelLabel: "Nebula_Red",
        deviceModel: 3,
        deviceOnline: true,
        deviceActivationDate: "2025-07-09T03:53:04+00:00",
        deviceActivationEpoch: 1752033184000,
        deviceLatestTelemetryEventTimestamp: "2025-07-25T01:50:23+00:00",
        deviceLatestTelemetryEventEpoch: 1753408223000,
        latestCalibratedFillPercentage: 56.36,
        latestRawFillPercentage: 54.43,
        latestTelemetryEventTimestamp: "2025-07-25T01:50:23+00:00",
        latestTelemetryEventEpoch: 1753408223000,
        latestCoordinationUpdateTimestamp: "2025-07-22T06:14:13.6335+00:00",
        latestReportedLat: -31.874852,
        latestReportedLng: 118.149362,
        myriotaDetails: null
      }]
    };

    // TODO: Replace with actual API call
    // const response = await fetch(`${ATHARA_BASE_URL}/locations`, {
    //   headers: {
    //     'Authorization': `Bearer ${ATHARA_API_KEY}`,
    //     'Content-Type': 'application/json'
    //   }
    // });
    // 
    // if (!response.ok) {
    //   throw new Error(`Athara API error: ${response.status}`);
    // }
    // 
    // const data = await response.json();
    // return data;

    return [mockData];
  } catch (error) {
    console.error('Error fetching Athara locations:', error);
    throw error;
  }
}

// Transform Athara API data to our database format
function transformLocationData(atharaLocation: AtharaLocation) {
  return {
    location_guid: atharaLocation.locationGuid,
    customer_name: atharaLocation.customerName,
    customer_guid: atharaLocation.customerGuid,
    location_id: atharaLocation.locationId,
    address1: atharaLocation.address1,
    address2: atharaLocation.address2,
    state: atharaLocation.state,
    postcode: atharaLocation.postcode,
    country: atharaLocation.country,
    latest_calibrated_fill_percentage: atharaLocation.latestCalibratedFillPercentage,
    installation_status: atharaLocation.installationStatus,
    installation_status_label: atharaLocation.installationStatusLabel,
    location_status: atharaLocation.locationStatus,
    location_status_label: atharaLocation.locationStatusLabel,
    latest_telemetry_epoch: atharaLocation.latestTelemetryEpoch,
    latest_telemetry: atharaLocation.latestTelemetry,
    lat: atharaLocation.lat,
    lng: atharaLocation.lng,
    disabled: atharaLocation.disabled,
    raw_data: atharaLocation
  };
}

function transformAssetData(atharaAsset: AtharaAsset, locationId: string) {
  return {
    location_id: locationId,
    asset_guid: atharaAsset.assetGuid,
    asset_serial_number: atharaAsset.assetSerialNumber,
    asset_disabled: atharaAsset.assetDisabled,
    asset_profile_guid: atharaAsset.assetProfileGuid,
    asset_profile_name: atharaAsset.assetProfileName,
    device_guid: atharaAsset.deviceGuid,
    device_serial_number: atharaAsset.deviceSerialNumber,
    device_id: atharaAsset.deviceId,
    device_sku_guid: atharaAsset.deviceSKUGuid,
    device_sku_model: atharaAsset.deviceSKUModel,
    device_sku_name: atharaAsset.deviceSKUName,
    device_model_label: atharaAsset.deviceModelLabel,
    device_model: atharaAsset.deviceModel,
    device_online: atharaAsset.deviceOnline,
    device_activation_date: atharaAsset.deviceActivationDate,
    device_activation_epoch: atharaAsset.deviceActivationEpoch,
    latest_calibrated_fill_percentage: atharaAsset.latestCalibratedFillPercentage,
    latest_raw_fill_percentage: atharaAsset.latestRawFillPercentage,
    latest_telemetry_event_timestamp: atharaAsset.latestTelemetryEventTimestamp,
    latest_telemetry_event_epoch: atharaAsset.latestTelemetryEventEpoch,
    latest_reported_lat: atharaAsset.latestReportedLat,
    latest_reported_lng: atharaAsset.latestReportedLng,
    subscription_id: atharaAsset.subscriptionId,
    raw_data: atharaAsset
  };
}

// Sync data from Athara API to our database
export async function syncAgbotData(): Promise<AgbotSyncResult> {
  const startTime = Date.now();
  const result: AgbotSyncResult = {
    success: false,
    locationsProcessed: 0,
    assetsProcessed: 0,
    readingsProcessed: 0,
    errors: [],
    duration: 0
  };

  try {
    // Log sync start
    const { data: syncLog } = await supabase
      .from('agbot_sync_logs')
      .insert({
        sync_type: 'manual',
        sync_status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    // Fetch data from Athara API
    const atharaLocations = await fetchAtharaLocations();

    for (const atharaLocation of atharaLocations) {
      try {
        // Upsert location
        const locationData = transformLocationData(atharaLocation);
        const { data: location, error: locationError } = await supabase
          .from('agbot_locations')
          .upsert(locationData, { 
            onConflict: 'location_guid',
            ignoreDuplicates: false 
          })
          .select()
          .single();

        if (locationError) {
          result.errors.push(`Location error: ${locationError.message}`);
          continue;
        }

        result.locationsProcessed++;

        // Process assets for this location
        for (const atharaAsset of atharaLocation.assets) {
          try {
            const assetData = transformAssetData(atharaAsset, location.id);
            const { error: assetError } = await supabase
              .from('agbot_assets')
              .upsert(assetData, { 
                onConflict: 'asset_guid',
                ignoreDuplicates: false 
              });

            if (assetError) {
              result.errors.push(`Asset error: ${assetError.message}`);
              continue;
            }

            result.assetsProcessed++;

            // Store historical reading
            const { error: readingError } = await supabase
              .from('agbot_readings_history')
              .insert({
                asset_id: assetData.asset_guid, // Will need to get actual ID
                calibrated_fill_percentage: atharaAsset.latestCalibratedFillPercentage,
                raw_fill_percentage: atharaAsset.latestRawFillPercentage,
                reading_timestamp: atharaAsset.latestTelemetryEventTimestamp,
                device_online: atharaAsset.deviceOnline,
                telemetry_epoch: atharaAsset.latestTelemetryEventEpoch
              });

            if (!readingError) {
              result.readingsProcessed++;
            }
          } catch (assetError) {
            result.errors.push(`Asset processing error: ${assetError}`);
          }
        }
      } catch (locationError) {
        result.errors.push(`Location processing error: ${locationError}`);
      }
    }

    result.success = result.errors.length === 0;
    result.duration = Date.now() - startTime;

    // Update sync log
    if (syncLog) {
      await supabase
        .from('agbot_sync_logs')
        .update({
          sync_status: result.success ? 'success' : 'partial',
          locations_processed: result.locationsProcessed,
          assets_processed: result.assetsProcessed,
          readings_processed: result.readingsProcessed,
          error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
          sync_duration_ms: result.duration,
          completed_at: new Date().toISOString()
        })
        .eq('id', syncLog.id);
    }

    return result;
  } catch (error) {
    result.errors.push(`Sync error: ${error}`);
    result.duration = Date.now() - startTime;
    return result;
  }
}

// Get all agbot locations with assets
export async function getAgbotLocations(): Promise<AgbotLocation[]> {
  const { data, error } = await supabase
    .from('agbot_locations')
    .select(`
      *,
      assets:agbot_assets(*)
    `)
    .order('location_id');

  if (error) {
    console.error('Error fetching agbot locations:', error);
    throw error;
  }

  return data || [];
}

// Get specific location with detailed asset information
export async function getAgbotLocation(locationId: string): Promise<AgbotLocation | null> {
  const { data, error } = await supabase
    .from('agbot_locations')
    .select(`
      *,
      assets:agbot_assets(*)
    `)
    .eq('id', locationId)
    .single();

  if (error) {
    console.error('Error fetching agbot location:', error);
    return null;
  }

  return data;
}

// Get recent sync logs
export async function getAgbotSyncLogs(limit: number = 10) {
  const { data, error } = await supabase
    .from('agbot_sync_logs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching sync logs:', error);
    throw error;
  }

  return data || [];
}

// Historical data and analytics functions

// Get historical readings for an asset
export async function getAgbotReadingsHistory(
  assetId: string, 
  days: number = 30
): Promise<any[]> {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - days);

  const { data, error } = await supabase
    .from('agbot_readings_history')
    .select('*')
    .eq('asset_id', assetId)
    .gte('reading_timestamp', daysAgo.toISOString())
    .order('reading_timestamp', { ascending: true });

  if (error) {
    console.error('Error fetching agbot readings history:', error);
    throw error;
  }

  return data || [];
}

// Get readings for multiple assets at once
export async function getBulkAgbotReadingsHistory(
  assetIds: string[], 
  days: number = 30
): Promise<Record<string, any[]>> {
  if (assetIds.length === 0) return {};

  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - days);

  const { data, error } = await supabase
    .from('agbot_readings_history')
    .select('*')
    .in('asset_id', assetIds)
    .gte('reading_timestamp', daysAgo.toISOString())
    .order('reading_timestamp', { ascending: true });

  if (error) {
    console.error('Error fetching bulk agbot readings history:', error);
    throw error;
  }

  // Group readings by asset_id
  const groupedReadings: Record<string, any[]> = {};
  assetIds.forEach(id => {
    groupedReadings[id] = [];
  });

  (data || []).forEach(reading => {
    if (groupedReadings[reading.asset_id]) {
      groupedReadings[reading.asset_id].push(reading);
    }
  });

  return groupedReadings;
}

// Get latest readings for all assets (for real-time dashboard)
export async function getLatestAgbotReadings(): Promise<any[]> {
  const { data, error } = await supabase
    .from('agbot_readings_history')
    .select(`
      *,
      asset:agbot_assets(
        *,
        location:agbot_locations(*)
      )
    `)
    .order('reading_timestamp', { ascending: false });

  if (error) {
    console.error('Error fetching latest agbot readings:', error);
    throw error;
  }

  // Get the latest reading for each asset
  const latestByAsset = new Map();
  (data || []).forEach(reading => {
    if (!latestByAsset.has(reading.asset_id)) {
      latestByAsset.set(reading.asset_id, reading);
    }
  });

  return Array.from(latestByAsset.values());
}

// Store historical reading (used during sync)
export async function storeAgbotReading(reading: {
  asset_id: string;
  calibrated_fill_percentage: number;
  raw_fill_percentage: number;
  reading_timestamp: string;
  device_online: boolean;
  telemetry_epoch: number;
}) {
  const { data, error } = await supabase
    .from('agbot_readings_history')
    .insert(reading)
    .select()
    .single();

  if (error) {
    console.error('Error storing agbot reading:', error);
    throw error;
  }

  return data;
}

// Get consumption statistics for a location
export async function getLocationConsumptionStats(
  locationId: string,
  days: number = 30
): Promise<{
  avgDailyConsumption: number;
  totalConsumption: number;
  consumptionTrend: 'increasing' | 'decreasing' | 'stable';
  refillEvents: number;
}> {
  // Get all assets for this location
  const { data: assets, error: assetsError } = await supabase
    .from('agbot_assets')
    .select('asset_guid')
    .eq('location_id', locationId);

  if (assetsError) {
    console.error('Error fetching assets for location:', assetsError);
    throw assetsError;
  }

  if (!assets || assets.length === 0) {
    return {
      avgDailyConsumption: 0,
      totalConsumption: 0,
      consumptionTrend: 'stable',
      refillEvents: 0
    };
  }

  // Get readings for all assets
  const assetIds = assets.map(a => a.asset_guid);
  const readingsData = await getBulkAgbotReadingsHistory(assetIds, days);
  
  // Combine all readings and sort by timestamp
  const allReadings = Object.values(readingsData)
    .flat()
    .sort((a, b) => new Date(a.reading_timestamp).getTime() - new Date(b.reading_timestamp).getTime());

  if (allReadings.length < 2) {
    return {
      avgDailyConsumption: 0,
      totalConsumption: 0,
      consumptionTrend: 'stable',
      refillEvents: 0
    };
  }

  // Calculate basic statistics
  let totalConsumption = 0;
  let refillEvents = 0;
  const consumptionRates: number[] = [];

  for (let i = 1; i < allReadings.length; i++) {
    const older = allReadings[i - 1];
    const newer = allReadings[i];
    
    const percentageChange = older.calibrated_fill_percentage - newer.calibrated_fill_percentage;
    const hoursBetween = (new Date(newer.reading_timestamp).getTime() - new Date(older.reading_timestamp).getTime()) / (1000 * 60 * 60);
    
    if (percentageChange > 0 && hoursBetween > 0) {
      // Consumption
      totalConsumption += percentageChange;
      const dailyRate = (percentageChange / hoursBetween) * 24;
      consumptionRates.push(dailyRate);
    } else if (percentageChange < -10) {
      // Likely refill event (10%+ increase)
      refillEvents++;
    }
  }

  const avgDailyConsumption = consumptionRates.length > 0 
    ? consumptionRates.reduce((sum, rate) => sum + rate, 0) / consumptionRates.length
    : 0;

  // Determine trend by comparing first and second half of data
  const midpoint = Math.floor(consumptionRates.length / 2);
  const firstHalfAvg = midpoint > 0 
    ? consumptionRates.slice(0, midpoint).reduce((sum, rate) => sum + rate, 0) / midpoint
    : 0;
  const secondHalfAvg = midpoint > 0 && consumptionRates.length > midpoint
    ? consumptionRates.slice(midpoint).reduce((sum, rate) => sum + rate, 0) / (consumptionRates.length - midpoint)
    : 0;

  let consumptionTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (firstHalfAvg > 0 && secondHalfAvg > 0) {
    const trendChange = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;
    if (trendChange > 0.1) {
      consumptionTrend = 'increasing';
    } else if (trendChange < -0.1) {
      consumptionTrend = 'decreasing';
    }
  }

  return {
    avgDailyConsumption: Number(avgDailyConsumption.toFixed(2)),
    totalConsumption: Number(totalConsumption.toFixed(2)),
    consumptionTrend,
    refillEvents
  };
}

// Get system-wide analytics summary
export async function getAgbotSystemSummary(): Promise<{
  totalLocations: number;
  totalAssets: number;
  onlineDevices: number;
  avgSystemReliability: number;
  locationsNeedingAttention: number;
  systemEfficiencyScore: number;
}> {
  // Get all locations with assets
  const { data: locations, error } = await supabase
    .from('agbot_locations')
    .select(`
      *,
      assets:agbot_assets(*)
    `);

  if (error) {
    console.error('Error fetching system summary:', error);
    throw error;
  }

  if (!locations || locations.length === 0) {
    return {
      totalLocations: 0,
      totalAssets: 0,
      onlineDevices: 0,
      avgSystemReliability: 0,
      locationsNeedingAttention: 0,
      systemEfficiencyScore: 0
    };
  }

  const allAssets = locations.flatMap(loc => loc.assets || []);
  const onlineDevices = allAssets.filter(asset => asset.device_online).length;
  const avgSystemReliability = allAssets.length > 0 
    ? (onlineDevices / allAssets.length) * 100 
    : 0;

  // Count locations needing attention (low fuel or offline devices)
  const locationsNeedingAttention = locations.filter(loc => {
    const hasLowFuel = loc.latest_calibrated_fill_percentage < 25;
    const hasOfflineDevices = (loc.assets || []).some(asset => !asset.device_online);
    return hasLowFuel || hasOfflineDevices;
  }).length;

  // Calculate basic efficiency score (placeholder - would be enhanced with actual consumption data)
  const systemEfficiencyScore = Math.max(0, 100 - (locationsNeedingAttention / locations.length) * 50);

  return {
    totalLocations: locations.length,
    totalAssets: allAssets.length,
    onlineDevices,
    avgSystemReliability: Number(avgSystemReliability.toFixed(1)),
    locationsNeedingAttention,
    systemEfficiencyScore: Number(systemEfficiencyScore.toFixed(1))
  };
}