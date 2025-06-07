
import React, { useState, useMemo } from 'react';
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
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const { user } = useAuth();
  const userId = user?.id;
  const { getFavourites, toggleFavourite } = useFavourites(userId || '');
  const favourites = userId ? getFavourites() : [];
  const isMobile = useIsMobile();
  
  const [sortConfig, setSortConfig] = useState<{ field: SortField | null; direction: SortDirection }>({
    field: null,
    direction: 'asc'
  });

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
                  {userId && (
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
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-gray-200">
                          <TableHead className="text-left font-semibold text-gray-700">
                            <SortButton field="location" currentSort={sortConfig} onSort={handleSort}>
                              Location
                            </SortButton>
                          </TableHead>
                          <TableHead className="text-left font-semibold text-gray-700">
                            <SortButton field="product_type" currentSort={sortConfig} onSort={handleSort}>
                              Product
                            </SortButton>
                          </TableHead>
                          <TableHead className="text-center font-semibold text-gray-700">Status</TableHead>
                          <TableHead className="text-right font-semibold text-gray-700">
                            <SortButton field="current_level" currentSort={sortConfig} onSort={handleSort}>
                              Current Level
                            </SortButton>
                          </TableHead>
                          <TableHead className="text-right font-semibold text-gray-700">
                            <SortButton field="current_level_percent" currentSort={sortConfig} onSort={handleSort}>
                              % Full
                            </SortButton>
                          </TableHead>
                          <TableHead className="text-right font-semibold text-gray-700">
                            <SortButton field="days_to_min_level" currentSort={sortConfig} onSort={handleSort}>
                              Days to Min
                            </SortButton>
                          </TableHead>
                          <TableHead className="text-right font-semibold text-gray-700">
                            <SortButton field="last_dip_date" currentSort={sortConfig} onSort={handleSort}>
                              Last Updated
                            </SortButton>
                          </TableHead>
                          {userId && <TableHead className="text-center font-semibold text-gray-700">Favourite</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupTanks.map((tank) => (
                          <TableRow
                            key={tank.id}
                            className={cn(
                              "cursor-pointer transition-all duration-200 border-b border-gray-100",
                              "hover:bg-gray-50 hover:shadow-sm",
                              tank.current_level_percent <= 10 && "bg-red-50 hover:bg-red-100",
                              tank.current_level_percent <= 20 && tank.current_level_percent > 10 && "bg-orange-50 hover:bg-orange-100",
                              favourites.includes(tank.id) && "ring-2 ring-yellow-400 ring-inset"
                            )}
                            onClick={() => onTankClick?.(tank)}
                          >
                            <TableCell className="py-4">
                              <div className="flex items-center gap-2">
                                <Droplets className="h-4 w-4 text-[#008457]" />
                                <span className="font-medium text-gray-900 truncate min-w-0">{tank.location}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <Badge variant="outline" className="font-mono text-xs">
                                {tank.product_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-4 text-center">
                              <TankStatusBadge
                                level={tank.current_level_percent}
                                daysToMin={tank.days_to_min_level}
                              />
                            </TableCell>
                            <TableCell className="py-4 text-right">
                              <div className="flex flex-col items-end">
                                <span className="font-bold text-lg text-gray-900">
                                  {tank.current_level.toLocaleString()} L
                                </span>
                                <span className="text-xs text-gray-500">
                                  of {tank.safe_level.toLocaleString()} L
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="py-4 text-right">
                              <div className="flex flex-col items-end gap-2">
                                <span className="font-bold text-lg text-gray-900">
                                  {tank.current_level_percent}%
                                </span>
                                <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div 
                                    className={cn(
                                      "h-full rounded-full transition-all duration-300",
                                      tank.current_level_percent <= 29 ? "bg-red-500" :
                                      tank.current_level_percent <= 49 ? "bg-[#FEDF19]" : "bg-[#008457]"
                                    )}
                                    style={{ width: `${Math.max(tank.current_level_percent, 2)}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-4 text-right">
                              {tank.days_to_min_level !== null ? (
                                <div className="flex flex-col items-end gap-2">
                                  <span className="font-bold text-lg text-gray-900">
                                    {tank.days_to_min_level} days
                                  </span>
                                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full rounded-full bg-blue-500" 
                                      style={{ width: `${Math.min(100, (tank.days_to_min_level / 30) * 100)}%` }} 
                                    />
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-500 font-medium">N/A</span>
                              )}
                            </TableCell>
                            <TableCell className="py-4 text-right text-sm text-gray-600">
                              {tank.last_dip_date ? format(new Date(tank.last_dip_date), 'MMM d, HH:mm') : 'No data'}
                            </TableCell>
                            {userId && (
                              <TableCell className="py-4 text-center">
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); toggleFavourite(tank.id); }}
                                  className="focus:outline-none p-1 rounded hover:bg-gray-100 transition-colors"
                                >
                                  <Star
                                    className={cn(
                                      'w-5 h-5',
                                      favourites.includes(tank.id)
                                        ? 'text-yellow-400 fill-yellow-400'
                                        : 'text-gray-300 hover:text-gray-400'
                                    )}
                                  />
                                </button>
                              </TableCell>
                            )}
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
