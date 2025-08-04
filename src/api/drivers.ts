import { supabase } from '@/lib/supabase';
import type { 
  Driver,
  DriverProfile,
  DriverPerformanceSummary,
  DriverNameMapping,
  DriverPerformanceMetrics,
  DriverIncident,
  DriverFilters,
  DriverPerformanceFilters,
  DriverIncidentFilters,
  SystemName,
  DriverAssignment
} from '@/types/fleet';

// Driver CRUD API functions

export async function getDrivers(filters?: DriverFilters) {
  let query = supabase
    .from('driver_profiles')
    .select('*');

  if (filters?.fleet) {
    query = query.eq('fleet', filters.fleet);
  }
  
  if (filters?.depot) {
    query = query.eq('depot', filters.depot);
  }
  
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  
  if (filters?.risk_level) {
    query = query.eq('current_risk_level', filters.risk_level);
  }
  
  if (filters?.search) {
    query = query.or(`
      first_name.ilike.%${filters.search}%,
      last_name.ilike.%${filters.search}%,
      employee_id.ilike.%${filters.search}%,
      email.ilike.%${filters.search}%
    `);
  }

  if (filters?.has_incidents) {
    query = filters.has_incidents 
      ? query.gt('recent_incidents', 0)
      : query.eq('recent_incidents', 0);
  }

  if (filters?.license_expiring) {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    query = query.lte('license_expiry', thirtyDaysFromNow.toISOString().split('T')[0]);
  }

  const { data, error } = await query.order('last_name');
  
  if (error) throw error;
  return data as DriverProfile[];
}

export async function getDriverById(id: string) {
  const { data, error } = await supabase
    .from('driver_profiles')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as DriverProfile;
}

export async function getDriverByEmployeeId(employeeId: string) {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('employee_id', employeeId)
    .single();
  
  if (error) throw error;
  return data as Driver;
}

export async function createDriver(driver: Omit<Driver, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('drivers')
    .insert(driver)
    .select()
    .single();
  
  if (error) throw error;
  return data as Driver;
}

export async function updateDriver(id: string, updates: Partial<Driver>) {
  const { data, error } = await supabase
    .from('drivers')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as Driver;
}

export async function deleteDriver(id: string) {
  // Soft delete by setting status to 'Terminated'
  const { error } = await supabase
    .from('drivers')
    .update({ 
      status: 'Terminated',
      updated_at: new Date().toISOString()
    })
    .eq('id', id);
  
  if (error) throw error;
}

// Driver Name Mapping API functions

export async function getDriverNameMappings(driverId?: string) {
  let query = supabase
    .from('driver_name_mappings')
    .select('*');

  if (driverId) {
    query = query.eq('driver_id', driverId);
  }

  const { data, error } = await query.order('system_name');
  
  if (error) throw error;
  return data as DriverNameMapping[];
}

export async function addDriverNameMapping(mapping: Omit<DriverNameMapping, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('driver_name_mappings')
    .insert(mapping)
    .select()
    .single();
  
  if (error) throw error;
  return data as DriverNameMapping;
}

