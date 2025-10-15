/**
 * Master Data Configuration Page
 *
 * Central management page for master data configuration and cross-system synchronization.
 * Single source of truth for vehicle and driver fleet assignments across Guardian, LYTX, MtData.
 * Includes data mapping, validation, and synchronization tools.
 */

import React, { useState } from 'react';
import { Settings, Database, RefreshCw, AlertTriangle, CheckCircle, Truck, Users, GitMerge, Shield, Video, Navigation, MapPin, Plus, Trash2, Edit, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useVehicles } from '@/hooks/useVehicles';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import DataCentreLayout from '@/components/DataCentreLayout';
import { useToast } from '@/hooks/use-toast';

interface FleetMismatch {
  vehicle_registration: string;
  vehicle_fleet: string;
  event_fleet: string;
  event_count: number;
}

interface FleetStats {
  total_vehicles: number;
  total_drivers: number;
  total_guardian_events: number;
  mismatched_events: number;
  vehicles_by_fleet: { fleet: string; count: number }[];
  drivers_by_fleet: { fleet: string; count: number }[];
}

interface DeviceMapping {
  id: string;
  device_serial: string;
  vehicle_id: string;
  vehicle_registration: string;
  fleet: string;
  mapping_source: string;
  verified: boolean;
  created_at: string;
}

interface GuardianMapping {
  id: string;
  guardian_unit: string;
  vehicle_id: string;
  vehicle_registration: string;
  fleet: string;
  mapping_source: string;
  verified: boolean;
  created_at: string;
}

interface MtDataMapping {
  id: string;
  mtdata_vehicle_id: string;
  vehicle_id: string;
  vehicle_registration: string;
  fleet: string;
  mapping_source: string;
  verified: boolean;
  created_at: string;
}

interface OrphanedDevice {
  device_serial: string;
  current_fleet: string;
  event_count: number;
  first_event: string;
  last_event: string;
}

interface OrphanedUnit {
  guardian_unit: string;
  current_fleet: string;
  event_count: number;
  first_event: string;
  last_event: string;
}

interface OrphanedTrip {
  mtdata_vehicle_id: string;
  current_fleet: string;
  trip_count: number;
  first_trip: string;
  last_trip: string;
}

const MasterDataPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('vehicles');
  const [syncInProgress, setSyncInProgress] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Dialog state for LYTX mappings
  const [lytxDialogOpen, setLytxDialogOpen] = useState(false);
  const [lytxEditMode, setLytxEditMode] = useState(false);
  const [lytxFormData, setLytxFormData] = useState({
    id: '',
    device_serial: '',
    vehicle_id: '',
    notes: ''
  });

  // Dialog state for Guardian mappings
  const [guardianDialogOpen, setGuardianDialogOpen] = useState(false);
  const [guardianEditMode, setGuardianEditMode] = useState(false);
  const [guardianFormData, setGuardianFormData] = useState({
    id: '',
    guardian_unit: '',
    vehicle_id: '',
    notes: ''
  });

  // Dialog state for MtData mappings
  const [mtdataDialogOpen, setMtdataDialogOpen] = useState(false);
  const [mtdataEditMode, setMtdataEditMode] = useState(false);
  const [mtdataFormData, setMtdataFormData] = useState({
    id: '',
    mtdata_vehicle_id: '',
    vehicle_id: '',
    notes: ''
  });

  // Fetch all vehicles
  const { data: vehicles = [], isLoading: loadingVehicles } = useVehicles({});

  // Fetch fleet statistics
  const { data: stats, isLoading: loadingStats } = useQuery<FleetStats>({
    queryKey: ['fleet-stats'],
    queryFn: async () => {
      const [vehiclesRes, driversRes, eventsRes] = await Promise.all([
        supabase.from('vehicles').select('fleet'),
        supabase.from('drivers').select('fleet'),
        supabase.from('guardian_events').select('fleet')
      ]);

      if (vehiclesRes.error) throw vehiclesRes.error;
      if (driversRes.error) throw driversRes.error;
      if (eventsRes.error) throw eventsRes.error;

      const vehiclesByFleet = vehiclesRes.data.reduce((acc: any[], v: any) => {
        const existing = acc.find(item => item.fleet === v.fleet);
        if (existing) {
          existing.count++;
        } else {
          acc.push({ fleet: v.fleet, count: 1 });
        }
        return acc;
      }, []);

      const driversByFleet = driversRes.data.reduce((acc: any[], d: any) => {
        const existing = acc.find(item => item.fleet === d.fleet);
        if (existing) {
          existing.count++;
        } else {
          acc.push({ fleet: d.fleet, count: 1 });
        }
        return acc;
      }, []);

      return {
        total_vehicles: vehiclesRes.data.length,
        total_drivers: driversRes.data.length,
        total_guardian_events: eventsRes.data.length,
        mismatched_events: 0, // Will be calculated in validation
        vehicles_by_fleet: vehiclesByFleet,
        drivers_by_fleet: driversByFleet
      };
    }
  });

  // Fetch fleet mismatches
  const { data: mismatches = [], isLoading: loadingMismatches } = useQuery<FleetMismatch[]>({
    queryKey: ['fleet-mismatches'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_fleet_mismatches');
      if (error) {
        // If function doesn't exist, return empty array
        console.warn('Fleet mismatch function not found:', error);
        return [];
      }
      return data || [];
    }
  });

  // Sync guardian_events fleet from vehicles
  const syncFleetMutation = useMutation({
    mutationFn: async () => {
      setSyncInProgress(true);

      // Call database function to sync fleet assignments
      const { error } = await supabase.rpc('sync_guardian_event_fleets');

      if (error) throw error;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet-stats'] });
      queryClient.invalidateQueries({ queryKey: ['fleet-mismatches'] });
      setSyncInProgress(false);
    },
    onError: (error) => {
      console.error('Fleet sync failed:', error);
      setSyncInProgress(false);
    }
  });

  // Bulk update vehicle fleet
  const updateVehicleFleetMutation = useMutation({
    mutationFn: async ({ vehicleIds, fleet }: { vehicleIds: string[]; fleet: string }) => {
      const { error } = await supabase
        .from('vehicles')
        .update({ fleet })
        .in('id', vehicleIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['fleet-stats'] });
    }
  });

  // Fetch LYTX device mappings
  const { data: lytxMappings = [], isLoading: loadingLytxMappings } = useQuery<DeviceMapping[]>({
    queryKey: ['lytx-device-mappings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lytx_device_mappings')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch orphaned LYTX devices
  const { data: orphanedLytx = [], isLoading: loadingOrphanedLytx } = useQuery<OrphanedDevice[]>({
    queryKey: ['lytx-orphaned-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lytx_orphaned_events')
        .select('*');
      if (error) {
        console.warn('LYTX orphaned events view not found:', error);
        return [];
      }
      return data || [];
    }
  });

  // Fetch Guardian unit mappings
  const { data: guardianMappings = [], isLoading: loadingGuardianMappings } = useQuery<GuardianMapping[]>({
    queryKey: ['guardian-unit-mappings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guardian_unit_mappings')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch orphaned Guardian units
  const { data: orphanedGuardian = [], isLoading: loadingOrphanedGuardian } = useQuery<OrphanedUnit[]>({
    queryKey: ['guardian-orphaned-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guardian_orphaned_events')
        .select('*');
      if (error) {
        console.warn('Guardian orphaned events view not found:', error);
        return [];
      }
      return data || [];
    }
  });

  // Fetch MtData vehicle mappings
  const { data: mtdataMappings = [], isLoading: loadingMtDataMappings } = useQuery<MtDataMapping[]>({
    queryKey: ['mtdata-vehicle-mappings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mtdata_vehicle_mappings')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch orphaned MtData trips
  const { data: orphanedMtData = [], isLoading: loadingOrphanedMtData } = useQuery<OrphanedTrip[]>({
    queryKey: ['mtdata-orphaned-trips'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mtdata_orphaned_trips')
        .select('*');
      if (error) {
        console.warn('MtData orphaned trips view not found:', error);
        return [];
      }
      return data || [];
    }
  });

  // Sync all systems mutation
  const syncAllSystemsMutation = useMutation({
    mutationFn: async () => {
      setSyncInProgress(true);
      const { error } = await supabase.rpc('sync_all_master_data');
      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet-stats'] });
      queryClient.invalidateQueries({ queryKey: ['fleet-mismatches'] });
      queryClient.invalidateQueries({ queryKey: ['lytx-orphaned-events'] });
      queryClient.invalidateQueries({ queryKey: ['guardian-orphaned-events'] });
      queryClient.invalidateQueries({ queryKey: ['mtdata-orphaned-trips'] });
      setSyncInProgress(false);
    },
    onError: (error) => {
      console.error('All systems sync failed:', error);
      setSyncInProgress(false);
    }
  });

  const handleSyncFleet = () => {
    if (confirm('This will update all Guardian event fleet assignments based on vehicle registrations. Continue?')) {
      syncFleetMutation.mutate();
    }
  };

  const handleSyncAllSystems = () => {
    if (confirm('This will synchronize all systems (LYTX, Guardian, MtData) with master data mappings. Continue?')) {
      syncAllSystemsMutation.mutate();
    }
  };

  // ============================================================================
  // LYTX MAPPING MUTATIONS
  // ============================================================================

  const addLytxMappingMutation = useMutation({
    mutationFn: async () => {
      const selectedVehicle = vehicles.find(v => v.id === lytxFormData.vehicle_id);
      if (!selectedVehicle) throw new Error('Vehicle not found');

      const { error } = await supabase
        .from('lytx_device_mappings')
        .insert({
          device_serial: lytxFormData.device_serial,
          vehicle_id: lytxFormData.vehicle_id,
          vehicle_registration: selectedVehicle.registration,
          fleet: selectedVehicle.fleet,
          mapping_source: 'manual',
          notes: lytxFormData.notes || null
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lytx-device-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['lytx-orphaned-events'] });
      setLytxDialogOpen(false);
      setLytxFormData({ id: '', device_serial: '', vehicle_id: '', notes: '' });
      toast({ title: 'Success', description: 'LYTX device mapping added successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const updateLytxMappingMutation = useMutation({
    mutationFn: async () => {
      const selectedVehicle = vehicles.find(v => v.id === lytxFormData.vehicle_id);
      if (!selectedVehicle) throw new Error('Vehicle not found');

      const { error } = await supabase
        .from('lytx_device_mappings')
        .update({
          device_serial: lytxFormData.device_serial,
          vehicle_id: lytxFormData.vehicle_id,
          vehicle_registration: selectedVehicle.registration,
          fleet: selectedVehicle.fleet,
          notes: lytxFormData.notes || null
        })
        .eq('id', lytxFormData.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lytx-device-mappings'] });
      setLytxDialogOpen(false);
      setLytxFormData({ id: '', device_serial: '', vehicle_id: '', notes: '' });
      toast({ title: 'Success', description: 'LYTX device mapping updated successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const deleteLytxMappingMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('lytx_device_mappings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lytx-device-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['lytx-orphaned-events'] });
      toast({ title: 'Success', description: 'LYTX device mapping deleted successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // ============================================================================
  // GUARDIAN MAPPING MUTATIONS
  // ============================================================================

  const addGuardianMappingMutation = useMutation({
    mutationFn: async () => {
      const selectedVehicle = vehicles.find(v => v.id === guardianFormData.vehicle_id);
      if (!selectedVehicle) throw new Error('Vehicle not found');

      const { error } = await supabase
        .from('guardian_unit_mappings')
        .insert({
          guardian_unit: guardianFormData.guardian_unit,
          vehicle_id: guardianFormData.vehicle_id,
          vehicle_registration: selectedVehicle.registration,
          fleet: selectedVehicle.fleet,
          mapping_source: 'manual',
          notes: guardianFormData.notes || null
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardian-unit-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['guardian-orphaned-events'] });
      setGuardianDialogOpen(false);
      setGuardianFormData({ id: '', guardian_unit: '', vehicle_id: '', notes: '' });
      toast({ title: 'Success', description: 'Guardian unit mapping added successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const updateGuardianMappingMutation = useMutation({
    mutationFn: async () => {
      const selectedVehicle = vehicles.find(v => v.id === guardianFormData.vehicle_id);
      if (!selectedVehicle) throw new Error('Vehicle not found');

      const { error } = await supabase
        .from('guardian_unit_mappings')
        .update({
          guardian_unit: guardianFormData.guardian_unit,
          vehicle_id: guardianFormData.vehicle_id,
          vehicle_registration: selectedVehicle.registration,
          fleet: selectedVehicle.fleet,
          notes: guardianFormData.notes || null
        })
        .eq('id', guardianFormData.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardian-unit-mappings'] });
      setGuardianDialogOpen(false);
      setGuardianFormData({ id: '', guardian_unit: '', vehicle_id: '', notes: '' });
      toast({ title: 'Success', description: 'Guardian unit mapping updated successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const deleteGuardianMappingMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('guardian_unit_mappings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardian-unit-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['guardian-orphaned-events'] });
      toast({ title: 'Success', description: 'Guardian unit mapping deleted successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // ============================================================================
  // MTDATA MAPPING MUTATIONS
  // ============================================================================

  const addMtDataMappingMutation = useMutation({
    mutationFn: async () => {
      const selectedVehicle = vehicles.find(v => v.id === mtdataFormData.vehicle_id);
      if (!selectedVehicle) throw new Error('Vehicle not found');

      const { error } = await supabase
        .from('mtdata_vehicle_mappings')
        .insert({
          mtdata_vehicle_id: mtdataFormData.mtdata_vehicle_id,
          vehicle_id: mtdataFormData.vehicle_id,
          vehicle_registration: selectedVehicle.registration,
          fleet: selectedVehicle.fleet,
          mapping_source: 'manual',
          notes: mtdataFormData.notes || null
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mtdata-vehicle-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['mtdata-orphaned-trips'] });
      setMtdataDialogOpen(false);
      setMtdataFormData({ id: '', mtdata_vehicle_id: '', vehicle_id: '', notes: '' });
      toast({ title: 'Success', description: 'MtData vehicle mapping added successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const updateMtDataMappingMutation = useMutation({
    mutationFn: async () => {
      const selectedVehicle = vehicles.find(v => v.id === mtdataFormData.vehicle_id);
      if (!selectedVehicle) throw new Error('Vehicle not found');

      const { error } = await supabase
        .from('mtdata_vehicle_mappings')
        .update({
          mtdata_vehicle_id: mtdataFormData.mtdata_vehicle_id,
          vehicle_id: mtdataFormData.vehicle_id,
          vehicle_registration: selectedVehicle.registration,
          fleet: selectedVehicle.fleet,
          notes: mtdataFormData.notes || null
        })
        .eq('id', mtdataFormData.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mtdata-vehicle-mappings'] });
      setMtdataDialogOpen(false);
      setMtdataFormData({ id: '', mtdata_vehicle_id: '', vehicle_id: '', notes: '' });
      toast({ title: 'Success', description: 'MtData vehicle mapping updated successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const deleteMtDataMappingMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('mtdata_vehicle_mappings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mtdata-vehicle-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['mtdata-orphaned-trips'] });
      toast({ title: 'Success', description: 'MtData vehicle mapping deleted successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Helper functions to open dialogs
  const openLytxAddDialog = () => {
    setLytxEditMode(false);
    setLytxFormData({ id: '', device_serial: '', vehicle_id: '', notes: '' });
    setLytxDialogOpen(true);
  };

  const openLytxEditDialog = (mapping: DeviceMapping) => {
    setLytxEditMode(true);
    setLytxFormData({
      id: mapping.id,
      device_serial: mapping.device_serial,
      vehicle_id: mapping.vehicle_id,
      notes: ''
    });
    setLytxDialogOpen(true);
  };

  const openGuardianAddDialog = () => {
    setGuardianEditMode(false);
    setGuardianFormData({ id: '', guardian_unit: '', vehicle_id: '', notes: '' });
    setGuardianDialogOpen(true);
  };

  const openGuardianEditDialog = (mapping: GuardianMapping) => {
    setGuardianEditMode(true);
    setGuardianFormData({
      id: mapping.id,
      guardian_unit: mapping.guardian_unit,
      vehicle_id: mapping.vehicle_id,
      notes: ''
    });
    setGuardianDialogOpen(true);
  };

  const openMtDataAddDialog = () => {
    setMtdataEditMode(false);
    setMtdataFormData({ id: '', mtdata_vehicle_id: '', vehicle_id: '', notes: '' });
    setMtdataDialogOpen(true);
  };

  const openMtDataEditDialog = (mapping: MtDataMapping) => {
    setMtdataEditMode(true);
    setMtdataFormData({
      id: mapping.id,
      mtdata_vehicle_id: mapping.mtdata_vehicle_id,
      vehicle_id: mapping.vehicle_id,
      notes: ''
    });
    setMtdataDialogOpen(true);
  };

  const handleLytxSubmit = () => {
    if (!lytxFormData.device_serial || !lytxFormData.vehicle_id) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    if (lytxEditMode) {
      updateLytxMappingMutation.mutate();
    } else {
      addLytxMappingMutation.mutate();
    }
  };

  const handleGuardianSubmit = () => {
    if (!guardianFormData.guardian_unit || !guardianFormData.vehicle_id) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    if (guardianEditMode) {
      updateGuardianMappingMutation.mutate();
    } else {
      addGuardianMappingMutation.mutate();
    }
  };

  const handleMtDataSubmit = () => {
    if (!mtdataFormData.mtdata_vehicle_id || !mtdataFormData.vehicle_id) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    if (mtdataEditMode) {
      updateMtDataMappingMutation.mutate();
    } else {
      addMtDataMappingMutation.mutate();
    }
  };

  return (
    <DataCentreLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Database className="h-6 w-6 text-blue-600" />
              Master Data Configuration
            </h1>
            <p className="text-gray-600 mt-1">
              Single source of truth for vehicle, driver, and system data mappings
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Vehicles</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {loadingStats ? '...' : stats?.total_vehicles || 0}
                  </p>
                </div>
                <Truck className="h-6 w-6 text-blue-500" />
              </div>
              {stats && stats.vehicles_by_fleet.length > 0 && (
                <div className="mt-2 text-xs text-gray-600 space-y-1">
                  {stats.vehicles_by_fleet.map((item) => (
                    <div key={item.fleet} className="flex justify-between">
                      <span className="text-gray-500">{item.fleet}:</span>
                      <span className="font-medium">{item.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Drivers</p>
                  <p className="text-2xl font-bold text-green-600">
                    {loadingStats ? '...' : stats?.total_drivers || 0}
                  </p>
                </div>
                <Users className="h-6 w-6 text-green-500" />
              </div>
              {stats && stats.drivers_by_fleet.length > 0 && (
                <div className="mt-2 text-xs text-gray-600 space-y-1">
                  {stats.drivers_by_fleet.map((item) => (
                    <div key={item.fleet} className="flex justify-between">
                      <span className="text-gray-500">{item.fleet}:</span>
                      <span className="font-medium">{item.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Guardian Events</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {loadingStats ? '...' : stats?.total_guardian_events?.toLocaleString() || 0}
                  </p>
                </div>
                <Database className="h-6 w-6 text-purple-500" />
              </div>
              <div className="mt-2 text-xs text-gray-600">
                <span className="text-gray-500">Total records in system</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Data Quality</p>
                  <p className={`text-2xl font-bold ${mismatches.length > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    {loadingMismatches ? '...' : mismatches.length === 0 ? '100%' : `${Math.max(0, 100 - (mismatches.length * 0.1)).toFixed(1)}%`}
                  </p>
                </div>
                {mismatches.length === 0 ? (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-orange-500" />
                )}
              </div>
              <div className="mt-2 text-xs text-gray-600">
                {mismatches.length === 0 ? (
                  <span className="text-green-600 font-medium">No mismatches found</span>
                ) : (
                  <span className="text-orange-600 font-medium">{mismatches.length} mismatches</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mismatch Alert */}
        {mismatches.length > 0 && (
          <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-lg">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-orange-400 mt-0.5" />
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-orange-800">
                  Fleet Assignment Mismatches Detected
                </h3>
                <p className="text-sm text-orange-700 mt-1">
                  {mismatches.length} vehicle(s) have Guardian events with incorrect fleet assignments.
                  Use the Data Sync tab to fix these issues.
                </p>
              </div>
              <Button
                onClick={handleSyncFleet}
                disabled={syncInProgress}
                variant="outline"
                size="sm"
                className="ml-4 border-orange-300 text-orange-700 hover:bg-orange-100"
              >
                {syncInProgress ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <GitMerge className="h-4 w-4 mr-2" />
                    Sync Now
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Main Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>Master Data Management</CardTitle>
            <CardDescription>
              Manage vehicle and driver fleet assignments, system mappings, data sync, and quality validation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-7 mb-4">
                <TabsTrigger value="vehicles">
                  <Truck className="h-4 w-4 mr-2" />
                  Vehicles
                </TabsTrigger>
                <TabsTrigger value="drivers">
                  <Users className="h-4 w-4 mr-2" />
                  Drivers
                </TabsTrigger>
                <TabsTrigger value="lytx">
                  <Video className="h-4 w-4 mr-2" />
                  LYTX Mapping
                </TabsTrigger>
                <TabsTrigger value="guardian">
                  <Shield className="h-4 w-4 mr-2" />
                  Guardian Mapping
                </TabsTrigger>
                <TabsTrigger value="mtdata">
                  <Navigation className="h-4 w-4 mr-2" />
                  MtData Mapping
                </TabsTrigger>
                <TabsTrigger value="sync">
                  <Database className="h-4 w-4 mr-2" />
                  Data Sync
                </TabsTrigger>
                <TabsTrigger value="geospatial">
                  <MapPin className="h-4 w-4 mr-2" />
                  Geospatial
                </TabsTrigger>
              </TabsList>

              {/* Vehicles Tab */}
              <TabsContent value="vehicles" className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">Vehicle Fleet Assignments</h4>
                  <p className="text-sm text-blue-700">
                    This is the master source of truth for vehicle fleet assignments. All Guardian events
                    should be synchronized to match these fleet assignments.
                  </p>
                </div>

                {loadingVehicles ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-600 mt-2">Loading vehicles...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">
                        Showing {vehicles.length} vehicles
                      </p>
                      <Button
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['vehicles'] })}
                        variant="outline"
                        size="sm"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                      </Button>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Registration
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Fleet Assignment
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Depot
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Status
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Guardian Unit
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {vehicles.slice(0, 20).map((vehicle) => (
                            <tr key={vehicle.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                {vehicle.registration}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <Badge
                                  variant="outline"
                                  className={
                                    vehicle.fleet === 'Stevemacs'
                                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                                      : 'bg-green-100 text-green-800 border-green-200'
                                  }
                                >
                                  {vehicle.fleet}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {vehicle.depot}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <Badge variant="outline" className="text-xs">
                                  {vehicle.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {vehicle.guardian_unit || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {vehicles.length > 20 && (
                      <p className="text-sm text-gray-500 text-center">
                        Showing first 20 of {vehicles.length} vehicles. Use the Vehicle Database page for full management.
                      </p>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* Drivers Tab */}
              <TabsContent value="drivers" className="space-y-4">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="font-medium text-green-900 mb-2">Driver Fleet Assignments</h4>
                  <p className="text-sm text-green-700">
                    Driver fleet assignments control access and filtering in Driver Management.
                    Ensure all drivers are assigned to the correct fleet.
                  </p>
                </div>

                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Driver Management</h3>
                  <p className="text-gray-600 mb-4">
                    Use the Driver Management page to view and edit driver fleet assignments
                  </p>
                  <Button
                    onClick={() => window.location.href = '/data-centre/fleet/drivers'}
                    variant="outline"
                  >
                    Go to Driver Management
                  </Button>
                </div>
              </TabsContent>

              {/* LYTX Mapping Tab */}
              <TabsContent value="lytx" className="space-y-4">
                <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <h4 className="font-medium text-orange-900 mb-2">LYTX Device → Vehicle Mapping</h4>
                  <p className="text-sm text-orange-700">
                    Map LYTX device serial numbers to vehicles in the master fleet database.
                    This enables correct fleet attribution for LYTX safety events.
                  </p>
                </div>

                {/* Orphaned Devices Alert */}
                {orphanedLytx.length > 0 && (
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
                    <div className="flex items-start">
                      <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">
                          {orphanedLytx.length} Unmapped Device(s) Detected
                        </h3>
                        <p className="text-sm text-yellow-700 mt-1">
                          These devices have LYTX events but no vehicle mapping. Add mappings to enable fleet attribution.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Orphaned Devices Table */}
                {orphanedLytx.length > 0 && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">Unmapped LYTX Devices</h5>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Device Serial</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Fleet</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event Count</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Event</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {orphanedLytx.slice(0, 20).map((device, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">{device.device_serial}</td>
                              <td className="px-4 py-3">
                                <Badge variant="outline">{device.current_fleet}</Badge>
                              </td>
                              <td className="px-4 py-3 text-gray-600">{device.event_count}</td>
                              <td className="px-4 py-3 text-gray-600">
                                {new Date(device.last_event).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {orphanedLytx.length > 20 && (
                      <p className="text-xs text-gray-500 text-center mt-2">
                        Showing first 20 of {orphanedLytx.length} unmapped devices
                      </p>
                    )}
                  </div>
                )}

                {/* Existing Mappings */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-gray-900">Existing Device Mappings ({lytxMappings.length})</h5>
                    <Button size="sm" variant="outline" onClick={openLytxAddDialog}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Mapping
                    </Button>
                  </div>

                  {loadingLytxMappings ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
                    </div>
                  ) : lytxMappings.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <Video className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No LYTX device mappings configured yet</p>
                      <p className="text-sm text-gray-500 mt-1">Add mappings to enable device → vehicle attribution</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Device Serial</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fleet</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {lytxMappings.slice(0, 20).map((mapping) => (
                            <tr key={mapping.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">{mapping.device_serial}</td>
                              <td className="px-4 py-3 text-gray-900">{mapping.vehicle_registration}</td>
                              <td className="px-4 py-3">
                                <Badge
                                  variant="outline"
                                  className={
                                    mapping.fleet === 'Stevemacs'
                                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                                      : 'bg-green-100 text-green-800 border-green-200'
                                  }
                                >
                                  {mapping.fleet}
                                </Badge>
                              </td>
                              <td className="px-4 py-3">
                                {mapping.verified ? (
                                  <Badge variant="outline" className="bg-green-100 text-green-800">Verified</Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-gray-100 text-gray-800">Unverified</Badge>
                                )}
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {new Date(mapping.created_at).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openLytxEditDialog(mapping)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      if (confirm('Are you sure you want to delete this mapping?')) {
                                        deleteLytxMappingMutation.mutate(mapping.id);
                                      }
                                    }}
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {lytxMappings.length > 20 && (
                    <p className="text-xs text-gray-500 text-center mt-2">
                      Showing first 20 of {lytxMappings.length} mappings
                    </p>
                  )}
                </div>
              </TabsContent>

              {/* Guardian Mapping Tab */}
              <TabsContent value="guardian" className="space-y-4">
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <h4 className="font-medium text-purple-900 mb-2">Guardian Unit → Vehicle Mapping</h4>
                  <p className="text-sm text-purple-700">
                    Map Guardian unit IDs to vehicles in the master fleet database.
                    This enables correct fleet attribution for Guardian events.
                  </p>
                </div>

                {/* Orphaned Units Alert */}
                {orphanedGuardian.length > 0 && (
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
                    <div className="flex items-start">
                      <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">
                          {orphanedGuardian.length} Unmapped Unit(s) Detected
                        </h3>
                        <p className="text-sm text-yellow-700 mt-1">
                          These units have Guardian events but no vehicle mapping. Add mappings to enable fleet attribution.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Orphaned Units Table */}
                {orphanedGuardian.length > 0 && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">Unmapped Guardian Units</h5>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guardian Unit</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Fleet</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event Count</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Event</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {orphanedGuardian.slice(0, 20).map((unit, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">{unit.guardian_unit}</td>
                              <td className="px-4 py-3">
                                <Badge variant="outline">{unit.current_fleet}</Badge>
                              </td>
                              <td className="px-4 py-3 text-gray-600">{unit.event_count}</td>
                              <td className="px-4 py-3 text-gray-600">
                                {new Date(unit.last_event).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {orphanedGuardian.length > 20 && (
                      <p className="text-xs text-gray-500 text-center mt-2">
                        Showing first 20 of {orphanedGuardian.length} unmapped units
                      </p>
                    )}
                  </div>
                )}

                {/* Existing Mappings */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-gray-900">Existing Unit Mappings ({guardianMappings.length})</h5>
                    <Button size="sm" variant="outline" onClick={openGuardianAddDialog}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Mapping
                    </Button>
                  </div>

                  {loadingGuardianMappings ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                    </div>
                  ) : guardianMappings.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No Guardian unit mappings configured yet</p>
                      <p className="text-sm text-gray-500 mt-1">Add mappings to enable unit → vehicle attribution</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guardian Unit</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fleet</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {guardianMappings.slice(0, 20).map((mapping) => (
                            <tr key={mapping.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">{mapping.guardian_unit}</td>
                              <td className="px-4 py-3 text-gray-900">{mapping.vehicle_registration}</td>
                              <td className="px-4 py-3">
                                <Badge
                                  variant="outline"
                                  className={
                                    mapping.fleet === 'Stevemacs'
                                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                                      : 'bg-green-100 text-green-800 border-green-200'
                                  }
                                >
                                  {mapping.fleet}
                                </Badge>
                              </td>
                              <td className="px-4 py-3">
                                {mapping.verified ? (
                                  <Badge variant="outline" className="bg-green-100 text-green-800">Verified</Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-gray-100 text-gray-800">Unverified</Badge>
                                )}
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {new Date(mapping.created_at).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openGuardianEditDialog(mapping)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      if (confirm('Are you sure you want to delete this mapping?')) {
                                        deleteGuardianMappingMutation.mutate(mapping.id);
                                      }
                                    }}
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {guardianMappings.length > 20 && (
                    <p className="text-xs text-gray-500 text-center mt-2">
                      Showing first 20 of {guardianMappings.length} mappings
                    </p>
                  )}
                </div>
              </TabsContent>

              {/* MtData Mapping Tab */}
              <TabsContent value="mtdata" className="space-y-4">
                <div className="p-4 bg-teal-50 rounded-lg border border-teal-200">
                  <h4 className="font-medium text-teal-900 mb-2">MtData Vehicle → Vehicle Mapping</h4>
                  <p className="text-sm text-teal-700">
                    Map MtData vehicle IDs to vehicles in the master fleet database.
                    This enables correct fleet attribution for MtData trip history and geospatial correlation.
                  </p>
                </div>

                {/* Orphaned Trips Alert */}
                {orphanedMtData.length > 0 && (
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
                    <div className="flex items-start">
                      <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">
                          {orphanedMtData.length} Unmapped Vehicle(s) Detected
                        </h3>
                        <p className="text-sm text-yellow-700 mt-1">
                          These vehicles have MtData trips but no vehicle mapping. Add mappings to enable fleet attribution and geospatial correlation.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Orphaned Trips Table */}
                {orphanedMtData.length > 0 && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">Unmapped MtData Vehicles</h5>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">MtData Vehicle ID</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Fleet</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trip Count</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Trip</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {orphanedMtData.slice(0, 20).map((vehicle, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">{vehicle.mtdata_vehicle_id}</td>
                              <td className="px-4 py-3">
                                <Badge variant="outline">{vehicle.current_fleet}</Badge>
                              </td>
                              <td className="px-4 py-3 text-gray-600">{vehicle.trip_count}</td>
                              <td className="px-4 py-3 text-gray-600">
                                {new Date(vehicle.last_trip).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {orphanedMtData.length > 20 && (
                      <p className="text-xs text-gray-500 text-center mt-2">
                        Showing first 20 of {orphanedMtData.length} unmapped vehicles
                      </p>
                    )}
                  </div>
                )}

                {/* Existing Mappings */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-gray-900">Existing Vehicle Mappings ({mtdataMappings.length})</h5>
                    <Button size="sm" variant="outline" onClick={openMtDataAddDialog}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Mapping
                    </Button>
                  </div>

                  {loadingMtDataMappings ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
                    </div>
                  ) : mtdataMappings.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <Navigation className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No MtData vehicle mappings configured yet</p>
                      <p className="text-sm text-gray-500 mt-1">Add mappings to enable vehicle → vehicle attribution</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">MtData Vehicle ID</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fleet</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {mtdataMappings.slice(0, 20).map((mapping) => (
                            <tr key={mapping.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">{mapping.mtdata_vehicle_id}</td>
                              <td className="px-4 py-3 text-gray-900">{mapping.vehicle_registration}</td>
                              <td className="px-4 py-3">
                                <Badge
                                  variant="outline"
                                  className={
                                    mapping.fleet === 'Stevemacs'
                                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                                      : 'bg-green-100 text-green-800 border-green-200'
                                  }
                                >
                                  {mapping.fleet}
                                </Badge>
                              </td>
                              <td className="px-4 py-3">
                                {mapping.verified ? (
                                  <Badge variant="outline" className="bg-green-100 text-green-800">Verified</Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-gray-100 text-gray-800">Unverified</Badge>
                                )}
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {new Date(mapping.created_at).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openMtDataEditDialog(mapping)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      if (confirm('Are you sure you want to delete this mapping?')) {
                                        deleteMtDataMappingMutation.mutate(mapping.id);
                                      }
                                    }}
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {mtdataMappings.length > 20 && (
                    <p className="text-xs text-gray-500 text-center mt-2">
                      Showing first 20 of {mtdataMappings.length} mappings
                    </p>
                  )}
                </div>
              </TabsContent>

              {/* Data Sync Tab */}
              <TabsContent value="sync" className="space-y-4">
                <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                  <h4 className="font-medium text-indigo-900 mb-2">Cross-System Data Synchronization</h4>
                  <p className="text-sm text-indigo-700">
                    Synchronize fleet assignments across all data systems (LYTX, Guardian, MtData) with master vehicle mappings.
                    This ensures accurate fleet attribution in all analytics and reporting.
                  </p>
                </div>

                {/* Sync All Systems Action Card */}
                <Card className="border-2 border-indigo-200">
                  <CardHeader className="bg-indigo-50">
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-indigo-600" />
                      Sync All Systems
                    </CardTitle>
                    <CardDescription>
                      Synchronize LYTX, Guardian, and MtData with master data mappings in one operation
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <Video className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                        <h5 className="font-medium text-gray-900">LYTX Safety</h5>
                        <p className="text-xs text-gray-600 mt-1">
                          {orphanedLytx.length} unmapped
                        </p>
                      </div>
                      <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <Shield className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                        <h5 className="font-medium text-gray-900">Guardian</h5>
                        <p className="text-xs text-gray-600 mt-1">
                          {orphanedGuardian.length} unmapped
                        </p>
                      </div>
                      <div className="p-4 bg-teal-50 rounded-lg border border-teal-200">
                        <Navigation className="h-8 w-8 text-teal-600 mx-auto mb-2" />
                        <h5 className="font-medium text-gray-900">MtData</h5>
                        <p className="text-xs text-gray-600 mt-1">
                          {orphanedMtData.length} unmapped
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h5 className="font-medium text-gray-900 mb-2">What this does:</h5>
                      <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
                        <li>Syncs LYTX events with device mappings</li>
                        <li>Syncs Guardian events with unit mappings</li>
                        <li>Syncs MtData trips with vehicle mappings</li>
                        <li>Updates fleet assignments across all systems</li>
                        <li>Logs all operations in sync audit trail</li>
                      </ul>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="text-sm text-gray-600">
                        {(orphanedLytx.length + orphanedGuardian.length + orphanedMtData.length) === 0 ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            <span>All systems are correctly synchronized</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-orange-600">
                            <AlertTriangle className="h-4 w-4" />
                            <span>
                              {(orphanedLytx.length + orphanedGuardian.length + orphanedMtData.length)} total unmapped record(s)
                            </span>
                          </div>
                        )}
                      </div>
                      <Button
                        onClick={handleSyncAllSystems}
                        disabled={syncInProgress}
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        {syncInProgress ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Syncing All...
                          </>
                        ) : (
                          <>
                            <Database className="h-4 w-4 mr-2" />
                            Sync All Systems
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Sync Action Card */}
                <Card className="border-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GitMerge className="h-5 w-5 text-purple-600" />
                      Sync Guardian Events
                    </CardTitle>
                    <CardDescription>
                      Update all Guardian event fleet assignments to match vehicle master data
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h5 className="font-medium text-gray-900 mb-2">What this does:</h5>
                      <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
                        <li>Matches guardian_events to vehicles by registration number</li>
                        <li>Updates guardian_events.fleet to match vehicles.fleet</li>
                        <li>Fixes mismatched fleet assignments from CSV imports</li>
                        <li>Ensures accurate fleet filtering in Guardian analytics</li>
                      </ul>
                    </div>

                    {mismatches.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="font-medium text-gray-900">Mismatches to Fix:</h5>
                        <div className="border rounded-lg max-h-60 overflow-y-auto">
                          <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Vehicle</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Correct Fleet</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Event Fleet</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Events</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {mismatches.slice(0, 10).map((mismatch, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 font-medium">{mismatch.vehicle_registration}</td>
                                  <td className="px-3 py-2">
                                    <Badge variant="outline" className="bg-green-100 text-green-800">
                                      {mismatch.vehicle_fleet}
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-2">
                                    <Badge variant="outline" className="bg-red-100 text-red-800">
                                      {mismatch.event_fleet}
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-2 text-gray-600">{mismatch.event_count}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {mismatches.length > 10 && (
                          <p className="text-xs text-gray-500 text-center">
                            Showing first 10 of {mismatches.length} mismatches
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="text-sm text-gray-600">
                        {mismatches.length === 0 ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            <span>All Guardian events are correctly assigned</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-orange-600">
                            <AlertTriangle className="h-4 w-4" />
                            <span>{mismatches.length} mismatch(es) need correction</span>
                          </div>
                        )}
                      </div>
                      <Button
                        onClick={handleSyncFleet}
                        disabled={syncInProgress || mismatches.length === 0}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        {syncInProgress ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <GitMerge className="h-4 w-4 mr-2" />
                            Run Sync
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Sync History/Results */}
                {syncFleetMutation.isSuccess && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-800">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Sync completed successfully!</span>
                    </div>
                    <p className="text-sm text-green-700 mt-1">
                      All Guardian event fleet assignments have been synchronized with vehicle master data.
                    </p>
                  </div>
                )}

                {syncFleetMutation.isError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-800">
                      <AlertTriangle className="h-5 w-5" />
                      <span className="font-medium">Sync failed</span>
                    </div>
                    <p className="text-sm text-red-700 mt-1">
                      {syncFleetMutation.error?.message || 'An error occurred during synchronization. Please try again.'}
                    </p>
                  </div>
                )}

                {/* Sync Results for All Systems */}
                {syncAllSystemsMutation.isSuccess && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-800">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">All systems synchronized successfully!</span>
                    </div>
                    <p className="text-sm text-green-700 mt-1">
                      LYTX, Guardian, and MtData have been synchronized with master data mappings.
                    </p>
                  </div>
                )}

                {syncAllSystemsMutation.isError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-800">
                      <AlertTriangle className="h-5 w-5" />
                      <span className="font-medium">Sync failed</span>
                    </div>
                    <p className="text-sm text-red-700 mt-1">
                      {syncAllSystemsMutation.error?.message || 'An error occurred during synchronization. Please try again.'}
                    </p>
                  </div>
                )}
              </TabsContent>

              {/* Geospatial Correlation Tab */}
              <TabsContent value="geospatial" className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">Geospatial Trip-Delivery Correlation</h4>
                  <p className="text-sm text-blue-700">
                    Future feature: Correlate MtData trip GPS coordinates with Captive Payment delivery locations
                    to validate delivery attribution and detect discrepancies.
                  </p>
                </div>

                <Card className="border-2 border-dashed border-gray-300">
                  <CardContent className="pt-12 pb-12">
                    <div className="text-center">
                      <MapPin className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        Geospatial Correlation
                      </h3>
                      <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
                        This feature will enable automatic correlation between MtData trip GPS coordinates
                        and Captive Payment delivery locations. This will help:
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto mb-8">
                        <div className="p-4 bg-gray-50 rounded-lg text-left">
                          <h4 className="font-medium text-gray-900 mb-2">Trip Validation</h4>
                          <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
                            <li>Match trip GPS with delivery addresses</li>
                            <li>Validate vehicle-to-delivery attribution</li>
                            <li>Detect missing or incorrect assignments</li>
                          </ul>
                        </div>

                        <div className="p-4 bg-gray-50 rounded-lg text-left">
                          <h4 className="font-medium text-gray-900 mb-2">Data Quality</h4>
                          <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
                            <li>Identify orphaned deliveries</li>
                            <li>Find trips without deliveries</li>
                            <li>Calculate correlation confidence scores</li>
                          </ul>
                        </div>

                        <div className="p-4 bg-gray-50 rounded-lg text-left">
                          <h4 className="font-medium text-gray-900 mb-2">Route Analysis</h4>
                          <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
                            <li>Visualize trip routes on map</li>
                            <li>Overlay delivery locations</li>
                            <li>Analyze route efficiency</li>
                          </ul>
                        </div>

                        <div className="p-4 bg-gray-50 rounded-lg text-left">
                          <h4 className="font-medium text-gray-900 mb-2">Reporting</h4>
                          <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
                            <li>Generate correlation reports</li>
                            <li>Export validated trip-delivery pairs</li>
                            <li>Track correlation trends over time</li>
                          </ul>
                        </div>
                      </div>

                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 max-w-2xl mx-auto">
                        <h4 className="font-medium text-blue-900 mb-2">Prerequisites</h4>
                        <div className="text-sm text-blue-700 space-y-1">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span>MtData vehicle mappings configured</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span>Captive Payment delivery data imported</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-orange-600" />
                            <span>Geocoding API integration (pending)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-orange-600" />
                            <span>Correlation algorithm implementation (pending)</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-gray-500 mt-6 text-sm italic">
                        This feature is planned for a future release. Contact the development team for timeline and requirements.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Understanding Master Data Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Why Master Data?</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• Single source of truth for fleet assignments</li>
                  <li>• Prevents data inconsistencies from CSV imports</li>
                  <li>• Ensures accurate analytics and reporting</li>
                  <li>• Simplifies fleet management across systems</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Data Sync Process</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• Runs SQL update based on vehicle registration</li>
                  <li>• Updates guardian_events.fleet from vehicles.fleet</li>
                  <li>• Safe to run multiple times (idempotent)</li>
                  <li>• No data loss - only updates fleet field</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ====================================================================== */}
      {/* DIALOG COMPONENTS */}
      {/* ====================================================================== */}

      {/* LYTX Device Mapping Dialog */}
      <Dialog open={lytxDialogOpen} onOpenChange={setLytxDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {lytxEditMode ? 'Edit LYTX Device Mapping' : 'Add LYTX Device Mapping'}
            </DialogTitle>
            <DialogDescription>
              Map a LYTX device serial number to a vehicle in the fleet database.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lytx-device-serial">
                Device Serial <span className="text-red-500">*</span>
              </Label>
              <Input
                id="lytx-device-serial"
                value={lytxFormData.device_serial}
                onChange={(e) => setLytxFormData({ ...lytxFormData, device_serial: e.target.value })}
                placeholder="Enter LYTX device serial number"
                disabled={lytxEditMode}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lytx-vehicle">
                Vehicle <span className="text-red-500">*</span>
              </Label>
              <Select
                value={lytxFormData.vehicle_id}
                onValueChange={(value) => setLytxFormData({ ...lytxFormData, vehicle_id: value })}
              >
                <SelectTrigger id="lytx-vehicle">
                  <SelectValue placeholder="Select a vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.registration} ({vehicle.fleet})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lytx-notes">Notes (optional)</Label>
              <Input
                id="lytx-notes"
                value={lytxFormData.notes}
                onChange={(e) => setLytxFormData({ ...lytxFormData, notes: e.target.value })}
                placeholder="Add any notes about this mapping"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLytxDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleLytxSubmit}
              disabled={addLytxMappingMutation.isPending || updateLytxMappingMutation.isPending}
            >
              {(addLytxMappingMutation.isPending || updateLytxMappingMutation.isPending) ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                lytxEditMode ? 'Update Mapping' : 'Add Mapping'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Guardian Unit Mapping Dialog */}
      <Dialog open={guardianDialogOpen} onOpenChange={setGuardianDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {guardianEditMode ? 'Edit Guardian Unit Mapping' : 'Add Guardian Unit Mapping'}
            </DialogTitle>
            <DialogDescription>
              Map a Guardian unit ID to a vehicle in the fleet database.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="guardian-unit">
                Guardian Unit <span className="text-red-500">*</span>
              </Label>
              <Input
                id="guardian-unit"
                value={guardianFormData.guardian_unit}
                onChange={(e) => setGuardianFormData({ ...guardianFormData, guardian_unit: e.target.value })}
                placeholder="Enter Guardian unit ID"
                disabled={guardianEditMode}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="guardian-vehicle">
                Vehicle <span className="text-red-500">*</span>
              </Label>
              <Select
                value={guardianFormData.vehicle_id}
                onValueChange={(value) => setGuardianFormData({ ...guardianFormData, vehicle_id: value })}
              >
                <SelectTrigger id="guardian-vehicle">
                  <SelectValue placeholder="Select a vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.registration} ({vehicle.fleet})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="guardian-notes">Notes (optional)</Label>
              <Input
                id="guardian-notes"
                value={guardianFormData.notes}
                onChange={(e) => setGuardianFormData({ ...guardianFormData, notes: e.target.value })}
                placeholder="Add any notes about this mapping"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setGuardianDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleGuardianSubmit}
              disabled={addGuardianMappingMutation.isPending || updateGuardianMappingMutation.isPending}
            >
              {(addGuardianMappingMutation.isPending || updateGuardianMappingMutation.isPending) ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                guardianEditMode ? 'Update Mapping' : 'Add Mapping'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MtData Vehicle Mapping Dialog */}
      <Dialog open={mtdataDialogOpen} onOpenChange={setMtdataDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {mtdataEditMode ? 'Edit MtData Vehicle Mapping' : 'Add MtData Vehicle Mapping'}
            </DialogTitle>
            <DialogDescription>
              Map an MtData vehicle ID to a vehicle in the fleet database.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="mtdata-vehicle-id">
                MtData Vehicle ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="mtdata-vehicle-id"
                value={mtdataFormData.mtdata_vehicle_id}
                onChange={(e) => setMtdataFormData({ ...mtdataFormData, mtdata_vehicle_id: e.target.value })}
                placeholder="Enter MtData vehicle ID"
                disabled={mtdataEditMode}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mtdata-vehicle">
                Vehicle <span className="text-red-500">*</span>
              </Label>
              <Select
                value={mtdataFormData.vehicle_id}
                onValueChange={(value) => setMtdataFormData({ ...mtdataFormData, vehicle_id: value })}
              >
                <SelectTrigger id="mtdata-vehicle">
                  <SelectValue placeholder="Select a vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.registration} ({vehicle.fleet})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mtdata-notes">Notes (optional)</Label>
              <Input
                id="mtdata-notes"
                value={mtdataFormData.notes}
                onChange={(e) => setMtdataFormData({ ...mtdataFormData, notes: e.target.value })}
                placeholder="Add any notes about this mapping"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMtdataDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleMtDataSubmit}
              disabled={addMtDataMappingMutation.isPending || updateMtDataMappingMutation.isPending}
            >
              {(addMtDataMappingMutation.isPending || updateMtDataMappingMutation.isPending) ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                mtdataEditMode ? 'Update Mapping' : 'Add Mapping'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DataCentreLayout>
  );
};

export default MasterDataPage;
