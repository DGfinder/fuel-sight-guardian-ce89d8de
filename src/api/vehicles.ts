import { supabase } from '@/lib/supabase';
import type { 
  Vehicle, 
  VehicleFilters, 
  MaintenanceRecord, 
  MaintenanceFilters,
  VehicleEvent,
  EventFilters,
  AssetCompliance,
  DriverAssignment 
} from '@/types/fleet';

// Vehicle API functions

export async function getVehicles(filters?: VehicleFilters) {
  let query = supabase
    .from('vehicles')
    .select(`
      *,
      current_driver:driver_assignments!left(driver_name, assigned_at)
    `)
    .is('driver_assignments.unassigned_at', null);

  if (filters?.fleet) {
    query = query.eq('fleet', filters.fleet);
  }
  
  if (filters?.depot) {
    query = query.eq('depot', filters.depot);
  }
  
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  
  if (filters?.search) {
    query = query.or(`
      registration.ilike.%${filters.search}%,
      make.ilike.%${filters.search}%,
      model.ilike.%${filters.search}%,
      guardian_unit.ilike.%${filters.search}%,
      lytx_device.ilike.%${filters.search}%
    `);
  }

  const { data, error } = await query.order('registration');
  
  if (error) throw error;
  
  // Transform the data to match our Vehicle interface
  return data?.map(vehicle => ({
    ...vehicle,
    current_driver: vehicle.current_driver?.[0]?.driver_name,
    driver_assigned_at: vehicle.current_driver?.[0]?.assigned_at
  })) as Vehicle[];
}

export async function getVehicleByRegistration(registration: string) {
  const { data, error } = await supabase
    .from('vehicles')
    .select(`
      *,
      current_driver:driver_assignments!left(driver_name, assigned_at)
    `)
    .eq('registration', registration)
    .is('driver_assignments.unassigned_at', null)
    .single();
  
  if (error) throw error;
  
  return {
    ...data,
    current_driver: data.current_driver?.[0]?.driver_name,
    driver_assigned_at: data.current_driver?.[0]?.assigned_at
  } as Vehicle;
}

export async function updateVehicle(id: string, updates: Partial<Vehicle>) {
  const { data, error } = await supabase
    .from('vehicles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as Vehicle;
}

// Driver Assignment API functions

export async function assignDriver(vehicleId: string, driverName: string) {
  // First, unassign any current driver
  await unassignDriver(vehicleId);
  
  const { data, error } = await supabase
    .from('driver_assignments')
    .insert({
      vehicle_id: vehicleId,
      driver_name: driverName
    })
    .select()
    .single();
  
  if (error) throw error;
  return data as DriverAssignment;
}

export async function unassignDriver(vehicleId: string) {
  const { error } = await supabase
    .from('driver_assignments')
    .update({ unassigned_at: new Date().toISOString() })
    .eq('vehicle_id', vehicleId)
    .is('unassigned_at', null);
  
  if (error) throw error;
}

// Maintenance API functions

export async function getMaintenanceRecords(filters?: MaintenanceFilters) {
  let query = supabase
    .from('maintenance_records')
    .select(`
      *,
      vehicle:vehicles(registration, fleet, depot)
    `);

  if (filters?.vehicle_id) {
    query = query.eq('vehicle_id', filters.vehicle_id);
  }
  
  if (filters?.type) {
    query = query.eq('type', filters.type);
  }
  
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  
  if (filters?.from_date) {
    query = query.gte('scheduled_date', filters.from_date);
  }
  
  if (filters?.to_date) {
    query = query.lte('scheduled_date', filters.to_date);
  }

  const { data, error } = await query.order('scheduled_date', { ascending: false });
  
  if (error) throw error;
  return data as MaintenanceRecord[];
}

export async function createMaintenanceRecord(record: Omit<MaintenanceRecord, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('maintenance_records')
    .insert(record)
    .select()
    .single();
  
  if (error) throw error;
  return data as MaintenanceRecord;
}

export async function updateMaintenanceRecord(id: string, updates: Partial<MaintenanceRecord>) {
  const { data, error } = await supabase
    .from('maintenance_records')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as MaintenanceRecord;
}

// Vehicle Events API functions

export async function getVehicleEvents(filters?: EventFilters) {
  let query = supabase
    .from('vehicle_events')
    .select(`
      *,
      vehicle:vehicles(registration, fleet, depot)
    `);

  if (filters?.vehicle_id) {
    query = query.eq('vehicle_id', filters.vehicle_id);
  }
  
  if (filters?.source) {
    query = query.eq('source', filters.source);
  }
  
  if (filters?.event_type) {
    query = query.eq('event_type', filters.event_type);
  }
  
  if (filters?.from_date) {
    query = query.gte('occurred_at', filters.from_date);
  }
  
  if (filters?.to_date) {
    query = query.lte('occurred_at', filters.to_date);
  }
  
  if (filters?.verified !== undefined) {
    query = query.eq('verified', filters.verified);
  }

  const { data, error } = await query.order('occurred_at', { ascending: false });
  
  if (error) throw error;
  return data as VehicleEvent[];
}

export async function createVehicleEvent(event: Omit<VehicleEvent, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('vehicle_events')
    .insert(event)
    .select()
    .single();
  
  if (error) throw error;
  return data as VehicleEvent;
}

export async function updateVehicleEvent(id: string, updates: Partial<VehicleEvent>) {
  const { data, error } = await supabase
    .from('vehicle_events')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as VehicleEvent;
}

// Compliance API functions

export async function getAssetCompliance(vehicleId?: string) {
  let query = supabase
    .from('asset_compliance')
    .select(`
      *,
      vehicle:vehicles(registration, fleet, depot)
    `);

  if (vehicleId) {
    query = query.eq('vehicle_id', vehicleId);
  }

  const { data, error } = await query.order('due_date');
  
  if (error) throw error;
  return data as AssetCompliance[];
}

export async function updateCompliance(id: string, updates: Partial<AssetCompliance>) {
  const { data, error } = await supabase
    .from('asset_compliance')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as AssetCompliance;
}

// Utility functions

export async function getVehicleByGuardianUnit(guardianUnit: string) {
  const { data, error } = await supabase
    .from('vehicles')
    .select()
    .eq('guardian_unit', guardianUnit)
    .single();
  
  if (error) throw error;
  return data as Vehicle;
}

export async function getVehicleByLytxDevice(lytxDevice: string) {
  const { data, error } = await supabase
    .from('vehicles')
    .select()
    .eq('lytx_device', lytxDevice)
    .single();
  
  if (error) throw error;
  return data as Vehicle;
}

// View-based queries

export async function getActiveVehicles() {
  const { data, error } = await supabase
    .from('active_vehicles')
    .select()
    .order('registration');
  
  if (error) throw error;
  return data as Vehicle[];
}

export async function getUpcomingMaintenance() {
  const { data, error } = await supabase
    .from('upcoming_maintenance')
    .select()
    .order('scheduled_date');
  
  if (error) throw error;
  return data;
}

export async function getComplianceOverview() {
  const { data, error } = await supabase
    .from('compliance_overview')
    .select()
    .order('days_until_next_compliance');
  
  if (error) throw error;
  return data;
}