export interface TankRow {
  id: string;
  location?: string;
  product_type?: string;
  safe_level?: number;
  min_level?: number;
  created_at?: string;
  updated_at?: string;
  group_id?: string;
  group_name?: string;
  current_level?: number;
  current_level_percent?: number;
  rolling_avg?: number;
  days_to_min_level?: number;
  latest_dip_value?: number;
  latest_dip_date?: string;
  latest_dip_by?: string;
  last_dip?: {
    value: number;
    created_at: string;
    recorded_by: string;
  } | null;
  subgroup?: string;
}

export type Tank = TankRow;

export type AlertType = 'critical' | 'low_level' | 'low_days';

export interface TankAlert {
  id: string;
  tank_id: string;
  type: AlertType;
  alert_type?: string; // Added for compatibility
  message: string;
  created_at: string;
  updated_at: string;
  acknowledged_at: string | null;
  snoozed_until: string | null;
  fuel_tanks: {
    id: string;
    group_id: string;
    product_type: 'ADF' | 'ULP' | 'ULP98' | 'Diesel';
    location?: string; // Added for compatibility
    depot_id?: string; // Added for compatibility
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'depot_manager' | 'operator';
  assignedGroups: string[];
}

export interface DipReading {
  id: string;
  tankId: string;
  tank_id: string; // Added for compatibility
  reading: number;
  value: number; // Added for compatibility
  timestamp: string;
  created_at: string; // Added for compatibility
  recorded_at: string; // Added for compatibility
  recordedBy: string;
  recorded_by: string; // Added for compatibility
  notes?: string;
}

export type GroupSnapshot = {
  id: string;
  name: string;
  totalTanks: number;
  criticalTanks: number;
  averageLevel: number;
  lastUpdated: string;
};

export type KPICardsProps = {
  tanks: Tank[];
  onCardClick: (filter: string) => void;
  selectedFilter: string | null;
};

export type UserFavourite = {
  user_id: string;
  tank_id?: string;
  group_id?: string;
  created_at: string;
};

export type UserView = {
  user_id: string;
  tank_id?: string;
  group_id?: string;
  viewed_at: string;
  filter?: string;
};
