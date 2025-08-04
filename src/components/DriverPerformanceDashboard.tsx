import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Shield, 
  AlertTriangle, 
  Truck, 
  Clock,
  Award,
  Target,
  BarChart3,
  Calendar,
  Filter,
  Download
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { getDriverPerformanceSummary, getDriverPerformanceMetrics } from '@/api/drivers';
import type { 
  DriverPerformanceSummary, 
  DriverPerformanceMetrics,
  FleetName,
  RiskLevel,
  Trend
} from '@/types/fleet';

interface PerformanceFilters {
  fleet?: FleetName;
  depot?: string;
  period?: string;
  riskLevel?: RiskLevel;
}

export default function DriverPerformanceDashboard() {
  const { toast } = useToast();
  const [performanceSummary, setPerformanceSummary] = useState<DriverPerformanceSummary[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<DriverPerformanceMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<PerformanceFilters>({});
  const [activeTab, setActiveTab] = useState('overview');

  // Performance stats
  const [stats, setStats] = useState({
    averageLytxScore: 0,
    averageGuardianScore: 0,
    totalIncidents: 0,
    topPerformers: 0,
    improvingDrivers: 0,
    decliningDrivers: 0
  });

  useEffect(() => {
    loadPerformanceData();
  }, [filters]);

  const loadPerformanceData = async () => {
    try {
      setLoading(true);
      
      const [summaryData, metricsData] = await Promise.all([
        getDriverPerformanceSummary({
          fleet: filters.fleet,
          depot: filters.depot
        }),
        getDriverPerformanceMetrics({
          period_type: 'Monthly',
          risk_level: filters.riskLevel
        })
      ]);

      setPerformanceSummary(summaryData);
      setPerformanceMetrics(metricsData);

      // Calculate stats
      const validLytxScores = summaryData.filter(d => d.lytx_safety_score !== undefined && d.lytx_safety_score !== null);
      const validGuardianScores = summaryData.filter(d => d.guardian_safety_score !== undefined && d.guardian_safety_score !== null);
      
      setStats({
        averageLytxScore: validLytxScores.length > 0 
          ? validLytxScores.reduce((sum, d) => sum + d.lytx_safety_score!, 0) / validLytxScores.length 
          : 0,
        averageGuardianScore: validGuardianScores.length > 0 
          ? validGuardianScores.reduce((sum, d) => sum + d.guardian_safety_score!, 0) / validGuardianScores.length 
          : 0,
        totalIncidents: summaryData.reduce((sum, d) => sum + (d.ytd_incidents || 0), 0),
        topPerformers: summaryData.filter(d => 
          d.risk_level === 'Low' || d.risk_level === 'Very Low'
        ).length,
        improvingDrivers: summaryData.filter(d => d.trend === 'Improving').length,
        decliningDrivers: summaryData.filter(d => d.trend === 'Declining').length
      });

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error loading performance data",
        description: error instanceof Error ? error.message : "Unknown error occurred"
      });
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk?: RiskLevel) => {
    switch (risk) {
      case 'Very High': return 'text-red-600 bg-red-50';
      case 'High': return 'text-red-500 bg-red-50';
      case 'Medium': return 'text-orange-500 bg-orange-50';
      case 'Low': return 'text-green-500 bg-green-50';
      case 'Very Low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-500 bg-gray-50';
    }
  };

  const getTrendIcon = (trend?: Trend) => {
    switch (trend) {
      case 'Improving': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'Declining': return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'Stable': return <BarChart3 className="h-4 w-4 text-gray-500" />;
      default: return null;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-orange-500';
    return 'text-red-500';
  };

  const exportPerformanceData = () => {
    const headers = [
      'Driver Name', 'Fleet', 'Depot', 'Status', 'LYTX Score', 'Guardian Score',
      'Total Deliveries', 'Total KM', 'Fuel Efficiency', 'On-Time Rate',
      'Risk Level', 'Trend', 'YTD Incidents', 'LYTX Percentile', 'Guardian Percentile'
    ];
    
    const csvContent = [
      headers.join(','),
      ...performanceSummary.map(driver => [
        `"${driver.first_name} ${driver.last_name}"`,
        driver.fleet,
        driver.depot,
        driver.status,
        driver.lytx_safety_score || '',
        driver.guardian_safety_score || '',
        driver.total_deliveries || '',
        driver.total_kilometers || '',
        driver.fuel_efficiency || '',
        driver.on_time_delivery_rate || '',
        driver.risk_level || '',
        driver.trend || '',
        driver.ytd_incidents || '',
        driver.lytx_percentile || '',
        driver.guardian_percentile || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `driver_performance_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Driver Performance</h1>
          <p className="text-muted-foreground">
            Monitor driver performance across Guardian, LYTX, and delivery metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportPerformanceData}>
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <Select 
              value={filters.fleet || ''} 
              onValueChange={(value) => setFilters({ ...filters, fleet: value as FleetName || undefined })}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Fleet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Fleets</SelectItem>
                <SelectItem value="Stevemacs">Stevemacs</SelectItem>
                <SelectItem value="Great Southern Fuels">Great Southern Fuels</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={filters.period || ''} 
              onValueChange={(value) => setFilters({ ...filters, period: value || undefined })}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Time</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={filters.riskLevel || ''} 
              onValueChange={(value) => setFilters({ ...filters, riskLevel: value as RiskLevel || undefined })}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Risk Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Risk</SelectItem>
                <SelectItem value="Very Low">Very Low</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Very High">Very High</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              onClick={() => setFilters({})}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Performance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg LYTX Score</p>
                <p className={`text-xl font-bold ${getScoreColor(stats.averageLytxScore)}`}>
                  {stats.averageLytxScore.toFixed(1)}
                </p>
              </div>
              <Shield className="h-6 w-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Guardian Score</p>
                <p className={`text-xl font-bold ${getScoreColor(stats.averageGuardianScore)}`}>
                  {stats.averageGuardianScore.toFixed(1)}
                </p>
              </div>
              <Shield className="h-6 w-6 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Incidents</p>
                <p className="text-xl font-bold">{stats.totalIncidents}</p>
              </div>
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Top Performers</p>
                <p className="text-xl font-bold text-green-600">{stats.topPerformers}</p>
              </div>
              <Award className="h-6 w-6 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Improving</p>
                <p className="text-xl font-bold text-green-600">{stats.improvingDrivers}</p>
              </div>
              <TrendingUp className="h-6 w-6 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Declining</p>
                <p className="text-xl font-bold text-red-600">{stats.decliningDrivers}</p>
              </div>
              <TrendingDown className="h-6 w-6 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="lytx">LYTX Performance</TabsTrigger>
          <TabsTrigger value="guardian">Guardian Performance</TabsTrigger>
          <TabsTrigger value="operational">Operational Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Driver Performance Overview</CardTitle>
              <CardDescription>
                Combined performance metrics across all systems
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver</TableHead>
                    <TableHead>Fleet</TableHead>
                    <TableHead>LYTX Score</TableHead>
                    <TableHead>Guardian Score</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Trend</TableHead>
                    <TableHead>Incidents (YTD)</TableHead>
                    <TableHead>Performance Rank</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performanceSummary.slice(0, 20).map((driver, index) => (
                    <TableRow key={driver.driver_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{driver.first_name} {driver.last_name}</p>
                          <p className="text-sm text-muted-foreground">{driver.depot}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{driver.fleet}</Badge>
                      </TableCell>
                      <TableCell>
                        {driver.lytx_safety_score !== undefined ? (
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${getScoreColor(driver.lytx_safety_score)}`}>
                              {driver.lytx_safety_score.toFixed(1)}
                            </span>
                            {driver.lytx_percentile && (
                              <span className="text-xs text-muted-foreground">
                                ({driver.lytx_percentile.toFixed(0)}th)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {driver.guardian_safety_score !== undefined ? (
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${getScoreColor(driver.guardian_safety_score)}`}>
                              {driver.guardian_safety_score.toFixed(1)}
                            </span>
                            {driver.guardian_percentile && (
                              <span className="text-xs text-muted-foreground">
                                ({driver.guardian_percentile.toFixed(0)}th)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={getRiskColor(driver.risk_level)}
                        >
                          {driver.risk_level || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTrendIcon(driver.trend)}
                          <span className="text-sm">{driver.trend || 'Stable'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{driver.ytd_incidents || 0}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {index < 5 && <Award className="h-4 w-4 text-yellow-500" />}
                          <span className="text-sm">#{index + 1}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lytx" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>LYTX Safety Performance</CardTitle>
              <CardDescription>
                Detailed LYTX safety metrics and rankings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver</TableHead>
                    <TableHead>Safety Score</TableHead>
                    <TableHead>Fleet Percentile</TableHead>
                    <TableHead>Event Types</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performanceSummary
                    .filter(d => d.lytx_safety_score !== undefined)
                    .sort((a, b) => (b.lytx_safety_score || 0) - (a.lytx_safety_score || 0))
                    .slice(0, 15)
                    .map((driver) => (
                      <TableRow key={driver.driver_id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{driver.first_name} {driver.last_name}</p>
                            <p className="text-sm text-muted-foreground">{driver.fleet} - {driver.depot}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={`text-xl font-bold ${getScoreColor(driver.lytx_safety_score || 0)}`}>
                              {driver.lytx_safety_score?.toFixed(1)}
                            </span>
                            <Progress 
                              value={(driver.lytx_safety_score || 0) * 10} 
                              className="w-20" 
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          {driver.lytx_percentile && (
                            <Badge variant="outline">
                              {driver.lytx_percentile.toFixed(0)}th percentile
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            Various safety events tracked
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={driver.status === 'Active' ? 'default' : 'secondary'}>
                            {driver.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guardian" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Guardian Safety Performance</CardTitle>
              <CardDescription>
                Guardian system safety metrics and fuel monitoring
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver</TableHead>
                    <TableHead>Safety Score</TableHead>
                    <TableHead>Fleet Percentile</TableHead>
                    <TableHead>Fuel Events</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performanceSummary
                    .filter(d => d.guardian_safety_score !== undefined)
                    .sort((a, b) => (b.guardian_safety_score || 0) - (a.guardian_safety_score || 0))
                    .slice(0, 15)
                    .map((driver) => (
                      <TableRow key={driver.driver_id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{driver.first_name} {driver.last_name}</p>
                            <p className="text-sm text-muted-foreground">{driver.fleet} - {driver.depot}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={`text-xl font-bold ${getScoreColor(driver.guardian_safety_score || 0)}`}>
                              {driver.guardian_safety_score?.toFixed(1)}
                            </span>
                            <Progress 
                              value={(driver.guardian_safety_score || 0) * 10} 
                              className="w-20" 
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          {driver.guardian_percentile && (
                            <Badge variant="outline">
                              {driver.guardian_percentile.toFixed(0)}th percentile
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            Fuel and safety monitoring
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={driver.status === 'Active' ? 'default' : 'secondary'}>
                            {driver.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operational" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Operational Performance</CardTitle>
              <CardDescription>
                Delivery metrics, fuel efficiency, and operational KPIs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver</TableHead>
                    <TableHead>Deliveries (YTD)</TableHead>
                    <TableHead>Kilometers (YTD)</TableHead>
                    <TableHead>Fuel Efficiency</TableHead>
                    <TableHead>On-Time Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performanceSummary
                    .filter(d => d.total_deliveries && d.total_deliveries > 0)
                    .sort((a, b) => (b.total_deliveries || 0) - (a.total_deliveries || 0))
                    .slice(0, 15)
                    .map((driver) => (
                      <TableRow key={driver.driver_id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{driver.first_name} {driver.last_name}</p>
                            <p className="text-sm text-muted-foreground">{driver.fleet} - {driver.depot}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-blue-500" />
                            <span className="font-medium">{driver.total_deliveries?.toLocaleString()}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{driver.total_kilometers?.toLocaleString()} km</span>
                        </TableCell>
                        <TableCell>
                          {driver.fuel_efficiency && (
                            <span className="font-medium">{driver.fuel_efficiency.toFixed(2)} L/100km</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {driver.on_time_delivery_rate !== undefined && (
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{driver.on_time_delivery_rate.toFixed(1)}%</span>
                              <Progress value={driver.on_time_delivery_rate} className="w-16" />
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}