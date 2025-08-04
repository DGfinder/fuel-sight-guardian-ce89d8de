import React, { useState, useMemo } from 'react';
import { Search, Filter, Eye, Wrench, Shield, MapPin, Download, Plus, Edit, AlertTriangle } from 'lucide-react';

interface Vehicle {
  registration: string;
  fleet: 'Stevemacs' | 'Great Southern Fuels';
  depot: string;
  status: 'Active' | 'Maintenance' | 'Out of Service' | 'Available';
  driver?: string;
  make: string;
  model: string;
  year: number;
  vin: string;
  safetyScore: number;
  fuelEfficiency: number;
  utilization: number;
  lastService: string;
  nextService: string;
  guardianUnit?: string;
  lytxDevice?: string;
  totalDeliveries: number;
  totalKilometers: number;
  fatigueEvents: number;
  safetyEvents: number;
  registrationExpiry: string;
  insuranceExpiry: string;
  inspectionDue: string;
}

// Comprehensive vehicle database with detailed specifications
const vehicleDatabase: Vehicle[] = [
  {
    registration: '1BMU188',
    fleet: 'Stevemacs',
    depot: 'Kewdale',
    status: 'Active',
    driver: 'Brad Cameron',
    make: 'Volvo',
    model: 'FH16',
    year: 2019,
    vin: 'YV2A4D0C4KB123456',
    safetyScore: 8.5,
    fuelEfficiency: 3.2,
    utilization: 85,
    lastService: '2025-07-15',
    nextService: '2025-10-15',
    guardianUnit: 'P1002260-S00002698',
    lytxDevice: 'QM40999887',
    totalDeliveries: 156,
    totalKilometers: 287450,
    fatigueEvents: 2,
    safetyEvents: 5,
    registrationExpiry: '2025-12-15',
    insuranceExpiry: '2025-11-20',
    inspectionDue: '2025-09-30'
  },
  {
    registration: '1GLD510',
    fleet: 'Great Southern Fuels',
    depot: 'Geraldton',
    status: 'Active',
    driver: 'Andrew Buchanan',
    make: 'Scania',
    model: 'R730',
    year: 2020,
    vin: 'YS2R8X20002123457',
    safetyScore: 9.1,
    fuelEfficiency: 3.8,
    utilization: 92,
    lastService: '2025-06-20',
    nextService: '2025-09-20',
    guardianUnit: 'P04025-S00013423',
    lytxDevice: 'MV00252104',
    totalDeliveries: 203,
    totalKilometers: 342180,
    fatigueEvents: 1,
    safetyEvents: 3,
    registrationExpiry: '2026-03-10',
    insuranceExpiry: '2025-10-15',
    inspectionDue: '2025-08-25'
  },
  {
    registration: '1GSF248',
    fleet: 'Great Southern Fuels',
    depot: 'Kalgoorlie',
    status: 'Maintenance',
    driver: undefined,
    make: 'Mercedes-Benz',
    model: 'Actros 2658',
    year: 2018,
    vin: 'WDB9634321L123458',
    safetyScore: 7.8,
    fuelEfficiency: 3.1,
    utilization: 0,
    lastService: '2025-08-01',
    nextService: '2025-11-01',
    guardianUnit: 'P1002260-S00010668',
    lytxDevice: 'QM40025388',
    totalDeliveries: 142,
    totalKilometers: 456220,
    fatigueEvents: 4,
    safetyEvents: 8,
    registrationExpiry: '2025-09-05',
    insuranceExpiry: '2025-12-01',
    inspectionDue: '2025-08-15'
  },
  {
    registration: '1ILI310',
    fleet: 'Stevemacs',
    depot: 'Kewdale',
    status: 'Available',
    driver: undefined,
    make: 'Volvo',
    model: 'FH13',
    year: 2021,
    vin: 'YV2A4D0C4KB123459',
    safetyScore: 8.9,
    fuelEfficiency: 3.5,
    utilization: 0,
    lastService: '2025-07-25',
    nextService: '2025-10-25',
    guardianUnit: 'P1002260-S00010798',
    lytxDevice: 'QM40999887',
    totalDeliveries: 89,
    totalKilometers: 156780,
    fatigueEvents: 0,
    safetyEvents: 2,
    registrationExpiry: '2026-01-20',
    insuranceExpiry: '2025-11-30',
    inspectionDue: '2025-10-10'
  },
  {
    registration: '1HUT976',
    fleet: 'Great Southern Fuels',
    depot: 'Geraldton',
    status: 'Active',
    driver: 'Matthew Ahearn',
    make: 'DAF',
    model: 'XF105',
    year: 2017,
    vin: 'XLRAO85M70E123460',
    safetyScore: 8.3,
    fuelEfficiency: 3.4,
    utilization: 78,
    lastService: '2025-05-30',
    nextService: '2025-08-30',
    guardianUnit: 'P04025-S00010474',
    lytxDevice: 'MV00252082',
    totalDeliveries: 178,
    totalKilometers: 523150,
    fatigueEvents: 3,
    safetyEvents: 6,
    registrationExpiry: '2025-10-12',
    insuranceExpiry: '2025-09-18',
    inspectionDue: '2025-08-20'
  },
  {
    registration: 'QUADADDIC',
    fleet: 'Great Southern Fuels',
    depot: 'Geraldton',
    status: 'Active',
    driver: 'Glen Sawyer',
    make: 'Kenworth',
    model: 'T909',
    year: 2016,
    vin: '4NUVT40E4GN123461',
    safetyScore: 7.6,
    fuelEfficiency: 2.9,
    utilization: 88,
    lastService: '2025-07-10',
    nextService: '2025-10-10',
    guardianUnit: 'P04025-S00010474',
    lytxDevice: 'QM40025417',
    totalDeliveries: 245,
    totalKilometers: 678420,
    fatigueEvents: 5,
    safetyEvents: 12,
    registrationExpiry: '2025-11-08',
    insuranceExpiry: '2025-10-25',
    inspectionDue: '2025-09-15'
  }
];

