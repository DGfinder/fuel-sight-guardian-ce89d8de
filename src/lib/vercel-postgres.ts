/**
 * VERCEL POSTGRES ANALYTICS DATA WAREHOUSE
 * 
 * Provides optimized analytics queries, pre-computed aggregations,
 * and cross-system data integration using Vercel Postgres
 */

// Conditional import for Vercel Postgres
let sql: any = null;

async function getSQL() {
  if (sql === null && typeof window === 'undefined') {
    try {
      const { sql: sqlClient } = await import('@vercel/postgres');
      sql = sqlClient;
    } catch (error) {
      console.warn('[POSTGRES] @vercel/postgres not available, analytics disabled');
      sql = false; // Mark as unavailable
    }
  }
  return sql || null;
}

// Analytics table schemas
export const ANALYTICS_TABLES = {
  // Cross-system aggregated data
  FUEL_ANALYTICS: 'fuel_analytics_agg',
  DELIVERY_ANALYTICS: 'delivery_analytics_agg',
  PERFORMANCE_METRICS: 'performance_metrics_agg',
  
  // Time-series optimized tables
  DAILY_CONSUMPTION: 'daily_consumption_ts',
  HOURLY_READINGS: 'hourly_readings_ts',
  
  // Cross-reference tables
  LOCATION_MAPPING: 'location_cross_ref',
  CUSTOMER_MAPPING: 'customer_cross_ref',
  
  // Materialized views
  DASHBOARD_SUMMARY: 'dashboard_summary_mv',
  FUEL_TRENDS: 'fuel_trends_mv',
  ALERT_SUMMARY: 'alert_summary_mv'
} as const;

// Query interfaces
export interface FuelAnalytics {
  date: string;
  total_locations: number;
  total_tanks: number;
  avg_fill_percentage: number;
  low_fuel_count: number;
  total_capacity: number;
  total_volume: number;
  consumption_rate: number;
  system_efficiency: number;
}

export interface DeliveryAnalytics {
  date: string;
  total_deliveries: number;
  total_volume: number;
  avg_delivery_size: number;
  unique_customers: number;
  unique_terminals: number;
  carrier_breakdown: Record<string, number>;
}

export interface PerformanceMetrics {
  metric_name: string;
  value: number;
  timestamp: string;
  source_system: string;
  tags: Record<string, any>;
}

/**
 * Initialize analytics database with optimized schema
 */
