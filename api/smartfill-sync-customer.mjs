// SmartFill Customer-Specific API Sync Endpoint
// Syncs a single SmartFill customer by API reference
// URL: https://fuel-sight-guardian-ce89d8de.vercel.app/api/smartfill-sync-customer?customer=API_REFERENCE

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// SmartFill API Configuration
const SMARTFILL_API_URL = 'https://www.fmtdata.com/API/api.php';
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;

// Helper function to make SmartFill JSON-RPC request with retry logic
async function makeSmartFillRequest(apiReference, apiSecret, method = 'Tank:Level', params = {}, retryCount = 0) {
  const requestId = Math.random().toString(36).substr(2, 9);
  
  const payload = {
    jsonrpc: '2.0',
    method: method,
    params: {
      clientReference: apiReference,
      clientSecret: apiSecret,
      ...params
    },
    id: requestId
  };

  console.log(`[SMARTFILL CUSTOMER SYNC] ${apiReference}: Calling ${method} (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);

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
    console.error(`[SMARTFILL CUSTOMER SYNC] ${apiReference}: Error on attempt ${retryCount + 1}:`, error.message);
    
    if (retryCount < MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
      console.log(`[SMARTFILL CUSTOMER SYNC] ${apiReference}: Retrying in ${delay}ms...`);
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
function transformSmartFillData(apiData, customerId, customerName) {
  const locations = [];
  const tanks = [];
  const readings = [];

  if (!apiData || !Array.isArray(apiData)) {
    console.warn(`[SMARTFILL CUSTOMER SYNC] No valid data for customer ${customerName}`);
    return { locations, tanks, readings };
  }

  apiData.forEach(unit => {
    try {
      // Create location record
      const locationId = crypto.randomUUID();
      const location = {
        id: locationId,
        location_guid: unit.unitNumber || `unit_${Date.now()}_${Math.random()}`,
        customer_name: customerName,
        customer_id: customerId,
        unit_number: unit.unitNumber,
        description: unit.description || unit.unitDescription,
        timezone: 'Australia/Perth',
        latest_volume: unit.volume ? parseFloat(unit.volume) : null,
        latest_volume_percent: unit.volumePercentage ? parseFloat(unit.volumePercentage) : null,
        latest_status: unit.status || 'Unknown',
        latest_update_time: unit.dateTime ? new Date(unit.dateTime) : new Date(),
        raw_data: unit,
        updated_at: new Date()
      };
      locations.push(location);

      // Create tank records for each fuel type in the unit
      if (unit.tanks && Array.isArray(unit.tanks)) {
        unit.tanks.forEach((tank, index) => {
          const tankId = crypto.randomUUID();
          const tankRecord = {
            id: tankId,
            location_id: locationId,
            tank_guid: tank.tankId || `${unit.unitNumber}_tank_${index + 1}`,
            customer_id: customerId,
            unit_number: unit.unitNumber,
            tank_number: (index + 1).toString(),
            description: tank.description || tank.fuelType || `Tank ${index + 1}`,
            capacity: tank.capacity ? parseFloat(tank.capacity) : null,
            safe_fill_level: tank.safeLevel ? parseFloat(tank.safeLevel) : null,
            latest_volume: tank.volume ? parseFloat(tank.volume) : null,
            latest_volume_percent: tank.volumePercentage ? parseFloat(tank.volumePercentage) : null,
            latest_status: tank.status || unit.status || 'Unknown',
            latest_update_time: tank.dateTime ? new Date(tank.dateTime) : new Date(unit.dateTime),
            raw_data: tank,
            updated_at: new Date()
          };
          tanks.push(tankRecord);

          // Create reading record
          if (tank.volume !== null || tank.volumePercentage !== null) {
            const reading = {
              id: crypto.randomUUID(),
              tank_id: tankId,
              volume: tank.volume ? parseFloat(tank.volume) : null,
              volume_percent: tank.volumePercentage ? parseFloat(tank.volumePercentage) : null,
              status: tank.status || unit.status || 'Unknown',
              update_time: tank.dateTime ? new Date(tank.dateTime) : new Date(unit.dateTime),
              timezone: 'Australia/Perth',
              capacity: tank.capacity ? parseFloat(tank.capacity) : null,
              safe_fill_level: tank.safeLevel ? parseFloat(tank.safeLevel) : null,
              ullage: tank.capacity && tank.volume ? 
                      parseFloat(tank.capacity) - parseFloat(tank.volume) : null,
              created_at: new Date()
            };
            readings.push(reading);
          }
        });
      } else {
        // Single tank unit - create one tank record
        const tankId = crypto.randomUUID();
        const tankRecord = {
          id: tankId,
          location_id: locationId,
          tank_guid: unit.unitNumber || `${unit.unitNumber}_tank_1`,
          customer_id: customerId,
          unit_number: unit.unitNumber,
          tank_number: '1',
          description: unit.description || unit.fuelType || 'Main Tank',
          capacity: unit.capacity ? parseFloat(unit.capacity) : null,
          safe_fill_level: unit.safeLevel ? parseFloat(unit.safeLevel) : null,
          latest_volume: unit.volume ? parseFloat(unit.volume) : null,
          latest_volume_percent: unit.volumePercentage ? parseFloat(unit.volumePercentage) : null,
          latest_status: unit.status || 'Unknown',
          latest_update_time: unit.dateTime ? new Date(unit.dateTime) : new Date(),
          raw_data: unit,
          updated_at: new Date()
        };
        tanks.push(tankRecord);

        // Create reading record
        if (unit.volume !== null || unit.volumePercentage !== null) {
          const reading = {
            id: crypto.randomUUID(),
            tank_id: tankId,
            volume: unit.volume ? parseFloat(unit.volume) : null,
            volume_percent: unit.volumePercentage ? parseFloat(unit.volumePercentage) : null,
            status: unit.status || 'Unknown',
            update_time: unit.dateTime ? new Date(unit.dateTime) : new Date(),
            timezone: 'Australia/Perth',
            capacity: unit.capacity ? parseFloat(unit.capacity) : null,
            safe_fill_level: unit.safeLevel ? parseFloat(unit.safeLevel) : null,
            ullage: unit.capacity && unit.volume ? 
                    parseFloat(unit.capacity) - parseFloat(unit.volume) : null,
            created_at: new Date()
          };
          readings.push(reading);
        }
      }
    } catch (error) {
      console.error(`[SMARTFILL CUSTOMER SYNC] Error transforming unit data:`, error, unit);
    }
  });

  return { locations, tanks, readings };
}

export default async function handler(req, res) {
  const startTime = Date.now();
  
  console.log('\n🔄 SMARTFILL CUSTOMER SYNC STARTED');
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

  // Get customer parameter
  const customerRef = req.query.customer || req.body?.customer;
  if (!customerRef) {
    return res.status(400).json({
      success: false,
      error: 'Missing customer parameter',
      message: 'Please provide customer API reference via ?customer=API_REFERENCE or in request body'
    });
  }

  const isTestRun = req.method === 'GET';
  
  if (isTestRun) {
    console.log('🧪 Running in TEST mode (no database changes)');
  }
  
  console.log(`🎯 Target customer: ${customerRef}`);

  try {
    // Find the specific SmartFill customer
    console.log('📊 Fetching customer details...');
    
    const { data: customer, error: customerError } = await supabase
      .from('smartfill_customers')
      .select('id, api_reference, api_secret, name, active')
      .eq('api_reference', customerRef)
      .single();

    if (customerError) {
      if (customerError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Customer not found',
          message: `SmartFill customer '${customerRef}' not found in database`,
          apiReference: customerRef
        });
      }
      throw new Error(`Database error: ${customerError.message}`);
    }

    if (!customer.active) {
      return res.status(400).json({
        success: false,
        error: 'Customer inactive',
        message: `SmartFill customer '${customerRef}' is marked as inactive`,
        customerData: {
          name: customer.name,
          apiReference: customer.api_reference,
          active: customer.active
        }
      });
    }

    console.log(`✅ Found customer: ${customer.name} (${customer.api_reference})`);

    // Start sync log
    const syncLogId = crypto.randomUUID();
    const syncLog = {
      id: syncLogId,
      sync_type: isTestRun ? 'customer_api_test' : 'customer_manual',
      sync_status: 'running',
      started_at: new Date().toISOString(),
      locations_processed: 0,
      tanks_processed: 0,
      assets_processed: 1, // Single customer
      readings_processed: 0
    };

    if (!isTestRun) {
      await supabase.from('smartfill_sync_logs').insert(syncLog);
    }

    // Fetch tank data from SmartFill API
    console.log(`🔄 Syncing with SmartFill API...`);
    
    const apiResult = await makeSmartFillRequest(
      customer.api_reference,
      customer.api_secret,
      'Tank:Level'
    );

    if (!apiResult.success) {
      // Update sync log with failure
      if (!isTestRun) {
        await supabase.from('smartfill_sync_logs')
          .update({
            sync_status: 'failed',
            completed_at: new Date().toISOString(),
            sync_duration_ms: Date.now() - startTime,
            error_message: apiResult.error
          })
          .eq('id', syncLogId);
      }

      return res.status(500).json({
        success: false,
        error: 'SmartFill API error',
        message: apiResult.error,
        customerData: {
          name: customer.name,
          apiReference: customer.api_reference
        },
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
    }

    // Transform API data to database format
    console.log(`🔄 Transforming API data...`);
    const { locations, tanks, readings } = transformSmartFillData(
      apiResult.data,
      customer.id,
      customer.name
    );

    console.log(`📍 Locations: ${locations.length}, 🛢️ Tanks: ${tanks.length}, 📊 Readings: ${readings.length}`);

    let dbOperationSummary = {};

    if (!isTestRun && (locations.length > 0 || tanks.length > 0 || readings.length > 0)) {
      console.log(`🗃️  Updating database...`);
      
      // Clear existing data for this customer
      const { error: clearReadingsError } = await supabase
        .from('smartfill_readings_history')
        .delete()
        .in('tank_id', tanks.map(t => t.id));
      
      const { error: clearTanksError } = await supabase
        .from('smartfill_tanks')
        .delete()
        .eq('customer_id', customer.id);
        
      const { error: clearLocationsError } = await supabase
        .from('smartfill_locations')
        .delete()
        .eq('customer_id', customer.id);

      if (clearReadingsError || clearTanksError || clearLocationsError) {
        throw new Error(`Error clearing existing data: ${clearReadingsError?.message || clearTanksError?.message || clearLocationsError?.message}`);
      }

      // Insert new data
      if (locations.length > 0) {
        const { error: locError } = await supabase
          .from('smartfill_locations')
          .insert(locations);
        if (locError) throw new Error(`Location insert error: ${locError.message}`);
        dbOperationSummary.locationsInserted = locations.length;
      }

      if (tanks.length > 0) {
        const { error: tankError } = await supabase
          .from('smartfill_tanks')
          .insert(tanks);
        if (tankError) throw new Error(`Tank insert error: ${tankError.message}`);
        dbOperationSummary.tanksInserted = tanks.length;
      }

      if (readings.length > 0) {
        const { error: readError } = await supabase
          .from('smartfill_readings_history')
          .insert(readings);
        if (readError) throw new Error(`Reading insert error: ${readError.message}`);
        dbOperationSummary.readingsInserted = readings.length;
      }

      console.log(`✅ Database updated successfully`);
    }

    const totalDuration = Date.now() - startTime;

    // Update sync log with success
    if (!isTestRun) {
      await supabase.from('smartfill_sync_logs')
        .update({
          sync_status: 'success',
          completed_at: new Date().toISOString(),
          locations_processed: locations.length,
          tanks_processed: tanks.length,
          readings_processed: readings.length,
          sync_duration_ms: totalDuration
        })
        .eq('id', syncLogId);
    }

    // Summary
    console.log('\n📈 CUSTOMER SYNC SUMMARY');
    console.log('='.repeat(40));
    console.log(`✅ Customer: ${customer.name}`);
    console.log(`📍 Locations: ${locations.length}`);
    console.log(`🛢️ Tanks: ${tanks.length}`);
    console.log(`📊 Readings: ${readings.length}`);
    console.log(`⏱️  Duration: ${totalDuration}ms`);
    console.log(`📊 Status: Success`);

    return res.status(200).json({
      success: true,
      message: `SmartFill customer sync completed${isTestRun ? ' (test mode)' : ''}: ${customer.name}`,
      customerData: {
        id: customer.id,
        name: customer.name,
        apiReference: customer.api_reference,
        active: customer.active
      },
      syncResults: {
        locationsProcessed: locations.length,
        tanksProcessed: tanks.length,
        readingsProcessed: readings.length,
        duration: totalDuration,
        status: 'success'
      },
      dbOperations: isTestRun ? null : dbOperationSummary,
      apiData: {
        unitsReceived: apiResult.data ? apiResult.data.length : 0,
        rawDataSample: apiResult.data ? apiResult.data.slice(0, 2) : null
      },
      syncLogId: isTestRun ? null : syncLogId,
      mode: isTestRun ? 'test' : 'sync',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    
    console.error('\n💥 CUSTOMER SYNC FAILED');
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
      error: 'SmartFill customer sync failed',
      message: error.message,
      customerReference: customerRef,
      duration: totalDuration,
      timestamp: new Date().toISOString()
    });
  }
}