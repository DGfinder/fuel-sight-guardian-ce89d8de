import React, { useState, useMemo } from 'react';
import { ArrowLeft, Wrench, Calendar, AlertTriangle, DollarSign, Activity, Clock, CheckCircle, XCircle, User, Truck, FileText, TrendingUp, BarChart3 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import VehicleDetailsModal from '@/components/VehicleDetailsModal';

interface MaintenanceRecord {
  id: string;
  vehicleRegistration: string;
  type: 'Preventive' | 'Corrective' | 'Inspection' | 'Emergency';
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Overdue';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  description: string;
  scheduledDate: string;
  completedDate?: string;
  cost?: number;
  workshop: string;
  technician?: string;
  kilometers: number;
  estimatedHours: number;
  actualHours?: number;
  parts: string[];
  notes?: string;
  carrier: 'Stevemacs' | 'Great Southern Fuels';
  depot: string;
  nextServiceDue?: string;
}

interface AssetCompliance {
  registration: string;
  carrier: 'Stevemacs' | 'Great Southern Fuels';
  depot: string;
  registrationExpiry: string;
  insuranceExpiry: string;
  inspectionDue: string;
  serviceDue: string;
  complianceScore: number;
  alerts: Array<{
    type: 'registration' | 'insurance' | 'inspection' | 'service';
    severity: 'warning' | 'critical';
    daysUntilExpiry: number;
  }>;
}

// Mock maintenance data
const maintenanceRecords: MaintenanceRecord[] = [
  {
    id: 'MNT-2025-001',
    vehicleRegistration: '1ILI310',
    type: 'Preventive',
    status: 'Scheduled',
    priority: 'Medium',
    description: 'Quarterly service - engine oil, filters, brake check',
    scheduledDate: '2025-08-15',
    cost: 1200,
    workshop: 'Kewdale Workshop',
    kilometers: 245000,
    estimatedHours: 4,
    parts: ['Engine Oil', 'Oil Filter', 'Air Filter'],
    carrier: 'Stevemacs',
    depot: 'Kewdale',
    nextServiceDue: '2025-11-15'
  },
  {
    id: 'MNT-2025-002',
    vehicleRegistration: '1GLD510',
    type: 'Corrective',
    status: 'In Progress',
    priority: 'High',
    description: 'Replace brake pads and rotors - wear indicator activated',
    scheduledDate: '2025-08-03',
    cost: 850,
    workshop: 'Geraldton Workshop',
    technician: 'Mark Stevens',
    kilometers: 342180,
    estimatedHours: 3,
    actualHours: 2.5,
    parts: ['Brake Pads', 'Brake Rotors', 'Brake Fluid'],
    carrier: 'Great Southern Fuels',
    depot: 'Geraldton'
  },
  {
    id: 'MNT-2025-003',
    vehicleRegistration: '1GSF248',
    type: 'Inspection',
    status: 'Overdue',
    priority: 'Critical',
    description: 'Annual safety inspection - compliance requirement',
    scheduledDate: '2025-07-30',
    workshop: 'Certified Inspection Centre',
    kilometers: 456220,
    estimatedHours: 2,
    parts: [],
    carrier: 'Great Southern Fuels',
    depot: 'Kalgoorlie',
    notes: 'Vehicle off-road until inspection completed'
  },
  {
    id: 'MNT-2025-004',
    vehicleRegistration: '1IFJ910',
    type: 'Preventive',
    status: 'Completed',
    priority: 'Medium',
    description: 'Full service and safety check',
    scheduledDate: '2025-07-28',
    completedDate: '2025-07-28',
    cost: 1450,
    workshop: 'Kewdale Workshop',
    technician: 'Sarah Mitchell',
    kilometers: 189340,
    estimatedHours: 5,
    actualHours: 4.5,
    parts: ['Engine Oil', 'Oil Filter', 'Air Filter', 'Fuel Filter', 'Coolant'],
    carrier: 'Stevemacs',
    depot: 'Kewdale',
    nextServiceDue: '2025-10-28'
  },
  {
    id: 'MNT-2025-005',
    vehicleRegistration: 'QUADADDIC',
    type: 'Emergency',
    status: 'Completed',
    priority: 'Critical',
    description: 'Engine coolant leak repair - roadside breakdown',
    scheduledDate: '2025-08-01',
    completedDate: '2025-08-01',
    cost: 2100,
    workshop: 'Emergency Mobile Service',
    technician: 'James Rodriguez',
    kilometers: 678420,
    estimatedHours: 6,
    actualHours: 8,
    parts: ['Radiator Hose', 'Coolant', 'Thermostat'],
    carrier: 'Great Southern Fuels',
    depot: 'Geraldton',
    notes: 'Emergency repair completed on-site'
  }
];

// Mock asset compliance data
const assetCompliance: AssetCompliance[] = [
  {
    registration: '1ILI310',
    carrier: 'Stevemacs',
    depot: 'Kewdale',
    registrationExpiry: '2026-02-15',
    insuranceExpiry: '2025-12-10',
    inspectionDue: '2025-09-20',
    serviceDue: '2025-08-15',
    complianceScore: 85,
    alerts: [
      { type: 'service', severity: 'warning', daysUntilExpiry: 12 }
    ]
  },
  {
    registration: '1GLD510',
    carrier: 'Great Southern Fuels',
    depot: 'Geraldton',
    registrationExpiry: '2026-03-10',
    insuranceExpiry: '2025-10-15',
    inspectionDue: '2025-08-25',
    serviceDue: '2025-09-20',
    complianceScore: 92,
    alerts: [
      { type: 'inspection', severity: 'warning', daysUntilExpiry: 22 }
    ]
  },
  {
    registration: '1GSF248',
    carrier: 'Great Southern Fuels',
    depot: 'Kalgoorlie',
    registrationExpiry: '2025-11-30',
    insuranceExpiry: '2025-09-05',
    inspectionDue: '2025-07-30',
    serviceDue: '2025-11-01',
    complianceScore: 45,
    alerts: [
      { type: 'inspection', severity: 'critical', daysUntilExpiry: -4 },
      { type: 'insurance', severity: 'critical', daysUntilExpiry: 33 }
    ]
  }
];

// Generate cost trends
const generateCostTrends = () => [
  { month: 'Mar 25', preventive: 8500, corrective: 3200, emergency: 1800, total: 13500 },
  { month: 'Apr 25', preventive: 9200, corrective: 4100, emergency: 2400, total: 15700 },
  { month: 'May 25', preventive: 7800, corrective: 2900, emergency: 900, total: 11600 },
  { month: 'Jun 25', preventive: 10100, corrective: 3800, emergency: 1500, total: 15400 },
  { month: 'Jul 25', preventive: 8900, corrective: 4500, emergency: 2100, total: 15500 },
  { month: 'Aug 25', preventive: 9400, corrective: 3300, emergency: 1200, total: 13900 }
];

// Generate maintenance type distribution
const generateMaintenanceDistribution = () => {
  const types = ['Preventive', 'Corrective', 'Inspection', 'Emergency'];
  return types.map(type => ({
    name: type,
    value: maintenanceRecords.filter(r => r.type === type).length,
    cost: maintenanceRecords
      .filter(r => r.type === type)
      .reduce((sum, r) => sum + (r.cost || 0), 0)
  }));
};

const MaintenanceDashboard: React.FC = () => {
  const [selectedCarrier, setSelectedCarrier] = useState<'All' | 'Stevemacs' | 'Great Southern Fuels'>('All');
  const [selectedStatus, setSelectedStatus] = useState<'All' | 'Scheduled' | 'In Progress' | 'Completed' | 'Overdue'>('All');
  const [timeRange, setTimeRange] = useState('30');
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [showVehicleModal, setShowVehicleModal] = useState(false);

  const costTrends = useMemo(() => generateCostTrends(), []);
  const maintenanceDistribution = useMemo(() => generateMaintenanceDistribution(), []);

  // Filter records
  const filteredRecords = useMemo(() => {
    return maintenanceRecords.filter(record => {
      const matchesCarrier = selectedCarrier === 'All' || record.carrier === selectedCarrier;
      const matchesStatus = selectedStatus === 'All' || record.status === selectedStatus;
      return matchesCarrier && matchesStatus;
    });
  }, [selectedCarrier, selectedStatus]);

  // Filter compliance data
  const filteredCompliance = useMemo(() => {
    return assetCompliance.filter(asset => 
      selectedCarrier === 'All' || asset.carrier === selectedCarrier
    );
  }, [selectedCarrier]);

  // Calculate metrics
  const totalRecords = filteredRecords.length;
  const scheduledCount = filteredRecords.filter(r => r.status === 'Scheduled').length;
  const inProgressCount = filteredRecords.filter(r => r.status === 'In Progress').length;
  const completedCount = filteredRecords.filter(r => r.status === 'Completed').length;
  const overdueCount = filteredRecords.filter(r => r.status === 'Overdue').length;
  
  const totalCost = filteredRecords.reduce((sum, r) => sum + (r.cost || 0), 0);
  const avgCostPerRecord = totalRecords > 0 ? (totalCost / totalRecords) : 0;
  
  const criticalAlerts = filteredCompliance.reduce((sum, asset) => 
    sum + asset.alerts.filter(alert => alert.severity === 'critical').length, 0
  );
  const warningAlerts = filteredCompliance.reduce((sum, asset) => 
    sum + asset.alerts.filter(alert => alert.severity === 'warning').length, 0
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'In Progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Scheduled': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Overdue': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'bg-red-500';
      case 'High': return 'bg-orange-500';
      case 'Medium': return 'bg-yellow-500';
      case 'Low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <button 
            onClick={() => window.history.back()}
            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Maintenance & Asset Management</h1>
            <p className="text-gray-600">Fleet maintenance tracking, compliance monitoring, and asset lifecycle management</p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm text-gray-600 mb-6">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            <span>Preventive & Corrective Maintenance</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            <span>Compliance & Inspections</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            <span>Cost Management & Analytics</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <select 
            value={selectedCarrier} 
            onChange={(e) => setSelectedCarrier(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Carriers</option>
            <option value="Stevemacs">Stevemacs</option>
            <option value="Great Southern Fuels">Great Southern Fuels</option>
          </select>
          
          <select 
            value={selectedStatus} 
            onChange={(e) => setSelectedStatus(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Status</option>
            <option value="Scheduled">Scheduled</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Overdue">Overdue</option>
          </select>
          
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
            <option value="365">Last Year</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">Total Records</p>
              <p className="text-2xl font-bold text-blue-900">{totalRecords}</p>
            </div>
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 rounded-lg border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-700">Scheduled</p>
              <p className="text-2xl font-bold text-yellow-900">{scheduledCount}</p>
              <p className="text-xs text-yellow-600">{inProgressCount} in progress</p>
            </div>
            <Calendar className="h-8 w-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700">Completed</p>
              <p className="text-2xl font-bold text-green-900">{completedCount}</p>
              <p className="text-xs text-green-600">This month</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-lg border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-700">Overdue</p>
              <p className="text-2xl font-bold text-red-900">{overdueCount}</p>
              <p className="text-xs text-red-600">Critical alerts: {criticalAlerts}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-700">Total Cost</p>
              <p className="text-2xl font-bold text-purple-900">${totalCost.toLocaleString()}</p>
              <p className="text-xs text-purple-600">Avg: ${avgCostPerRecord.toFixed(0)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-lg border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-700">Compliance</p>
              <p className="text-2xl font-bold text-orange-900">{warningAlerts}</p>
              <p className="text-xs text-orange-600">Warnings pending</p>
            </div>
            <Activity className="h-8 w-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Cost Trends */}
        <div className="bg-white p-6 rounded-lg shadow-md border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Maintenance Cost Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={costTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="preventive" stroke="#10b981" strokeWidth={2} name="Preventive" />
              <Line type="monotone" dataKey="corrective" stroke="#f59e0b" strokeWidth={2} name="Corrective" />
              <Line type="monotone" dataKey="emergency" stroke="#ef4444" strokeWidth={2} name="Emergency" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Maintenance Type Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-md border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Maintenance Type Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={maintenanceDistribution}
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {maintenanceDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Maintenance Records Table */}
      <div className="bg-white rounded-lg shadow-md border mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Maintenance Records</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4 font-medium text-gray-900">Vehicle</th>
                <th className="text-left p-4 font-medium text-gray-900">Type</th>
                <th className="text-left p-4 font-medium text-gray-900">Description</th>
                <th className="text-left p-4 font-medium text-gray-900">Status</th>
                <th className="text-left p-4 font-medium text-gray-900">Priority</th>
                <th className="text-left p-4 font-medium text-gray-900">Date</th>
                <th className="text-left p-4 font-medium text-gray-900">Cost</th>
                <th className="text-left p-4 font-medium text-gray-900">Workshop</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRecords.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <div>
                      <div className="font-medium text-gray-900">{record.vehicleRegistration}</div>
                      <div className="text-sm text-gray-600">{record.carrier} • {record.depot}</div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      record.type === 'Preventive' ? 'bg-green-100 text-green-800' :
                      record.type === 'Corrective' ? 'bg-yellow-100 text-yellow-800' :
                      record.type === 'Emergency' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {record.type}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="max-w-xs">
                      <div className="text-sm text-gray-900 truncate">{record.description}</div>
                      {record.parts.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          Parts: {record.parts.slice(0, 2).join(', ')}{record.parts.length > 2 ? '...' : ''}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(record.status)}`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${getPriorityColor(record.priority)}`}></div>
                      <span className="text-sm text-gray-700">{record.priority}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-gray-900">{new Date(record.scheduledDate).toLocaleDateString()}</div>
                    {record.completedDate && (
                      <div className="text-xs text-green-600">Completed: {new Date(record.completedDate).toLocaleDateString()}</div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="text-sm font-medium text-gray-900">
                      {record.cost ? `$${record.cost.toLocaleString()}` : 'TBD'}
                    </div>
                    {record.estimatedHours && (
                      <div className="text-xs text-gray-500">{record.estimatedHours}h est.</div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-gray-900">{record.workshop}</div>
                    {record.technician && (
                      <div className="text-xs text-gray-500">{record.technician}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Asset Compliance */}
      <div className="bg-white rounded-lg shadow-md border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Asset Compliance Status</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCompliance.map((asset) => (
              <div key={asset.registration} className="p-4 border rounded-lg">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">{asset.registration}</h4>
                    <p className="text-sm text-gray-600">{asset.carrier} • {asset.depot}</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${
                      asset.complianceScore >= 90 ? 'text-green-600' :
                      asset.complianceScore >= 70 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {asset.complianceScore}%
                    </div>
                    <div className="text-xs text-gray-500">Compliance</div>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Registration:</span>
                    <span className="text-gray-900">{new Date(asset.registrationExpiry).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Insurance:</span>
                    <span className="text-gray-900">{new Date(asset.insuranceExpiry).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Inspection:</span>
                    <span className="text-gray-900">{new Date(asset.inspectionDue).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Service:</span>
                    <span className="text-gray-900">{new Date(asset.serviceDue).toLocaleDateString()}</span>
                  </div>
                </div>

                {asset.alerts.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-xs font-medium text-gray-700 mb-2">Alerts</div>
                    <div className="space-y-1">
                      {asset.alerts.map((alert, index) => (
                        <div key={index} className={`text-xs px-2 py-1 rounded ${
                          alert.severity === 'critical' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {alert.type.charAt(0).toUpperCase() + alert.type.slice(1)} - {
                            alert.daysUntilExpiry < 0 ? 
                            `${Math.abs(alert.daysUntilExpiry)} days overdue` :
                            `${alert.daysUntilExpiry} days remaining`
                          }
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Vehicle Details Modal */}
      <VehicleDetailsModal 
        vehicle={selectedVehicle}
        open={showVehicleModal}
        onClose={() => setShowVehicleModal(false)}
      />
    </div>
  );
};

export default MaintenanceDashboard;