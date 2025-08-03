#!/usr/bin/env node

// Enhanced Athara CSV Import - Includes rich operational data from fleet CSV
// Imports fill levels, consumption rates, days remaining, addresses, tank metrics

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Enhanced CSV data from Athara Dashboard with rich operational information
const richCSVData = [
  {
    "Tenancy": "Great Southern Fuel Supplies",
    "Location: ID": "O'Meehan Farms Tank A 65,500ltrs",
    "Location: Level": "0",
    "Location: Daily Consumption": "0.00 %",
    "Location: Days Remaining": "",
    "Location: Last Seen": "25/07/2025, 2:00:00 pm",
    "Location: Street Address": "",
    "Location: Suburb": "",
    "Location: State": "",
    "Location: Status": "Installed",
    "Asset: Serial Number": "O'Meehan Farms Tank A 65,500ltrs",
    "Asset: Asset Profile": "O'Meehan Farms Tank A 65,500ltrs",
    "Asset: Created Date": "27/06/2025, 12:21:22 pm",
    "Asset: Disable Asset": "no",
    "Asset: Last Seen": "25/07/2025, 2:24:05 pm",
    "Asset: Raw Telemetries": "0",
    "Asset: Depth": "0",
    "Asset: Pressure": "",
    "Asset: Calibrated Telemetries": "0",
    "Device: Serial Number": "0000100321",
    "Device: Model": "Agbot Cellular 43111",
    "Device: SKU": "43111",
    "Device: ID": "867280067150730",
    "Device: Helmet": "",
    "Device: Subscription": "B8N4u8Ukg1OqSLy",
    "Device: Status": "Active",
    "Device: Online": "yes",
    "Device: Last Seen": "25/07/2025, 2:24:05 pm",
    "Device: Activation": "27/06/2025, 12:21:39 pm"
  },
  {
    "Tenancy": "Great Southern Fuel Supplies",
    "Location: ID": "Mick Water Tank",
    "Location: Level": "100",
    "Location: Daily Consumption": "0.00 %",
    "Location: Days Remaining": "",
    "Location: Last Seen": "25/07/2025, 2:00:00 pm",
    "Location: Street Address": "Mick Harders",
    "Location: Suburb": "",
    "Location: State": "",
    "Location: Status": "Installed",
    "Asset: Serial Number": "Mick Water Tank",
    "Asset: Asset Profile": "Mick Water Tank",
    "Asset: Created Date": "13/06/2025, 3:10:24 pm",
    "Asset: Disable Asset": "no",
    "Asset: Last Seen": "25/07/2025, 12:27:50 pm",
    "Asset: Raw Telemetries": "100",
    "Asset: Depth": "2.07",
    "Asset: Pressure": "",
    "Asset: Calibrated Telemetries": "100",
    "Device: Serial Number": "0000091808",
    "Device: Model": "Agbot Cellular 43112",
    "Device: SKU": "43112",
    "Device: ID": "867280065353971",
    "Device: Helmet": "",
    "Device: Subscription": "1nLxEEAUkg0BunSU",
    "Device: Status": "Active",
    "Device: Online": "yes",
    "Device: Last Seen": "25/07/2025, 12:27:50 pm",
    "Device: Activation": "13/06/2025, 10:19:45 pm"
  },
  {
    "Tenancy": "Great Southern Fuel Supplies",
    "Location: ID": "Mick Harders Tank",
    "Location: Level": "32.01",
    "Location: Daily Consumption": "5.26 %",
    "Location: Days Remaining": "6",
    "Location: Last Seen": "25/07/2025, 2:00:00 pm",
    "Location: Street Address": "Mick Harders",
    "Location: Suburb": "",
    "Location: State": "",
    "Location: Status": "Installed",
    "Asset: Serial Number": "Mick Harders Tank",
    "Asset: Asset Profile": "Mick Harders Tank",
    "Asset: Created Date": "13/06/2025, 2:26:52 pm",
    "Asset: Disable Asset": "no",
    "Asset: Last Seen": "25/07/2025, 11:24:45 am",
    "Asset: Raw Telemetries": "32.01",
    "Asset: Depth": "0.784",
    "Asset: Pressure": "",
    "Asset: Calibrated Telemetries": "32.01",
    "Device: Serial Number": "0000100628",
    "Device: Model": "Agbot Cellular 43111",
    "Device: SKU": "43111",
    "Device: ID": "867280066315193",
    "Device: Helmet": "",
    "Device: Subscription": "1nLxEEAUkfz7EcNh",
    "Device: Status": "Active",
    "Device: Online": "yes",
    "Device: Last Seen": "25/07/2025, 11:24:45 am",
    "Device: Activation": "13/06/2025, 2:27:07 pm"
  },
  {
    "Tenancy": "Great Southern Fuel Supplies",
    "Location: ID": "Lawsons Jerry South 53,000",
    "Location: Level": "51.9",
    "Location: Daily Consumption": "0.20 %",
    "Location: Days Remaining": "264",
    "Location: Last Seen": "25/07/2025, 3:00:00 pm",
    "Location: Street Address": "Lawson Grains - Jerry South",
    "Location: Suburb": "Jerramungup Depot",
    "Location: State": "Lawson Grains",
    "Location: Status": "Installed",
    "Asset: Serial Number": "Lawsons Jerry South 53,000",
    "Asset: Asset Profile": "Lawsons Jerry South 53,000",
    "Asset: Created Date": "06/06/2025, 2:06:23 pm",
    "Asset: Disable Asset": "no",
    "Asset: Last Seen": "25/07/2025, 2:31:46 pm",
    "Asset: Raw Telemetries": "51.9",
    "Asset: Depth": "1.505",
    "Asset: Pressure": "",
    "Asset: Calibrated Telemetries": "51.9",
    "Device: Serial Number": "0000100439",
    "Device: Model": "Agbot Cellular 43111",
    "Device: SKU": "43111",
    "Device: ID": "867280067151159",
    "Device: Helmet": "",
    "Device: Subscription": "1nLoqacUkfzGejEn",
    "Device: Status": "Active",
    "Device: Online": "yes",
    "Device: Last Seen": "25/07/2025, 2:31:46 pm",
    "Device: Activation": "09/05/2025, 2:17:15 pm"
  },
  {
    "Tenancy": "Great Southern Fuel Supplies",
    "Location: ID": "Lake Grace Diesel 110",
    "Location: Level": "50.25",
    "Location: Daily Consumption": "6.58 %",
    "Location: Days Remaining": "8",
    "Location: Last Seen": "25/07/2025, 2:00:00 pm",
    "Location: Street Address": "",
    "Location: Suburb": "Lake Grace Depot",
    "Location: State": "",
    "Location: Status": "Installed",
    "Asset: Serial Number": "Lake Grace Diesel 110",
    "Asset: Asset Profile": "Lake Grace Diesel 110",
    "Asset: Created Date": "21/06/2024, 11:22:30 am",
    "Asset: Disable Asset": "no",
    "Asset: Last Seen": "25/07/2025, 2:27:36 pm",
    "Asset: Raw Telemetries": "49.09",
    "Asset: Depth": "1.653",
    "Asset: Pressure": "",
    "Asset: Calibrated Telemetries": "49.09",
    "Device: Serial Number": "0000097707",
    "Device: Model": "Agbot Cellular 43111",
    "Device: SKU": "43111",
    "Device: ID": "867280065353880",
    "Device: Helmet": "",
    "Device: Subscription": "1nLoqYvUWd5UX33z",
    "Device: Status": "Active",
    "Device: Online": "yes",
    "Device: Last Seen": "25/07/2025, 2:27:36 pm",
    "Device: Activation": "29/07/2024, 3:40:52 pm"
  },
  {
    "Tenancy": "Great Southern Fuel Supplies",
    "Location: ID": "Bruce Rock Diesel",
    "Location: Level": "54.43",
    "Location: Daily Consumption": "2.39 %",
    "Location: Days Remaining": "23",
    "Location: Last Seen": "25/07/2025, 2:00:00 pm",
    "Location: Street Address": "1 Johnson Street",
    "Location: Suburb": "Bruce Rock",
    "Location: State": "Western Australia",
    "Location: Status": "Installed",
    "Asset: Serial Number": "Bruce Rock Diesel",
    "Asset: Asset Profile": "Bruce Rock Diesel",
    "Asset: Created Date": "09/07/2025, 12:34:09 pm",
    "Asset: Disable Asset": "no",
    "Asset: Last Seen": "25/07/2025, 3:09:36 pm",
    "Asset: Raw Telemetries": "53.31",
    "Asset: Depth": "1.803",
    "Asset: Pressure": "",
    "Asset: Calibrated Telemetries": "54.43",
    "Device: Serial Number": "0000100402",
    "Device: Model": "Agbot Cellular 43111",
    "Device: SKU": "43111",
    "Device: ID": "867280066307927",
    "Device: Helmet": "",
    "Device: Subscription": "1nLp9UbUnxHwi841Z",
    "Device: Status": "Active",
    "Device: Online": "yes",
    "Device: Last Seen": "25/07/2025, 3:09:36 pm",
    "Device: Activation": "09/07/2025, 11:53:04 am"
  }
  // Add other records as needed
];

