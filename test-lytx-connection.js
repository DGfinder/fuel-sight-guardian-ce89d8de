// Test LYTX API connection
// Run with: node test-lytx-connection.js

const API_KEY = 'diCeZd54DgkVzV2aPumlLG1qcZflO0GS';
const BASE_URL = 'https://lytx-api.prod7.lv.lytx.com';

async function testLytxConnection() {
  console.log('🔍 Testing LYTX API Connection...\n');
  
  console.log('Configuration:');
  console.log(`  API Key: ${API_KEY.substring(0, 8)}...${API_KEY.substring(-4)}`);
  console.log(`  Base URL: ${BASE_URL}`);
  console.log('');

  const headers = {
    'accept': 'application/json',
    'x-apikey': API_KEY,
    'Content-Type': 'application/json'
  };

  // Test 1: Event Statuses (Reference Data)
  console.log('📋 Test 1: Fetching Event Statuses...');
  try {
    const statusResponse = await fetch(`${BASE_URL}/video/safety/events/statuses`, { headers });
    
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log(`   ✅ Success! Retrieved ${Array.isArray(statusData) ? statusData.length : 'unknown'} event statuses`);
    } else {
      console.log(`   ❌ Failed: ${statusResponse.status} ${statusResponse.statusText}`);
      const errorData = await statusResponse.text();
      console.log(`   Error: ${errorData}`);
    }
  } catch (error) {
    console.log(`   ❌ Connection Error: ${error.message}`);
  }

  // Test 2: Vehicles
  console.log('\n🚛 Test 2: Fetching Vehicles...');
  try {
    const vehicleResponse = await fetch(`${BASE_URL}/vehicles/all?page=1&limit=10`, { headers });
    
    if (vehicleResponse.ok) {
      const vehicleData = await vehicleResponse.json();
      console.log(`   ✅ Success! Retrieved vehicle data`);
      if (Array.isArray(vehicleData)) {
        console.log(`   Found ${vehicleData.length} vehicles`);
      } else if (vehicleData.data) {
        console.log(`   Found ${vehicleData.data.length} vehicles`);
      }
    } else {
      console.log(`   ❌ Failed: ${vehicleResponse.status} ${vehicleResponse.statusText}`);
      const errorData = await vehicleResponse.text();
      console.log(`   Error: ${errorData}`);
    }
  } catch (error) {
    console.log(`   ❌ Connection Error: ${error.message}`);
  }

  // Test 3: Safety Events
  console.log('\n🚨 Test 3: Fetching Safety Events...');
  try {
    const eventsResponse = await fetch(`${BASE_URL}/video/safety/events?page=1&pageSize=10`, { headers });
    
    if (eventsResponse.ok) {
      const eventsData = await eventsResponse.json();
      console.log(`   ✅ Success! Retrieved safety events data`);
      if (Array.isArray(eventsData)) {
        console.log(`   Found ${eventsData.length} events`);
      } else if (eventsData.data) {
        console.log(`   Found ${eventsData.data.length} events`);
      }
    } else {
      console.log(`   ❌ Failed: ${eventsResponse.status} ${eventsResponse.statusText}`);
      const errorData = await eventsResponse.text();
      console.log(`   Error: ${errorData}`);
    }
  } catch (error) {
    console.log(`   ❌ Connection Error: ${error.message}`);
  }

  console.log('\n📝 Summary:');
  console.log('If all tests passed, your LYTX API is configured correctly!');
  console.log('If any tests failed:');
  console.log('  - Check if the API key is correct');
  console.log('  - Verify the base URL');
  console.log('  - Ensure your network allows access to LYTX servers');
  console.log('  - Contact LYTX support if authentication errors persist');
}

// Add fetch polyfill for Node.js if needed
if (typeof fetch === 'undefined') {
  console.log('Installing fetch for Node.js...');
  global.fetch = require('node-fetch');
}

testLytxConnection().catch(console.error);