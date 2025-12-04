import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Fuel,
  Info,
  Database,
  History,
  Code,
  Clock,
  MapPin,
  Gauge,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Download,
  ExternalLink,
  Calendar,
  Activity,
  TrendingUp,
  TrendingDown,
  Droplets,
  Timer
} from 'lucide-react';
import { formatSmartFillTimestamp, useSmartFillPercentageColor } from '@/hooks/useSmartFillData';
import { SmartFillTank, SmartFillLocation } from '@/services/smartfill-api';

interface SmartFillTankDetailModalProps {
  tank: (SmartFillTank & { location?: SmartFillLocation }) | null;
  isOpen: boolean;
  onClose: () => void;
  onRefreshTank?: (tankId: string) => void;
}

const SmartFillTankDetailModal: React.FC<SmartFillTankDetailModalProps> = ({
  tank,
  isOpen,
  onClose,
  onRefreshTank
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);
  
  const percentageColor = useSmartFillPercentageColor(tank?.latest_volume_percent);

  // Calculate tank metrics
  const tankMetrics = useMemo(() => {
    if (!tank) return null;

    const currentVolume = tank.latest_volume || 0;
    const volumePercent = tank.latest_volume_percent || 0;
    const capacity = tank.capacity || 0;
    const safeLevel = tank.safe_fill_level || capacity;
    const ullage = Math.max(0, safeLevel - currentVolume);
    
    // Status determination
    let status = 'unknown';
    let statusColor = 'gray';
    let statusIcon = <AlertCircle className="w-4 h-4" />;

    if (tank.latest_status) {
      const statusLower = tank.latest_status.toLowerCase();
      if (statusLower.includes('ok') || statusLower.includes('normal')) {
        status = 'operational';
        statusColor = 'green';
        statusIcon = <CheckCircle className="w-4 h-4 text-green-600" />;
      } else if (statusLower.includes('offline')) {
        status = 'offline';
        statusColor = 'red';
        statusIcon = <AlertTriangle className="w-4 h-4 text-red-600" />;
      } else if (statusLower.includes('error') || statusLower.includes('fail')) {
        status = 'error';
        statusColor = 'red';
        statusIcon = <AlertTriangle className="w-4 h-4 text-red-600" />;
      }
    }

    // Fuel level status
    let fuelStatus = 'normal';
    let fuelColor = 'green';
    if (volumePercent < 20) {
      fuelStatus = 'critical';
      fuelColor = 'red';
    } else if (volumePercent < 40) {
      fuelStatus = 'low';
      fuelColor = 'yellow';
    }

    return {
      currentVolume,
      volumePercent,
      capacity,
      safeLevel,
      ullage,
      status,
      statusColor,
      statusIcon,
      fuelStatus,
      fuelColor
    };
  }, [tank]);

  const handleRefreshTank = async () => {
    if (!tank || !onRefreshTank) return;
    
    setRefreshing(true);
    try {
      await onRefreshTank(tank.id);
    } finally {
      setRefreshing(false);
    }
  };

  const handleExportTankData = () => {
    if (!tank) return;

    const exportData = {
      tank_info: {
        customer: tank.location?.customer_name,
        unit_number: tank.unit_number,
        tank_number: tank.tank_number,
        description: tank.description,
        capacity: tank.capacity,
        safe_fill_level: tank.safe_fill_level,
        latest_volume: tank.latest_volume,
        latest_volume_percent: tank.latest_volume_percent,
        latest_status: tank.latest_status,
        latest_update_time: tank.latest_update_time,
        created_at: tank.created_at,
        updated_at: tank.updated_at
      },
      raw_smartfill_data: tank.raw_data || null,
      export_timestamp: new Date().toISOString()
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smartfill-tank-${tank.unit_number}-${tank.tank_number}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (!tank || !tankMetrics) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Fuel className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  Unit {tank.unit_number} - Tank {tank.tank_number}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-4 mt-1">
                  <span>{tank.description}</span>
                  <Badge variant="outline" className="text-xs">
                    {tank.location?.customer_name}
                  </Badge>
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefreshTank}
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportTankData}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Info className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="api-data" className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              API Data
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              History
            </TabsTrigger>
            <TabsTrigger value="raw" className="flex items-center gap-2">
              <Code className="w-4 h-4" />
              Raw Data
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="overview" className="p-6 space-y-6">
              {/* Status Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      {tankMetrics.statusIcon}
                    </div>
                    <p className="text-sm text-gray-600">Tank Status</p>
                    <p className={`font-bold text-${tankMetrics.statusColor}-600 capitalize`}>
                      {tankMetrics.status}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center">
                    <Gauge className="w-5 h-5 mx-auto mb-2 text-blue-600" />
                    <p className="text-sm text-gray-600">Fuel Level</p>
                    <p className={`font-bold ${percentageColor}`}>
                      {tankMetrics.volumePercent.toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center">
                    <Droplets className="w-5 h-5 mx-auto mb-2 text-gray-600" />
                    <p className="text-sm text-gray-600">Current Volume</p>
                    <p className="font-bold text-gray-900">
                      {tankMetrics.currentVolume.toLocaleString()} L
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center">
                    <Calendar className="w-5 h-5 mx-auto mb-2 text-gray-600" />
                    <p className="text-sm text-gray-600">Last Updated</p>
                    <p className="font-bold text-gray-900 text-sm">
                      {formatSmartFillTimestamp(tank.latest_update_time)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Fuel Level Visual */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Fuel Level Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Current Level</span>
                      <span className="font-medium">{tankMetrics.volumePercent.toFixed(1)}%</span>
                    </div>
                    <Progress 
                      value={tankMetrics.volumePercent} 
                      className="h-3"
                    />
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>0 L</span>
                      <span>{tankMetrics.currentVolume.toLocaleString()} L</span>
                      <span>{tankMetrics.capacity.toLocaleString()} L</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <span className="text-sm text-gray-600">Safe Fill Level</span>
                      <p className="font-medium">{tankMetrics.safeLevel.toLocaleString()} L</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Ullage (Remaining)</span>
                      <p className="font-medium">{tankMetrics.ullage.toLocaleString()} L</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tank Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Tank Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <span className="text-sm text-gray-600">Customer</span>
                      <p className="font-medium">{tank.location?.customer_name || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Unit Number</span>
                      <p className="font-medium">{tank.unit_number}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Tank Number</span>
                      <p className="font-medium">{tank.tank_number}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Description</span>
                      <p className="font-medium">{tank.description}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Capacity</span>
                      <p className="font-medium">{tankMetrics.capacity.toLocaleString()} L</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">System Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <span className="text-sm text-gray-600">Tank Status</span>
                      <div className="flex items-center gap-2 mt-1">
                        {tankMetrics.statusIcon}
                        <span className="font-medium capitalize">{tank.latest_status}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Last Update</span>
                      <p className="font-medium">{formatSmartFillTimestamp(tank.latest_update_time)}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Data Synced</span>
                      <p className="font-medium">{formatSmartFillTimestamp(tank.updated_at)}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Added to System</span>
                      <p className="font-medium">{formatSmartFillTimestamp(tank.created_at)}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="api-data" className="p-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">SmartFill API Response Data</CardTitle>
                  <p className="text-sm text-gray-600">
                    Data retrieved from SmartFill JSON-RPC API Tank:Level method
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="font-semibold border-b pb-2">Tank Measurements</h3>
                      <div>
                        <span className="text-sm text-gray-600">Volume</span>
                        <p className="font-medium">{tank.latest_volume?.toLocaleString()} L</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Volume Percent</span>
                        <p className={`font-medium ${percentageColor}`}>
                          {tank.latest_volume_percent?.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Capacity</span>
                        <p className="font-medium">{tank.capacity?.toLocaleString()} L</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Tank SFL (Safe Fill Level)</span>
                        <p className="font-medium">
                          {tank.safe_fill_level ? `${tank.safe_fill_level.toLocaleString()} L` : 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-semibold border-b pb-2">System Status</h3>
                      <div>
                        <span className="text-sm text-gray-600">Status</span>
                        <div className="flex items-center gap-2 mt-1">
                          {tankMetrics.statusIcon}
                          <span className="font-medium">{tank.latest_status}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Last Updated</span>
                        <p className="font-medium">{tank.latest_update_time}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Timezone</span>
                        <p className="font-medium">{tank.location?.timezone || 'Australia/Perth'}</p>
                      </div>
                    </div>
                  </div>

                  {tank.location && (
                    <div className="mt-6 pt-6 border-t">
                      <h3 className="font-semibold mb-4">Location Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm text-gray-600">Location Description</span>
                          <p className="font-medium">{tank.location.description}</p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Customer GUID</span>
                          <p className="font-mono text-sm">{tank.location.customer_guid}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="p-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Data Update History</CardTitle>
                  <p className="text-sm text-gray-600">
                    Track when this tank data was last synchronized
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Clock className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="font-medium">Last SmartFill Update</p>
                        <p className="text-sm text-gray-600">{tank.latest_update_time}</p>
                        <p className="text-xs text-gray-500">
                          {formatSmartFillTimestamp(tank.latest_update_time)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Database className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-medium">Last Database Sync</p>
                        <p className="text-sm text-gray-600">{tank.updated_at}</p>
                        <p className="text-xs text-gray-500">
                          {formatSmartFillTimestamp(tank.updated_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Activity className="w-5 h-5 text-gray-600" />
                      <div>
                        <p className="font-medium">Added to System</p>
                        <p className="text-sm text-gray-600">{tank.created_at}</p>
                        <p className="text-xs text-gray-500">
                          {formatSmartFillTimestamp(tank.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Data Sync Information</h4>
                    <p className="text-sm text-blue-700">
                      Tank data is synchronized from SmartFill API using JSON-RPC 2.0 protocol. 
                      The system queries the Tank:Level method to retrieve current volume, capacity, 
                      and status information.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="raw" className="p-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Raw API Response</CardTitle>
                  <p className="text-sm text-gray-600">
                    Raw JSON data from SmartFill API for debugging
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-96">
                    <pre className="text-green-400 text-sm font-mono">
                      {JSON.stringify(tank.raw_data || {
                        "Unit Number": tank.unit_number,
                        "Tank Number": tank.tank_number,
                        "Description": tank.description,
                        "Volume": tank.latest_volume,
                        "Volume Percent": tank.latest_volume_percent,
                        "Capacity": tank.capacity,
                        "Tank SFL": tank.safe_fill_level,
                        "Status": tank.latest_status,
                        "Last Updated": tank.latest_update_time,
                        "Timezone": tank.location?.timezone || "Australia/Perth"
                      }, null, 2)}
                    </pre>
                  </div>
                  
                  <div className="mt-4 flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleExportTankData}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export Raw Data
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default SmartFillTankDetailModal;