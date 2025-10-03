/**
 * Dip History Filters Bar Component
 *
 * Extracted from DipHistoryPage for better maintainability.
 * Handles all filtering logic for dip history views.
 */

import React from 'react';
import { format } from 'date-fns';
import { Search, Filter, Calendar } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Tank } from '@/types/fuel';
import { Fuel } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// ============================================================================
// Types
// ============================================================================

export interface FilterState {
  searchQuery: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  recordedBy: string;
  tankId: string;
  sortBy: 'created_at' | 'value' | 'recorded_by';
  sortOrder: 'asc' | 'desc';
  dateRange: 'all' | '7d' | '30d' | '3m' | '6m' | '1y' | 'custom';
}

export interface RecorderInfo {
  id: string;
  fullName: string;
}

interface DipFiltersBarProps {
  filters: FilterState;
  onFilterChange: (key: keyof FilterState, value: any) => void;
  tanks: Tank[];
  recorders: RecorderInfo[];
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const DATE_RANGE_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '3m', label: 'Last 3 months' },
  { value: '6m', label: 'Last 6 months' },
  { value: '1y', label: 'Last year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom range' },
];

// ============================================================================
// Component
// ============================================================================

export function DipFiltersBar({
  filters,
  onFilterChange,
  tanks,
  recorders,
  showAdvanced,
  onToggleAdvanced,
}: DipFiltersBarProps) {
  const handleDateRangeChange = (range: string) => {
    if (range === 'custom') {
      onFilterChange('dateRange', range);
      onFilterChange('dateFrom', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
      onFilterChange('dateTo', new Date());
    } else {
      onFilterChange('dateRange', range);
      onFilterChange('dateFrom', undefined);
      onFilterChange('dateTo', undefined);
    }
  };

  return (
    <>
      {/* PRIMARY FILTERS */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Fuel className="w-5 h-5 text-blue-600" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Tank Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Select Tank</label>
              <Select
                value={filters.tankId}
                onValueChange={(value) => onFilterChange('tankId', value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a tank" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tanks ({tanks.length})</SelectItem>
                  {tanks.map((tank) => (
                    <SelectItem key={tank.id} value={tank.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{tank.location}</span>
                        {tank.current_level_percent && tank.current_level_percent <= 10 && (
                          <Badge variant="destructive" className="ml-2 text-xs">
                            Critical
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Date Range</label>
              <Select value={filters.dateRange} onValueChange={handleDateRangeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Custom Date Range Pickers */}
          {filters.dateRange === 'custom' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">From Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal min-h-[40px]"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {filters.dateFrom ? format(filters.dateFrom, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-50">
                    <CalendarComponent
                      mode="single"
                      selected={filters.dateFrom}
                      onSelect={(date) => onFilterChange('dateFrom', date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">To Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal min-h-[40px]"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {filters.dateTo ? format(filters.dateTo, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-50">
                    <CalendarComponent
                      mode="single"
                      selected={filters.dateTo}
                      onSelect={(date) => onFilterChange('dateTo', date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ADVANCED FILTERS */}
      {showAdvanced && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Advanced Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Search */}
              <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                <label className="text-sm font-medium">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search notes or recorder..."
                    value={filters.searchQuery}
                    onChange={(e) => onFilterChange('searchQuery', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Recorded By Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Recorded By</label>
                <Select
                  value={filters.recordedBy}
                  onValueChange={(value) => onFilterChange('recordedBy', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All recorders" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All recorders</SelectItem>
                    {recorders.map((recorder) => (
                      <SelectItem key={recorder.id} value={recorder.fullName}>
                        {recorder.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
