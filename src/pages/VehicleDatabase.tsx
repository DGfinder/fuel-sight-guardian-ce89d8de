import React, { useState, useMemo } from 'react';
import { Search, Filter, Eye, Wrench, Shield, MapPin, Download, Plus, Edit, AlertTriangle } from 'lucide-react';
import { useVehicles } from '@/hooks/useVehicles';
import type { Vehicle, VehicleFilters } from '@/types/fleet';

const VehicleDatabase = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFleet, setSelectedFleet] = useState<'all' | 'Stevemacs' | 'Great Southern Fuels'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'Active' | 'Maintenance' | 'Out of Service' | 'Available'>('all');
  const [selectedDepot, setSelectedDepot] = useState<'all' | string>('all');
  const [sortField, setSortField] = useState<keyof Vehicle>('registration');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const filters: VehicleFilters = {
    fleet: selectedFleet !== 'all' ? selectedFleet : undefined,
    status: selectedStatus !== 'all' ? selectedStatus : undefined,
    depot: selectedDepot !== 'all' ? selectedDepot : undefined,
    search: searchTerm || undefined
  };

  const { data: vehicles = [], isLoading, error } = useVehicles(filters);

  // Get unique depots from vehicles
  const depots = Array.from(new Set(vehicles.map(v => v.depot))).sort();

  const sortedVehicles = useMemo(() => {
    return [...vehicles].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      return sortDirection === 'asc' 
        ? (aValue < bValue ? -1 : 1)
        : (aValue > bValue ? -1 : 1);
    });
  }, [vehicles, sortField, sortDirection]);

  const handleSort = (field: keyof Vehicle) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800';
      case 'Maintenance':
        return 'bg-yellow-100 text-yellow-800';
      case 'Available':
        return 'bg-blue-100 text-blue-800';
      case 'Out of Service':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Registration', 'Fleet', 'Depot', 'Status', 'Driver', 'Make', 'Model', 'Year', 'VIN',
      'Safety Score', 'Fuel Efficiency', 'Utilization', 'Total Deliveries', 'Total Kilometers',
      'Fatigue Events', 'Safety Events', 'Guardian Unit', 'Lytx Device', 'Last Service', 'Next Service',
      'Registration Expiry', 'Insurance Expiry', 'Inspection Due'
    ];

    const csvContent = [
      headers.join(','),
      ...sortedVehicles.map(vehicle => [
        vehicle.registration,
        vehicle.fleet,
        vehicle.depot,
        vehicle.status,
        vehicle.current_driver || '',
        vehicle.make || '',
        vehicle.model || '',
        vehicle.year || '',
        vehicle.vin || '',
        vehicle.safety_score,
        vehicle.fuel_efficiency,
        vehicle.utilization,
        vehicle.total_deliveries,
        vehicle.total_kilometers,
        vehicle.fatigue_events,
        vehicle.safety_events,
        vehicle.guardian_unit || '',
        vehicle.lytx_device || '',
        vehicle.last_service || '',
        vehicle.next_service || '',
        vehicle.registration_expiry || '',
        vehicle.insurance_expiry || '',
        vehicle.inspection_due || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vehicle-database-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-gray-500">Loading vehicle database...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-red-500">Error loading vehicle database</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Vehicle Database</h1>
        <p className="text-gray-600">Complete fleet registry with detailed vehicle information</p>
      </div>

      {/* Filters and Actions */}
      <div className="mb-6 space-y-4">
        {/* Search and Actions Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Search className="h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search vehicles by registration, make, model, or device..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={exportToCSV}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap gap-4 p-4 bg-white rounded-lg shadow">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <label className="text-sm font-medium text-gray-700">Fleet:</label>
            <select
              value={selectedFleet}
              onChange={(e) => setSelectedFleet(e.target.value as typeof selectedFleet)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Fleets</option>
              <option value="Stevemacs">Stevemacs</option>
              <option value="Great Southern Fuels">Great Southern Fuels</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Status:</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as typeof selectedStatus)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="Active">Active</option>
              <option value="Available">Available</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Out of Service">Out of Service</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Depot:</label>
            <select
              value={selectedDepot}
              onChange={(e) => setSelectedDepot(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Depots</option>
              {depots.map(depot => (
                <option key={depot} value={depot}>{depot}</option>
              ))}
            </select>
          </div>

          <div className="ml-auto text-sm text-gray-600">
            Showing {sortedVehicles.length} vehicles
          </div>
        </div>
      </div>

      {/* Vehicle Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="text-left py-3 px-4 font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('registration')}
                >
                  <div className="flex items-center gap-1">
                    Registration
                    {sortField === 'registration' && (
                      <span className="text-blue-600">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('fleet')}
                >
                  <div className="flex items-center gap-1">
                    Fleet
                    {sortField === 'fleet' && (
                      <span className="text-blue-600">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Depot</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Driver</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Vehicle Info</th>
                <th 
                  className="text-left py-3 px-4 font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('safety_score')}
                >
                  <div className="flex items-center gap-1">
                    Safety
                    {sortField === 'safety_score' && (
                      <span className="text-blue-600">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Performance</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Devices</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Service</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedVehicles.map((vehicle) => (
                <tr key={vehicle.id} className="border-b hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <div className="font-medium text-gray-900">{vehicle.registration}</div>
                    {vehicle.vin && (
                      <div className="text-xs text-gray-500">VIN: {vehicle.vin}</div>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      vehicle.fleet === 'Stevemacs' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {vehicle.fleet}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center text-gray-600">
                      <MapPin className="h-4 w-4 mr-1" />
                      {vehicle.depot}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(vehicle.status)}`}>
                      {vehicle.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-gray-600">
                    {vehicle.current_driver || '-'}
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-sm">
                      {vehicle.make && vehicle.model ? (
                        <div className="font-medium">{vehicle.make} {vehicle.model}</div>
                      ) : (
                        <div className="text-gray-400">-</div>
                      )}
                      {vehicle.year && (
                        <div className="text-gray-500">{vehicle.year}</div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <Shield className="h-3 w-3 text-yellow-500" />
                        <span className="text-sm">{vehicle.safety_score.toFixed(1)}/10</span>
                      </div>
                      {(vehicle.safety_events > 0 || vehicle.fatigue_events > 0) && (
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 text-red-500" />
                          <span className="text-xs text-red-600">
                            {vehicle.safety_events + vehicle.fatigue_events} events
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-sm space-y-1">
                      <div>{vehicle.fuel_efficiency.toFixed(1)} km/L</div>
                      <div className="text-gray-500">{vehicle.utilization}% util</div>
                      <div className="text-gray-500">{vehicle.total_deliveries} deliveries</div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-xs space-y-1">
                      {vehicle.guardian_unit && (
                        <div className="text-blue-600">G: {vehicle.guardian_unit}</div>
                      )}
                      {vehicle.lytx_device && (
                        <div className="text-green-600">L: {vehicle.lytx_device}</div>
                      )}
                      {!vehicle.guardian_unit && !vehicle.lytx_device && (
                        <div className="text-gray-400">No devices</div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-sm space-y-1">
                      {vehicle.next_service && (
                        <div className={`${
                          new Date(vehicle.next_service) < new Date() 
                            ? 'text-red-600' 
                            : new Date(vehicle.next_service) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                            ? 'text-yellow-600'
                            : 'text-gray-600'
                        }`}>
                          {new Date(vehicle.next_service).toLocaleDateString()}
                        </div>
                      )}
                      {!vehicle.next_service && (
                        <div className="text-gray-400">Not scheduled</div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <button className="p-1 text-gray-400 hover:text-blue-600">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-gray-600">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-orange-600">
                        <Wrench className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sortedVehicles.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No vehicles found matching your criteria
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Vehicles</div>
          <div className="text-2xl font-bold text-gray-900">{vehicles.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Active</div>
          <div className="text-2xl font-bold text-green-600">
            {vehicles.filter(v => v.status === 'Active').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Available</div>
          <div className="text-2xl font-bold text-blue-600">
            {vehicles.filter(v => v.status === 'Available').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Maintenance</div>
          <div className="text-2xl font-bold text-yellow-600">
            {vehicles.filter(v => v.status === 'Maintenance').length}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VehicleDatabase;