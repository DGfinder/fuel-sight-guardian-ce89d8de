#!/usr/bin/env node

// Improved Athara CSV Import - Handles location vs device relationships properly
// This version groups devices by location and creates proper relationships

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Same CSV data from the Athara Dashboard export
const csvData = [
  // ... (same data as before, keeping it concise for the example)
  {
    "GUID": "c23009c9-ad68-4616-a020-b40267b69fc4",
    "Device: Serial Number": "0000100402",
    "Asset: Serial Number": "Bruce Rock Diesel",
    "Device: ID": "867280066307927",
    "Device: Battery": "Full",
    "Device: Subscription Id": "1nLp9UbUnxHwi841Z",
    "Device: SKU": "43111",
    "Device: Model": "Agbot Cellular 43111",
    "Device: Status": "Active",
    "Device: Status(value)": "1",
    "Device: Timestamp": "25/07/2025, 9:50:23 am",
    "Device: Activation": "09/07/2025, 11:53:04 am",
    "Tenancy": "Great Southern Fuel Supplies",
    "Tenancy Guid": "9d2a7cfa-530c-4048-b595-c1cb1cca61e3"
  },
  {
    "GUID": "8b9f88de-f179-4b43-b976-90a57309c9b9",
    "Device: Serial Number": "0000100687",
    "Asset: Serial Number": "Corrigin Tank 3 Diesel 54,400ltrs",
    "Device: ID": "867280067150953",
    "Device: Battery": "Full",
    "Device: Subscription Id": "1nLxEE4UbiiZ1lrpC",
    "Device: SKU": "43111",
    "Device: Model": "Agbot Cellular 43111",
    "Device: Status": "Active",
    "Device: Status(value)": "1",
    "Device: Timestamp": "25/07/2025, 11:49:13 am",
    "Device: Activation": "03/02/2025, 4:41:23 pm",
    "Tenancy": "Great Southern Fuel Supplies",
    "Tenancy Guid": "9d2a7cfa-530c-4048-b595-c1cb1cca61e3"
  }
  // Add other records here...
];

// Group devices by location name (location identity)
function groupDevicesByLocation(csvRows) {
  const locationGroups = new Map();
  
  for (const row of csvRows) {
    const locationName = row["Asset: Serial Number"] || row["Device: Serial Number"];
    
    if (!locationGroups.has(locationName)) {
      locationGroups.set(locationName, {
        locationData: row, // Use first device's data for location info
        devices: []
      });
    }
    
    locationGroups.get(locationName).devices.push(row);
  }
  
  return locationGroups;
}

// Transform location data (one per unique location)
function transformLocationData(locationRow, deviceCount) {
  const locationName = locationRow["Asset: Serial Number"] || locationRow["Device: Serial Number"];
  const locationGuid = `location-${locationName.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '')}`;
  
  return {
    location_guid: locationGuid,
    customer_name: locationRow.Tenancy,
    customer_guid: locationRow["Tenancy Guid"],
    location_id: locationName,
    address1: '', // Will be filled from Gasbot webhook later
    address2: '',
    state: '',
    postcode: '',
    country: 'Australia',
    latest_calibrated_fill_percentage: 50, // Default, will be updated by devices
    installation_status: locationRow["Device: Status"] === "Active" ? 1 : 0,
    installation_status_label: locationRow["Device: Status"],
    location_status: locationRow["Device: Status"] === "Active" ? 1 : 0,
    location_status_label: locationRow["Device: Status"],
    latest_telemetry_epoch: Date.now(),
    latest_telemetry: new Date().toISOString(),
    lat: null,
    lng: null,
    disabled: false,
    device_count: deviceCount, // Track how many devices this location has
    raw_data: locationRow
  };
}

// Transform device data (multiple per location)
function transformDeviceData(deviceRow, locationId) {
  return {
    location_id: locationId,
    asset_guid: deviceRow.GUID, // Device GUID is correct for assets
    asset_serial_number: deviceRow["Asset: Serial Number"] || deviceRow["Device: Serial Number"],
    asset_disabled: deviceRow["Device: Status"] !== "Active",
    asset_profile_guid: `profile-${deviceRow["Device: SKU"]}`,
    asset_profile_name: deviceRow["Device: Model"],
    device_guid: `device-${deviceRow["Device: ID"]}`,
    device_serial_number: deviceRow["Device: Serial Number"],
    device_id: deviceRow["Device: ID"],
    device_sku_guid: `sku-${deviceRow["Device: SKU"]}`,
    device_sku_model: parseInt(deviceRow["Device: SKU"]) || 0,
    device_sku_name: deviceRow["Device: Model"],
    device_model_label: deviceRow["Device: Model"],
    device_model: parseInt(deviceRow["Device: SKU"]) || 0,
    device_online: deviceRow["Device: Status"] === "Active",
    device_activation_date: deviceRow["Device: Activation"] ? new Date(deviceRow["Device: Activation"]).toISOString() : null,
    device_activation_epoch: deviceRow["Device: Activation"] ? new Date(deviceRow["Device: Activation"]).getTime() : null,
    latest_calibrated_fill_percentage: 50, // Default
    latest_raw_fill_percentage: 50, // Default
    latest_telemetry_event_timestamp: deviceRow["Device: Timestamp"] ? new Date(deviceRow["Device: Timestamp"]).toISOString() : new Date().toISOString(),
    latest_telemetry_event_epoch: deviceRow["Device: Timestamp"] ? new Date(deviceRow["Device: Timestamp"]).getTime() : Date.now(),
    latest_reported_lat: null,
    latest_reported_lng: null,
    subscription_id: deviceRow["Device: Subscription Id"],
    raw_data: deviceRow
  };
}

