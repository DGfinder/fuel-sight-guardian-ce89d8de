
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Clock, Droplets } from "lucide-react";
import { Tank } from "@/types/fuel";

interface FuelTableProps {
  tanks: Tank[];
  onRowClick: (tank: Tank) => void;
}

export function FuelTable({ tanks, onRowClick }: FuelTableProps) {
  const getPercentageFull = (tank: Tank) => {
    return (tank.currentLevel / tank.capacity) * 100;
  };

  const getStatusColor = (percentage: number) => {
    if (percentage <= 10) return 'fuel-critical';
    if (percentage <= 20) return 'fuel-warning';
    if (percentage <= 50) return 'fuel-warning';
    return 'fuel-safe';
  };

  const getStatusBadge = (percentage: number) => {
    if (percentage <= 10) return <Badge className="bg-fuel-critical text-white">Critical</Badge>;
    if (percentage <= 20) return <Badge className="bg-fuel-warning text-white">Low</Badge>;
    if (percentage <= 50) return <Badge className="bg-yellow-500 text-white">Medium</Badge>;
    return <Badge className="bg-fuel-safe text-white">Good</Badge>;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(Math.round(num));
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Droplets className="w-5 h-5 text-primary" />
          Fuel Tank Status
        </CardTitle>
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
                <TableHead>Days to Min</TableHead>
                <TableHead>Last Dip</TableHead>
                <TableHead>Rolling Avg</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tanks.map((tank) => {
                const percentage = getPercentageFull(tank);
                const statusColor = getStatusColor(percentage);
                
                return (
                  <TableRow 
                    key={tank.id}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => onRowClick(tank)}
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
                        <div className="font-medium">{formatNumber(tank.currentLevel)}L</div>
                        <div className="text-xs text-gray-500">of {formatNumber(tank.capacity)}L</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-bold text-${statusColor}`}>
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                        <Progress 
                          value={percentage} 
                          className={`h-2 bg-gray-200`}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(percentage)}
                      {tank.alerts.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <AlertTriangle className="w-3 h-3 text-fuel-critical" />
                          <span className="text-xs text-fuel-critical">{tank.alerts.length} alerts</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span className={`text-sm font-medium ${tank.daysToMinLevel <= 3 ? 'text-fuel-critical' : tank.daysToMinLevel <= 7 ? 'text-fuel-warning' : 'text-gray-900'}`}>
                          {tank.daysToMinLevel} days
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="text-gray-900">{new Date(tank.lastDipDate).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-500">by {tank.lastDipBy}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{formatNumber(tank.rollingAvg)}L/day</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
