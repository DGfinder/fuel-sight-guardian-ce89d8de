/**
 * Admin CRUD Types
 * TypeScript interfaces for Fuel Management admin module
 */

// Tank Group
export interface TankGroup {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  tank_count?: number;
}

export interface TankGroupFormData {
  name: string;
  description?: string;
}

// Fuel Tank
export interface FuelTank {
  id: string;
  group_id: string;
  location: string;
  subgroup: string | null;
  safe_level: number;
  current_level: number;
  min_level: number;
  product_type: ProductType;
  rolling_avg: number | null;
  days_to_min_level: number | null;
  last_dip_date: string | null;
  last_dip_by: string | null;
  status: TankStatus;
  created_at: string;
  updated_at: string;
  // Joined fields
  group_name?: string;
}

export type ProductType = 'Diesel' | 'ULP' | 'ULP98' | 'ADF';
export type TankStatus = 'active' | 'archived' | 'decommissioned';

export interface FuelTankFormData {
  location: string;
  group_id: string;
  subgroup?: string;
  product_type: ProductType;
  safe_level: number;
  min_level: number;
  status: TankStatus;
}

// Dip Reading
export interface DipReading {
  id: string;
  tank_id: string;
  value: number;
  recorded_by: string | null;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_by: string | null;
  deletion_reason: string | null;
  // Joined fields
  tank_location?: string;
  tank_group?: string;
}

export interface DipReadingFormData {
  value: number;
  notes?: string;
}

// Filtering
export interface TankFilters {
  search: string;
  groupId: string | null;
  subgroup: string | null;
  productTypes: ProductType[];
  statuses: TankStatus[];
  levelMin: number | null;
  levelMax: number | null;
}

export interface DipFilters {
  search: string;
  tankId: string | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  valueMin: number | null;
  valueMax: number | null;
  includeArchived: boolean;
}

// Sorting
export interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

// Pagination
export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

// Bulk Operations
export interface BulkOperation {
  type: 'delete' | 'update' | 'archive' | 'restore';
  ids: string[];
  updates?: Partial<FuelTank | DipReading>;
}

// Audit Log Entry
export interface AuditLogEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  user_id: string | null;
  user_email: string | null;
  created_at: string;
}

// CSV Import
export interface CsvImportResult {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{
    row: number;
    message: string;
    data: Record<string, unknown>;
  }>;
}

export interface BulkImportLog {
  id: string;
  table_name: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  total_records: number;
  successful_records: number;
  failed_records: number;
  error_details: Record<string, unknown> | null;
  csv_filename: string | null;
  user_id: string | null;
  user_email: string | null;
  started_at: string;
  completed_at: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}
