import React, { useState, useMemo, useEffect } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Card, CardContent, CardHeader, CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger
} from "@/components/ui/collapsible";
import {
  ChevronDown, ChevronRight, Droplets, AlertTriangle, Clock, Star
} from "lucide-react";
import { Tank } from "@/types/fuel";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useFavourites } from '@/hooks/useFavourites';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface FuelTableProps {
  tanks?: Tank[];
  onTankClick?: (tank: Tank) => void;
  defaultOpenGroup?: string | null;
}

function TankStatusBadge({ level, daysToEmpty }: { level: number; daysToEmpty: number }) {
  if (level <= 10) return <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">Critical</Badge>;
  if (level <= 20) return <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">Low</Badge>;
  if (daysToEmpty <= 7) return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">Low Days</Badge>;
  return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">Normal</Badge>;
}

function GroupSection({ groupName, tanks, onTankClick, defaultOpenGroup }: { 
  groupName: string; 
  tanks: Tank[]; 
  onTankClick?: (tank: Tank) => void;
  defaultOpenGroup?: string | null;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpenGroup === groupName);
  
  const criticalCount = tanks.filter(t => t.current_level_percent <= 10).length;
  const lowCount = tanks.filter(t => t.current_level_percent <= 20 && t.current_level_percent > 10).length;
  
  return (
    <Card className="mb-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors pb-3 flex items-center">
            <div className="flex items-center gap-3">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <CardTitle className="text-lg font-semibold flex items-center gap-2">{groupName}
                {criticalCount > 0 && <span className="w-3 h-3 rounded-full bg-red-500 inline-block" title="Critical" />}
                {criticalCount === 0 && lowCount > 0 && <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" title="Low" />}
              </CardTitle>
              <Badge variant="outline" className="ml-2">
                {tanks.length} tank{tanks.length !== 1 ? 's' : ''}
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
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Current Level</TableHead>
                    <TableHead className="text-right">% Full</TableHead>
                    <TableHead className="text-right">Days to Min</TableHead>
                    <TableHead className="text-right">Last Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tanks.map((tank) => (
                    <TableRow
                      key={tank.id}
                      className={cn(
                        "cursor-pointer hover:bg-muted/50 transition-colors",
                        tank.current_level_percent <= 10 && "bg-red-50 hover:bg-red-100",
                        tank.current_level_percent <= 20 && tank.current_level_percent > 10 && "bg-orange-50 hover:bg-orange-100"
                      )}
                      onClick={() => onTankClick?.(tank)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Droplets className="h-4 w-4 text-primary" />
                          <span className="font-medium">{tank.location}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {tank.product_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <TankStatusBadge
                          level={tank.current_level_percent}
                          daysToEmpty={tank.days_to_min_level ?? 0}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-lg">
                            {tank.current_level.toLocaleString()} L
                          </span>
                          <span className="text-xs text-muted-foreground">
                            of {tank.safe_level.toLocaleString()} L
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
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
                      <TableCell className="text-right">
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
                      <TableCell className="text-right text-xs text-muted-foreground">
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
}

function isUnhealthy(tank: Tank) {
  // Simple unhealthy logic: rolling_avg decreasing or erratic dips (mocked for now)
  return tank.rolling_avg !== null && tank.rolling_avg < 0;
}

function needsRefillSoon(tank: Tank) {
  return tank.days_to_min_level !== null && tank.days_to_min_level < 3;
}

export function FuelTable({ tanks = [], onTankClick, defaultOpenGroup = null }: FuelTableProps) {
  const { getFavourites, toggleFavourite } = useFavourites('');
  const favourites = [];
  const isMobile = useIsMobile();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user || null);
      setUserInfo(data.session?.userInfo || null);
    };
    getSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setUserInfo(session?.userInfo || null);
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  // Nested grouping: group -> subgroup -> tanks
  const grouped = useMemo(() => {
    const result: Record<string, Record<string, Tank[]>> = {};
    tanks.forEach(tank => {
      const group = tank.group_name || tank.tank_groups?.name || tank.group_id || 'Unknown Group';
      const subgroup = tank.subgroup || 'Other';
      if (!result[group]) result[group] = {};
      if (!result[group][subgroup]) result[group][subgroup] = [];
      result[group][subgroup].push(tank);
    });
    return result;
  }, [tanks]);

  // Sorting state
  const [sortBy, setSortBy] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Sorting logic
  const sortedTanks = useMemo(() => {
    if (!sortBy) return tanks;
    const sorted = [...tanks].sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      if (sortBy === 'current_level_percent' || sortBy === 'current_level' || sortBy === 'days_to_min_level') {
        aValue = Number(aValue);
        bValue = Number(bValue);
      } else if (sortBy === 'location' || sortBy === 'product_type') {
        aValue = String(aValue || '').toLowerCase();
        bValue = String(bValue || '').toLowerCase();
      } else if (sortBy === 'last_dip_date') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [tanks, sortBy, sortDirection]);

  // Add handleSort function
  function handleSort(column: string) {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('asc');
    }
  }

  if (!tanks?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Droplets className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Tanks Found</h3>
          <p className="text-muted-foreground text-center">
            No fuel tanks are available for your current access level.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isMobile) {
    // Mobile: Render smart cards
    return (
      <div className="space-y-3">
        {tanks.map(tank => (
          <div key={tank.id} className="rounded-lg border bg-white shadow p-3 flex flex-col">
            <div className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <Droplets className="h-5 w-5 text-primary" />
                <span className="font-semibold text-gray-900">{tank.location}</span>
                <Badge className="ml-2">{tank.current_level_percent}%</Badge>
                {user && (
                  <button
                    type="button"
                    aria-label={favourites.includes(tank.id) ? 'Unfavourite' : 'Favourite'}
                    onClick={e => { e.stopPropagation(); toggleFavourite(tank.id); }}
                    className="focus:outline-none"
                  >
                    <Star
                      className={cn(
                        'w-5 h-5',
                        favourites.includes(tank.id)
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-gray-300'
                      )}
                    />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <TankStatusBadge level={tank.current_level_percent} daysToEmpty={tank.days_to_min_level ?? 0} />
                {isUnhealthy(tank) && <Badge className="bg-red-200 text-red-800 ml-1">Unhealthy Usage</Badge>}
                {needsRefillSoon(tank) && <Badge className="bg-blue-200 text-blue-800 ml-1">🧮 Est. refill {tank.days_to_min_level}d</Badge>}
              </div>
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-gray-600">Details</summary>
              <div className="mt-2 text-xs">
                <div>Current Level: <span className="font-bold">{tank.current_level.toLocaleString()} L</span> of {tank.safe_level.toLocaleString()} L</div>
                <div>Days to Empty: <span className="font-bold">{tank.days_to_min_level ?? 'N/A'}</span></div>
                <div>Last Updated: <span className="font-bold">{tank.last_dip_date ? format(new Date(tank.last_dip_date), 'MMM d, HH:mm') : 'No data'}</span></div>
                {/* TODO: Add dip history graph, alert actions, etc. */}
              </div>
            </details>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([groupName, subgroups]) => (
        <Card className="mb-4" key={groupName}>
          <Collapsible defaultOpen={defaultOpenGroup === groupName}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors pb-3">
                <div className="flex items-center gap-3">
                  <ChevronDown className="h-4 w-4" />
                  <CardTitle className="text-lg font-semibold">{groupName}</CardTitle>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {Object.entries(subgroups).map(([subgroupName, tanks]) => (
                <Card className="mb-2 ml-4" key={subgroupName}>
                  <Collapsible defaultOpen={defaultOpenGroup === subgroupName}>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors pb-2">
                        <div className="flex items-center gap-2">
                          <ChevronRight className="h-4 w-4" />
                          <CardTitle className="text-base font-semibold">{subgroupName}</CardTitle>
                          <Badge variant="outline" className="ml-2">
                            {tanks.length} tank{tanks.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead onClick={() => handleSort('location')}>Location {sortBy === 'location' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</TableHead>
                                <TableHead onClick={() => handleSort('product_type')}>Product {sortBy === 'product_type' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</TableHead>
                                <TableHead onClick={() => handleSort('current_level_percent')}>Status {sortBy === 'current_level_percent' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</TableHead>
                                <TableHead onClick={() => handleSort('current_level')}>Current Level {sortBy === 'current_level' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</TableHead>
                                <TableHead onClick={() => handleSort('days_to_min_level')}>Days to Min {sortBy === 'days_to_min_level' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</TableHead>
                                <TableHead onClick={() => handleSort('last_dip_date')}>Last Updated {sortBy === 'last_dip_date' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</TableHead>
                                {user && <TableHead className="text-center">Favourite</TableHead>}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {tanks.map((tank) => (
                                <TableRow
                                  key={tank.id}
                                  className={cn(
                                    "cursor-pointer hover:bg-muted/50 transition-colors",
                                    tank.current_level_percent <= 10 && "bg-red-50 hover:bg-red-100",
                                    tank.current_level_percent <= 20 && tank.current_level_percent > 10 && "bg-orange-50 hover:bg-orange-100",
                                    favourites.includes(tank.id) && "ring-2 ring-yellow-400"
                                  )}
                                  onClick={() => onTankClick?.(tank)}
                                >
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Droplets className="h-4 w-4 text-primary" />
                                      <span className="font-medium">{tank.location}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="font-mono">
                                      {tank.product_type}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <TankStatusBadge
                                      level={tank.current_level_percent}
                                      daysToEmpty={tank.days_to_min_level ?? 0}
                                    />
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex flex-col items-end">
                                      <span className="font-bold text-lg">
                                        {tank.current_level.toLocaleString()} L
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        of {tank.safe_level.toLocaleString()} L
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
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
                                  <TableCell className="text-right">
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
                                  <TableCell className="text-right text-xs text-muted-foreground">
                                    {tank.last_dip_date ? format(new Date(tank.last_dip_date), 'MMM d, HH:mm') : 'No data'}
                                  </TableCell>
                                  {user && (
                                    <TableCell className="text-center">
                                      <button
                                        type="button"
                                        aria-label={favourites.includes(tank.id) ? 'Unfavourite' : 'Favourite'}
                                        onClick={e => { e.stopPropagation(); toggleFavourite(tank.id); }}
                                        className="focus:outline-none"
                                      >
                                        <Star
                                          className={cn(
                                            'w-5 h-5',
                                            favourites.includes(tank.id)
                                              ? 'text-yellow-400 fill-yellow-400'
                                              : 'text-gray-300'
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
              ))}
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}
    </div>
  );
}
