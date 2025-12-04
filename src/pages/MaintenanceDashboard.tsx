import React, { useState, useMemo } from 'react';
import { ArrowLeft, Wrench, Calendar, AlertTriangle, DollarSign, Activity, Clock, CheckCircle, XCircle, User, Truck, FileText, TrendingUp, BarChart3 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import VehicleDetailsModal from '@/components/VehicleDetailsModal';
import { useMaintenance, useAssetCompliance, useVehicles } from '@/hooks/useVehicles';
import type { MaintenanceRecord, AssetCompliance, Vehicle } from '@/types/fleet';

const MaintenanceDashboard = () => {
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'Preventive' | 'Corrective' | 'Inspection' | 'Emergency'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'Scheduled' | 'In Progress' | 'Completed' | 'Overdue'>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | 'Low' | 'Medium' | 'High' | 'Critical'>('all');

  const { data: maintenanceRecords = [], isLoading: maintenanceLoading } = useMaintenance();
  const { data: complianceRecords = [], isLoading: complianceLoading } = useAssetCompliance();
  const { data: vehicles = [] } = useVehicles();

  const filteredRecords = useMemo(() => {
    return maintenanceRecords.filter(record => {
      const matchesType = filterType === 'all' || record.type === filterType;
      const matchesStatus = filterStatus === 'all' || record.status === filterStatus;
      const matchesPriority = filterPriority === 'all' || record.priority === filterPriority;
      return matchesType && matchesStatus && matchesPriority;
    });
  }, [maintenanceRecords, filterType, filterStatus, filterPriority]);

  const stats = useMemo(() => {
    const total = maintenanceRecords.length;
    const scheduled = maintenanceRecords.filter(r => r.status === 'Scheduled').length;
    const inProgress = maintenanceRecords.filter(r => r.status === 'In Progress').length;
    const completed = maintenanceRecords.filter(r => r.status === 'Completed').length;
    const overdue = maintenanceRecords.filter(r => r.status === 'Overdue').length;
    const totalCost = maintenanceRecords
      .filter(r => r.actual_cost || r.estimated_cost)
      .reduce((sum, r) => sum + (r.actual_cost || r.estimated_cost || 0), 0);

    return {
      total,
      scheduled,
      inProgress,
      completed,
      overdue,
      totalCost
    };
  }, [maintenanceRecords]);

  const typeDistribution = useMemo(() => {
    const types = ['Preventive', 'Corrective', 'Inspection', 'Emergency'];
    return types.map(type => ({
      name: type,
      value: maintenanceRecords.filter(r => r.type === type).length
    }));
  }, [maintenanceRecords]);

  const statusDistribution = useMemo(() => {
    return [
      { name: 'Scheduled', value: stats.scheduled, color: '#3b82f6' },
      { name: 'In Progress', value: stats.inProgress, color: '#f59e0b' },
      { name: 'Completed', value: stats.completed, color: '#10b981' },
      { name: 'Overdue', value: stats.overdue, color: '#ef4444' }
    ];
  }, [stats]);

  // Historical maintenance trends would be calculated from real maintenance records
  // Currently showing empty state until historical trend analysis is implemented

  // Calculate compliance alerts
  const complianceAlerts = useMemo(() => {
    return complianceRecords
      .filter(record => {
        const daysUntilDue = Math.ceil((new Date(record.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilDue <= 30; // Items due within 30 days
      })
      .map(record => {
        const daysUntilDue = Math.ceil((new Date(record.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        const vehicle = vehicles.find(v => v.id === record.vehicle_id);
        
        return {
          id: record.id,
          registration: vehicle?.registration || 'Unknown',
          fleet: vehicle?.fleet || 'Unknown',
          depot: vehicle?.depot || 'Unknown',
          type: record.compliance_type,
          daysUntilDue,
          severity: daysUntilDue <= 7 ? 'critical' as const : 'warning' as const,
          dueDate: record.due_date
        };
      })
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }, [complianceRecords, vehicles]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'In Progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'Completed':
        return 'bg-green-100 text-green-800';
      case 'Overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Low':
        return 'bg-gray-100 text-gray-800';
      case 'Medium':
        return 'bg-blue-100 text-blue-800';
      case 'High':
        return 'bg-yellow-100 text-yellow-800';
      case 'Critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (maintenanceLoading || complianceLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-gray-500">Loading maintenance data...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Maintenance Dashboard</h1>
        <p className="text-gray-600">Monitor vehicle maintenance, compliance, and service schedules</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Records</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">In Progress</p>
              <p className="text-3xl font-bold text-yellow-600">{stats.inProgress}</p>
            </div>
            <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Activity className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Overdue</p>
              <p className="text-3xl font-bold text-red-600">{stats.overdue}</p>
            </div>
            <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Cost</p>
              <p className="text-3xl font-bold text-green-600">${stats.totalCost.toLocaleString()}</p>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4 p-4 bg-white rounded-lg shadow">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Type:</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as typeof filterType)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="Preventive">Preventive</option>
            <option value="Corrective">Corrective</option>
            <option value="Inspection">Inspection</option>
            <option value="Emergency">Emergency</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Status:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="Scheduled">Scheduled</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Overdue">Overdue</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Priority:</label>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as typeof filterPriority)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Priorities</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>
        </div>

        <div className="ml-auto text-sm text-gray-600">
          Showing {filteredRecords.length} of {stats.total} records
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Maintenance Type Distribution */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Maintenance Type Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  dataKey="value"
                  data={typeDistribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  label
                >
                  {typeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444'][index]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Maintenance Trends - Empty State */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Maintenance Trends</h3>
        <div className="h-80 flex flex-col items-center justify-center text-gray-500">
          <TrendingUp className="w-16 h-16 text-gray-400 mb-4" />
          <p className="text-lg text-center">Historical maintenance trend data not available</p>
          <p className="text-sm text-center mt-2 max-w-md">
            Maintenance trend charts will be displayed when historical data is collected over time
          </p>
        </div>
      </div>

      {/* Compliance Alerts */}
      {complianceAlerts.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Compliance Alerts ({complianceAlerts.length})
          </h3>
          <div className="space-y-3">
            {complianceAlerts.slice(0, 10).map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border-l-4 ${
                  alert.severity === 'critical' 
                    ? 'bg-red-50 border-red-400' 
                    : 'bg-yellow-50 border-yellow-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {alert.registration} - {alert.type.charAt(0).toUpperCase() + alert.type.slice(1)}
                    </p>
                    <p className="text-sm text-gray-600">
                      {alert.fleet} • {alert.depot} • Due: {new Date(alert.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    alert.severity === 'critical' 
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {alert.daysUntilDue > 0 ? `${alert.daysUntilDue} days` : 'Overdue'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Maintenance Records Table */}
      <div className="bg-white rounded-xl shadow-lg">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Maintenance Records</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Record #</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Vehicle</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Type</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Priority</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Description</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Scheduled</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Cost</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Workshop</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-gray-500">
                    No maintenance records found. Records will appear here once maintenance activities are logged.
                  </td>
                </tr>
              ) : (
                filteredRecords.slice(0, 50).map((record) => {
                  const vehicle = vehicles.find(v => v.id === record.vehicle_id);
                  return (
                    <tr key={record.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{record.record_number}</td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium text-gray-900">{vehicle?.registration || 'Unknown'}</div>
                          <div className="text-sm text-gray-500">{vehicle?.fleet || 'Unknown Fleet'}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          record.type === 'Preventive' ? 'bg-blue-100 text-blue-800' :
                          record.type === 'Corrective' ? 'bg-yellow-100 text-yellow-800' :
                          record.type === 'Inspection' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {record.type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(record.priority)}`}>
                          {record.priority}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-sm max-w-xs truncate">
                        {record.description}
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-sm">
                        {new Date(record.scheduled_date).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-sm">
                        ${(record.actual_cost || record.estimated_cost || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-sm">
                        {record.workshop || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vehicle Details Modal */}
      {selectedVehicle && (
        <VehicleDetailsModal
          vehicle={selectedVehicle}
          onClose={() => setSelectedVehicle(null)}
        />
      )}
    </div>
  );
};

export default MaintenanceDashboard;