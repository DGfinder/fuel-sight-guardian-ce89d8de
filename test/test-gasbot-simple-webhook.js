#!/usr/bin/env node

// 🧪 GASBOT SIMPLE WEBHOOK TESTER
// Tests the simplified webhook with various data formats

const BASE_URL_LOCAL = 'http://localhost:3000/api/gasbot-webhook-simple';
const BASE_URL_PROD = 'https://fuel-sight-guardian-ce89d8de.vercel.app/api/gasbot-webhook-simple';
const API_KEY = 'gasbot-2025';

// Test data in various formats
const testCases = [
  {
    name: '🧪 Single Tank (POST JSON)',
    method: 'POST',
    data: {
      LocationId: 'Test Tank Alpha',
      AssetCalibratedFillLevel: 67.5,
      DeviceOnline: true,
      AssetSerialNumber: 'TEST-001',
      TenancyName: 'Simple Test Customer',
      AssetReportedLitres: 2700,
      DeviceBatteryVoltage: 3.8
    }
  },
  {
    name: '🧪 Multiple Tanks (POST JSON Array)',
    method: 'POST', 
    data: [
      {
        LocationId: 'Test Tank Beta',
        AssetCalibratedFillLevel: 45.2,
        DeviceOnline: true,
        AssetSerialNumber: 'TEST-002'
      },
      {
        LocationId: 'Test Tank Gamma',
        AssetCalibratedFillLevel: 12.8,
        DeviceOnline: false,
        AssetSerialNumber: 'TEST-003'
      }
    ]
  },
  {
    name: '🧪 Minimal Data (POST)',
    method: 'POST',
    data: {
      location: 'Minimal Tank',
      fuel_level: 33.3,
      serial: 'MIN-001'
    }
  },
  {
    name: '🧪 GET Request (URL params)',
    method: 'GET',
    url: `?key=${API_KEY}&location=URL Test Tank&fuel_level=88.8&online=true&serial=URL-001&customer=URL Customer`
  }
];

async function testWebhook(baseUrl, testCase) {
  try {
    console.log(`\n${testCase.name}`);
    console.log('─'.repeat(50));

    let url = baseUrl;
    let options = {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    };

    if (testCase.method === 'GET') {
      url += testCase.url;
      options.method = 'GET';
    } else {
      options.method = 'POST';
      options.body = JSON.stringify(testCase.data);
    }

    console.log(`📡 ${testCase.method} ${url}`);
    if (testCase.data) {
      console.log(`📊 Data:`, JSON.stringify(testCase.data, null, 2));
    }

    const response = await fetch(url, options);
    const result = await response.json();

    console.log(`📈 Status: ${response.status} ${response.statusText}`);
    console.log(`📋 Response:`, JSON.stringify(result, null, 2));

    if (response.ok) {
      console.log('✅ SUCCESS');
    } else {
      console.log('❌ FAILED');
    }

  } catch (error) {
    console.log('💥 ERROR:', error.message);
  }
}

async function runAllTests() {
  console.log('🚀 GASBOT SIMPLIFIED WEBHOOK TESTS');
  console.log('='.repeat(60));
  console.log(`⏰ Started: ${new Date().toISOString()}`);

  // Test local development server
  console.log('\n🏠 TESTING LOCAL DEVELOPMENT SERVER');
  console.log('='.repeat(40));
  for (const testCase of testCases) {
    await testWebhook(BASE_URL_LOCAL, testCase);
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
  }

  // Test production
  console.log('\n\n☁️  TESTING PRODUCTION SERVER');
  console.log('='.repeat(40));
  for (const testCase of testCases) {
    await testWebhook(BASE_URL_PROD, testCase);
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
  }

  // Authentication test
  console.log('\n\n🔒 TESTING AUTHENTICATION');
  console.log('='.repeat(40));
  try {
    console.log('Testing invalid API key...');
    const response = await fetch(BASE_URL_PROD, {
      method: 'POST',
      headers: {
        'X-API-Key': 'invalid-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ LocationId: 'Auth Test', AssetCalibratedFillLevel: 50 })
    });
    
    const result = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, result);
    
    if (response.status === 401) {
      console.log('✅ Authentication working correctly');
    } else {
      console.log('❌ Authentication failed - should have returned 401');
    }
  } catch (error) {
    console.log('💥 Auth test error:', error.message);
  }

  console.log('\n🎉 ALL TESTS COMPLETED');
  console.log(`⏰ Finished: ${new Date().toISOString()}`);
  console.log('\n📝 WEBHOOK CONFIGURATION FOR GASBOT:');
  console.log(`URL: ${BASE_URL_PROD}`);
  console.log(`API Key: ${API_KEY} (in X-API-Key header)`);
  console.log(`Method: POST`);
  console.log(`Content-Type: application/json`);
}

// Run tests if called directly
import { fileURLToPath } from 'url';
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url === `file://${fileURLToPath(import.meta.url)}`) {
  runAllTests().catch(console.error);
}

export { testWebhook, runAllTests };