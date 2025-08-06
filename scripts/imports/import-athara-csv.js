#!/usr/bin/env node

// Import the Athara Dashboard CSV data using the existing CSV import system

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY; // Use service role key for imports
const supabase = createClient(supabaseUrl, supabaseKey);

// Parse CSV data from the provided Athara Dashboard export
const csvData = [
  {
    "GUID": "256beac9-6ac6-417a-b710-499183a614b1",
    "Device: Serial Number": "0000100837",
    "Asset: Serial Number": "",
    "Device: ID": "867280067148791",
    "Device: Battery": "No Data",
    "Device: Subscription Id": "1nLp9UbUnxHwi841Z",
    "Device: SKU": "43111",
    "Device: Model": "Agbot Cellular 43111",
    "Device: Status": "Shipped",
    "Device: Status(value)": "0",
    "Device: Timestamp": "",
    "Device: Activation": "",
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
  },
  {
    "GUID": "7aeeaea8-c585-4f97-b962-d5d453cc3ef8",
    "Device: Serial Number": "0000100628",
    "Asset: Serial Number": "Mick Harders Tank",
    "Device: ID": "867280066315193",
    "Device: Battery": "Full",
    "Device: Subscription Id": "1nLxEEAUkfz7EcNh",
    "Device: SKU": "43111", 
    "Device: Model": "Agbot Cellular 43111",
    "Device: Status": "Active",
    "Device: Status(value)": "1",
    "Device: Timestamp": "25/07/2025, 11:24:45 am",
    "Device: Activation": "13/06/2025, 2:27:07 pm",
    "Tenancy": "Great Southern Fuel Supplies",
    "Tenancy Guid": "9d2a7cfa-530c-4048-b595-c1cb1cca61e3"
  },
  {
    "GUID": "caef5f06-23e2-47f7-8e94-0aa7d3d1a79a",
    "Device: Serial Number": "0000100623",
    "Asset: Serial Number": "Corrigin Tank 4 Diesel 54,400ltrs",
    "Device: ID": "867280067150201",
    "Device: Battery": "Full",
    "Device: Subscription Id": "1nLxEE4UbiiZ1lrpC",
    "Device: SKU": "43111",
    "Device: Model": "Agbot Cellular 43111", 
    "Device: Status": "Active",
    "Device: Status(value)": "1",
    "Device: Timestamp": "25/07/2025, 9:55:30 am",
    "Device: Activation": "03/02/2025, 4:20:19 pm",
    "Tenancy": "Great Southern Fuel Supplies",
    "Tenancy Guid": "9d2a7cfa-530c-4048-b595-c1cb1cca61e3"
  },
  {
    "GUID": "81d97087-73d6-4599-b191-fd0ebd9b7888",
    "Device: Serial Number": "0000100439",
    "Asset: Serial Number": "Lawsons Jerry South 53,000",
    "Device: ID": "867280067151159",
    "Device: Battery": "Full",
    "Device: Subscription Id": "1nLoqacUkfzGejEn",
    "Device: SKU": "43111",
    "Device: Model": "Agbot Cellular 43111",
    "Device: Status": "Active", 
    "Device: Status(value)": "1",
    "Device: Timestamp": "25/07/2025, 2:31:46 pm",
    "Device: Activation": "09/05/2025, 2:17:15 pm",
    "Tenancy": "Great Southern Fuel Supplies",
    "Tenancy Guid": "9d2a7cfa-530c-4048-b595-c1cb1cca61e3"
  },
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
    "GUID": "812d7574-46e6-4278-a465-23ad6ad17800",
    "Device: Serial Number": "0000100321",
    "Asset: Serial Number": "O'Meehan Farms Tank A 65,500ltrs",
    "Device: ID": "867280067150730",
    "Device: Battery": "Full",
    "Device: Subscription Id": "B8N4u8Ukg1OqSLy",
    "Device: SKU": "43111",
    "Device: Model": "Agbot Cellular 43111",
    "Device: Status": "Active",
    "Device: Status(value)": "1",
    "Device: Timestamp": "25/07/2025, 2:24:05 pm",
    "Device: Activation": "27/06/2025, 12:21:39 pm",
    "Tenancy": "Great Southern Fuel Supplies",
    "Tenancy Guid": "9d2a7cfa-530c-4048-b595-c1cb1cca61e3"
  },
  {
    "GUID": "b03ad57d-f994-461e-9680-0fd1f41b4abe",
    "Device: Serial Number": "0000100285",
    "Asset: Serial Number": "Jacup Diesel 53,000",
    "Device: ID": "867280067144568",
    "Device: Battery": "Full",
    "Device: Subscription Id": "1nLoqacUkfzr9uJ1",
    "Device: SKU": "43111",
    "Device: Model": "Agbot Cellular 43111",
    "Device: Status": "Active",
    "Device: Status(value)": "1",
    "Device: Timestamp": "25/07/2025, 1:33:18 pm",
    "Device: Activation": "10/05/2025, 5:46:20 pm",
    "Tenancy": "Great Southern Fuel Supplies",
    "Tenancy Guid": "9d2a7cfa-530c-4048-b595-c1cb1cca61e3"
  },
  {
    "GUID": "44fc539a-49e1-440d-ad3f-9caf8a573bbc",
    "Device: Serial Number": "0000098281",
    "Asset: Serial Number": "Katanning Depot Diesel",
    "Device: ID": "867280065350167",
    "Device: Battery": "Full",
    "Device: Subscription Id": "1nLoqYvUWd5UX33z",
    "Device: SKU": "43111",
    "Device: Model": "Agbot Cellular 43111",
    "Device: Status": "Active",
    "Device: Status(value)": "1",
    "Device: Timestamp": "25/07/2025, 11:10:01 am",
    "Device: Activation": "24/09/2024, 4:19:49 pm",
    "Tenancy": "Great Southern Fuel Supplies",
    "Tenancy Guid": "9d2a7cfa-530c-4048-b595-c1cb1cca61e3"
  },
  {
    "GUID": "eae863b4-f181-4856-b356-9722e3cde673",
    "Device: Serial Number": "0000097707",
    "Asset: Serial Number": "Lake Grace Diesel 110",
    "Device: ID": "867280065353880",
    "Device: Battery": "Full",
    "Device: Subscription Id": "1nLoqYvUWd5UX33z",
    "Device: SKU": "43111",
    "Device: Model": "Agbot Cellular 43111",
    "Device: Status": "Active",
    "Device: Status(value)": "1",
    "Device: Timestamp": "25/07/2025, 2:27:36 pm",
    "Device: Activation": "29/07/2024, 3:40:52 pm",
    "Tenancy": "Great Southern Fuel Supplies",
    "Tenancy Guid": "9d2a7cfa-530c-4048-b595-c1cb1cca61e3"
  },
  {
    "GUID": "5135f4ba-e1ee-4709-a946-cbcc71264a51",
    "Device: Serial Number": "0000091808",
    "Asset: Serial Number": "Mick Water Tank",
    "Device: ID": "867280065353971",
    "Device: Battery": "Full",
    "Device: Subscription Id": "1nLxEEAUkg0BunSU",
    "Device: SKU": "43112",
    "Device: Model": "Agbot Cellular 43112",
    "Device: Status": "Active",
    "Device: Status(value)": "1",
    "Device: Timestamp": "25/07/2025, 12:27:50 pm",
    "Device: Activation": "13/06/2025, 10:19:45 pm",
    "Tenancy": "Great Southern Fuel Supplies",
    "Tenancy Guid": "9d2a7cfa-530c-4048-b595-c1cb1cca61e3"
  }
];

