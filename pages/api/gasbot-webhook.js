// Gasbot Webhook Endpoint
// This endpoint receives hourly JSON data from Gasbot dashboard
// URL: https://fuel-sight-guardian-ce89d8de.vercel.app/api/gasbot-webhook

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY; // Use service role key for webhook operations
const supabase = createClient(supabaseUrl, supabaseKey);

// Webhook authentication secret
const WEBHOOK_SECRET = process.env.GASBOT_WEBHOOK_SECRET || 'FSG-gasbot-webhook-2025';

// Transform Gasbot webhook data to our database format
function transformGasbotLocationData(gasbotData) {
  return {
    location_guid: `gasbot-${gasbotData.LocationId?.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`,
    customer_name: gasbotData.TenancyName || 'Unknown Customer',
    customer_guid: `customer-${gasbotData.TenancyName?.replace(/\s+/g, '-').toLowerCase() || 'unknown'}`,
    location_id: gasbotData.LocationId,
    address1: gasbotData.LocationAddress || '',
    address2: '',
    state: '',
    postcode: '',
    country: 'Australia',
    latest_calibrated_fill_percentage: parseFloat(gasbotData.AssetCalibratedFillLevel) || 0,
    installation_status: gasbotData.DeviceOnline ? 1 : 0,
    installation_status_label: gasbotData.DeviceOnline ? 'Active' : 'Offline',
    location_status: gasbotData.DeviceOnline ? 1 : 0,
    location_status_label: gasbotData.DeviceOnline ? 'Active' : 'Offline',
    latest_telemetry_epoch: gasbotData.AssetLastCalibratedTelemetryTimestamp ? 
      new Date(gasbotData.AssetLastCalibratedTelemetryTimestamp).getTime() : Date.now(),
    latest_telemetry: gasbotData.AssetLastCalibratedTelemetryTimestamp || new Date().toISOString(),
    lat: null,
    lng: null,
    disabled: !gasbotData.DeviceOnline,
    raw_data: gasbotData // Store complete webhook data for reference
  };
}

function transformGasbotAssetData(gasbotData, locationId) {
  return {
    location_id: locationId,
    asset_guid: `gasbot-asset-${gasbotData.AssetSerialNumber || gasbotData.DeviceSerialNumber}-${Date.now()}`,
    asset_serial_number: gasbotData.AssetSerialNumber || gasbotData.DeviceSerialNumber,
    asset_disabled: !gasbotData.DeviceOnline,
    asset_profile_guid: `profile-gasbot-tank`,
    asset_profile_name: 'Gasbot Tank',
    device_guid: `device-${gasbotData.DeviceSerialNumber}`,
    device_serial_number: gasbotData.DeviceSerialNumber,
    device_id: gasbotData.DeviceSerialNumber,
    device_sku_guid: 'sku-gasbot',
    device_sku_model: 43111, // Default Gasbot model
    device_sku_name: 'Gasbot Cellular Tank Monitor',
    device_model_label: 'Gasbot Cellular Tank Monitor',
    device_model: 43111,
    device_online: gasbotData.DeviceOnline || false,
    device_activation_date: null,
    device_activation_epoch: null,
    latest_calibrated_fill_percentage: parseFloat(gasbotData.AssetCalibratedFillLevel) || 0,
    latest_raw_fill_percentage: parseFloat(gasbotData.AssetCalibratedFillLevel) || 0,
    latest_telemetry_event_timestamp: gasbotData.AssetLastCalibratedTelemetryTimestamp || new Date().toISOString(),
    latest_telemetry_event_epoch: gasbotData.AssetLastCalibratedTelemetryTimestamp ? 
      new Date(gasbotData.AssetLastCalibratedTelemetryTimestamp).getTime() : Date.now(),
    latest_reported_lat: null,
    latest_reported_lng: null,
    subscription_id: '',
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
        console.log(`   ⛽ Fill Level: ${tankData.AssetCalibratedFillLevel}%`);
        console.log(`   📡 Online: ${tankData.DeviceOnline}`);
        
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
        
        // 3. Create historical reading
        const readingData = {
          asset_id: asset.id,
          calibrated_fill_percentage: parseFloat(tankData.AssetCalibratedFillLevel) || 0,
          raw_fill_percentage: parseFloat(tankData.AssetCalibratedFillLevel) || 0,
          reading_timestamp: tankData.AssetLastCalibratedTelemetryTimestamp || new Date().toISOString(),
          device_online: tankData.DeviceOnline || false,
          telemetry_epoch: tankData.AssetLastCalibratedTelemetryTimestamp ? 
            new Date(tankData.AssetLastCalibratedTelemetryTimestamp).getTime() : Date.now()
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