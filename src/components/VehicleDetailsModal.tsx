import React, { useState } from 'react';
import { X, Truck, User, MapPin, Calendar, Wrench, Shield, AlertTriangle, Fuel, Activity, Navigation, FileText } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface VehicleDetails {
  registration: string;
  fleet: 'Stevemacs' | 'Great Southern Fuels';
  depot: string;
  status: 'Active' | 'Maintenance' | 'Available' | 'Out of Service';
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
  routeType: string;
  currentLocation?: string;
  lastMaintenance: MaintenanceRecord[];
  safetyHistory: SafetyEvent[];
  deliveryHistory: DeliveryRecord[];
  fuelHistory: FuelRecord[];
}

interface MaintenanceRecord {
  date: string;
  type: 'Preventive' | 'Corrective' | 'Inspection';
  description: string;
  cost: number;
  workshop: string;
  kilometers: number;
}

interface SafetyEvent {
  date: string;
  type: 'LYTX' | 'Guardian' | 'Manual';
  severity: number;
  trigger: string;
  status: 'New' | 'Face-To-Face' | 'Resolved';
  driver?: string;
}

interface DeliveryRecord {
  date: string;
  bol: string;
  customer: string;
  product: string;
  volume: number;
  distance: number;
  driver: string;
}

interface FuelRecord {
  date: string;
  liters: number;
  cost: number;
  location: string;
  efficiency: number;
  distance: number;
}

interface VehicleDetailsModalProps {
  vehicle: VehicleDetails | null;
  open: boolean;
  onClose: () => void;
}

// Sample detailed vehicle data
const mockVehicleDetails: VehicleDetails = {
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
  inspectionDue: '2025-08-25',
  routeType: 'Regional',
  currentLocation: 'Geraldton Depot',
  lastMaintenance: [
    {
      date: '2025-06-20',
      type: 'Preventive',
      description: 'Full service - engine oil, filters, brake inspection',
      cost: 1250,
      workshop: 'Geraldton Workshop',
      kilometers: 335000
    },
    {
      date: '2025-04-15',
      type: 'Corrective',
      description: 'Replace rear brake pads and rotors',
      cost: 890,
      workshop: 'Geraldton Workshop',
      kilometers: 328000
    },
    {
      date: '2025-03-10',
      type: 'Inspection',
      description: 'Annual safety inspection and compliance check',
      cost: 350,
      workshop: 'Certified Inspection Centre',
      kilometers: 325000
    }
  ],
  safetyHistory: [
    {
      date: '2025-08-03',
      type: 'LYTX',
      severity: 0,
      trigger: 'Food or Drink',
      status: 'New',
      driver: 'Andrew Buchanan'
    },
    {
      date: '2025-07-28',
      type: 'Guardian',
      severity: 3,
      trigger: 'Fatigue Detection',
      status: 'Resolved',
      driver: 'Andrew Buchanan'
    },
    {
      date: '2025-07-15',
      type: 'LYTX',
      severity: 0,
      trigger: 'Following Distance',
      status: 'Face-To-Face',
      driver: 'Andrew Buchanan'
    }
  ],
  deliveryHistory: [
    {
      date: '2025-08-03',
      bol: 'D2125489',
      customer: 'BP Wonthella',
      product: 'Diesel',
      volume: 17000,
      distance: 45,
      driver: 'Andrew Buchanan'
    },
    {
      date: '2025-08-02',
      bol: 'D2125488',
      customer: 'Shell Geraldton',
      product: 'Unleaded 91',
      volume: 12500,
      distance: 28,
      driver: 'Andrew Buchanan'
    },
    {
      date: '2025-08-01',
      bol: 'D2125487',
      customer: 'Caltex Industrial',
      product: 'Diesel',
      volume: 20000,
      distance: 67,
      driver: 'Andrew Buchanan'
    }
  ],
  fuelHistory: [
    {
      date: '2025-08-03',
      liters: 180,
      cost: 324,
      location: 'Geraldton Depot',
      efficiency: 3.8,
      distance: 140,
      
    },
    {
      date: '2025-08-01',
      liters: 165,
      cost: 297,
      location: 'Geraldton Depot',
      efficiency: 4.1,
      distance: 162,
    },
    {
      date: '2025-07-30',
      liters: 195,
      cost: 351,
      location: 'Roadhouse Stop',
      efficiency: 3.5,
      distance: 198,
    }
  ]
};

