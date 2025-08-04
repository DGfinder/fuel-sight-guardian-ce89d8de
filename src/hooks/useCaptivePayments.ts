/**
 * CAPTIVE PAYMENTS HOOKS
 * 
 * React Query hooks for captive payments data
 * Provides caching, error handling, and loading states
 * Replaces manual state management with proper data fetching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCaptivePaymentRecords,
  getCaptiveDeliveries,
  getMonthlyAnalytics,
  getCustomerAnalytics,
  getTerminalAnalytics,
  getCaptivePaymentsSummary,
  getAvailableDateRange,
  getCaptiveFilterOptions,
  refreshCaptiveAnalytics,
  insertCaptivePaymentRecords,
  convertToBOLDeliveries,
  type CaptivePaymentsFilters,
  type CaptivePaymentRecord,
  type CaptiveDelivery,
  type MonthlyAnalytics,
  type CustomerAnalytics,
  type TerminalAnalytics
} from '@/api/captivePayments';

// =====================================================
// QUERY HOOKS
// =====================================================

/**
 * Hook to get captive payment records with filters
 */
export function useCaptivePaymentRecords(filters?: CaptivePaymentsFilters) {
  return useQuery({
    queryKey: ['captive-payment-records', filters],
    queryFn: () => getCaptivePaymentRecords(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime)
    enabled: true, // Always enabled, RLS will handle permissions
    retry: (failureCount, error) => {
      // Don't retry on permission errors
      if (error && 'code' in error && error.code === 'PGRST116') {
        return false;
      }
      return failureCount < 3;
    }
  });
}

/**
 * Hook to get captive deliveries (BOL-grouped) with filters
 */
export function useCaptiveDeliveries(filters?: CaptivePaymentsFilters) {
  return useQuery({
    queryKey: ['captive-deliveries', filters],
    queryFn: () => getCaptiveDeliveries(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: true,
    retry: (failureCount, error) => {
      if (error && 'code' in error && error.code === 'PGRST116') {
        return false;
      }
      return failureCount < 3;
    }
  });
}

/**
 * Hook to get BOL deliveries in the format expected by BOLDeliveryTable component
 */
export function useBOLDeliveries(filters?: CaptivePaymentsFilters) {
  const { data: deliveries, ...rest } = useCaptiveDeliveries(filters);
  
  return {
    data: deliveries ? convertToBOLDeliveries(deliveries) : undefined,
    ...rest
  };
}

/**
 * Hook to get monthly analytics with filters
 */
export function useMonthlyAnalytics(filters?: CaptivePaymentsFilters) {
  return useQuery({
    queryKey: ['captive-monthly-analytics', filters],
    queryFn: () => getMonthlyAnalytics(filters),
    staleTime: 10 * 60 * 1000, // 10 minutes (analytics change less frequently)
    gcTime: 30 * 60 * 1000, // 30 minutes
    enabled: true
  });
}

/**
 * Hook to get customer analytics with filters
 */
export function useCustomerAnalytics(filters?: CaptivePaymentsFilters) {
  return useQuery({
    queryKey: ['captive-customer-analytics', filters],
    queryFn: () => getCustomerAnalytics(filters),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    enabled: true
  });
}

/**
 * Hook to get terminal analytics with filters
 */
export function useTerminalAnalytics(filters?: CaptivePaymentsFilters) {
  return useQuery({
    queryKey: ['captive-terminal-analytics', filters],
    queryFn: () => getTerminalAnalytics(filters),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    enabled: true
  });
}

/**
 * Hook to get comprehensive captive payments summary
 * This replaces the old ProcessedCaptiveData structure
 */
export function useCaptivePaymentsSummary(filters?: CaptivePaymentsFilters) {
  return useQuery({
    queryKey: ['captive-payments-summary', filters],
    queryFn: () => getCaptivePaymentsSummary(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: true,
    retry: (failureCount, error) => {
      if (error && 'code' in error && error.code === 'PGRST116') {
        return false;
      }
      return failureCount < 3;
    }
  });
}

/**
 * Hook to get available date range for date filters
 */
export function useAvailableDateRange() {
  return useQuery({
    queryKey: ['captive-available-date-range'],
    queryFn: getAvailableDateRange,
    staleTime: 60 * 60 * 1000, // 1 hour (rarely changes)
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
    enabled: true
  });
}

/**
 * Hook to get filter options for dropdowns
 */
export function useCaptiveFilterOptions() {
  return useQuery({
    queryKey: ['captive-filter-options'],
    queryFn: getCaptiveFilterOptions,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    enabled: true
  });
}

// =====================================================
// CARRIER-SPECIFIC HOOKS
// =====================================================

/**
 * Hook to get SMB-specific data
 */
export function useSMBData(filters?: Omit<CaptivePaymentsFilters, 'carrier'>) {
  return useCaptivePaymentsSummary({ ...filters, carrier: 'SMB' });
}

/**
 * Hook to get GSF-specific data
 */
export function useGSFData(filters?: Omit<CaptivePaymentsFilters, 'carrier'>) {
  return useCaptivePaymentsSummary({ ...filters, carrier: 'GSF' });
}

/**
 * Hook to get combined carrier data
 */
export function useCombinedData(filters?: Omit<CaptivePaymentsFilters, 'carrier'>) {
  return useCaptivePaymentsSummary({ ...filters, carrier: 'Combined' });
}

/**
 * Hook to get all carrier data in parallel (for dashboard)
 */
export function useAllCarrierData(filters?: Omit<CaptivePaymentsFilters, 'carrier'>) {
  const smbQuery = useSMBData(filters);
  const gsfQuery = useGSFData(filters);
  const combinedQuery = useCombinedData(filters);

  return {
    smbData: smbQuery.data,
    gsfData: gsfQuery.data,
    combinedData: combinedQuery.data,
    isLoading: smbQuery.isLoading || gsfQuery.isLoading || combinedQuery.isLoading,
    error: smbQuery.error || gsfQuery.error || combinedQuery.error,
    isError: smbQuery.isError || gsfQuery.isError || combinedQuery.isError
  };
}

// =====================================================
// MUTATION HOOKS
// =====================================================

/**
 * Hook to refresh materialized views
 */
export function useRefreshCaptiveAnalytics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: refreshCaptiveAnalytics,
    onSuccess: () => {
      // Invalidate all captive payments queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['captive-'] });
      console.log('Captive payments analytics refreshed successfully');
    },
    onError: (error) => {
      console.error('Failed to refresh captive payments analytics:', error);
    }
  });
}

