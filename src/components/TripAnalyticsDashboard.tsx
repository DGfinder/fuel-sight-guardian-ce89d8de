import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  Truck, MapPin, Clock, Fuel, TrendingUp, TrendingDown, 
  Users, Navigation, AlertTriangle, Activity 
} from 'lucide-react';
import { 
  getFleetSummaryAnalytics, 
  getDailyFleetPerformance,
  getDriverEfficiencyRankings,
  getRouteOptimizationOpportunities,
  type DailyFleetPerformance,
  type DriverEfficiencyRanking,
  type RouteOptimization
} from '../api/trips';

interface TripAnalyticsDashboardProps {
  fleet?: string;
  depot?: string;
  dateRange?: number; // days
}

const TripAnalyticsDashboard: React.FC<TripAnalyticsDashboardProps> = ({ 
  fleet, 
  depot, 
  dateRange = 7 
}) => {
  const [summary, setSummary] = useState<any>(null);
  const [dailyPerformance, setDailyPerformance] = useState<DailyFleetPerformance[]>([]);
  const [driverRankings, setDriverRankings] = useState<DriverEfficiencyRanking[]>([]);
  const [routeOpportunities, setRouteOpportunities] = useState<RouteOptimization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [fleet, depot, dateRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getFleetSummaryAnalytics(fleet, dateRange);
      setSummary(data.summary);
      setDailyPerformance(data.daily_performance);
      setDriverRankings(data.top_drivers);
      setRouteOpportunities(data.route_opportunities);

    } catch (err: any) {
      setError(err.message);
      console.error('Failed to load trip analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-gray-500">Loading trip analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-red-500">Error loading analytics: {error}</div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-gray-500">No trip data available for the selected period</div>
      </div>
    );
  }

  const formatNumber = (num: number) => num?.toLocaleString() || '0';
  const formatDecimal = (num: number, decimals: number = 1) => num?.toFixed(decimals) || '0.0';

  // Chart colors
  const colors = {
    primary: '#3b82f6',
    secondary: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    purple: '#8b5cf6'
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Trip Analytics Dashboard</h1>
          <p className="text-gray-600">
            {fleet && `${fleet} Fleet • `}
            {depot && `${depot} Depot • `}
            Last {dateRange} days
          </p>
        </div>
        <button
          onClick={loadAnalytics}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh Data
        </button>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Trips</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(summary.total_trips)}</p>
            </div>
            <Truck className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Distance</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(summary.total_distance_km)} km</p>
            </div>
            <Navigation className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Speed</p>
              <p className="text-2xl font-bold text-gray-900">{formatDecimal(summary.average_speed_kph)} km/h</p>
            </div>
            <Activity className="h-8 w-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Route Efficiency</p>
              <p className="text-2xl font-bold text-gray-900">{formatDecimal(summary.route_efficiency_score)}%</p>
            </div>
            <MapPin className="h-8 w-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Performance Trend */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Performance Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyPerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="trip_date" 
                tickFormatter={(date) => new Date(date).toLocaleDateString()}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(date) => new Date(date).toLocaleDateString()}
              />
              <Line 
                type="monotone" 
                dataKey="total_trips" 
                stroke={colors.primary} 
                name="Total Trips"
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="avg_speed_kph" 
                stroke={colors.secondary} 
                name="Avg Speed (km/h)"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Fleet Efficiency Distribution */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Efficiency vs Distance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dailyPerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="trip_date"
                tickFormatter={(date) => new Date(date).toLocaleDateString()}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(date) => new Date(date).toLocaleDateString()}
              />
              <Area 
                type="monotone" 
                dataKey="total_distance_km" 
                stackId="1"
                stroke={colors.purple} 
                fill={colors.purple}
                fillOpacity={0.6}
                name="Distance (km)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Driver Rankings and Route Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performing Drivers */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Drivers</h3>
          <div className="space-y-3">
            {driverRankings.slice(0, 5).map((driver, index) => (
              <div key={driver.driver_id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex items-center space-x-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    index === 0 ? 'bg-yellow-500' : 
                    index === 1 ? 'bg-gray-400' : 
                    index === 2 ? 'bg-orange-600' : 'bg-blue-600'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {driver.driver_first_name} {driver.driver_last_name}
                    </p>
                    <p className="text-sm text-gray-600">{driver.fleet} • {driver.depot}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{formatDecimal(driver.avg_route_efficiency)}%</p>
                  <p className="text-xs text-gray-600">{driver.trips_count} trips</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Route Optimization Opportunities */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Route Optimization Opportunities</h3>
          <div className="space-y-3">
            {routeOpportunities.slice(0, 5).map((route) => (
              <div key={route.route_hash} className="p-3 bg-gray-50 rounded">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">
                      {route.start_location} → {route.end_location}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {route.trip_count} trips • {formatDecimal(route.average_distance_km)} km avg
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      route.optimization_priority === 'High Priority' ? 'bg-red-100 text-red-800' :
                      route.optimization_priority === 'Medium Priority' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {route.optimization_priority}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-gray-600">
                    Efficiency: {formatDecimal(route.efficiency_rating)}%
                  </span>
                  <span className="text-xs text-green-600 font-medium">
                    Save: {formatDecimal(route.potential_time_savings)}h
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Additional Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900">Operational Hours</h4>
            <Clock className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatDecimal(summary.operational_hours)}h</p>
          <p className="text-sm text-gray-600">Total operating time</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900">Idling Time</h4>
            <AlertTriangle className="h-5 w-5 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatDecimal(summary.idling_percentage)}%</p>
          <p className="text-sm text-gray-600">Of total travel time</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900">Unique Locations</h4>
            <MapPin className="h-5 w-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{summary.unique_locations}</p>
          <p className="text-sm text-gray-600">Different destinations</p>
        </div>
      </div>
    </div>
  );
};

export default TripAnalyticsDashboard;