async function importImprovedData() {
  console.log('🚀 Starting Improved Athara CSV Import...');
  console.log(`📊 Processing ${csvData.length} device records`);
  
  // Group devices by location
  const locationGroups = groupDevicesByLocation(csvData);
  console.log(`📍 Found ${locationGroups.size} unique locations`);
  
  let locationCount = 0;
  let deviceCount = 0;
  let readingCount = 0;
  const errors = [];
  
  for (const [locationName, locationGroup] of locationGroups) {
    try {
      console.log(`\n📍 Processing Location: ${locationName}`);
      console.log(`   🔧 Devices at this location: ${locationGroup.devices.length}`);
      
      // 1. Create/update location (one per unique location)
      const locationData = transformLocationData(locationGroup.locationData, locationGroup.devices.length);
      const { data: location, error: locationError } = await supabase
        .from('agbot_locations')
        .upsert(locationData, { 
          onConflict: 'location_guid',
          ignoreDuplicates: false 
        })
        .select()
        .single();
        
      if (locationError) {
        console.error(`   ❌ Location error: ${locationError.message}`);
        errors.push(locationError.message);
        continue;
      }
      
      console.log(`   ✅ Location created/updated: ${location.id}`);
      locationCount++;
      
      // 2. Create/update all devices for this location
      for (const deviceRow of locationGroup.devices) {
        try {
          console.log(`      🔧 Processing Device: ${deviceRow["Device: Serial Number"]}`);
          
          const deviceData = transformDeviceData(deviceRow, location.id);
          const { data: device, error: deviceError } = await supabase
            .from('agbot_assets')
            .upsert(deviceData, { 
              onConflict: 'asset_guid',
              ignoreDuplicates: false 
            })
            .select()
            .single();
            
          if (deviceError) {
            console.error(`      ❌ Device error: ${deviceError.message}`);
            errors.push(deviceError.message);
            continue;
          }
          
          console.log(`      ✅ Device created/updated: ${device.id}`);
          deviceCount++;
          
          // 3. Create reading for this device
          const readingData = {
            asset_id: device.id,
            calibrated_fill_percentage: 50, // Default
            raw_fill_percentage: 50, // Default
            reading_timestamp: deviceData.latest_telemetry_event_timestamp,
            device_online: deviceRow["Device: Status"] === "Active",
            telemetry_epoch: deviceData.latest_telemetry_event_epoch
          };
          
          const { error: readingError } = await supabase
            .from('agbot_readings_history')
            .insert(readingData);
            
          if (!readingError) {
            console.log(`      ✅ Reading created`);
            readingCount++;
          } else {
            console.log(`      ⚠️  Reading error: ${readingError.message}`);
          }
          
        } catch (deviceError) {
          console.error(`      ❌ Device processing error: ${deviceError.message}`);
          errors.push(deviceError.message);
        }
      }
      
    } catch (locationError) {
      console.error(`   ❌ Location processing error: ${locationError.message}`);
      errors.push(locationError.message);
    }
  }
  
  console.log('\n🎉 Improved Import Summary:');
  console.log(`   📍 Unique Locations: ${locationCount}`);
  console.log(`   🔧 Total Devices: ${deviceCount}`);
  console.log(`   📊 Total Readings: ${readingCount}`);
  console.log(`   ❌ Errors: ${errors.length}`);
  
  if (errors.length > 0) {
    console.log('\n⚠️  Errors encountered:');
    errors.slice(0, 5).forEach((error, i) => {
      console.log(`   ${i + 1}. ${error}`);
    });
  }
  
  // Log import to sync logs
  await supabase
    .from('agbot_sync_logs')
    .insert({
      sync_type: 'csv_import_improved',
      sync_status: errors.length === 0 ? 'success' : 'partial',
      locations_processed: locationCount,
      assets_processed: deviceCount,
      readings_processed: readingCount,
      error_message: errors.length > 0 ? errors.slice(0, 3).join('; ') : null,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      sync_duration_ms: 0
    });
  
  console.log('\n✅ Improved CSV import completed!');
  console.log('📋 Dashboard should now show proper location-device relationships');
}

importImprovedData().catch(console.error);