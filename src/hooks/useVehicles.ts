import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as vehicleApi from '@/api/vehicles';
import type { 
  Vehicle, 
  VehicleFilters, 
  MaintenanceRecord, 
  MaintenanceFilters,
  VehicleEvent,
  EventFilters,
  AssetCompliance 
} from '@/types/fleet';

// Vehicle hooks

export function useVehicles(filters?: VehicleFilters) {
  return useQuery({
    queryKey: ['vehicles', filters],
    queryFn: () => vehicleApi.getVehicles(filters),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useVehicle(registration: string) {
  return useQuery({
    queryKey: ['vehicle', registration],
    queryFn: () => vehicleApi.getVehicleByRegistration(registration),
    enabled: !!registration,
    staleTime: 30 * 1000,
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Vehicle> }) =>
      vehicleApi.updateVehicle(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle', data.registration] });
    },
  });
}

// Driver assignment hooks

export function useAssignDriver() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ vehicleId, driverName }: { vehicleId: string; driverName: string }) =>
      vehicleApi.assignDriver(vehicleId, driverName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}

export function useUnassignDriver() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (vehicleId: string) => vehicleApi.unassignDriver(vehicleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}

// Maintenance hooks

export function useMaintenance(filters?: MaintenanceFilters) {
  return useQuery({
    queryKey: ['maintenance', filters],
    queryFn: () => vehicleApi.getMaintenanceRecords(filters),
    staleTime: 30 * 1000,
  });
}

export function useCreateMaintenance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (record: Omit<MaintenanceRecord, 'id' | 'created_at' | 'updated_at'>) =>
      vehicleApi.createMaintenanceRecord(record),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] });
    },
  });
}

export function useUpdateMaintenance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<MaintenanceRecord> }) =>
      vehicleApi.updateMaintenanceRecord(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] });
    },
  });
}

// Vehicle events hooks

export function useVehicleEvents(filters?: EventFilters) {
  return useQuery({
    queryKey: ['vehicle-events', filters],
    queryFn: () => vehicleApi.getVehicleEvents(filters),
    staleTime: 30 * 1000,
  });
}

export function useCreateVehicleEvent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (event: Omit<VehicleEvent, 'id' | 'created_at'>) =>
      vehicleApi.createVehicleEvent(event),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-events'] });
    },
  });
}

export function useUpdateVehicleEvent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<VehicleEvent> }) =>
      vehicleApi.updateVehicleEvent(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-events'] });
    },
  });
}

// Compliance hooks

export function useAssetCompliance(vehicleId?: string) {
  return useQuery({
    queryKey: ['asset-compliance', vehicleId],
    queryFn: () => vehicleApi.getAssetCompliance(vehicleId),
    staleTime: 30 * 1000,
  });
}

export function useUpdateCompliance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<AssetCompliance> }) =>
      vehicleApi.updateCompliance(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-compliance'] });
    },
  });
}

// View-based hooks

export function useActiveVehicles() {
  return useQuery({
    queryKey: ['active-vehicles'],
    queryFn: vehicleApi.getActiveVehicles,
    staleTime: 30 * 1000,
  });
}

export function useUpcomingMaintenance() {
  return useQuery({
    queryKey: ['upcoming-maintenance'],
    queryFn: vehicleApi.getUpcomingMaintenance,
    staleTime: 30 * 1000,
  });
}

export function useComplianceOverview() {
  return useQuery({
    queryKey: ['compliance-overview'],
    queryFn: vehicleApi.getComplianceOverview,
    staleTime: 30 * 1000,
  });
}