import React, { useState, useMemo } from 'react';
import { ArrowLeft, Truck, Users, MapPin, TrendingUp, Award, Activity, Fuel, Calendar, Route, User } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useVehicles } from '@/hooks/useVehicles';
import DriverProfileModal from '@/components/DriverProfileModal';

const StevemacsFleetDashboard: React.FC = () => {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectedDriverName, setSelectedDriverName] = useState<string>('');

  // Fetch real Stevemacs fleet data
  const { data: allVehicles = [], isLoading, error } = useVehicles();
  
  // Filter for Stevemacs vehicles only
  const stevemacsVehicles = useMemo(() => {
    return allVehicles.filter(vehicle => vehicle.fleet === 'Stevemacs');
  }, [allVehicles]);

  // Calculate fleet statistics from real data
  const fleetStats = useMemo(() => {
    if (stevemacsVehicles.length === 0) {
      return {
        totalVehicles: 0,
        activeVehicles: 0,
        utilizationRate: 0,
        avgFuelEfficiency: 0,
        avgSafetyScore: 0,
        maintenanceVehicles: 0
      };
    }

    const activeVehicles = stevemacsVehicles.filter(v => v.status === 'Active').length;
    const maintenanceVehicles = stevemacsVehicles.filter(v => v.status === 'Maintenance').length;
    const utilizationRate = stevemacsVehicles.reduce((sum, v) => sum + (v.utilization || 0), 0) / stevemacsVehicles.length;
    const avgFuelEfficiency = stevemacsVehicles.reduce((sum, v) => sum + (v.fuel_efficiency || 0), 0) / stevemacsVehicles.length;
    const avgSafetyScore = stevemacsVehicles.reduce((sum, v) => sum + (v.safety_score || 0), 0) / stevemacsVehicles.length;

    return {
      totalVehicles: stevemacsVehicles.length,
      activeVehicles,
      utilizationRate: Math.round(utilizationRate),
      avgFuelEfficiency: Math.round(avgFuelEfficiency * 10) / 10,
      avgSafetyScore: Math.round(avgSafetyScore * 10) / 10,
      maintenanceVehicles
    };
  }, [stevemacsVehicles]);

  // Status distribution for pie chart
  const statusData = useMemo(() => {
    const statusCounts = stevemacsVehicles.reduce((acc, vehicle) => {
      acc[vehicle.status] = (acc[vehicle.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status,
      value: count,
      color: status === 'Active' ? '#10B981' : 
             status === 'Maintenance' ? '#F59E0B' : 
             status === 'Available' ? '#3B82F6' : '#EF4444'
    }));
  }, [stevemacsVehicles]);

  const handleDriverClick = (driverId: string, driverName: string) => {
    setSelectedDriverId(driverId);
    setSelectedDriverName(driverName);
  };

  const handleCloseModal = () => {
    setSelectedDriverId(null);
    setSelectedDriverName('');
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-gray-500">Loading Stevemacs fleet data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-red-500">Error loading Stevemacs fleet data</div>
      </div>
    );
  }

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => window.history.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Stevemacs Fleet Dashboard</h1>
              <p className="text-gray-600">Kewdale operations and metropolitan delivery network</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Last updated</div>
            <div className="text-sm font-medium">{new Date().toLocaleString()}</div>
          </div>
        </div>

        {/* Fleet Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Total Vehicles</p>
                <p className="text-2xl font-bold text-blue-900">{fleetStats.totalVehicles}</p>
              </div>
              <Truck className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Active</p>
                <p className="text-2xl font-bold text-green-900">{fleetStats.activeVehicles}</p>
              </div>
              <Activity className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">Utilization</p>
                <p className="text-2xl font-bold text-orange-900">{fleetStats.utilizationRate}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-500" />
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Fuel Efficiency</p>
                <p className="text-2xl font-bold text-purple-900">{fleetStats.avgFuelEfficiency} km/L</p>
              </div>
              <Fuel className="w-8 h-8 text-purple-500" />
            </div>
          </div>

          <div className="bg-indigo-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-indigo-600 font-medium">Safety Score</p>
                <p className="text-2xl font-bold text-indigo-900">{fleetStats.avgSafetyScore}/10</p>
              </div>
              <Award className="w-8 h-8 text-indigo-500" />
            </div>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600 font-medium">Maintenance</p>
                <p className="text-2xl font-bold text-yellow-900">{fleetStats.maintenanceVehicles}</p>
              </div>
              <Calendar className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
        </div>

        {/* Fleet Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Vehicle Status Distribution */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Vehicle Status Distribution</h3>
            {statusData.length > 0 ? (
              <>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        data={statusData}
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {statusData.map((item) => (
                    <div key={item.name} className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-gray-700">{item.name}: {item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No vehicle status data available
              </div>
            )}
          </div>

          {/* Performance Trends - Empty State */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Trends</h3>
            <div className="h-64 flex flex-col items-center justify-center text-gray-500">
              <TrendingUp className="w-12 h-12 text-gray-400 mb-4" />
              <p className="text-center">Historical trend data not available</p>
              <p className="text-sm text-center mt-2">Performance metrics will be displayed when historical data is collected</p>
            </div>
          </div>
        </div>

        {/* Vehicle Fleet Table */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Stevemacs Fleet Vehicles</h3>
            {stevemacsVehicles.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Registration</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Driver</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Utilization</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Fuel Efficiency</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Safety Score</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Last Service</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stevemacsVehicles.map((vehicle) => (
                      <tr key={vehicle.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900">
                          {vehicle.registration}
                        </td>
                        <td className="py-3 px-4">
                          {vehicle.primary_driver ? (
                            <button
                              onClick={() => handleDriverClick(vehicle.primary_driver!, vehicle.primary_driver!)}
                              className="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              <User className="w-4 h-4" />
                              {vehicle.primary_driver}
                            </button>
                          ) : (
                            <span className="text-gray-500">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            vehicle.status === 'Active' ? 'bg-green-100 text-green-800' :
                            vehicle.status === 'Maintenance' ? 'bg-yellow-100 text-yellow-800' :
                            vehicle.status === 'Available' ? 'bg-blue-100 text-blue-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {vehicle.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-700">
                          {vehicle.utilization ? `${vehicle.utilization}%` : 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-gray-700">
                          {vehicle.fuel_efficiency ? `${vehicle.fuel_efficiency} km/L` : 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-gray-700">
                          {vehicle.safety_score ? `${vehicle.safety_score}/10` : 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-gray-700">
                          {vehicle.last_service_date 
                            ? new Date(vehicle.last_service_date).toLocaleDateString()
                            : 'No record'
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Truck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p>No Stevemacs vehicles found</p>
                <p className="text-sm mt-2">Vehicles will appear here when added to the Stevemacs fleet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Driver Profile Modal */}
      {selectedDriverId && selectedDriverName && (
        <DriverProfileModal
          driverId={selectedDriverId}
          driverName={selectedDriverName}
          isOpen={!!selectedDriverId}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
};

export default StevemacsFleetDashboard;