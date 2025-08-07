// Gasbot Webhook Endpoint
// This endpoint receives hourly JSON data from Gasbot dashboard
// URL: https://fuel-sight-guardian-ce89d8de.vercel.app/api/gasbot-webhook

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for webhook operations
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY; // This is actually the service role key for backend operations
const supabase = createClient(supabaseUrl, supabaseKey);

// Webhook authentication secret
const WEBHOOK_SECRET = process.env.GASBOT_WEBHOOK_SECRET || 'FSG-gasbot-webhook-2025';

// Transform Gasbot webhook data to our database format
function transformGasbotLocationData(gasbotData) {
  // Generate consistent location_guid based on location name (same logic as CSV import)
  const locationName = gasbotData.LocationId;
  const locationGuid = `location-${locationName.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '')}`;
  
  // Parse address into components if available
  const addressParts = (gasbotData.LocationAddress || '').split(',').map(part => part.trim());
  
  return {
    location_guid: locationGuid,
    customer_name: gasbotData.TenancyName || 'Unknown Customer',
    customer_guid: `customer-${gasbotData.TenancyName?.replace(/\s+/g, '-').toLowerCase() || 'unknown'}`,
    location_id: gasbotData.LocationId,
    address1: addressParts[0] || gasbotData.LocationAddress || '',
    address2: addressParts[1] || '',
    state: addressParts[2] || '',
    postcode: addressParts[3] || '',
    country: 'Australia',
    latest_calibrated_fill_percentage: parseFloat(gasbotData.LocationCalibratedFillLevel || gasbotData.AssetCalibratedFillLevel) || 0,
    installation_status: gasbotData.LocationInstallationStatus || (gasbotData.DeviceOnline ? 1 : 0),
    installation_status_label: gasbotData.DeviceOnline ? 'Active' : 'Offline',
    location_status: gasbotData.DeviceOnline ? 1 : 0,
    location_status_label: gasbotData.DeviceOnline ? 'Active' : 'Offline',
    latest_telemetry_epoch: gasbotData.LocationLastCalibratedTelemetryEpoch || 
      (gasbotData.LocationLastCalibratedTelemetryTimestamp ? 
        new Date(gasbotData.LocationLastCalibratedTelemetryTimestamp).getTime() : Date.now()),
    latest_telemetry: gasbotData.LocationLastCalibratedTelemetryTimestamp || 
      gasbotData.AssetLastCalibratedTelemetryTimestamp || new Date().toISOString(),
    lat: parseFloat(gasbotData.LocationLat) || null,
    lng: parseFloat(gasbotData.LocationLng) || null,
    disabled: gasbotData.LocationDisabledStatus || !gasbotData.DeviceOnline,
    
    // New comprehensive fields
    location_category: gasbotData.LocationCategory,
    location_calibrated_fill_level: parseFloat(gasbotData.LocationCalibratedFillLevel) || null,
    location_last_calibrated_telemetry_epoch: gasbotData.LocationLastCalibratedTelemetryEpoch || null,
    location_last_calibrated_telemetry_timestamp: gasbotData.LocationLastCalibratedTelemetryTimestamp || null,
    location_disabled_status: gasbotData.LocationDisabledStatus || false,
    location_daily_consumption: parseFloat(gasbotData.LocationDailyConsumption) || null,
    location_days_remaining: parseInt(gasbotData.LocationDaysRemaining) || null,
    location_installation_status_code: gasbotData.LocationInstallationStatus || null,
    location_guid_external: gasbotData.LocationGuid,
    tenancy_name: gasbotData.TenancyName,
    
    raw_data: gasbotData // Store complete webhook data for reference
  };
}