// Parse percentage string to number
function parsePercentage(percentStr) {
  if (!percentStr || percentStr === '') return 0;
  return parseFloat(percentStr.replace('%', '').trim()) || 0;
}

// Parse date string to ISO format
function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  try {
    // Handle format: "25/07/2025, 2:00:00 pm"
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
    console.warn('Failed to parse date:', dateStr, e);
    return null;
  }
}

// Transform rich location data with operational metrics
function transformRichLocationData(csvRow) {
  const locationName = csvRow["Location: ID"];
  const locationGuid = `location-${locationName.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '')}`;
  
  return {
    location_guid: locationGuid,
    customer_name: csvRow.Tenancy,
    customer_guid: `customer-${csvRow.Tenancy?.replace(/\s+/g, '-').toLowerCase() || 'unknown'}`,
    location_id: locationName,
    
    // Enhanced address information
    address1: csvRow["Location: Street Address"] || '',
    address2: csvRow["Location: Suburb"] || '',
    state: csvRow["Location: State"] || '',
    postcode: '',
    country: 'Australia',
    
    // Real operational data from CSV
    latest_calibrated_fill_percentage: parseFloat(csvRow["Location: Level"]) || 0,
    daily_consumption_rate: parsePercentage(csvRow["Location: Daily Consumption"]),
    days_remaining: parseInt(csvRow["Location: Days Remaining"]) || null,
    
    installation_status: csvRow["Location: Status"] === "Installed" ? 1 : 0,
    installation_status_label: csvRow["Location: Status"],
    location_status: csvRow["Device: Online"] === "yes" ? 1 : 0,
    location_status_label: csvRow["Device: Online"] === "yes" ? 'Online' : 'Offline',
    
    latest_telemetry_epoch: parseDate(csvRow["Location: Last Seen"]) ? 
      new Date(parseDate(csvRow["Location: Last Seen"])).getTime() : Date.now(),
    latest_telemetry: parseDate(csvRow["Location: Last Seen"]) || new Date().toISOString(),
    
    lat: null, // Will be geocoded later if needed
    lng: null,
    disabled: csvRow["Asset: Disable Asset"] === "yes",
    raw_data: csvRow
  };
}

