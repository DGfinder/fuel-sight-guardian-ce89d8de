// SmartFill API Sync Endpoint
// Triggers full sync for all SmartFill customers to build proper data from API
// URL: https://fuel-sight-guardian-ce89d8de.vercel.app/api/smartfill-sync

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// SmartFill API Configuration
const SMARTFILL_API_URL = 'https://www.fmtdata.com/API/api.php';
const REQUEST_TIMEOUT = 30000; // 30 seconds for sync operations
const MAX_RETRIES = 3;

// Helper function to make SmartFill JSON-RPC request with retry logic
async function makeSmartFillRequest(apiReference, apiSecret, method = 'Tank:Level', params = {}, retryCount = 0) {
  const requestId = Math.random().toString(36).substr(2, 9);
  
  const payload = {
    jsonrpc: '2.0',
    method: method,
    parameters: {
      clientReference: apiReference,
      clientSecret: apiSecret,
      ...params
    },
    id: requestId
  };

  console.log(`[SMARTFILL SYNC] ${apiReference}: Calling ${method} (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);

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
      apiReference
    };
  } catch (error) {
    console.error(`[SMARTFILL SYNC] ${apiReference}: Error on attempt ${retryCount + 1}:`, error.message);
    
    if (retryCount < MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
      console.log(`[SMARTFILL SYNC] ${apiReference}: Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return makeSmartFillRequest(apiReference, apiSecret, method, params, retryCount + 1);
    }
    
    return {
      success: false,
      error: error.message,
      apiReference
    };
  }
}

// Transform SmartFill API data to database format
function transformSmartFillData(apiResult, customerId, customerName) {
  const locations = [];
  const tanks = [];
  const readings = [];

  if (!apiResult || !apiResult.columns || !Array.isArray(apiResult.values)) {
    console.warn(`[SMARTFILL SYNC] No valid data for customer ${customerName}`);
    return { locations, tanks, readings };
  }

  const { columns, values } = apiResult;
  
  // Create column index mapping for easier data access
  const columnIndex = {};
  columns.forEach((col, index) => {
    columnIndex[col] = index;
  });

  // Group tank data by unit number to create locations
  const unitGroups = new Map();
  
  values.forEach(row => {
    const unitNumber = row[columnIndex['Unit Number']];
    if (!unitNumber) return;
    
    if (!unitGroups.has(unitNumber)) {
      unitGroups.set(unitNumber, []);
    }
    
    // Transform row data to object
    const tankData = {};
    columns.forEach((col, index) => {
      tankData[col] = row[index];
    });
    
    unitGroups.get(unitNumber).push(tankData);
  });

  // Process each unit as a location with multiple tanks
  unitGroups.forEach((unitTanks, unitNumber) => {
    try {
      // Create location record using the first tank's data for location details
      const firstTank = unitTanks[0];
      const locationId = crypto.randomUUID();
      
      // Find the latest update time among all tanks in this unit
      const latestUpdate = unitTanks.reduce((latest, tank) => {
        const tankUpdate = tank['Last Updated'] || '1970-01-01 00:00:00';
        return tankUpdate > latest ? tankUpdate : latest;
      }, '1970-01-01 00:00:00');
      
      // Calculate unit-level averages
      const validPercentages = unitTanks
        .map(tank => parseFloat(tank['Volume Percent']))
        .filter(pct => !isNaN(pct) && pct > 0);
      const avgPercentage = validPercentages.length > 0 ? 
        validPercentages.reduce((sum, pct) => sum + pct, 0) / validPercentages.length : null;
      
      const totalVolume = unitTanks
        .map(tank => parseFloat(tank['Volume']))
        .filter(vol => !isNaN(vol) && vol > 0)
        .reduce((sum, vol) => sum + vol, 0);

      const location = {
        id: locationId,
        location_guid: `smartfill-unit-${customerId}-${unitNumber}`,
        customer_name: customerName,
        customer_guid: `smartfill-customer-${customerId}`,
        customer_id: customerId,
        unit_number: unitNumber,
        description: firstTank.Description || `Unit ${unitNumber}`,
        timezone: firstTank.Timezone || 'Australia/Perth',
        latest_volume: totalVolume || null,
        latest_volume_percent: avgPercentage,
        latest_status: firstTank.Status || 'Unknown',
        latest_update_time: latestUpdate !== '1970-01-01 00:00:00' ? latestUpdate : new Date().toISOString(),
        created_at: new Date(),
        updated_at: new Date()
      };
      locations.push(location);

      // Create tank records for each tank in this unit
      unitTanks.forEach((tankData) => {
        const tankId = crypto.randomUUID();
        const tankNumber = tankData['Tank Number'] || '1';
        
        const tankRecord = {
          id: tankId,
          location_id: locationId,
          tank_guid: `smartfill-tank-${customerId}-${unitNumber}-${tankNumber}`,
          customer_id: customerId,
          unit_number: unitNumber,
          tank_number: tankNumber.toString(),
          description: tankData.Description || `Tank ${tankNumber}`,
          capacity: parseFloat(tankData.Capacity) || null,
          safe_fill_level: parseFloat(tankData['Tank SFL']) || null,
          latest_volume: parseFloat(tankData.Volume) || null,
          latest_volume_percent: parseFloat(tankData['Volume Percent']) || null,
          latest_status: tankData.Status || 'Unknown',
          latest_update_time: tankData['Last Updated'] || new Date().toISOString(),
          created_at: new Date(),
          updated_at: new Date()
        };
        tanks.push(tankRecord);

        // Create reading record if we have valid data
        const volume = parseFloat(tankData.Volume);
        const volumePercent = parseFloat(tankData['Volume Percent']);
        const capacity = parseFloat(tankData.Capacity);
        const safeLevel = parseFloat(tankData['Tank SFL']);
        
        if (!isNaN(volume) || !isNaN(volumePercent)) {
          const reading = {
            id: crypto.randomUUID(),
            tank_id: tankId,
            volume: !isNaN(volume) ? volume : null,
            volume_percent: !isNaN(volumePercent) ? volumePercent : null,
            status: tankData.Status || 'Unknown',
            update_time: tankData['Last Updated'] || new Date().toISOString(),
            timezone: tankData.Timezone || 'Australia/Perth',
            capacity: !isNaN(capacity) ? capacity : null,
            safe_fill_level: !isNaN(safeLevel) ? safeLevel : null,
            ullage: (!isNaN(capacity) && !isNaN(volume)) ? Math.max(0, capacity - volume) : null,
            created_at: new Date()
          };
          readings.push(reading);
        }
      });
      
    } catch (error) {
      console.error(`[SMARTFILL SYNC] Error transforming unit ${unitNumber}:`, error, unitTanks);
    }
  });

  console.log(`[SMARTFILL SYNC] ${customerName}: Transformed ${unitGroups.size} units into ${locations.length} locations, ${tanks.length} tanks, ${readings.length} readings`);
  
  return { locations, tanks, readings };
}

