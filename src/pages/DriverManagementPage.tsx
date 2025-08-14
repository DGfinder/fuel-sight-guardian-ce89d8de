/**
 * Driver Management Page
 * Comprehensive driver management interface with search, analytics, and profile modals
 * Integrates with MtData trips, LYTX safety events, and Guardian distraction/fatigue monitoring
 */

import React, { useState, useMemo } from 'react';
import { Users, AlertTriangle, TrendingUp, Shield, Download, Search, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DataCentreLayout from '@/components/DataCentreLayout';
import DriverSearchCard from '@/components/DriverSearchCard';
import { useDriverManagementData, useDriverAlerts } from '@/hooks/useDriverProfile';

interface DriverManagementPageProps {
  fleet?: 'Stevemacs' | 'Great Southern Fuels';
}

export const DriverManagementPage: React.FC<DriverManagementPageProps> = ({ fleet }) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'30d' | '90d' | '1y'>('30d');
  const [showOnlyHighRisk, setShowOnlyHighRisk] = useState(false);

  // Fetch driver management data
  const {
    driversRequiringAttention,
    isLoadingAttention,
    errorAttention,
    refetchAttention
  } = useDriverManagementData(fleet);

  // Get real-time alerts
  const {
    alerts,
    alertCount,
    criticalCount,
    isLoading: isLoadingAlerts
  } = useDriverAlerts(fleet);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const drivers = driversRequiringAttention;
    
    return {
      totalDriversAttention: drivers.length,
      criticalRisk: drivers.filter(d => d.guardian_risk_level === 'Critical').length,
      highRisk: drivers.filter(d => d.guardian_risk_level === 'High').length,
      averageSafetyScore: drivers.length > 0 
        ? Math.round(drivers.reduce((sum, d) => sum + d.overall_safety_score, 0) / drivers.length)
        : 0,
      totalHighRiskEvents: drivers.reduce((sum, d) => sum + d.high_risk_events_30d, 0),
      totalLytxEvents: drivers.reduce((sum, d) => sum + d.lytx_events_30d, 0),
      totalGuardianEvents: drivers.reduce((sum, d) => sum + d.guardian_events_30d, 0),
    };
  }, [driversRequiringAttention]);

  const handleExportReport = async () => {
    try {
      const report = {
        fleet: fleet || 'All Fleets',
        generated: new Date().toISOString(),
        timeframe: selectedTimeframe,
        summary: summaryStats,
        alerts: alerts,
        driversRequiringAttention: driversRequiringAttention.map(driver => ({
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
      link.download = `driver_management_report_${fleet?.replace(/\s+/g, '_') || 'all_fleets'}_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
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
              {fleet && (
                <Badge variant="outline" className="ml-2">
                  {fleet}
                </Badge>
              )}
            </h1>
            <p className="text-gray-600 mt-1">
              Comprehensive driver analytics, safety monitoring, and performance management
            </p>
          </div>
          
          <div className="flex items-center gap-3">
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
              disabled={isLoadingAttention}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export Report
            </Button>
            
            <Button
              onClick={() => refetchAttention()}
              disabled={isLoadingAttention}
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
                  <p className="text-sm font-medium text-gray-600">Requiring Attention</p>
                  <p className="text-2xl font-bold text-orange-600">{summaryStats.totalDriversAttention}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-500" />
              </div>
              <div className="mt-2 text-sm text-gray-600">
                <span className="text-red-600 font-medium">{summaryStats.criticalRisk} Critical</span>
                <span className="mx-1">•</span>
                <span className="text-orange-600 font-medium">{summaryStats.highRisk} High Risk</span>
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
                  <p className="text-sm font-medium text-gray-600">High Risk Events</p>
                  <p className="text-2xl font-bold text-red-600">{summaryStats.totalHighRiskEvents}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
              <div className="mt-2 text-sm text-gray-600">
                <span>LYTX: {summaryStats.totalLytxEvents}</span>
                <span className="mx-1">•</span>
                <span>Guardian: {summaryStats.totalGuardianEvents}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Alerts</p>
                  <p className="text-2xl font-bold text-purple-600">{alertCount}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-500" />
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Real-time safety notifications
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Driver Search */}
          <DriverSearchCard
            fleet={fleet}
            showRequiringAttention={false}
            title="Driver Search & Profiles"
            className="h-fit"
          />

          {/* Drivers Requiring Attention */}
          <DriverSearchCard
            fleet={fleet}
            showRequiringAttention={true}
            title="Drivers Requiring Attention"
            className="h-fit"
          />
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
        {errorAttention && (
          <Card>
            <CardContent className="p-6 text-center">
              <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Data</h3>
              <p className="text-gray-600 mb-4">
                Unable to load driver management data. Please try again.
              </p>
              <Button onClick={() => refetchAttention()} variant="outline">
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