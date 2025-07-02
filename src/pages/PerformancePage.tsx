import React, { useMemo } from 'react';
import { useTanks } from '@/hooks/useTanks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, AlertTriangle, Activity } from 'lucide-react';
import type { TankRow } from '@/types/fuel';

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
  const { tanks, isLoading } = useTanks();

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
                {groupPerformanceData.map((group, index) => (
                  <tr key={group.groupName} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">#{index + 1}</span>
                        {getPerformanceBadge(index)}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium">{group.groupName}</td>
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
                ))}
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
              {groupPerformanceData.map((group) => (
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
                    {groupPerformanceData[0]?.groupName || 'N/A'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-green-600">Avg Fuel Level</p>
                  <p className="text-lg font-bold text-green-800">
                    {groupPerformanceData[0]?.averageFuelLevel.toFixed(1) || '0'}%
                  </p>
                </div>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-red-800">Needs Attention</p>
                  <p className="text-lg font-bold text-red-900">
                    {groupPerformanceData[groupPerformanceData.length - 1]?.groupName || 'N/A'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-red-600">Critical Tanks</p>
                  <p className="text-lg font-bold text-red-800">
                    {groupPerformanceData[groupPerformanceData.length - 1]?.criticalPercentage.toFixed(1) || '0'}%
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
    </div>
  );
} 