// Transform rich asset data with tank metrics
function transformRichAssetData(csvRow, locationId) {
  const assetSerial = csvRow["Asset: Serial Number"];
  const assetGuid = `asset-${assetSerial.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '')}`;
  
  return {
    location_id: locationId,
    asset_guid: assetGuid,
    asset_serial_number: assetSerial,
    asset_disabled: csvRow["Asset: Disable Asset"] === "yes",
    
    // Enhanced asset profile information
    asset_profile_guid: `profile-${csvRow["Device: SKU"]}`,
    asset_profile_name: csvRow["Asset: Asset Profile"],
    
    // Device information
    device_guid: `device-${csvRow["Device: ID"]}`,
    device_serial_number: csvRow["Device: Serial Number"],
    device_id: csvRow["Device: ID"],
    device_sku_guid: `sku-${csvRow["Device: SKU"]}`,
    device_sku_model: parseInt(csvRow["Device: SKU"]) || 0,
    device_sku_name: csvRow["Device: Model"],
    device_model_label: csvRow["Device: Model"],
    device_model: parseInt(csvRow["Device: SKU"]) || 0,
    device_online: csvRow["Device: Online"] === "yes",
    
    // Timestamps
    device_activation_date: parseDate(csvRow["Device: Activation"]),
    device_activation_epoch: parseDate(csvRow["Device: Activation"]) ? 
      new Date(parseDate(csvRow["Device: Activation"])).getTime() : null,
    
    // Rich tank measurement data
    latest_calibrated_fill_percentage: parseFloat(csvRow["Asset: Calibrated Telemetries"]) || 0,
    latest_raw_fill_percentage: parseFloat(csvRow["Asset: Raw Telemetries"]) || 0,
    tank_depth: parseFloat(csvRow["Asset: Depth"]) || null,
    tank_pressure: parseFloat(csvRow["Asset: Pressure"]) || null,
    
    latest_telemetry_event_timestamp: parseDate(csvRow["Asset: Last Seen"]) || new Date().toISOString(),
    latest_telemetry_event_epoch: parseDate(csvRow["Asset: Last Seen"]) ? 
      new Date(parseDate(csvRow["Asset: Last Seen"])).getTime() : Date.now(),
      
    latest_reported_lat: null,
    latest_reported_lng: null,
    subscription_id: csvRow["Device: Subscription"],
    raw_data: csvRow
  };
}

