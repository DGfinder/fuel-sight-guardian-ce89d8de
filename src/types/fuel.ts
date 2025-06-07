export type Tank = {
  id: string;
  location: string;
  product_type: 'ADF' | 'ULP' | 'ULP98' | 'Diesel';
  current_level: number;
  safe_level: number;
  min_level: number | null;
  group_id: string;
  last_dip_date: string | null;
  last_dip_by: string | null;
  rolling_avg: number | null;
  days_to_min_level: number | null;
  created_at: string;
  updated_at: string;
  alerts?: TankAlert[];
  tank_groups?: {
    name: string;
  } | null;
};

export type AlertType = 'critical' | 'low_level' | 'low_days';

export interface TankAlert {
  id: string;
  tank_id: string;
  type: AlertType;
  message: string;
  created_at: string;
  updated_at: string;
  acknowledged_at: string | null;
  snoozed_until: string | null;
  fuel_tanks: {
    id: string;
    group_id: string;
    product_type: 'ADF' | 'ULP' | 'ULP98' | 'Diesel';
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
  reading: number;
  timestamp: string;
  recordedBy: string;
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
