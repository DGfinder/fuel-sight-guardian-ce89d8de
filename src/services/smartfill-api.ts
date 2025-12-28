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
  warmCache,
  invalidatePattern,
  calculateSmartTTL
} from '@/lib/vercel-kv-cache';
import { geocodeSmartFillLocation, validateAustralianCoordinates } from '@/utils/geocoding';

// SmartFill API configuration - JSON-RPC 2.0 based fuel monitoring system
// API Base URL: https://www.fmtdata.com/API/api.php
const SMARTFILL_API_URL = import.meta.env.VITE_SMARTFILL_API_URL || 'https://www.fmtdata.com/API/api.php';

// Development flags
const ENABLE_API_LOGGING = import.meta.env.VITE_ENABLE_SMARTFILL_API_LOGGING !== 'false'; // Default to true

// API Health Status
export type SmartFillAPIStatus = 'available' | 'unavailable' | 'error' | 'unknown';

export interface SmartFillAPIHealth {
  status: SmartFillAPIStatus;
  lastSuccessfulCall: string | null;
  lastError: string | null;
  consecutiveFailures: number;
}

// API request configuration
const SMARTFILL_REQUEST_CONFIG = {
  timeout: 30000, // 30 second timeout
  retries: 3,
  retryDelay: 1000, // 1 second between retries
};

// JSON-RPC request parameters type
type SmartFillRequestParams = Record<string, string | number | boolean | null | undefined>;

// Helper function for making JSON-RPC 2.0 API requests with retry logic
async function makeSmartFillRequest<T = SmartFillAPIResponse>(
  method: string,
  parameters: SmartFillRequestParams,
  clientReference: string,
  clientSecret: string
): Promise<T> {
  const requestBody = {
    jsonrpc: '2.0',
    method: method,
    parameters: {
      clientReference: clientReference,
      clientSecret: clientSecret,
      ...parameters
    },
    id: '1'
  };

  const requestOptions: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(SMARTFILL_REQUEST_CONFIG.timeout),
  };

  let lastError: Error;

  for (let attempt = 1; attempt <= SMARTFILL_REQUEST_CONFIG.retries; attempt++) {
    try {
      if (ENABLE_API_LOGGING) {
        console.log(`[SMARTFILL API] Attempt ${attempt}/${SMARTFILL_REQUEST_CONFIG.retries}: ${method}`);
      }
      
      const response = await fetch(SMARTFILL_API_URL, requestOptions);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SmartFill API error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      
      // Check for JSON-RPC error
      if (data.error) {
        throw new Error(`SmartFill JSON-RPC error: ${data.error.code} - ${data.error.message}`);
      }
      
      if (ENABLE_API_LOGGING) {
        console.log(`[SMARTFILL API] Success: ${method} - ${data.result?.values?.length || 1} items`);
      }
      
      return data.result;
      
    } catch (error) {
      lastError = error as Error;
      console.warn(`[SMARTFILL API] Attempt ${attempt} failed:`, error);
      
      // Don't retry on authentication errors
      if (error instanceof Error && (
        error.message.includes('401') || 
        error.message.includes('403') ||
        error.message.includes('invalid credentials')
      )) {
        throw new Error(`SmartFill API authentication failed: ${error.message}`);
      }
      
      // Wait before retrying (except on last attempt)
      if (attempt < SMARTFILL_REQUEST_CONFIG.retries) {
        await new Promise(resolve => setTimeout(resolve, SMARTFILL_REQUEST_CONFIG.retryDelay * attempt));
      }
    }
  }

  throw new Error(`SmartFill API request failed after ${SMARTFILL_REQUEST_CONFIG.retries} attempts: ${lastError.message}`);
}

// TypeScript interfaces based on SmartFill API response format
export interface SmartFillTankReading {
  'Unit Number': string;
  'Tank Number': string;
  'Description': string;
  'Capacity': number;
  'Tank SFL': number; // Safe Fill Level
  'Volume': number;
  'Volume Percent': number;
  'Status': string;
  'Last Updated': string;
  'Timezone': string;
}