function transformGasbotAssetData(gasbotData, locationId) {
  // Generate consistent asset_guid based on asset serial number
  const assetSerial = gasbotData.AssetSerialNumber || gasbotData.DeviceSerialNumber;
  const assetGuid = `asset-${assetSerial.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '')}`;
  
  return {
    location_id: locationId,
    asset_guid: assetGuid,
    asset_serial_number: gasbotData.AssetSerialNumber || gasbotData.DeviceSerialNumber,
    asset_disabled: gasbotData.AssetDisabledStatus || !gasbotData.DeviceOnline,
    asset_profile_guid: `profile-gasbot-tank`,
    asset_profile_name: gasbotData.AssetProfileName || 'Gasbot Tank',
    device_guid: gasbotData.DeviceGuid || `device-${gasbotData.DeviceSerialNumber}`,
    device_serial_number: gasbotData.DeviceSerialNumber,
    device_id: gasbotData.DeviceSerialNumber,
    device_sku_guid: gasbotData.DeviceSKU || 'sku-gasbot',
    device_sku_model: gasbotData.DeviceModel || 43111,
    device_sku_name: 'Gasbot Cellular Tank Monitor',
    device_model_label: 'Gasbot Cellular Tank Monitor',
    device_model: gasbotData.DeviceModel || 43111,
    device_online: gasbotData.DeviceOnline || false,
    device_activation_date: gasbotData.DeviceActivationTimestamp || null,
    device_activation_epoch: gasbotData.DeviceActivationEpoch || null,
    latest_calibrated_fill_percentage: parseFloat(gasbotData.AssetCalibratedFillLevel) || 0,
    latest_raw_fill_percentage: parseFloat(gasbotData.AssetRawFillLevel || gasbotData.AssetCalibratedFillLevel) || 0,
    latest_telemetry_event_timestamp: gasbotData.AssetLastCalibratedTelemetryTimestamp || new Date().toISOString(),
    latest_telemetry_event_epoch: gasbotData.AssetLastCalibratedTelemetryEpoch || 
      (gasbotData.AssetLastCalibratedTelemetryTimestamp ? 
        new Date(gasbotData.AssetLastCalibratedTelemetryTimestamp).getTime() : Date.now()),
    latest_reported_lat: parseFloat(gasbotData.AssetLatestReportedLat) || null,
    latest_reported_lng: parseFloat(gasbotData.AssetLatestReportedLng) || null,
    subscription_id: '',
    
    // New comprehensive asset fields
    asset_raw_fill_level: parseFloat(gasbotData.AssetRawFillLevel) || null,
    asset_last_raw_telemetry_epoch: gasbotData.AssetLastRawTelemetryEpoch || null,
    asset_last_raw_telemetry_timestamp: gasbotData.AssetLastRawTelemetryTimestamp || null,
    asset_last_calibrated_telemetry_epoch: gasbotData.AssetLastCalibratedTelemetryEpoch || null,
    asset_last_calibrated_telemetry_timestamp: gasbotData.AssetLastCalibratedTelemetryTimestamp || null,
    asset_updated_epoch: gasbotData.AssetUpdatedEpoch || null,
    asset_updated_timestamp: gasbotData.AssetUpdatedTimestamp || null,
    asset_daily_consumption: parseFloat(gasbotData.AssetDailyConsumption) || null,
    asset_days_remaining: parseInt(gasbotData.AssetDaysRemaining) || null,
    asset_reported_litres: parseFloat(gasbotData.AssetReportedLitres) || null,
    asset_depth: parseFloat(gasbotData.AssetDepth) || null,
    asset_pressure: parseFloat(gasbotData.AssetPressure) || null,
    asset_refill_capacity_litres: parseFloat(gasbotData.AssetRefillCapacityLitres) || null,
    asset_pressure_bar: parseFloat(gasbotData.AssetPressureBar) || null,
    asset_profile_water_capacity: parseFloat(gasbotData.AssetProfileWaterCapacity) || null,
    asset_profile_max_depth: parseFloat(gasbotData.AssetProfileMaxDepth) || null,
    asset_profile_max_pressure: parseFloat(gasbotData.AssetProfileMaxPressure) || null,
    asset_profile_max_pressure_bar: parseFloat(gasbotData.AssetProfileMaxPressureBar) || null,
    asset_profile_max_display_percentage_fill: parseFloat(gasbotData.AssetProfileMaxDisplayPercentageFill) || null,
    asset_profile_commodity: gasbotData.AssetProfileCommodity,
    
    // New comprehensive device fields
    device_last_telemetry_timestamp: gasbotData.DeviceLastTelemetryTimestamp || null,
    device_last_telemetry_epoch: gasbotData.DeviceLastTelemetryEpoch || null,
    device_sku: gasbotData.DeviceSKU,
    device_battery_voltage: parseFloat(gasbotData.DeviceBatteryVoltage) || null,
    device_temperature: parseFloat(gasbotData.DeviceTemperature) || null,
    device_activation_timestamp: gasbotData.DeviceActivationTimestamp || null,
    device_state: gasbotData.DeviceState,
    device_network_id: gasbotData.DeviceNetworkId,
    
    // Other fields
    helmet_serial_number: gasbotData.HelmetSerialNumber,
    
    raw_data: gasbotData
  };
}

