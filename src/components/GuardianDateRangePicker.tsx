import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

interface DateRange {
  start: string;
  end: string;
}

interface GuardianDateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

type PresetKey = '30d' | '3mo' | '6mo' | '12mo' | 'custom';

const GuardianDateRangePicker: React.FC<GuardianDateRangePickerProps> = ({ value, onChange }) => {
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('12mo');
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const presets: Record<PresetKey, { label: string; getValue: () => DateRange }> = {
    '30d': {
      label: 'Last 30 Days',
      getValue: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);
        return {
          start: start.toISOString(),
          end: end.toISOString(),
        };
      },
    },
    '3mo': {
      label: 'Last 3 Months',
      getValue: () => {
        const end = new Date();
        const start = new Date();
        start.setMonth(start.getMonth() - 3);
        return {
          start: start.toISOString(),
          end: end.toISOString(),
        };
      },
    },
    '6mo': {
      label: 'Last 6 Months',
      getValue: () => {
        const end = new Date();
        const start = new Date();
        start.setMonth(start.getMonth() - 6);
        return {
          start: start.toISOString(),
          end: end.toISOString(),
        };
      },
    },
    '12mo': {
      label: 'Last 12 Months',
      getValue: () => {
        const end = new Date();
        const start = new Date();
        start.setMonth(start.getMonth() - 12);
        return {
          start: start.toISOString(),
          end: end.toISOString(),
        };
      },
    },
    custom: {
      label: 'Custom Range',
      getValue: () => value,
    },
  };

  const handlePresetClick = (preset: PresetKey) => {
    setSelectedPreset(preset);
    if (preset === 'custom') {
      setShowCustomPicker(true);
    } else {
      setShowCustomPicker(false);
      onChange(presets[preset].getValue());
    }
  };

  const formatDateRange = () => {
    if (!value.start || !value.end) return 'Select date range';
    try {
      const startDate = new Date(value.start);
      const endDate = new Date(value.end);
      return `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`;
    } catch {
      return 'Invalid date range';
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Preset Buttons */}
      <div className="flex gap-2">
        {Object.entries(presets).map(([key, preset]) => (
          <Button
            key={key}
            variant={selectedPreset === key ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePresetClick(key as PresetKey)}
            className={
              selectedPreset === key
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'border-gray-300 hover:bg-gray-100'
            }
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Custom Date Range Popover */}
      {showCustomPicker && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              {formatDateRange()}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <div className="p-4">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Start Date</label>
                  <Calendar
                    mode="single"
                    selected={value.start ? new Date(value.start) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        onChange({
                          ...value,
                          start: date.toISOString(),
                        });
                      }
                    }}
                    initialFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">End Date</label>
                  <Calendar
                    mode="single"
                    selected={value.end ? new Date(value.end) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        onChange({
                          ...value,
                          end: date.toISOString(),
                        });
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};

export default GuardianDateRangePicker;
