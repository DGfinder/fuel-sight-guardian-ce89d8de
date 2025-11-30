
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
    <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide md:grid md:gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:overflow-visible md:pb-0">
      {groups.map((group) => {
        const isSelected = selectedGroup === group.id;
        const criticalTanks = group.criticalTanks || 0;
        const lowTanks = Math.max(0, Math.floor(group.totalTanks * 0.2) - criticalTanks);
        
        return (
          <Card
            key={group.id}
            className={cn(
              "cursor-pointer transition-all duration-300",
              "backdrop-blur-md bg-white/75 border border-white/40",
              "shadow-lg hover:shadow-2xl hover:-translate-y-1",
              "rounded-xl overflow-hidden",
              "snap-start flex-shrink-0 w-[280px] md:w-auto",
              isSelected
                ? "ring-2 ring-[#008457] shadow-xl border-[#008457]/50"
                : "",
              criticalTanks > 0 && "ring-2 ring-red-200/60"
            )}
            onClick={() => navigate(groupRoute(group.name))}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-gradient-to-br from-[#008457]/20 to-[#008457]/5 border border-[#008457]/20 shadow-inner">
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
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Avg Level</span>
                    <span className="font-bold text-gray-900">{group.averageLevel}%</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        "bg-gradient-to-r",
                        group.averageLevel <= 29 ? "from-red-500 to-red-400" :
                        group.averageLevel <= 49 ? "from-amber-500 to-yellow-400" :
                        "from-[#008457] to-emerald-400"
                      )}
                      style={{ width: `${Math.max(group.averageLevel, 5)}%` }}
                    />
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
              
              <div className="flex items-center justify-between pt-3 border-t border-gray-100/50">
                <div className="flex items-center gap-2 flex-wrap">
                  {criticalTanks > 0 && (
                    <Badge variant="destructive" className="px-3 py-1 rounded-full font-medium text-xs shadow-sm backdrop-blur-sm bg-red-50/80 text-red-700 border-red-200/50">
                      <span className="w-2 h-2 rounded-full bg-red-500 mr-2 inline-block"></span>
                      {criticalTanks} Critical
                    </Badge>
                  )}
                  {lowTanks > 0 && (
                    <Badge variant="secondary" className="px-3 py-1 rounded-full font-medium text-xs shadow-sm backdrop-blur-sm bg-amber-50/80 text-amber-700 border-amber-200/50">
                      <span className="w-2 h-2 rounded-full bg-amber-500 mr-2 inline-block"></span>
                      {lowTanks} Low
                    </Badge>
                  )}
                  {criticalTanks === 0 && lowTanks === 0 && (
                    <Badge variant="default" className="px-3 py-1 rounded-full font-medium text-xs shadow-sm backdrop-blur-sm bg-[#008457]/10 text-[#008457] border-[#008457]/20">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      All Good
                    </Badge>
                  )}
                </div>
                {isSelected && (
                  <Badge variant="outline" className="text-xs border-[#008457]/30 text-[#008457] backdrop-blur-sm">
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
