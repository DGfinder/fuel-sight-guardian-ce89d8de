/**
 * CAPTIVE PAYMENTS TYPES
 * 
 * Consolidated TypeScript interfaces for captive payments functionality
 * Re-exports from API layer and adds component-specific types
 */

// Re-export core API types
export type {
  CaptivePaymentRecord,
  CaptiveDelivery,
  MonthlyAnalytics,
  CustomerAnalytics,
  TerminalAnalytics,
  CaptivePaymentsFilters
} from '@/api/captivePayments';

// =====================================================
// COMPONENT-SPECIFIC TYPES
// =====================================================

/**
 * Dashboard summary data - simplified version of API response
 */
export interface DashboardSummary {
  // Core metrics
  totalDeliveries: number;
  totalVolumeLitres: number;
  totalVolumeMegaLitres: number;
  uniqueCustomers: number;
  uniqueTerminals: number;
  averageDeliverySize: number;
  
  // Date range info
  dateRange: {
    startDate: string;
    endDate: string;
    monthsCovered: number;
  };
  
  // Analysis data
  monthlyData: MonthlyAnalytics[];
  topCustomers: CustomerAnalytics[];
  terminalAnalysis: TerminalAnalytics[];
  
  // Peak performance
  peakMonth: {
    month: string;
    year: number;
    volumeMegaLitres: number;
  };
}

/**
 * Chart data for delivery trends
 */
export interface DeliveryTrendData {
  month: string;
  year?: number;
  smbDeliveries: number;
  gsfDeliveries: number;
  totalDeliveries: number;
  smbVolume: number;
  gsfVolume: number;
  totalVolume: number;
}

/**
 * BOL Delivery interface for table component
 */
export interface BOLDelivery {
  bolNumber: string;
  carrier: 'SMB' | 'GSF';
  terminal: string;
  customer: string;
  products: string[];
  totalQuantity: number;
  deliveryDate: string;
  driverName: string;
  vehicleId: string;
  recordCount: number;
}

/**
 * Filter state for components
 */
export interface DashboardFilters {
  startDate: Date | null;
  endDate: Date | null;
  carrier?: 'SMB' | 'GSF' | 'Combined' | 'all';
  terminal?: string;
  customer?: string;
}

/**
 * Date range for filter components
 */
export interface DateRange {
  minDate: Date;
  maxDate: Date;
  totalRecords: number;
}

/**
 * Loading state interface
 */
export interface LoadingState {
  isLoading: boolean;
  error: Error | null;
}

/**
 * Terminal performance metrics
 */
export interface TerminalPerformance {
  terminal: string;
  totalDeliveries: number;
  totalVolumeLitres: number;
  totalVolumeMegaLitres: number;
  percentage: number;
  uniqueCustomers: number;
}

/**
 * Customer performance metrics
 */
export interface CustomerPerformance {
  customer: string;
  totalDeliveries: number;
  totalVolumeLitres: number;
  totalVolumeMegaLitres: number;
  terminalsServed: number;
  lastDeliveryDate: string;
}

/**
 * Monthly trend data
 */
export interface MonthlyTrend {
  monthName: string;
  year: number;
  totalDeliveries: number;
  totalVolumeLitres: number;
  totalVolumeMegaLitres: number;
  uniqueCustomers: number;
}

// =====================================================
// UTILITY TYPES
// =====================================================

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  isError: boolean;
}

/**
 * Color scheme for charts
 */
export const CHART_COLORS = {
  SMB: '#3b82f6', // Blue
  GSF: '#10b981', // Green
  Combined: '#f59e0b', // Amber
  Warning: '#ef4444', // Red
  Neutral: '#6b7280' // Gray
} as const;

/**
 * Common chart data point
 */
export interface ChartDataPoint {
  name: string;
  value: number;
  color?: string;
  percentage?: number;
}