export async function updateDriverNameMapping(id: string, updates: Partial<DriverNameMapping>) {
  const { data, error } = await supabase
    .from('driver_name_mappings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as DriverNameMapping;
}

export async function deleteDriverNameMapping(id: string) {
  const { error } = await supabase
    .from('driver_name_mappings')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

export async function findDriverByName(name: string, system?: SystemName) {
  let query = supabase
    .from('driver_name_mappings')
    .select(`
      *,
      driver:drivers(*)
    `)
    .ilike('mapped_name', `%${name}%`);

  if (system) {
    query = query.eq('system_name', system);
  }

  const { data, error } = await query
    .order('confidence_score', { ascending: false })
    .limit(10);
  
  if (error) throw error;
  return data;
}

// Driver Performance API functions

export async function getDriverPerformanceMetrics(filters?: DriverPerformanceFilters) {
  let query = supabase
    .from('driver_performance_metrics')
    .select('*');

  if (filters?.driver_id) {
    query = query.eq('driver_id', filters.driver_id);
  }

  if (filters?.period_type) {
    query = query.eq('period_type', filters.period_type);
  }

  if (filters?.from_date) {
    query = query.gte('period_start', filters.from_date);
  }

  if (filters?.to_date) {
    query = query.lte('period_end', filters.to_date);
  }

  if (filters?.risk_level) {
    query = query.eq('risk_level', filters.risk_level);
  }

  if (filters?.trend) {
    query = query.eq('trend', filters.trend);
  }

  const { data, error } = await query.order('period_end', { ascending: false });
  
  if (error) throw error;
  return data as DriverPerformanceMetrics[];
}

export async function getDriverPerformanceSummary(filters?: { fleet?: string; depot?: string }) {
  let query = supabase
    .from('driver_performance_summary')
    .select('*');

  if (filters?.fleet) {
    query = query.eq('fleet', filters.fleet);
  }

  if (filters?.depot) {
    query = query.eq('depot', filters.depot);
  }

  const { data, error } = await query.order('lytx_safety_score', { ascending: false });
  
  if (error) throw error;
  return data as DriverPerformanceSummary[];
}

export async function addDriverPerformanceMetrics(metrics: Omit<DriverPerformanceMetrics, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('driver_performance_metrics')
    .insert(metrics)
    .select()
    .single();
  
  if (error) throw error;
  return data as DriverPerformanceMetrics;
}

// Driver Incident API functions

export async function getDriverIncidents(filters?: DriverIncidentFilters) {
  let query = supabase
    .from('driver_incidents')
    .select(`
      *,
      driver:drivers(first_name, last_name, employee_id),
      vehicle:vehicles(registration, fleet)
    `);

  if (filters?.driver_id) {
    query = query.eq('driver_id', filters.driver_id);
  }

  if (filters?.vehicle_id) {
    query = query.eq('vehicle_id', filters.vehicle_id);
  }

  if (filters?.incident_type) {
    query = query.eq('incident_type', filters.incident_type);
  }

  if (filters?.source_system) {
    query = query.eq('source_system', filters.source_system);
  }

  if (filters?.severity) {
    query = query.eq('severity', filters.severity);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.from_date) {
    query = query.gte('incident_date', filters.from_date);
  }

  if (filters?.to_date) {
    query = query.lte('incident_date', filters.to_date);
  }

  const { data, error } = await query.order('incident_date', { ascending: false });
  
  if (error) throw error;
  return data as DriverIncident[];
}

export async function createDriverIncident(incident: Omit<DriverIncident, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('driver_incidents')
    .insert(incident)
    .select()
    .single();
  
  if (error) throw error;
  return data as DriverIncident;
}

export async function updateDriverIncident(id: string, updates: Partial<DriverIncident>) {
  const { data, error } = await supabase
    .from('driver_incidents')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as DriverIncident;
}

export async function resolveDriverIncident(
  id: string, 
  resolution: string, 
  actionsTaken?: string,
  disciplinaryAction?: string
) {
  const { data, error } = await supabase
    .from('driver_incidents')
    .update({
      status: 'Resolved',
      resolution,
      actions_taken: actionsTaken,
      disciplinary_action: disciplinaryAction,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as DriverIncident;
}

// Enhanced Driver Assignment API functions (extending existing functionality)

export async function assignDriverById(vehicleId: string, driverId: string) {
  // Get driver details
  const driver = await getDriverById(driverId);
  const driverName = `${driver.first_name} ${driver.last_name}`;
  
  // First, unassign any current driver
  await unassignDriverFromVehicle(vehicleId);
  
  const { data, error } = await supabase
    .from('driver_assignments')
    .insert({
      vehicle_id: vehicleId,
      driver_id: driverId,
      driver_name: driverName
    })
    .select()
    .single();
  
  if (error) throw error;
  return data as DriverAssignment;
}

export async function unassignDriverFromVehicle(vehicleId: string) {
  const { error } = await supabase
    .from('driver_assignments')
    .update({ unassigned_at: new Date().toISOString() })
    .eq('vehicle_id', vehicleId)
    .is('unassigned_at', null);
  
  if (error) throw error;
}

export async function getDriverAssignmentHistory(driverId: string) {
  const { data, error } = await supabase
    .from('driver_assignments')
    .select(`
      *,
      vehicle:vehicles(registration, fleet, make, model)
    `)
    .eq('driver_id', driverId)
    .order('assigned_at', { ascending: false });
  
  if (error) throw error;
  return data as (DriverAssignment & { vehicle: any })[];
}

// Utility functions

export async function getDriverStats() {
  const { data, error } = await supabase
    .rpc('get_driver_stats');
  
  if (error) throw error;
  return data;
}

export async function searchDrivers(searchTerm: string, limit: number = 10) {
  const { data, error } = await supabase
    .from('driver_profiles')
    .select('id, first_name, last_name, employee_id, fleet, depot, status')
    .or(`
      first_name.ilike.%${searchTerm}%,
      last_name.ilike.%${searchTerm}%,
      employee_id.ilike.%${searchTerm}%
    `)
    .eq('status', 'Active')
    .limit(limit);
  
  if (error) throw error;
  return data;
}

export async function updateDriverPerformanceScores(driverId: string) {
  // This would typically be called by a background job
  // For now, we'll just refresh the cached scores in the drivers table
  const latestMetrics = await supabase
    .from('driver_performance_metrics')
    .select('lytx_safety_score, guardian_safety_score')
    .eq('driver_id', driverId)
    .eq('period_type', 'Monthly')
    .order('period_end', { ascending: false })
    .limit(1)
    .single();

  if (latestMetrics.data) {
    const { error } = await supabase
      .from('drivers')
      .update({
        lytx_score: latestMetrics.data.lytx_safety_score,
        guardian_score: latestMetrics.data.guardian_safety_score,
        safety_score: (latestMetrics.data.lytx_safety_score + latestMetrics.data.guardian_safety_score) / 2,
        updated_at: new Date().toISOString()
      })
      .eq('id', driverId);

    if (error) throw error;
  }
}

// Bulk operations for CSV import

export async function bulkCreateDrivers(drivers: Omit<Driver, 'id' | 'created_at' | 'updated_at'>[]) {
  const { data, error } = await supabase
    .from('drivers')
    .insert(drivers)
    .select();
  
  if (error) throw error;
  return data as Driver[];
}

export async function bulkCreateDriverNameMappings(mappings: Omit<DriverNameMapping, 'id' | 'created_at'>[]) {
  const { data, error } = await supabase
    .from('driver_name_mappings')
    .insert(mappings)
    .select();
  
  if (error) throw error;
  return data as DriverNameMapping[];
}