/**
 * Hook to insert new captive payment records
 */
export function useInsertCaptivePaymentRecords() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: insertCaptivePaymentRecords,
    onSuccess: () => {
      // Invalidate all captive payments queries
      queryClient.invalidateQueries({ queryKey: ['captive-'] });
      console.log('Captive payment records inserted successfully');
    },
    onError: (error) => {
      console.error('Failed to insert captive payment records:', error);
    }
  });
}

// =====================================================
// UTILITY HOOKS
// =====================================================

/**
 * Hook to get processing statistics
 */
export function useCaptiveProcessingStats() {
  const { data: summary } = useCaptivePaymentsSummary();
  
  if (!summary) return null;

  return {
    totalRecords: summary.deliveries.length,
    totalDeliveries: summary.totalDeliveries,
    totalVolume: summary.totalVolumeLitres,
    totalVolumeMegaLitres: summary.totalVolumeMegaLitres,
    averageDeliverySize: summary.averageDeliverySize,
    uniqueCustomers: summary.uniqueCustomers,
    uniqueTerminals: summary.uniqueTerminals,
    dateRange: summary.dateRange,
    monthsCovered: summary.dateRange.monthsCovered
  };
}

/**
 * Hook to check if data exists (for migration status)
 */
export function useCaptiveDataExists() {
  return useQuery({
    queryKey: ['captive-data-exists'],
    queryFn: async () => {
      const { count } = await import('@/lib/supabase').then(({ supabase }) => 
        supabase
          .from('captive_payment_records')
          .select('*', { count: 'exact', head: true })
      );
      return (count || 0) > 0;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: true
  });
}

// =====================================================
// BACKWARD COMPATIBILITY HELPERS
// =====================================================

/**
 * Hook to maintain compatibility with old CSV-based data structure
 * Returns data in the same format as the old processCaptivePaymentsData function
 */
export function useLegacyCaptiveData(filters?: CaptivePaymentsFilters) {
  const { data: summary, ...rest } = useCaptivePaymentsSummary(filters);

  if (!summary) return { data: undefined, ...rest };

  // Transform to match old ProcessedCaptiveData interface
  const legacyData = {
    rawRecords: summary.deliveries.map(delivery => ({
      date: delivery.delivery_date,
      billOfLading: delivery.bill_of_lading,
      location: delivery.terminal,
      customer: delivery.customer,
      product: delivery.products.join(', '), // Join multiple products
      volume: delivery.total_volume_litres
    })),
    monthlyData: summary.monthlyData.map(month => ({
      month: month.month_name,
      year: month.year,
      deliveries: month.total_deliveries,
      volumeLitres: month.total_volume_litres,
      volumeMegaLitres: month.total_volume_megalitres
    })),
    totalVolumeLitres: summary.totalVolumeLitres,
    totalVolumeMegaLitres: summary.totalVolumeMegaLitres,
    totalDeliveries: summary.totalDeliveries,
    uniqueCustomers: summary.uniqueCustomers,
    terminals: summary.terminalAnalysis.map(t => t.terminal),
    products: [...new Set(summary.deliveries.flatMap(d => d.products))],
    dateRange: summary.dateRange,
    averageDeliverySize: summary.averageDeliverySize,
    topCustomers: summary.topCustomers.map(customer => ({
      name: customer.customer,
      deliveries: customer.total_deliveries,
      volumeLitres: customer.total_volume_litres,
      volumeMegaLitres: customer.total_volume_megalitres
    })),
    terminalAnalysis: summary.terminalAnalysis.map(terminal => ({
      terminal: terminal.terminal,
      deliveries: terminal.total_deliveries,
      volumeLitres: terminal.total_volume_litres,
      percentage: terminal.percentage_of_carrier_volume
    })),
    productMix: [], // Would need separate query for this
    peakMonth: summary.peakMonth
  };

  return { data: legacyData, ...rest };
}