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
  startDate?: Date;
  endDate?: Date;
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
    .order('delivery_date', { ascending: false })
    .order('bill_of_lading');

  // Apply carrier filter
  if (filters?.carrier && filters.carrier !== 'all') {
    query = query.eq('carrier', filters.carrier);
  }

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
  let query = supabase
    .from('secure_captive_deliveries') // Use security barrier view
    .select('*')
    .order('delivery_date', { ascending: false })
    .order('bill_of_lading');

  // Apply carrier filter
  if (filters?.carrier && filters.carrier !== 'all') {
    query = query.eq('carrier', filters.carrier);
  }

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
    throw error;
  }

  return data || [];
}

/**
 * Get monthly analytics with filters
 */
export async function getMonthlyAnalytics(filters?: CaptivePaymentsFilters): Promise<MonthlyAnalytics[]> {
  let query = supabase
    .from('secure_captive_monthly_analytics')
    .select('*')
    .order('month_start', { ascending: false });

  // Apply carrier filter
  if (filters?.carrier && filters.carrier !== 'all') {
    query = query.eq('carrier', filters.carrier);
  }

  // Apply date range filters (filter by month_start)
  if (filters?.startDate) {
    const startMonth = new Date(filters.startDate.getFullYear(), filters.startDate.getMonth(), 1);
    query = query.gte('month_start', startMonth.toISOString());
  }
  if (filters?.endDate) {
    const endMonth = new Date(filters.endDate.getFullYear(), filters.endDate.getMonth() + 1, 0);
    query = query.lte('month_start', endMonth.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching monthly analytics:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get customer analytics with filters
 */
export async function getCustomerAnalytics(filters?: CaptivePaymentsFilters): Promise<CustomerAnalytics[]> {
  let query = supabase
    .from('secure_captive_customer_analytics')
    .select('*')
    .order('total_volume_litres', { ascending: false });

  // Apply carrier filter
  if (filters?.carrier && filters.carrier !== 'all') {
    query = query.eq('carrier', filters.carrier);
  }

  // Apply customer filter
  if (filters?.customer) {
    query = query.ilike('customer', `%${filters.customer}%`);
  }

  const { data, error } = await query.limit(50); // Limit to top 50 customers

  if (error) {
    console.error('Error fetching customer analytics:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get terminal analytics with filters
 */
export async function getTerminalAnalytics(filters?: CaptivePaymentsFilters): Promise<TerminalAnalytics[]> {
  let query = supabase
    .from('secure_captive_terminal_analytics')
    .select('*')
    .order('total_volume_litres', { ascending: false });

  // Apply carrier filter
  if (filters?.carrier && filters.carrier !== 'all') {
    query = query.eq('carrier', filters.carrier);
  }

  // Apply terminal filter
  if (filters?.terminal) {
    query = query.eq('terminal', filters.terminal);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching terminal analytics:', error);
    throw error;
  }

  return data || [];
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