// Generate performance trends
const generatePerformanceTrends = () => [
  { month: 'May 25', efficiency: 3.6, utilization: 88, safety: 9.2, deliveries: 18 },
  { month: 'Jun 25', efficiency: 3.7, utilization: 91, safety: 9.0, deliveries: 22 },
  { month: 'Jul 25', efficiency: 3.8, utilization: 94, safety: 9.1, deliveries: 24 },
  { month: 'Aug 25', efficiency: 3.8, utilization: 92, safety: 9.1, deliveries: 28 }
];

const VehicleDetailsModal: React.FC<VehicleDetailsModalProps> = ({ vehicle, open, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'maintenance' | 'safety' | 'deliveries' | 'fuel'>('overview');

  if (!open || !vehicle) return null;

  const performanceTrends = generatePerformanceTrends();
  const details = mockVehicleDetails; // Use mock data for demo

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Truck className="h-8 w-8 text-gray-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">{details.registration}</h2>
              <p className={`text-sm font-medium ${getFleetColor(details.fleet)}`}>
                {details.make} {details.model} ({details.year}) • {details.fleet}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 bg-white">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Overview', icon: Activity },
              { id: 'maintenance', label: 'Maintenance', icon: Wrench },
              { id: 'safety', label: 'Safety', icon: Shield },
              { id: 'deliveries', label: 'Deliveries', icon: Navigation },
              { id: 'fuel', label: 'Fuel', icon: Fuel }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {activeTab === 'overview' && (
            <div className="p-6">
              {/* Key Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">Status</span>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(details.status)}`}>
                    {details.status}
                  </span>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-green-700">Safety Score</span>
                  </div>
                  <span className="text-2xl font-bold text-green-900">{details.safetyScore}/10</span>
                </div>
                
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Fuel className="h-5 w-5 text-purple-600" />
                    <span className="text-sm font-medium text-purple-700">Efficiency</span>
                  </div>
                  <span className="text-2xl font-bold text-purple-900">{details.fuelEfficiency} km/L</span>
                </div>
                
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Navigation className="h-5 w-5 text-orange-600" />
                    <span className="text-sm font-medium text-orange-700">Utilization</span>
                  </div>
                  <span className="text-2xl font-bold text-orange-900">{details.utilization}%</span>
                </div>
              </div>

              {/* Vehicle Details */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Vehicle Specifications</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">VIN:</span>
                      <span className="font-medium text-gray-900">{details.vin}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Kilometers:</span>
                      <span className="font-medium text-gray-900">{details.totalKilometers.toLocaleString()} km</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Route Type:</span>
                      <span className="font-medium text-gray-900">{details.routeType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Current Location:</span>
                      <span className="font-medium text-gray-900">{details.currentLocation}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Assignment & Devices</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Assigned Driver:</span>
                      <span className="font-medium text-gray-900">{details.driver || 'Unassigned'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Home Depot:</span>
                      <span className="font-medium text-gray-900">{details.depot}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Guardian Unit:</span>
                      <span className="font-medium text-gray-900">{details.guardianUnit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">LYTX Device:</span>
                      <span className="font-medium text-gray-900">{details.lytxDevice}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Trends */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Trends</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performanceTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="efficiency" stroke="#8b5cf6" strokeWidth={2} name="Efficiency (km/L)" />
                    <Line type="monotone" dataKey="utilization" stroke="#10b981" strokeWidth={2} name="Utilization %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'maintenance' && (
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">Last Service</span>
                  </div>
                  <span className="text-lg font-bold text-blue-900">{new Date(details.lastService).toLocaleDateString()}</span>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench className="h-5 w-5 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-700">Next Service</span>
                  </div>
                  <span className="text-lg font-bold text-yellow-900">{new Date(details.nextService).toLocaleDateString()}</span>
                </div>
                
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <span className="text-sm font-medium text-red-700">Inspection Due</span>
                  </div>
                  <span className="text-lg font-bold text-red-900">{new Date(details.inspectionDue).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Maintenance History</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {details.lastMaintenance.map((record, index) => (
                    <div key={index} className="p-6">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            record.type === 'Preventive' ? 'bg-green-100 text-green-800' :
                            record.type === 'Corrective' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {record.type}
                          </span>
                          <p className="text-sm text-gray-600 mt-1">{new Date(record.date).toLocaleDateString()}</p>
                        </div>
                        <span className="text-lg font-bold text-gray-900">${record.cost.toLocaleString()}</span>
                      </div>
                      <p className="text-gray-900 font-medium mb-1">{record.description}</p>
                      <p className="text-sm text-gray-600">{record.workshop} • {record.kilometers.toLocaleString()} km</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'safety' && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-green-700">Safety Score</span>
                  </div>
                  <span className="text-2xl font-bold text-green-900">{details.safetyScore}/10</span>
                </div>
                
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    <span className="text-sm font-medium text-orange-700">Safety Events</span>
                  </div>
                  <span className="text-2xl font-bold text-orange-900">{details.safetyEvents}</span>
                </div>
                
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-5 w-5 text-red-600" />
                    <span className="text-sm font-medium text-red-700">Fatigue Events</span>
                  </div>
                  <span className="text-2xl font-bold text-red-900">{details.fatigueEvents}</span>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Safety Events</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {details.safetyHistory.map((event, index) => (
                    <div key={index} className="p-6">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            event.type === 'LYTX' ? 'bg-blue-100 text-blue-800' :
                            event.type === 'Guardian' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {event.type}
                          </span>
                          <p className="text-sm text-gray-600 mt-1">{new Date(event.date).toLocaleDateString()}</p>
                        </div>
                        <span className={`text-lg font-bold ${
                          event.severity >= 5 ? 'text-red-600' :
                          event.severity >= 3 ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          Score: {event.severity}
                        </span>
                      </div>
                      <p className="text-gray-900 font-medium mb-1">{event.trigger}</p>
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-gray-600">Driver: {event.driver || 'Unknown'}</p>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          event.status === 'Resolved' ? 'bg-green-100 text-green-800' :
                          event.status === 'Face-To-Face' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {event.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'deliveries' && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Navigation className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">Total Deliveries</span>
                  </div>
                  <span className="text-2xl font-bold text-blue-900">{details.totalDeliveries}</span>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-green-700">This Month</span>
                  </div>
                  <span className="text-2xl font-bold text-green-900">{details.deliveryHistory.length}</span>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Deliveries</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {details.deliveryHistory.map((delivery, index) => (
                    <div key={index} className="p-6">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-gray-900 font-medium">{delivery.bol}</p>
                          <p className="text-sm text-gray-600">{new Date(delivery.date).toLocaleDateString()}</p>
                        </div>
                        <span className="text-lg font-bold text-gray-900">{delivery.volume.toLocaleString()}L</span>
                      </div>
                      <p className="text-gray-900 mb-1">{delivery.customer}</p>
                      <div className="flex justify-between items-center text-sm text-gray-600">
                        <span>{delivery.product}</span>
                        <span>{delivery.distance}km • {delivery.driver}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'fuel' && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Fuel className="h-5 w-5 text-purple-600" />
                    <span className="text-sm font-medium text-purple-700">Avg Efficiency</span>
                  </div>
                  <span className="text-2xl font-bold text-purple-900">{details.fuelEfficiency} km/L</span>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">Total Distance</span>
                  </div>
                  <span className="text-2xl font-bold text-blue-900">{details.totalKilometers.toLocaleString()} km</span>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-green-700">Recent Fill-ups</span>
                  </div>
                  <span className="text-2xl font-bold text-green-900">{details.fuelHistory.length}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Fuel Efficiency Trend</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={details.fuelHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="efficiency" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-lg border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Recent Fuel Records</h3>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {details.fuelHistory.map((record, index) => (
                      <div key={index} className="p-6">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="text-gray-900 font-medium">{record.liters}L</p>
                            <p className="text-sm text-gray-600">{new Date(record.date).toLocaleDateString()}</p>
                          </div>
                          <span className="text-lg font-bold text-gray-900">${record.cost.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm text-gray-600">
                          <span>{record.location}</span>
                          <span>{record.efficiency} km/L • {record.distance}km</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VehicleDetailsModal;