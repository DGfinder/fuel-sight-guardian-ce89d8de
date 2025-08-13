export type TankStatus = 'active' | 'archived' | 'decommissioned';

export interface TankRow {
  id: string;
  location?: string;
  product_type?: string;
  safe_level?: number;
  min_level?: number;
  status?: TankStatus;
  created_at?: string;
  updated_at?: string;
  group_id?: string;
  group_name?: string;
  current_level?: number;
  current_level_percent?: number;
  rolling_avg?: number;
  days_to_min_level?: number;
  usable_capacity?: number;
  latest_dip_value?: number;
  latest_dip_date?: string;
  latest_dip_by?: string;
  last_dip?: {
    value: number;
    created_at: string;
    recorded_by: string;
  } | null;
  subgroup?: string;
  prev_day_used?: number;
  serviced_on?: string;
  serviced_by?: string;
  address?: string;
  vehicle?: string;
  discharge?: string;
  bp_portal?: string;
  delivery_window?: string;
  afterhours_contact?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
}

export type Tank = TankRow;

export type AlertType = 'low_fuel' | 'critical_fuel' | 'no_reading' | 'maintenance';

export interface TankAlert {
  id: string;
  tank_id: string;
  alert_type: AlertType;
  message: string;
  created_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  snoozed_until: string | null;
  fuel_tanks: {
    id: string;
    group_id: string;
    product_type: 'ADF' | 'ULP' | 'ULP98' | 'Diesel';
    location?: string;
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
  tank_id: string;
  value: number;
  created_at: string;
  recorded_by: string;
  notes?: string;
  created_by_name?: string;
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
