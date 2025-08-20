/**
 * Driver Management Page
 * Comprehensive driver management interface with search, analytics, and profile modals
 * Integrates with MtData trips, LYTX safety events, and Guardian distraction/fatigue monitoring
 */

import React, { useState, useMemo } from 'react';
import { Users, AlertTriangle, TrendingUp, Shield, Download, Search, Filter, Eye, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DataCentreLayout from '@/components/DataCentreLayout';
import { useDriverManagementData, useDriverAlerts, useDriverSearch } from '@/hooks/useDriverProfile';

interface DriverManagementPageProps {
  fleet?: 'Stevemacs' | 'Great Southern Fuels';
}

export const DriverManagementPage: React.FC<DriverManagementPageProps> = ({ fleet }) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'30d' | '90d' | '1y'>('30d');
  const [showOnlyHighRisk, setShowOnlyHighRisk] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFleet, setSelectedFleet] = useState<string>(fleet || '');

  // Fetch driver management data
  const {
    drivers,
    isLoading,
    error,
    refetch
  } = useDriverManagementData(selectedFleet);

  // Get real-time alerts
  const {
    alerts,
    alertCount,
    criticalCount,
    isLoading: isLoadingAlerts
  } = useDriverAlerts(selectedFleet);

  // Search drivers
  const {
    data: searchResults,
    isLoading: isSearching
  } = useDriverSearch(searchTerm, selectedFleet, {
    enabled: searchTerm.length >= 2
  });

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (!drivers.length) {
      return {
        totalDrivers: 0,
        totalTrips: 0,
        totalKm: 0,
        averageSafetyScore: 0,
        totalLytxEvents: 0,
        totalGuardianEvents: 0,
        totalHighRiskEvents: 0,
        activeDrivers: 0
      };
    }
    
    return {
      totalDrivers: drivers.length,
      totalTrips: drivers.reduce((sum, d) => sum + d.total_trips_30d, 0),
      totalKm: drivers.reduce((sum, d) => sum + d.total_km_30d, 0),
      averageSafetyScore: Math.round(drivers.reduce((sum, d) => sum + d.overall_safety_score, 0) / drivers.length),
      totalLytxEvents: drivers.reduce((sum, d) => sum + d.lytx_events_30d, 0),
      totalGuardianEvents: drivers.reduce((sum, d) => sum + d.guardian_events_30d, 0),
      totalHighRiskEvents: drivers.reduce((sum, d) => sum + d.high_risk_events_30d, 0),
      activeDrivers: drivers.filter(d => d.active_days_30d > 0).length
    };
  }, [drivers]);

  const handleExportReport = async () => {
    try {
      const report = {
        fleet: selectedFleet || 'All Fleets',
        generated: new Date().toISOString(),
        timeframe: selectedTimeframe,
        summary: summaryStats,
        alerts: alerts,
        drivers: drivers.map(driver => ({
          name: driver.full_name,
          employee_id: driver.employee_id,
          fleet: driver.fleet,
          depot: driver.depot,
          safety_score: driver.overall_safety_score,
          risk_level: driver.guardian_risk_level,
          high_risk_events: driver.high_risk_events_30d,
          lytx_events: driver.lytx_events_30d,
          guardian_events: driver.guardian_events_30d,
        }))
      };
      
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `driver_management_report_${selectedFleet?.replace(/\s+/g, '_') || 'all_fleets'}_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleDriverClick = (driverId: string) => {
    // TODO: Open driver profile modal or navigate to driver detail page
    console.log('Opening driver profile:', driverId);
  };

  return (
    <DataCentreLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="h-6 w-6 text-blue-600" />
              Driver Management
              {selectedFleet && (
                <Badge variant="outline" className="ml-2">
                  {selectedFleet}
                </Badge>
              )}
            </h1>
            <p className="text-gray-600 mt-1">
              Comprehensive driver analytics, safety monitoring, and performance management
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Fleet Filter */}
            <select
              value={selectedFleet}
              onChange={(e) => setSelectedFleet(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Fleets</option>
              <option value="Stevemacs">Stevemacs</option>
              <option value="Great Southern Fuels">Great Southern Fuels</option>
            </select>
            
            {/* Timeframe Selector */}
            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="1y">Last Year</option>
            </select>
            
            <Button
              onClick={handleExportReport}
              disabled={isLoading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export Report
            </Button>
            
            <Button
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              Refresh Data
            </Button>
          </div>
        </div>

        {/* Alert Banner */}
        {criticalCount > 0 && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Critical Attention Required
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  {criticalCount} driver{criticalCount > 1 ? 's' : ''} require immediate attention due to critical safety events.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Drivers</p>
                  <p className="text-2xl font-bold text-blue-600">{summaryStats.totalDrivers}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
              <div className="mt-2 text-sm text-gray-600">
                <span className="text-green-600 font-medium">{summaryStats.activeDrivers} Active</span>
                <span className="mx-1">•</span>
                <span className="text-gray-600">{summaryStats.totalTrips} Trips</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Safety Score</p>
                  <p className={`text-2xl font-bold ${
                    summaryStats.averageSafetyScore >= 80 ? 'text-green-600' :
                    summaryStats.averageSafetyScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {summaryStats.averageSafetyScore}
                  </p>
                </div>
                <Shield className="h-8 w-8 text-blue-500" />
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Fleet average safety performance
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total KM (30d)</p>
                  <p className="text-2xl font-bold text-green-600">{summaryStats.totalKm.toLocaleString()}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
              <div className="mt-2 text-sm text-gray-600">
                <span>LYTX Events: {summaryStats.totalLytxEvents}</span>
                <span className="mx-1">•</span>
                <span>Guardian: {summaryStats.totalGuardianEvents}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Safety Events</p>
                  <p className="text-2xl font-bold text-orange-600">{summaryStats.totalHighRiskEvents}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-500" />
              </div>
              <p className="text-sm text-gray-600 mt-2">
                High-risk events requiring attention
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Driver Search */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-blue-500" />
                Driver Search & Profiles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search drivers by name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {searchTerm.length < 2 ? (
                <div className="text-center py-8">
                  <Search className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">Search for drivers to view their profiles</p>
                  <p className="text-sm text-gray-500">Enter at least 2 characters to search</p>
                </div>
              ) : isSearching ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-600 mt-2">Searching...</p>
                </div>
              ) : searchResults && searchResults.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {searchResults.map((driver) => (
                    <div
                      key={driver.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleDriverClick(driver.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{driver.full_name}</p>
                          <p className="text-sm text-gray-600">
                            {driver.employee_id} • {driver.fleet} • {driver.depot}
                          </p>
                        </div>
                      </div>
                      <Eye className="h-4 w-4 text-gray-400" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Search className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">No drivers found</p>
                  <p className="text-sm text-gray-500">Try a different search term</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Driver Performance Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                Driver Performance Summary
                {drivers.length > 0 && (
                  <Badge variant="outline" className="ml-2">
                    {drivers.length} drivers
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-600 mt-2">Loading drivers...</p>
                </div>
              ) : drivers.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {drivers.map((driver) => {
                    const hasHighRisk = driver.high_risk_events_30d > 0;
                    const hasEvents = driver.lytx_events_30d > 0 || driver.guardian_events_30d > 0;
                    const isActive = driver.active_days_30d > 0;
                    
                    return (
                      <div
                        key={driver.id}
                        className={`p-3 rounded-lg border-l-4 cursor-pointer transition-colors ${
                          hasHighRisk ? 'border-red-500 bg-red-50' :
                          hasEvents ? 'border-yellow-500 bg-yellow-50' :
                          isActive ? 'border-green-500 bg-green-50' :
                          'border-gray-300 bg-gray-50'
                        }`}
                        onClick={() => handleDriverClick(driver.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`font-medium ${
                              hasHighRisk ? 'text-red-800' :
                              hasEvents ? 'text-yellow-800' :
                              isActive ? 'text-green-800' :
                              'text-gray-800'
                            }`}>
                              {driver.full_name}
                            </p>
                            <p className="text-sm text-gray-600">
                              {driver.fleet} • {driver.depot} • Safety: {driver.overall_safety_score || 'N/A'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Trips: {driver.total_trips_30d} • KM: {driver.total_km_30d} • Active Days: {driver.active_days_30d}
                            </p>
                            <p className="text-xs text-gray-500">
                              LYTX: {driver.lytx_events_30d} • Guardian: {driver.guardian_events_30d} • High Risk: {driver.high_risk_events_30d}
                            </p>
                          </div>
                          <div className="text-right">
                            {hasHighRisk && (
                              <Badge variant="destructive" className="text-xs mb-1">
                                HIGH RISK
                              </Badge>
                            )}
                            {hasEvents && !hasHighRisk && (
                              <Badge variant="default" className="text-xs mb-1">
                                EVENTS
                              </Badge>
                            )}
                            {isActive && !hasEvents && (
                              <Badge variant="secondary" className="text-xs mb-1">
                                ACTIVE
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No driver data available</p>
                  <p className="text-sm text-gray-500">Try selecting a different fleet or check data sources</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Alerts */}
        {alerts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Recent Alerts
                <Badge variant="destructive" className="ml-2">
                  {alerts.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.slice(0, 10).map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border-l-4 ${
                      alert.severity === 'critical' ? 'border-red-500 bg-red-50' :
                      alert.severity === 'high' ? 'border-orange-500 bg-orange-50' :
                      'border-yellow-500 bg-yellow-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`font-medium ${
                          alert.severity === 'critical' ? 'text-red-800' :
                          alert.severity === 'high' ? 'text-orange-800' :
                          'text-yellow-800'
                        }`}>
                          {alert.driverName}
                        </p>
                        <p className={`text-sm ${
                          alert.severity === 'critical' ? 'text-red-600' :
                          alert.severity === 'high' ? 'text-orange-600' :
                          'text-yellow-600'
                        }`}>
                          {alert.message}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant={alert.severity === 'critical' ? 'destructive' : 'default'}
                          className="text-xs"
                        >
                          {alert.severity.toUpperCase()}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">
                          {alert.fleet} • {alert.depot}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {alerts.length > 10 && (
                  <div className="text-center pt-2 border-t">
                    <p className="text-sm text-gray-500">
                      Showing 10 of {alerts.length} alerts. Use driver search to view specific profiles.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Card>
            <CardContent className="p-6 text-center">
              <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Data</h3>
              <p className="text-gray-600 mb-4">
                Unable to load driver management data. Please try again.
              </p>
              <Button onClick={() => refetch()} variant="outline">
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Help Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How to Use Driver Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Search & View Profiles</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• Search drivers by name or employee ID</li>
                  <li>• Click any driver card to open detailed profile</li>
                  <li>• View trip analytics, safety events, and performance</li>
                  <li>• Export individual driver reports</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Monitor Safety & Performance</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• Review drivers requiring immediate attention</li>
                  <li>• Track LYTX safety events and coaching progress</li>
                  <li>• Monitor Guardian distraction/fatigue alerts</li>
                  <li>• Compare performance across fleet</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DataCentreLayout>
  );
};

export default DriverManagementPage;