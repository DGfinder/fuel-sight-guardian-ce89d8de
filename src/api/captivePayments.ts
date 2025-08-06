/**
 * CAPTIVE PAYMENTS API
 * 
 * Supabase API functions for captive payments data
 * Replaces CSV file processing with database queries
 * Implements proper caching, filtering, and permission-based access
 */

import { supabase } from '@/lib/supabase';

// Type definitions matching database schema
export interface CaptivePaymentRecord {
  id: string;
  bill_of_lading: string;
  delivery_date: string;
  terminal: string;
  customer: string;
  product: string;
  volume_litres: number;
  carrier: 'SMB' | 'GSF' | 'Combined';
  raw_location?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  source_file?: string;
  import_batch_id?: string;
}

export interface CaptiveDelivery {
  bill_of_lading: string;
  delivery_date: string;
  customer: string;
  terminal: string;
  carrier: 'SMB' | 'GSF' | 'Combined';
  products: string[];
  total_volume_litres: number;
  total_volume_litres_abs: number;
  record_count: number;
  first_created_at: string;
  last_updated_at: string;
  delivery_key: string;
}

export interface MonthlyAnalytics {
  month_start: string;
  year: number;
  month: number;
  month_name: string;
  carrier: 'SMB' | 'GSF' | 'Combined';
  total_deliveries: number;
  total_volume_litres: number;
  total_volume_megalitres: number;
  unique_customers: number;
  unique_terminals: number;
  avg_delivery_size_litres: number;
}

export interface CustomerAnalytics {
  customer: string;
  carrier: 'SMB' | 'GSF' | 'Combined';
  total_deliveries: number;
  total_volume_litres: number;
  total_volume_megalitres: number;
  first_delivery_date: string;
  last_delivery_date: string;
  terminals_served: number;
  terminals_list: string[];
  deliveries_last_30_days: number;
}

export interface TerminalAnalytics {
  terminal: string;
  carrier: 'SMB' | 'GSF' | 'Combined';
  total_deliveries: number;
  total_volume_litres: number;
  total_volume_megalitres: number;
  percentage_of_carrier_volume: number;
  unique_customers: number;
  first_delivery_date: string;
  last_delivery_date: string;
  deliveries_last_30_days: number;
}

// Filter interface
export interface CaptivePaymentsFilters {
  carrier?: 'SMB' | 'GSF' | 'Combined' | 'all';
  startDate?: Date | null;
  endDate?: Date | null;
  terminal?: string;
  customer?: string;
  product?: string;
}

// =====================================================
// CORE DATA FETCHING FUNCTIONS
// =====================================================

/**
 * Get captive payment records with filters
 */
