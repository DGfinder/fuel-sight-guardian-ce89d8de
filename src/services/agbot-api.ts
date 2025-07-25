import { supabase } from '@/lib/supabase';

// Athara API configuration - with environment variable support
const ATHARA_API_KEY = import.meta.env.VITE_ATHARA_API_KEY || '9PAUTYO9U7VZTXD40T62VNB7KJOZQZ10C8M1';
const ATHARA_BASE_URL = import.meta.env.VITE_ATHARA_BASE_URL || 'https://api.athara.com'; // TODO: Verify actual Athara API base URL

// Development flags
const ENABLE_API_LOGGING = import.meta.env.VITE_ENABLE_AGBOT_API_LOGGING !== 'false'; // Default to true

// API Health Status
export type AtharaAPIStatus = 'available' | 'unavailable' | 'error' | 'unknown';

export interface AtharaAPIHealth {
  status: AtharaAPIStatus;
  lastSuccessfulCall: string | null;
  lastError: string | null;
  consecutiveFailures: number;
}

// API request configuration
const ATHARA_REQUEST_CONFIG = {
  timeout: 30000, // 30 second timeout
  retries: 3,
  retryDelay: 1000, // 1 second between retries
};

// Helper function for making authenticated API requests with retry logic
async function makeAtharaRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${ATHARA_BASE_URL}${endpoint}`;
  
  const requestOptions: RequestInit = {
    ...options,
    headers: {
      'Authorization': `Bearer ${ATHARA_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    signal: AbortSignal.timeout(ATHARA_REQUEST_CONFIG.timeout),
  };

  let lastError: Error;

  for (let attempt = 1; attempt <= ATHARA_REQUEST_CONFIG.retries; attempt++) {
    try {
      if (ENABLE_API_LOGGING) {
        console.log(`[ATHARA API] Attempt ${attempt}/${ATHARA_REQUEST_CONFIG.retries}: ${endpoint}`);
      }
      
      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Athara API error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      if (ENABLE_API_LOGGING) {
        console.log(`[ATHARA API] Success: ${endpoint} - ${data.length || 1} items`);
      }
      return data;
      
    } catch (error) {
      lastError = error as Error;
      console.warn(`[ATHARA API] Attempt ${attempt} failed:`, error);
      
      // Don't retry on authentication errors (401, 403)
      if (error instanceof Error && error.message.includes('401') || error.message.includes('403')) {
        throw new Error(`Athara API authentication failed: ${error.message}`);
      }
      
      // Wait before retrying (except on last attempt)
      if (attempt < ATHARA_REQUEST_CONFIG.retries) {
        await new Promise(resolve => setTimeout(resolve, ATHARA_REQUEST_CONFIG.retryDelay * attempt));
      }
    }
  }

  throw new Error(`Athara API request failed after ${ATHARA_REQUEST_CONFIG.retries} attempts: ${lastError.message}`);
}

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

// API Health Tracking (in-memory for now, could be moved to database)
let apiHealthStatus: AtharaAPIHealth = {
  status: 'unknown',
  lastSuccessfulCall: null,
  lastError: null,
  consecutiveFailures: 0
};

// Function to update API health status
function updateAPIHealth(success: boolean, error?: string): void {
  if (success) {
    apiHealthStatus = {
      status: 'available',
      lastSuccessfulCall: new Date().toISOString(),
      lastError: null,
      consecutiveFailures: 0
    };
  } else {
    apiHealthStatus = {
      status: 'error',
      lastSuccessfulCall: apiHealthStatus.lastSuccessfulCall,
      lastError: error || 'Unknown error',
      consecutiveFailures: apiHealthStatus.consecutiveFailures + 1
    };
    
    // Mark as unavailable after multiple consecutive failures
    if (apiHealthStatus.consecutiveFailures >= 3) {
      apiHealthStatus.status = 'unavailable';
    }
  }
}

// Get current API health status
export function getAtharaAPIHealth(): AtharaAPIHealth {
  return { ...apiHealthStatus };
}

