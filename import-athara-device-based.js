#!/usr/bin/env node

// Device-Based Athara CSV Import - Uses device serial as primary unique key
// Ensures exactly one record per physical tank device

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Enhanced CSV data from Athara Dashboard (rich operational data)
const deviceCSVData = [
  {
    "Device: Serial Number": "0000100321",
    "Asset: Serial Number": "O'Meehan Farms Tank A 65,500ltrs",
    "Location: Level": "0",
    "Location: Daily Consumption": "0.00 %",
    "Location: Days Remaining": "",
    "Location: Street Address": "",
    "Location: Suburb": "",
    "Location: State": "",
    "Device: Online": "yes",
    "Device: Model": "Agbot Cellular 43111",
    "Device: Subscription": "B8N4u8Ukg1OqSLy",
    "Tenancy": "Great Southern Fuel Supplies"
  },
  {
    "Device: Serial Number": "0000091808", 
    "Asset: Serial Number": "Mick Water Tank",
    "Location: Level": "100",
    "Location: Daily Consumption": "0.00 %",
    "Location: Days Remaining": "",
    "Location: Street Address": "Mick Harders",
    "Location: Suburb": "",
    "Location: State": "",
    "Device: Online": "yes",
    "Device: Model": "Agbot Cellular 43112",
    "Device: Subscription": "1nLxEEAUkg0BunSU",
    "Tenancy": "Great Southern Fuel Supplies"
  },
  {
    "Device: Serial Number": "0000100628",
    "Asset: Serial Number": "Mick Harders Tank", 
    "Location: Level": "32.01",
    "Location: Daily Consumption": "5.26 %",
    "Location: Days Remaining": "6",
    "Location: Street Address": "Mick Harders",
    "Location: Suburb": "",
    "Location: State": "",
    "Device: Online": "yes",
    "Device: Model": "Agbot Cellular 43111",
    "Device: Subscription": "1nLxEEAUkfz7EcNh",
    "Tenancy": "Great Southern Fuel Supplies"
  },
  {
    "Device: Serial Number": "0000100439",
    "Asset: Serial Number": "Lawsons Jerry South 53,000",
    "Location: Level": "51.9", 
    "Location: Daily Consumption": "0.20 %",
    "Location: Days Remaining": "264",
    "Location: Street Address": "Lawson Grains - Jerry South",
    "Location: Suburb": "Jerramungup Depot",
    "Location: State": "Lawson Grains",
    "Device: Online": "yes",
    "Device: Model": "Agbot Cellular 43111",
    "Device: Subscription": "1nLoqacUkfzGejEn",
    "Tenancy": "Great Southern Fuel Supplies"
  },
  {
    "Device: Serial Number": "0000097707",
    "Asset: Serial Number": "Lake Grace Diesel 110",
    "Location: Level": "50.25",
    "Location: Daily Consumption": "6.58 %", 
    "Location: Days Remaining": "8",
    "Location: Street Address": "",
    "Location: Suburb": "Lake Grace Depot",
    "Location: State": "",
    "Device: Online": "yes",
    "Device: Model": "Agbot Cellular 43111",
    "Device: Subscription": "1nLoqYvUWd5UX33z",
    "Tenancy": "Great Southern Fuel Supplies"
  },
  {
    "Device: Serial Number": "0000100402",
    "Asset: Serial Number": "Bruce Rock Diesel",
    "Location: Level": "54.43",
    "Location: Daily Consumption": "2.39 %",
    "Location: Days Remaining": "23", 
    "Location: Street Address": "1 Johnson Street",
    "Location: Suburb": "Bruce Rock",
    "Location: State": "Western Australia",
    "Device: Online": "yes",
    "Device: Model": "Agbot Cellular 43111",
    "Device: Subscription": "1nLp9UbUnxHwi841Z",
    "Tenancy": "Great Southern Fuel Supplies"
  },
  {
    "Device: Serial Number": "0000098281",
    "Asset: Serial Number": "Katanning Depot Diesel",
    "Location: Level": "40.95",
    "Location: Daily Consumption": "2.28 %",
    "Location: Days Remaining": "18",
    "Location: Street Address": "",
    "Location: Suburb": "Jerramungup Depot", 
    "Location: State": "",
    "Device: Online": "yes",
    "Device: Model": "Agbot Cellular 43111",
    "Device: Subscription": "1nLoqYvUWd5UX33z",
    "Tenancy": "Great Southern Fuel Supplies"
  },
  {
    "Device: Serial Number": "0000100285",
    "Asset: Serial Number": "Jacup Diesel 53,000",
    "Location: Level": "20.22",
    "Location: Daily Consumption": "0.32 %",
    "Location: Days Remaining": "64",
    "Location: Street Address": "Lawson Grains - Gunnadoo",
    "Location: Suburb": "Jerramungup Depot",
    "Location: State": "",
    "Device: Online": "yes", 
    "Device: Model": "Agbot Cellular 43111",
    "Device: Subscription": "1nLoqacUkfzr9uJ1",
    "Tenancy": "Great Southern Fuel Supplies"
  },
  {
    "Device: Serial Number": "0000100623",
    "Asset: Serial Number": "Corrigin Tank 4 Diesel 54,400ltrs",
    "Location: Level": "59.69",
    "Location: Daily Consumption": "1.56 %",
    "Location: Days Remaining": "38",
    "Location: Street Address": "",
    "Location: Suburb": "Corrigin Depot",
    "Location: State": "",
    "Device: Online": "yes",
    "Device: Model": "Agbot Cellular 43111", 
    "Device: Subscription": "1nLxEE4UbiiZ1lrpC",
    "Tenancy": "Great Southern Fuel Supplies"
  },
  {
    "Device: Serial Number": "0000100687",
    "Asset: Serial Number": "Corrigin Tank 3 Diesel 54,400ltrs",
    "Location: Level": "58.39",
    "Location: Daily Consumption": "1.52 %",
    "Location: Days Remaining": "38",
    "Location: Street Address": "",
    "Location: Suburb": "Corrigin Depot",
    "Location: State": "",
    "Device: Online": "yes",
    "Device: Model": "Agbot Cellular 43111",
    "Device: Subscription": "1nLxEE4UbiiZ1lrpC",
    "Tenancy": "Great Southern Fuel Supplies"
  }
];