export async function getCaptivePaymentRecords(filters?: CaptivePaymentsFilters): Promise<CaptivePaymentRecord[]> {
  let query = supabase
    .from('captive_payment_records')
    .select('*')
    .range(0, 100000) // Override default 1000 limit - get all raw records
    .order('delivery_date', { ascending: false })
    .order('bill_of_lading');

  // Apply carrier filter
  if (filters?.carrier && filters.carrier !== 'all' && filters.carrier !== 'Combined') {
    query = query.eq('carrier', filters.carrier);
  }
  // Note: 'Combined' means show all carriers (SMB + GSF), so no filter applied

  // Apply date range filters
  if (filters?.startDate) {
    query = query.gte('delivery_date', filters.startDate.toISOString().split('T')[0]);
  }
  if (filters?.endDate) {
    query = query.lte('delivery_date', filters.endDate.toISOString().split('T')[0]);
  }

  // Apply other filters
  if (filters?.terminal) {
    query = query.eq('terminal', filters.terminal);
  }
  if (filters?.customer) {
    query = query.ilike('customer', filters.customer);
  }
  if (filters?.product) {
    query = query.eq('product', filters.product);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching captive payment records:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get captive deliveries (BOL-grouped data) with filters
 */
export async function getCaptiveDeliveries(filters?: CaptivePaymentsFilters): Promise<CaptiveDelivery[]> {
  // Direct access to materialized view - override Supabase 1000 row default limit
  let query = supabase
    .from('captive_deliveries')
    .select('*')
    .range(0, 30000) // Get up to 30,000 rows (covers all 23,756 deliveries)
    .order('delivery_date', { ascending: false })
    .order('bill_of_lading');

  // Apply carrier filter
  if (filters?.carrier && filters.carrier !== 'all' && filters.carrier !== 'Combined') {
    query = query.eq('carrier', filters.carrier);
  }
  // Note: 'Combined' means show all carriers (SMB + GSF), so no filter applied

  // Apply date range filters
  if (filters?.startDate) {
    query = query.gte('delivery_date', filters.startDate.toISOString().split('T')[0]);
  }
  if (filters?.endDate) {
    query = query.lte('delivery_date', filters.endDate.toISOString().split('T')[0]);
  }

  // Apply other filters
  if (filters?.terminal) {
    query = query.eq('terminal', filters.terminal);
  }
  if (filters?.customer) {
    query = query.ilike('customer', filters.customer);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching captive deliveries:', error);
    console.error('Query details:', { 
      table: 'captive_deliveries (direct access, no RLS)',
      filters: filters,
      carrier: filters?.carrier 
    });
    throw error;
  }

  console.log(`Fetched ${data?.length || 0} deliveries for carrier: ${filters?.carrier || 'all'} (range: 0-30000, RLS disabled)`);
  
  // Log if we hit the limit to help debug
  if (data && data.length >= 30000) {
    console.warn('Hit 30,000 row limit - may need to increase range');
  }
  
  return data || [];
}

/**
 * Get monthly analytics with filters
 */
export async function getMonthlyAnalytics(filters?: CaptivePaymentsFilters): Promise<MonthlyAnalytics[]> {
  // Get deliveries and compute monthly analytics on-the-fly
  const deliveries = await getCaptiveDeliveries(filters);
  
  const monthlyData = new Map<string, {
    month_start: string;
    year: number;
    month: number;
    month_name: string;
    carrier: 'SMB' | 'GSF' | 'Combined';
    total_deliveries: number;
    total_volume_litres: number;
    total_volume_megalitres: number;
    unique_customers: Set<string>;
    unique_terminals: Set<string>;
  }>();
  
  deliveries.forEach(delivery => {
    const date = new Date(delivery.delivery_date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const monthStart = `${year}-${month.toString().padStart(2, '0')}-01`;
    const monthName = date.toLocaleDateString('en-US', { month: 'long' });
    const key = `${monthStart}-${delivery.carrier}`;
    
    if (!monthlyData.has(key)) {
      monthlyData.set(key, {
        month_start: monthStart,
        year,
        month,
        month_name: monthName,
        carrier: delivery.carrier,
        total_deliveries: 0,
        total_volume_litres: 0,
        total_volume_megalitres: 0,
        unique_customers: new Set(),
        unique_terminals: new Set()
      });
    }
    
    const monthData = monthlyData.get(key)!;
    monthData.total_deliveries++;
    monthData.total_volume_litres += delivery.total_volume_litres_abs;
    monthData.total_volume_megalitres = monthData.total_volume_litres / 1000000;
    monthData.unique_customers.add(delivery.customer);
    monthData.unique_terminals.add(delivery.terminal);
  });
  
  return Array.from(monthlyData.values()).map(data => ({
    ...data,
    unique_customers: data.unique_customers.size,
    unique_terminals: data.unique_terminals.size,
    avg_delivery_size_litres: data.total_deliveries > 0 ? data.total_volume_litres / data.total_deliveries : 0
  } as MonthlyAnalytics)).sort((a, b) => b.month_start.localeCompare(a.month_start));
}

/**
 * Get customer analytics with filters
 */
export async function getCustomerAnalytics(filters?: CaptivePaymentsFilters): Promise<CustomerAnalytics[]> {
  // Get deliveries and compute customer analytics on-the-fly
  const deliveries = await getCaptiveDeliveries(filters);
  
  const customerData = new Map<string, {
    customer: string;
    carrier: 'SMB' | 'GSF' | 'Combined';
    total_deliveries: number;
    total_volume_litres: number;
    total_volume_megalitres: number;
    first_delivery_date: string;
    last_delivery_date: string;
    terminals_list: Set<string>;
    deliveries_last_30_days: number;
  }>();
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  deliveries.forEach(delivery => {
    const key = `${delivery.customer}-${delivery.carrier}`;
    
    if (!customerData.has(key)) {
      customerData.set(key, {
        customer: delivery.customer,
        carrier: delivery.carrier,
        total_deliveries: 0,
        total_volume_litres: 0,
        total_volume_megalitres: 0,
        first_delivery_date: delivery.delivery_date,
        last_delivery_date: delivery.delivery_date,
        terminals_list: new Set(),
        deliveries_last_30_days: 0
      });
    }
    
    const custData = customerData.get(key)!;
    custData.total_deliveries++;
    custData.total_volume_litres += delivery.total_volume_litres_abs;
    custData.total_volume_megalitres = custData.total_volume_litres / 1000000;
    
    if (delivery.delivery_date < custData.first_delivery_date) {
      custData.first_delivery_date = delivery.delivery_date;
    }
    if (delivery.delivery_date > custData.last_delivery_date) {
      custData.last_delivery_date = delivery.delivery_date;
    }
    
    custData.terminals_list.add(delivery.terminal);
    
    if (new Date(delivery.delivery_date) > thirtyDaysAgo) {
      custData.deliveries_last_30_days++;
    }
  });
  
  return Array.from(customerData.values()).map(data => ({
    ...data,
    terminals_served: data.terminals_list.size,
    terminals_list: Array.from(data.terminals_list)
  } as CustomerAnalytics)).sort((a, b) => b.total_volume_litres - a.total_volume_litres).slice(0, 50);
}

/**
 * Get terminal analytics with filters
 */
export async function getTerminalAnalytics(filters?: CaptivePaymentsFilters): Promise<TerminalAnalytics[]> {
  // Get deliveries and compute terminal analytics on-the-fly
  const deliveries = await getCaptiveDeliveries(filters);
  
  const terminalData = new Map<string, {
    terminal: string;
    carrier: 'SMB' | 'GSF' | 'Combined';
    total_deliveries: number;
    total_volume_litres: number;
    total_volume_megalitres: number;
    first_delivery_date: string;
    last_delivery_date: string;
    deliveries_last_30_days: number;
    customers: Set<string>;
  }>();
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // First pass: collect terminal data
  deliveries.forEach(delivery => {
    const key = `${delivery.terminal}-${delivery.carrier}`;
    
    if (!terminalData.has(key)) {
      terminalData.set(key, {
        terminal: delivery.terminal,
        carrier: delivery.carrier,
        total_deliveries: 0,
        total_volume_litres: 0,
        total_volume_megalitres: 0,
        first_delivery_date: delivery.delivery_date,
        last_delivery_date: delivery.delivery_date,
        deliveries_last_30_days: 0,
        customers: new Set()
      });
    }
    
    const termData = terminalData.get(key)!;
    termData.total_deliveries++;
    termData.total_volume_litres += delivery.total_volume_litres_abs;
    termData.total_volume_megalitres = termData.total_volume_litres / 1000000;
    termData.customers.add(delivery.customer);
    
    if (delivery.delivery_date < termData.first_delivery_date) {
      termData.first_delivery_date = delivery.delivery_date;
    }
    if (delivery.delivery_date > termData.last_delivery_date) {
      termData.last_delivery_date = delivery.delivery_date;
    }
    
    if (new Date(delivery.delivery_date) > thirtyDaysAgo) {
      termData.deliveries_last_30_days++;
    }
  });
  
  // Second pass: calculate carrier percentages
  const carrierTotals = new Map<string, number>();
  terminalData.forEach(data => {
    const current = carrierTotals.get(data.carrier) || 0;
    carrierTotals.set(data.carrier, current + data.total_volume_litres);
  });
  
  return Array.from(terminalData.values()).map(data => ({
    ...data,
    unique_customers: data.customers.size,
    percentage_of_carrier_volume: (data.total_volume_litres / (carrierTotals.get(data.carrier) || 1)) * 100
  } as TerminalAnalytics)).sort((a, b) => b.total_volume_litres - a.total_volume_litres);
}

// =====================================================
// AGGREGATED DATA FUNCTIONS
// =====================================================

/**
 * Get comprehensive captive payments summary
 */
export async function getCaptivePaymentsSummary(filters?: CaptivePaymentsFilters) {
  try {
    // Fetch all data in parallel
    const [deliveries, monthlyData, customerData, terminalData] = await Promise.all([
      getCaptiveDeliveries(filters),
      getMonthlyAnalytics(filters),
      getCustomerAnalytics(filters),
      getTerminalAnalytics(filters)
    ]);

    // Calculate summary metrics
    const totalDeliveries = deliveries.length;
    const totalVolumeLitres = deliveries.reduce((sum, d) => sum + d.total_volume_litres_abs, 0);
    const totalVolumeMegaLitres = totalVolumeLitres / 1000000;
    const uniqueCustomers = new Set(deliveries.map(d => d.customer)).size;
    const uniqueTerminals = new Set(deliveries.map(d => d.terminal)).size;
    const averageDeliverySize = totalDeliveries > 0 ? totalVolumeLitres / totalDeliveries : 0;

    // Date range
    const dates = deliveries.map(d => new Date(d.delivery_date)).sort((a, b) => a.getTime() - b.getTime());
    const startDate = dates.length > 0 ? dates[0] : new Date();
    const endDate = dates.length > 0 ? dates[dates.length - 1] : new Date();

    // Find peak month
    const peakMonth = monthlyData.reduce(
      (max, month) => month.total_volume_megalitres > max.total_volume_megalitres ? month : max,
      monthlyData[0] || { month_name: 'N/A', year: 0, total_volume_megalitres: 0 }
    );

    return {
      // Raw data
      deliveries,
      monthlyData,
      customerData,
      terminalData,
      
      // Summary metrics
      totalDeliveries,
      totalVolumeLitres,
      totalVolumeMegaLitres,
      uniqueCustomers,
      uniqueTerminals,
      averageDeliverySize,
      
      // Date range
      dateRange: {
        startDate: startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        endDate: endDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        monthsCovered: monthlyData.length
      },
      
      // Top performers
      topCustomers: customerData.slice(0, 10),
      terminalAnalysis: terminalData,
      peakMonth: {
        month: peakMonth.month_name,
        year: peakMonth.year,
        volumeMegaLitres: peakMonth.total_volume_megalitres
      }
    };
  } catch (error) {
    console.error('Error fetching captive payments summary:', error);
    throw error;
  }
}

/**
 * Get available date range for filters
 */
export async function getAvailableDateRange(): Promise<{ minDate: Date; maxDate: Date; totalRecords: number }> {
  const { data, error } = await supabase
    .from('captive_payment_records')
    .select('delivery_date')
    .order('delivery_date', { ascending: true })
    .limit(1);

  const { data: maxData, error: maxError } = await supabase
    .from('captive_payment_records')
    .select('delivery_date')
    .order('delivery_date', { ascending: false })
    .limit(1);

  const { count, error: countError } = await supabase
    .from('captive_payment_records')
    .select('*', { count: 'exact', head: true });

  if (error || maxError || countError) {
    console.error('Error fetching date range:', error || maxError || countError);
    const today = new Date();
    return { minDate: today, maxDate: today, totalRecords: 0 };
  }

  return {
    minDate: data && data.length > 0 ? new Date(data[0].delivery_date) : new Date(),
    maxDate: maxData && maxData.length > 0 ? new Date(maxData[0].delivery_date) : new Date(),
    totalRecords: count || 0
  };
}

// =====================================================
// TERMINAL-SPECIFIC ANALYTICS FUNCTIONS
// =====================================================

/**
 * Get monthly analytics for a specific terminal
 */
export async function getTerminalMonthlyAnalytics(terminalName: string, filters?: CaptivePaymentsFilters): Promise<MonthlyAnalytics[]> {
  const terminalFilters = { ...filters, terminal: terminalName };
  return await getMonthlyAnalytics(terminalFilters);
}

/**
 * Get customer analytics for a specific terminal
 */
export async function getTerminalCustomerAnalytics(terminalName: string, filters?: CaptivePaymentsFilters): Promise<CustomerAnalytics[]> {
  const terminalFilters = { ...filters, terminal: terminalName };
  return await getCustomerAnalytics(terminalFilters);
}

/**
 * Get deliveries for a specific terminal
 */
export async function getTerminalDeliveries(terminalName: string, filters?: CaptivePaymentsFilters): Promise<CaptiveDelivery[]> {
  const terminalFilters = { ...filters, terminal: terminalName };
  return await getCaptiveDeliveries(terminalFilters);
}

/**
 * Get comprehensive terminal analysis with detailed breakdown
 */
export async function getTerminalDetailedAnalytics(terminalName: string, filters?: CaptivePaymentsFilters) {
  try {
    const terminalFilters = { ...filters, terminal: terminalName };
    
    // Fetch all data in parallel
    const [deliveries, monthlyData, customerData] = await Promise.all([
      getCaptiveDeliveries(terminalFilters),
      getMonthlyAnalytics(terminalFilters),
      getCustomerAnalytics(terminalFilters)
    ]);

    // Calculate terminal-specific metrics
    const totalDeliveries = deliveries.length;
    const totalVolumeLitres = deliveries.reduce((sum, d) => sum + d.total_volume_litres_abs, 0);
    const totalVolumeMegaLitres = totalVolumeLitres / 1000000;
    const uniqueCustomers = new Set(deliveries.map(d => d.customer)).size;
    const averageDeliverySize = totalDeliveries > 0 ? totalVolumeLitres / totalDeliveries : 0;

    // Date range
    const dates = deliveries.map(d => new Date(d.delivery_date)).sort((a, b) => a.getTime() - b.getTime());
    const startDate = dates.length > 0 ? dates[0] : new Date();
    const endDate = dates.length > 0 ? dates[dates.length - 1] : new Date();

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentDeliveries = deliveries.filter(d => new Date(d.delivery_date) > thirtyDaysAgo).length;

    // Peak month analysis
    const peakMonth = monthlyData.reduce(
      (max, month) => month.total_volume_megalitres > max.total_volume_megalitres ? month : max,
      monthlyData[0] || { month_name: 'N/A', year: 0, total_volume_megalitres: 0, total_deliveries: 0 }
    );

    // Customer distribution analysis
    const topCustomers = customerData.slice(0, 10);
    const customerConcentration = topCustomers.length > 0 ? (topCustomers[0].total_volume_megalitres / totalVolumeMegaLitres) * 100 : 0;

    // Operational metrics
    const operatingDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const averageDeliveriesPerDay = operatingDays > 0 ? totalDeliveries / operatingDays : 0;
    const averageVolumePerDay = operatingDays > 0 ? totalVolumeMegaLitres / operatingDays : 0;

    // Calculate utilization score (based on recent activity and consistency)
    const utilizationScore = Math.min(100, Math.round(
      (recentDeliveries / Math.max(1, totalDeliveries / 12)) * 100
    ));

    return {
      // Raw data
      deliveries,
      monthlyData,
      customerData,
      
      // Summary metrics
      terminalName,
      totalDeliveries,
      totalVolumeLitres,
      totalVolumeMegaLitres,
      uniqueCustomers,
      averageDeliverySize,
      
      // Date range
      dateRange: {
        startDate: startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        endDate: endDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        operatingDays,
        monthsCovered: monthlyData.length
      },
      
      // Activity metrics
      recentActivity: {
        deliveries30Days: recentDeliveries,
        utilizationScore,
        averageDeliveriesPerDay: Math.round(averageDeliveriesPerDay * 10) / 10,
        averageVolumePerDay: Math.round(averageVolumePerDay * 100) / 100
      },
      
      // Peak performance
      peakMonth: {
        month: peakMonth.month_name,
        year: peakMonth.year,
        volumeMegaLitres: peakMonth.total_volume_megalitres,
        deliveries: peakMonth.total_deliveries
      },
      
      // Customer insights
      customerInsights: {
        topCustomers,
        topCustomerConcentration: Math.round(customerConcentration * 10) / 10,
        customerDiversity: uniqueCustomers / Math.max(1, totalDeliveries) * 100
      }
    };
  } catch (error) {
    console.error('Error fetching terminal detailed analytics:', error);
    throw error;
  }
}

/**
 * Compare terminal performance against other terminals
 */
export async function getTerminalBenchmarkAnalytics(terminalName: string, filters?: CaptivePaymentsFilters) {
  try {
    // Get all terminals for comparison
    const allTerminals = await getTerminalAnalytics(filters);
    const targetTerminal = allTerminals.find(t => t.terminal === terminalName);
    
    if (!targetTerminal) {
      throw new Error(`Terminal ${terminalName} not found`);
    }

    // Calculate rankings
    const sortedByVolume = [...allTerminals].sort((a, b) => b.total_volume_megalitres - a.total_volume_megalitres);
    const sortedByDeliveries = [...allTerminals].sort((a, b) => b.total_deliveries - a.total_deliveries);
    const sortedByCustomers = [...allTerminals].sort((a, b) => b.unique_customers - a.unique_customers);
    const sortedByEfficiency = [...allTerminals].sort((a, b) => {
      const aEfficiency = a.total_volume_litres / a.total_deliveries;
      const bEfficiency = b.total_volume_litres / b.total_deliveries;
      return bEfficiency - aEfficiency;
    });

    const volumeRank = sortedByVolume.findIndex(t => t.terminal === terminalName) + 1;
    const deliveryRank = sortedByDeliveries.findIndex(t => t.terminal === terminalName) + 1;
    const customerRank = sortedByCustomers.findIndex(t => t.terminal === terminalName) + 1;
    const efficiencyRank = sortedByEfficiency.findIndex(t => t.terminal === terminalName) + 1;

    // Calculate averages for benchmarking
    const avgVolume = allTerminals.reduce((sum, t) => sum + t.total_volume_megalitres, 0) / allTerminals.length;
    const avgDeliveries = allTerminals.reduce((sum, t) => sum + t.total_deliveries, 0) / allTerminals.length;
    const avgCustomers = allTerminals.reduce((sum, t) => sum + t.unique_customers, 0) / allTerminals.length;
    const avgDeliverySize = allTerminals.reduce((sum, t) => sum + (t.total_volume_litres / t.total_deliveries), 0) / allTerminals.length;

    return {
      terminal: targetTerminal,
      rankings: {
        volumeRank,
        deliveryRank,
        customerRank,
        efficiencyRank,
        totalTerminals: allTerminals.length
      },
      benchmarks: {
        volume: {
          terminal: targetTerminal.total_volume_megalitres,
          average: Math.round(avgVolume * 100) / 100,
          percentile: ((allTerminals.length - volumeRank + 1) / allTerminals.length) * 100
        },
        deliveries: {
          terminal: targetTerminal.total_deliveries,
          average: Math.round(avgDeliveries),
          percentile: ((allTerminals.length - deliveryRank + 1) / allTerminals.length) * 100
        },
        customers: {
          terminal: targetTerminal.unique_customers,
          average: Math.round(avgCustomers),
          percentile: ((allTerminals.length - customerRank + 1) / allTerminals.length) * 100
        },
        deliverySize: {
          terminal: Math.round(targetTerminal.total_volume_litres / targetTerminal.total_deliveries),
          average: Math.round(avgDeliverySize),
          percentile: ((allTerminals.length - efficiencyRank + 1) / allTerminals.length) * 100
        }
      },
      competitorAnalysis: {
        topPerformer: sortedByVolume[0],
        closestCompetitor: sortedByVolume.find(t => t.terminal !== terminalName) || null,
        marketShare: targetTerminal.percentage_of_carrier_volume
      }
    };
  } catch (error) {
    console.error('Error fetching terminal benchmark analytics:', error);
    throw error;
  }
}

// =====================================================
// ROLLBACK AND DATA MANAGEMENT FUNCTIONS
// =====================================================

/**
 * Delete captive payment records by import batch ID
 */
export async function deleteCaptivePaymentBatch(batchId: string): Promise<{ deletedCount: number }> {
  const { data, error } = await supabase
    .from('captive_payment_records')
    .delete()
    .eq('import_batch_id', batchId)
    .select('id');

  if (error) {
    console.error('Error deleting captive payment batch:', error);
    throw error;
  }

  return { deletedCount: data?.length || 0 };
}

/**
 * Delete captive payment records by source filename
 */
export async function deleteCaptivePaymentsByFile(filename: string): Promise<{ deletedCount: number }> {
  const { data, error } = await supabase
    .from('captive_payment_records')
    .delete()
    .eq('source_file', filename)
    .select('id');

  if (error) {
    console.error('Error deleting captive payment records by file:', error);
    throw error;
  }

  return { deletedCount: data?.length || 0 };
}

/**
 * Get import batch history with metadata
 */
export async function getImportBatches(): Promise<Array<{
  import_batch_id: string;
  source_file: string;
  carrier: string;
  created_by: string;
  created_at: string;
  record_count: number;
  date_range: {
    min_date: string;
    max_date: string;
  };
}>> {
  const { data, error } = await supabase
    .from('captive_payment_records')
    .select(`
      import_batch_id,
      source_file,
      carrier,
      created_by,
      created_at,
      delivery_date
    `)
    .not('import_batch_id', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching import batches:', error);
    throw error;
  }

  if (!data) return [];

  // Group by batch and calculate metadata
  const batchMap = new Map();
  
  data.forEach(record => {
    const batchId = record.import_batch_id;
    if (!batchMap.has(batchId)) {
      batchMap.set(batchId, {
        import_batch_id: batchId,
        source_file: record.source_file || 'Unknown',
        carrier: record.carrier,
        created_by: record.created_by || 'Unknown',
        created_at: record.created_at,
        record_count: 0,
        dates: []
      });
    }
    
    const batch = batchMap.get(batchId);
    batch.record_count++;
    batch.dates.push(record.delivery_date);
  });

  return Array.from(batchMap.values()).map(batch => {
    const sortedDates = batch.dates.sort();
    return {
      import_batch_id: batch.import_batch_id,
      source_file: batch.source_file,
      carrier: batch.carrier,
      created_by: batch.created_by,
      created_at: batch.created_at,
      record_count: batch.record_count,
      date_range: {
        min_date: sortedDates[0],
        max_date: sortedDates[sortedDates.length - 1]
      }
    };
  });
}

/**
 * Check for duplicate imports by filename
 */
export async function checkDuplicateImport(filename: string): Promise<{
  exists: boolean;
  existingImport?: {
    import_batch_id: string;
    created_at: string;
    created_by: string;
    record_count: number;
  };
}> {
  const { data, error } = await supabase
    .from('captive_payment_records')
    .select('import_batch_id, created_at, created_by')
    .eq('source_file', filename)
    .limit(1);

  if (error) {
    console.error('Error checking duplicate import:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    return { exists: false };
  }

  // Get record count for this batch
  const { count } = await supabase
    .from('captive_payment_records')
    .select('*', { count: 'exact', head: true })
    .eq('import_batch_id', data[0].import_batch_id);

  return {
    exists: true,
    existingImport: {
      import_batch_id: data[0].import_batch_id,
      created_at: data[0].created_at,
      created_by: data[0].created_by || 'Unknown',
      record_count: count || 0
    }
  };
}

/**
 * Enhanced insert function with batch tracking and validation
 */
export async function insertCaptivePaymentBatch(
  records: Omit<CaptivePaymentRecord, 'id' | 'created_at' | 'updated_at'>[], 
  batchMetadata: {
    import_batch_id: string;
    source_file: string;
    created_by: string;
  }
): Promise<{ insertedCount: number; batchId: string }> {
  // Add batch metadata to all records
  const recordsWithBatch = records.map(record => ({
    ...record,
    import_batch_id: batchMetadata.import_batch_id,
    source_file: batchMetadata.source_file,
    created_by: batchMetadata.created_by
  }));

  const { data, error } = await supabase
    .from('captive_payment_records')
    .insert(recordsWithBatch)
    .select('id');

  if (error) {
    console.error('Error inserting captive payment batch:', error);
    throw error;
  }

  return { 
    insertedCount: data?.length || 0, 
    batchId: batchMetadata.import_batch_id 
  };
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Refresh materialized views (admin only)
 */
export async function refreshCaptiveAnalytics(): Promise<void> {
  const { error } = await supabase.rpc('refresh_captive_analytics');
  
  if (error) {
    console.error('Error refreshing captive analytics:', error);
    throw error;
  }
}

/**
 * Get unique values for filter dropdowns
 */
export async function getCaptiveFilterOptions(): Promise<{
  terminals: string[];
  customers: string[];
  products: string[];
  carriers: string[];
}> {
  const { data, error } = await supabase
    .from('captive_payment_records')
    .select('terminal, customer, product, carrier');

  if (error) {
    console.error('Error fetching filter options:', error);
    throw error;
  }

  const terminals = [...new Set(data.map(r => r.terminal))].sort();
  const customers = [...new Set(data.map(r => r.customer))].sort();
  const products = [...new Set(data.map(r => r.product))].sort();
  const carriers = [...new Set(data.map(r => r.carrier))].sort();

  return { terminals, customers, products, carriers };
}

/**
 * Insert new captive payment records (for data imports)
 */
export async function insertCaptivePaymentRecords(records: Omit<CaptivePaymentRecord, 'id' | 'created_at' | 'updated_at' | 'created_by'>[]): Promise<void> {
  const { error } = await supabase
    .from('captive_payment_records')
    .insert(records);

  if (error) {
    console.error('Error inserting captive payment records:', error);
    throw error;
  }
}

// =====================================================
// BOL DELIVERY CONVERSION FUNCTIONS
// =====================================================

/**
 * Convert CaptiveDelivery[] to BOLDelivery[] format for compatibility with existing components
 */
export function convertToBOLDeliveries(deliveries: CaptiveDelivery[]): Array<{
  bolNumber: string;
  carrier: 'SMB' | 'GSF' | 'Combined';
  terminal: string;
  customer: string;
  products: string[];
  totalQuantity: number;
  deliveryDate: string;
  driverName: string;
  vehicleId: string;
  recordCount: number;
}> {
  return deliveries.map(delivery => ({
    bolNumber: delivery.bill_of_lading,
    carrier: delivery.carrier,
    terminal: delivery.terminal,
    customer: delivery.customer,
    products: delivery.products || [],
    totalQuantity: delivery.total_volume_litres,
    deliveryDate: delivery.delivery_date,
    driverName: 'N/A', // Not available in database
    vehicleId: 'N/A',  // Not available in database
    recordCount: delivery.record_count
  }));
}