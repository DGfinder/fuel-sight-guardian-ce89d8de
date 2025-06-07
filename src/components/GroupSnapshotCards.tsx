
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Droplets, AlertTriangle, TrendingUp, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GroupSnapshot } from '@/types/fuel';

interface GroupSnapshotCardsProps {
  groups: GroupSnapshot[];
  onGroupClick: (groupId: string) => void;
  selectedGroup: string | null;
}

export function GroupSnapshotCards({ groups, onGroupClick, selectedGroup }: GroupSnapshotCardsProps) {
  if (!groups?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Building2 className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No depot groups available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {groups.map((group) => {
        const isSelected = selectedGroup === group.id;
        const criticalTanks = group.criticalTanks || 0;
        const lowTanks = Math.max(0, Math.floor(group.totalTanks * 0.2) - criticalTanks);
        
        return (
          <Card
            key={group.id}
            className={cn(
              "cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2",
              isSelected 
                ? "ring-2 ring-green-500 shadow-lg border-green-300" 
                : "hover:border-gray-300",
              criticalTanks > 0 && "ring-1 ring-red-200"
            )}
            onClick={() => onGroupClick(group.id)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg border border-green-200">
                  <Building2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-gray-900">{group.name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Last updated: {new Date(group.lastUpdated).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {criticalTanks > 0 && (
                <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200 animate-pulse">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Alert
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total Tanks</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-bold">{group.totalTanks}</p>
                    <Droplets className="h-4 w-4 text-blue-500" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Avg Level</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-bold">{group.averageLevel}%</p>
                    <div className="w-8 h-2 bg-gray-200 rounded-full">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all",
                          group.averageLevel <= 20 ? "bg-red-500" :
                          group.averageLevel <= 40 ? "bg-orange-500" :
                          group.averageLevel <= 60 ? "bg-yellow-500" : "bg-green-500"
                        )}
                        style={{ width: `${Math.max(group.averageLevel, 5)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-3 border-t">
                <div className="flex items-center gap-2 flex-wrap">
                  {criticalTanks > 0 && (
                    <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200 text-xs">
                      🔴 {criticalTanks} Critical
                    </Badge>
                  )}
                  {lowTanks > 0 && (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200 text-xs">
                      🟡 {lowTanks} Low
                    </Badge>
                  )}
                  {criticalTanks === 0 && lowTanks === 0 && (
                    <Badge variant="default" className="bg-green-100 text-green-800 border-green-200 text-xs">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      All Good
                    </Badge>
                  )}
                </div>
                {isSelected && (
                  <Badge variant="outline" className="text-xs border-green-300 text-green-700">
                    Selected
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
