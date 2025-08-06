import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle,
  RefreshCw,
  Activity,
  Fuel,
  MapPin,
  Clock,
  Database,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';

import {
  useSmartFillLocations,
  useSmartFillSummary,
  useSmartFillSync,
  useSmartFillSyncLogs,
  useSmartFillAPITest,
  useSmartFillSystemHealth,
  useSmartFillAlertsAndActions,
  useSmartFillPercentageColor,
  formatSmartFillTimestamp,
  calculateUllage
} from '@/hooks/useSmartFillData';

const SmartFillPage = () => {
  const [activeTab, setActiveTab] = useState('overview');
  
  // Data hooks
  const { data: locations, isLoading, error } = useSmartFillLocations();
  const summary = useSmartFillSummary();
  const { data: syncLogs } = useSmartFillSyncLogs(10);
  const systemHealth = useSmartFillSystemHealth();
  const { actionItems, lowFuelTanks, staleTanks, errorTanks } = useSmartFillAlertsAndActions();
  
  // Mutation hooks
  const syncMutation = useSmartFillSync();
  const apiTestMutation = useSmartFillAPITest();

  const handleSync = () => {
    syncMutation.mutate();
  };

  const handleAPITest = () => {
    apiTestMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-lg">Loading SmartFill data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600 flex items-center gap-2">
            <XCircle className="w-5 h-5" />
            SmartFill System Error
          </CardTitle>
          <CardDescription>
            Failed to load SmartFill data: {error.message}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button onClick={handleSync} disabled={syncMutation.isPending}>
              <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              Retry Sync
            </Button>
            <Button variant="outline" onClick={handleAPITest} disabled={apiTestMutation.isPending}>
              <Activity className="w-4 h-4 mr-2" />
              Test API
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const StatusBadge = ({ status }: { status: string }) => {
    const getStatusColor = (status: string) => {
      const s = status.toLowerCase();
      if (s.includes('error') || s.includes('fail')) return 'destructive';
      if (s.includes('ok') || s.includes('normal')) return 'default';
      return 'secondary';
    };

    return <Badge variant={getStatusColor(status)}>{status}</Badge>;
  };

  const FuelLevelBar = ({ percentage, capacity }: { percentage: number; capacity?: number }) => {
    const colorClass = percentage < 20 ? 'bg-red-500' : percentage < 50 ? 'bg-yellow-500' : 'bg-green-500';
    
    return (
      <div className="flex items-center gap-2">
        <div className="w-20 bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full ${colorClass}`}
            style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
          />
        </div>
        <span className={`text-sm font-medium ${percentage < 20 ? 'text-red-600' : percentage < 50 ? 'text-yellow-600' : 'text-green-600'}`}>
          {percentage.toFixed(1)}%
        </span>
        {capacity && (
          <span className="text-xs text-gray-500">
            ({Math.round((capacity * percentage) / 100)}L)
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SmartFill Monitoring</h1>
          <p className="text-gray-600 mt-1">JSON-RPC API fuel level monitoring system</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleAPITest} 
            variant="outline"
            disabled={apiTestMutation.isPending}
          >
            <Activity className={`w-4 h-4 mr-2 ${apiTestMutation.isPending ? 'animate-spin' : ''}`} />
            Test API
          </Button>
          <Button 
            onClick={handleSync}
            disabled={syncMutation.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Sync Data
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">API Status</p>
                <p className={`font-semibold ${systemHealth.isHealthy ? 'text-green-600' : 'text-red-600'}`}>
                  {systemHealth.apiHealth.status.toUpperCase()}
                </p>
              </div>
              {systemHealth.isHealthy ? 
                <CheckCircle className="w-8 h-8 text-green-600" /> : 
                <XCircle className="w-8 h-8 text-red-600" />
              }
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Locations</p>
                <p className="text-2xl font-bold">{summary.totalLocations}</p>
              </div>
              <MapPin className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Tanks</p>
                <p className="text-2xl font-bold">{summary.totalTanks}</p>
              </div>
              <Fuel className="w-8 h-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Fill Level</p>
                <p className="text-2xl font-bold">{summary.averageFillPercentage}%</p>
              </div>
              <Database className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts {actionItems.length > 0 && <Badge variant="destructive" className="ml-1">{actionItems.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="logs">Sync Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>System Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Customers:</span>
                    <span className="ml-2 font-medium">{summary.totalCustomers}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Capacity:</span>
                    <span className="ml-2 font-medium">{summary.totalCapacity.toLocaleString()}L</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Current Volume:</span>
                    <span className="ml-2 font-medium">{summary.totalVolume.toLocaleString()}L</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Low Fuel Tanks:</span>
                    <span className={`ml-2 font-medium ${summary.lowFuelCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {summary.lowFuelCount}
                    </span>
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">System Fill Level</span>
                    <span className="text-sm font-medium">{summary.averageFillPercentage}%</span>
                  </div>
                  <FuelLevelBar percentage={summary.averageFillPercentage} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Data Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Sync:</span>
                    <span className="font-medium">
                      {systemHealth.lastSyncTime ? formatSmartFillTimestamp(systemHealth.lastSyncTime) : 'Never'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Data Age:</span>
                    <span className={`font-medium ${systemHealth.isStale ? 'text-red-600' : 'text-green-600'}`}>
                      {systemHealth.dataAge}m ago
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">API Health:</span>
                    <span className={`font-medium ${systemHealth.isHealthy ? 'text-green-600' : 'text-red-600'}`}>
                      {systemHealth.apiHealth.status}
                    </span>
                  </div>
                  {systemHealth.apiHealth.lastError && (
                    <div className="pt-2 border-t">
                      <span className="text-xs text-red-600">Last Error:</span>
                      <p className="text-xs text-gray-600 mt-1">{systemHealth.apiHealth.lastError}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="locations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SmartFill Locations & Tanks</CardTitle>
              <CardDescription>
                All locations and tanks from SmartFill JSON-RPC API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Unit #</TableHead>
                      <TableHead>Tank #</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Current Level</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Update</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {locations?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                          No SmartFill locations found. Check API configuration and sync data.
                        </TableCell>
                      </TableRow>
                    ) : (
                      locations?.flatMap(location => 
                        (location.tanks || []).map(tank => (
                          <TableRow key={tank.id}>
                            <TableCell className="font-medium">{location.customer_name}</TableCell>
                            <TableCell>{location.unit_number}</TableCell>
                            <TableCell>{tank.tank_number}</TableCell>
                            <TableCell>{tank.description}</TableCell>
                            <TableCell>{tank.capacity ? `${tank.capacity.toLocaleString()}L` : 'N/A'}</TableCell>
                            <TableCell>
                              <FuelLevelBar 
                                percentage={tank.latest_volume_percent || 0} 
                                capacity={tank.capacity || undefined}
                              />
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={tank.latest_status || 'Unknown'} />
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {formatSmartFillTimestamp(tank.latest_update_time)}
                            </TableCell>
                          </TableRow>
                        ))
                      )
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="border-red-200">
              <CardContent className="p-4 text-center">
                <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-red-600">{lowFuelTanks.length}</p>
                <p className="text-sm text-gray-600">Low Fuel (&lt;20%)</p>
              </CardContent>
            </Card>
            <Card className="border-yellow-200">
              <CardContent className="p-4 text-center">
                <Clock className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-yellow-600">{staleTanks.length}</p>
                <p className="text-sm text-gray-600">Stale Data (&gt;24h)</p>
              </CardContent>
            </Card>
            <Card className="border-orange-200">
              <CardContent className="p-4 text-center">
                <AlertCircle className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-orange-600">{errorTanks.length}</p>
                <p className="text-sm text-gray-600">Error Status</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Action Items</CardTitle>
              <CardDescription>Tanks and locations requiring attention</CardDescription>
            </CardHeader>
            <CardContent>
              {actionItems.length === 0 ? (
                <div className="text-center py-8 text-green-600">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4" />
                  <p className="font-medium">All systems operational</p>
                  <p className="text-sm text-gray-600">No action items at this time</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {actionItems.map((item, index) => (
                    <div 
                      key={index}
                      className={`p-3 rounded-lg border-l-4 ${
                        item.priority === 'high' ? 'border-red-500 bg-red-50' :
                        item.priority === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                        'border-blue-500 bg-blue-50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {item.type === 'low_fuel' && <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />}
                        {item.type === 'stale_data' && <Clock className="w-4 h-4 text-yellow-600 mt-0.5" />}
                        {item.type === 'error' && <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5" />}
                        <div className="flex-1">
                          <p className="text-sm font-medium">{item.message}</p>
                          <Badge 
                            variant={item.priority === 'high' ? 'destructive' : 'secondary'}
                            className="mt-1 text-xs"
                          >
                            {item.priority.toUpperCase()} PRIORITY
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync Logs</CardTitle>
              <CardDescription>Recent SmartFill API synchronization history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date/Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Locations</TableHead>
                      <TableHead>Tanks</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncLogs?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                          No sync logs found
                        </TableCell>
                      </TableRow>
                    ) : (
                      syncLogs?.map(log => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm">
                            {formatSmartFillTimestamp(log.started_at)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.sync_type}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                log.sync_status === 'success' ? 'default' :
                                log.sync_status === 'partial' ? 'secondary' :
                                'destructive'
                              }
                            >
                              {log.sync_status}
                            </Badge>
                          </TableCell>
                          <TableCell>{log.locations_processed || 0}</TableCell>
                          <TableCell>{log.tanks_processed || 0}</TableCell>
                          <TableCell className="text-sm">
                            {log.sync_duration_ms ? `${log.sync_duration_ms}ms` : 'N/A'}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {log.error_message && (
                              <span className="text-red-600 text-xs">
                                {log.error_message.substring(0, 50)}...
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SmartFillPage;