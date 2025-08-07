// API Connection Test Script
// This script tests all your API integrations to identify issues

require('dotenv').config();

console.log('🔍 Testing API Connections...\n');

// Test 1: Environment Variables
console.log('1️⃣  Environment Variables Check:');
console.log('   SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ SET' : '❌ NOT SET');
console.log('   SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ SET' : '❌ NOT SET');
console.log('   LYTX_API_KEY:', process.env.LYTX_API_KEY ? '✅ SET' : '❌ NOT SET');
console.log('   VITE_ATHARA_API_KEY:', process.env.VITE_ATHARA_API_KEY ? '✅ SET' : '❌ NOT SET');
console.log('   GASBOT_WEBHOOK_SECRET:', process.env.GASBOT_WEBHOOK_SECRET ? '✅ SET' : '❌ NOT SET');
console.log('');

// Test 2: Supabase Connection
async function testSupabase() {
  console.log('2️⃣  Supabase Connection Test:');
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.log('   ❌ Missing Supabase credentials');
    return false;
  }

  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    
    const { data, error } = await supabase.from('tank_groups').select('count').limit(1);
    
    if (error) {
      console.log('   ❌ Supabase connection failed:', error.message);
      return false;
    }
    
    console.log('   ✅ Supabase connection successful');
    return true;
  } catch (error) {
    console.log('   ❌ Supabase connection error:', error.message);
    return false;
  }
}

// Test 3: LYTX API Connection
async function testLYTX() {
  console.log('3️⃣  LYTX API Connection Test:');
  
  if (!process.env.LYTX_API_KEY) {
    console.log('   ❌ Missing LYTX API key');
    return false;
  }

  try {
    const response = await fetch('https://lytx-api.prod7.lv.lytx.com/api/v1/events', {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-apikey': process.env.LYTX_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log('   ❌ LYTX API error:', response.status, response.statusText);
      return false;
    }

    const data = await response.json();
    console.log('   ✅ LYTX API connection successful');
    return true;
  } catch (error) {
    console.log('   ❌ LYTX API connection error:', error.message);
    return false;
  }
}

// Test 4: Gasbot API Connection
async function testGasbot() {
  console.log('4️⃣  Gasbot API Connection Test:');
  
  if (!process.env.VITE_ATHARA_API_KEY || !process.env.VITE_ATHARA_API_SECRET) {
    console.log('   ❌ Missing Gasbot API credentials');
    return false;
  }

  try {
    const response = await fetch('https://dashboard2-production.prod.gasbot.io/api/v1/locations', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.VITE_ATHARA_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log('   ❌ Gasbot API error:', response.status, response.statusText);
      return false;
    }

    const data = await response.json();
    console.log('   ✅ Gasbot API connection successful');
    return true;
  } catch (error) {
    console.log('   ❌ Gasbot API connection error:', error.message);
    return false;
  }
}

// Test 5: SmartFill API Connection
async function testSmartFill() {
  console.log('5️⃣  SmartFill API Connection Test:');
  
  if (!process.env.SMARTFILL_API_REFERENCE || !process.env.SMARTFILL_API_SECRET) {
    console.log('   ⚠️  SmartFill credentials not configured (optional)');
    return true; // Not critical
  }

  try {
    const payload = {
      jsonrpc: '2.0',
      method: 'Tank:Level',
      params: {
        clientReference: process.env.SMARTFILL_API_REFERENCE,
        clientSecret: process.env.SMARTFILL_API_SECRET
      },
      id: Math.random().toString(36).substr(2, 9)
    };

    const response = await fetch('https://www.fmtdata.com/API/api.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.log('   ❌ SmartFill API error:', response.status, response.statusText);
      return false;
    }

    const data = await response.json();
    console.log('   ✅ SmartFill API connection successful');
    return true;
  } catch (error) {
    console.log('   ❌ SmartFill API connection error:', error.message);
    return false;
  }
}

// Test 6: Local API Endpoints
async function testLocalAPIs() {
  console.log('6️⃣  Local API Endpoints Test:');
  
  const baseUrl = 'http://localhost:3000';
  const endpoints = [
    '/api/lytx-proxy',
    '/api/gasbot-webhook',
    '/api/smartfill-sync'
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ test: true })
      });

      if (response.ok) {
        console.log(`   ✅ ${endpoint} - Available`);
      } else {
        console.log(`   ❌ ${endpoint} - Error: ${response.status}`);
      }
    } catch (error) {
      console.log(`   ❌ ${endpoint} - Connection failed: ${error.message}`);
    }
  }
}

// Run all tests
async function runAllTests() {
  const results = {
    supabase: await testSupabase(),
    lytx: await testLYTX(),
    gasbot: await testGasbot(),
    smartfill: await testSmartFill()
  };

  console.log('\n📊 Test Results Summary:');
  console.log('   Supabase:', results.supabase ? '✅' : '❌');
  console.log('   LYTX API:', results.lytx ? '✅' : '❌');
  console.log('   Gasbot API:', results.gasbot ? '✅' : '❌');
  console.log('   SmartFill API:', results.smartfill ? '✅' : '⚠️');

  const workingAPIs = Object.values(results).filter(Boolean).length;
  const totalAPIs = Object.keys(results).length;

  console.log(`\n🎯 Overall Status: ${workingAPIs}/${totalAPIs} APIs working`);

  if (workingAPIs === 0) {
    console.log('\n🚨 CRITICAL: No APIs are working!');
    console.log('   - Check your .env file configuration');
    console.log('   - Verify API keys are correct');
    console.log('   - Ensure network connectivity');
  } else if (workingAPIs < totalAPIs) {
    console.log('\n⚠️  WARNING: Some APIs are not working');
    console.log('   - Review the failed tests above');
    console.log('   - Check API credentials and permissions');
  } else {
    console.log('\n🎉 SUCCESS: All APIs are working!');
  }
}

// Run tests
runAllTests().catch(console.error); 