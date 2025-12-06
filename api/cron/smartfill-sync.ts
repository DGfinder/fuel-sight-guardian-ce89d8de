/**
 * SmartFill Sync Cron Job
 * Automated hourly sync of SmartFill tank data via JSON-RPC API
 *
 * Schedule: Every hour at :30 (e.g., 7:30, 8:30, 9:30, etc.)
 * Syncs all active customers from ta_smartfill_customers table
 *
 * Authentication: Vercel Cron signature or Bearer token
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// SmartFill API Configuration
const SMARTFILL_API_URL = 'https://www.fmtdata.com/API/api.php';
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 second, exponential backoff

interface SmartFillCustomer {
  id: string;
  api_reference: string;
  api_secret: string;
  name: string;
  sync_priority: number;
  consecutive_failures: number;
}

interface SmartFillAPIResponse {
  jsonrpc: string;
  result?: {
    columns: string[];
    values: any[][];
  };
  error?: {
    code: number;
    message: string;
  };
  id: string;
}

interface CustomerSyncResult {
  customer_id: string;
  customer_name: string;
  status: 'success' | 'failed' | 'skipped';
  locations_processed: number;
  tanks_processed: number;
  readings_stored: number;
  duration_ms: number;
  error?: string;
}

interface SyncSummary {
  customers_attempted: number;
  customers_success: number;
  customers_failed: number;
  locations_processed: number;
  tanks_processed: number;
  readings_stored: number;
  total_duration_ms: number;
  customer_results: CustomerSyncResult[];
}

// Helper: Make SmartFill API request with retry logic
async function makeSmartFillRequest(
  apiReference: string,
  apiSecret: string,
  retryCount = 0
): Promise<{ success: boolean; data?: any; error?: string; responseTime?: number }> {
  const requestId = Math.random().toString(36).substring(2, 11);
  const startTime = Date.now();

  const payload = {
    jsonrpc: '2.0',
    method: 'Tank:Level',
    parameters: {
      clientReference: apiReference,
      clientSecret: apiSecret,
    },
    id: requestId,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(SMARTFILL_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data: SmartFillAPIResponse = await response.json();

    if (data.error) {
      throw new Error(`API error: ${data.error.message} (code: ${data.error.code})`);
    }

    return { success: true, data: data.result, responseTime };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount);
      console.log(`[SMARTFILL CRON] Retry ${retryCount + 1}/${MAX_RETRIES} for ${apiReference} in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return makeSmartFillRequest(apiReference, apiSecret, retryCount + 1);
    }

    return { success: false, error: errorMessage, responseTime: Date.now() - startTime };
  }
}

// Helper: Transform API data to database format
function transformSmartFillData(
  apiResult: { columns: string[]; values: any[][] },
  customerId: string,
  customerName: string
) {
  const locations: any[] = [];
  const tanks: any[] = [];
  const readings: any[] = [];

  if (!apiResult?.columns || !Array.isArray(apiResult.values)) {
    return { locations, tanks, readings };
  }

  const { columns, values } = apiResult;

  // Create column index map
  const colIdx: Record<string, number> = {};
  columns.forEach((col, idx) => { colIdx[col] = idx; });

  // Group by unit number
  const unitGroups = new Map<string, any[]>();

  values.forEach(row => {
    const unitNumber = row[colIdx['Unit Number']];
    if (!unitNumber) return;

    if (!unitGroups.has(unitNumber)) {
      unitGroups.set(unitNumber, []);
    }

    const tankData: Record<string, any> = {};
    columns.forEach((col, idx) => { tankData[col] = row[idx]; });
    unitGroups.get(unitNumber)!.push(tankData);
  });

  // Process each unit as a location
  unitGroups.forEach((unitTanks, unitNumber) => {
    const locationId = crypto.randomUUID();
    const firstTank = unitTanks[0];

    // Calculate location-level aggregates
    const validPercentages = unitTanks
      .map(t => parseFloat(t['Volume Percent']))
      .filter(p => !isNaN(p) && p >= 0);
    const avgPercent = validPercentages.length > 0
      ? validPercentages.reduce((a, b) => a + b, 0) / validPercentages.length
      : null;

    const totalVolume = unitTanks
      .map(t => parseFloat(t['Volume']) || 0)
      .reduce((a, b) => a + b, 0);

    const totalCapacity = unitTanks
      .map(t => parseFloat(t['Capacity']) || 0)
      .reduce((a, b) => a + b, 0);

    const latestUpdate = unitTanks.reduce((latest, t) => {
      const update = t['Last Updated'] || '';
      return update > latest ? update : latest;
    }, '');

    // Location record
    locations.push({
      id: locationId,
      customer_id: customerId,
      external_guid: `smartfill-${customerId}-${unitNumber}`,
      unit_number: unitNumber,
      name: firstTank.Description || `Unit ${unitNumber}`,
      description: firstTank.Description,
      timezone: firstTank.Timezone || 'Australia/Perth',
      total_tanks: unitTanks.length,
      total_capacity: totalCapacity || null,
      total_volume: totalVolume || null,
      avg_fill_percent: avgPercent,
      critical_tanks: validPercentages.filter(p => p < 20).length,
      warning_tanks: validPercentages.filter(p => p >= 20 && p < 40).length,
      latest_status: firstTank.Status || 'Unknown',
      latest_update_at: latestUpdate ? new Date(latestUpdate).toISOString() : null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Tank records
    unitTanks.forEach(tankData => {
      const tankId = crypto.randomUUID();
      const tankNumber = tankData['Tank Number'] || '1';
      const volume = parseFloat(tankData['Volume']);
      const volumePercent = parseFloat(tankData['Volume Percent']);
      const capacity = parseFloat(tankData['Capacity']);
      const safeLevel = parseFloat(tankData['Tank SFL']);

      tanks.push({
        id: tankId,
        location_id: locationId,
        customer_id: customerId,
        external_guid: `smartfill-${customerId}-${unitNumber}-${tankNumber}`,
        unit_number: unitNumber,
        tank_number: tankNumber.toString(),
        name: tankData.Description || `Tank ${tankNumber}`,
        description: tankData.Description,
        capacity: !isNaN(capacity) ? capacity : null,
        safe_fill_level: !isNaN(safeLevel) ? safeLevel : null,
        current_volume: !isNaN(volume) ? volume : null,
        current_volume_percent: !isNaN(volumePercent) ? volumePercent : null,
        current_status: tankData.Status || 'Unknown',
        current_ullage: !isNaN(capacity) && !isNaN(volume) ? Math.max(0, capacity - volume) : null,
        health_status: volumePercent < 20 ? 'critical' : volumePercent < 40 ? 'warning' : 'healthy',
        last_reading_at: tankData['Last Updated'] ? new Date(tankData['Last Updated']).toISOString() : null,
        is_active: true,
        is_monitored: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Reading record
      if (!isNaN(volume) || !isNaN(volumePercent)) {
        readings.push({
          id: crypto.randomUUID(),
          tank_id: tankId,
          volume: !isNaN(volume) ? volume : null,
          volume_percent: !isNaN(volumePercent) ? volumePercent : null,
          status: tankData.Status || 'Unknown',
          capacity: !isNaN(capacity) ? capacity : null,
          safe_fill_level: !isNaN(safeLevel) ? safeLevel : null,
          ullage: !isNaN(capacity) && !isNaN(volume) ? Math.max(0, capacity - volume) : null,
          reading_at: tankData['Last Updated'] ? new Date(tankData['Last Updated']).toISOString() : new Date().toISOString(),
          api_timestamp: tankData['Last Updated'],
          timezone: tankData.Timezone || 'Australia/Perth',
          created_at: new Date().toISOString(),
        });
      }
    });
  });

  return { locations, tanks, readings };
}

// Helper: Sync a single customer
async function syncCustomer(
  supabase: SupabaseClient,
  customer: SmartFillCustomer
): Promise<CustomerSyncResult> {
  const startTime = Date.now();
  const result: CustomerSyncResult = {
    customer_id: customer.id,
    customer_name: customer.name,
    status: 'failed',
    locations_processed: 0,
    tanks_processed: 0,
    readings_stored: 0,
    duration_ms: 0,
  };

  try {
    console.log(`[SMARTFILL CRON] Syncing ${customer.name} (${customer.api_reference})`);

    // Fetch from SmartFill API
    const apiResult = await makeSmartFillRequest(customer.api_reference, customer.api_secret);

    if (!apiResult.success) {
      result.error = apiResult.error;
      result.duration_ms = Date.now() - startTime;

      // Update consecutive failures
      await supabase
        .from('ta_smartfill_customers')
        .update({
          consecutive_failures: customer.consecutive_failures + 1,
          last_sync_at: new Date().toISOString(),
          last_sync_status: 'failed',
        })
        .eq('id', customer.id);

      return result;
    }

    // Transform data
    const { locations, tanks, readings } = transformSmartFillData(
      apiResult.data,
      customer.id,
      customer.name
    );

    if (locations.length === 0 && tanks.length === 0) {
      result.status = 'success';
      result.duration_ms = Date.now() - startTime;

      await supabase
        .from('ta_smartfill_customers')
        .update({
          consecutive_failures: 0,
          last_sync_at: new Date().toISOString(),
          last_sync_status: 'success',
        })
        .eq('id', customer.id);

      return result;
    }

    // Delete existing data for this customer (full refresh)
    await supabase.from('ta_smartfill_readings').delete().eq('tank_id', tanks.map(t => t.id));
    await supabase.from('ta_smartfill_tanks').delete().eq('customer_id', customer.id);
    await supabase.from('ta_smartfill_locations').delete().eq('customer_id', customer.id);

    // Insert new data
    if (locations.length > 0) {
      const { error: locError } = await supabase.from('ta_smartfill_locations').insert(locations);
      if (locError) throw new Error(`Location insert error: ${locError.message}`);
    }

    if (tanks.length > 0) {
      const { error: tankError } = await supabase.from('ta_smartfill_tanks').insert(tanks);
      if (tankError) throw new Error(`Tank insert error: ${tankError.message}`);
    }

    if (readings.length > 0) {
      const { error: readError } = await supabase.from('ta_smartfill_readings').insert(readings);
      if (readError) throw new Error(`Reading insert error: ${readError.message}`);
    }

    // Update customer sync status
    await supabase
      .from('ta_smartfill_customers')
      .update({
        consecutive_failures: 0,
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'success',
      })
      .eq('id', customer.id);

    result.status = 'success';
    result.locations_processed = locations.length;
    result.tanks_processed = tanks.length;
    result.readings_stored = readings.length;
    result.duration_ms = Date.now() - startTime;

    console.log(`[SMARTFILL CRON] ✅ ${customer.name}: ${locations.length} locations, ${tanks.length} tanks (${result.duration_ms}ms)`);

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    result.duration_ms = Date.now() - startTime;

    console.error(`[SMARTFILL CRON] ❌ ${customer.name}: ${result.error}`);

    // Update consecutive failures
    try {
      await supabase
        .from('ta_smartfill_customers')
        .update({
          consecutive_failures: customer.consecutive_failures + 1,
          last_sync_at: new Date().toISOString(),
          last_sync_status: 'failed',
        })
        .eq('id', customer.id);
    } catch (e) {
      // Ignore update errors
    }

    return result;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();

  console.log('='.repeat(80));
  console.log('[SMARTFILL CRON] Starting scheduled sync');
  console.log('[SMARTFILL CRON] Timestamp:', new Date().toISOString());
  console.log('='.repeat(80));

  try {
    // Authentication
    const isVercelCron = !!req.headers['x-vercel-signature'] ||
                         (req.headers['user-agent'] as string)?.includes('vercel-cron');
    const authHeader = req.headers.authorization;
    const hasValidAuth = isVercelCron || (authHeader && authHeader.startsWith('Bearer '));

    console.log('[SMARTFILL CRON AUTH]', {
      hasVercelSignature: !!req.headers['x-vercel-signature'],
      hasVercelUserAgent: (req.headers['user-agent'] as string)?.includes('vercel-cron'),
      hasAuthorization: !!authHeader,
    });

    if (!hasValidAuth) {
      console.error('[SMARTFILL CRON AUTH] Unauthorized');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[SMARTFILL CRON AUTH] ✅ Authorized');

    // Initialize Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[SMARTFILL CRON] Missing Supabase configuration');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create sync log entry
    const syncLogId = crypto.randomUUID();
    await supabase.from('ta_smartfill_sync_logs').insert({
      id: syncLogId,
      sync_type: 'scheduled',
      trigger_source: isVercelCron ? 'cron' : 'api',
      sync_status: 'running',
      started_at: new Date().toISOString(),
    });

    // Get active customers ordered by priority
    const { data: customers, error: customerError } = await supabase
      .from('ta_smartfill_customers')
      .select('id, api_reference, api_secret, name, sync_priority, consecutive_failures')
      .eq('is_active', true)
      .eq('sync_enabled', true)
      .order('sync_priority', { ascending: false })
      .order('name');

    if (customerError) {
      throw new Error(`Failed to fetch customers: ${customerError.message}`);
    }

    if (!customers || customers.length === 0) {
      // No customers to sync - check legacy table
      console.log('[SMARTFILL CRON] No customers in ta_smartfill_customers, checking legacy table...');

      const { data: legacyCustomers } = await supabase
        .from('smartfill_customers')
        .select('id, api_reference, api_secret, name, active')
        .eq('active', true)
        .order('name');

      if (!legacyCustomers || legacyCustomers.length === 0) {
        await supabase
          .from('ta_smartfill_sync_logs')
          .update({
            sync_status: 'success',
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            error_message: 'No active customers found',
          })
          .eq('id', syncLogId);

        return res.status(200).json({
          success: true,
          message: 'No active customers to sync',
          timestamp: new Date().toISOString(),
        });
      }

      // Use legacy customers (map to expected format)
      customers.push(...legacyCustomers.map(c => ({
        id: c.id.toString(),
        api_reference: c.api_reference,
        api_secret: c.api_secret,
        name: c.name,
        sync_priority: 50,
        consecutive_failures: 0,
      })));
    }

    console.log(`[SMARTFILL CRON] Found ${customers.length} active customers`);

    // Sync all customers
    const summary: SyncSummary = {
      customers_attempted: customers.length,
      customers_success: 0,
      customers_failed: 0,
      locations_processed: 0,
      tanks_processed: 0,
      readings_stored: 0,
      total_duration_ms: 0,
      customer_results: [],
    };

    for (const customer of customers as SmartFillCustomer[]) {
      const result = await syncCustomer(supabase, customer);
      summary.customer_results.push(result);

      if (result.status === 'success') {
        summary.customers_success++;
        summary.locations_processed += result.locations_processed;
        summary.tanks_processed += result.tanks_processed;
        summary.readings_stored += result.readings_stored;
      } else {
        summary.customers_failed++;
      }
    }

    summary.total_duration_ms = Date.now() - startTime;

    // Determine overall status
    const syncStatus = summary.customers_failed === 0
      ? 'success'
      : summary.customers_success > 0
        ? 'partial'
        : 'failed';

    // Update sync log
    await supabase
      .from('ta_smartfill_sync_logs')
      .update({
        sync_status: syncStatus,
        customers_attempted: summary.customers_attempted,
        customers_success: summary.customers_success,
        customers_failed: summary.customers_failed,
        locations_processed: summary.locations_processed,
        tanks_processed: summary.tanks_processed,
        readings_stored: summary.readings_stored,
        duration_ms: summary.total_duration_ms,
        completed_at: new Date().toISOString(),
        customer_results: summary.customer_results,
        error_message: summary.customers_failed > 0
          ? `${summary.customers_failed} customers failed to sync`
          : null,
      })
      .eq('id', syncLogId);

    // Log summary
    console.log('\n[SMARTFILL CRON] SYNC SUMMARY');
    console.log('='.repeat(40));
    console.log(`✅ Successful: ${summary.customers_success}/${summary.customers_attempted}`);
    console.log(`❌ Failed: ${summary.customers_failed}/${summary.customers_attempted}`);
    console.log(`📍 Locations: ${summary.locations_processed}`);
    console.log(`🛢️ Tanks: ${summary.tanks_processed}`);
    console.log(`📊 Readings: ${summary.readings_stored}`);
    console.log(`⏱️ Duration: ${summary.total_duration_ms}ms`);

    return res.status(200).json({
      success: syncStatus !== 'failed',
      status: syncStatus,
      summary: {
        customers_attempted: summary.customers_attempted,
        customers_success: summary.customers_success,
        customers_failed: summary.customers_failed,
        locations_processed: summary.locations_processed,
        tanks_processed: summary.tanks_processed,
        readings_stored: summary.readings_stored,
        duration_ms: summary.total_duration_ms,
        success_rate: `${((summary.customers_success / summary.customers_attempted) * 100).toFixed(1)}%`,
      },
      sync_log_id: syncLogId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[SMARTFILL CRON] Fatal error:', error);

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
  }
}
