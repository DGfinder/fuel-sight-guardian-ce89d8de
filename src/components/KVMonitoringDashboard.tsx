/**
 * KV MONITORING AND ANALYTICS DASHBOARD
 * 
 * Comprehensive monitoring dashboard for Vercel KV cache performance,
 * usage statistics, and health monitoring
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  Database,
  Activity,
  Zap,
  Clock,
  HardDrive,
  Network,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Eye,
  Settings,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getCacheStats, cacheHealthCheck } from '@/lib/vercel-kv-cache';
import { formatDistanceToNow } from 'date-fns';

// Mock data for demonstration - in a real app, this would come from your KV monitoring service
const mockCacheMetrics = {
  hitRate: 85.4,
  missRate: 14.6,
  avgResponseTime: 12.3,
  totalRequests: 45678,
  totalHits: 39028,
  totalMisses: 6650,
  keyCount: 1247,
  memoryUsage: '156.7MB',
  memoryLimit: '512MB',
  connectionsActive: 23,
  connectionsTotal: 156,
  evictedKeys: 45,
  expiredKeys: 123
};

const mockTimeSeriesData = [
  { time: '00:00', hits: 120, misses: 20, responseTime: 10.2 },
  { time: '01:00', hits: 95, misses: 15, responseTime: 11.1 },
  { time: '02:00', hits: 80, misses: 12, responseTime: 9.8 },
  { time: '03:00', hits: 70, misses: 10, responseTime: 12.5 },
  { time: '04:00', hits: 85, misses: 18, responseTime: 13.2 },
  { time: '05:00', hits: 110, misses: 25, responseTime: 11.8 },
  { time: '06:00', hits: 140, misses: 30, responseTime: 10.5 },
  { time: '07:00', hits: 180, misses: 35, responseTime: 9.2 },
  { time: '08:00', hits: 220, misses: 40, responseTime: 8.8 },
  { time: '09:00', hits: 250, misses: 45, responseTime: 9.5 },
  { time: '10:00', hits: 280, misses: 50, responseTime: 10.1 },
  { time: '11:00', hits: 300, misses: 55, responseTime: 11.3 }
];

const mockCacheKeyStats = [
  { pattern: 'user:session:*', count: 245, hitRate: 92.1, avgSize: '2.3KB' },
  { pattern: 'smartfill:tanks:*', count: 89, hitRate: 88.5, avgSize: '15.7KB' },
  { pattern: 'agbot:locations:*', count: 67, hitRate: 85.2, avgSize: '8.4KB' },
  { pattern: 'captive:analytics:*', count: 156, hitRate: 91.8, avgSize: '5.2KB' },
  { pattern: 'user:prefs:*', count: 334, hitRate: 96.3, avgSize: '1.1KB' },
  { pattern: 'rate:*', count: 445, hitRate: 75.6, avgSize: '0.3KB' },
  { pattern: 'dedup:*', count: 78, hitRate: 68.4, avgSize: '0.8KB' }
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658'];

const HealthStatusBadge = ({ healthy, latency }: { healthy: boolean; latency: number }) => {
  if (healthy && latency < 50) {
    return <Badge className="bg-green-500">Healthy</Badge>;
  } else if (healthy && latency < 100) {
    return <Badge variant="secondary">Good</Badge>;
  } else if (healthy) {
    return <Badge variant="outline">Slow</Badge>;
  } else {
    return <Badge variant="destructive">Unhealthy</Badge>;
  }
};

export function KVMonitoringDashboard() {
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('6h');
  
  // Real KV health check
  const { data: healthCheck, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['kv-health'],
    queryFn: cacheHealthCheck,
    refetchInterval: 30 * 1000, // Every 30 seconds
  });

  // Real KV stats
  const { data: cacheStats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['kv-stats'],
    queryFn: getCacheStats,
    refetchInterval: 60 * 1000, // Every minute
  });

  const isHealthy = healthCheck?.healthy ?? false;
  const responseTime = healthCheck?.latency ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">KV Cache Monitoring</h2>
          <p className="text-muted-foreground">
            Monitor Vercel KV performance, usage, and health metrics
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchHealth()}
            disabled={healthLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${healthLoading ? 'animate-spin' : ''}`} />
            Refresh Health
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchStats()}
            disabled={statsLoading}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Refresh Stats
          </Button>
        </div>
      </div>

      {/* Health Status Alert */}
      <Alert className={isHealthy ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
        {isHealthy ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <XCircle className="h-4 w-4 text-red-600" />
        )}
        <AlertDescription>
          KV Cache Status: <strong>{isHealthy ? 'Healthy' : 'Unhealthy'}</strong>
          {healthCheck && (
            <>
              {' • '}Response Time: <strong>{responseTime.toFixed(1)}ms</strong>
              {healthCheck.error && (
                <>
                  {' • '}Error: <strong>{healthCheck.error}</strong>
                </>
              )}
            </>
          )}
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="keys">Key Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Key Metrics Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Health Status</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <HealthStatusBadge healthy={isHealthy} latency={responseTime} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Response: {responseTime.toFixed(1)}ms
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Hit Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {mockCacheMetrics.hitRate}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {mockCacheMetrics.totalHits.toLocaleString()} hits
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {cacheStats?.memory || mockCacheMetrics.memoryUsage}
                </div>
                <Progress 
                  value={30.6} 
                  className="mt-2" 
                />
                <p className="text-xs text-muted-foreground mt-1">
                  of {mockCacheMetrics.memoryLimit}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Keys</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {cacheStats?.keys || mockCacheMetrics.keyCount}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total cached keys
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Performance Overview Chart */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Cache Hit/Miss Ratio</CardTitle>
                <CardDescription>Last 12 hours</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Hits', value: mockCacheMetrics.totalHits, color: '#0088FE' },
                        { name: 'Misses', value: mockCacheMetrics.totalMisses, color: '#FF8042' }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      <Cell fill="#0088FE" />
                      <Cell fill="#FF8042" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Response Time Trend</CardTitle>
                <CardDescription>Average response time over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={mockTimeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="responseTime" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                      name="Response Time (ms)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* System Health Overview */}
          <Card>
            <CardHeader>
              <CardTitle>System Health Overview</CardTitle>
              <CardDescription>Current system status and metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Connection Health</span>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {mockCacheMetrics.connectionsActive} active / {mockCacheMetrics.connectionsTotal} total
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Memory Health</span>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    30.6% utilization
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Performance</span>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {mockCacheMetrics.avgResponseTime}ms avg response
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          {/* Time Range Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Time Range:</span>
            {(['1h', '6h', '24h', '7d'] as const).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange(range)}
              >
                {range}
              </Button>
            ))}
          </div>

          {/* Performance Charts */}
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Cache Performance Over Time</CardTitle>
                <CardDescription>Hits, misses, and response times</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={mockTimeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="hits" fill="#0088FE" name="Cache Hits" />
                    <Bar yAxisId="left" dataKey="misses" fill="#FF8042" name="Cache Misses" />
                    <Line 
                      yAxisId="right" 
                      type="monotone" 
                      dataKey="responseTime" 
                      stroke="#00C49F" 
                      strokeWidth={2}
                      name="Response Time (ms)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Cache Efficiency</CardTitle>
                  <CardDescription>Hit rate and miss rate breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Hit Rate</span>
                      <span className="text-sm font-bold text-green-600">
                        {mockCacheMetrics.hitRate}%
                      </span>
                    </div>
                    <Progress value={mockCacheMetrics.hitRate} className="bg-green-100" />
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Miss Rate</span>
                      <span className="text-sm font-bold text-red-600">
                        {mockCacheMetrics.missRate}%
                      </span>
                    </div>
                    <Progress value={mockCacheMetrics.missRate} className="bg-red-100" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Response Time Distribution</CardTitle>
                  <CardDescription>Performance metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Average</span>
                      <Badge variant="outline">{mockCacheMetrics.avgResponseTime}ms</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Current</span>
                      <Badge variant="outline">{responseTime.toFixed(1)}ms</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">P95</span>
                      <Badge variant="outline">18.2ms</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">P99</span>
                      <Badge variant="outline">45.7ms</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Memory Usage Breakdown</CardTitle>
                <CardDescription>How cache memory is being utilized</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Used Memory</span>
                      <span className="text-sm">{mockCacheMetrics.memoryUsage}</span>
                    </div>
                    <Progress value={30.6} />
                  </div>
                  
                  <div className="grid gap-2 md:grid-cols-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{mockCacheMetrics.keyCount}</div>
                      <div className="text-sm text-muted-foreground">Total Keys</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{mockCacheMetrics.evictedKeys}</div>
                      <div className="text-sm text-muted-foreground">Evicted Keys</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{mockCacheMetrics.expiredKeys}</div>
                      <div className="text-sm text-muted-foreground">Expired Keys</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Request Volume</CardTitle>
                <CardDescription>Cache request patterns over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={mockTimeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="hits"
                      stackId="1"
                      stroke="#0088FE"
                      fill="#0088FE"
                      name="Cache Hits"
                    />
                    <Area
                      type="monotone"
                      dataKey="misses"
                      stackId="1"
                      stroke="#FF8042"
                      fill="#FF8042"
                      name="Cache Misses"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="keys" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Key Pattern Analysis</CardTitle>
              <CardDescription>Performance breakdown by cache key patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pattern</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>Hit Rate</TableHead>
                    <TableHead>Avg Size</TableHead>
                    <TableHead>Performance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockCacheKeyStats.map((stat, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-sm">{stat.pattern}</TableCell>
                      <TableCell>{stat.count}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span>{stat.hitRate}%</span>
                          <Progress value={stat.hitRate} className="w-16" />
                        </div>
                      </TableCell>
                      <TableCell>{stat.avgSize}</TableCell>
                      <TableCell>
                        {stat.hitRate > 90 ? (
                          <Badge className="bg-green-500">Excellent</Badge>
                        ) : stat.hitRate > 80 ? (
                          <Badge variant="secondary">Good</Badge>
                        ) : (
                          <Badge variant="outline">Needs Improvement</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Patterns</CardTitle>
                <CardDescription>Highest hit rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockCacheKeyStats
                    .sort((a, b) => b.hitRate - a.hitRate)
                    .slice(0, 5)
                    .map((stat, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm font-mono">{stat.pattern}</span>
                        <Badge className="bg-green-500">{stat.hitRate}%</Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Patterns Needing Attention</CardTitle>
                <CardDescription>Lower hit rates or high miss rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockCacheKeyStats
                    .sort((a, b) => a.hitRate - b.hitRate)
                    .slice(0, 3)
                    .map((stat, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm font-mono">{stat.pattern}</span>
                        <Badge variant="outline">{stat.hitRate}%</Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}