export default async function handler(req, res) {
  const startTime = Date.now();
  
  console.log('\n🔗 GASBOT WEBHOOK RECEIVED');
  console.log('='.repeat(50));
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log(`🌐 Method: ${req.method}`);
  console.log(`📍 URL: ${req.url}`);
  console.log(`🔑 Headers:`, Object.keys(req.headers));
  
  // Check environment variables
  console.log(`🔧 Environment check:`);
  console.log(`   SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}`);
  console.log(`   SUPABASE_ANON_KEY (service role): ${supabaseKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`   GASBOT_WEBHOOK_SECRET: ${WEBHOOK_SECRET ? '✅ Set' : '❌ Missing'}`);
  
  // Fail fast if environment is not properly configured
  if (!supabaseUrl || !supabaseKey) {
    console.error('💥 CONFIGURATION ERROR: Missing required environment variables');
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'Missing required environment variables for database connection'
    });
  }
  
  // Only accept POST requests
  if (req.method !== 'POST') {
    console.log('❌ Invalid method:', req.method);
    return res.status(405).json({ 
      error: 'Method not allowed', 
      expected: 'POST',
      received: req.method 
    });
  }
  
  // Verify authentication
  const authHeader = req.headers.authorization;
  console.log(`🔐 Auth header: ${authHeader?.substring(0, 20)}...`);
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('❌ Missing Authorization header');
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Bearer token required in Authorization header' 
    });
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  if (token !== WEBHOOK_SECRET) {
    console.log('❌ Invalid webhook secret');
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid webhook secret' 
    });
  }
  
  console.log('✅ Authentication verified');
  
  try {
    // Parse the webhook data
    const webhookData = req.body;
    console.log(`📊 Received data type: ${typeof webhookData}`);
    console.log(`📋 Data keys: ${Object.keys(webhookData || {})}`);
    
    // Handle different data formats (array vs single object)
    let tankRecords = [];
    if (Array.isArray(webhookData)) {
      tankRecords = webhookData;
    } else if (webhookData && typeof webhookData === 'object') {
      tankRecords = [webhookData];
    } else {
      throw new Error('Invalid webhook data format - expected JSON object or array');
    }
    
    console.log(`🔢 Processing ${tankRecords.length} tank records`);
    
    let processedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Process each tank record
    for (let i = 0; i < tankRecords.length; i++) {
      const tankData = tankRecords[i];
      
      try {
        console.log(`\n📍 Processing record ${i + 1}: ${tankData.LocationId}`);
        console.log(`   🔧 Asset: ${tankData.AssetSerialNumber}`);
        console.log(`   ⛽ Fill Level: ${tankData.AssetCalibratedFillLevel}% (Raw: ${tankData.AssetRawFillLevel}%)`);
        console.log(`   📊 Volume: ${tankData.AssetReportedLitres}L`);
        console.log(`   🔋 Battery: ${tankData.DeviceBatteryVoltage}V`);
        console.log(`   📡 Device: ${tankData.DeviceState} (Online: ${tankData.DeviceOnline})`);
        console.log(`   📈 Consumption: ${tankData.AssetDailyConsumption || tankData.LocationDailyConsumption}L/day`);
        
        // 1. Upsert location
        const locationData = transformGasbotLocationData(tankData);
        const { data: location, error: locationError } = await supabase
          .from('agbot_locations')
          .upsert(locationData, { 
            onConflict: 'location_guid',
            ignoreDuplicates: false 
          })
          .select()
          .single();
          
        if (locationError) {
          throw new Error(`Location upsert failed: ${locationError.message}`);
        }
        
        console.log(`   ✅ Location updated: ${location.id}`);
        
        // 2. Upsert asset
        const assetData = transformGasbotAssetData(tankData, location.id);
        const { data: asset, error: assetError } = await supabase
          .from('agbot_assets')
          .upsert(assetData, { 
            onConflict: 'asset_guid',
            ignoreDuplicates: false 
          })
          .select()
          .single();
          
        if (assetError) {
          throw new Error(`Asset upsert failed: ${assetError.message}`);
        }
        
        console.log(`   ✅ Asset updated: ${asset.id}`);
        
        // 3. Create historical reading with comprehensive data
        const readingData = {
          asset_id: asset.id,
          calibrated_fill_percentage: parseFloat(tankData.AssetCalibratedFillLevel) || 0,
          raw_fill_percentage: parseFloat(tankData.AssetRawFillLevel || tankData.AssetCalibratedFillLevel) || 0,
          reading_timestamp: tankData.AssetLastCalibratedTelemetryTimestamp || new Date().toISOString(),
          device_online: tankData.DeviceOnline || false,
          telemetry_epoch: tankData.AssetLastCalibratedTelemetryEpoch || 
            (tankData.AssetLastCalibratedTelemetryTimestamp ? 
              new Date(tankData.AssetLastCalibratedTelemetryTimestamp).getTime() : Date.now()),
          
          // New comprehensive reading fields
          asset_raw_fill_level: parseFloat(tankData.AssetRawFillLevel) || null,
          asset_reported_litres: parseFloat(tankData.AssetReportedLitres) || null,
          device_battery_voltage: parseFloat(tankData.DeviceBatteryVoltage) || null,
          device_temperature: parseFloat(tankData.DeviceTemperature) || null,
          device_state: tankData.DeviceState,
          asset_depth: parseFloat(tankData.AssetDepth) || null,
          asset_pressure: parseFloat(tankData.AssetPressure) || null,
          asset_pressure_bar: parseFloat(tankData.AssetPressureBar) || null,
          daily_consumption: parseFloat(tankData.AssetDailyConsumption || tankData.LocationDailyConsumption) || null,
          days_remaining: parseInt(tankData.AssetDaysRemaining || tankData.LocationDaysRemaining) || null
        };
        
        const { error: readingError } = await supabase
          .from('agbot_readings_history')
          .insert(readingData);
          
        if (readingError) {
          console.log(`   ⚠️  Reading insert failed: ${readingError.message}`);
        } else {
          console.log(`   ✅ Reading recorded`);
        }
        
        processedCount++;
        
      } catch (recordError) {
        console.error(`   ❌ Record ${i + 1} failed: ${recordError.message}`);
        errors.push(`Record ${i + 1} (${tankData.LocationId}): ${recordError.message}`);
        errorCount++;
      }
    }
    
    const duration = Date.now() - startTime;
    
    // Log webhook success to sync logs
    await supabase
      .from('agbot_sync_logs')
      .insert({
        sync_type: 'gasbot_webhook',
        sync_status: errorCount === 0 ? 'success' : 'partial',
        locations_processed: processedCount,
        assets_processed: processedCount,
        readings_processed: processedCount,
        error_message: errors.length > 0 ? errors.slice(0, 3).join('; ') : null,
        sync_duration_ms: duration,
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString()
      });
    
    console.log('\n🎉 WEBHOOK PROCESSING COMPLETE');
    console.log(`   ✅ Processed: ${processedCount}/${tankRecords.length} records`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   ⏱️  Duration: ${duration}ms`);
    console.log('='.repeat(50));
    
    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      stats: {
        totalRecords: tankRecords.length,
        processedRecords: processedCount,
        errorCount: errorCount,
        duration: duration
      },
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined // Return first 5 errors
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('\n💥 WEBHOOK PROCESSING FAILED');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    // Log webhook failure
    await supabase
      .from('agbot_sync_logs')
      .insert({
        sync_type: 'gasbot_webhook',
        sync_status: 'error',
        locations_processed: 0,
        assets_processed: 0,
        readings_processed: 0,
        error_message: error.message,
        sync_duration_ms: duration,
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString()
      });
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      duration: duration
    });
  }
}