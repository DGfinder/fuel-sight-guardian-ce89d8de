#!/usr/bin/env node

// Test script to reproduce Altona Farms sync issue
// This simulates the exact sync process that's failing

import { createClient } from '@supabase/supabase-js';

// Use the same credentials as in the production migration
const supabaseUrl = 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqenNkc3ZidGFwcmlpdXh6bWloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTE4MDU1MiwiZXhwIjoyMDY0NzU2NTUyfQ.c6HZBGuXBz-RHXwFasOmJ8A_e0oRkt6vy-hNFDidCKo';

const supabase = createClient(supabaseUrl, supabaseKey);

// SmartFill API configuration
const SMARTFILL_API_URL = 'https://www.fmtdata.com/API/api.php';

// Altona Farms specific data
const ALTONA_FARMS = {
  api_reference: 'ALTONAfm4309',
  api_secret: 'f3c5316db0610cdb',
  name: 'Altona Farms 4309'
};

async function makeSmartFillRequest(clientReference, clientSecret) {
  const requestBody = {
    jsonrpc: '2.0',
    method: 'Tank:Level',
    parameters: {
      clientReference,
      clientSecret
    },
    id: '1'
  };

  console.log(`🔗 Making API request for ${clientReference}...`);

  try {
    const response = await fetch(SMARTFILL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      throw new Error(`SmartFill API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`SmartFill JSON-RPC error: ${data.error.code} - ${data.error.message}`);
    }

    return data.result;
  } catch (error) {
    console.error(`❌ API Error for ${clientReference}:`, error.message);
    throw error;
  }
}

async function simulateGeocodingProcess(customerName, description, unitNumber) {
  console.log(`🌍 Testing geocoding for: ${customerName} - ${description} - Unit ${unitNumber}`);
  
  try {
    // Simulate the geocoding import
    const { geocodeSmartFillLocation } = await import('../src/utils/geocoding.js');
    
    const result = await geocodeSmartFillLocation(customerName, description, unitNumber);
    
    if ('latitude' in result) {
      console.log(`✅ Geocoding success: ${result.latitude}, ${result.longitude} (confidence: ${result.confidence})`);
      return { latitude: result.latitude, longitude: result.longitude };
    } else {
      console.log(`⚠️  Geocoding failed: ${result.error}`);
      return { latitude: null, longitude: null };
    }
  } catch (error) {
    console.error(`❌ Geocoding error: ${error.message}`);
    return { latitude: null, longitude: null };
  }
}

async function transformLocationData(customerId, customerName, unitNumber, tankReadings, enableGeocoding = false) {
  const latestReading = tankReadings[0];
  const description = latestReading?.Description || `Unit ${unitNumber}`;
  
  let latitude = null;
  let longitude = null;

  if (enableGeocoding) {
    const geoResult = await simulateGeocodingProcess(customerName, description, unitNumber);
    latitude = geoResult.latitude;
    longitude = geoResult.longitude;
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

async function testAltonaFarmsSync() {
  console.log('🧪 Testing Altona Farms 4309 Sync Process');
  console.log('='.repeat(50));

  try {
    // Step 1: Test API call
    console.log('\n1️⃣ Testing SmartFill API call...');
    const tankReadings = await makeSmartFillRequest(
      ALTONA_FARMS.api_reference, 
      ALTONA_FARMS.api_secret
    );
    
    console.log(`✅ API Success: ${tankReadings.values.length} tanks retrieved`);

    // Step 2: Group by unit number (same as sync process)
    console.log('\n2️⃣ Processing tank data...');
    const readingsByUnit = tankReadings.values
      .map((row) => {
        const reading = {};
        tankReadings.columns.forEach((column, index) => {
          if (index < row.length) {
            reading[column] = row[index];
          }
        });
        return reading;
      })
      .reduce((acc, reading) => {
        const unitNumber = reading['Unit Number'];
        if (!acc[unitNumber]) {
          acc[unitNumber] = [];
        }
        acc[unitNumber].push(reading);
        return acc;
      }, {});

    console.log(`✅ Found units: ${Object.keys(readingsByUnit).join(', ')}`);

    // Step 3: Test location transformation (without geocoding first)
    console.log('\n3️⃣ Testing location transformation (no geocoding)...');
    for (const [unitNumber, unitReadings] of Object.entries(readingsByUnit)) {
      try {
        const locationData = await transformLocationData(
          999, // fake customer ID
          ALTONA_FARMS.name,
          unitNumber,
          unitReadings,
          false // No geocoding first
        );
        console.log(`✅ Unit ${unitNumber} transformation successful (no geocoding)`);
      } catch (error) {
        console.error(`❌ Unit ${unitNumber} transformation failed:`, error.message);
      }
    }

    // Step 4: Test location transformation WITH geocoding
    console.log('\n4️⃣ Testing location transformation (WITH geocoding)...');
    for (const [unitNumber, unitReadings] of Object.entries(readingsByUnit)) {
      try {
        const locationData = await transformLocationData(
          999, // fake customer ID
          ALTONA_FARMS.name,
          unitNumber,
          unitReadings,
          true // Enable geocoding - THIS might be causing the error
        );
        console.log(`✅ Unit ${unitNumber} transformation successful (with geocoding)`);
        if (locationData.latitude && locationData.longitude) {
          console.log(`   📍 GPS: ${locationData.latitude}, ${locationData.longitude}`);
        } else {
          console.log(`   📍 GPS: Not found`);
        }
      } catch (error) {
        console.error(`❌ Unit ${unitNumber} transformation failed with geocoding:`, error.message);
        console.error(`   Full error:`, error);
        
        // This is likely where the sync is failing!
        console.log('\n🔍 POTENTIAL ROOT CAUSE FOUND:');
        console.log('   The geocoding process is likely causing the sync failure.');
        console.log('   This could be due to:');
        console.log('   - Network timeouts to OpenStreetMap Nominatim API');
        console.log('   - Rate limiting (1 request per second limit)');
        console.log('   - Import/module resolution issues');
        console.log('   - Invalid responses from geocoding service');
      }
    }

    console.log('\n✅ Test completed successfully');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testAltonaFarmsSync()
  .then(() => {
    console.log('\n🎉 Test script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test script failed:', error);
    process.exit(1);
  });