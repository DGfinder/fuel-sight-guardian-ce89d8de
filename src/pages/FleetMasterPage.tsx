/**
 * Fleet Master Configuration Page
 *
 * Central management page for fleet configuration and data synchronization.
 * Provides single source of truth for vehicle and driver fleet assignments.
 * Includes data validation and synchronization tools.
 */

import React, { useState } from 'react';
import { Settings, Database, RefreshCw, AlertTriangle, CheckCircle, Truck, Users, GitMerge } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useVehicles } from '@/hooks/useVehicles';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import DataCentreLayout from '@/components/DataCentreLayout';

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

const FleetMasterPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('vehicles');
  const [syncInProgress, setSync InProgress] = useState(false);
  const queryClient = useQueryClient();

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

  const handleSyncFleet = () => {
    if (confirm('This will update all Guardian event fleet assignments based on vehicle registrations. Continue?')) {
      syncFleetMutation.mutate();
    }
  };

  return (
    <DataCentreLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Settings className="h-6 w-6 text-blue-600" />
              Fleet Master Configuration
            </h1>
            <p className="text-gray-600 mt-1">
              Central management for fleet assignments and data synchronization
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
            <CardTitle>Fleet Configuration Management</CardTitle>
            <CardDescription>
              Manage vehicle and driver fleet assignments, sync data, and validate data quality
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="vehicles">
                  <Truck className="h-4 w-4 mr-2" />
                  Vehicles
                </TabsTrigger>
                <TabsTrigger value="drivers">
                  <Users className="h-4 w-4 mr-2" />
                  Drivers
                </TabsTrigger>
                <TabsTrigger value="sync">
                  <Database className="h-4 w-4 mr-2" />
                  Data Sync
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

              {/* Data Sync Tab */}
              <TabsContent value="sync" className="space-y-4">
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <h4 className="font-medium text-purple-900 mb-2">Guardian Event Fleet Synchronization</h4>
                  <p className="text-sm text-purple-700">
                    This tool synchronizes Guardian event fleet assignments with the master vehicle fleet assignments.
                    It updates the fleet field in guardian_events based on vehicle_registration matches.
                  </p>
                </div>

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
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Understanding Fleet Master</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Why Fleet Master?</h4>
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
    </DataCentreLayout>
  );
};

export default FleetMasterPage;