// PRODUCTION SAFE: Fetch data from Athara API - NO MOCK DATA FALLBACKS
export async function fetchAtharaLocations(): Promise<AtharaLocation[]> {
  // Validate API configuration before attempting call
  if (!ATHARA_API_KEY || ATHARA_API_KEY === 'your-api-key-here') {
    const error = 'CRITICAL: Invalid or missing Athara API key. Check VITE_ATHARA_API_KEY environment variable.';
    updateAPIHealth(false, error);
    throw new Error(error);
  }

  try {
    if (ENABLE_API_LOGGING) {
      console.log('[ATHARA API] Fetching data from Athara API...');
    }
    
    // Attempt real API call
    const data = await makeAtharaRequest('/locations');
    
    // Validate the response structure
    if (!Array.isArray(data)) {
      const error = 'Invalid Athara API response: expected array of locations';
      updateAPIHealth(false, error);
      throw new Error(error);
    }
    
    // Update health status on success
    updateAPIHealth(true);
    
    if (ENABLE_API_LOGGING) {
      console.log(`[ATHARA API] Successfully fetched ${data.length} locations from Athara API`);
    }
    
    return data;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    updateAPIHealth(false, errorMessage);
    
    console.error('[ATHARA API] CRITICAL: API call failed - NO MOCK DATA AVAILABLE:', error);
    
    // Re-throw the error instead of using mock data
    // This forces the application to handle the error appropriately
    throw new Error(`Athara API unavailable: ${errorMessage}`);
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
  
  console.log('\n' + '='.repeat(60));
  console.log('🔄 AGBOT SYNC STARTED');
  console.log('='.repeat(60));

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

    // Fetch data from Athara API - will throw error if API unavailable
    const atharaLocations = await fetchAtharaLocations();
    
    // Comprehensive logging of API response
    console.log('\n📊 API RESPONSE ANALYSIS:');
    console.log('-'.repeat(40));
    console.log(`Total Locations Received: ${atharaLocations.length}`);
    
    let totalAssetsInResponse = 0;
    const customerAssetCounts: Record<string, number> = {};
    
    atharaLocations.forEach((loc) => {
      const assetCount = loc.assets?.length || 0;
      totalAssetsInResponse += assetCount;
      customerAssetCounts[loc.customerName] = (customerAssetCounts[loc.customerName] || 0) + assetCount;
    });
    
    console.log(`Total Assets/Tanks in Response: ${totalAssetsInResponse}`);
    console.log('\nAssets by Customer:');
    Object.entries(customerAssetCounts).forEach(([customer, count]) => {
      console.log(`  ${customer}: ${count} tanks`);
    });
    console.log('-'.repeat(40) + '\n');

    for (const atharaLocation of atharaLocations) {
      try {
        console.log(`\n📍 Processing Location: ${atharaLocation.customerName} - ${atharaLocation.locationId}`);
        console.log(`   GUID: ${atharaLocation.locationGuid}`);
        console.log(`   Assets to process: ${atharaLocation.assets?.length || 0}`);
        
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
          const errorMsg = `Location error for ${atharaLocation.customerName}: ${locationError.message}`;
          console.error(`   ❌ ${errorMsg}`);
          result.errors.push(errorMsg);
          console.log(`   ⚠️  Skipping ${atharaLocation.assets?.length || 0} assets due to location error`);
          continue;
        }

        console.log(`   ✅ Location saved (ID: ${location.id})`);
        result.locationsProcessed++;

        // Process assets for this location
        console.log(`   Processing ${atharaLocation.assets?.length || 0} assets...`);
        let assetsSuccessful = 0;
        let assetsFailed = 0;
        
        for (const atharaAsset of atharaLocation.assets) {
          try {
            const assetData = transformAssetData(atharaAsset, location.id);
            console.log(`      - Asset ${atharaAsset.deviceSerialNumber} (${atharaAsset.deviceOnline ? 'online' : 'offline'})`);
            
            const { error: assetError } = await supabase
              .from('agbot_assets')
              .upsert(assetData, { 
                onConflict: 'asset_guid',
                ignoreDuplicates: false 
              });

            if (assetError) {
              const errorMsg = `Asset ${atharaAsset.deviceSerialNumber} error: ${assetError.message}`;
              console.error(`        ❌ ${errorMsg}`);
              result.errors.push(errorMsg);
              assetsFailed++;
              continue;
            }

            assetsSuccessful++;
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
            const errorMsg = `Asset processing error: ${assetError}`;
            console.error(`        ❌ ${errorMsg}`);
            result.errors.push(errorMsg);
            assetsFailed++;
          }
        }
        
        console.log(`   📊 Assets Summary: ${assetsSuccessful} successful, ${assetsFailed} failed`);
        
      } catch (locationError) {
        const errorMsg = `Location processing error for ${atharaLocation.customerName}: ${locationError}`;
        console.error(`\n❌ ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }

    result.success = result.errors.length === 0;
    result.duration = Date.now() - startTime;

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 SYNC SUMMARY:');
    console.log('-'.repeat(40));
    console.log(`Status: ${result.success ? '✅ SUCCESS' : '⚠️  PARTIAL SUCCESS'}`);
    console.log(`Duration: ${result.duration}ms`);
    console.log(`\nProcessed:`);
    console.log(`  Locations: ${result.locationsProcessed}/${atharaLocations.length}`);
    console.log(`  Assets: ${result.assetsProcessed}/${totalAssetsInResponse}`);
    console.log(`  Readings: ${result.readingsProcessed}`);
    
    if (result.errors.length > 0) {
      console.log(`\n⚠️  Errors (${result.errors.length}):`);
      result.errors.slice(0, 5).forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
      if (result.errors.length > 5) {
        console.log(`  ... and ${result.errors.length - 5} more errors`);
      }
    }
    
    console.log('='.repeat(60) + '\n');

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
    console.error('\n❌ SYNC FAILED:', error);
    return result;
  }
}

// Test real API connectivity (for troubleshooting)
export async function testAtharaAPIConnection(): Promise<{
  success: boolean;
  responseTime: number;
  error?: string;
  dataCount?: number;
  apiHealth: AtharaAPIHealth;
}> {
  const startTime = Date.now();
  
  try {
    console.log('[ATHARA API TEST] Testing connection to Athara API...');
    
    const data = await makeAtharaRequest('/locations');
    const responseTime = Date.now() - startTime;
    
    return {
      success: true,
      responseTime,
      dataCount: Array.isArray(data) ? data.length : 1,
      apiHealth: getAtharaAPIHealth()
    };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('[ATHARA API TEST] Connection test failed:', error);
    
    return {
      success: false,
      responseTime,
      error: error instanceof Error ? error.message : String(error),
      apiHealth: getAtharaAPIHealth()
    };
  }
}

// Force immediate sync with Athara API (for manual/testing operations)
export async function syncAgbotDataFromAPI(): Promise<AgbotSyncResult> {
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
    if (ENABLE_API_LOGGING) {
      console.log('[AGBOT SYNC] Initiating manual sync with Athara API');
    }
    
    // Test API connection first
    const connectionTest = await testAtharaAPIConnection();
    if (!connectionTest.success) {
      result.errors.push(`API connection failed: ${connectionTest.error}`);
      result.duration = Date.now() - startTime;
      return result;
    }
    
    // Log sync start
    const { data: syncLog } = await supabase
      .from('agbot_sync_logs')
      .insert({
        sync_type: 'manual_api_sync',
        sync_status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    // Fetch data from Athara API
    const atharaLocations = await fetchAtharaLocations();
    
    if (ENABLE_API_LOGGING) {
      console.log(`[AGBOT SYNC] Fetched ${atharaLocations.length} locations from Athara API`);
    }

    // Process locations (same logic as regular sync)
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

        // Process assets
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

            // Store reading
            if (atharaAsset.latestTelemetryEventTimestamp) {
              const readingData = {
                asset_id: atharaAsset.assetGuid,
                calibrated_fill_percentage: atharaAsset.latestCalibratedFillPercentage,
                raw_fill_percentage: atharaAsset.latestRawFillPercentage,
                reading_timestamp: atharaAsset.latestTelemetryEventTimestamp,
                device_online: atharaAsset.deviceOnline,
                telemetry_epoch: atharaAsset.latestTelemetryEventEpoch
              };

              await storeAgbotReading(readingData);
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

    result.success = result.locationsProcessed > 0 && result.errors.length === 0;
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

    if (ENABLE_API_LOGGING) {
      console.log('[AGBOT SYNC] Manual API sync completed:', result);
    }

    return result;
  } catch (error) {
    result.errors.push(`API sync error: ${error}`);
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

// CSV Import functionality for Athara Dashboard exports

export interface AgbotCSVImportResult {
  success: boolean;
  locationsImported: number;
  assetsImported: number;
  readingsImported: number;
  errors: string[];
  duration: number;
}

// Transform CSV row data to database location format
function transformCSVLocationData(csvRow: any) {
  // Parse date strings and handle empty values
  const parseDate = (dateStr: string) => {
    if (!dateStr || dateStr.trim() === '') return null;
    try {
      // Handle format: "25/07/2025, 12:00:00 pm"
      const [datePart, timePart] = dateStr.split(', ');
      if (!datePart || !timePart) return null;
      
      const [day, month, year] = datePart.split('/');
      const [time, period] = timePart.split(' ');
      const [hours, minutes, seconds] = time.split(':');
      
      let hour24 = parseInt(hours);
      if (period?.toLowerCase() === 'pm' && hour24 !== 12) hour24 += 12;
      if (period?.toLowerCase() === 'am' && hour24 === 12) hour24 = 0;
      
      const isoDate = new Date(
        parseInt(year), 
        parseInt(month) - 1, 
        parseInt(day), 
        hour24, 
        parseInt(minutes), 
        parseInt(seconds || '0')
      ).toISOString();
      
      return isoDate;
    } catch (e) {
      console.warn('Failed to parse date:', dateStr, e);
      return null;
    }
  };

  // Generate a unique location_guid from location ID
  const locationGuid = `csv-import-${csvRow.locationId.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;

  return {
    location_guid: locationGuid,
    customer_name: csvRow.tenancy || 'Unknown Customer',
    customer_guid: `customer-${csvRow.tenancy?.replace(/\s+/g, '-').toLowerCase() || 'unknown'}`,
    location_id: csvRow.locationId,
    address1: csvRow.streetAddress || '',
    address2: '',
    state: csvRow.state || '',
    postcode: '',
    country: 'Australia', // Default for Athara data
    latest_calibrated_fill_percentage: parseFloat(csvRow.locationLevel) || 0,
    installation_status: csvRow.locationStatus?.toLowerCase() === 'installed' ? 1 : 0,
    installation_status_label: csvRow.locationStatus || 'Unknown',
    location_status: csvRow.locationStatus?.toLowerCase() === 'installed' ? 1 : 0,
    location_status_label: csvRow.locationStatus || 'Unknown',
    latest_telemetry_epoch: Date.now(),
    latest_telemetry: parseDate(csvRow.lastSeen) || new Date().toISOString(),
    lat: null, // Not available in CSV
    lng: null, // Not available in CSV
    disabled: csvRow.assetDisabled?.toLowerCase() === 'yes',
    raw_data: csvRow // Store complete CSV row for reference
  };
}

// Transform CSV row data to database asset format
function transformCSVAssetData(csvRow: any, locationId: string) {
  const parseDate = (dateStr: string) => {
    if (!dateStr || dateStr.trim() === '') return null;
    try {
      const [datePart, timePart] = dateStr.split(', ');
      if (!datePart || !timePart) return null;
      
      const [day, month, year] = datePart.split('/');
      const [time, period] = timePart.split(' ');
      const [hours, minutes, seconds] = time.split(':');
      
      let hour24 = parseInt(hours);
      if (period?.toLowerCase() === 'pm' && hour24 !== 12) hour24 += 12;
      if (period?.toLowerCase() === 'am' && hour24 === 12) hour24 = 0;
      
      return new Date(
        parseInt(year), 
        parseInt(month) - 1, 
        parseInt(day), 
        hour24, 
        parseInt(minutes), 
        parseInt(seconds || '0')
      ).toISOString();
    } catch (e) {
      return null;
    }
  };

  // Generate unique asset_guid from asset serial number
  const assetGuid = `csv-asset-${csvRow.assetSerialNumber?.replace(/\s+/g, '-') || 'unknown'}-${Date.now()}`;

  return {
    location_id: locationId,
    asset_guid: assetGuid,
    asset_serial_number: csvRow.assetSerialNumber || '',
    asset_disabled: csvRow.assetDisabled?.toLowerCase() === 'yes',
    asset_profile_guid: `profile-${csvRow.assetProfile?.replace(/\s+/g, '-').toLowerCase() || 'unknown'}`,
    asset_profile_name: csvRow.assetProfile || '',
    device_guid: `device-${csvRow.deviceSerialNumber?.replace(/\s+/g, '-') || 'unknown'}-${Date.now()}`,
    device_serial_number: csvRow.deviceSerialNumber || '',
    device_id: csvRow.deviceId || '',
    device_sku_guid: `sku-${csvRow.deviceSku || 'unknown'}`,
    device_sku_model: parseInt(csvRow.deviceSku) || 0,
    device_sku_name: csvRow.deviceModel || '',
    device_model_label: csvRow.deviceModel || '',
    device_model: parseInt(csvRow.deviceSku) || 0,
    device_online: csvRow.deviceOnline?.toLowerCase() === 'yes',
    device_activation_date: parseDate(csvRow.deviceActivation),
    device_activation_epoch: parseDate(csvRow.deviceActivation) ? 
      new Date(parseDate(csvRow.deviceActivation)!).getTime() : null,
    latest_calibrated_fill_percentage: parseFloat(csvRow.locationLevel) || 0,
    latest_raw_fill_percentage: parseFloat(csvRow.rawTelemetries) || parseFloat(csvRow.locationLevel) || 0,
    latest_telemetry_event_timestamp: parseDate(csvRow.deviceLastSeen) || parseDate(csvRow.assetLastSeen),
    latest_telemetry_event_epoch: parseDate(csvRow.deviceLastSeen) ? 
      new Date(parseDate(csvRow.deviceLastSeen)!).getTime() : Date.now(),
    latest_reported_lat: null, // Not available in CSV
    latest_reported_lng: null, // Not available in CSV
    subscription_id: csvRow.deviceSubscription || '',
    raw_data: csvRow // Store complete CSV row for reference
  };
}

// Import Agbot data from CSV
export async function importAgbotFromCSV(csvRows: any[]): Promise<AgbotCSVImportResult> {
  const startTime = Date.now();
  const result: AgbotCSVImportResult = {
    success: false,
    locationsImported: 0,
    assetsImported: 0,
    readingsImported: 0,
    errors: [],
    duration: 0
  };

  console.log('\n' + '='.repeat(60));
  console.log('📁 AGBOT CSV IMPORT STARTED');
  console.log('='.repeat(60));
  console.log(`Processing ${csvRows.length} CSV rows...`);

  try {
    // Log import start
    const { data: syncLog } = await supabase
      .from('agbot_sync_logs')
      .insert({
        sync_type: 'csv_import',
        sync_status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    // Process each CSV row
    for (let i = 0; i < csvRows.length; i++) {
      const csvRow = csvRows[i];
      
      try {
        console.log(`\n📍 Processing Row ${i + 1}: ${csvRow.locationId}`);
        
        // Transform and upsert location
        const locationData = transformCSVLocationData(csvRow);
        const { data: location, error: locationError } = await supabase
          .from('agbot_locations')
          .upsert(locationData, { 
            onConflict: 'location_guid',
            ignoreDuplicates: false 
          })
          .select()
          .single();

        if (locationError) {
          const errorMsg = `Location error for ${csvRow.locationId}: ${locationError.message}`;
          console.error(`   ❌ ${errorMsg}`);
          result.errors.push(errorMsg);
          continue;
        }

        console.log(`   ✅ Location imported (ID: ${location.id})`);
        result.locationsImported++;

        // Transform and upsert asset
        const assetData = transformCSVAssetData(csvRow, location.id);
        const { data: asset, error: assetError } = await supabase
          .from('agbot_assets')
          .upsert(assetData, { 
            onConflict: 'asset_guid',
            ignoreDuplicates: false 
          })
          .select()
          .single();

        if (assetError) {
          const errorMsg = `Asset error for ${csvRow.assetSerialNumber}: ${assetError.message}`;
          console.error(`   ❌ ${errorMsg}`);
          result.errors.push(errorMsg);
          continue;
        }

        console.log(`   ✅ Asset imported (${csvRow.assetSerialNumber})`);
        result.assetsImported++;

        // Create historical reading entry
        const readingData = {
          asset_id: asset.id, // Use the actual asset ID from database
          calibrated_fill_percentage: parseFloat(csvRow.locationLevel) || 0,
          raw_fill_percentage: parseFloat(csvRow.rawTelemetries) || parseFloat(csvRow.locationLevel) || 0,
          reading_timestamp: assetData.latest_telemetry_event_timestamp || new Date().toISOString(),
          device_online: csvRow.deviceOnline?.toLowerCase() === 'yes',
          telemetry_epoch: assetData.latest_telemetry_event_epoch || Date.now()
        };

        const { error: readingError } = await supabase
          .from('agbot_readings_history')
          .insert(readingData);

        if (!readingError) {
          result.readingsImported++;
          console.log(`   ✅ Reading imported (${csvRow.locationLevel}%)`);
        } else {
          console.warn(`   ⚠️  Reading error: ${readingError.message}`);
        }

      } catch (rowError) {
        const errorMsg = `Row ${i + 1} processing error: ${rowError}`;
        console.error(`   ❌ ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }

    result.success = result.locationsImported > 0;
    result.duration = Date.now() - startTime;

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 CSV IMPORT SUMMARY:');
    console.log('-'.repeat(40));
    console.log(`Status: ${result.success ? '✅ SUCCESS' : '⚠️  PARTIAL SUCCESS'}`);
    console.log(`Duration: ${result.duration}ms`);
    console.log(`\nImported:`);
    console.log(`  Locations: ${result.locationsImported}/${csvRows.length}`);
    console.log(`  Assets: ${result.assetsImported}/${csvRows.length}`);
    console.log(`  Readings: ${result.readingsImported}/${csvRows.length}`);
    
    if (result.errors.length > 0) {
      console.log(`\n⚠️  Errors (${result.errors.length}):`);
      result.errors.slice(0, 5).forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
      if (result.errors.length > 5) {
        console.log(`  ... and ${result.errors.length - 5} more errors`);
      }
    }
    
    console.log('='.repeat(60) + '\n');

    // Update sync log
    if (syncLog) {
      await supabase
        .from('agbot_sync_logs')
        .update({
          sync_status: result.success ? 'success' : 'partial',
          locations_processed: result.locationsImported,
          assets_processed: result.assetsImported,
          readings_processed: result.readingsImported,
          error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
          sync_duration_ms: result.duration,
          completed_at: new Date().toISOString()
        })
        .eq('id', syncLog.id);
    }

    return result;
  } catch (error) {
    result.errors.push(`CSV import error: ${error}`);
    result.duration = Date.now() - startTime;
    console.error('\n❌ CSV IMPORT FAILED:', error);
    return result;
  }
}