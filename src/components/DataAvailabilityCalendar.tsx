import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Upload,
  Database,
  FileText,
  Clock,
  Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  getFormattedCalendarData, 
  CalendarDay, 
  getDataAvailabilityCalendar,
  DataAvailabilityCalendar as DataAvailabilityItem
} from '@/api/dataFreshness';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths } from 'date-fns';

interface DataAvailabilityCalendarProps {
  sourceKey?: string; // If provided, shows data for specific source, otherwise shows all sources
  className?: string;
}

const DataAvailabilityCalendar: React.FC<DataAvailabilityCalendarProps> = ({
  sourceKey,
  className = ''
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([]);
  const [recentUploads, setRecentUploads] = useState<DataAvailabilityItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load calendar data when month or source changes
  useEffect(() => {
    loadCalendarData();
  }, [currentDate, sourceKey]);

  const loadCalendarData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;

      // Get formatted calendar data
      const { data: formattedData, error: calendarError } = await getFormattedCalendarData(year, month);
      
      if (calendarError) {
        throw new Error('Failed to load calendar data');
      }

      setCalendarData(formattedData || []);

      // Get recent uploads for the sidebar
      const startDate = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentDate), 'yyyy-MM-dd');

      const { data: uploadsData, error: uploadsError } = await getDataAvailabilityCalendar(
        startDate,
        endDate,
        sourceKey
      );

      if (uploadsError) {
        console.warn('Failed to load recent uploads:', uploadsError);
      }

      setRecentUploads(uploadsData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => 
      direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)
    );
    setSelectedDate(null);
  };

  const getDaysInMonth = () => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  };

  const getCalendarDayData = (date: Date): CalendarDay | null => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return calendarData.find(d => d.date === dateStr) || null;
  };

  const getDayDisplayInfo = (date: Date) => {
    const dayData = getCalendarDayData(date);
    const isSelected = selectedDate && isSameDay(date, selectedDate);
    const isCurrentMonth = isSameMonth(date, currentDate);
    
    if (!dayData || !dayData.has_data) {
      return {
        className: `text-gray-400 ${isSelected ? 'bg-gray-200' : ''} ${!isCurrentMonth ? 'opacity-50' : ''}`,
        content: format(date, 'd'),
        hasData: false,
        uploadCount: 0
      };
    }

    const intensity = Math.min(dayData.total_uploads, 5);
    const intensityClass = [
      'bg-blue-100 text-blue-800',
      'bg-blue-200 text-blue-800', 
      'bg-blue-300 text-blue-900',
      'bg-blue-400 text-white',
      'bg-blue-500 text-white',
      'bg-blue-600 text-white'
    ][intensity] || 'bg-blue-600 text-white';

    return {
      className: `${intensityClass} font-medium ${isSelected ? 'ring-2 ring-blue-500' : ''} ${!isCurrentMonth ? 'opacity-50' : ''}`,
      content: format(date, 'd'),
      hasData: true,
      uploadCount: dayData.total_uploads,
      sources: dayData.sources
    };
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  const selectedDayData = selectedDate ? getCalendarDayData(selectedDate) : null;

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 42 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-10" />
          ))}
        </div>
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <CalendarIcon className="w-5 h-5" />
          {format(currentDate, 'MMMM yyyy')}
        </h3>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setCurrentDate(new Date())}
          >
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigateMonth('next')}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-4">
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-sm font-medium text-gray-500 p-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-1">
                {getDaysInMonth().map(date => {
                  const dayInfo = getDayDisplayInfo(date);
                  return (
                    <TooltipProvider key={date.toISOString()}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className={`
                              h-10 w-10 rounded-md text-sm transition-all duration-200 
                              hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500
                              ${dayInfo.className}
                            `}
                            onClick={() => handleDateClick(date)}
                          >
                            {dayInfo.content}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-sm">
                            <p className="font-medium">{format(date, 'PPP')}</p>
                            {dayInfo.hasData ? (
                              <>
                                <p>{dayInfo.uploadCount} upload(s)</p>
                                {dayInfo.sources && (
                                  <div className="mt-1">
                                    {dayInfo.sources.map(source => (
                                      <p key={source.source_key} className="text-xs">
                                        {source.display_name}: {source.record_count} records
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : (
                              <p>No data available</p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                <span>Data availability intensity</span>
                <div className="flex items-center gap-1">
                  <span>Less</span>
                  {[1, 2, 3, 4, 5].map(level => (
                    <div
                      key={level}
                      className={`w-3 h-3 rounded ${
                        ['bg-blue-100', 'bg-blue-200', 'bg-blue-300', 'bg-blue-400', 'bg-blue-500'][level - 1]
                      }`}
                    />
                  ))}
                  <span>More</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar with Details */}
        <div className="space-y-4">
          {/* Selected Date Details */}
          {selectedDate && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {format(selectedDate, 'PPP')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDayData && selectedDayData.has_data ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Total Uploads:</span>
                      <Badge variant="secondary">{selectedDayData.total_uploads}</Badge>
                    </div>
                    
                    {selectedDayData.sources.map(source => (
                      <div key={source.source_key} className="border-l-2 border-blue-200 pl-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{source.display_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {source.record_count} records
                          </Badge>
                        </div>
                        {source.latest_upload_filename && (
                          <p className="text-xs text-gray-500 mt-1">
                            File: {source.latest_upload_filename}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-4">
                    <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No data uploaded on this date</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentUploads.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {recentUploads.slice(0, 10).map(upload => (
                    <div key={`${upload.source_key}-${upload.data_date}`} className="text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{upload.display_name}</span>
                        <Badge variant="outline" className="text-xs">
                          {format(new Date(upload.data_date), 'MMM d')}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Upload className="w-3 h-3" />
                        <span>{upload.record_count} records</span>
                        {upload.upload_count > 1 && (
                          <span>({upload.upload_count} uploads)</span>
                        )}
                      </div>
                      {upload.latest_upload_filename && (
                        <p className="text-xs text-gray-400 truncate">
                          {upload.latest_upload_filename}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-4">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No recent uploads</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DataAvailabilityCalendar;