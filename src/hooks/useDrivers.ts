import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as driverApi from '@/api/drivers';
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
  SystemName
} from '@/types/fleet';
import { ProcessedDriverData } from '@/services/driverCsvProcessor';

// Driver CRUD hooks

export function useDrivers(filters?: DriverFilters) {
  return useQuery({
    queryKey: ['drivers', filters],
    queryFn: () => driverApi.getDrivers(filters),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useDriver(id: string) {
  return useQuery({
    queryKey: ['driver', id],
    queryFn: () => driverApi.getDriverById(id),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useDriverByEmployeeId(employeeId: string) {
  return useQuery({
    queryKey: ['driver-by-employee-id', employeeId],
    queryFn: () => driverApi.getDriverByEmployeeId(employeeId),
    enabled: !!employeeId,
    staleTime: 30 * 1000,
  });
}

export function useCreateDriver() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (driver: Omit<Driver, 'id' | 'created_at' | 'updated_at'>) =>
      driverApi.createDriver(driver),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['driver-performance-summary'] });
    },
  });
}

export function useUpdateDriver() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Driver> }) =>
      driverApi.updateDriver(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['driver', data.id] });
      queryClient.invalidateQueries({ queryKey: ['driver-performance-summary'] });
    },
  });
}

export function useDeleteDriver() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => driverApi.deleteDriver(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['driver-performance-summary'] });
    },
  });
}

// Driver name mapping hooks

export function useDriverNameMappings(driverId?: string) {
  return useQuery({
    queryKey: ['driver-name-mappings', driverId],
    queryFn: () => driverApi.getDriverNameMappings(driverId),
    staleTime: 30 * 1000,
  });
}

export function useAddDriverNameMapping() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (mapping: Omit<DriverNameMapping, 'id' | 'created_at'>) =>
      driverApi.addDriverNameMapping(mapping),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['driver-name-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['driver-name-mappings', data.driver_id] });
    },
  });
}

export function useUpdateDriverNameMapping() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<DriverNameMapping> }) =>
      driverApi.updateDriverNameMapping(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['driver-name-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['driver-name-mappings', data.driver_id] });
    },
  });
}

export function useDeleteDriverNameMapping() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => driverApi.deleteDriverNameMapping(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-name-mappings'] });
    },
  });
}

export function useFindDriverByName(name: string, system?: SystemName) {
  return useQuery({
    queryKey: ['find-driver-by-name', name, system],
    queryFn: () => driverApi.findDriverByName(name, system),
    enabled: !!name && name.length > 2, // Only search with meaningful input
    staleTime: 60 * 1000, // 1 minute
  });
}

// Driver performance hooks

export function useDriverPerformanceMetrics(filters?: DriverPerformanceFilters) {
  return useQuery({
    queryKey: ['driver-performance-metrics', filters],
    queryFn: () => driverApi.getDriverPerformanceMetrics(filters),
    staleTime: 60 * 1000, // 1 minute for performance data
  });
}

export function useDriverPerformanceSummary(filters?: { fleet?: string; depot?: string }) {
  return useQuery({
    queryKey: ['driver-performance-summary', filters],
    queryFn: () => driverApi.getDriverPerformanceSummary(filters),
    staleTime: 60 * 1000, // 1 minute for summary data
  });
}

export function useAddDriverPerformanceMetrics() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (metrics: Omit<DriverPerformanceMetrics, 'id' | 'created_at'>) =>
      driverApi.addDriverPerformanceMetrics(metrics),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['driver-performance-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['driver-performance-summary'] });
      queryClient.invalidateQueries({ queryKey: ['driver', data.driver_id] });
    },
  });
}

// Driver incident hooks

export function useDriverIncidents(filters?: DriverIncidentFilters) {
  return useQuery({
    queryKey: ['driver-incidents', filters],
    queryFn: () => driverApi.getDriverIncidents(filters),
    staleTime: 30 * 1000,
  });
}

