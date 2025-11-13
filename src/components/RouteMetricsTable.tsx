import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowUpDown, Search } from 'lucide-react';
import type { RoutePattern } from '@/api/routePatterns';

interface RouteMetricsTableProps {
  routes: RoutePattern[];
  isLoading?: boolean;
}

type SortField = 'route' | 'tripCount' | 'avgTime' | 'avgDistance' | 'efficiency';
type SortDirection = 'asc' | 'desc';

export default function RouteMetricsTable({ routes, isLoading }: RouteMetricsTableProps) {
  const [sortField, setSortField] = useState<SortField>('tripCount');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchTerm, setSearchTerm] = useState('');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredAndSortedRoutes = useMemo(() => {
    let filtered = routes;

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = routes.filter(route =>
        route.start_location.toLowerCase().includes(search) ||
        route.end_location.toLowerCase().includes(search)
      );
    }

    // Sort
    return [...filtered].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortField) {
        case 'route':
          aVal = `${a.start_location} → ${a.end_location}`;
          bVal = `${b.start_location} → ${b.end_location}`;
          break;
        case 'tripCount':
          aVal = a.trip_count;
          bVal = b.trip_count;
          break;
        case 'avgTime':
          aVal = a.average_travel_time_hours;
          bVal = b.average_travel_time_hours;
          break;
        case 'avgDistance':
          aVal = a.average_distance_km;
          bVal = b.average_distance_km;
          break;
        case 'efficiency':
          aVal = a.efficiency_rating;
          bVal = b.efficiency_rating;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [routes, sortField, sortDirection, searchTerm]);

  const getEfficiencyBadge = (efficiency: number) => {
    if (efficiency >= 90) {
      return <Badge variant="default" className="bg-green-600">Excellent</Badge>;
    } else if (efficiency >= 80) {
      return <Badge variant="default">Good</Badge>;
    } else if (efficiency >= 70) {
      return <Badge variant="secondary">Fair</Badge>;
    } else {
      return <Badge variant="outline">Needs Review</Badge>;
    }
  };

  const formatDuration = (hours: number): string => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} min`;
    } else if (hours < 24) {
      const h = Math.floor(hours);
      const m = Math.round((hours - h) * 60);
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    } else {
      const days = Math.floor(hours / 24);
      const h = Math.round(hours % 24);
      return `${days}d ${h}h`;
    }
  };

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleSort(field)}
      className="h-8 -ml-3"
    >
      {label}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Route Patterns from Database</CardTitle>
            <CardDescription>
              {filteredAndSortedRoutes.length} {filteredAndSortedRoutes.length === 1 ? 'route' : 'routes'}
              {searchTerm && ` matching "${searchTerm}"`}
            </CardDescription>
          </div>
          <div className="w-64">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search routes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortButton field="route" label="Route" />
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="tripCount" label="Trips" />
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="avgTime" label="Avg Time" />
                </TableHead>
                <TableHead className="text-right">Time Range</TableHead>
                <TableHead className="text-right">
                  <SortButton field="avgDistance" label="Avg Distance" />
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="efficiency" label="Efficiency" />
                </TableHead>
                <TableHead className="text-right">Time Variability</TableHead>
                <TableHead>Common Vehicles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Loading route patterns...
                  </TableCell>
                </TableRow>
              ) : filteredAndSortedRoutes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    {searchTerm ? 'No routes match your search' : 'No route patterns found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedRoutes.map((route, index) => (
                  <TableRow key={route.id || index}>
                    <TableCell className="font-medium">
                      <div className="space-y-1">
                        <div>{route.start_location} → {route.end_location}</div>
                        {route.start_area && route.end_area && (
                          <div className="text-xs text-muted-foreground">
                            {route.start_area} → {route.end_area}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{route.trip_count}</TableCell>
                    <TableCell className="text-right">
                      {formatDuration(route.average_travel_time_hours)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatDuration(route.best_time_hours)} - {formatDuration(route.worst_time_hours)}
                    </TableCell>
                    <TableCell className="text-right">
                      {route.average_distance_km.toFixed(1)} km
                    </TableCell>
                    <TableCell className="text-right">
                      {getEfficiencyBadge(route.efficiency_rating)}
                      <div className="text-xs text-muted-foreground mt-1">
                        {route.efficiency_rating.toFixed(0)}%
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-sm">
                        {route.time_variability.toFixed(2)}h
                      </div>
                      <div className="text-xs text-muted-foreground">
                        σ = {((route.time_variability / route.average_travel_time_hours) * 100).toFixed(0)}%
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {route.most_common_vehicles.slice(0, 2).join(', ') || 'N/A'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {filteredAndSortedRoutes.length > 0 && (
          <div className="mt-4 text-xs text-muted-foreground space-y-1">
            <p>
              <strong>Efficiency Rating:</strong> Calculated based on actual vs optimal route distance and time.
              Higher is better (90%+ is excellent).
            </p>
            <p>
              <strong>Time Variability:</strong> Standard deviation of travel times. Lower indicates more consistent route times.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
