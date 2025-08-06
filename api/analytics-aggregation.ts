/**
 * ANALYTICS AGGREGATION API ENDPOINT
 * 
 * Aggregates data from SmartFill, AgBot, and Captive Payments systems
 * into the Vercel Postgres analytics warehouse
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  initializeAnalyticsDB,
  storeFuelAnalytics,
  storeDeliveryAnalytics,
  storePerformanceMetric,
  getDashboardSummary,
  getAnalyticsDBHealth
} from '@/lib/vercel-postgres';
import { supabase } from '@/lib/supabase';
import { cacheSet, cacheGet, CACHE_CONFIG, CACHE_KEYS } from './lib/vercel-kv';

interface AggregationRequest {
  action: 'aggregate' | 'health' | 'summary' | 'init';
  date?: string; // YYYY-MM-DD format
  forceRefresh?: boolean;
  systems?: ('smartfill' | 'agbot' | 'captive_payments')[];
}

export async function POST(request: NextRequest) {
  try {
    const body: AggregationRequest = await request.json();
    const { action, date = new Date().toISOString().split('T')[0], forceRefresh = false, systems = ['smartfill', 'agbot', 'captive_payments'] } = body;

    switch (action) {
      case 'init':
        return await handleInitialization();
      case 'aggregate':
        return await handleAggregation(date, forceRefresh, systems);
      case 'health':
        return await handleHealthCheck();
      case 'summary':
        return await handleSummary();
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[ANALYTICS API] Request failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

/**
 * Initialize analytics database
 */
async function handleInitialization() {
  try {
    await initializeAnalyticsDB();
    return NextResponse.json({
      success: true,
      message: 'Analytics database initialized successfully'
    });
  } catch (error) {
    console.error('[ANALYTICS API] Initialization failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to initialize analytics database' },
      { status: 500 }
    );
  }
}

/**
 * Handle data aggregation
 */
