
import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, Droplets, Filter, TrendingDown, TrendingUp, CheckCircle } from "lucide-react";
import { Tank } from "@/types/fuel";

interface FuelTableProps {
  tanks: Tank[];
  onRowClick: (tank: Tank) => void;
}

export function FuelTable({ tanks, onRowClick }: FuelTableProps) {
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);

  const getPercentageFull = (tank: Tank) => {
    return (tank.currentLevel / tank.capacity) * 100;
  };

  const getStatusColor = (percentage: number) => {
    if (percentage <= 30) return 'fuel-critical';
    if (percentage < 50) return 'fuel-warning';
    return 'fuel-safe';
  };

  const getStatusBadge = (percentage: number) => {
    if (percentage <= 30) return <Badge className="bg-fuel-critical text-white">Critical</Badge>;
    if (percentage < 50) return <Badge className="bg-fuel-warning text-white">Low</Badge>;
    return <Badge className="bg-gray-500 text-white">Good</Badge>;
  };

  const getDaysToMinStyle = (days: number) => {
    if (days <= 2) return 'text-fuel-critical font-bold';
    if (days <= 5) return 'text-fuel-warning font-semibold';
    return 'text-gray-900';
  };

  const getTrendIcon = (tank: Tank) => {
    // Mock trend calculation - in production this would be based on historical data
    const mockTrendUp = tank.id === '3'; // Kalgoorlie showing improvement
    return mockTrendUp ? 
      <TrendingUp className="w-3 h-3 text-green-600 ml-1" aria-label="Burn rate decreasing" /> : 
      <TrendingDown className="w-3 h-3 text-red-500 ml-1" aria-label="Burn rate increasing" />;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(Math.round(num));
  };

  // Sort tanks by percentage full (ascending) and filter if needed
  const sortedTanks = [...tanks]
    .filter(tank => {
      if (!showCriticalOnly) return true;
      const percentage = getPercentageFull(tank);
      return percentage <= 30 || tank.daysToMinLevel <= 2;
    })
    .sort((a, b) => getPercentageFull(a) - getPercentageFull(b));

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-primary" />
            Fuel Tank Status
          </CardTitle>
          <Button
            variant={showCriticalOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowCriticalOnly(!showCriticalOnly)}
            className="flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            {showCriticalOnly ? "Show All" : "Show Critical Only"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Current Level</TableHead>
                <TableHead>% Full</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Days-to-Min</TableHead>
                <TableHead>Last Dip</TableHead>
                <TableHead>Burn Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTanks.map((tank) => {
                const percentage = getPercentageFull(tank);
                const statusColor = getStatusColor(percentage);
                
                return (
                  <TableRow 
                    key={tank.id}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => onRowClick(tank)}
                    role="button"
                    aria-label={`View details for ${tank.location} tank`}
                  >
                    <TableCell className="font-medium">
                      <div>
                        <div className="font-semibold">{tank.location}</div>
                        <div className="text-xs text-gray-500">{tank.depot}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{tank.productType}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{formatNumber(tank.currentLevel)} L</div>
                        <div className="text-xs text-gray-500">of {formatNumber(tank.capacity)} L</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2 min-w-[100px]">
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-bold text-${statusColor}`}>
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                        <Progress 
                          value={percentage} 
                          className="h-3"
                          style={{
                            background: '#f3f4f6'
                          }}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(percentage)}
                      {tank.alerts.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <AlertTriangle className="w-3 h-3 text-fuel-critical" />
                          <span className="text-xs text-fuel-critical">
                            {tank.alerts.length} {tank.alerts.length === 1 ? 'alert' : 'alerts'}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Clock className="w-3 h-3 text-gray-400 mr-1" />
                        <span className={`text-sm ${getDaysToMinStyle(tank.daysToMinLevel)}`}>
                          {tank.daysToMinLevel} days
                        </span>
                        {getTrendIcon(tank)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="text-gray-900">{new Date(tank.lastDipDate).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-500">by {tank.lastDipBy}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{formatNumber(tank.rollingAvg)} L/day</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        
        {sortedTanks.length === 0 && showCriticalOnly && (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-fuel-safe" />
            <p className="text-lg font-medium">No critical tanks found</p>
            <p className="text-sm">All tanks are operating within safe levels</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
