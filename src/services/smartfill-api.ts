import { supabase } from '@/lib/supabase';

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

// Helper function for making JSON-RPC 2.0 API requests with retry logic
async function makeSmartFillRequest(
  method: string, 
  parameters: any, 
  clientReference: string, 
  clientSecret: string
): Promise<any> {
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
    body: JSON.dumps(requestBody),
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
  values: any[][];
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

// PRODUCTION SAFE: Fetch SmartFill tank data for a customer
export async function fetchSmartFillTankData(
  clientReference: string, 
  clientSecret: string
): Promise<SmartFillTankReading[]> {
  // Validate API credentials
  if (!clientReference || !clientSecret) {
    const error = 'CRITICAL: Invalid or missing SmartFill API credentials.';
    updateAPIHealth(false, error);
    throw new Error(error);
  }

  try {
    if (ENABLE_API_LOGGING) {
      console.log('[SMARTFILL API] Fetching tank data from SmartFill API...');
    }
    
    // Make JSON-RPC call to Tank:Level method
    const result = await makeSmartFillRequest(
      'Tank:Level', 
      {},
      clientReference, 
      clientSecret
    );
    
    // Validate the response structure
    if (!result || !result.columns || !Array.isArray(result.values)) {
      const error = 'Invalid SmartFill API response: expected columns and values arrays';
      updateAPIHealth(false, error);
      throw new Error(error);
    }
    
    // Transform column/value arrays into objects
    const tankReadings: SmartFillTankReading[] = result.values.map((row: any[]) => {
      const reading: any = {};
      result.columns.forEach((column: string, index: number) => {
        reading[column] = row[index];
      });
      return reading as SmartFillTankReading;
    });
    
    // Update health status on success
    updateAPIHealth(true);
    
    if (ENABLE_API_LOGGING) {
      console.log(`[SMARTFILL API] Successfully fetched ${tankReadings.length} tank readings`);
    }
    
    return tankReadings;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    updateAPIHealth(false, errorMessage);
    
    console.error('[SMARTFILL API] CRITICAL: API call failed:', error);
    
    // Re-throw the error instead of using mock data
    throw new Error(`SmartFill API unavailable: ${errorMessage}`);
  }
}

// Get all SmartFill customers from database
export async function getSmartFillCustomers(): Promise<SmartFillCustomer[]> {
  const { data, error } = await supabase
    .from('smartfill_customers')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching SmartFill customers:', error);
    throw error;
  }

  return data || [];
}

// Transform SmartFill data to our database format
function transformSmartFillLocationData(
  customerId: number, 
  customerName: string,
  unitNumber: string, 
  tankReadings: SmartFillTankReading[]
) {
  // Get the most recent reading for this unit
  const latestReading = tankReadings[0]; // Assuming first reading is most recent
  
  return {
    location_guid: `smartfill-unit-${customerId}-${unitNumber}`,
    customer_name: customerName,
    customer_guid: `smartfill-customer-${customerId}`,
    customer_id: customerId,
    unit_number: unitNumber,
    description: latestReading?.Description || `Unit ${unitNumber}`,
    timezone: latestReading?.Timezone || 'Australia/Perth',
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
        console.log(`\n🏢 Processing customer: ${customer.name}`);
        
        // Fetch tank data for this customer
        const tankReadings = await fetchSmartFillTankData(
          customer.api_reference, 
          customer.api_secret
        );
        
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
            
            // Upsert location
            const locationData = transformSmartFillLocationData(
              customer.id, 
              customer.name, 
              unitNumber, 
              unitReadings
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
        const errorMsg = `Customer processing error for ${customer.name}: ${customerError}`;
        console.error(`   ❌ ${errorMsg}`);
        result.errors.push(errorMsg);
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
export async function getSmartFillLocations(): Promise<SmartFillLocation[]> {
  const { data, error } = await supabase
    .from('smartfill_locations')
    .select(`
      *,
      tanks:smartfill_tanks(*)
    `)
    .order('unit_number');

  if (error) {
    console.error('Error fetching SmartFill locations:', error);
    throw error;
  }

  return data || [];
}

// Get recent sync logs
export async function getSmartFillSyncLogs(limit: number = 10) {
  const { data, error } = await supabase
    .from('smartfill_sync_logs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching SmartFill sync logs:', error);
    throw error;
  }

  return data || [];
}