export default async function handler(req, res) {
  const startTime = Date.now();
  
  console.log('\n🔄 SMARTFILL FULL SYNC STARTED');
  console.log('='.repeat(50));
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  
  // Environment check
  if (!supabaseUrl || !supabaseKey) {
    console.error('💥 Missing Supabase configuration');
    return res.status(500).json({
      success: false,
      error: 'Server configuration error',
      message: 'Missing database configuration'
    });
  }

  // Support both GET (test) and POST (sync)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      expected: 'GET or POST',
      received: req.method
    });
  }

  const isTestRun = req.method === 'GET';
  
  if (isTestRun) {
    console.log('🧪 Running in TEST mode (no database changes)');
  }

  try {
    // Start sync log
    const syncLogId = crypto.randomUUID();
    const syncLog = {
      id: syncLogId,
      sync_type: isTestRun ? 'api_test' : 'manual',
      sync_status: 'running',
      started_at: new Date().toISOString(),
      locations_processed: 0,
      tanks_processed: 0,
      assets_processed: 0,
      readings_processed: 0
    };

    if (!isTestRun) {
      await supabase.from('smartfill_sync_logs').insert(syncLog);
    }

    // Get all active SmartFill customers
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
      const result = {
        success: false,
        message: 'No active SmartFill customers found in database',
        customerCount: 0,
        syncResults: []
      };

      if (!isTestRun) {
        await supabase.from('smartfill_sync_logs')
          .update({
            sync_status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: 'No active customers found'
          })
          .eq('id', syncLogId);
      }

      return res.status(404).json(result);
    }

    console.log(`✅ Found ${customers.length} active customers`);
    
    // Sync all customers
    const syncResults = [];
    let totalLocations = 0;
    let totalTanks = 0;
    let totalReadings = 0;
    let successCount = 0;
    let failureCount = 0;

    console.log('\n🔄 Starting customer sync...\n');

    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];
      const customerStart = Date.now();
      
      try {
        console.log(`${i + 1}/${customers.length}. Syncing ${customer.name} (${customer.api_reference})`);
        
        // Fetch tank data from SmartFill API
        const apiResult = await makeSmartFillRequest(
          customer.api_reference,
          customer.api_secret,
          'Tank:Level'
        );
        
        if (!apiResult.success) {
          failureCount++;
          syncResults.push({
            customerId: customer.id,
            customerName: customer.name,
            apiReference: customer.api_reference,
            status: 'failed',
            error: apiResult.error,
            locationsProcessed: 0,
            tanksProcessed: 0,
            readingsProcessed: 0,
            duration: Date.now() - customerStart
          });
          continue;
        }

        // Transform API data to database format
        const { locations, tanks, readings } = transformSmartFillData(
          apiResult.data,
          customer.id,
          customer.name
        );

        console.log(`   📍 Locations: ${locations.length}, 🛢️ Tanks: ${tanks.length}, 📊 Readings: ${readings.length}`);

        if (!isTestRun && (locations.length > 0 || tanks.length > 0 || readings.length > 0)) {
          // Clear existing data for this customer
          await supabase.from('smartfill_readings_history').delete().eq('tank_id', tanks.map(t => t.id));
          await supabase.from('smartfill_tanks').delete().eq('customer_id', customer.id);
          await supabase.from('smartfill_locations').delete().eq('customer_id', customer.id);

          // Insert new data
          if (locations.length > 0) {
            const { error: locError } = await supabase
              .from('smartfill_locations')
              .insert(locations);
            if (locError) throw new Error(`Location insert error: ${locError.message}`);
          }

          if (tanks.length > 0) {
            const { error: tankError } = await supabase
              .from('smartfill_tanks')
              .insert(tanks);
            if (tankError) throw new Error(`Tank insert error: ${tankError.message}`);
          }

          if (readings.length > 0) {
            const { error: readError } = await supabase
              .from('smartfill_readings_history')
              .insert(readings);
            if (readError) throw new Error(`Reading insert error: ${readError.message}`);
          }
        }

        successCount++;
        totalLocations += locations.length;
        totalTanks += tanks.length;
        totalReadings += readings.length;

        syncResults.push({
          customerId: customer.id,
          customerName: customer.name,
          apiReference: customer.api_reference,
          status: 'success',
          locationsProcessed: locations.length,
          tanksProcessed: tanks.length,
          readingsProcessed: readings.length,
          duration: Date.now() - customerStart
        });

        console.log(`   ✅ Success (${Date.now() - customerStart}ms)`);

      } catch (error) {
        failureCount++;
        console.error(`   ❌ Failed: ${error.message}`);
        
        syncResults.push({
          customerId: customer.id,
          customerName: customer.name,
          apiReference: customer.api_reference,
          status: 'error',
          error: error.message,
          locationsProcessed: 0,
          tanksProcessed: 0,
          readingsProcessed: 0,
          duration: Date.now() - customerStart
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    const syncStatus = failureCount === 0 ? 'success' : 
                      successCount > 0 ? 'partial' : 'failed';

    // Update sync log
    if (!isTestRun) {
      await supabase.from('smartfill_sync_logs')
        .update({
          sync_status: syncStatus,
          completed_at: new Date().toISOString(),
          locations_processed: totalLocations,
          tanks_processed: totalTanks,
          assets_processed: successCount,
          readings_processed: totalReadings,
          sync_duration_ms: totalDuration,
          error_message: failureCount > 0 ? 
            `${failureCount} customers failed sync` : null
        })
        .eq('id', syncLogId);
    }

    // Summary
    console.log('\n📈 SYNC SUMMARY');
    console.log('='.repeat(40));
    console.log(`✅ Successful: ${successCount}/${customers.length}`);
    console.log(`❌ Failed: ${failureCount}/${customers.length}`);
    console.log(`📍 Locations: ${totalLocations}`);
    console.log(`🛢️ Tanks: ${totalTanks}`);
    console.log(`📊 Readings: ${totalReadings}`);
    console.log(`⏱️  Total Time: ${totalDuration}ms`);
    console.log(`📊 Success Rate: ${((successCount / customers.length) * 100).toFixed(1)}%`);

    return res.status(200).json({
      success: syncStatus === 'success',
      message: `SmartFill sync completed${isTestRun ? ' (test mode)' : ''}: ${successCount}/${customers.length} customers processed`,
      summary: {
        mode: isTestRun ? 'test' : 'sync',
        totalCustomers: customers.length,
        successful: successCount,
        failed: failureCount,
        locationsProcessed: totalLocations,
        tanksProcessed: totalTanks,
        readingsProcessed: totalReadings,
        successRate: `${((successCount / customers.length) * 100).toFixed(1)}%`,
        totalDuration: totalDuration
      },
      syncResults: syncResults,
      syncLogId: isTestRun ? null : syncLogId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    
    console.error('\n💥 SYNC FAILED');
    console.error('Error:', error.message);
    
    // Update sync log with failure
    if (!isTestRun) {
      try {
        await supabase.from('smartfill_sync_logs')
          .update({
            sync_status: 'failed',
            completed_at: new Date().toISOString(),
            sync_duration_ms: totalDuration,
            error_message: error.message
          })
          .eq('id', syncLogId);
      } catch (logError) {
        console.error('Failed to update sync log:', logError);
      }
    }
    
    return res.status(500).json({
      success: false,
      error: 'SmartFill sync failed',
      message: error.message,
      duration: totalDuration,
      timestamp: new Date().toISOString()
    });
  }
}