async function importRichData() {
  console.log('🚀 Starting Enhanced Athara CSV Import with Rich Data...');
  console.log(`📊 Processing ${richCSVData.length} records with operational metrics`);
  
  let locationCount = 0;
  let assetCount = 0;
  let readingCount = 0;
  const errors = [];
  
  for (const csvRow of richCSVData) {
    try {
      const locationName = csvRow["Location: ID"];
      if (!locationName) {
        console.log(`⚠️  Skipping invalid row - no location ID`);
        continue;
      }
      
      console.log(`\n📍 Processing: ${locationName}`);
      console.log(`   ⛽ Fill Level: ${csvRow["Location: Level"]}%`);
      console.log(`   📉 Daily Consumption: ${csvRow["Location: Daily Consumption"]}`);
      console.log(`   ⏰ Days Remaining: ${csvRow["Location: Days Remaining"] || 'Unknown'}`);
      console.log(`   📧 Address: ${csvRow["Location: Street Address"] || 'No address'}`);
      
      // 1. Import enhanced location with operational data
      const locationData = transformRichLocationData(csvRow);
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
      
      console.log(`   ✅ Location imported: ${location.id}`);
      locationCount++;
      
      // 2. Import enhanced asset with tank metrics
      const assetData = transformRichAssetData(csvRow, location.id);
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
        errors.push(assetError.message);
        continue;
      }
      
      console.log(`   ✅ Asset imported: ${asset.id}`);
      console.log(`      🔧 Tank depth: ${assetData.tank_depth || 'N/A'}m`);
      assetCount++;
      
      // 3. Create enhanced reading with real data
      const readingData = {
        asset_id: asset.id,
        calibrated_fill_percentage: assetData.latest_calibrated_fill_percentage,
        raw_fill_percentage: assetData.latest_raw_fill_percentage,
        reading_timestamp: assetData.latest_telemetry_event_timestamp,
        device_online: csvRow["Device: Online"] === "yes",
        telemetry_epoch: assetData.latest_telemetry_event_epoch,
        tank_depth: assetData.tank_depth,
        tank_pressure: assetData.tank_pressure
      };
      
      const { error: readingError } = await supabase
        .from('agbot_readings_history')
        .insert(readingData);
        
      if (!readingError) {
        console.log(`   ✅ Reading imported with real data`);
        readingCount++;
      } else {
        console.log(`   ⚠️  Reading error: ${readingError.message}`);
      }
      
    } catch (error) {
      console.error(`   ❌ Row processing error: ${error.message}`);
      errors.push(error.message);
    }
  }
  
  console.log('\n🎉 Enhanced Import Summary:');
  console.log(`   📍 Locations: ${locationCount} (with addresses & consumption data)`);
  console.log(`   🔧 Assets: ${assetCount} (with tank metrics)`);
  console.log(`   📊 Readings: ${readingCount} (with real fill levels)`);
  console.log(`   ❌ Errors: ${errors.length}`);
  
  if (errors.length > 0) {
    console.log('\n⚠️  Errors encountered:');
    errors.slice(0, 5).forEach((error, i) => {
      console.log(`   ${i + 1}. ${error}`);
    });
  }
  
  // Log enhanced import
  await supabase
    .from('agbot_sync_logs')
    .insert({
      sync_type: 'csv_import_enhanced_rich_data',
      sync_status: errors.length === 0 ? 'success' : 'partial',
      locations_processed: locationCount,
      assets_processed: assetCount,
      readings_processed: readingCount,
      error_message: errors.length > 0 ? errors.slice(0, 3).join('; ') : null,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      sync_duration_ms: 0
    });
  
  console.log('\n✅ Enhanced CSV import completed!');
  console.log('📋 Dashboard should now show rich operational data:');
  console.log('   - Real fill percentages');
  console.log('   - Daily consumption rates');  
  console.log('   - Days remaining calculations');
  console.log('   - Physical addresses');
  console.log('   - Tank depth measurements');
}

importRichData().catch(console.error);