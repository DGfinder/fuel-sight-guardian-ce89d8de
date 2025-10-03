/**
 * Dip History Data Table Component
 *
 * Responsive table for displaying dip reading history.
 * Supports desktop table view and mobile card view.
 */

import React from 'react';
import { format } from 'date-fns';
import {
  MoreHorizontal,
  SortAsc,
  SortDesc,
  BarChart3,
} from 'lucide-react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DipReading, Tank } from '@/types/fuel';

// ============================================================================
// Types
// ============================================================================

interface DipDataTableProps {
  readings: DipReading[];
  tanks: Tank[];
  isLoading: boolean;
  error: Error | null;
  sortBy: 'created_at' | 'value' | 'recorded_by';
  sortOrder: 'asc' | 'desc';
  onSort: (column: 'created_at' | 'value' | 'recorded_by') => void;
  showAllTanks: boolean;
  onRetry?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function DipDataTable({
  readings,
  tanks,
  isLoading,
  error,
  sortBy,
  sortOrder,
  onSort,
  showAllTanks,
  onRetry,
}: DipDataTableProps) {
  const getSortIcon = (column: 'created_at' | 'value' | 'recorded_by') => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />;
  };

  const getStatusBadge = (reading: DipReading) => {
    const tank = tanks.find((t) => t.id === reading.tank_id);
    if (!tank) return null;

    const isMinLevel = tank.min_level && reading.value < tank.min_level;
    const capacityPercent = tank.safe_level ? (reading.value / tank.safe_level) * 100 : 0;

    if (isMinLevel) {
      return (
        <Badge variant="destructive" className="text-xs">
          Below Min
        </Badge>
      );
    } else if (capacityPercent <= 10) {
      return (
        <Badge variant="destructive" className="text-xs">
          Critical
        </Badge>
      );
    } else if (capacityPercent <= 20) {
      return (
        <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">
          Low
        </Badge>
      );
    }
    return null;
  };

  // ============================================================================
  // Loading State
  // ============================================================================

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-0">
          <div className="space-y-4 p-6">
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                <p className="text-sm text-gray-600">Loading dip readings...</p>
              </div>
            </div>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_1fr_1fr_80px_1fr_120px_100px] gap-4 py-3 px-6 border rounded-lg bg-gray-50"
                >
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-12 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ============================================================================
  // Error State
  // ============================================================================

  if (error) {
    return (
      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <BarChart3 className="w-12 h-12 text-gray-300 mb-3" />
            <h3 className="font-medium text-gray-600 mb-2">Unable to Load Readings</h3>
            <p className="text-sm text-center mb-4">
              There was an error loading the dip readings data.
            </p>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                Try Again
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ============================================================================
  // Empty State
  // ============================================================================

  if (readings.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <BarChart3 className="w-12 h-12 text-gray-300 mb-3" />
            <h3 className="font-medium text-gray-600 mb-2">No Readings Found</h3>
            <p className="text-sm text-center px-4">
              No dip readings found for the selected criteria.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ============================================================================
  // Data Table
  // ============================================================================

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_1fr_1fr_80px_1fr_120px_100px] gap-4 py-3 px-6 bg-gray-50 border-b text-sm font-medium text-gray-700 sticky top-0 z-10">
              <button
                onClick={() => onSort('created_at')}
                className="flex items-center gap-1 text-left hover:text-gray-900"
              >
                Date
                {getSortIcon('created_at')}
              </button>
              <div>Tank</div>
              <button
                onClick={() => onSort('value')}
                className="flex items-center gap-1 text-left hover:text-gray-900"
              >
                Reading (L)
                {getSortIcon('value')}
              </button>
              <div>Capacity</div>
              <button
                onClick={() => onSort('recorded_by')}
                className="flex items-center gap-1 text-left hover:text-gray-900"
              >
                Recorded By
                {getSortIcon('recorded_by')}
              </button>
              <div>Status & Alerts</div>
              <div>Actions</div>
            </div>

            {/* Table Rows */}
            <div className="max-h-96 overflow-y-auto">
              <div className="divide-y">
                {readings.map((dip, index) => {
                  const tank = tanks.find((t) => t.id === dip.tank_id);
                  const capacityPercent = tank?.safe_level
                    ? Math.round((dip.value / tank.safe_level) * 100)
                    : 0;
                  const statusBadge = getStatusBadge(dip);

                  return (
                    <div
                      key={dip.id || index}
                      className="grid grid-cols-[1fr_1fr_1fr_80px_1fr_120px_100px] gap-4 py-3 px-6 hover:bg-gray-50 transition-colors"
                    >
                      <div className="text-sm">
                        <div className="font-medium">
                          {format(new Date(dip.created_at), 'MMM d, yyyy')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(new Date(dip.created_at), 'h:mm a')}
                        </div>
                      </div>
                      <div className="text-sm">
                        <div className="font-medium">{tank?.location || 'Unknown Tank'}</div>
                        {showAllTanks && (
                          <div className="text-xs text-gray-500">{tank?.group_name}</div>
                        )}
                      </div>
                      <div className="text-sm">
                        <div className="font-medium">{dip.value?.toLocaleString() || 'N/A'} L</div>
                      </div>
                      <div className="text-sm">
                        {tank?.safe_level && <div className="font-medium">{capacityPercent}%</div>}
                      </div>
                      <div className="text-sm">
                        <div className="font-medium">{dip.recorded_by || 'Unknown'}</div>
                      </div>
                      <div className="text-sm">
                        <div className="flex items-center gap-1">
                          {index === 0 && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                              Latest
                            </Badge>
                          )}
                          {statusBadge}
                        </div>
                      </div>
                      <div className="text-sm">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <MoreHorizontal className="w-3 h-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>Edit Reading</DropdownMenuItem>
                            <DropdownMenuItem>View Tank</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden">
            <div className="divide-y">
              {readings.map((dip, index) => {
                const tank = tanks.find((t) => t.id === dip.tank_id);
                const capacityPercent = tank?.safe_level
                  ? Math.round((dip.value / tank.safe_level) * 100)
                  : 0;
                const statusBadge = getStatusBadge(dip);

                return (
                  <div key={dip.id || index} className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-sm">
                          {format(new Date(dip.created_at), 'MMM d, yyyy')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(new Date(dip.created_at), 'h:mm a')}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {index === 0 && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                            Latest
                          </Badge>
                        )}
                        {statusBadge}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-xs text-gray-500">Tank</div>
                        <div className="font-medium">{tank?.location || 'Unknown Tank'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Reading</div>
                        <div className="font-medium">{dip.value?.toLocaleString() || 'N/A'} L</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Capacity</div>
                        <div className="font-medium">{capacityPercent}%</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Recorded By</div>
                        <div className="font-medium">{dip.recorded_by || 'Unknown'}</div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Edit Reading</DropdownMenuItem>
                          <DropdownMenuItem>View Tank</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