// Transform CSV data to database format
function transformLocationData(csvRow) {
  // Generate consistent location_guid based on location name, not device GUID
  const locationName = csvRow["Asset: Serial Number"] || csvRow["Device: Serial Number"];
  const locationGuid = `location-${locationName.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '')}`;
  
  return {
    location_guid: locationGuid,
    customer_name: csvRow.Tenancy,
    customer_guid: csvRow["Tenancy Guid"],
    location_id: locationName,
    address1: '',
    address2: '',
    state: '',
    postcode: '',
    country: 'Australia',
    latest_calibrated_fill_percentage: 50, // Default since not in CSV
    installation_status: csvRow["Device: Status"] === "Active" ? 1 : 0,
    installation_status_label: csvRow["Device: Status"],
    location_status: csvRow["Device: Status"] === "Active" ? 1 : 0,
    location_status_label: csvRow["Device: Status"],
    latest_telemetry_epoch: Date.now(),
    latest_telemetry: new Date().toISOString(),
    lat: null,
    lng: null,
    disabled: false,
    raw_data: csvRow
  };
}

function transformAssetData(csvRow, locationId) {
  // Use the device GUID for asset identification (this is correct for assets)
  return {
    location_id: locationId,
    asset_guid: csvRow.GUID, // This is the device GUID - correct for assets
    asset_serial_number: csvRow["Asset: Serial Number"] || csvRow["Device: Serial Number"],
    asset_disabled: false,
    asset_profile_guid: `profile-${csvRow["Device: SKU"]}`,
    asset_profile_name: csvRow["Device: Model"],
    device_guid: `device-${csvRow["Device: ID"]}`,
    device_serial_number: csvRow["Device: Serial Number"],
    device_id: csvRow["Device: ID"],
    device_sku_guid: `sku-${csvRow["Device: SKU"]}`,
    device_sku_model: parseInt(csvRow["Device: SKU"]) || 0,
    device_sku_name: csvRow["Device: Model"],
    device_model_label: csvRow["Device: Model"],
    device_model: parseInt(csvRow["Device: SKU"]) || 0,
    device_online: csvRow["Device: Status"] === "Active",
    device_activation_date: csvRow["Device: Activation"] ? new Date(csvRow["Device: Activation"]).toISOString() : null,
    device_activation_epoch: csvRow["Device: Activation"] ? new Date(csvRow["Device: Activation"]).getTime() : null,
    latest_calibrated_fill_percentage: 50, // Default
    latest_raw_fill_percentage: 50, // Default
    latest_telemetry_event_timestamp: csvRow["Device: Timestamp"] ? new Date(csvRow["Device: Timestamp"]).toISOString() : new Date().toISOString(),
    latest_telemetry_event_epoch: csvRow["Device: Timestamp"] ? new Date(csvRow["Device: Timestamp"]).getTime() : Date.now(),
    latest_reported_lat: null,
    latest_reported_lng: null,
    subscription_id: csvRow["Device: Subscription Id"],
    raw_data: csvRow
  };
}