export async function initializeAnalyticsDB(): Promise<void> {
  const sqlClient = await getSQL();
  if (!sqlClient) {
    console.warn('[POSTGRES] Cannot initialize analytics DB - Postgres unavailable');
    return;
  }

  try {
    // Create analytics aggregation tables
    await sqlClient`
      CREATE TABLE IF NOT EXISTS ${sqlClient(ANALYTICS_TABLES.FUEL_ANALYTICS)} (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        total_locations INTEGER DEFAULT 0,
        total_tanks INTEGER DEFAULT 0,
        avg_fill_percentage DECIMAL(5,2) DEFAULT 0,
        low_fuel_count INTEGER DEFAULT 0,
        total_capacity DECIMAL(12,2) DEFAULT 0,
        total_volume DECIMAL(12,2) DEFAULT 0,
        consumption_rate DECIMAL(8,2) DEFAULT 0,
        system_efficiency DECIMAL(5,2) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(date)
      );
    `;

    await sqlClient`
      CREATE TABLE IF NOT EXISTS ${sqlClient(ANALYTICS_TABLES.DELIVERY_ANALYTICS)} (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        total_deliveries INTEGER DEFAULT 0,
        total_volume DECIMAL(12,2) DEFAULT 0,
        avg_delivery_size DECIMAL(8,2) DEFAULT 0,
        unique_customers INTEGER DEFAULT 0,
        unique_terminals INTEGER DEFAULT 0,
        carrier_breakdown JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(date)
      );
    `;

    await sqlClient`
      CREATE TABLE IF NOT EXISTS ${sqlClient(ANALYTICS_TABLES.PERFORMANCE_METRICS)} (
        id SERIAL PRIMARY KEY,
        metric_name VARCHAR(100) NOT NULL,
        value DECIMAL(12,4) NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL,
        source_system VARCHAR(50) NOT NULL,
        tags JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // Create time-series optimized tables
    await sqlClient`
      CREATE TABLE IF NOT EXISTS ${sqlClient(ANALYTICS_TABLES.DAILY_CONSUMPTION)} (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        location_id VARCHAR(100) NOT NULL,
        customer_name VARCHAR(200),
        consumption_litres DECIMAL(10,2) DEFAULT 0,
        fill_events INTEGER DEFAULT 0,
        avg_fill_percentage DECIMAL(5,2) DEFAULT 0,
        system_type VARCHAR(50), -- 'smartfill', 'agbot', 'manual'
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(date, location_id)
      );
    `;

    // Create indexes for performance
    await sqlClient`
      CREATE INDEX IF NOT EXISTS idx_fuel_analytics_date 
      ON ${sqlClient(ANALYTICS_TABLES.FUEL_ANALYTICS)} (date DESC);
    `;

    await sqlClient`
      CREATE INDEX IF NOT EXISTS idx_delivery_analytics_date 
      ON ${sqlClient(ANALYTICS_TABLES.DELIVERY_ANALYTICS)} (date DESC);
    `;

    await sqlClient`
      CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp 
      ON ${sqlClient(ANALYTICS_TABLES.PERFORMANCE_METRICS)} (timestamp DESC);
    `;

    await sqlClient`
      CREATE INDEX IF NOT EXISTS idx_performance_metrics_name 
      ON ${sqlClient(ANALYTICS_TABLES.PERFORMANCE_METRICS)} (metric_name, timestamp DESC);
    `;

    await sqlClient`
      CREATE INDEX IF NOT EXISTS idx_daily_consumption_date 
      ON ${sqlClient(ANALYTICS_TABLES.DAILY_CONSUMPTION)} (date DESC, location_id);
    `;

    console.log('[POSTGRES] Analytics database initialized successfully');
  } catch (error) {
    console.error('[POSTGRES] Failed to initialize analytics database:', error);
    throw error;
  }
}

/**
 * Store fuel analytics data
 */
export async function storeFuelAnalytics(data: Omit<FuelAnalytics, 'created_at' | 'updated_at'>): Promise<void> {
  const sqlClient = await getSQL();
  if (!sqlClient) return;

  try {
    await sqlClient`
      INSERT INTO ${sqlClient(ANALYTICS_TABLES.FUEL_ANALYTICS)} (
        date, total_locations, total_tanks, avg_fill_percentage, 
        low_fuel_count, total_capacity, total_volume, consumption_rate, system_efficiency
      ) VALUES (
        ${data.date}, ${data.total_locations}, ${data.total_tanks}, ${data.avg_fill_percentage},
        ${data.low_fuel_count}, ${data.total_capacity}, ${data.total_volume}, ${data.consumption_rate}, ${data.system_efficiency}
      )
      ON CONFLICT (date) DO UPDATE SET
        total_locations = EXCLUDED.total_locations,
        total_tanks = EXCLUDED.total_tanks,
        avg_fill_percentage = EXCLUDED.avg_fill_percentage,
        low_fuel_count = EXCLUDED.low_fuel_count,
        total_capacity = EXCLUDED.total_capacity,
        total_volume = EXCLUDED.total_volume,
        consumption_rate = EXCLUDED.consumption_rate,
        system_efficiency = EXCLUDED.system_efficiency,
        updated_at = NOW();
    `;
  } catch (error) {
    console.error('[POSTGRES] Failed to store fuel analytics:', error);
    throw error;
  }
}

/**
 * Store delivery analytics data
 */
export async function storeDeliveryAnalytics(data: Omit<DeliveryAnalytics, 'created_at' | 'updated_at'>): Promise<void> {
  const sqlClient = await getSQL();
  if (!sqlClient) return;

  try {
    await sqlClient`
      INSERT INTO ${sqlClient(ANALYTICS_TABLES.DELIVERY_ANALYTICS)} (
        date, total_deliveries, total_volume, avg_delivery_size, 
        unique_customers, unique_terminals, carrier_breakdown
      ) VALUES (
        ${data.date}, ${data.total_deliveries}, ${data.total_volume}, ${data.avg_delivery_size},
        ${data.unique_customers}, ${data.unique_terminals}, ${JSON.stringify(data.carrier_breakdown)}
      )
      ON CONFLICT (date) DO UPDATE SET
        total_deliveries = EXCLUDED.total_deliveries,
        total_volume = EXCLUDED.total_volume,
        avg_delivery_size = EXCLUDED.avg_delivery_size,
        unique_customers = EXCLUDED.unique_customers,
        unique_terminals = EXCLUDED.unique_terminals,
        carrier_breakdown = EXCLUDED.carrier_breakdown,
        updated_at = NOW();
    `;
  } catch (error) {
    console.error('[POSTGRES] Failed to store delivery analytics:', error);
    throw error;
  }
}

/**
 * Store performance metric
 */
export async function storePerformanceMetric(data: Omit<PerformanceMetrics, 'id' | 'created_at'>): Promise<void> {
  const sqlClient = await getSQL();
  if (!sqlClient) return;

  try {
    await sqlClient`
      INSERT INTO ${sqlClient(ANALYTICS_TABLES.PERFORMANCE_METRICS)} (
        metric_name, value, timestamp, source_system, tags
      ) VALUES (
        ${data.metric_name}, ${data.value}, ${data.timestamp}, ${data.source_system}, ${JSON.stringify(data.tags)}
      );
    `;
  } catch (error) {
    console.error('[POSTGRES] Failed to store performance metric:', error);
    throw error;
  }
}

/**
 * Get fuel analytics for date range
 */
export async function getFuelAnalytics(
  startDate: string, 
  endDate: string
): Promise<FuelAnalytics[]> {
  const sqlClient = await getSQL();
  if (!sqlClient) return [];

  try {
    const result = await sqlClient`
      SELECT * FROM ${sqlClient(ANALYTICS_TABLES.FUEL_ANALYTICS)}
      WHERE date >= ${startDate} AND date <= ${endDate}
      ORDER BY date DESC;
    `;
    
    return result.rows.map(row => ({
      date: row.date,
      total_locations: row.total_locations,
      total_tanks: row.total_tanks,
      avg_fill_percentage: parseFloat(row.avg_fill_percentage || '0'),
      low_fuel_count: row.low_fuel_count,
      total_capacity: parseFloat(row.total_capacity || '0'),
      total_volume: parseFloat(row.total_volume || '0'),
      consumption_rate: parseFloat(row.consumption_rate || '0'),
      system_efficiency: parseFloat(row.system_efficiency || '0')
    }));
  } catch (error) {
    console.error('[POSTGRES] Failed to get fuel analytics:', error);
    return [];
  }
}

/**
 * Get delivery analytics for date range
 */
export async function getDeliveryAnalytics(
  startDate: string, 
  endDate: string
): Promise<DeliveryAnalytics[]> {
  const sqlClient = await getSQL();
  if (!sqlClient) return [];

  try {
    const result = await sqlClient`
      SELECT * FROM ${sqlClient(ANALYTICS_TABLES.DELIVERY_ANALYTICS)}
      WHERE date >= ${startDate} AND date <= ${endDate}
      ORDER BY date DESC;
    `;
    
    return result.rows.map(row => ({
      date: row.date,
      total_deliveries: row.total_deliveries,
      total_volume: parseFloat(row.total_volume || '0'),
      avg_delivery_size: parseFloat(row.avg_delivery_size || '0'),
      unique_customers: row.unique_customers,
      unique_terminals: row.unique_terminals,
      carrier_breakdown: row.carrier_breakdown || {}
    }));
  } catch (error) {
    console.error('[POSTGRES] Failed to get delivery analytics:', error);
    return [];
  }
}

/**
 * Get performance metrics
 */
export async function getPerformanceMetrics(
  metricName?: string,
  startDate?: string,
  endDate?: string,
  limit: number = 100
): Promise<PerformanceMetrics[]> {
  const sqlClient = await getSQL();
  if (!sqlClient) return [];

  try {
    let query = sqlClient`
      SELECT * FROM ${sqlClient(ANALYTICS_TABLES.PERFORMANCE_METRICS)}
      WHERE 1=1
    `;

    if (metricName) {
      query = sqlClient`${query} AND metric_name = ${metricName}`;
    }

    if (startDate) {
      query = sqlClient`${query} AND timestamp >= ${startDate}`;
    }

    if (endDate) {
      query = sqlClient`${query} AND timestamp <= ${endDate}`;
    }

    query = sqlClient`${query} ORDER BY timestamp DESC LIMIT ${limit}`;

    const result = await query;
    
    return result.rows.map(row => ({
      metric_name: row.metric_name,
      value: parseFloat(row.value),
      timestamp: row.timestamp,
      source_system: row.source_system,
      tags: row.tags || {}
    }));
  } catch (error) {
    console.error('[POSTGRES] Failed to get performance metrics:', error);
    return [];
  }
}

/**
 * Get dashboard summary (optimized aggregated view)
 */
export async function getDashboardSummary(): Promise<{
  totalLocations: number;
  totalTanks: number;
  avgFillPercentage: number;
  lowFuelAlerts: number;
  dailyConsumption: number;
  totalDeliveries: number;
  systemEfficiency: number;
  lastUpdated: string;
}> {
  const sqlClient = await getSQL();
  if (!sqlClient) {
    return {
      totalLocations: 0,
      totalTanks: 0,
      avgFillPercentage: 0,
      lowFuelAlerts: 0,
      dailyConsumption: 0,
      totalDeliveries: 0,
      systemEfficiency: 0,
      lastUpdated: new Date().toISOString()
    };
  }

  try {
    // Get latest fuel analytics
    const fuelResult = await sqlClient`
      SELECT * FROM ${sqlClient(ANALYTICS_TABLES.FUEL_ANALYTICS)}
      ORDER BY date DESC LIMIT 1;
    `;

    // Get latest delivery analytics
    const deliveryResult = await sqlClient`
      SELECT * FROM ${sqlClient(ANALYTICS_TABLES.DELIVERY_ANALYTICS)}
      ORDER BY date DESC LIMIT 1;
    `;

    const fuelData = fuelResult.rows[0];
    const deliveryData = deliveryResult.rows[0];

    return {
      totalLocations: fuelData?.total_locations || 0,
      totalTanks: fuelData?.total_tanks || 0,
      avgFillPercentage: parseFloat(fuelData?.avg_fill_percentage || '0'),
      lowFuelAlerts: fuelData?.low_fuel_count || 0,
      dailyConsumption: parseFloat(fuelData?.consumption_rate || '0'),
      totalDeliveries: deliveryData?.total_deliveries || 0,
      systemEfficiency: parseFloat(fuelData?.system_efficiency || '0'),
      lastUpdated: fuelData?.updated_at || new Date().toISOString()
    };
  } catch (error) {
    console.error('[POSTGRES] Failed to get dashboard summary:', error);
    throw error;
  }
}

/**
 * Execute custom analytics query
 */
export async function executeCustomQuery(query: string, params: any[] = []): Promise<any[]> {
  const sqlClient = await getSQL();
  if (!sqlClient) return [];

  try {
    const result = await sqlClient.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('[POSTGRES] Custom query failed:', error);
    throw error;
  }
}

/**
 * Get analytics database health
 */
export async function getAnalyticsDBHealth(): Promise<{
  connected: boolean;
  recordCount: number;
  lastUpdate: string | null;
  error?: string;
}> {
  const sqlClient = await getSQL();
  if (!sqlClient) {
    return {
      connected: false,
      recordCount: 0,
      lastUpdate: null,
      error: 'Postgres client not available'
    };
  }

  try {
    // Test connection with a simple query
    const testResult = await sqlClient`SELECT NOW() as current_time`;
    
    // Get record counts
    const fuelCount = await sqlClient`
      SELECT COUNT(*) as count FROM ${sqlClient(ANALYTICS_TABLES.FUEL_ANALYTICS)}
    `;
    
    const deliveryCount = await sqlClient`
      SELECT COUNT(*) as count FROM ${sqlClient(ANALYTICS_TABLES.DELIVERY_ANALYTICS)}
    `;
    
    // Get last update time
    const lastUpdateResult = await sqlClient`
      SELECT MAX(updated_at) as last_update 
      FROM ${sqlClient(ANALYTICS_TABLES.FUEL_ANALYTICS)}
    `;

    return {
      connected: true,
      recordCount: parseInt(fuelCount.rows[0]?.count || '0') + parseInt(deliveryCount.rows[0]?.count || '0'),
      lastUpdate: lastUpdateResult.rows[0]?.last_update || null
    };
  } catch (error) {
    return {
      connected: false,
      recordCount: 0,
      lastUpdate: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Clean up old analytics data
 */
export async function cleanupOldAnalytics(daysToKeep: number = 365): Promise<{
  deletedRecords: number;
  error?: string;
}> {
  const sqlClient = await getSQL();
  if (!sqlClient) {
    return { deletedRecords: 0, error: 'Postgres client not available' };
  }

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    let deletedRecords = 0;

    // Clean up old performance metrics (keep less time)
    const metricsResult = await sqlClient`
      DELETE FROM ${sqlClient(ANALYTICS_TABLES.PERFORMANCE_METRICS)}
      WHERE timestamp < ${cutoffDateStr}
    `;
    deletedRecords += metricsResult.count || 0;

    // Clean up old daily consumption data
    const consumptionResult = await sqlClient`
      DELETE FROM ${sqlClient(ANALYTICS_TABLES.DAILY_CONSUMPTION)}
      WHERE date < ${cutoffDateStr}
    `;
    deletedRecords += consumptionResult.count || 0;

    return { deletedRecords };
  } catch (error) {
    return {
      deletedRecords: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}