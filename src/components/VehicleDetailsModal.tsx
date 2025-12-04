import React, { useState } from 'react';
import { X, Truck, User, MapPin, Calendar, Wrench, Shield, AlertTriangle, Fuel, Activity, Navigation, FileText, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import type { Vehicle } from '@/types/fleet';

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
  vehicle: Vehicle | null;
  open: boolean;
  onClose: () => void;
}

// Helper function to format dates for display
const formatDate = (dateString: string | undefined) => {
  if (!dateString) return 'Not Available';
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return 'Invalid Date';
  }
};

const VehicleDetailsModal: React.FC<VehicleDetailsModalProps> = ({ vehicle, open, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'maintenance' | 'safety' | 'deliveries' | 'fuel'>('overview');

  if (!open || !vehicle) return null;

  // Map real vehicle fields to details structure - no more mock data fallbacks
  const details = {
    registration: vehicle.registration,
    fleet: vehicle.fleet,
    depot: vehicle.depot,
    status: vehicle.status,
    driver: vehicle.current_driver || 'Not Assigned',
    make: vehicle.make || '—',
    model: vehicle.model || '—',
    year: vehicle.year || undefined,
    vin: vehicle.vin || '—',
    safetyScore: typeof vehicle.safety_score === 'number' ? Number(vehicle.safety_score.toFixed(1)) : 0,
    fuelEfficiency: typeof vehicle.fuel_efficiency === 'number' ? Number(vehicle.fuel_efficiency.toFixed(1)) : 0,
    utilization: vehicle.utilization || 0,
    lastService: vehicle.last_service,
    nextService: vehicle.next_service,
    guardianUnit: vehicle.guardian_unit || '—',
    lytxDevice: vehicle.lytx_device || '—',
    totalDeliveries: vehicle.total_deliveries || 0,
    totalKilometers: vehicle.total_kilometers || 0,
    fatigueEvents: vehicle.fatigue_events || 0,
    safetyEvents: vehicle.safety_events || 0,
    registrationExpiry: vehicle.registration_expiry,
    insuranceExpiry: vehicle.insurance_expiry,
    inspectionDue: vehicle.inspection_due,
    routeType: '—',
    currentLocation: vehicle.depot,
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Truck className="h-8 w-8 text-gray-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">{details.registration}</h2>
              <p className={`text-sm font-medium ${getFleetColor(details.fleet)}`}>
                {details.make}{details.model ? ` ${details.model}` : ''}{details.year ? ` (${details.year})` : ''} • {details.fleet}
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
                   <span className="text-2xl font-bold text-green-900">{Number(details.safetyScore).toFixed(1)}/10</span>
                </div>
                
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Fuel className="h-5 w-5 text-purple-600" />
                    <span className="text-sm font-medium text-purple-700">Efficiency</span>
                  </div>
                   <span className="text-2xl font-bold text-purple-900">{Number(details.fuelEfficiency).toFixed(1)} km/L</span>
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
                       <span className="font-medium text-gray-900">{details.vin || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Kilometers:</span>
                       <span className="font-medium text-gray-900">{Number(details.totalKilometers || 0).toLocaleString()} km</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Route Type:</span>
                       <span className="font-medium text-gray-900">{details.routeType || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Current Location:</span>
                       <span className="font-medium text-gray-900">{details.currentLocation || '—'}</span>
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
                       <span className="font-medium text-gray-900">{details.guardianUnit || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">LYTX Device:</span>
                       <span className="font-medium text-gray-900">{details.lytxDevice || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Trends */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Trends</h3>
                <div className="flex items-center justify-center h-64 text-gray-500">
                  <div className="text-center">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium">Performance Trends</p>
                    <p className="text-sm">Historical performance data will be available here</p>
                  </div>
                </div>
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
                  <span className="text-lg font-bold text-blue-900">{formatDate(details.lastService)}</span>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench className="h-5 w-5 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-700">Next Service</span>
                  </div>
                  <span className="text-lg font-bold text-yellow-900">{formatDate(details.nextService)}</span>
                </div>
                
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <span className="text-sm font-medium text-red-700">Inspection Due</span>
                  </div>
                  <span className="text-lg font-bold text-red-900">{formatDate(details.inspectionDue)}</span>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Maintenance History</h3>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-center h-32 text-gray-500">
                    <div className="text-center">
                      <Wrench className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm">No maintenance records available</p>
                      <p className="text-xs text-gray-400">Maintenance history will appear here when available</p>
                    </div>
                  </div>
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
                <div className="p-6">
                  <div className="flex items-center justify-center h-32 text-gray-500">
                    <div className="text-center">
                      <Shield className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm">No safety events available</p>
                      <p className="text-xs text-gray-400">Safety history will appear here when available</p>
                    </div>
                  </div>
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
                  <span className="text-2xl font-bold text-green-900">0</span>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Deliveries</h3>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-center h-32 text-gray-500">
                    <div className="text-center">
                      <Navigation className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm">No delivery records available</p>
                      <p className="text-xs text-gray-400">Delivery history will appear here when available</p>
                    </div>
                  </div>
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
                  <span className="text-2xl font-bold text-green-900">0</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Fuel Efficiency Trend</h3>
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    <div className="text-center">
                      <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-lg font-medium">Efficiency Trends</p>
                      <p className="text-sm">Historical fuel efficiency data will be available here</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Recent Fuel Records</h3>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-center h-32 text-gray-500">
                      <div className="text-center">
                        <Fuel className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm">No fuel records available</p>
                        <p className="text-xs text-gray-400">Fuel history will appear here when available</p>
                      </div>
                    </div>
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