async function importData() {
  console.log('🚀 Starting Athara CSV Import...');
  console.log(`📊 Processing ${csvData.length} records`);
  
  let locationCount = 0;
  let assetCount = 0;
  let readingCount = 0;
  
  for (const csvRow of csvData) {
    try {
      // Skip header or invalid rows
      if (!csvRow.GUID || !csvRow["Tenancy"]) {
        console.log(`⚠️  Skipping invalid row`);
        continue;
      }
      
      console.log(`\n📍 Processing: ${csvRow["Asset: Serial Number"] || csvRow["Device: Serial Number"]}`);
      
      // 1. Import location
      const locationData = transformLocationData(csvRow);
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
        continue;
      }
      
      console.log(`   ✅ Location imported: ${location.id}`);
      locationCount++;
      
      // 2. Import asset
      const assetData = transformAssetData(csvRow, location.id);
      const { data: asset, error: assetError } = await supabase
        .from('agbot_assets')
        .upsert(assetData, { 
          onConflict: 'asset_guid',
          ignoreDuplicates: false 
        })
        .select()
        .single();
        
      if (assetError) {
        console.error(`   ❌ Asset error: ${assetError.message}`);
        continue;
      }
      
      console.log(`   ✅ Asset imported: ${asset.id}`);
      assetCount++;
      
      // 3. Create reading
      const readingData = {
        asset_id: asset.id, // Use the database ID, not GUID
        calibrated_fill_percentage: 50, // Default
        raw_fill_percentage: 50, // Default
        reading_timestamp: assetData.latest_telemetry_event_timestamp,
        device_online: csvRow["Device: Status"] === "Active",
        telemetry_epoch: assetData.latest_telemetry_event_epoch
      };
      
      const { error: readingError } = await supabase
        .from('agbot_readings_history')
        .insert(readingData);
        
      if (!readingError) {
        console.log(`   ✅ Reading imported`);
        readingCount++;
      } else {
        console.log(`   ⚠️  Reading error: ${readingError.message}`);
      }
      
    } catch (error) {
      console.error(`   ❌ Row error: ${error.message}`);
    }
  }
  
  console.log('\n🎉 Import Summary:');
  console.log(`   📍 Locations: ${locationCount}`);
  console.log(`   🔧 Assets: ${assetCount}`);
  console.log(`   📊 Readings: ${readingCount}`);
  console.log('\n✅ CSV import completed!');
  
  // Log import to sync logs
  await supabase
    .from('agbot_sync_logs')
    .insert({
      sync_type: 'csv_import_manual',
      sync_status: 'success',
      locations_processed: locationCount,
      assets_processed: assetCount,
      readings_processed: readingCount,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      sync_duration_ms: 0
    });
}

importData().catch(console.error);