// SmartFill Customer API Testing Endpoint
// Tests connectivity for all SmartFill customers in the database
// URL: https://fuel-sight-guardian-ce89d8de.vercel.app/api/smartfill-test-customers

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// SmartFill API Configuration
const SMARTFILL_API_URL = 'https://www.fmtdata.com/API/api.php';
const REQUEST_TIMEOUT = 15000; // 15 seconds

// Helper function to make SmartFill JSON-RPC request
async function makeSmartFillRequest(apiReference, apiSecret, method = 'getUnits', params = {}) {
  const requestId = Math.random().toString(36).substr(2, 9);
  
  const payload = {
    jsonrpc: '2.0',
    method: method,
    params: {
      apiReference: apiReference,
      apiSecret: apiSecret,
      ...params
    },
    id: requestId
  };

  console.log(`[SMARTFILL TEST] Testing ${apiReference} with method ${method}`);

  try {
    const response = await fetch(SMARTFILL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`SmartFill API error: ${data.error.message} (Code: ${data.error.code})`);
    }

    return {
      success: true,
      data: data.result,
      responseTime: Date.now() - Date.now() // Approximate
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      responseTime: null
    };
  }
}

export default async function handler(req, res) {
  const startTime = Date.now();
  
  console.log('\n🧪 SMARTFILL CUSTOMER API TEST STARTED');
  console.log('='.repeat(60));
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  
  // Environment check
  if (!supabaseUrl || !supabaseKey) {
    console.error('💥 Missing Supabase configuration');
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'Missing database configuration'
    });
  }

  // Only accept GET requests for testing
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      expected: 'GET',
      received: req.method
    });
  }

  try {
    // Get all active SmartFill customers from database
    console.log('📊 Fetching active SmartFill customers...');
    
    const { data: customers, error: customerError } = await supabase
      .from('smartfill_customers')
      .select('id, api_reference, api_secret, name')
      .eq('active', true)
      .order('name');

    if (customerError) {
      throw new Error(`Database error: ${customerError.message}`);
    }

    if (!customers || customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active SmartFill customers found in database',
        customerCount: 0,
        testResults: []
      });
    }

    console.log(`✅ Found ${customers.length} active customers`);
    
    // Test API connectivity for each customer
    const testResults = [];
    let successCount = 0;
    let failureCount = 0;

    console.log('\n🔍 Testing API connectivity for each customer...\n');

    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];
      const testStart = Date.now();
      
      try {
        console.log(`${i + 1}. Testing ${customer.name} (${customer.api_reference})`);
        
        // Test with getUnits method (basic connectivity test)
        const result = await makeSmartFillRequest(
          customer.api_reference, 
          customer.api_secret, 
          'getUnits'
        );
        
        const testDuration = Date.now() - testStart;
        
        if (result.success) {
          console.log(`   ✅ Success - ${result.data?.length || 0} units found (${testDuration}ms)`);
          successCount++;
          
          testResults.push({
            customerId: customer.id,
            customerName: customer.name,
            apiReference: customer.api_reference,
            status: 'success',
            unitsCount: result.data?.length || 0,
            responseTime: testDuration,
            error: null
          });
        } else {
          console.log(`   ❌ Failed - ${result.error} (${testDuration}ms)`);
          failureCount++;
          
          testResults.push({
            customerId: customer.id,
            customerName: customer.name,
            apiReference: customer.api_reference,
            status: 'failed',
            unitsCount: 0,
            responseTime: testDuration,
            error: result.error
          });
        }
      } catch (error) {
        const testDuration = Date.now() - testStart;
        console.log(`   ❌ Exception - ${error.message} (${testDuration}ms)`);
        failureCount++;
        
        testResults.push({
          customerId: customer.id,
          customerName: customer.name,
          apiReference: customer.api_reference,
          status: 'error',
          unitsCount: 0,
          responseTime: testDuration,
          error: error.message
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    
    // Summary
    console.log('\n📈 TEST SUMMARY');
    console.log('='.repeat(40));
    console.log(`✅ Successful: ${successCount}/${customers.length}`);
    console.log(`❌ Failed: ${failureCount}/${customers.length}`);
    console.log(`⏱️  Total Time: ${totalDuration}ms`);
    console.log(`📊 Success Rate: ${((successCount / customers.length) * 100).toFixed(1)}%`);

    // Log to database
    try {
      await supabase
        .from('smartfill_sync_logs')
        .insert({
          sync_type: 'api_connectivity_test',
          sync_status: successCount === customers.length ? 'success' : 'partial',
          started_at: new Date(startTime).toISOString(),
          completed_at: new Date().toISOString(),
          locations_processed: successCount,
          assets_processed: customers.length,
          sync_duration_ms: totalDuration,
          error_message: failureCount > 0 ? `${failureCount} customers failed connectivity test` : null
        });
    } catch (logError) {
      console.warn('Failed to log test results:', logError);
    }

    return res.status(200).json({
      success: successCount === customers.length,
      message: `API connectivity test completed for ${customers.length} customers`,
      summary: {
        totalCustomers: customers.length,
        successful: successCount,
        failed: failureCount,
        successRate: `${((successCount / customers.length) * 100).toFixed(1)}%`,
        totalDuration: totalDuration
      },
      testResults: testResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    
    console.error('\n💥 TEST FAILED');
    console.error('Error:', error.message);
    
    return res.status(500).json({
      success: false,
      error: 'API test failed',
      message: error.message,
      duration: totalDuration,
      timestamp: new Date().toISOString()
    });
  }
}