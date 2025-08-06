#!/usr/bin/env node

// Test script to verify the Athara/Gasbot API fixes
// This will test the SSL certificate and authentication fixes

const API_KEY = '3FCZF4JI9JM5TKPIJZIFZE1UOAOMKLUAL5BG';
const API_SECRET = '7RPYMX82GD3X9RERLF982KH0GDN9H1GBFAZ9R84JWR';
const BASE_URL = 'https://dashboard2-production.prod.gasbot.io';

async function testAPI() {
  console.log('🔧 Testing Athara/Gasbot API Connection...');
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`🔑 API Key: ${API_KEY.substring(0, 10)}...`);
  console.log(`🔐 API Secret: ${API_SECRET.substring(0, 10)}...`);
  
  // Test different potential endpoints
  const endpoints = [
    '/api/locations',
    '/api/v1/locations', 
    '/locations',
    '/dashboard/api/locations',
    '/api/assets',
    '/api/tanks'
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n🧪 Testing endpoint: ${endpoint}`);
      
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: {
          'X-API-Key': API_KEY,
          'X-API-Secret': API_SECRET,
          'Content-Type': 'application/json',
          'User-Agent': 'FuelSightGuardian/1.0'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      console.log(`   📊 Status: ${response.status} ${response.statusText}`);
      console.log(`   🌐 SSL Certificate: ✅ Valid (no more ERR_CERT_COMMON_NAME_INVALID)`);
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        console.log(`   📝 Content-Type: ${contentType}`);
        
        if (contentType?.includes('application/json')) {
          try {
            const data = await response.json();
            console.log(`   ✅ SUCCESS: Got valid JSON response`);
            console.log(`   📋 Data structure:`, Object.keys(data).slice(0, 5));
            
            if (Array.isArray(data)) {
              console.log(`   📊 Array length: ${data.length} items`);
              if (data.length > 0) {
                console.log(`   🔍 First item keys:`, Object.keys(data[0]).slice(0, 10));
              }
            }
            
            console.log(`\n🎉 ENDPOINT WORKING: ${endpoint}`);
            break; // Found working endpoint
          } catch (jsonError) {
            console.log(`   ⚠️  Invalid JSON response`);
          }
        } else {
          const text = await response.text();
          console.log(`   📄 Response: ${text.substring(0, 200)}...`);
        }
      } else {
        console.log(`   ❌ HTTP Error: ${response.status}`);
        
        // Try to get error details
        try {
          const errorText = await response.text();
          console.log(`   💬 Error message: ${errorText.substring(0, 200)}`);
        } catch (e) {
          console.log(`   💬 Could not read error message`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Request failed: ${error.message}`);
      
      if (error.message.includes('ERR_CERT_COMMON_NAME_INVALID')) {
        console.log(`   🚨 SSL Certificate Error still present!`);
      } else if (error.message.includes('timeout')) {
        console.log(`   ⏰ Request timed out`);
      } else if (error.message.includes('ENOTFOUND')) {
        console.log(`   🌐 DNS resolution failed - domain may not exist`);
      }
    }
  }
  
  console.log('\n📋 Test Summary:');
  console.log('- SSL Certificate issues should be resolved with correct domain');
  console.log('- Authentication updated to use both API key and secret');
  console.log('- If all endpoints fail, the API structure may be different');
  console.log('- Check the Gasbot dashboard network tab for actual API calls');
}

// Run the test
testAPI().catch(console.error);