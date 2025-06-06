
export interface Tank {
  id: string;
  location: string;
  depot: string;
  group: string;
  productType: 'ADF' | 'ULP' | 'Premium' | 'Diesel';
  currentLevel: number; // in litres
  capacity: number; // in litres
  minLevel: number; // in litres
  safeLevel: number; // in litres
  lastDipDate: string;
  lastDipBy: string;
  rollingAvg: number; // litres per day
  daysToMinLevel: number;
  alerts: Alert[];
}

export interface Alert {
  id: string;
  tankId: string;
  type: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: string;
  acknowledged: boolean;
  snoozeUntil?: string;
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

export interface KPIData {
  tanksBelow10: number;
  tanksBelow20: number;
  totalStock: number;
  avgDaysToEmpty: number;
}
