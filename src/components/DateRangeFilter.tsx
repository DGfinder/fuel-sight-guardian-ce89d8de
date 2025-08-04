import React, { useState, useMemo, useCallback } from 'react';
import { CalendarDays, X } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
}

interface DateRangeFilterProps {
  startDate: Date | null;
  endDate: Date | null;
  onDateChange: (startDate: Date | null, endDate: Date | null) => void;
  availableRange: {
    min: Date;
    max: Date;
  };
  className?: string;
  totalRecords?: number;
  filteredRecords?: number;
}

interface DatePreset {
  label: string;
  getValue: (availableRange: { min: Date; max: Date }) => DateRange;
  description: string;
  category: 'relative' | 'absolute';
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  startDate,
  endDate,
  onDateChange,
  availableRange,
  className,
  totalRecords,
  filteredRecords
}) => {
  const [isStartCalendarOpen, setIsStartCalendarOpen] = useState(false);
  const [isEndCalendarOpen, setIsEndCalendarOpen] = useState(false);

  // Memoized date presets for optimal performance
  const presets: DatePreset[] = useMemo(() => [
    {
      label: 'Last 30 Days',
      description: 'Previous 30 days from today',
      category: 'relative',
      getValue: (availableRange) => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);
        return { 
          startDate: start < availableRange.min ? availableRange.min : start, 
          endDate: end > availableRange.max ? availableRange.max : end 
        };
      }
    },
    {
      label: 'Last 3 Months',
      description: 'Previous 3 months from today',
      category: 'relative',
      getValue: (availableRange) => {
        const end = new Date();
        const start = new Date();
        start.setMonth(start.getMonth() - 3);
        return { 
          startDate: start < availableRange.min ? availableRange.min : start, 
          endDate: end > availableRange.max ? availableRange.max : end 
        };
      }
    },
    {
      label: 'Last 6 Months',
      description: 'Previous 6 months from today',
      category: 'relative',
      getValue: (availableRange) => {
        const end = new Date();
        const start = new Date();
        start.setMonth(start.getMonth() - 6);
        return { 
          startDate: start < availableRange.min ? availableRange.min : start, 
          endDate: end > availableRange.max ? availableRange.max : end 
        };
      }
    },
    {
      label: 'Peak Period',
      description: 'High-volume delivery period (Oct-Dec)',
      category: 'absolute',
      getValue: (availableRange) => {
        const currentYear = new Date().getFullYear();
        const start = new Date(currentYear, 9, 1); // October 1st
        const end = new Date(currentYear, 11, 31); // December 31st
        
        // Adjust if peak period is outside available range
        const adjustedStart = start < availableRange.min ? availableRange.min : start;
        const adjustedEnd = end > availableRange.max ? availableRange.max : end;
        
        return { startDate: adjustedStart, endDate: adjustedEnd };
      }
    },
    {
      label: 'This Year',
      description: 'January to current date',
      category: 'absolute',
      getValue: (availableRange) => {
        const end = new Date();
        const start = new Date(end.getFullYear(), 0, 1);
        return { 
          startDate: start < availableRange.min ? availableRange.min : start, 
          endDate: end > availableRange.max ? availableRange.max : end 
        };
      }
    },
    {
      label: 'Previous Year',
      description: 'Complete previous year',
      category: 'absolute',
      getValue: (availableRange) => {
        const currentYear = new Date().getFullYear();
        const start = new Date(currentYear - 1, 0, 1);
        const end = new Date(currentYear - 1, 11, 31);
        return { 
          startDate: start < availableRange.min ? availableRange.min : start, 
          endDate: end > availableRange.max ? availableRange.max : end 
        };
      }
    },
    {
      label: 'All Data',
      description: 'Complete available dataset',
      category: 'absolute',
      getValue: (availableRange) => {
        return { 
          startDate: availableRange.min, 
          endDate: availableRange.max 
        };
      }
    }
  ], []);

  // Memoized preset click handler for better performance
  const handlePresetClick = useCallback((preset: DatePreset) => {
    const { startDate: newStart, endDate: newEnd } = preset.getValue(availableRange);
    onDateChange(newStart, newEnd);
  }, [availableRange, onDateChange]);

  // Memoized clear filter handler
  const handleClearFilter = useCallback(() => {
    onDateChange(null, null);
  }, [onDateChange]);

  // Optimized start date selection with validation
  const handleStartDateSelect = useCallback((date: Date | undefined) => {
    if (date) {
      // Ensure start date is not after end date
      if (endDate && date > endDate) {
        onDateChange(date, date);
      } else {
        onDateChange(date, endDate);
      }
    }
    setIsStartCalendarOpen(false);
  }, [endDate, onDateChange]);

  // Optimized end date selection with validation
  const handleEndDateSelect = useCallback((date: Date | undefined) => {
    if (date) {
      // Ensure end date is not before start date
      if (startDate && date < startDate) {
        onDateChange(date, date);
      } else {
        onDateChange(startDate, date);
      }
    }
    setIsEndCalendarOpen(false);
  }, [startDate, onDateChange]);

  // Memoized computed values for better performance
  const isFiltered = useMemo(() => Boolean(startDate || endDate), [startDate, endDate]);
  const hasValidRange = useMemo(() => Boolean(startDate && endDate), [startDate, endDate]);
  
  // Performance optimization: group presets by category
  const relativePresets = useMemo(() => presets.filter(p => p.category === 'relative'), [presets]);
  const absolutePresets = useMemo(() => presets.filter(p => p.category === 'absolute'), [presets]);

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="w-5 h-5 text-blue-600" />
              Date Range Filter
            </CardTitle>
            <CardDescription>
              Filter data by selecting a custom date range or using quick presets
            </CardDescription>
          </div>
          {isFiltered && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilter}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X className="w-4 h-4 mr-1" />
              Clear Filter
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Date Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Start Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Start Date
            </label>
            <Popover open={isStartCalendarOpen} onOpenChange={setIsStartCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "MMM dd, yyyy") : "Select start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate || undefined}
                  onSelect={handleStartDateSelect}
                  disabled={(date) => 
                    date < availableRange.min || 
                    date > availableRange.max ||
                    (endDate ? date > endDate : false)
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              End Date
            </label>
            <Popover open={isEndCalendarOpen} onOpenChange={setIsEndCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "MMM dd, yyyy") : "Select end date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate || undefined}
                  onSelect={handleEndDateSelect}
                  disabled={(date) => 
                    date < availableRange.min || 
                    date > availableRange.max ||
                    (startDate ? date < startDate : false)
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Quick Presets - Organized by Category */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Quick Presets
          </h4>
          
          {/* Relative Date Presets */}
          <div className="space-y-2">
            <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Relative Periods
            </h5>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {relativePresets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  onClick={() => handlePresetClick(preset)}
                  className="text-xs hover:bg-blue-50 hover:border-blue-200"
                  title={preset.description}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
          
          {/* Absolute Date Presets */}
          <div className="space-y-2">
            <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Specific Periods
            </h5>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {absolutePresets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  onClick={() => handlePresetClick(preset)}
                  className="text-xs hover:bg-green-50 hover:border-green-200"
                  title={preset.description}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Filter Status */}
        {isFiltered && (
          <div className="flex items-center justify-between p-3 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                Filtered
              </Badge>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {hasValidRange 
                  ? `${format(startDate!, "MMM dd, yyyy")} - ${format(endDate!, "MMM dd, yyyy")}`
                  : startDate 
                    ? `From ${format(startDate, "MMM dd, yyyy")}`
                    : `Until ${format(endDate!, "MMM dd, yyyy")}`
                }
              </span>
            </div>
            {totalRecords && filteredRecords !== undefined && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-blue-600">
                  {filteredRecords.toLocaleString()}
                </span>
                {' of '}
                <span className="text-gray-500">
                  {totalRecords.toLocaleString()}
                </span>
                {' records'}
              </div>
            )}
          </div>
        )}

        {/* Available Date Range Info */}
        <div className="text-xs text-gray-500 text-center">
          Available data: {format(availableRange.min, "MMM yyyy")} - {format(availableRange.max, "MMM yyyy")}
        </div>
      </CardContent>
    </Card>
  );
};

export default DateRangeFilter;