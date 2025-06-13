// COMMENTED OUT: Deprecated. Use TankStatusTable instead.
// export function EnhancedFuelTable({ tanks = [], onTankClick, defaultOpenGroup = null }: EnhancedFuelTableProps) {
//   ...
// }

import React, { useState, useMemo, useEffect } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger
} from "@/components/ui/collapsible";
import {
  ChevronDown, ChevronRight, ChevronUp, Droplets, AlertTriangle, Clock, Star, ArrowUpDown
} from "lucide-react";
import { Tank } from "@/types/fuel";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useFavourites } from '@/hooks/useFavourites';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/lib/supabase';

interface EnhancedFuelTableProps {
  tanks?: Tank[];
  onTankClick?: (tank: Tank) => void;
  defaultOpenGroup?: string | null;
}

type SortField = 'location' | 'product_type' | 'current_level' | 'current_level_percent' | 'days_to_min_level' | 'last_dip_date';
type SortDirection = 'asc' | 'desc';

function TankStatusBadge({ level, daysToMin }: { level: number; daysToMin: number | null }) {
  if (level <= 10) return <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">Critical</Badge>;
  if (level <= 20) return <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">Low</Badge>;
  if (daysToMin !== null && daysToMin <= 2) return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">Low Days</Badge>;
  return <Badge variant="default" className="bg-[#008457]/10 text-[#008457] border-[#008457]/20">Normal</Badge>;
}

function SortButton({ field, currentSort, onSort, children }: {
  field: SortField;
  currentSort: { field: SortField | null; direction: SortDirection };
  onSort: (field: SortField) => void;
  children: React.ReactNode;
}) {
  const isActive = currentSort.field === field;
  
  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 hover:text-[#008457] transition-colors font-medium"
    >
      {children}
      {isActive ? (
        currentSort.direction === 'asc' ? 
          <ChevronUp className="w-4 h-4" /> : 
          <ChevronDown className="w-4 h-4" />
      ) : (
        <ArrowUpDown className="w-4 h-4 opacity-50" />
      )}
    </button>
  );
}