export interface SmartFillAPIResponse {
  columns: string[];
  values: (string | number | null)[][];
}

export interface SmartFillCustomer {
  id: number;
  api_reference: string;
  api_secret: string;
  name: string;
}

// Database types for our system
export interface SmartFillLocation {
  id: string;
  location_guid: string;
  customer_name: string;
  customer_guid: string;
  customer_id: number;
  unit_number: string;
  description: string;
  timezone: string;
  latitude?: number;
  longitude?: number;
  latest_volume: number;
  latest_volume_percent: number;
  latest_status: string;
  latest_update_time: string;
  created_at: string;
  updated_at: string;
}

export interface SmartFillTank {
  id: string;
  location_id: string;
  tank_guid: string;
  customer_id: number;
  unit_number: string;
  tank_number: string;
  description: string;
  capacity: number;
  safe_fill_level: number;
  latest_volume: number;
  latest_volume_percent: number;
  latest_status: string;
  latest_update_time: string;
  created_at: string;
  updated_at: string;
}

export interface SmartFillSyncResult {
  success: boolean;
  locationsProcessed: number;
  tanksProcessed: number;
  readingsProcessed: number;
  errors: string[];
  duration: number;
}

// API Health Tracking
let apiHealthStatus: SmartFillAPIHealth = {
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
export function getSmartFillAPIHealth(): SmartFillAPIHealth {
  return { ...apiHealthStatus };
}

// PRODUCTION SAFE: Fetch SmartFill tank data for a customer with caching
export async function fetchSmartFillTankData(
  clientReference: string, 
  clientSecret: string,
  bypassCache: boolean = false
): Promise<SmartFillTankReading[]> {
  // Validate API credentials
  if (!clientReference || !clientSecret) {
    const error = 'CRITICAL: Invalid or missing SmartFill API credentials.';
    updateAPIHealth(false, error);
    throw new Error(error);
  }

  // Rate limiting check
  const rateLimitResult = await checkRateLimit(
    `smartfill_api_${clientReference}`, 
    50, // 50 requests per hour per customer
    CACHE_CONFIG.RATE_LIMITING
  );

  if (!rateLimitResult.allowed) {
    const error = `SmartFill API rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.resetTime - Date.now()) / 60000)} minutes.`;
    updateAPIHealth(false, error);
    throw new Error(error);
  }

  // Create cache key for this specific customer
  const cacheKey = `${CACHE_KEYS.SMARTFILL_TANKS}${clientReference}`;

  // Check cache first (unless bypassed)
  if (!bypassCache) {
    const cached = await cacheGet<SmartFillTankReading[]>(cacheKey);
    if (cached) {
      if (ENABLE_API_LOGGING) {
        console.log(`[SMARTFILL API] Cache hit for ${clientReference} - ${cached.length} tanks`);
      }
      return cached;
    }
  }

  // Use request deduplication for concurrent requests
  const requestKey = `smartfill_tank_data_${clientReference}`;
  
  return await withRequestDeduplication(requestKey, async () => {
    try {
      if (ENABLE_API_LOGGING) {
        console.log('[SMARTFILL API] Fetching fresh data from SmartFill API...');
      }
      
      // Make JSON-RPC call to Tank:Level method
      const result = await makeSmartFillRequest(
        'Tank:Level', 
        {},
        clientReference, 
        clientSecret
      );
    
    // Validate the response structure
    if (!result || !Array.isArray(result.columns) || !Array.isArray(result.values)) {
      const error = 'Invalid SmartFill API response: expected columns and values arrays';
      updateAPIHealth(false, error);
      throw new Error(error);
    }
    
      // Transform column/value arrays into objects with safe array handling
      const tankReadings: SmartFillTankReading[] = result.values
        .filter((row): row is (string | number | null)[] => Array.isArray(row))
        .map((row) => {
          const reading: Record<string, string | number | null> = {};
          result.columns.forEach((column: string, index: number) => {
            if (index < row.length) {
              reading[column] = row[index];
            }
          });
          return reading as unknown as SmartFillTankReading;
        });
      
      // Cache the successful result with smart TTL
      const smartTTL = calculateSmartTTL('SMARTFILL_API', 'high'); // High access pattern for tank data
      await cacheSet(cacheKey, tankReadings, smartTTL);
      
      // Warm related cache entries for better performance
      if (tankReadings.length > 0) {
        console.log(`[SMARTFILL API] Warming related cache entries for ${clientReference}`);
        warmCache(`${CACHE_KEYS.SMARTFILL_CUSTOMERS}${clientReference}`, 
          async () => ({ api_reference: clientReference, last_sync: new Date().toISOString() }),
          CACHE_CONFIG.SMARTFILL_API * 2
        ).catch(err => console.warn('[SMARTFILL API] Cache warming failed:', err));
      }
      
      // Update health status on success
      updateAPIHealth(true);
      
      if (ENABLE_API_LOGGING) {
        console.log(`[SMARTFILL API] Successfully fetched ${tankReadings.length} tank readings (cached for ${CACHE_CONFIG.SMARTFILL_API}s)`);
      }
      
      return tankReadings;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      updateAPIHealth(false, errorMessage);
      
      console.error('[SMARTFILL API] CRITICAL: API call failed:', error);
      
      // Re-throw the error instead of using mock data
      throw new Error(`SmartFill API unavailable: ${errorMessage}`);
    }
  });
}

// Get all SmartFill customers from database with caching
export async function getSmartFillCustomers(): Promise<SmartFillCustomer[]> {
  const cacheKey = CACHE_KEYS.SMARTFILL_CUSTOMERS + 'all';
  
  return await cacheApiResponse(
    cacheKey,
    async () => {
      const { data, error } = await supabase
        .from('smartfill_customers')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching SmartFill customers:', error);
        throw error;
      }

      return data || [];
    },
    calculateSmartTTL('SMARTFILL_API', 'low') * 6 // Cache customer data longer with smart TTL
  );
}

