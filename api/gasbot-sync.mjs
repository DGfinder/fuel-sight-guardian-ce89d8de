// Gasbot Pull API Sync Endpoint
// Manual and scheduled sync endpoint to pull data from Gasbot API
// URL: https://fuel-sight-guardian-ce89d8de.vercel.app/api/gasbot-sync

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for API operations
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY; // Service role key for backend operations
const supabase = createClient(supabaseUrl, supabaseKey);

// API Configuration
const ATHARA_API_KEY = process.env.VITE_ATHARA_API_KEY || '0H5NTKJPLQURW4SQDU3J0G5EO7UNZCI6EB3C';
const ATHARA_API_SECRET = process.env.VITE_ATHARA_API_SECRET || '1F01ONSVQGCN47NOS987MAR768RBXJF5NO1VORQF7W';
const ATHARA_BASE_URL = process.env.VITE_ATHARA_BASE_URL || 'https://dashboard2-production.prod.gasbot.io';

// Authentication token for manual sync requests
const SYNC_SECRET = process.env.GASBOT_SYNC_SECRET || 'FSG-gasbot-sync-2025';

// Helper function for making authenticated API requests
async function makeAtharaRequest(endpoint, options = {}) {
  const url = `${ATHARA_BASE_URL}${endpoint}`;
  
  const requestOptions = {
    ...options,
    headers: {
      'X-API-Key': ATHARA_API_KEY,
      'X-API-Secret': ATHARA_API_SECRET,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    signal: AbortSignal.timeout(30000), // 30 second timeout
  };

  console.log(`[GASBOT SYNC] Making API request to: ${endpoint}`);
  
  const response = await fetch(url, requestOptions);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gasbot API error: ${response.status} ${response.statusText} - ${errorText}`);
  }
  
  const data = await response.json();
  console.log(`[GASBOT SYNC] API response: ${Array.isArray(data) ? data.length : 1} items`);
  
  return data;
}

// Transform Gasbot API data to our database format (ta_ schema)
function transformLocationData(gasbotLocation) {
  return {
    external_guid: gasbotLocation.locationGuid || `location-${gasbotLocation.locationId}-${Date.now()}`,
    customer_name: gasbotLocation.customerName || 'Unknown Customer',
    customer_guid: gasbotLocation.customerGuid || `customer-${gasbotLocation.customerName?.replace(/\s+/g, '-').toLowerCase() || 'unknown'}`,
    name: gasbotLocation.locationId,
    address: gasbotLocation.address1 || '',
    state: gasbotLocation.state || '',
    postcode: gasbotLocation.postcode || '',
    country: gasbotLocation.country || 'Australia',
    calibrated_fill_level: gasbotLocation.latestCalibratedFillPercentage || 0,
    installation_status: gasbotLocation.installationStatus || 0,
    installation_status_label: gasbotLocation.installationStatusLabel || 'Unknown',
    last_telemetry_epoch: gasbotLocation.latestTelemetryEpoch ?
      Math.floor(parseFloat(gasbotLocation.latestTelemetryEpoch)) : Date.now(),
    last_telemetry_at: gasbotLocation.latestTelemetry || new Date().toISOString(),
    latitude: gasbotLocation.lat || null,
    longitude: gasbotLocation.lng || null,
    is_disabled: gasbotLocation.disabled || false,
    raw_data: gasbotLocation
  };
}

function transformAssetData(gasbotAsset, locationId) {
  return {
    location_id: locationId,
    external_guid: gasbotAsset.assetGuid || `asset-${gasbotAsset.assetSerialNumber}-${Date.now()}`,
    serial_number: gasbotAsset.assetSerialNumber || '',
    is_disabled: gasbotAsset.assetDisabled || false,
    profile_guid: gasbotAsset.assetProfileGuid || '',
    profile_name: gasbotAsset.assetProfileName || '',
    name: gasbotAsset.assetProfileName || gasbotAsset.assetSerialNumber || '',
    device_guid: gasbotAsset.deviceGuid || '',
    device_serial: gasbotAsset.deviceSerialNumber || '',
    device_model_name: gasbotAsset.deviceModelLabel || '',
    device_model: gasbotAsset.deviceModel || 0,
    is_online: gasbotAsset.deviceOnline || false,
    device_activated_at: gasbotAsset.deviceActivationDate || null,
    device_activation_epoch: gasbotAsset.deviceActivationEpoch || null,
    current_level_percent: gasbotAsset.latestCalibratedFillPercentage || 0,
    current_raw_percent: gasbotAsset.latestRawFillPercentage || 0,
    last_telemetry_at: gasbotAsset.latestTelemetryEventTimestamp || new Date().toISOString(),
    last_telemetry_epoch: gasbotAsset.latestTelemetryEventEpoch ?
      Math.floor(parseFloat(gasbotAsset.latestTelemetryEventEpoch)) : Date.now(),
    raw_data: gasbotAsset
  };
}

export default async function handler(req, res) {
  const startTime = Date.now();
  
  console.log('\n🔄 GASBOT PULL SYNC STARTED');
  console.log('='.repeat(50));
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log(`🌐 Method: ${req.method}`);
  
  // Check environment variables
  console.log(`🔧 Environment check:`);
  console.log(`   SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}`);
  console.log(`   SUPABASE_ANON_KEY: ${supabaseKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`   ATHARA_API_KEY: ${ATHARA_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   ATHARA_API_SECRET: ${ATHARA_API_SECRET ? '✅ Set' : '❌ Missing'}`);
  
  // Fail fast if environment is not properly configured
  if (!supabaseUrl || !supabaseKey || !ATHARA_API_KEY || !ATHARA_API_SECRET) {
    console.error('💥 CONFIGURATION ERROR: Missing required environment variables');
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'Missing required environment variables'
    });
  }
  
  // Accept both GET (for testing) and POST (for scheduled sync)
  if (!['GET', 'POST'].includes(req.method)) {
    console.log('❌ Invalid method:', req.method);
    return res.status(405).json({ 
      error: 'Method not allowed', 
      expected: 'GET or POST',
      received: req.method 
    });
  }
  
  // Simple authentication for manual sync
  if (req.method === 'POST') {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token || token !== SYNC_SECRET) {
      console.log('❌ Invalid sync token');
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Valid sync token required' 
      });
    }
  }

  try {
    console.log('📡 Testing Gasbot API connection...');
    
    // Test API connection first
    let testResponse;
    try {
      testResponse = await makeAtharaRequest('/locations');
    } catch (error) {
      console.error('🚫 API Connection Test Failed:', error.message);
      return res.status(503).json({
        success: false,
        error: 'Gasbot API unavailable',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`✅ API Connection successful - received ${Array.isArray(testResponse) ? testResponse.length : 1} locations`);
    
    // Log sync start to database
    const { data: syncLog } = await supabase
      .from('ta_agbot_sync_log')
      .insert({
        sync_type: 'api_pull_sync',
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    let locationsProcessed = 0;
    let assetsProcessed = 0;
    let readingsProcessed = 0;
    let errorCount = 0;
    const errors = [];
    
    console.log(`\n📊 Processing ${testResponse.length} locations...`);
    
    // Process each location
    for (let i = 0; i < testResponse.length; i++) {
      const locationData = testResponse[i];
      
      try {
        console.log(`\n📍 Processing location ${i + 1}: ${locationData.locationId || locationData.customerName}`);
        console.log(`   Assets to process: ${locationData.assets?.length || 0}`);
        
        // Transform and upsert location
        const dbLocationData = transformLocationData(locationData);
        const { data: location, error: locationError } = await supabase
          .from('ta_agbot_locations')
          .upsert(dbLocationData, {
            onConflict: 'external_guid',
            ignoreDuplicates: false
          })
          .select()
          .single();
          
        if (locationError) {
          throw new Error(`Location upsert failed: ${locationError.message}`);
        }
        
        console.log(`   ✅ Location updated: ${location.id}`);
        locationsProcessed++;
        
        // Process assets for this location
        if (locationData.assets && Array.isArray(locationData.assets)) {
          for (const assetData of locationData.assets) {
            try {
              const dbAssetData = transformAssetData(assetData, location.id);
              const { data: asset, error: assetError } = await supabase
                .from('ta_agbot_assets')
                .upsert(dbAssetData, {
                  onConflict: 'external_guid',
                  ignoreDuplicates: false
                })
                .select()
                .single();
                
              if (assetError) {
                throw new Error(`Asset upsert failed: ${assetError.message}`);
              }
              
              console.log(`   ✅ Asset updated: ${asset.serial_number}`);
              assetsProcessed++;
              
              // Create historical reading
              if (assetData.latestCalibratedFillPercentage !== undefined) {
                const readingData = {
                  asset_id: asset.id,
                  level_percent: assetData.latestCalibratedFillPercentage,
                  raw_percent: assetData.latestRawFillPercentage || assetData.latestCalibratedFillPercentage,
                  reading_at: assetData.latestTelemetryEventTimestamp || new Date().toISOString(),
                  is_online: assetData.deviceOnline || false,
                  telemetry_epoch: assetData.latestTelemetryEventEpoch ?
                    Math.floor(parseFloat(assetData.latestTelemetryEventEpoch)) : Date.now()
                };

                const { error: readingError } = await supabase
                  .from('ta_agbot_readings')
                  .insert(readingData);
                
                if (!readingError) {
                  readingsProcessed++;
                  console.log(`   ✅ Reading stored: ${assetData.latestCalibratedFillPercentage}%`);
                } else {
                  console.warn(`   ⚠️  Reading error: ${readingError.message}`);
                }
              }
            } catch (assetError) {
              console.error(`   ❌ Asset error: ${assetError.message}`);
              errors.push(`Asset ${assetData.assetSerialNumber}: ${assetError.message}`);
              errorCount++;
            }
          }
        }
        
      } catch (locationError) {
        console.error(`   ❌ Location error: ${locationError.message}`);
        errors.push(`Location ${locationData.locationId}: ${locationError.message}`);
        errorCount++;
      }
    }
    
    const duration = Date.now() - startTime;
    const success = errorCount === 0;
    
    // Update sync log
    if (syncLog) {
      await supabase
        .from('ta_agbot_sync_log')
        .update({
          status: success ? 'success' : 'partial',
          locations_processed: locationsProcessed,
          assets_processed: assetsProcessed,
          readings_processed: readingsProcessed,
          error_message: errors.length > 0 ? errors.slice(0, 3).join('; ') : null,
          duration_ms: duration,
          completed_at: new Date().toISOString()
        })
        .eq('id', syncLog.id);
    }
    
    // Log final results
    console.log('\n📈 SYNC COMPLETED');
    console.log('='.repeat(50));
    console.log(`✅ Status: ${success ? 'SUCCESS' : 'PARTIAL SUCCESS'}`);
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`📍 Locations: ${locationsProcessed}/${testResponse.length}`);
    console.log(`🏷️  Assets: ${assetsProcessed}`);
    console.log(`📊 Readings: ${readingsProcessed}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('='.repeat(50));
    
    return res.status(200).json({
      success,
      message: 'Gasbot data sync completed',
      results: {
        locationsProcessed,
        assetsProcessed,
        readingsProcessed,
        errorCount,
        duration
      },
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('\n💥 SYNC FAILED');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    // Log failed sync
    try {
      await supabase
        .from('ta_agbot_sync_log')
        .insert({
          sync_type: 'api_pull_sync',
          status: 'error',
          started_at: new Date(startTime).toISOString(),
          completed_at: new Date().toISOString(),
          error_message: error.message,
          duration_ms: duration
        });
    } catch (logError) {
      console.error('Failed to log sync error:', logError);
    }
    
    return res.status(500).json({
      success: false,
      error: 'Sync failed',
      message: error.message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
}