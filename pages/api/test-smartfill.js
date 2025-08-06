// SmartFill API Test Endpoint
// This endpoint allows testing SmartFill API integration with real credentials

import { supabase } from '@/lib/supabase';

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

  const requestOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  };

  const response = await fetch(SMARTFILL_API_URL, requestOptions);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SmartFill API error: ${response.status} ${response.statusText} - ${errorText}`);
  }
  
  const data = await response.json();
  
  // Check for JSON-RPC error
  if (data.error) {
    throw new Error(`SmartFill JSON-RPC error: ${data.error.code} - ${data.error.message}`);
  }
  
  return data.result;
}

export default async function handler(req, res) {
  const startTime = Date.now();
  
  console.log('\n🧪 SMARTFILL API TEST');
  console.log('='.repeat(50));
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log(`🌐 Method: ${req.method}`);
  
  // Only accept GET requests for testing
  if (req.method !== 'GET') {
    console.log('❌ Invalid method:', req.method);
    return res.status(405).json({ 
      error: 'Method not allowed', 
      expected: 'GET',
      received: req.method 
    });
  }

  try {
    console.log('📊 Testing SmartFill API integration...');
    
    // Get query parameters for credentials (for testing)
    const { clientReference, clientSecret } = req.query;
    
    let testCredentials = [];
    
    if (clientReference && clientSecret) {
      // Use provided credentials
      testCredentials = [{ clientReference, clientSecret, name: 'Test Credentials' }];
      console.log('🔑 Using provided credentials');
    } else {
      // Get credentials from database
      console.log('🔍 Fetching SmartFill customers from database...');
      
      const { data: customers, error: customerError } = await supabase
        .from('smartfill_customers')
        .select('*')
        .eq('active', true);
        
      if (customerError) {
        throw new Error(`Database error: ${customerError.message}`);
      }
      
      if (!customers || customers.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No active SmartFill customers found in database',
          message: 'Please add SmartFill customer credentials or provide clientReference and clientSecret query parameters',
          duration: Date.now() - startTime
        });
      }
      
      testCredentials = customers.map(c => ({
        clientReference: c.api_reference,
        clientSecret: c.api_secret,
        name: c.name
      }));
      
      console.log(`📋 Found ${testCredentials.length} customers to test`);
    }

    const results = [];
    
    // Test each set of credentials
    for (const cred of testCredentials) {
      console.log(`\n🏢 Testing customer: ${cred.name}`);
      
      const customerStartTime = Date.now();
      
      try {
        // Make API call to Tank:Level method
        console.log('   📡 Making JSON-RPC call to Tank:Level...');
        
        const result = await makeSmartFillRequest(
          'Tank:Level',
          {},
          cred.clientReference,
          cred.clientSecret
        );
        
        const responseTime = Date.now() - customerStartTime;
        
        console.log(`   ✅ Success! Got ${result?.values?.length || 0} tank readings in ${responseTime}ms`);
        
        // Transform the response for better readability
        let tankReadings = [];
        if (result && result.columns && result.values) {
          tankReadings = result.values.map(row => {
            const reading = {};
            result.columns.forEach((column, index) => {
              reading[column] = row[index];
            });
            return reading;
          });
        }
        
        results.push({
          customer: cred.name,
          success: true,
          responseTime: responseTime,
          tankCount: tankReadings.length,
          tanks: tankReadings,
          apiResponse: result
        });
        
        // Log some tank details
        if (tankReadings.length > 0) {
          console.log('   📊 Tank Summary:');
          tankReadings.forEach((tank, i) => {
            console.log(`      ${i + 1}. Unit ${tank['Unit Number']}, Tank ${tank['Tank Number']}: ${tank['Volume Percent']}% (${tank['Volume']}L)`);
          });
        }
        
      } catch (error) {
        const responseTime = Date.now() - customerStartTime;
        console.error(`   ❌ Failed: ${error.message} (${responseTime}ms)`);
        
        results.push({
          customer: cred.name,
          success: false,
          responseTime: responseTime,
          error: error.message
        });
      }
    }
    
    const totalDuration = Date.now() - startTime;
    
    // Summary
    const successfulTests = results.filter(r => r.success).length;
    const totalTanks = results.reduce((sum, r) => sum + (r.tankCount || 0), 0);
    
    console.log('\n📈 TEST SUMMARY:');
    console.log('-'.repeat(30));
    console.log(`✅ Successful: ${successfulTests}/${results.length} customers`);
    console.log(`🛢️  Total Tanks: ${totalTanks}`);
    console.log(`⏱️  Total Duration: ${totalDuration}ms`);
    console.log('='.repeat(50));
    
    return res.status(200).json({
      success: successfulTests > 0,
      message: 'SmartFill API test completed',
      summary: {
        totalCustomers: results.length,
        successfulCustomers: successfulTests,
        totalTanks: totalTanks,
        totalDuration: totalDuration
      },
      results: results
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('\n💥 TEST FAILED');
    console.error('Error:', error.message);
    
    return res.status(500).json({
      success: false,
      error: 'SmartFill API test failed',
      message: error.message,
      duration: duration
    });
  }
}