// Transform SmartFill data to our database format
async function transformSmartFillLocationData(
  customerId: number, 
  customerName: string,
  unitNumber: string, 
  tankReadings: SmartFillTankReading[],
  enableGeocoding: boolean = false
) {
  // Get the most recent reading for this unit
  const latestReading = tankReadings[0]; // Assuming first reading is most recent
  const description = latestReading?.Description || `Unit ${unitNumber}`;
  
  let latitude: number | null = null;
  let longitude: number | null = null;

  // Attempt geocoding if enabled (with improved error handling)
  if (enableGeocoding) {
    try {
      console.log(`[SMARTFILL GEOCODING] Attempting to geocode location: ${customerName} - ${description}`);
      
      // Add timeout to prevent hanging
      const geocodingPromise = geocodeSmartFillLocation(
        customerName,
        description,
        unitNumber
      );
      
      // Set a 15-second timeout for geocoding to prevent sync hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Geocoding timeout after 15 seconds')), 15000);
      });
      
      const geocodingResult = await Promise.race([geocodingPromise, timeoutPromise]);

      if ('latitude' in geocodingResult && geocodingResult.confidence > 0.3) {
        // Only use results with reasonable confidence
        if (validateAustralianCoordinates(geocodingResult.latitude, geocodingResult.longitude)) {
          latitude = geocodingResult.latitude;
          longitude = geocodingResult.longitude;
          console.log(`[SMARTFILL GEOCODING] Success: ${customerName} Unit ${unitNumber} -> ${latitude}, ${longitude} (confidence: ${geocodingResult.confidence.toFixed(2)})`);
        } else {
          console.warn(`[SMARTFILL GEOCODING] Invalid coordinates for ${customerName} Unit ${unitNumber}: ${geocodingResult.latitude}, ${geocodingResult.longitude}`);
        }
      } else {
        console.warn(`[SMARTFILL GEOCODING] Low confidence or failed for ${customerName} Unit ${unitNumber}`);
      }
    } catch (error) {
      // Geocoding errors should not break the sync process
      console.warn(`[SMARTFILL GEOCODING] Error geocoding ${customerName} Unit ${unitNumber}: ${error.message}`);
      console.warn(`[SMARTFILL GEOCODING] Continuing sync without GPS coordinates for this location`);
      // latitude and longitude remain null - this is acceptable
    }
  }
  
  return {
    location_guid: `smartfill-unit-${customerId}-${unitNumber}`,
    customer_name: customerName,
    customer_guid: `smartfill-customer-${customerId}`,
    customer_id: customerId,
    unit_number: unitNumber,
    description,
    timezone: latestReading?.Timezone || 'Australia/Perth',
    latitude,
    longitude,
    latest_volume: parseFloat(latestReading?.Volume?.toString() || '0'),
    latest_volume_percent: parseFloat(latestReading?.['Volume Percent']?.toString() || '0'),
    latest_status: latestReading?.Status || 'Unknown',
    latest_update_time: latestReading?.['Last Updated'] || new Date().toISOString(),
    raw_data: { tankReadings }
  };
}

function transformSmartFillTankData(
  locationId: string,
  customerId: number,
  unitNumber: string,
  tankReading: SmartFillTankReading
) {
  return {
    location_id: locationId,
    tank_guid: `smartfill-tank-${customerId}-${unitNumber}-${tankReading['Tank Number']}`,
    customer_id: customerId,
    unit_number: unitNumber,
    tank_number: tankReading['Tank Number'],
    description: tankReading.Description,
    capacity: parseFloat(tankReading.Capacity?.toString() || '0'),
    safe_fill_level: parseFloat(tankReading['Tank SFL']?.toString() || '0'),
    latest_volume: parseFloat(tankReading.Volume?.toString() || '0'),
    latest_volume_percent: parseFloat(tankReading['Volume Percent']?.toString() || '0'),
    latest_status: tankReading.Status,
    latest_update_time: tankReading['Last Updated'],
    raw_data: tankReading
  };
}

// Sync data from SmartFill API to our database
export async function syncSmartFillData(): Promise<SmartFillSyncResult> {
  const startTime = Date.now();
  const result: SmartFillSyncResult = {
    success: false,
    locationsProcessed: 0,
    tanksProcessed: 0,
    readingsProcessed: 0,
    errors: [],
    duration: 0
  };
  
  console.log('\n' + '='.repeat(60));
  console.log('🔄 SMARTFILL SYNC STARTED');
  console.log('='.repeat(60));

  try {
    // Log sync start
    const { data: syncLog } = await supabase
      .from('smartfill_sync_logs')
      .insert({
        sync_type: 'manual',
        sync_status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    // Get all SmartFill customers
    const customers = await getSmartFillCustomers();
    console.log(`\n📊 Found ${customers.length} SmartFill customers to process`);

    // Process each customer
    for (const customer of customers) {
      try {
        console.log(`\n🏢 Processing customer: ${customer.name} (${customer.api_reference})`);
        
        // Fetch tank data for this customer with timeout protection
        const tankReadings = await Promise.race([
          fetchSmartFillTankData(customer.api_reference, customer.api_secret),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Customer API timeout after 60 seconds')), 60000)
          )
        ]);
        
        if (tankReadings.length === 0) {
          console.log(`   ⚠️  No tank readings found for ${customer.name}`);
          continue;
        }
        
        console.log(`   📊 Found ${tankReadings.length} tank readings`);
        
        // Group readings by unit number to create locations
        const readingsByUnit = tankReadings.reduce((acc, reading) => {
          const unitNumber = reading['Unit Number'];
          if (!acc[unitNumber]) {
            acc[unitNumber] = [];
          }
          acc[unitNumber].push(reading);
          return acc;
        }, {} as Record<string, SmartFillTankReading[]>);
        
        // Process each unit as a location
        for (const [unitNumber, unitReadings] of Object.entries(readingsByUnit)) {
          try {
            console.log(`\n   📍 Processing Unit ${unitNumber} (${unitReadings.length} tanks)`);
            
            // Upsert location (geocoding disabled by default for stability)
            // Enable geocoding only when explicitly needed to avoid sync failures
            const locationData = await transformSmartFillLocationData(
              customer.id, 
              customer.name, 
              unitNumber, 
              unitReadings,
              false // Disable geocoding for now to ensure sync stability
            );
            
            const { data: location, error: locationError } = await supabase
              .from('smartfill_locations')
              .upsert(locationData, { 
                onConflict: 'location_guid',
                ignoreDuplicates: false 
              })
              .select()
              .single();

            if (locationError) {
              const errorMsg = `Location error for Unit ${unitNumber}: ${locationError.message}`;
              console.error(`      ❌ ${errorMsg}`);
              result.errors.push(errorMsg);
              continue;
            }

            console.log(`      ✅ Location updated (ID: ${location.id})`);
            result.locationsProcessed++;

            // Process each tank in this unit
            for (const tankReading of unitReadings) {
              try {
                console.log(`         🛢️  Processing Tank ${tankReading['Tank Number']}`);
                
                // Upsert tank
                const tankData = transformSmartFillTankData(
                  location.id, 
                  customer.id, 
                  unitNumber, 
                  tankReading
                );
                
                const { data: tank, error: tankError } = await supabase
                  .from('smartfill_tanks')
                  .upsert(tankData, { 
                    onConflict: 'tank_guid',
                    ignoreDuplicates: false 
                  })
                  .select()
                  .single();

                if (tankError) {
                  const errorMsg = `Tank error for ${tankReading['Tank Number']}: ${tankError.message}`;
                  console.error(`            ❌ ${errorMsg}`);
                  result.errors.push(errorMsg);
                  continue;
                }

                console.log(`            ✅ Tank updated`);
                result.tanksProcessed++;

                // Create historical reading
                const readingData = {
                  tank_id: tank.id,
                  volume: parseFloat(tankReading.Volume?.toString() || '0'),
                  volume_percent: parseFloat(tankReading['Volume Percent']?.toString() || '0'),
                  status: tankReading.Status,
                  update_time: tankReading['Last Updated'],
                  timezone: tankReading.Timezone,
                  capacity: parseFloat(tankReading.Capacity?.toString() || '0'),
                  safe_fill_level: parseFloat(tankReading['Tank SFL']?.toString() || '0'),
                  ullage: Math.max(0, parseFloat(tankReading['Tank SFL']?.toString() || '0') - parseFloat(tankReading.Volume?.toString() || '0'))
                };

                const { error: readingError } = await supabase
                  .from('smartfill_readings_history')
                  .insert(readingData);

                if (!readingError) {
                  result.readingsProcessed++;
                  console.log(`            ✅ Reading recorded (${tankReading['Volume Percent']}%)`);
                } else {
                  console.warn(`            ⚠️  Reading error: ${readingError.message}`);
                }
                
              } catch (tankError) {
                const errorMsg = `Tank processing error: ${tankError}`;
                console.error(`            ❌ ${errorMsg}`);
                result.errors.push(errorMsg);
              }
            }
            
          } catch (unitError) {
            const errorMsg = `Unit processing error for Unit ${unitNumber}: ${unitError}`;
            console.error(`      ❌ ${errorMsg}`);
            result.errors.push(errorMsg);
          }
        }
        
      } catch (customerError) {
        const errorMsg = `Customer processing error for ${customer.name} (${customer.api_reference}): ${customerError.message || customerError}`;
        console.error(`   ❌ ${errorMsg}`);
        console.error(`   🔍 Error details:`, {
          customerName: customer.name,
          apiReference: customer.api_reference,
          errorType: customerError.constructor.name,
          errorMessage: customerError.message,
          stack: customerError.stack?.split('\n').slice(0, 3).join('\n') // First 3 lines of stack trace
        });
        result.errors.push(errorMsg);
        
        // Continue processing other customers - don't let one failure break everything
        continue;
      }
    }

    result.success = result.errors.length === 0;
    result.duration = Date.now() - startTime;

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 SMARTFILL SYNC SUMMARY:');
    console.log('-'.repeat(40));
    console.log(`Status: ${result.success ? '✅ SUCCESS' : '⚠️  PARTIAL SUCCESS'}`);
    console.log(`Duration: ${result.duration}ms`);
    console.log(`\nProcessed:`);
    console.log(`  Customers: ${customers.length}`);
    console.log(`  Locations: ${result.locationsProcessed}`);
    console.log(`  Tanks: ${result.tanksProcessed}`);
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
        .from('smartfill_sync_logs')
        .update({
          sync_status: result.success ? 'success' : 'partial',
          locations_processed: result.locationsProcessed,
          tanks_processed: result.tanksProcessed,
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
    console.error('\n❌ SMARTFILL SYNC FAILED:', error);
    return result;
  }
}

// Test SmartFill API connectivity
export async function testSmartFillAPIConnection(
  clientReference?: string,
  clientSecret?: string
): Promise<{
  success: boolean;
  responseTime: number;
  error?: string;
  dataCount?: number;
  apiHealth: SmartFillAPIHealth;
}> {
  const startTime = Date.now();
  
  // Use provided credentials or get from first customer
  if (!clientReference || !clientSecret) {
    try {
      const customers = await getSmartFillCustomers();
      if (customers.length === 0) {
        return {
          success: false,
          responseTime: Date.now() - startTime,
          error: 'No SmartFill customers configured in database',
          apiHealth: getSmartFillAPIHealth()
        };
      }
      clientReference = customers[0].api_reference;
      clientSecret = customers[0].api_secret;
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: `Failed to get SmartFill customers: ${error}`,
        apiHealth: getSmartFillAPIHealth()
      };
    }
  }
  
  try {
    console.log('[SMARTFILL API TEST] Testing connection to SmartFill API...');
    
    const data = await fetchSmartFillTankData(clientReference, clientSecret);
    const responseTime = Date.now() - startTime;
    
    return {
      success: true,
      responseTime,
      dataCount: data.length,
      apiHealth: getSmartFillAPIHealth()
    };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('[SMARTFILL API TEST] Connection test failed:', error);
    
    return {
      success: false,
      responseTime,
      error: error instanceof Error ? error.message : String(error),
      apiHealth: getSmartFillAPIHealth()
    };
  }
}

// Get all SmartFill locations with tanks
// Uses ta_smartfill_* tables (new schema) and transforms to legacy field names for UI compatibility
export async function getSmartFillLocations(): Promise<SmartFillLocation[]> {
  const { data, error } = await supabase
    .from('ta_smartfill_locations')
    .select(`
      id,
      external_guid,
      unit_number,
      name,
      description,
      timezone,
      latitude,
      longitude,
      total_capacity,
      avg_fill_percent,
      latest_status,
      latest_update_at,
      created_at,
      updated_at,
      customer:ta_smartfill_customers(id, customer_name, external_guid),
      tanks:ta_smartfill_tanks(
        id,
        location_id,
        external_guid,
        customer_id,
        unit_number,
        tank_number,
        name,
        description,
        capacity,
        safe_fill_level,
        current_volume,
        current_volume_percent,
        current_status,
        last_reading_at,
        avg_daily_consumption,
        days_remaining,
        created_at,
        updated_at
      )
    `)
    .order('unit_number');

  if (error) {
    console.error('Error fetching SmartFill locations:', error);
    throw error;
  }

  // Transform new schema fields to legacy field names for UI compatibility
  return (data || []).map((loc: any) => ({
    id: loc.id,
    location_guid: loc.external_guid,
    customer_name: loc.customer?.customer_name || loc.name || 'Unknown',
    customer_guid: loc.customer?.external_guid || '',
    customer_id: loc.customer?.id || 0,
    unit_number: loc.unit_number,
    description: loc.description || loc.name,
    timezone: loc.timezone || 'Australia/Perth',
    latitude: loc.latitude,
    longitude: loc.longitude,
    latest_volume: loc.total_capacity ? Math.round((loc.avg_fill_percent / 100) * loc.total_capacity) : 0,
    latest_volume_percent: loc.avg_fill_percent || 0,
    latest_status: loc.latest_status || 'Unknown',
    latest_update_time: loc.latest_update_at,
    created_at: loc.created_at,
    updated_at: loc.updated_at,
    tanks: (loc.tanks || []).map((tank: any) => ({
      id: tank.id,
      location_id: tank.location_id,
      tank_guid: tank.external_guid,
      customer_id: tank.customer_id,
      unit_number: tank.unit_number,
      tank_number: tank.tank_number,
      description: tank.description || tank.name,
      capacity: tank.capacity,
      safe_fill_level: tank.safe_fill_level,
      latest_volume: tank.current_volume,
      latest_volume_percent: tank.current_volume_percent,
      latest_status: tank.current_status,
      latest_update_time: tank.last_reading_at,
      avg_daily_consumption: tank.avg_daily_consumption,
      days_remaining: tank.days_remaining,
      created_at: tank.created_at,
      updated_at: tank.updated_at,
    })),
  }));
}

// Get recent sync logs with caching
// Uses ta_smartfill_sync_logs table (new schema)
export async function getSmartFillSyncLogs(limit: number = 10) {
  const cacheKey = `${CACHE_KEYS.SMARTFILL_SYNC}logs_${limit}`;

  return await cacheApiResponse(
    cacheKey,
    async () => {
      const { data, error } = await supabase
        .from('ta_smartfill_sync_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching SmartFill sync logs:', error);
        throw error;
      }

      return data || [];
    },
    calculateSmartTTL('SMARTFILL_API', 'medium') / 2 // Cache sync logs with smart TTL
  );
}

// SmartFill Cache Management Functions

/**
 * Clear all SmartFill cache entries
 */
export async function clearSmartFillCache(): Promise<void> {
  try {
    const patterns = [
      `${CACHE_KEYS.SMARTFILL_TANKS}*`,
      `${CACHE_KEYS.SMARTFILL_CUSTOMERS}*`,
      `${CACHE_KEYS.SMARTFILL_SYNC}*`
    ];
    
    const totalCleared = await Promise.all(
      patterns.map(pattern => invalidatePattern(pattern))
    );
    
    const total = totalCleared.reduce((sum, count) => sum + count, 0);
    console.log(`[SMARTFILL CACHE] Cleared ${total} SmartFill cache entries`);
  } catch (error) {
    console.warn('[SMARTFILL CACHE] Failed to clear cache:', error);
  }
}

/**
 * Clear cache for a specific SmartFill customer
 */
export async function clearSmartFillCustomerCache(clientReference: string): Promise<void> {
  try {
    // Clear all cache entries for this customer
    const patterns = [
      `${CACHE_KEYS.SMARTFILL_TANKS}${clientReference}*`,
      `${CACHE_KEYS.SMARTFILL_CUSTOMERS}${clientReference}*`
    ];
    
    const totalCleared = await Promise.all(
      patterns.map(pattern => invalidatePattern(pattern))
    );
    
    const total = totalCleared.reduce((sum, count) => sum + count, 0);
    console.log(`[SMARTFILL CACHE] Cleared ${total} cache entries for customer ${clientReference}`);
  } catch (error) {
    console.warn(`[SMARTFILL CACHE] Failed to clear cache for customer ${clientReference}:`, error);
  }
}

/**
 * Get SmartFill API health including cache status
 */
export async function getSmartFillSystemHealth(): Promise<{
  api: SmartFillAPIHealth;
  cache: {
    healthy: boolean;
    latency: number;
    error?: string;
  };
  overall: 'healthy' | 'degraded' | 'unhealthy';
}> {
  const apiHealth = getSmartFillAPIHealth();
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
 * Force refresh SmartFill data (bypass cache)
 */
export async function refreshSmartFillData(clientReference: string, clientSecret: string): Promise<SmartFillTankReading[]> {
  // Clear existing cache first
  await clearSmartFillCustomerCache(clientReference);
  
  // Fetch fresh data (bypass cache)
  return await fetchSmartFillTankData(clientReference, clientSecret, true);
}

/**
 * Add GPS coordinates to existing SmartFill locations using geocoding
 * This can be run separately from the main sync to avoid disrupting data collection
 */
export async function geocodeSmartFillLocations(limitToCustomer?: string): Promise<{
  success: boolean;
  locationsProcessed: number;
  geocodingSuccess: number;
  errors: string[];
}> {
  const result = {
    success: false,
    locationsProcessed: 0,
    geocodingSuccess: 0,
    errors: []
  };

  console.log('\n🌍 SMARTFILL GEOCODING STARTED');
  console.log('='.repeat(50));

  try {
    // Get locations that don't have GPS coordinates yet
    const { data: locations, error } = await supabase
      .from('smartfill_locations')
      .select('*')
      .or('latitude.is.null,longitude.is.null')
      .order('customer_name, unit_number');

    if (error) {
      throw new Error(`Failed to fetch locations: ${error.message}`);
    }

    if (!locations || locations.length === 0) {
      console.log('✅ All locations already have GPS coordinates');
      result.success = true;
      return result;
    }

    console.log(`📍 Found ${locations.length} locations without GPS coordinates`);

    for (const location of locations) {
      // Skip if filtering by customer
      if (limitToCustomer && !location.customer_name.toLowerCase().includes(limitToCustomer.toLowerCase())) {
        continue;
      }

      try {
        console.log(`\n🔍 Geocoding: ${location.customer_name} - Unit ${location.unit_number}`);
        result.locationsProcessed++;

        const geocodingResult = await geocodeSmartFillLocation(
          location.customer_name,
          location.description || `Unit ${location.unit_number}`,
          location.unit_number
        );

        if ('latitude' in geocodingResult && geocodingResult.confidence > 0.3) {
          if (validateAustralianCoordinates(geocodingResult.latitude, geocodingResult.longitude)) {
            // Update the location with GPS coordinates
            const { error: updateError } = await supabase
              .from('smartfill_locations')
              .update({
                latitude: geocodingResult.latitude,
                longitude: geocodingResult.longitude,
                updated_at: new Date().toISOString()
              })
              .eq('id', location.id);

            if (updateError) {
              console.error(`   ❌ Failed to update GPS: ${updateError.message}`);
              result.errors.push(`Update failed for ${location.customer_name} Unit ${location.unit_number}: ${updateError.message}`);
            } else {
              console.log(`   ✅ GPS updated: ${geocodingResult.latitude}, ${geocodingResult.longitude} (confidence: ${geocodingResult.confidence.toFixed(2)})`);
              result.geocodingSuccess++;
            }
          } else {
            console.warn(`   ⚠️  Invalid coordinates: ${geocodingResult.latitude}, ${geocodingResult.longitude}`);
          }
        } else {
          console.warn(`   ⚠️  Geocoding failed or low confidence`);
        }

        // Rate limiting - wait 1.5 seconds between requests to respect Nominatim limits
        await new Promise(resolve => setTimeout(resolve, 1500));

      } catch (locationError) {
        console.error(`   ❌ Error processing ${location.customer_name}: ${locationError.message}`);
        result.errors.push(`${location.customer_name} Unit ${location.unit_number}: ${locationError.message}`);
      }
    }

    result.success = result.errors.length === 0;

    console.log('\n📈 GEOCODING SUMMARY:');
    console.log('-'.repeat(30));
    console.log(`Status: ${result.success ? '✅ SUCCESS' : '⚠️  PARTIAL SUCCESS'}`);
    console.log(`Locations processed: ${result.locationsProcessed}`);
    console.log(`GPS coordinates added: ${result.geocodingSuccess}`);
    console.log(`Errors: ${result.errors.length}`);

    return result;

  } catch (error) {
    console.error('❌ Geocoding process failed:', error.message);
    result.errors.push(`Geocoding process error: ${error.message}`);
    return result;
  }
}