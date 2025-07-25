#!/usr/bin/env node

// Test script for the Gasbot webhook endpoint
// This simulates what Gasbot will send to our webhook

const WEBHOOK_URL = 'https://fuel-sight-guardian-ce89d8de.vercel.app/api/gasbot-webhook';
const LOCAL_URL = 'http://localhost:3000/api/gasbot-webhook';
const WEBHOOK_SECRET = 'FSG-gasbot-webhook-2025';

// Sample data that matches the format Gasbot will send
const sampleGasbotData = [
  {
    "LocationId": "Bruce Rock Diesel Test",
    "LocationAddress": "123 Main Street, Bruce Rock WA",
    "AssetCalibratedFillLevel": 65.5,
    "AssetSerialNumber": "TEST-0000100402",
    "AssetLastCalibratedTelemetryTimestamp": "2025-07-25T09:50:23Z",
    "DeviceOnline": true,
    "TenancyName": "Great Southern Fuel Supplies",
    "DeviceSerialNumber": "TEST-0000100402"
  },
  {
    "LocationId": "Mick Test Tank",
    "LocationAddress": "456 Farm Road, Test Location WA",
    "AssetCalibratedFillLevel": 32.1,
    "AssetSerialNumber": "TEST-0000100628",
    "AssetLastCalibratedTelemetryTimestamp": "2025-07-25T11:24:45Z",
    "DeviceOnline": true,
    "TenancyName": "Great Southern Fuel Supplies",
    "DeviceSerialNumber": "TEST-0000100628"
  }
];

async function testWebhook(url, testName) {
  console.log(`\n🧪 Testing ${testName}`);
  console.log(`📍 URL: ${url}`);
  console.log(`📊 Sending ${sampleGasbotData.length} test records...`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WEBHOOK_SECRET}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Gasbot-Webhook-Test/1.0'
      },
      body: JSON.stringify(sampleGasbotData)
    });
    
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    const responseData = await response.json();
    console.log(`📋 Response:`, responseData);
    
    if (response.ok) {
      console.log(`✅ ${testName} SUCCESS!`);
      if (responseData.stats) {
        console.log(`   📈 Processed: ${responseData.stats.processedRecords}/${responseData.stats.totalRecords}`);
        console.log(`   ⏱️  Duration: ${responseData.stats.duration}ms`);
      }
    } else {
      console.log(`❌ ${testName} FAILED: ${responseData.error || responseData.message}`);
    }
    
  } catch (error) {
    console.log(`💥 ${testName} ERROR: ${error.message}`);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log(`   💡 Tip: Make sure your local server is running (npm run dev)`);
    } else if (error.message.includes('fetch')) {
      console.log(`   💡 Tip: Check if the URL is accessible`);
    }
  }
}

async function testAuthentication(url) {
  console.log(`\n🔐 Testing Authentication for ${url}`);
  
  // Test 1: No auth header
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleGasbotData)
    });
    
    console.log(`   📊 No auth: ${response.status} ${response.statusText}`);
    if (response.status === 401) {
      console.log(`   ✅ Correctly rejected request without auth`);
    }
  } catch (error) {
    console.log(`   💥 No auth test error: ${error.message}`);
  }
  
  // Test 2: Wrong auth token
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer wrong-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sampleGasbotData)
    });
    
    console.log(`   📊 Wrong auth: ${response.status} ${response.statusText}`);
    if (response.status === 401) {
      console.log(`   ✅ Correctly rejected request with wrong token`);
    }
  } catch (error) {
    console.log(`   💥 Wrong auth test error: ${error.message}`);
  }
}

async function runAllTests() {
  console.log('🚀 GASBOT WEBHOOK TEST SUITE');
  console.log('='.repeat(50));
  console.log(`⏰ Started: ${new Date().toISOString()}`);
  
  // Test both local and production endpoints
  await testWebhook(LOCAL_URL, 'Local Development');
  await testAuthentication(LOCAL_URL);
  
  await testWebhook(WEBHOOK_URL, 'Production Vercel');
  await testAuthentication(WEBHOOK_URL);
  
  console.log('\n📋 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log('✅ If both tests succeed, your webhook is ready for Gasbot!');
  console.log('📝 When Gasbot fixes their config, they can send data to:');
  console.log(`   ${WEBHOOK_URL}`);
  console.log('🔑 With Authorization header:');
  console.log(`   Bearer ${WEBHOOK_SECRET}`);
  console.log('\n🎯 Next Steps:');
  console.log('1. Deploy this webhook to Vercel');
  console.log('2. Wait for Gasbot support to fix IncrementalTimestampColumn issue');
  console.log('3. Configure Gasbot webhook with your URL and auth token');
  console.log('4. Receive hourly tank data automatically!');
}

// Run the tests
runAllTests().catch(console.error);