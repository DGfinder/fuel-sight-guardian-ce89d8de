import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  CheckCircle,
  RefreshCw,
  Fuel,
  Activity,
  Clock,
  Database,
  Zap,
  Signal,
  SignalMedium,
  SignalLow,
  WifiOff
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface GasbotReading {
  id: number;
  location_name: string;
  customer_name: string;
  device_serial: string;
  fuel_level_percent: number;
  volume_litres: number;
  device_online: boolean;
  battery_voltage: number;
  last_reading: string;
  received_at: string;
}

const GasbotSimpleDashboard = () => {
  const [readings, setReadings] = useState<GasbotReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchReadings = async () => {
    try {
      setLoading(true);
      
      // Get latest reading for each location
      const { data, error } = await supabase
        .from('gasbot_latest_readings')
        .select('*')
        .order('fuel_level_percent', { ascending: true });

      if (error) throw error;

      setReadings(data || []);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching Gasbot readings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReadings();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchReadings, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate summary stats
  const stats = React.useMemo(() => {
    const totalTanks = readings.length;
    const onlineTanks = readings.filter(r => r.device_online).length;
    const lowFuelTanks = readings.filter(r => r.fuel_level_percent < 20).length;
    const avgFuelLevel = readings.length > 0 
      ? readings.reduce((sum, r) => sum + r.fuel_level_percent, 0) / readings.length 
      : 0;

    return {
      totalTanks,
      onlineTanks,
      lowFuelTanks,
      avgFuelLevel: Math.round(avgFuelLevel * 10) / 10
    };
  }, [readings]);

  const getFuelLevelColor = (percentage: number) => {
    if (percentage < 20) return 'text-red-600';
    if (percentage < 40) return 'text-yellow-600'; 
    return 'text-green-600';
  };

  const getFuelLevelBadge = (percentage: number) => {
    if (percentage < 20) return <Badge variant="destructive">Low</Badge>;
    if (percentage < 40) return <Badge variant="secondary">Medium</Badge>;
    return <Badge variant="default">Good</Badge>;
  };

  const getSignalIcon = (voltage: number, online: boolean) => {
    if (!online) return <WifiOff className="w-4 h-4 text-red-500" />;
    if (voltage >= 3.5) return <Signal className="w-4 h-4 text-green-500" />;
    if (voltage >= 3.2) return <SignalMedium className="w-4 h-4 text-yellow-500" />;
    return <SignalLow className="w-4 h-4 text-red-500" />;
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gasbot Fuel Monitor</h1>
          <p className="text-gray-600 mt-1">
            Simplified webhook data • {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Loading...'}
          </p>
        </div>
        <Button 
          onClick={fetchReadings} 
          disabled={loading}
          variant="outline"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Tanks</p>
                <p className="text-2xl font-bold text-blue-600">{stats.totalTanks}</p>
              </div>
              <Fuel className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Online</p>
                <p className="text-2xl font-bold text-green-600">{stats.onlineTanks}</p>
              </div>
              <Activity className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Low Fuel</p>
                <p className="text-2xl font-bold text-red-600">{stats.lowFuelTanks}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Fuel Level</p>
                <p className={`text-2xl font-bold ${getFuelLevelColor(stats.avgFuelLevel)}`}>
                  {stats.avgFuelLevel}%
                </p>
              </div>
              <Database className="w-8 h-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tank Readings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fuel className="w-5 h-5" />
            Tank Readings
          </CardTitle>
          <CardDescription>
            Latest reading from each tank location
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              Loading tank data...
            </div>
          ) : readings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Database className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No tank readings found</p>
              <p className="text-sm">Send data to the webhook to see readings here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Serial</TableHead>
                    <TableHead>Fuel Level</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Battery</TableHead>
                    <TableHead>Last Reading</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {readings.map((reading) => (
                    <TableRow 
                      key={reading.id}
                      className={!reading.device_online ? 'bg-red-50' : ''}
                    >
                      <TableCell className="font-medium">
                        {reading.location_name}
                      </TableCell>
                      
                      <TableCell className="text-gray-600">
                        {reading.customer_name || 'Unknown'}
                      </TableCell>
                      
                      <TableCell className="font-mono text-sm">
                        {reading.device_serial}
                      </TableCell>
                      
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold ${getFuelLevelColor(reading.fuel_level_percent)}`}>
                              {reading.fuel_level_percent.toFixed(1)}%
                            </span>
                            {getFuelLevelBadge(reading.fuel_level_percent)}
                          </div>
                          <Progress value={reading.fuel_level_percent} className="h-2 w-20" />
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        {reading.volume_litres > 0 ? `${reading.volume_litres.toLocaleString()} L` : '-'}
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getSignalIcon(reading.battery_voltage, reading.device_online)}
                          <span className={reading.device_online ? 'text-green-600' : 'text-red-600'}>
                            {reading.device_online ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        {reading.battery_voltage > 0 ? (
                          <div className="flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            <span className="text-sm">
                              {reading.battery_voltage.toFixed(2)}V
                            </span>
                          </div>
                        ) : '-'}
                      </TableCell>
                      
                      <TableCell className="text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(reading.last_reading)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook Info */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-900">📡 Webhook Configuration</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p><strong>URL:</strong></p>
              <code className="bg-blue-100 px-2 py-1 rounded text-xs">
                /api/gasbot-webhook-simple
              </code>
            </div>
            <div>
              <p><strong>Authentication:</strong></p>
              <code className="bg-blue-100 px-2 py-1 rounded text-xs">
                X-API-Key: gasbot-2025
              </code>
            </div>
            <div className="md:col-span-2">
              <p><strong>Test URL:</strong></p>
              <code className="bg-blue-100 px-2 py-1 rounded text-xs break-all">
                /api/gasbot-webhook-simple?key=gasbot-2025&location=TestTank&fuel_level=75
              </code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GasbotSimpleDashboard;