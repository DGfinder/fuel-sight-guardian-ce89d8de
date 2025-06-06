
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building, AlertTriangle, TrendingUp, Droplets } from "lucide-react";
import { GroupSnapshot } from "@/types/fuel";

interface GroupSnapshotCardsProps {
  groups: GroupSnapshot[];
  onGroupClick: (groupName: string) => void;
}

export function GroupSnapshotCards({ groups, onGroupClick }: GroupSnapshotCardsProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'bg-fuel-critical';
      case 'warning': return 'bg-fuel-warning';
      case 'good': return 'bg-fuel-safe';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'critical': return <AlertTriangle className="w-5 h-5 text-fuel-critical" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-fuel-warning" />;
      case 'good': return <TrendingUp className="w-5 h-5 text-fuel-safe" />;
      default: return <Building className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Building className="w-5 h-5 text-primary" />
          Fuel Group Overview
        </h2>
        <p className="text-sm text-gray-500">Click a group to view detailed tank status</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map((group) => (
          <Card 
            key={group.groupName}
            className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 border-l-4 border-l-primary"
            onClick={() => onGroupClick(group.groupName)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">{group.groupName}</CardTitle>
                {getStatusIcon(group.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{group.totalTanks}</p>
                  <p className="text-xs text-gray-500">Total Tanks</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{group.avgPercentFull}%</p>
                  <p className="text-xs text-gray-500">Avg Full</p>
                </div>
              </div>

              {/* Stock Info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">
                    {(group.totalStock / 1000).toFixed(0)}k L
                  </span>
                </div>
                <div className={`w-3 h-3 rounded-full ${getStatusColor(group.status)}`} />
              </div>

              {/* Alert Badges */}
              {(group.tanksBelow10 > 0 || group.tanksBelow20 > 0) && (
                <div className="flex gap-2 flex-wrap">
                  {group.tanksBelow10 > 0 && (
                    <Badge className="bg-fuel-critical text-white text-xs">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {group.tanksBelow10} Critical
                    </Badge>
                  )}
                  {group.tanksBelow20 > 0 && (
                    <Badge className="bg-fuel-warning text-white text-xs">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {group.tanksBelow20} Low
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
