
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Droplets, AlertTriangle, TrendingUp, Building2, ArrowUpRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GroupSnapshot } from '@/types/fuel';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

// Helper function to format volume display
const formatVolume = (volume: number): string => {
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(1)}M L`;
  } else if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}K L`;
  } else {
    return `${Math.round(volume)} L`;
  }
};

interface GroupSnapshotCardsProps {
  groups: GroupSnapshot[];
  onGroupClick: (groupId: string) => void;
  selectedGroup: string | null;
}

export function GroupSnapshotCards({ groups, onGroupClick, selectedGroup }: GroupSnapshotCardsProps) {
  const navigate = useNavigate();
  
  if (!groups?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <span className="text-4xl mb-2">🪫</span>
          <p className="text-sm text-muted-foreground">No tanks in this group yet. Contact your administrator to link depot data.</p>
        </CardContent>
      </Card>
    );
  }

  // Map group names to routes
  const groupRoute = (name: string) => {
    const slug = name.toLowerCase().replace(/ /g, '-');
    switch (slug) {
      case 'all-groups': return '/tanks'; // All Groups goes to tanks page
      case 'swan-transit': return '/swan-transit';
      case 'kalgoorlie': return '/kalgoorlie';
      case 'geraldton': return '/geraldton';
      case 'gsf-depots': return '/gsf-depots';
      case 'bgc': return '/bgc';
      default: return `/group/${slug}`;
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {groups.map((group) => {
        const isSelected = selectedGroup === group.id;
        const criticalTanks = group.criticalTanks || 0;
        const lowTanks = Math.max(0, Math.floor(group.totalTanks * 0.2) - criticalTanks);
        
        return (
          <Card
            key={group.id}
            className={cn(
              "cursor-pointer transition-all duration-200 border-2",
              "hover:shadow-md hover:-translate-y-0.5 hover:border-[#008457]/30",
              isSelected 
                ? "ring-2 ring-[#008457] shadow-lg border-[#008457]/50" 
                : "border-gray-200",
              criticalTanks > 0 && "ring-1 ring-red-200 border-red-200"
            )}
            onClick={() => navigate(groupRoute(group.name))}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#008457]/10 rounded-lg border border-[#008457]/20">
                    <Building2 className="h-5 w-5 text-[#008457]" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                      {group.name}
                      <ArrowUpRight className="w-4 h-4 text-[#008457]" />
                    </CardTitle>
                    <div className="flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <p className="text-xs text-gray-500">
                        {format(new Date(group.lastUpdated), 'MMM d, HH:mm')}
                      </p>
                    </div>
                  </div>
                </div>
                {criticalTanks > 0 && (
                  <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200 animate-pulse">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Alert
                  </Badge>
                )}
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tanks</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-bold text-gray-900">{group.totalTanks}</p>
                    <Droplets className="h-4 w-4 text-blue-500" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Avg Level</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-bold text-gray-900">{group.averageLevel}%</p>
                    <div className="w-8 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          group.averageLevel <= 29 ? "bg-red-500" :
                          group.averageLevel <= 49 ? "bg-[#FEDF19]" : "bg-[#008457]"
                        )}
                        style={{ width: `${Math.max(group.averageLevel, 5)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Volume</p>
                <p className={cn(
                  "text-sm font-bold",
                  group.totalVolume !== null ? "text-gray-900" : "text-gray-400"
                )}>
                  {group.totalVolume !== null ? formatVolume(group.totalVolume) : "No data"}
                </p>
              </div>
              
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
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
                    <Badge variant="default" className="bg-[#008457]/10 text-[#008457] border-[#008457]/20 text-xs">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      All Good
                    </Badge>
                  )}
                </div>
                {isSelected && (
                  <Badge variant="outline" className="text-xs border-[#008457]/30 text-[#008457]">
                    Active
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