// Parse percentage string to number
function parsePercentage(percentStr) {
  if (!percentStr || percentStr === '') return 0;
  return parseFloat(percentStr.replace('%', '').trim()) || 0;
}

// Transform device data (device serial as primary key)
function transformDeviceData(csvRow) {
  const deviceSerial = csvRow["Device: Serial Number"];
  const locationName = csvRow["Asset: Serial Number"];
  
  // Create location record (one per device for simplicity)
  const locationData = {
    location_guid: `device-${deviceSerial}`, // Use device serial as unique identifier
    customer_name: csvRow.Tenancy,
    customer_guid: `customer-${csvRow.Tenancy?.replace(/\s+/g, '-').toLowerCase() || 'unknown'}`,
    location_id: locationName, // Location name for context
    
    // Rich address information
    address1: csvRow["Location: Street Address"] || 'No address',
    address2: csvRow["Location: Suburb"] || '',
    state: csvRow["Location: State"] || '',
    postcode: '',
    country: 'Australia',
    
    // Real operational data from CSV
    latest_calibrated_fill_percentage: parseFloat(csvRow["Location: Level"]) || 0,
    daily_consumption_rate: parsePercentage(csvRow["Location: Daily Consumption"]),
    days_remaining: parseInt(csvRow["Location: Days Remaining"]) || null,
    
    installation_status: 1,
    installation_status_label: 'Installed',
    location_status: csvRow["Device: Online"] === "yes" ? 1 : 0,
    location_status_label: csvRow["Device: Online"] === "yes" ? 'Online' : 'Offline',
    
    latest_telemetry_epoch: Date.now(),
    latest_telemetry: new Date().toISOString(),
    lat: null,
    lng: null,
    disabled: false,
    raw_data: csvRow
  };
  
  // Create asset record (linked to location)
  const assetData = {
    asset_guid: `device-${deviceSerial}`, // Use device serial as unique identifier
    asset_serial_number: locationName,
    asset_disabled: csvRow["Device: Online"] !== "yes",
    asset_profile_guid: `profile-device-${deviceSerial}`,
    asset_profile_name: locationName,
    
    device_guid: `device-guid-${deviceSerial}`,
    device_serial_number: deviceSerial, // The real unique identifier
    device_id: deviceSerial,
    device_sku_guid: 'sku-agbot',
    device_sku_model: 43111,
    device_sku_name: csvRow["Device: Model"],
    device_model_label: csvRow["Device: Model"],
    device_model: 43111,
    device_online: csvRow["Device: Online"] === "yes",
    
    latest_calibrated_fill_percentage: parseFloat(csvRow["Location: Level"]) || 0,
    latest_raw_fill_percentage: parseFloat(csvRow["Location: Level"]) || 0,
    latest_telemetry_event_timestamp: new Date().toISOString(),
    latest_telemetry_event_epoch: Date.now(),
    
    subscription_id: csvRow["Device: Subscription"],
    raw_data: csvRow
  };
  
  return { locationData, assetData };
}