const VehicleDatabase: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Maintenance' | 'Out of Service' | 'Available'>('All');
  const [fleetFilter, setFleetFilter] = useState<'All' | 'Stevemacs' | 'Great Southern Fuels'>('All');
  const [depotFilter, setDepotFilter] = useState<'All' | 'Kewdale' | 'Geraldton' | 'Kalgoorlie' | 'Narrogin' | 'Albany'>('All');
  const [sortBy, setSortBy] = useState<'registration' | 'utilization' | 'safety' | 'efficiency'>('registration');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Filter and search vehicles
  const filteredVehicles = useMemo(() => {
    let filtered = vehicleDatabase.filter(vehicle => {
      const matchesSearch = vehicle.registration.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          vehicle.driver?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          vehicle.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          vehicle.model.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'All' || vehicle.status === statusFilter;
      const matchesFleet = fleetFilter === 'All' || vehicle.fleet === fleetFilter;
      const matchesDepot = depotFilter === 'All' || vehicle.depot === depotFilter;

      return matchesSearch && matchesStatus && matchesFleet && matchesDepot;
    });

    // Sort results
    filtered.sort((a, b) => {
      let valueA: any, valueB: any;
      
      switch (sortBy) {
        case 'utilization':
          valueA = a.utilization;
          valueB = b.utilization;
          break;
        case 'safety':
          valueA = a.safetyScore;
          valueB = b.safetyScore;
          break;
        case 'efficiency':
          valueA = a.fuelEfficiency;
          valueB = b.fuelEfficiency;
          break;
        default:
          valueA = a.registration;
          valueB = b.registration;
      }

      if (sortOrder === 'asc') {
        return valueA > valueB ? 1 : -1;
      } else {
        return valueA < valueB ? 1 : -1;
      }
    });

    return filtered;
  }, [searchTerm, statusFilter, fleetFilter, depotFilter, sortBy, sortOrder]);

  // Check if vehicle has any expiring items
  const hasExpiringItems = (vehicle: Vehicle) => {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const registrationExpiry = new Date(vehicle.registrationExpiry);
    const insuranceExpiry = new Date(vehicle.insuranceExpiry);
    const inspectionDue = new Date(vehicle.inspectionDue);
    
    return registrationExpiry <= thirtyDaysFromNow || 
           insuranceExpiry <= thirtyDaysFromNow || 
           inspectionDue <= thirtyDaysFromNow;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800 border-green-200';
      case 'Available': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Maintenance': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Out of Service': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getFleetColor = (fleet: string) => {
    return fleet === 'Stevemacs' ? 'text-blue-600' : 'text-green-600';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Vehicle Database</h1>
            <p className="text-gray-600">Comprehensive fleet registry with detailed vehicle information and history</p>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              <Plus className="h-4 w-4" />
              Add Vehicle
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Download className="h-4 w-4" />
              Export Database
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search by registration, driver, make, model..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Available">Available</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Out of Service">Out of Service</option>
          </select>
          
          <select 
            value={fleetFilter} 
            onChange={(e) => setFleetFilter(e.target.value as any)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Carriers</option>
            <option value="Stevemacs">Stevemacs</option>
            <option value="Great Southern Fuels">Great Southern Fuels</option>
          </select>
          
          <select 
            value={depotFilter} 
            onChange={(e) => setDepotFilter(e.target.value as any)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Depots</option>
            <option value="Kewdale">Kewdale</option>
            <option value="Geraldton">Geraldton</option>
            <option value="Kalgoorlie">Kalgoorlie</option>
            <option value="Narrogin">Narrogin</option>
            <option value="Albany">Albany</option>
          </select>

          <select 
            value={`${sortBy}-${sortOrder}`} 
            onChange={(e) => {
              const [field, order] = e.target.value.split('-');
              setSortBy(field as any);
              setSortOrder(order as any);
            }}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="registration-asc">Registration A-Z</option>
            <option value="registration-desc">Registration Z-A</option>
            <option value="utilization-desc">Highest Utilization</option>
            <option value="utilization-asc">Lowest Utilization</option>
            <option value="safety-desc">Highest Safety Score</option>
            <option value="safety-asc">Lowest Safety Score</option>
            <option value="efficiency-desc">Most Efficient</option>
            <option value="efficiency-asc">Least Efficient</option>
          </select>
        </div>

        {/* Results Summary */}
        <div className="text-sm text-gray-600 mb-4">
          Showing {filteredVehicles.length} of {vehicleDatabase.length} vehicles
        </div>
      </div>

      {/* Vehicle Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4 font-medium text-gray-900">Vehicle</th>
                <th className="text-left p-4 font-medium text-gray-900">Fleet & Driver</th>
                <th className="text-left p-4 font-medium text-gray-900">Status</th>
                <th className="text-left p-4 font-medium text-gray-900">Performance</th>
                <th className="text-left p-4 font-medium text-gray-900">Safety</th>
                <th className="text-left p-4 font-medium text-gray-900">Compliance</th>
                <th className="text-left p-4 font-medium text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredVehicles.map((vehicle) => (
                <tr key={vehicle.registration} className="hover:bg-gray-50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {hasExpiringItems(vehicle) && (
                        <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                      )}
                      <div>
                        <div className="font-semibold text-gray-900">{vehicle.registration}</div>
                        <div className="text-sm text-gray-600">{vehicle.make} {vehicle.model}</div>
                        <div className="text-xs text-gray-500">{vehicle.year} • {vehicle.totalKilometers.toLocaleString()} km</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className={`font-medium ${getFleetColor(vehicle.fleet)}`}>{vehicle.fleet}</div>
                    <div className="text-sm text-gray-600 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {vehicle.depot}
                    </div>
                    <div className="text-sm text-gray-600">{vehicle.driver || 'Unassigned'}</div>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(vehicle.status)}`}>
                      {vehicle.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="text-sm space-y-1">
                      <div>Utilization: <span className="font-medium">{vehicle.utilization}%</span></div>
                      <div>Efficiency: <span className="font-medium">{vehicle.fuelEfficiency} km/L</span></div>
                      <div>Deliveries: <span className="font-medium">{vehicle.totalDeliveries}</span></div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm space-y-1">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-orange-500" />
                        <span className="font-medium">{vehicle.safetyScore}/10</span>
                      </div>
                      <div className="text-xs text-gray-600">
                        {vehicle.safetyEvents} safety • {vehicle.fatigueEvents} fatigue
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-xs space-y-1">
                      <div>Reg: {new Date(vehicle.registrationExpiry).toLocaleDateString()}</div>
                      <div>Ins: {new Date(vehicle.insuranceExpiry).toLocaleDateString()}</div>
                      <div>Insp: {new Date(vehicle.inspectionDue).toLocaleDateString()}</div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button className="p-1 text-blue-600 hover:bg-blue-100 rounded">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="p-1 text-gray-600 hover:bg-gray-100 rounded">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button className="p-1 text-orange-600 hover:bg-orange-100 rounded">
                        <Wrench className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty State */}
      {filteredVehicles.length === 0 && (
        <div className="text-center py-12">
          <Filter className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No vehicles found</h3>
          <p className="text-gray-600">Try adjusting your search criteria or filters</p>
        </div>
      )}
    </div>
  );
};

export default VehicleDatabase;