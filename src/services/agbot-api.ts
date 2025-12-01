import { supabase } from '@/lib/supabase';
import {
  cacheApiResponse,
  withRequestDeduplication,
  checkRateLimit,
  CACHE_CONFIG,
  CACHE_KEYS,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheHealthCheck,
  invalidatePattern,
  calculateSmartTTL,
  warmCache
} from '@/lib/vercel-kv-cache';
import { toPerthTime, validateTimestamp } from '@/utils/timezone';

// Athara/Gasbot API configuration - with environment variable support
// 
// 🔍 IMPORTANT DISCOVERY: Gasbot uses WEBHOOK/PUSH model, not REST API pull model
// - Gasbot dashboard "API Integration" = webhook where THEY call YOUR endpoint
// - Not a traditional REST API for us to query
// - They push data TO external systems on schedule (hourly/daily)
// - CSV import is the recommended approach for now (already working with 11 tanks)
//
// For webhook integration in future: Set up endpoint for Gasbot to POST tank data to us
// SECURITY: API credentials must be set via environment variables - no fallbacks
const ATHARA_API_KEY = import.meta.env.VITE_ATHARA_API_KEY;
const ATHARA_API_SECRET = import.meta.env.VITE_ATHARA_API_SECRET;
const ATHARA_BASE_URL = import.meta.env.VITE_ATHARA_BASE_URL || 'https://dashboard2-production.prod.gasbot.io';

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
async function makeAtharaRequest<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${ATHARA_BASE_URL}${endpoint}`;
  
  const requestOptions: RequestInit = {
    ...options,
    headers: {
      'X-API-Key': ATHARA_API_KEY,
      'X-API-Secret': ATHARA_API_SECRET,
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
  myriotaDetails: Record<string, unknown> | null;
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
  // Capacity and consumption fields
  asset_profile_name?: string | null;
  asset_profile_water_capacity?: number | null;
  asset_refill_capacity_litres?: number | null;
  asset_daily_consumption?: number | null;
  asset_days_remaining?: number | null;
}

export interface AgbotSyncResult {
  success: boolean;
  locationsProcessed: number;
  assetsProcessed: number;
  readingsProcessed: number;
  errors: string[];
  duration: number;
}

// Reading history data structure
export interface AgbotReading {
  id: string;
  asset_id: string;
  calibrated_fill_percentage: number;
  raw_fill_percentage: number;
  reading_timestamp: string;
  device_online: boolean;
  telemetry_epoch: number;
  created_at?: string;
  asset?: AgbotAsset & { location?: AgbotLocation };
}

// CSV row data structure (matches Athara export format)
export interface AgbotCSVRow {
  locationId: string;
  tenancy?: string;
  streetAddress?: string;
  state?: string;
  locationLevel?: string;
  locationStatus?: string;
  lastSeen?: string;
  assetDisabled?: string;
  assetSerialNumber?: string;
  assetProfile?: string;
  deviceSerialNumber?: string;
  deviceId?: string;
  deviceSku?: string;
  deviceModel?: string;
  deviceOnline?: string;
  deviceActivation?: string;
  deviceLastSeen?: string;
  assetLastSeen?: string;
  deviceSubscription?: string;
  rawTelemetries?: string;
  [key: string]: string | undefined;
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

// PRODUCTION SAFE: Fetch data from Athara API with caching
export async function fetchAtharaLocations(bypassCache: boolean = false): Promise<AtharaLocation[]> {
  // Validate API configuration before attempting call
  if (!ATHARA_API_KEY || ATHARA_API_KEY === 'your-api-key-here') {
    const error = 'CRITICAL: Invalid or missing Athara API key. Check VITE_ATHARA_API_KEY environment variable.';
    updateAPIHealth(false, error);
    throw new Error(error);
  }
  
  if (!ATHARA_API_SECRET || ATHARA_API_SECRET === 'your-api-secret-here') {
    const error = 'CRITICAL: Invalid or missing Athara API secret. Check VITE_ATHARA_API_SECRET environment variable.';
    updateAPIHealth(false, error);
    throw new Error(error);
  }

  // Rate limiting check
  const rateLimitResult = await checkRateLimit(
    'athara_api_locations',
    30, // 30 requests per hour 
    CACHE_CONFIG.RATE_LIMITING
  );

  if (!rateLimitResult.allowed) {
    const error = `Athara API rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.resetTime - Date.now()) / 60000)} minutes.`;
    updateAPIHealth(false, error);
    throw new Error(error);
  }

  // Create cache key
  const cacheKey = `${CACHE_KEYS.AGBOT_LOCATIONS}all`;

  // Check cache first (unless bypassed)
  if (!bypassCache) {
    const cached = await cacheGet<AtharaLocation[]>(cacheKey);
    if (cached) {
      if (ENABLE_API_LOGGING) {
        console.log(`[ATHARA API] Cache hit - ${cached.length} locations`);
      }
      return cached;
    }
  }

  // Use request deduplication for concurrent requests
  const requestKey = 'athara_locations_fetch';
  
  return await withRequestDeduplication(requestKey, async () => {
    try {
      if (ENABLE_API_LOGGING) {
        console.log('[ATHARA API] Fetching fresh data from Athara API...');
      }
      
      // Attempt real API call
      const data = await makeAtharaRequest('/locations');
      
      // Validate the response structure
      if (!Array.isArray(data)) {
        const error = 'Invalid Athara API response: expected array of locations';
        updateAPIHealth(false, error);
        throw new Error(error);
      }
      
      // Cache the successful result with smart TTL
      const smartTTL = calculateSmartTTL('AGBOT_API', 'high');
      await cacheSet(cacheKey, data, smartTTL);
      
      // Warm related cache entries
      if (data.length > 0) {
        console.log(`[ATHARA API] Warming related cache entries`);
        warmCache(`${CACHE_KEYS.AGBOT_HEALTH}system`, 
          async () => ({ status: 'available', timestamp: new Date().toISOString() }),
          smartTTL / 2
        ).catch(err => console.warn('[ATHARA API] Cache warming failed:', err));
      }
      
      // Update health status on success
      updateAPIHealth(true);
      
      if (ENABLE_API_LOGGING) {
        console.log(`[ATHARA API] Successfully fetched ${data.length} locations (cached for ${CACHE_CONFIG.AGBOT_API}s)`);
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
  });
}

// Transform Athara API data to new ta_agbot_* schema format
function transformLocationData(atharaLocation: AtharaLocation) {
  return {
    external_guid: atharaLocation.locationGuid,
    name: atharaLocation.locationId || 'Unknown Location',
    customer_name: atharaLocation.customerName,
    customer_guid: atharaLocation.customerGuid,
    address: atharaLocation.address1,
    state: atharaLocation.state,
    postcode: atharaLocation.postcode,
    country: atharaLocation.country || 'Australia',
    latitude: atharaLocation.lat,
    longitude: atharaLocation.lng,
    installation_status: atharaLocation.installationStatus || 0,
    installation_status_label: atharaLocation.installationStatusLabel,
    is_disabled: atharaLocation.disabled || false,
    calibrated_fill_level: atharaLocation.latestCalibratedFillPercentage,
    // Use epoch timestamp to generate proper UTC ISO string (avoids timezone issues with string format)
    // Handle both seconds (10 digits) and milliseconds (13 digits) epoch formats
    last_telemetry_at: atharaLocation.latestTelemetryEpoch
      ? new Date(atharaLocation.latestTelemetryEpoch > 10000000000
          ? atharaLocation.latestTelemetryEpoch
          : atharaLocation.latestTelemetryEpoch * 1000).toISOString()
      : atharaLocation.latestTelemetry,
    last_telemetry_epoch: atharaLocation.latestTelemetryEpoch,
    updated_at: new Date().toISOString()
  };
}

function transformAssetData(atharaAsset: AtharaAsset, locationId: string) {
  return {
    location_id: locationId,
    external_guid: atharaAsset.assetGuid,
    name: atharaAsset.assetSerialNumber || atharaAsset.assetProfileName || 'Unknown Asset',
    serial_number: atharaAsset.assetSerialNumber,
    profile_name: atharaAsset.assetProfileName,
    profile_guid: atharaAsset.assetProfileGuid,
    commodity: (atharaAsset as any).assetProfileCommodity || 'Diesel',
    capacity_liters: (atharaAsset as any).assetProfileWaterCapacity,
    current_level_liters: (atharaAsset as any).assetReportedLitres,
    current_level_percent: atharaAsset.latestCalibratedFillPercentage,
    current_raw_percent: atharaAsset.latestRawFillPercentage,
    ullage_liters: (atharaAsset as any).assetRefillCapacityLitres,
    daily_consumption_liters: (atharaAsset as any).assetDailyConsumption,
    days_remaining: (atharaAsset as any).assetDaysRemaining,
    device_guid: atharaAsset.deviceGuid,
    device_serial: atharaAsset.deviceSerialNumber,
    device_model: atharaAsset.deviceModel,
    device_model_name: atharaAsset.deviceModelLabel,
    is_online: atharaAsset.deviceOnline,
    is_disabled: atharaAsset.assetDisabled || false,
    device_state: (atharaAsset as any).deviceState,
    battery_voltage: (atharaAsset as any).deviceBatteryVoltage,
    temperature_c: (atharaAsset as any).deviceTemperature,
    device_activated_at: atharaAsset.deviceActivationDate,
    device_activation_epoch: atharaAsset.deviceActivationEpoch,
    // Use epoch timestamp to generate proper UTC ISO string (avoids timezone issues with string format)
    // Handle both seconds (10 digits) and milliseconds (13 digits) epoch formats
    last_telemetry_at: atharaAsset.latestTelemetryEventEpoch
      ? new Date(atharaAsset.latestTelemetryEventEpoch > 10000000000
          ? atharaAsset.latestTelemetryEventEpoch
          : atharaAsset.latestTelemetryEventEpoch * 1000).toISOString()
      : atharaAsset.latestTelemetryEventTimestamp,
    last_telemetry_epoch: atharaAsset.latestTelemetryEventEpoch,
    raw_data: atharaAsset,
    updated_at: new Date().toISOString()
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

        // Upsert location to new ta_agbot_locations table
        // Use 'name' for conflict resolution to prevent duplicates from different sync sources
        const locationData = transformLocationData(atharaLocation);
        const { data: location, error: locationError } = await supabase
          .from('ta_agbot_locations')
          .upsert(locationData, {
            onConflict: 'name',
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

            // Upsert asset to new ta_agbot_assets table
            const { data: savedAsset, error: assetError } = await supabase
              .from('ta_agbot_assets')
              .upsert(assetData, {
                onConflict: 'external_guid',
                ignoreDuplicates: false
              })
              .select('id')
              .single();

            if (assetError) {
              const errorMsg = `Asset ${atharaAsset.deviceSerialNumber} error: ${assetError.message}`;
              console.error(`        ❌ ${errorMsg}`);
              result.errors.push(errorMsg);
              assetsFailed++;
              continue;
            }

            assetsSuccessful++;
            result.assetsProcessed++;

            // Store historical reading to new ta_agbot_readings table
            if (savedAsset?.id) {
              const { error: readingError } = await supabase
                .from('ta_agbot_readings')
                .insert({
                  asset_id: savedAsset.id,
                  level_liters: (atharaAsset as any).assetReportedLitres,
                  level_percent: atharaAsset.latestCalibratedFillPercentage,
                  raw_percent: atharaAsset.latestRawFillPercentage,
                  is_online: atharaAsset.deviceOnline,
                  battery_voltage: (atharaAsset as any).deviceBatteryVoltage,
                  temperature_c: (atharaAsset as any).deviceTemperature,
                  device_state: (atharaAsset as any).deviceState,
                  daily_consumption: (atharaAsset as any).assetDailyConsumption,
                  days_remaining: (atharaAsset as any).assetDaysRemaining,
                  reading_at: atharaAsset.latestTelemetryEventTimestamp,
                  telemetry_epoch: atharaAsset.latestTelemetryEventEpoch
                });

              if (!readingError) {
                result.readingsProcessed++;
              }
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

    // Process locations - write to new ta_agbot_* tables
    for (const atharaLocation of atharaLocations) {
      try {
        // Upsert location to new ta_agbot_locations table
        // Use 'name' for conflict resolution to prevent duplicates from different sync sources
        const locationData = transformLocationData(atharaLocation);
        const { data: location, error: locationError } = await supabase
          .from('ta_agbot_locations')
          .upsert(locationData, {
            onConflict: 'name',
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
            const { data: savedAsset, error: assetError } = await supabase
              .from('ta_agbot_assets')
              .upsert(assetData, {
                onConflict: 'external_guid',
                ignoreDuplicates: false
              })
              .select('id')
              .single();

            if (assetError) {
              result.errors.push(`Asset error: ${assetError.message}`);
              continue;
            }

            result.assetsProcessed++;

            // Store reading to new ta_agbot_readings table
            if (atharaAsset.latestTelemetryEventTimestamp && savedAsset?.id) {
              const { error: readingError } = await supabase
                .from('ta_agbot_readings')
                .insert({
                  asset_id: savedAsset.id,
                  level_liters: (atharaAsset as any).assetReportedLitres,
                  level_percent: atharaAsset.latestCalibratedFillPercentage,
                  raw_percent: atharaAsset.latestRawFillPercentage,
                  is_online: atharaAsset.deviceOnline,
                  battery_voltage: (atharaAsset as any).deviceBatteryVoltage,
                  temperature_c: (atharaAsset as any).deviceTemperature,
                  device_state: (atharaAsset as any).deviceState,
                  reading_at: atharaAsset.latestTelemetryEventTimestamp,
                  telemetry_epoch: atharaAsset.latestTelemetryEventEpoch
                });

              if (!readingError) {
                result.readingsProcessed++;
              }
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

// Get all agbot locations with assets from new ta_agbot_* tables
export async function getAgbotLocations(): Promise<AgbotLocation[]> {
  const { data, error } = await supabase
    .from('ta_agbot_locations')
    .select(`
      *,
      assets:ta_agbot_assets(
        *,
        readings:ta_agbot_readings(reading_at)
      )
    `)
    .eq('is_disabled', false)
    .order('name');

  if (error) {
    console.error('Error fetching agbot locations:', error);
    throw error;
  }

  // Transform new schema field names to legacy interface for backward compatibility
  return (data || []).map(loc => {
    const assets = (loc.assets || []).map((asset: any) => {
      // Get the most recent reading_at from this asset's readings
      const assetReadings = (asset.readings || [])
        .map((r: any) => r.reading_at)
        .filter(Boolean)
        .sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime());
      const latestAssetReading = assetReadings[0] || asset.last_telemetry_at;

      return {
        ...asset,
        id: asset.id,
        location_id: asset.location_id,
        asset_guid: asset.external_guid,
        asset_serial_number: asset.serial_number,
        asset_disabled: asset.is_disabled,
        asset_profile_name: asset.profile_name,
        asset_profile_guid: asset.profile_guid,
        asset_profile_water_capacity: asset.capacity_liters,
        device_guid: asset.device_guid,
        device_serial_number: asset.device_serial,
        device_sku_model: asset.device_model,
        device_sku_name: asset.device_model_name,
        device_online: asset.is_online,
        latest_calibrated_fill_percentage: asset.current_level_percent,
        latest_raw_fill_percentage: asset.current_raw_percent,
        latest_telemetry_event_timestamp: latestAssetReading, // Use reading timestamp
        latest_telemetry_event_epoch: asset.last_telemetry_epoch,
        asset_daily_consumption: asset.daily_consumption_liters,
        asset_days_remaining: asset.days_remaining,
        asset_refill_capacity_litres: asset.ullage_liters,
        asset_reported_litres: asset.current_level_liters,
        device_battery_voltage: asset.battery_voltage,
        device_temperature: asset.temperature_c,
        device_state: asset.device_state
      };
    });

    // Calculate location-level fill percentage from assets
    const assetPercentages = assets
      .filter((a: any) => a.latest_calibrated_fill_percentage != null)
      .map((a: any) => a.latest_calibrated_fill_percentage);
    const avgFillPercentage = assetPercentages.length > 0
      ? assetPercentages.reduce((sum: number, p: number) => sum + p, 0) / assetPercentages.length
      : loc.calibrated_fill_level || 0;

    // Get the most recent reading_at from all assets' readings for this location
    const allReadingTimestamps = (loc.assets || [])
      .flatMap((a: any) => (a.readings || []).map((r: any) => r.reading_at))
      .filter(Boolean)
      .sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime());
    const latestReadingTime = allReadingTimestamps[0] || loc.last_telemetry_at;

    return {
      ...loc,
      id: loc.id,
      location_guid: loc.external_guid,
      customer_name: loc.customer_name,
      customer_guid: loc.customer_guid,
      location_id: loc.name,
      tenancy_name: loc.tenancy_name,
      address1: loc.address || '',
      address2: '',
      state: loc.state || '',
      postcode: loc.postcode || '',
      country: loc.country || 'Australia',
      lat: loc.latitude,
      lng: loc.longitude,
      disabled: loc.is_disabled,
      installation_status: loc.installation_status,
      installation_status_label: loc.installation_status_label,
      // Key fields for frontend display
      latest_calibrated_fill_percentage: avgFillPercentage,
      latest_telemetry: latestReadingTime, // Derived from readings table
      latest_telemetry_epoch: loc.last_telemetry_epoch,
      last_reading_time: latestReadingTime, // Used by device status checks
      location_daily_consumption: loc.daily_consumption_liters,
      location_days_remaining: loc.days_remaining,
      location_calibrated_fill_level: loc.calibrated_fill_level,
      // Asset data
      assets,
      // Include raw data for additional fields
      raw_data: {
        total_assets: loc.total_assets,
        assets_online: loc.assets_online,
        avg_fill_percent: loc.avg_fill_percent
      }
    };
  });
}

// Get specific location with detailed asset information
export async function getAgbotLocation(locationId: string): Promise<AgbotLocation | null> {
  const { data, error } = await supabase
    .from('ta_agbot_locations')
    .select(`
      *,
      assets:ta_agbot_assets(*)
    `)
    .eq('id', locationId)
    .single();

  if (error) {
    console.error('Error fetching agbot location:', error);
    return null;
  }

  if (!data) return null;

  // Transform to legacy interface
  return {
    ...data,
    location_guid: data.external_guid,
    location_id: data.name,
    address1: data.address,
    address2: '',
    lat: data.latitude,
    lng: data.longitude,
    disabled: data.is_disabled,
    latest_telemetry: data.last_telemetry_at,
    latest_telemetry_epoch: data.last_telemetry_epoch,
    assets: (data.assets || []).map((asset: any) => ({
      ...asset,
      asset_guid: asset.external_guid,
      asset_serial_number: asset.serial_number,
      asset_disabled: asset.is_disabled,
      device_online: asset.is_online,
      latest_calibrated_fill_percentage: asset.current_level_percent,
      latest_telemetry_event_timestamp: asset.last_telemetry_at
    }))
  } as AgbotLocation;
}

// Get recent sync logs
export async function getAgbotSyncLogs(limit: number = 10) {
  const { data, error } = await supabase
    .from('ta_agbot_sync_log')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching sync logs:', error);
    throw error;
  }

  // Transform to legacy field names for compatibility
  return (data || []).map(log => ({
    ...log,
    sync_status: log.status,
    sync_duration_ms: log.duration_ms
  }));
}

// Historical data and analytics functions

// Get historical readings for an asset
export async function getAgbotReadingsHistory(
  assetId: string,
  days: number = 30
): Promise<AgbotReading[]> {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - days);

  const { data, error } = await supabase
    .from('ta_agbot_readings')
    .select('*')
    .eq('asset_id', assetId)
    .gte('reading_at', daysAgo.toISOString())
    .order('reading_at', { ascending: true });

  if (error) {
    console.error('Error fetching agbot readings history:', error);
    throw error;
  }

  // Transform to legacy field names for compatibility
  return (data || []).map(reading => ({
    ...reading,
    calibrated_fill_percentage: reading.level_percent,
    raw_fill_percentage: reading.raw_percent,
    reading_timestamp: reading.reading_at,
    device_online: reading.is_online,
    device_battery_voltage: reading.battery_voltage,
    device_temperature: reading.temperature_c
  }));
}

// Get readings for multiple assets at once
export async function getBulkAgbotReadingsHistory(
  assetIds: string[],
  days: number = 30
): Promise<Record<string, AgbotReading[]>> {
  if (assetIds.length === 0) return {};

  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - days);

  const { data, error } = await supabase
    .from('ta_agbot_readings')
    .select('*')
    .in('asset_id', assetIds)
    .gte('reading_at', daysAgo.toISOString())
    .order('reading_at', { ascending: true });

  if (error) {
    console.error('Error fetching bulk agbot readings history:', error);
    throw error;
  }

  // Group readings by asset_id and transform to legacy format
  const groupedReadings: Record<string, AgbotReading[]> = {};
  assetIds.forEach(id => {
    groupedReadings[id] = [];
  });

  (data || []).forEach((reading: any) => {
    const transformed = {
      ...reading,
      calibrated_fill_percentage: reading.level_percent,
      raw_fill_percentage: reading.raw_percent,
      reading_timestamp: reading.reading_at,
      device_online: reading.is_online
    };
    if (groupedReadings[reading.asset_id]) {
      groupedReadings[reading.asset_id].push(transformed);
    }
  });

  return groupedReadings;
}

// Get latest readings for all assets (for real-time dashboard)
export async function getLatestAgbotReadings(): Promise<AgbotReading[]> {
  const { data, error } = await supabase
    .from('ta_agbot_readings')
    .select(`
      *,
      asset:ta_agbot_assets(
        *,
        location:ta_agbot_locations(*)
      )
    `)
    .order('reading_at', { ascending: false });

  if (error) {
    console.error('Error fetching latest agbot readings:', error);
    throw error;
  }

  // Get the latest reading for each asset and transform to legacy format
  const latestByAsset = new Map<string, AgbotReading>();
  (data || []).forEach((reading: any) => {
    if (!latestByAsset.has(reading.asset_id)) {
      latestByAsset.set(reading.asset_id, {
        ...reading,
        calibrated_fill_percentage: reading.level_percent,
        raw_fill_percentage: reading.raw_percent,
        reading_timestamp: reading.reading_at,
        device_online: reading.is_online
      });
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
  // Transform to new schema field names
  const newReading = {
    asset_id: reading.asset_id,
    level_percent: reading.calibrated_fill_percentage,
    raw_percent: reading.raw_fill_percentage,
    reading_at: reading.reading_timestamp,
    is_online: reading.device_online,
    telemetry_epoch: reading.telemetry_epoch
  };

  const { data, error } = await supabase
    .from('ta_agbot_readings')
    .insert(newReading)
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
    .from('ta_agbot_assets')
    .select('id')
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
  const assetIds = assets.map(a => a.id);
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
  // Get all locations with assets from new ta_agbot_* tables
  const { data: locations, error } = await supabase
    .from('ta_agbot_locations')
    .select(`
      *,
      assets:ta_agbot_assets(*)
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
  const onlineDevices = allAssets.filter((asset: any) => asset.is_online).length;
  const avgSystemReliability = allAssets.length > 0
    ? (onlineDevices / allAssets.length) * 100
    : 0;

  // Count locations needing attention (low fuel or offline devices)
  const locationsNeedingAttention = locations.filter((loc: any) => {
    const hasLowFuel = loc.calibrated_fill_level < 25;
    const hasOfflineDevices = (loc.assets || []).some((asset: any) => !asset.is_online);
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

// Transform CSV row data to database location format (new ta_agbot_locations schema)
function transformCSVLocationData(csvRow: AgbotCSVRow) {
  // Parse date strings and handle empty values with Perth timezone
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

      // Create date string in Perth timezone format instead of browser timezone
      const perthDateString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour24.toString().padStart(2, '0')}:${minutes.padStart(2, '0')}:${(seconds || '0').padStart(2, '0')}`;

      // Parse as Perth time and convert to proper timezone-aware date
      const perthDate = toPerthTime(perthDateString);

      // Validate the timestamp for data quality
      const validation = validateTimestamp(perthDate);
      if (validation.issues.length > 0) {
        console.warn(`[AGBOT CSV] Date validation issues for "${dateStr}":`, validation.issues);
        if (validation.isFuture) {
          console.warn(`[AGBOT CSV] Future date detected: ${dateStr} -> ${perthDate.toISOString()}`);
        }
      }

      return perthDate.toISOString();
    } catch (e) {
      console.warn('Failed to parse date:', dateStr, e);
      return null;
    }
  };

  // Generate a unique external_guid from location ID
  const externalGuid = `csv-import-${csvRow.locationId.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;

  return {
    external_guid: externalGuid,
    customer_name: csvRow.tenancy || 'Unknown Customer',
    customer_guid: `customer-${csvRow.tenancy?.replace(/\s+/g, '-').toLowerCase() || 'unknown'}`,
    name: csvRow.locationId,
    address: csvRow.streetAddress || '',
    state: csvRow.state || '',
    postcode: '',
    country: 'Australia', // Default for Athara data
    calibrated_fill_level: parseFloat(csvRow.locationLevel) || 0,
    installation_status: csvRow.locationStatus?.toLowerCase() === 'installed' ? 1 : 0,
    installation_status_label: csvRow.locationStatus || 'Unknown',
    last_telemetry_epoch: Date.now(),
    last_telemetry_at: parseDate(csvRow.lastSeen) || new Date().toISOString(),
    latitude: null, // Not available in CSV
    longitude: null, // Not available in CSV
    is_disabled: csvRow.assetDisabled?.toLowerCase() === 'yes',
    raw_data: csvRow // Store complete CSV row for reference
  };
}

// Transform CSV row data to database asset format (new ta_agbot_assets schema)
function transformCSVAssetData(csvRow: AgbotCSVRow, locationId: string) {
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

  // Generate unique external_guid from asset serial number
  const externalGuid = `csv-asset-${csvRow.assetSerialNumber?.replace(/\s+/g, '-') || 'unknown'}-${Date.now()}`;

  return {
    location_id: locationId,
    external_guid: externalGuid,
    serial_number: csvRow.assetSerialNumber || '',
    is_disabled: csvRow.assetDisabled?.toLowerCase() === 'yes',
    profile_guid: `profile-${csvRow.assetProfile?.replace(/\s+/g, '-').toLowerCase() || 'unknown'}`,
    profile_name: csvRow.assetProfile || '',
    device_guid: `device-${csvRow.deviceSerialNumber?.replace(/\s+/g, '-') || 'unknown'}-${Date.now()}`,
    device_serial: csvRow.deviceSerialNumber || '',
    device_model: parseInt(csvRow.deviceSku) || 0,
    device_model_name: csvRow.deviceModel || '',
    is_online: csvRow.deviceOnline?.toLowerCase() === 'yes',
    device_activated_at: parseDate(csvRow.deviceActivation),
    device_activation_epoch: parseDate(csvRow.deviceActivation) ?
      new Date(parseDate(csvRow.deviceActivation)!).getTime() : null,
    current_level_percent: parseFloat(csvRow.locationLevel) || 0,
    current_raw_percent: parseFloat(csvRow.rawTelemetries) || parseFloat(csvRow.locationLevel) || 0,
    last_telemetry_at: parseDate(csvRow.deviceLastSeen) || parseDate(csvRow.assetLastSeen),
    last_telemetry_epoch: parseDate(csvRow.deviceLastSeen) ?
      new Date(parseDate(csvRow.deviceLastSeen)!).getTime() : Date.now(),
    raw_data: csvRow // Store complete CSV row for reference
  };
}

// Import Agbot data from CSV
export async function importAgbotFromCSV(csvRows: AgbotCSVRow[]): Promise<AgbotCSVImportResult> {
  const startTime = Date.now();
  const result: AgbotCSVImportResult = {
    success: false,
    locationsImported: 0,
    assetsImported: 0,
    readingsImported: 0,
    errors: [],
    duration: 0
  };

  // Pre-validate CSV data for common issues like future dates
  console.log('[AGBOT CSV] Pre-validating CSV data for data quality issues...');
  let futureDataWarnings = 0;
  const currentTime = new Date();
  
  csvRows.forEach((row, index) => {
    // Check for potentially problematic date fields
    const dateFields = ['deviceLastSeen', 'assetLastSeen', 'deviceActivation'];
    dateFields.forEach(field => {
      const dateStr = row[field];
      if (dateStr && dateStr.trim() !== '') {
        try {
          // Parse with the same logic as parseDate function
          const [datePart] = dateStr.split(', ');
          if (datePart) {
            const [day, month, year] = datePart.split('/');
            const checkDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            
            if (checkDate > currentTime) {
              console.warn(`[AGBOT CSV] Row ${index + 1}: Future date detected in ${field}: "${dateStr}"`);
              futureDataWarnings++;
            }
          }
        } catch (e) {
          // Ignore parsing errors here, they'll be handled in parseDate
        }
      }
    });
  });
  
  if (futureDataWarnings > 0) {
    console.warn(`[AGBOT CSV] ⚠️ Found ${futureDataWarnings} future date entries that may cause display issues`);
    result.errors.push(`Data quality warning: ${futureDataWarnings} entries contain future dates`);
  }

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
        
        // Transform and upsert location to new ta_agbot_locations table
        // Use 'name' for conflict resolution to prevent duplicates from different sync sources
        const locationData = transformCSVLocationData(csvRow);
        const { data: location, error: locationError } = await supabase
          .from('ta_agbot_locations')
          .upsert(locationData, {
            onConflict: 'name',
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

        // Transform and upsert asset to new ta_agbot_assets table
        const assetData = transformCSVAssetData(csvRow, location.id);
        const { data: asset, error: assetError } = await supabase
          .from('ta_agbot_assets')
          .upsert(assetData, {
            onConflict: 'external_guid',
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

        // Create historical reading entry in new ta_agbot_readings table
        const readingData = {
          asset_id: asset.id, // Use the actual asset ID from database
          level_percent: parseFloat(csvRow.locationLevel) || 0,
          raw_percent: parseFloat(csvRow.rawTelemetries) || parseFloat(csvRow.locationLevel) || 0,
          reading_at: assetData.last_telemetry_at || new Date().toISOString(),
          is_online: csvRow.deviceOnline?.toLowerCase() === 'yes',
          telemetry_epoch: assetData.last_telemetry_epoch || Date.now()
        };

        const { error: readingError } = await supabase
          .from('ta_agbot_readings')
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

// AgBot Cache Management Functions

/**
 * Clear all AgBot cache entries
 */
export async function clearAgBotCache(): Promise<void> {
  try {
    const patterns = [
      `${CACHE_KEYS.AGBOT_LOCATIONS}*`,
      `${CACHE_KEYS.AGBOT_ASSETS}*`,
      `${CACHE_KEYS.AGBOT_HEALTH}*`
    ];
    
    const totalCleared = await Promise.all(
      patterns.map(pattern => invalidatePattern(pattern))
    );
    
    const total = totalCleared.reduce((sum, count) => sum + count, 0);
    console.log(`[AGBOT CACHE] Cleared ${total} AgBot cache entries`);
  } catch (error) {
    console.warn('[AGBOT CACHE] Failed to clear cache:', error);
  }
}

/**
 * Get AgBot API health including cache status
 */
export async function getAgBotSystemHealth(): Promise<{
  api: AtharaAPIHealth;
  cache: {
    healthy: boolean;
    latency: number;
    error?: string;
  };
  overall: 'healthy' | 'degraded' | 'unhealthy';
}> {
  const apiHealth = getAtharaAPIHealth();
  const cacheHealth = await cacheHealthCheck();
  
  let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  if (apiHealth.status === 'unavailable' || !cacheHealth.healthy) {
    overall = 'unhealthy';
  } else if (apiHealth.status === 'error' || cacheHealth.latency > 1000) {
    overall = 'degraded';
  }
  
  return {
    api: apiHealth,
    cache: cacheHealth,
    overall
  };
}

/**
 * Force refresh AgBot data (bypass cache)
 */
export async function refreshAgBotData(): Promise<AtharaLocation[]> {
  // Clear existing cache first
  await clearAgBotCache();
  
  // Fetch fresh data (bypass cache)
  return await fetchAtharaLocations(true);
}

/**
 * Cache AgBot locations with explicit TTL
 */
export async function cacheAgBotLocations(locations: AtharaLocation[], ttl?: number): Promise<void> {
  const cacheKey = `${CACHE_KEYS.AGBOT_LOCATIONS}all`;
  const smartTTL = ttl || calculateSmartTTL('AGBOT_API', 'medium');
  await cacheSet(cacheKey, locations, smartTTL);
}