import React, { useMemo, useState } from 'react';
import { useTanks } from '@/hooks/useTanks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, AlertTriangle, Activity, Download, RefreshCw, Printer, Filter, ArrowUpDown } from 'lucide-react';
import type { TankRow } from '@/types/fuel';
import AuditActivity from '@/components/AuditActivity';

interface GroupPerformance {
  groupName: string;
  totalTanks: number;
  averageFuelLevel: number;
  averageDaysToMin: number;
  criticalPercentage: number;
  lowPercentage: number;
  normalPercentage: number;
}

export default function PerformancePage() {
  const { tanks, isLoading, error, refreshTanks, exportTanksToCSV } = useTanks();
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('performance');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const groupPerformanceData = useMemo(() => {
    if (!tanks || tanks.length === 0) return [];

    const groupMap = new Map<string, TankRow[]>();
    
    // Group tanks by group_name
    tanks.forEach(tank => {
      const groupName = tank.group_name || 'Unknown';
      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, []);
      }
      groupMap.get(groupName)!.push(tank);
    });

    // Calculate performance metrics for each group
    const performanceData: GroupPerformance[] = [];
    
    groupMap.forEach((groupTanks, groupName) => {
      const totalTanks = groupTanks.length;
      
      // Calculate average fuel level
      const validFuelLevels = groupTanks.filter(tank => tank.current_level_percent != null);
      const averageFuelLevel = validFuelLevels.length > 0 
        ? validFuelLevels.reduce((sum, tank) => sum + (tank.current_level_percent || 0), 0) / validFuelLevels.length
        : 0;

      // Calculate average days to min
      const validDaysToMin = groupTanks.filter(tank => tank.days_to_min_level != null && tank.days_to_min_level > 0);
      const averageDaysToMin = validDaysToMin.length > 0
        ? validDaysToMin.reduce((sum, tank) => sum + (tank.days_to_min_level || 0), 0) / validDaysToMin.length
        : 0;

      // Calculate status percentages
      const criticalTanks = groupTanks.filter(tank => (tank.current_level_percent || 0) <= 20).length;
      const lowTanks = groupTanks.filter(tank => {
        const level = tank.current_level_percent || 0;
        return level > 20 && level <= 40;
      }).length;
      const normalTanks = groupTanks.filter(tank => (tank.current_level_percent || 0) > 40).length;

      const criticalPercentage = (criticalTanks / totalTanks) * 100;
      const lowPercentage = (lowTanks / totalTanks) * 100;
      const normalPercentage = (normalTanks / totalTanks) * 100;

      performanceData.push({
        groupName,
        totalTanks,
        averageFuelLevel,
        averageDaysToMin,
        criticalPercentage,
        lowPercentage,
        normalPercentage
      });
    });

    // Sort by performance score (combination of fuel level and days to min)
    return performanceData.sort((a, b) => {
      const scoreA = a.averageFuelLevel + (a.averageDaysToMin * 2) - (a.criticalPercentage * 3);
      const scoreB = b.averageFuelLevel + (b.averageDaysToMin * 2) - (b.criticalPercentage * 3);
      return scoreB - scoreA;
    });
  }, [tanks]);

  const overallMetrics = useMemo(() => {
    if (!tanks || tanks.length === 0) return null;

    const totalTanks = tanks.length;
    const criticalTanks = tanks.filter(tank => (tank.current_level_percent || 0) <= 20).length;
    const lowTanks = tanks.filter(tank => {
      const level = tank.current_level_percent || 0;
      return level > 20 && level <= 40;
    }).length;
    const normalTanks = tanks.filter(tank => (tank.current_level_percent || 0) > 40).length;

    const validFuelLevels = tanks.filter(tank => tank.current_level_percent != null);
    const networkAverageFuel = validFuelLevels.length > 0
      ? validFuelLevels.reduce((sum, tank) => sum + (tank.current_level_percent || 0), 0) / validFuelLevels.length
      : 0;

    const validDaysToMin = tanks.filter(tank => tank.days_to_min_level != null && tank.days_to_min_level > 0);
    const networkAverageDays = validDaysToMin.length > 0
      ? validDaysToMin.reduce((sum, tank) => sum + (tank.days_to_min_level || 0), 0) / validDaysToMin.length
      : 0;

    return {
      totalTanks,
      criticalTanks,
      lowTanks,
      normalTanks,
      networkAverageFuel,
      networkAverageDays,
      criticalPercentage: (criticalTanks / totalTanks) * 100,
      healthScore: Math.round(networkAverageFuel + (networkAverageDays * 2) - ((criticalTanks / totalTanks) * 100 * 3))
    };
  }, [tanks]);

  // Get unique groups for filter
  const uniqueGroups = useMemo(() => {
    if (!tanks) return [];
    const groups = tanks.map(tank => tank.group_name).filter(Boolean) as string[];
    return Array.from(new Set(groups)).sort();
  }, [tanks]);

  // Filter and sort performance data
  const filteredAndSortedData = useMemo(() => {
    let filtered = [...groupPerformanceData];
    
    // Apply group filter
    if (selectedGroup !== 'all') {
      filtered = filtered.filter(group => group.groupName === selectedGroup);
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let valueA: number, valueB: number;
      
      switch (sortBy) {
        case 'groupName':
          return sortDirection === 'asc' 
            ? a.groupName.localeCompare(b.groupName)
            : b.groupName.localeCompare(a.groupName);
        case 'totalTanks':
          valueA = a.totalTanks;
          valueB = b.totalTanks;
          break;
        case 'averageFuelLevel':
          valueA = a.averageFuelLevel;
          valueB = b.averageFuelLevel;
          break;
        case 'averageDaysToMin':
          valueA = a.averageDaysToMin;
          valueB = b.averageDaysToMin;
          break;
        case 'criticalPercentage':
          valueA = a.criticalPercentage;
          valueB = b.criticalPercentage;
          break;
        default: // performance
          valueA = a.averageFuelLevel + (a.averageDaysToMin * 2) - (a.criticalPercentage * 3);
          valueB = b.averageFuelLevel + (b.averageDaysToMin * 2) - (b.criticalPercentage * 3);
      }
      
      return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
    });
    
    return filtered;
  }, [groupPerformanceData, selectedGroup, sortBy, sortDirection]);

  // Handle error state
  if (error) {
    // Safely extract error message from various error types
    const errorMessage = (() => {
      if (typeof error === 'string') return error;
      if (error && typeof error === 'object') {
        if ('message' in error && typeof error.message === 'string') return error.message;
        if ('details' in error && typeof error.details === 'string') return error.details;
        if ('code' in error) return `Database error (${error.code})`;
      }
      return 'Unable to load performance data. Please check your connection and try again.';
    })();

    return (
      <div className="p-6 text-center space-y-4">
        <AlertTriangle className="w-16 h-16 text-red-500 mx-auto" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Error loading performance data</h3>
          <p className="text-red-600 mt-1">{errorMessage}</p>
        </div>
        <Button onClick={() => refreshTanks()} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Loading performance analytics...</p>
        </div>
      </div>
    );
  }

  const getPerformanceBadge = (rank: number) => {
    if (rank === 0) return <Badge className="bg-green-500">🏆 Best</Badge>;
    if (rank === 1) return <Badge className="bg-blue-500">🥈 Good</Badge>;
    if (rank === 2) return <Badge className="bg-orange-500">🥉 Fair</Badge>;
    return <Badge variant="secondary">Needs Attention</Badge>;
  };

  const getStatusColor = (percentage: number) => {
    if (percentage <= 5) return 'text-green-600';
    if (percentage <= 15) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Export performance data as CSV
  const exportPerformanceData = () => {
    const headers = [
      'Rank', 'Group Name', 'Total Tanks', 'Average Fuel Level (%)', 
      'Average Days to Min', 'Critical %', 'Low %', 'Normal %', 'Performance Score'
    ];
    
    const csvData = groupPerformanceData.map((group, index) => {
      const performanceScore = group.averageFuelLevel + (group.averageDaysToMin * 2) - (group.criticalPercentage * 3);
      return [
        index + 1,
        group.groupName,
        group.totalTanks,
        group.averageFuelLevel.toFixed(1),
        group.averageDaysToMin.toFixed(1),
        group.criticalPercentage.toFixed(1),
        group.lowPercentage.toFixed(1),
        group.normalPercentage.toFixed(1),
        performanceScore.toFixed(1)
      ];
    });
    
    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => '"' + String(field).replaceAll('"', '""') + '"').join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'performance-report-' + new Date().toISOString().split('T')[0] + '.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print functionality
  const handlePrint = () => {
    window.print();
  };

  // Manual refresh
  const handleRefresh = () => {
    refreshTanks();
  };

  // Handle row click to expand/collapse details
  const handleRowClick = (groupName: string) => {
    setExpandedRow(expandedRow === groupName ? null : groupName);
  };

  // Get tanks for a specific group
  const getTanksForGroup = (groupName: string) => {
    if (!tanks) return [];
    return tanks.filter(tank => tank.group_name === groupName);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Performance Dashboard</h1>
          <p className="text-gray-600 mt-1">Contract performance analysis and service level monitoring</p>
        </div>
        <Badge className="bg-red-100 text-red-800 border-red-200">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Admin Only
        </Badge>
      </div>

      {/* Control Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Filters:</span>
              </div>
              
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Groups</SelectItem>
                  {uniqueGroups.map(group => (
                    <SelectItem key={group} value={group}>{group}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="performance">Performance Score</SelectItem>
                  <SelectItem value="groupName">Group Name</SelectItem>
                  <SelectItem value="totalTanks">Total Tanks</SelectItem>
                  <SelectItem value="averageFuelLevel">Avg Fuel Level</SelectItem>
                  <SelectItem value="averageDaysToMin">Days to Min</SelectItem>
                  <SelectItem value="criticalPercentage">Critical %</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                className="px-3"
              >
                <ArrowUpDown className="h-4 w-4" />
                {sortDirection === 'asc' ? 'Asc' : 'Desc'}
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportPerformanceData}
                className="whitespace-nowrap"
              >
                <Download className="h-4 w-4 mr-1" />
                Export CSV
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportTanksToCSV && exportTanksToCSV()}
                className="whitespace-nowrap"
              >
                <Download className="h-4 w-4 mr-1" />
                Export Tanks
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="whitespace-nowrap"
              >
                <Printer className="h-4 w-4 mr-1" />
                Print
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="whitespace-nowrap"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overall Network Metrics */}
      {overallMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Network Health Score</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallMetrics.healthScore}</div>
              <p className="text-xs text-muted-foreground">
                Overall performance index
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Fuel Level</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallMetrics.networkAverageFuel.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                Across {overallMetrics.totalTanks} tanks
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Days to Min</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallMetrics.networkAverageDays.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">
                Days remaining on average
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical Tanks</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{overallMetrics.criticalTanks}</div>
              <p className="text-xs text-muted-foreground">
                {overallMetrics.criticalPercentage.toFixed(1)}% of network
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Group Performance Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>Group Performance Leaderboard</CardTitle>
          <CardDescription>
            Service level comparison across depot groups (ranked by overall performance)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Rank</th>
                  <th className="text-left py-3 px-4">Group</th>
                  <th className="text-right py-3 px-4">Total Tanks</th>
                  <th className="text-right py-3 px-4">Avg Fuel Level</th>
                  <th className="text-right py-3 px-4">Avg Days to Min</th>
                  <th className="text-right py-3 px-4">Critical %</th>
                  <th className="text-right py-3 px-4">Low %</th>
                  <th className="text-right py-3 px-4">Normal %</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedData.map((group, index) => {
                  const isExpanded = expandedRow === group.groupName;
                  const groupTanks = getTanksForGroup(group.groupName);
                  
                  return (
                    <React.Fragment key={group.groupName}>
                      <tr 
                        className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => handleRowClick(group.groupName)}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">#{index + 1}</span>
                            {getPerformanceBadge(index)}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium">
                          <div className="flex items-center gap-2">
                            {group.groupName}
                            <span className="text-xs text-gray-400">
                              {isExpanded ? '▼' : '▶'}
                            </span>
                          </div>
                        </td>
                        <td className="text-right py-3 px-4">{group.totalTanks}</td>
                        <td className="text-right py-3 px-4 font-medium">
                          {group.averageFuelLevel.toFixed(1)}%
                        </td>
                        <td className="text-right py-3 px-4">
                          {group.averageDaysToMin.toFixed(1)} days
                        </td>
                        <td className={`text-right py-3 px-4 font-medium ${getStatusColor(group.criticalPercentage)}`}>
                          {group.criticalPercentage.toFixed(1)}%
                        </td>
                        <td className="text-right py-3 px-4 text-yellow-600">
                          {group.lowPercentage.toFixed(1)}%
                        </td>
                        <td className="text-right py-3 px-4 text-green-600">
                          {group.normalPercentage.toFixed(1)}%
                        </td>
                      </tr>
                      
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={8} className="px-4 py-4">
                            <div className="space-y-3">
                              <h4 className="font-medium text-sm text-gray-700">
                                Tank Details for {group.groupName}
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {groupTanks.slice(0, 6).map((tank) => (
                                  <div key={tank.id} className="bg-white p-3 rounded border">
                                    <div className="flex justify-between items-start mb-2">
                                      <span className="text-sm font-medium truncate">
                                        {tank.location}
                                      </span>
                                      <Badge 
                                        variant={
                                          (tank.current_level_percent || 0) <= 20 ? 'fuel-critical' :
                                          (tank.current_level_percent || 0) <= 40 ? 'fuel-low' : 'fuel-normal'
                                        }
                                        className="text-xs"
                                      >
                                        {tank.current_level_percent?.toFixed(1) || 'N/A'}%
                                      </Badge>
                                    </div>
                                    <div className="text-xs text-gray-600 space-y-1">
                                      <div>Product: {tank.product_type || 'Unknown'}</div>
                                      {tank.days_to_min_level && tank.days_to_min_level > 0 && (
                                        <div>Days to min: {tank.days_to_min_level.toFixed(1)}</div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {groupTanks.length > 6 && (
                                <p className="text-xs text-gray-500">
                                  ... and {groupTanks.length - 6} more tanks
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Critical State Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Critical State Analysis</CardTitle>
            <CardDescription>Percentage of tanks in critical state by group</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredAndSortedData.map((group) => (
                <div key={group.groupName} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{group.groupName}</span>
                    <span className={getStatusColor(group.criticalPercentage)}>
                      {group.criticalPercentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-red-500 h-2 rounded-full"
                      style={{ width: `${Math.min(group.criticalPercentage, 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Service Level Summary</CardTitle>
            <CardDescription>Key performance indicators overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-green-800">Best Performing Group</p>
                  <p className="text-lg font-bold text-green-900">
                    {filteredAndSortedData[0]?.groupName || 'N/A'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-green-600">Avg Fuel Level</p>
                  <p className="text-lg font-bold text-green-800">
                    {filteredAndSortedData[0]?.averageFuelLevel.toFixed(1) || '0'}%
                  </p>
                </div>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-red-800">Needs Attention</p>
                  <p className="text-lg font-bold text-red-900">
                    {filteredAndSortedData[filteredAndSortedData.length - 1]?.groupName || 'N/A'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-red-600">Critical Tanks</p>
                  <p className="text-lg font-bold text-red-800">
                    {filteredAndSortedData[filteredAndSortedData.length - 1]?.criticalPercentage.toFixed(1) || '0'}%
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-blue-800">Network Average</p>
                  <p className="text-lg font-bold text-blue-900">Days to Minimum</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-blue-800">
                    {overallMetrics?.networkAverageDays.toFixed(1) || '0'} days
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Audit Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AuditActivity 
          hours={24}
          limit={50}
          showTitle={true}
        />
        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
            <CardDescription>Key metrics and alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Database Status</span>
                <Badge className="bg-green-500">Online</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Real-time Updates</span>
                <Badge className="bg-green-500">Active</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Audit Logging</span>
                <Badge className="bg-green-500">Enabled</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Security Monitoring</span>
                <Badge className="bg-green-500">Active</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 