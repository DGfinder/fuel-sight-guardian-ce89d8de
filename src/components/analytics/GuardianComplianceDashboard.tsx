import React, { useState } from 'react';
import { useGuardianMonthlyMetrics, useGenerateComplianceReport, useGuardianComplianceReport } from '../../hooks/useGuardianAnalytics';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { safeReactKey, safeStringify } from '../../lib/typeGuards';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  FileText,
  Download,
  Calendar,
  Eye,
  AlertCircle
} from 'lucide-react';
import { format, subMonths } from 'date-fns';

interface GuardianComplianceDashboardProps {
  className?: string;
}

export function GuardianComplianceDashboard({ className }: GuardianComplianceDashboardProps) {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM-01'));
  const { data: permissions } = useUserPermissions();
  
  const { data: monthlyMetrics, isLoading: metricsLoading } = useGuardianMonthlyMetrics(selectedMonth);
  const { data: complianceReport, isLoading: reportLoading } = useGuardianComplianceReport(selectedMonth);
  const generateReport = useGenerateComplianceReport();

  // Check permissions
  const canViewGuardian = permissions?.isAdmin || 
    permissions?.role === 'compliance_manager' ||
    permissions?.role === 'manager';

  const canGenerateReports = permissions?.isAdmin || 
    permissions?.role === 'compliance_manager';

  if (!canViewGuardian) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You don't have permission to view Guardian compliance data.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const handleGenerateReport = async () => {
    if (!permissions?.isAdmin && permissions?.role !== 'compliance_manager') return;
    
    try {
      await generateReport.mutateAsync({
        monthYear: selectedMonth,
        generatedBy: permissions.role || 'unknown'
      });
    } catch (error) {
      console.error('Failed to generate compliance report:', error);
    }
  };

  const getMonthOptions = () => {
    const options = [];
    for (let i = 0; i < 12; i++) {
      const date = subMonths(new Date(), i);
      const value = format(date, 'yyyy-MM-01');
      const label = format(date, 'MMMM yyyy');
      options.push({ value, label });
    }
    return options;
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-green-500" />;
    return <div className="h-4 w-4" />;
  };

  const getTrendColor = (trend: number) => {
    if (trend > 0) return 'text-red-600';
    if (trend < 0) return 'text-green-600';
    return 'text-gray-600';
  };

  const getVerificationRateColor = (rate: number) => {
    if (rate > 10) return 'text-red-600';
    if (rate > 5) return 'text-orange-600';
    return 'text-green-600';
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Guardian Compliance Dashboard</h2>
          <p className="text-muted-foreground">
            Monthly distraction and fatigue event monitoring and verification
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Month Selector */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md bg-white"
            >
              {getMonthOptions().map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Generate Report Button */}
          {canGenerateReports && (
            <Button
              onClick={handleGenerateReport}
              disabled={generateReport.isPending}
              variant="outline"
            >
              <FileText className="h-4 w-4 mr-2" />
              {generateReport.isPending ? 'Generating...' : 'Generate Report'}
            </Button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {(metricsLoading || reportLoading) && (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Monthly Metrics Overview */}
      {monthlyMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Distraction Events */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Distraction Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{monthlyMetrics.distraction.total}</span>
                  {getTrendIcon(monthlyMetrics.distraction.trend)}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Verified: {monthlyMetrics.distraction.verified}</span>
                  <Badge 
                    variant={monthlyMetrics.distraction.rate > 10 ? 'destructive' : 'secondary'}
                    className={getVerificationRateColor(monthlyMetrics.distraction.rate)}
                  >
                    {monthlyMetrics.distraction.rate.toFixed(1)}%
                  </Badge>
                </div>
                {monthlyMetrics.distraction.trend !== 0 && (
                  <p className={`text-xs ${getTrendColor(monthlyMetrics.distraction.trend)}`}>
                    {monthlyMetrics.distraction.trend > 0 ? '+' : ''}
                    {monthlyMetrics.distraction.trend.toFixed(1)}% from last month
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Fatigue Events */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Fatigue Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{monthlyMetrics.fatigue.total}</span>
                  {getTrendIcon(monthlyMetrics.fatigue.trend)}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Verified: {monthlyMetrics.fatigue.verified}</span>
                  <Badge 
                    variant={monthlyMetrics.fatigue.rate > 5 ? 'destructive' : 'secondary'}
                    className={getVerificationRateColor(monthlyMetrics.fatigue.rate)}
                  >
                    {monthlyMetrics.fatigue.rate.toFixed(1)}%
                  </Badge>
                </div>
                {monthlyMetrics.fatigue.trend !== 0 && (
                  <p className={`text-xs ${getTrendColor(monthlyMetrics.fatigue.trend)}`}>
                    {monthlyMetrics.fatigue.trend > 0 ? '+' : ''}
                    {monthlyMetrics.fatigue.trend.toFixed(1)}% from last month
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top Risk Vehicles */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Top Event Vehicles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {Array.isArray(monthlyMetrics.top_vehicles) && monthlyMetrics.top_vehicles.slice(0, 3).map((vehicle, index) => {
                  // Handle both string and object formats for vehicles
                  const vehicleKey = safeReactKey(
                    typeof vehicle === 'object' && vehicle !== null 
                      ? vehicle.id || vehicle.name || vehicle.vehicle_id 
                      : vehicle,
                    `vehicle-${index}`
                  );
                  const vehicleDisplay = typeof vehicle === 'object' && vehicle !== null 
                    ? vehicle.name || vehicle.id || vehicle.vehicle_id || safeStringify(vehicle)
                    : safeStringify(vehicle);
                  
                  return (
                    <div key={vehicleKey} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{vehicleDisplay}</span>
                      <Badge variant="outline" className="text-xs">
                        #{index + 1}
                      </Badge>
                    </div>
                  );
                })}
                {(!monthlyMetrics.top_vehicles || monthlyMetrics.top_vehicles.length === 0) && (
                  <p className="text-sm text-muted-foreground">No events this month</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* System Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {monthlyMetrics.calibration_issues.length > 0 ? (
                  <>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium">Calibration Issues</span>
                    </div>
                    <div className="space-y-1">
                      {Array.isArray(monthlyMetrics.calibration_issues) && monthlyMetrics.calibration_issues.slice(0, 2).map((vehicle, index) => {
                        const vehicleKey = safeReactKey(
                          typeof vehicle === 'object' && vehicle !== null 
                            ? vehicle.id || vehicle.name || vehicle.vehicle_id 
                            : vehicle,
                          `calibration-${index}`
                        );
                        const vehicleDisplay = typeof vehicle === 'object' && vehicle !== null 
                          ? vehicle.name || vehicle.id || vehicle.vehicle_id || safeStringify(vehicle)
                          : safeStringify(vehicle);
                        
                        return (
                          <Badge key={vehicleKey} variant="outline" className="text-xs">
                            {vehicleDisplay}
                          </Badge>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">All Systems Normal</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Tabs */}
      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="verification">Verification Queue</TabsTrigger>
          <TabsTrigger value="reports">Compliance Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          {monthlyMetrics && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Verification Rate Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Verification Rates</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Distraction Events</span>
                        <span className="text-sm text-muted-foreground">
                          {monthlyMetrics.distraction.verified} / {monthlyMetrics.distraction.total}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ 
                            width: `${Math.min(100, monthlyMetrics.distraction.rate)}%` 
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {monthlyMetrics.distraction.rate.toFixed(1)}% verification rate
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Fatigue Events</span>
                        <span className="text-sm text-muted-foreground">
                          {monthlyMetrics.fatigue.verified} / {monthlyMetrics.fatigue.total}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ 
                            width: `${Math.min(100, monthlyMetrics.fatigue.rate)}%` 
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {monthlyMetrics.fatigue.rate.toFixed(1)}% verification rate
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* System Performance */}
              <Card>
                <CardHeader>
                  <CardTitle>System Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total Events</span>
                      <span className="text-lg font-bold">
                        {monthlyMetrics.distraction.total + monthlyMetrics.fatigue.total}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Verified Events</span>
                      <span className="text-lg font-bold text-orange-600">
                        {monthlyMetrics.distraction.verified + monthlyMetrics.fatigue.verified}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">System Accuracy</span>
                      <span className="text-lg font-bold text-green-600">
                        {(100 - ((monthlyMetrics.distraction.verified + monthlyMetrics.fatigue.verified) / 
                        (monthlyMetrics.distraction.total + monthlyMetrics.fatigue.total) * 100)).toFixed(1)}%
                      </span>
                    </div>

                    {monthlyMetrics.calibration_issues.length > 0 && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          {monthlyMetrics.calibration_issues.length} vehicle(s) need calibration review
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="verification" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Verification Queue</CardTitle>
              <p className="text-sm text-muted-foreground">
                Events requiring manual verification review
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Verification queue will be implemented in the next phase
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  This will show unverified Guardian events for manual review
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Reports</CardTitle>
              <p className="text-sm text-muted-foreground">
                Monthly Guardian compliance reports for management
              </p>
            </CardHeader>
            <CardContent>
              {complianceReport ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">
                        {format(new Date(complianceReport.month_year), 'MMMM yyyy')} Compliance Report
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Generated on {format(new Date(complianceReport.generated_at), 'PPp')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={complianceReport.report_status === 'final' ? 'default' : 'secondary'}>
                        {complianceReport.report_status}
                      </Badge>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <h5 className="font-medium mb-2">Distraction Summary</h5>
                      <ul className="space-y-1 text-muted-foreground">
                        <li>Total Events: {complianceReport.distraction_total_events}</li>
                        <li>Verified Events: {complianceReport.distraction_verified_events}</li>
                        <li>Verification Rate: {complianceReport.distraction_verification_rate?.toFixed(1)}%</li>
                        <li>False Positives: {complianceReport.distraction_false_positives}</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-medium mb-2">Fatigue Summary</h5>
                      <ul className="space-y-1 text-muted-foreground">
                        <li>Total Events: {complianceReport.fatigue_total_events}</li>
                        <li>Verified Events: {complianceReport.fatigue_verified_events}</li>
                        <li>Verification Rate: {complianceReport.fatigue_verification_rate?.toFixed(1)}%</li>
                        <li>False Positives: {complianceReport.fatigue_false_positives}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No compliance report generated for {format(new Date(selectedMonth), 'MMMM yyyy')}
                  </p>
                  {canGenerateReports && (
                    <Button
                      onClick={handleGenerateReport}
                      disabled={generateReport.isPending}
                      className="mt-4"
                    >
                      Generate Report
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}