export function EnhancedFuelTable({ tanks = [], onTankClick, defaultOpenGroup = null }: EnhancedFuelTableProps) {
  const { getFavourites, toggleFavourite } = useFavourites('');
  const favourites = [];
  const isMobile = useIsMobile();
  
  const [sortConfig, setSortConfig] = useState<{ field: SortField | null; direction: SortDirection }>({
    field: null,
    direction: 'asc'
  });

  const [user, setUser] = useState(null);
  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user || null);
    };
    getSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  // Group tanks by group name
  const grouped = useMemo(() => {
    const result: Record<string, Tank[]> = {};
    tanks.forEach(tank => {
      const group = tank.group_name || tank.tank_groups?.name || tank.group_id || 'Unknown Group';
      if (!result[group]) result[group] = [];
      result[group].push(tank);
    });
    return result;
  }, [tanks]);

  // Sort tanks within each group
  const sortedGrouped = useMemo(() => {
    if (!sortConfig.field) return grouped;
    
    const sorted: Record<string, Tank[]> = {};
    Object.entries(grouped).forEach(([groupName, tanks]) => {
      sorted[groupName] = [...tanks].sort((a, b) => {
        let aValue = a[sortConfig.field!];
        let bValue = b[sortConfig.field!];
        
        // Handle different data types
        if (sortConfig.field === 'current_level' || sortConfig.field === 'current_level_percent' || sortConfig.field === 'days_to_min_level') {
          aValue = Number(aValue) || 0;
          bValue = Number(bValue) || 0;
        } else if (sortConfig.field === 'location' || sortConfig.field === 'product_type') {
          aValue = String(aValue || '').toLowerCase();
          bValue = String(bValue || '').toLowerCase();
        } else if (sortConfig.field === 'last_dip_date') {
          aValue = aValue ? new Date(aValue).getTime() : 0;
          bValue = bValue ? new Date(bValue).getTime() : 0;
        }
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    });
    return sorted;
  }, [grouped, sortConfig]);

  const handleSort = (field: SortField) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  if (!tanks?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Droplets className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Tanks Found</h3>
          <p className="text-gray-600 text-center">
            No fuel tanks are available for your current access level.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isMobile) {
    // Mobile card layout
    return (
      <div className="space-y-3">
        {tanks.map(tank => (
          <Card key={tank.id} 
            className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            onClick={() => onTankClick?.(tank)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Droplets className="h-5 w-5 text-[#008457]" />
                  <span className="font-semibold text-gray-900">{tank.location}</span>
                  {user && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); toggleFavourite(tank.id); }}
                      className="focus:outline-none"
                    >
                      <Star
                        className={cn(
                          'w-4 h-4',
                          favourites.includes(tank.id)
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-gray-300'
                        )}
                      />
                    </button>
                  )}
                </div>
                <TankStatusBadge level={tank.current_level_percent} daysToMin={tank.days_to_min_level} />
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Current Level</p>
                  <p className="font-bold">{tank.current_level.toLocaleString()} L</p>
                </div>
                <div>
                  <p className="text-gray-500">% Full</p>
                  <p className="font-bold">{tank.current_level_percent}%</p>
                </div>
                <div>
                  <p className="text-gray-500">Days to Min</p>
                  <p className="font-bold">{tank.days_to_min_level ?? 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Product</p>
                  <Badge variant="outline">{tank.product_type}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(sortedGrouped).map(([groupName, groupTanks]) => {
        const criticalCount = groupTanks.filter(t => t.current_level_percent <= 10).length;
        const lowCount = groupTanks.filter(t => t.current_level_percent <= 20 && t.current_level_percent > 10).length;
        
        return (
          <Card key={groupName} className="border border-gray-200 shadow-sm">
            <Collapsible defaultOpen={defaultOpenGroup === groupName}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors pb-4">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                      <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-3">
                        {groupName}
                        {criticalCount > 0 && <span className="w-3 h-3 rounded-full bg-red-500" title="Critical tanks" />}
                        {criticalCount === 0 && lowCount > 0 && <span className="w-3 h-3 rounded-full bg-yellow-400" title="Low tanks" />}
                      </CardTitle>
                      <Badge variant="outline" className="bg-gray-50">
                        {groupTanks.length} tank{groupTanks.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {criticalCount > 0 && (
                        <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">
                          {criticalCount} Critical
                        </Badge>
                      )}
                      {lowCount > 0 && (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                          {lowCount} Low
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="w-full overflow-x-auto">
                    <Table className="w-full table-auto">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="px-4 py-2 font-medium text-gray-700 bg-gray-50">
                            <SortButton field="location" currentSort={sortConfig} onSort={handleSort}>Location</SortButton>
                          </TableHead>
                          <TableHead className="px-4 py-2 font-medium text-gray-700 bg-gray-50">
                            <SortButton field="product_type" currentSort={sortConfig} onSort={handleSort}>Product</SortButton>
                          </TableHead>
                          <TableHead className="px-4 py-2 font-medium text-gray-700 bg-gray-50">Status</TableHead>
                          <TableHead className="px-4 py-2 font-medium text-gray-700 bg-gray-50 text-right">
                            <SortButton field="current_level" currentSort={sortConfig} onSort={handleSort}>Current Level</SortButton>
                          </TableHead>
                          <TableHead className="px-4 py-2 font-medium text-gray-700 bg-gray-50 text-right">
                            <SortButton field="current_level_percent" currentSort={sortConfig} onSort={handleSort}>% Full</SortButton>
                          </TableHead>
                          <TableHead className="px-4 py-2 font-medium text-gray-700 bg-gray-50 text-right">
                            <SortButton field="days_to_min_level" currentSort={sortConfig} onSort={handleSort}>Days to Min</SortButton>
                          </TableHead>
                          <TableHead className="px-4 py-2 font-medium text-gray-700 bg-gray-50 text-right">
                            <SortButton field="last_dip_date" currentSort={sortConfig} onSort={handleSort}>Last Updated</SortButton>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupTanks.map((tank) => (
                          <TableRow
                            key={tank.id}
                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => onTankClick?.(tank)}
                          >
                            <TableCell className="px-4 py-2 font-normal">
                              <div className="flex items-center gap-2">
                                <Droplets className="h-4 w-4 text-primary" />
                                <span className="font-medium">{tank.location}</span>
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-2 font-normal">
                              <Badge variant="outline" className="font-mono">
                                {tank.product_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-4 py-2 font-normal">
                              <TankStatusBadge
                                level={tank.current_level_percent}
                                daysToMin={tank.days_to_min_level}
                              />
                            </TableCell>
                            <TableCell className="px-4 py-2 font-normal text-right">
                              <div className="flex flex-col items-end">
                                <span className="font-bold text-lg">
                                  {tank.current_level.toLocaleString()} L
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  of {tank.safe_level.toLocaleString()} L
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-2 font-normal text-right">
                              <div className="flex flex-col items-end">
                                <span className="font-bold text-lg">
                                  {tank.current_level_percent}%
                                </span>
                                <div className="w-16 h-2 bg-gray-200 rounded-full mt-1">
                                  <div 
                                    className={cn(
                                      "h-full rounded-full transition-all",
                                      tank.current_level_percent <= 10 ? "bg-red-500" :
                                      tank.current_level_percent <= 20 ? "bg-orange-500" :
                                      tank.current_level_percent <= 30 ? "bg-yellow-500" : "bg-green-500"
                                    )}
                                    style={{ width: `${Math.max(tank.current_level_percent, 2)}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-2 font-normal text-right">
                              {tank.days_to_min_level !== null ? (
                                <div className="flex flex-col items-end">
                                  <span className="font-bold text-lg">{tank.days_to_min_level} days</span>
                                  <div className="w-16 h-2 bg-gray-200 rounded-full mt-1">
                                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, (tank.days_to_min_level / 30) * 100)}%` }} />
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">N/A</span>
                              )}
                            </TableCell>
                            <TableCell className="px-4 py-2 font-normal text-right text-xs text-muted-foreground">
                              {tank.last_dip_date ? format(new Date(tank.last_dip_date), 'MMM d, HH:mm') : 'No data'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}
    </div>
  );
}