async function handleAggregation(date: string, forceRefresh: boolean, systems: string[]) {
  try {
    const cacheKey = `${CACHE_KEYS.QUERY_CACHE}aggregation_${date}`;
    
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = await cacheGet<any>(cacheKey);
      if (cached) {
        return NextResponse.json({
          success: true,
          data: cached,
          cached: true
        });
      }
    }

    const results = {
      fuel_analytics: null,
      delivery_analytics: null,
      performance_metrics: [],
      errors: []
    };

    // Aggregate SmartFill and AgBot data (fuel analytics)
    if (systems.includes('smartfill') || systems.includes('agbot')) {
      try {
        const fuelAnalytics = await aggregateFuelData(date);
        await storeFuelAnalytics(fuelAnalytics);
        results.fuel_analytics = fuelAnalytics;
      } catch (error) {
        results.errors.push(`Fuel analytics aggregation failed: ${error}`);
      }
    }

    // Aggregate Captive Payments data (delivery analytics)
    if (systems.includes('captive_payments')) {
      try {
        const deliveryAnalytics = await aggregateDeliveryData(date);
        await storeDeliveryAnalytics(deliveryAnalytics);
        results.delivery_analytics = deliveryAnalytics;
      } catch (error) {
        results.errors.push(`Delivery analytics aggregation failed: ${error}`);
      }
    }

    // Store performance metrics
    try {
      const performanceMetrics = await aggregatePerformanceMetrics(date);
      for (const metric of performanceMetrics) {
        await storePerformanceMetric(metric);
      }
      results.performance_metrics = performanceMetrics;
    } catch (error) {
      results.errors.push(`Performance metrics aggregation failed: ${error}`);
    }

    // Cache results
    await cacheSet(cacheKey, results, CACHE_CONFIG.QUERY_RESULTS);

    return NextResponse.json({
      success: results.errors.length === 0,
      data: results,
      cached: false
    });
  } catch (error) {
    console.error('[ANALYTICS API] Aggregation failed:', error);
    return NextResponse.json(
      { success: false, error: 'Data aggregation failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle health check
 */
async function handleHealthCheck() {
  try {
    const health = await getAnalyticsDBHealth();
    return NextResponse.json({
      success: health.connected,
      data: health
    });
  } catch (error) {
    console.error('[ANALYTICS API] Health check failed:', error);
    return NextResponse.json(
      { success: false, error: 'Health check failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle summary request
 */
async function handleSummary() {
  try {
    const summary = await getDashboardSummary();
    return NextResponse.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('[ANALYTICS API] Summary failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get summary' },
      { status: 500 }
    );
  }
}

/**
 * Aggregate fuel data from SmartFill and AgBot systems
 */
async function aggregateFuelData(date: string) {
  // Get SmartFill data
  const { data: smartfillLocations } = await supabase
    .from('smartfill_locations')
    .select(`
      *,
      tanks:smartfill_tanks(*)
    `);

  // Get AgBot data
  const { data: agbotLocations } = await supabase
    .from('agbot_locations')
    .select(`
      *,
      assets:agbot_assets(*)
    `);

  let totalLocations = 0;
  let totalTanks = 0;
  let totalCapacity = 0;
  let totalVolume = 0;
  let lowFuelCount = 0;
  let fillPercentageSum = 0;
  let tankCount = 0;

  // Process SmartFill data
  if (smartfillLocations) {
    totalLocations += smartfillLocations.length;
    
    for (const location of smartfillLocations) {
      const tanks = location.tanks || [];
      totalTanks += tanks.length;
      
      for (const tank of tanks) {
        tankCount++;
        totalCapacity += tank.capacity || 0;
        totalVolume += tank.latest_volume || 0;
        fillPercentageSum += tank.latest_volume_percent || 0;
        
        if ((tank.latest_volume_percent || 0) < 20) {
          lowFuelCount++;
        }
      }
    }
  }

  // Process AgBot data
  if (agbotLocations) {
    totalLocations += agbotLocations.length;
    
    for (const location of agbotLocations) {
      const assets = location.assets || [];
      totalTanks += assets.length;
      
      for (const asset of assets) {
        tankCount++;
        // AgBot uses percentages, estimate capacity from percentage
        const estimatedCapacity = 1000; // Default estimation
        totalCapacity += estimatedCapacity;
        totalVolume += (estimatedCapacity * (asset.latest_calibrated_fill_percentage || 0)) / 100;
        fillPercentageSum += asset.latest_calibrated_fill_percentage || 0;
        
        if ((asset.latest_calibrated_fill_percentage || 0) < 20) {
          lowFuelCount++;
        }
      }
    }
  }

  const avgFillPercentage = tankCount > 0 ? fillPercentageSum / tankCount : 0;
  const systemEfficiency = Math.max(0, 100 - (lowFuelCount / Math.max(1, totalTanks)) * 100);
  
  // Calculate consumption rate (simplified - could be enhanced with historical data)
  const consumptionRate = totalVolume * 0.02; // Estimated 2% daily consumption

  return {
    date,
    total_locations: totalLocations,
    total_tanks: totalTanks,
    avg_fill_percentage: avgFillPercentage,
    low_fuel_count: lowFuelCount,
    total_capacity: totalCapacity,
    total_volume: totalVolume,
    consumption_rate: consumptionRate,
    system_efficiency: systemEfficiency
  };
}

/**
 * Aggregate delivery data from Captive Payments system
 */
async function aggregateDeliveryData(date: string) {
  // Get captive deliveries for the date
  const { data: deliveries } = await supabase
    .from('captive_deliveries')
    .select('*')
    .eq('delivery_date', date);

  let totalDeliveries = 0;
  let totalVolume = 0;
  const customers = new Set();
  const terminals = new Set();
  const carrierBreakdown: Record<string, number> = {};

  if (deliveries) {
    totalDeliveries = deliveries.length;
    
    for (const delivery of deliveries) {
      totalVolume += Math.abs(delivery.total_volume_litres || 0);
      customers.add(delivery.customer);
      terminals.add(delivery.terminal);
      
      const carrier = delivery.carrier || 'Unknown';
      carrierBreakdown[carrier] = (carrierBreakdown[carrier] || 0) + Math.abs(delivery.total_volume_litres || 0);
    }
  }

  const avgDeliverySize = totalDeliveries > 0 ? totalVolume / totalDeliveries : 0;

  return {
    date,
    total_deliveries: totalDeliveries,
    total_volume: totalVolume,
    avg_delivery_size: avgDeliverySize,
    unique_customers: customers.size,
    unique_terminals: terminals.size,
    carrier_breakdown: carrierBreakdown
  };
}

/**
 * Aggregate performance metrics from all systems
 */
async function aggregatePerformanceMetrics(date: string) {
  const metrics = [];
  const timestamp = new Date(date + 'T23:59:59Z').toISOString();

  // API response times (from cache or monitoring)
  try {
    // SmartFill API metrics
    metrics.push({
      metric_name: 'smartfill_api_response_time',
      value: 2500, // Would come from actual monitoring
      timestamp,
      source_system: 'smartfill',
      tags: { unit: 'milliseconds' }
    });

    // AgBot API metrics
    metrics.push({
      metric_name: 'agbot_api_response_time',
      value: 1800, // Would come from actual monitoring
      timestamp,
      source_system: 'agbot',
      tags: { unit: 'milliseconds' }
    });

    // Data processing metrics
    const { data: importBatches } = await supabase
      .from('data_import_batches')
      .select('*')
      .gte('started_at', date + 'T00:00:00Z')
      .lte('started_at', date + 'T23:59:59Z');

    if (importBatches) {
      const completedBatches = importBatches.filter(batch => batch.status === 'completed');
      const successRate = importBatches.length > 0 ? (completedBatches.length / importBatches.length) * 100 : 100;

      metrics.push({
        metric_name: 'data_import_success_rate',
        value: successRate,
        timestamp,
        source_system: 'system',
        tags: { unit: 'percentage', total_batches: importBatches.length }
      });
    }

    // System uptime metric (simplified)
    metrics.push({
      metric_name: 'system_uptime',
      value: 99.5,
      timestamp,
      source_system: 'system',
      tags: { unit: 'percentage' }
    });

  } catch (error) {
    console.warn('[ANALYTICS] Performance metrics aggregation warning:', error);
  }

  return metrics;
}

// Health check endpoint
export async function GET() {
  try {
    const health = await getAnalyticsDBHealth();
    return NextResponse.json({
      success: true,
      service: 'Analytics Aggregation API',
      timestamp: new Date().toISOString(),
      database_health: health
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Service unavailable' },
      { status: 503 }
    );
  }
}