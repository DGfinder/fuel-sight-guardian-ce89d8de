#!/usr/bin/env node

// SmartFill API Test Script
// This script tests the SmartFill JSON-RPC API integration directly

const SMARTFILL_API_URL = 'https://www.fmtdata.com/API/api.php';

// Helper function for making JSON-RPC 2.0 API requests
async function makeSmartFillRequest(method, parameters, clientReference, clientSecret) {
  const requestBody = {
    jsonrpc: '2.0',
    method: method,
    parameters: {
      clientReference: clientReference,
      clientSecret: clientSecret,
      ...parameters
    },
    id: '1'
  };

  console.log('📤 Request Body:', JSON.stringify(requestBody, null, 2));

  const requestOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  };

  const response = await fetch(SMARTFILL_API_URL, requestOptions);
  
  console.log('📡 Response Status:', response.status, response.statusText);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SmartFill API error: ${response.status} ${response.statusText} - ${errorText}`);
  }
  
  const data = await response.json();
  console.log('📥 Raw Response:', JSON.stringify(data, null, 2));
  
  // Check for JSON-RPC error
  if (data.error) {
    throw new Error(`SmartFill JSON-RPC error: ${data.error.code} - ${data.error.message}`);
  }
  
  return data.result;
}

// Main test function
async function testSmartFillAPI() {
  console.log('🧪 SmartFill API Test Script');
  console.log('='.repeat(50));

  // Get credentials from command line arguments or use test values
  const clientReference = process.argv[2] || 'TEST_CLIENT_REF';
  const clientSecret = process.argv[3] || 'TEST_CLIENT_SECRET';

  if (clientReference === 'TEST_CLIENT_REF' || clientSecret === 'TEST_CLIENT_SECRET') {
    console.log('⚠️  Using test credentials. Please provide real credentials:');
    console.log('   node test-smartfill-api.js <CLIENT_REFERENCE> <CLIENT_SECRET>');
    console.log('');
  }

  console.log('🔑 Using credentials:');
  console.log(`   Client Reference: ${clientReference.substring(0, 10)}...`);
  console.log(`   Client Secret: ${clientSecret.substring(0, 10)}...`);
  console.log('');

  const startTime = Date.now();

  try {
    console.log('📡 Making JSON-RPC call to Tank:Level method...');
    
    const result = await makeSmartFillRequest(
      'Tank:Level',
      {},
      clientReference,
      clientSecret
    );

    const responseTime = Date.now() - startTime;
    
    console.log('✅ API call successful!');
    console.log(`⏱️  Response time: ${responseTime}ms`);
    console.log('');

    if (!result || !result.columns || !Array.isArray(result.values)) {
      throw new Error('Invalid response structure: expected columns and values arrays');
    }

    console.log('📊 API Response Analysis:');
    console.log(`   Columns: ${result.columns.length}`);
    console.log(`   Data Rows: ${result.values.length}`);
    console.log('');

    if (result.columns.length > 0) {
      console.log('📋 Available Columns:');
      result.columns.forEach((column, index) => {
        console.log(`   ${index + 1}. ${column}`);
      });
      console.log('');
    }

    if (result.values.length > 0) {
      console.log('🛢️  Tank Data Sample:');
      
      // Transform first few rows for display
      const sampleRows = result.values.slice(0, 3).map(row => {
        const tankReading = {};
        result.columns.forEach((column, index) => {
          tankReading[column] = row[index];
        });
        return tankReading;
      });

      sampleRows.forEach((tank, index) => {
        console.log(`\n   Tank ${index + 1}:`);
        console.log(`     Unit: ${tank['Unit Number']}`);
        console.log(`     Tank: ${tank['Tank Number']}`);
        console.log(`     Description: ${tank['Description']}`);
        console.log(`     Volume: ${tank['Volume']}L (${tank['Volume Percent']}%)`);
        console.log(`     Capacity: ${tank['Capacity']}L`);
        console.log(`     Status: ${tank['Status']}`);
        console.log(`     Last Updated: ${tank['Last Updated']}`);
        console.log(`     Timezone: ${tank['Timezone']}`);
      });

      if (result.values.length > 3) {
        console.log(`\n   ... and ${result.values.length - 3} more tanks`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎉 SmartFill API test completed successfully!');
    console.log(`📈 Summary: ${result.values.length} tanks retrieved in ${responseTime}ms`);
    
    return {
      success: true,
      tankCount: result.values.length,
      responseTime: responseTime,
      data: result
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error('❌ SmartFill API test failed!');
    console.error(`💥 Error: ${error.message}`);
    console.error(`⏱️  Failed after: ${responseTime}ms`);
    
    if (error.message.includes('JSON-RPC error')) {
      console.error('');
      console.error('🔍 Possible causes:');
      console.error('   • Invalid client reference or secret');
      console.error('   • API method not available');
      console.error('   • Server-side error');
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      console.error('');
      console.error('🔍 Possible causes:');
      console.error('   • Network connectivity issues');
      console.error('   • SmartFill API server unavailable');
      console.error('   • Firewall blocking requests');
    }
    
    console.error('\n' + '='.repeat(50));
    
    return {
      success: false,
      error: error.message,
      responseTime: responseTime
    };
  }
}

// Run the test
testSmartFillAPI()
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });