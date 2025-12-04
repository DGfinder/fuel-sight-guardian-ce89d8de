import React, { useState, useMemo, useCallback } from 'react';
import { CalendarDays, X, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CompactDateFilterProps {
  startDate: Date | null;
  endDate: Date | null;
  onDateChange: (startDate: Date | null, endDate: Date | null) => void;
  availableRange: {
    min: Date;
    max: Date;
  };
  totalRecords?: number;
  filteredRecords?: number;
  className?: string;
}

interface DatePreset {
  label: string;
  getValue: (availableRange: { min: Date; max: Date }) => { startDate: Date | null; endDate: Date | null };
}

const CompactDateFilter: React.FC<CompactDateFilterProps> = ({
  startDate,
  endDate,
  onDateChange,
  availableRange,
  totalRecords,
  filteredRecords,
  className
}) => {
  const [isStartCalendarOpen, setIsStartCalendarOpen] = useState(false);
  const [isEndCalendarOpen, setIsEndCalendarOpen] = useState(false);
  const [showPresets, setShowPresets] = useState(false);

  // Compact presets for quick selection
  const presets: DatePreset[] = useMemo(() => [
    {
      label: 'Last 30 Days',
      getValue: (range) => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);
        return { 
          startDate: start < range.min ? range.min : start, 
          endDate: end > range.max ? range.max : end 
        };
      }
    },
    {
      label: 'Last 3 Months',
      getValue: (range) => {
        const end = new Date();
        const start = new Date();
        start.setMonth(start.getMonth() - 3);
        return { 
          startDate: start < range.min ? range.min : start, 
          endDate: end > range.max ? range.max : end 
        };
      }
    },
    {
      label: 'Last 6 Months',
      getValue: (range) => {
        const end = new Date();
        const start = new Date();
        start.setMonth(start.getMonth() - 6);
        return { 
          startDate: start < range.min ? range.min : start, 
          endDate: end > range.max ? range.max : end 
        };
      }
    },
    {
      label: 'Peak Period',
      getValue: (range) => {
        const currentYear = new Date().getFullYear();
        const start = new Date(currentYear, 9, 1); // October 1st
        const end = new Date(currentYear, 11, 31); // December 31st
        
        const adjustedStart = start < range.min ? range.min : start;
        const adjustedEnd = end > range.max ? range.max : end;
        
        return { startDate: adjustedStart, endDate: adjustedEnd };
      }
    },
    {
      label: 'This Year',
      getValue: (range) => {
        const end = new Date();
        const start = new Date(end.getFullYear(), 0, 1);
        return { 
          startDate: start < range.min ? range.min : start, 
          endDate: end > range.max ? range.max : end 
        };
      }
    },
    {
      label: 'All Data',
      getValue: (range) => ({ startDate: range.min, endDate: range.max })
    }
  ], []);

  const handlePresetClick = useCallback((preset: DatePreset) => {
    const { startDate: newStart, endDate: newEnd } = preset.getValue(availableRange);
    onDateChange(newStart, newEnd);
    setShowPresets(false);
  }, [availableRange, onDateChange]);

  const handleClearFilter = useCallback(() => {
    onDateChange(null, null);
  }, [onDateChange]);

  const handleStartDateSelect = useCallback((date: Date | undefined) => {
    if (date) {
      if (endDate && date > endDate) {
        onDateChange(date, date);
      } else {
        onDateChange(date, endDate);
      }
    }
    setIsStartCalendarOpen(false);
  }, [endDate, onDateChange]);

  const handleEndDateSelect = useCallback((date: Date | undefined) => {
    if (date) {
      if (startDate && date < startDate) {
        onDateChange(date, date);
      } else {
        onDateChange(startDate, date);
      }
    }
    setIsEndCalendarOpen(false);
  }, [startDate, onDateChange]);

  const isFiltered = useMemo(() => Boolean(startDate || endDate), [startDate, endDate]);
  const hasValidRange = useMemo(() => Boolean(startDate && endDate), [startDate, endDate]);

  const formatDateRange = useMemo(() => {
    if (hasValidRange) {
      return `${format(startDate!, "MMM dd")} - ${format(endDate!, "MMM dd, yyyy")}`;
    } else if (startDate) {
      return `From ${format(startDate, "MMM dd, yyyy")}`;
    } else if (endDate) {
      return `Until ${format(endDate, "MMM dd, yyyy")}`;
    }
    return 'All dates';
  }, [startDate, endDate, hasValidRange]);

  return (
    <div className={cn("flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 sm:p-2 bg-white border rounded-lg shadow-sm", className)}>
      {/* Date Range Display/Button */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
        <span className="text-sm font-medium text-gray-700 truncate">
          {formatDateRange}
        </span>
        {isFiltered && (
          <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 border-blue-200 flex-shrink-0">
            Filtered
          </Badge>
        )}
      </div>

      {/* Date Picker Controls */}
      <div className="flex items-center gap-1 flex-wrap sm:flex-nowrap">
        {/* Start Date Picker */}
        <Popover open={isStartCalendarOpen} onOpenChange={setIsStartCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs whitespace-nowrap">
              Start: {startDate ? format(startDate, "MMM dd") : "Any"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <CalendarComponent
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

        {/* End Date Picker */}
        <Popover open={isEndCalendarOpen} onOpenChange={setIsEndCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs whitespace-nowrap">
              End: {endDate ? format(endDate, "MMM dd") : "Any"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <CalendarComponent
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

        {/* Quick Presets */}
        <Popover open={showPresets} onOpenChange={setShowPresets}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs whitespace-nowrap">
              <CalendarDays className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">Quick</span>
              <span className="sm:hidden">Presets</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2" align="end">
            <div className="space-y-1">
              <div className="text-xs font-medium text-gray-500 mb-2">Quick Ranges</div>
              <div className="grid grid-cols-1 gap-1">
                {presets.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePresetClick(preset)}
                    className="w-full justify-start text-xs h-8 px-2"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Clear Filter */}
        {isFiltered && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearFilter}
            className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 whitespace-nowrap"
            title="Clear filter"
          >
            <X className="w-3 h-3 sm:mr-1" />
            <span className="hidden sm:inline">Clear</span>
          </Button>
        )}
      </div>

      {/* Record Count */}
      {totalRecords && filteredRecords !== undefined && (
        <div className="text-xs text-gray-500 border-t sm:border-t-0 sm:border-l pt-2 sm:pt-0 sm:pl-2 w-full sm:w-auto text-center sm:text-left">
          <span className="font-medium text-blue-600">
            {filteredRecords.toLocaleString()}
          </span>
          <span className="text-gray-400"> / </span>
          <span className="text-gray-500">
            {totalRecords.toLocaleString()}
          </span>
          <span className="ml-1 text-gray-400">records</span>
        </div>
      )}
    </div>
  );
};

export default CompactDateFilter;