export function useCreateDriverIncident() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (incident: Omit<DriverIncident, 'id' | 'created_at' | 'updated_at'>) =>
      driverApi.createDriverIncident(incident),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['driver-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['driver', data.driver_id] });
    },
  });
}

export function useUpdateDriverIncident() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<DriverIncident> }) =>
      driverApi.updateDriverIncident(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['driver-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['driver', data.driver_id] });
    },
  });
}

export function useResolveDriverIncident() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ 
      id, 
      resolution, 
      actionsTaken, 
      disciplinaryAction 
    }: { 
      id: string; 
      resolution: string; 
      actionsTaken?: string;
      disciplinaryAction?: string;
    }) => driverApi.resolveDriverIncident(id, resolution, actionsTaken, disciplinaryAction),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['driver-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['driver', data.driver_id] });
    },
  });
}

// Enhanced driver assignment hooks

export function useAssignDriverById() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ vehicleId, driverId }: { vehicleId: string; driverId: string }) =>
      driverApi.assignDriverById(vehicleId, driverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['driver-assignment-history'] });
    },
  });
}

export function useDriverAssignmentHistory(driverId: string) {
  return useQuery({
    queryKey: ['driver-assignment-history', driverId],
    queryFn: () => driverApi.getDriverAssignmentHistory(driverId),
    enabled: !!driverId,
    staleTime: 30 * 1000,
  });
}

// Utility hooks

export function useDriverStats() {
  return useQuery({
    queryKey: ['driver-stats'],
    queryFn: driverApi.getDriverStats,
    staleTime: 5 * 60 * 1000, // 5 minutes for stats
  });
}

export function useSearchDrivers(searchTerm: string, limit?: number) {
  return useQuery({
    queryKey: ['search-drivers', searchTerm, limit],
    queryFn: () => driverApi.searchDrivers(searchTerm, limit),
    enabled: !!searchTerm && searchTerm.length > 2,
    staleTime: 30 * 1000,
  });
}

export function useUpdateDriverPerformanceScores() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (driverId: string) => driverApi.updateDriverPerformanceScores(driverId),
    onSuccess: (_, driverId) => {
      queryClient.invalidateQueries({ queryKey: ['driver', driverId] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['driver-performance-summary'] });
    },
  });
}

// Bulk operations for CSV import

export function useBulkCreateDrivers() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (drivers: Omit<Driver, 'id' | 'created_at' | 'updated_at'>[]) =>
      driverApi.bulkCreateDrivers(drivers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['driver-stats'] });
      queryClient.invalidateQueries({ queryKey: ['driver-performance-summary'] });
    },
  });
}

export function useBulkCreateDriverNameMappings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (mappings: Omit<DriverNameMapping, 'id' | 'created_at'>[]) =>
      driverApi.bulkCreateDriverNameMappings(mappings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-name-mappings'] });
    },
  });
}

// Combined CSV import hook
export function useDriverCsvImport() {
  const bulkCreateDrivers = useBulkCreateDrivers();
  const bulkCreateMappings = useBulkCreateDriverNameMappings();
  
  return useMutation({
    mutationFn: async (processedData: ProcessedDriverData) => {
      // First create drivers
      const createdDrivers = await bulkCreateDrivers.mutateAsync(processedData.drivers);
      
      // Update name mappings with actual driver IDs
      const mappingsWithIds = processedData.nameMappings.map(mapping => {
        const driver = createdDrivers.find(d => 
          d.first_name === processedData.drivers.find(pd => pd.id === mapping.driver_id)?.first_name &&
          d.last_name === processedData.drivers.find(pd => pd.id === mapping.driver_id)?.last_name
        );
        return {
          ...mapping,
          driver_id: driver?.id || mapping.driver_id
        };
      });
      
      // Then create name mappings
      await bulkCreateMappings.mutateAsync(mappingsWithIds);
      
      return { drivers: createdDrivers, mappings: mappingsWithIds };
    },
  });
}