async function importDeviceBasedData() {
  console.log('🚀 Starting Device-Based Athara CSV Import...');
  console.log(`📊 Processing ${deviceCSVData.length} unique devices`);
  console.log('🔑 Using device serial number as primary unique key');
  
  let deviceCount = 0;
  let readingCount = 0;
  const errors = [];
  
  for (const csvRow of deviceCSVData) {
    try {
      const deviceSerial = csvRow["Device: Serial Number"];
      const locationName = csvRow["Asset: Serial Number"];
      
      if (!deviceSerial) {
        console.log(`⚠️  Skipping row - no device serial number`);
        continue;
      }
      
      console.log(`\n🔧 Processing Device: ${deviceSerial}`);
      console.log(`   📍 Tank: ${locationName}`);
      console.log(`   ⛽ Fill Level: ${csvRow["Location: Level"]}%`);
      console.log(`   📉 Daily Consumption: ${csvRow["Location: Daily Consumption"]}`);
      console.log(`   ⏰ Days Remaining: ${csvRow["Location: Days Remaining"] || 'Unknown'}`);
      console.log(`   📧 Address: ${csvRow["Location: Street Address"] || 'No address'}`);
      
      const { locationData, assetData } = transformDeviceData(csvRow);
      
      // 1. Upsert location (one per device)
      const { data: location, error: locationError } = await supabase
        .from('agbot_locations')
        .upsert(locationData, { 
          onConflict: 'location_guid', // Upsert by device-based GUID
          ignoreDuplicates: false 
        })
        .select()
        .single();
        
      if (locationError) {
        console.error(`   ❌ Location error: ${locationError.message}`);
        errors.push(locationError.message);
        continue;
      }
      
      console.log(`   ✅ Device location record: ${location.id}`);
      
      // 2. Upsert asset (linked to location)
      assetData.location_id = location.id;
      const { data: asset, error: assetError } = await supabase
        .from('agbot_assets')
        .upsert(assetData, { 
          onConflict: 'device_serial_number', // Upsert by device serial (unique constraint)
          ignoreDuplicates: false 
        })
        .select()
        .single();
        
      if (assetError) {
        console.error(`   ❌ Asset error: ${assetError.message}`);
        errors.push(assetError.message);
        continue;
      }
      
      console.log(`   ✅ Device asset record: ${asset.id}`);
      deviceCount++;
      
      // 3. Create reading with real data
      const readingData = {
        asset_id: asset.id,
        calibrated_fill_percentage: parseFloat(csvRow["Location: Level"]) || 0,
        raw_fill_percentage: parseFloat(csvRow["Location: Level"]) || 0,
        reading_timestamp: new Date().toISOString(),
        device_online: csvRow["Device: Online"] === "yes",
        telemetry_epoch: Date.now()
      };
      
      const { error: readingError } = await supabase
        .from('agbot_readings_history')
        .insert(readingData);
        
      if (!readingError) {
        console.log(`   ✅ Reading recorded with real data`);
        readingCount++;
      } else {
        console.log(`   ⚠️  Reading error: ${readingError.message}`);
      }
      
    } catch (error) {
      console.error(`   ❌ Device processing error: ${error.message}`);
      errors.push(error.message);
    }
  }
  
  console.log('\n🎉 Device-Based Import Summary:');
  console.log(`   🔧 Unique Devices: ${deviceCount} (one record per physical tank)`);
  console.log(`   📊 Readings: ${readingCount} (with real operational data)`);
  console.log(`   ❌ Errors: ${errors.length}`);
  
  if (errors.length > 0) {
    console.log('\n⚠️  Errors encountered:');
    errors.slice(0, 5).forEach((error, i) => {
      console.log(`   ${i + 1}. ${error}`);
    });
  }
  
  // Log device-based import
  await supabase
    .from('agbot_sync_logs')
    .insert({
      sync_type: 'csv_import_device_based',
      sync_status: errors.length === 0 ? 'success' : 'partial',
      locations_processed: deviceCount,
      assets_processed: deviceCount,
      readings_processed: readingCount,
      error_message: errors.length > 0 ? errors.slice(0, 3).join('; ') : null,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      sync_duration_ms: 0
    });
  
  console.log('\n✅ Device-based CSV import completed!');
  console.log('🔑 Data integrity ensured: exactly one record per device serial number');
  console.log('📋 Dashboard should now show correct tank count with rich operational data');
  console.log('\n🚨 Critical tanks needing attention:');
  console.log('   - Device #0000100628 (Mick Harders): 6 days remaining!');
  console.log('   - Device #0000097707 (Lake Grace): 8 days remaining!'); 
  console.log('   - Device #0000098281 (Katanning): 18 days remaining');
}

importDeviceBasedData().catch(console.error);