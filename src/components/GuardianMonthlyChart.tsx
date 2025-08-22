import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend 
} from 'recharts';
import { CheckCircle, AlertTriangle, Eye, TrendingUp, ToggleLeft, ToggleRight, Focus } from 'lucide-react';

interface GuardianEvent {
  id: string;
  external_event_id: string;
  vehicle_registration: string;
  driver_name?: string;
  detection_time: string;
  event_type: string;
  duration_seconds?: number;
  speed_kph?: number;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  verified: boolean;
  status?: string;
  fleet: string;
  depot?: string;
  confirmation?: string;
  classification?: string;
}

export type EventTypeFilter = 'all' | 'fatigue' | 'distraction' | 'fieldOfView';

interface GuardianMonthlyChartProps {
  events: GuardianEvent[];
  selectedEventType: EventTypeFilter;
  onEventTypeChange: (eventType: EventTypeFilter) => void;
  fleet?: 'Stevemacs' | 'Great Southern Fuels';
}

type TimeRangeOption = '6M' | '12M' | '18M' | '24M';

const GuardianMonthlyChart: React.FC<GuardianMonthlyChartProps> = ({
  events,
  selectedEventType,
  onEventTypeChange,
  fleet
}) => {
  const [showVerifiedEvents, setShowVerifiedEvents] = useState(true);
  const [showVerificationRate, setShowVerificationRate] = useState(true);
  const [verifiedEventsFocusMode, setVerifiedEventsFocusMode] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('12M');

  const eventTypeFilters = [
    { 
      id: 'all' as EventTypeFilter, 
      label: 'All Events', 
      icon: TrendingUp, 
      color: 'bg-gray-100 text-gray-700 border-gray-200' 
    },
    { 
      id: 'fatigue' as EventTypeFilter, 
      label: 'Fatigue', 
      icon: AlertTriangle, 
      color: 'bg-orange-100 text-orange-700 border-orange-200' 
    },
    { 
      id: 'distraction' as EventTypeFilter, 
      label: 'Distraction', 
      icon: AlertTriangle, 
      color: 'bg-red-100 text-red-700 border-red-200' 
    },
    { 
      id: 'fieldOfView' as EventTypeFilter, 
      label: 'Field of View', 
      icon: Eye, 
      color: 'bg-blue-100 text-blue-700 border-blue-200' 
    }
  ];

  const filterEventsByType = (events: GuardianEvent[], eventType: EventTypeFilter): GuardianEvent[] => {
    switch (eventType) {
      case 'fatigue':
        return events.filter(e => 
          e.event_type.toLowerCase().includes('fatigue') || 
          e.event_type.toLowerCase().includes('microsleep')
        );
      case 'distraction':
        return events.filter(e => e.event_type.toLowerCase().includes('distraction'));
      case 'fieldOfView':
        return events.filter(e => e.event_type.toLowerCase().includes('field of view'));
      case 'all':
      default:
        return events;
    }
  };

  const monthlyData = useMemo(() => {
    const filteredEvents = filterEventsByType(events, selectedEventType);
    
    // Note: Future date filtering is now handled at import time for better data integrity
    
    // Group events by month
    const monthlyGroups: Record<string, GuardianEvent[]> = {};
    
    filteredEvents.forEach(event => {
      const date = new Date(event.detection_time);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyGroups[monthKey]) {
        monthlyGroups[monthKey] = [];
      }
      monthlyGroups[monthKey].push(event);
    });

    // Convert to chart data format
    const chartData = Object.entries(monthlyGroups)
      .map(([monthKey, monthEvents]) => {
        const verifiedEvents = monthEvents.filter(e => e.verified || e.confirmation === 'verified');
        const [year, month] = monthKey.split('-');
        const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('default', { month: 'short', year: 'numeric' });
        
        return {
          month: monthName,
          totalEvents: monthEvents.length,
          verifiedEvents: verifiedEvents.length,
          verificationRate: monthEvents.length > 0 ? (verifiedEvents.length / monthEvents.length) * 100 : 0
        };
      })
      .sort((a, b) => {
        // Parse year from month string (e.g., "Mar 2024" -> 2024)
        const aYear = parseInt(a.month.split(' ')[1]);
        const aMonth = new Date(`${a.month} 1, ${aYear}`).getMonth();
        const bYear = parseInt(b.month.split(' ')[1]);
        const bMonth = new Date(`${b.month} 1, ${bYear}`).getMonth();
        
        const aDate = new Date(aYear, aMonth);
        const bDate = new Date(bYear, bMonth);
        
        return aDate.getTime() - bDate.getTime();
      })
      .slice(-(parseInt(timeRange) || 12)); // Configurable months

    return chartData;
  }, [events, selectedEventType]);

  const headerMetrics = useMemo(() => {
    const totals = monthlyData.reduce(
      (acc, m) => {
        acc.totalEvents += m.totalEvents;
        acc.verifiedEvents += m.verifiedEvents;
        return acc;
      },
      { totalEvents: 0, verifiedEvents: 0 }
    );
    const months = monthlyData.length || 1;
    const avgPerMonth = totals.totalEvents / months;
    let monthTrend = 0;
    if (monthlyData.length >= 2) {
      const last = monthlyData[monthlyData.length - 1].totalEvents;
      const prev = monthlyData[monthlyData.length - 2].totalEvents || 0;
      monthTrend = prev > 0 ? ((last - prev) / prev) * 100 : 0;
    }
    return { ...totals, avgPerMonth, monthTrend };
  }, [monthlyData]);

  const currentTypeStats = useMemo(() => {
    const filteredEvents = filterEventsByType(events, selectedEventType);
    const verifiedEvents = filteredEvents.filter(e => e.verified || e.confirmation === 'verified');
    const verificationRate = filteredEvents.length > 0 ? (verifiedEvents.length / filteredEvents.length) * 100 : 0;
    
    return {
      total: filteredEvents.length,
      verified: verifiedEvents.length,
      verificationRate
    };
  }, [events, selectedEventType]);

  // Calculate optimal Y-axis domain based on focus mode
  const yAxisDomain = useMemo(() => {
    if (verifiedEventsFocusMode) {
      // In focus mode, scale to verified events only
      const verifiedCounts = monthlyData.map(d => d.verifiedEvents);
      const maxVerified = Math.max(...verifiedCounts);
      const minVerified = Math.min(...verifiedCounts);
      
      // Add 10% padding to the range
      const padding = Math.max(1, Math.ceil((maxVerified - minVerified) * 0.1));
      return [Math.max(0, minVerified - padding), maxVerified + padding];
    }
    
    // Normal mode - let Recharts auto-scale
    return undefined;
  }, [monthlyData, verifiedEventsFocusMode]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{`${label}`}</p>
          <div className="space-y-1 mt-2">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm text-gray-600">
                  {entry.dataKey === 'totalEvents' ? 'Total Events' : 
                   entry.dataKey === 'verifiedEvents' ? 'Verified Events' : 
                   'Verification Rate'}
                  : {entry.value}{entry.dataKey === 'verificationRate' ? '%' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Monthly Guardian Events Trend
            </CardTitle>
            <CardDescription>
              {fleet ? `${fleet} events` : 'All fleet events'} - last {timeRange} with verification rates
              {verifiedEventsFocusMode && <span className="text-blue-600 font-medium"> • Verified Events Focus Mode</span>}
            </CardDescription>
          </div>
          
          {/* KPI Strip (Total, Verified, Avg/Month, Month Trend) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full lg:w-auto">
            <div>
              <div className="text-2xl font-bold">{headerMetrics.totalEvents.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">
                Total {selectedEventType === 'all' ? 'events' : selectedEventType}
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                {headerMetrics.verifiedEvents.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">Verified</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{Math.round(headerMetrics.avgPerMonth).toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Avg/Month</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${headerMetrics.monthTrend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {headerMetrics.monthTrend.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">Month Trend</div>
            </div>
          </div>
        </div>

        {/* Event Type Filter Buttons */}
        <div className="flex flex-wrap gap-2 pt-4 border-t">
          {eventTypeFilters.map((filter) => {
            const IconComponent = filter.icon;
            return (
              <Button
                key={filter.id}
                variant={selectedEventType === filter.id ? "default" : "outline"}
                size="sm"
                onClick={() => onEventTypeChange(filter.id)}
                className={selectedEventType === filter.id ? 
                  filter.color.replace('bg-', 'bg-').replace('text-', 'text-').replace('border-', 'border-') : 
                  'border-gray-200 hover:' + filter.color
                }
              >
                <IconComponent className="w-4 h-4 mr-2" />
                {filter.label}
              </Button>
            );
          })}
        </div>
        
        {/* Verification Toggle Buttons */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowVerifiedEvents(!showVerifiedEvents)}
            className={`border-green-200 ${showVerifiedEvents ? 'bg-green-100 text-green-700' : 'hover:bg-green-50'}`}
            disabled={verifiedEventsFocusMode}
          >
            {showVerifiedEvents ? <ToggleRight className="w-4 h-4 mr-2" /> : <ToggleLeft className="w-4 h-4 mr-2" />}
            Verified Events
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowVerificationRate(!showVerificationRate)}
            className={`border-purple-200 ${showVerificationRate ? 'bg-purple-100 text-purple-700' : 'hover:bg-purple-50'}`}
          >
            {showVerificationRate ? <ToggleRight className="w-4 h-4 mr-2" /> : <ToggleLeft className="w-4 h-4 mr-2" />}
            Verification Rate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVerifiedEventsFocusMode(!verifiedEventsFocusMode)}
            className={`border-blue-200 ${verifiedEventsFocusMode ? 'bg-blue-100 text-blue-700' : 'hover:bg-blue-50'}`}
            title={verifiedEventsFocusMode ? 'Exit focus mode to show total events' : 'Focus on verified events only with optimized scaling'}
          >
            <Focus className="w-4 h-4 mr-2" />
            {verifiedEventsFocusMode ? 'Exit Focus Mode' : 'Verified Focus Mode'}
          </Button>
        </div>
        
        {/* Time Range Selection */}
        <div className="flex flex-wrap gap-2 pt-2">
          <span className="text-sm text-gray-600 self-center mr-2">Time Range:</span>
          {(['6M', '12M', '18M', '24M'] as TimeRangeOption[]).map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange(range)}
              className={timeRange === range ? 'bg-blue-100 text-blue-700 border-blue-200' : 'border-gray-200 hover:bg-blue-50'}
            >
              {range}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {monthlyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
              <XAxis 
                dataKey="month" 
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                yAxisId="events"
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={yAxisDomain}
              />
              {showVerificationRate && (
                <YAxis 
                  yAxisId="rate"
                  orientation="right"
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
              )}
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              
              {/* Total Events Line - Hidden in focus mode */}
              {!verifiedEventsFocusMode && (
                <Line
                  yAxisId="events"
                  type="monotone"
                  dataKey="totalEvents"
                  name="Total Events"
                  stroke={
                    selectedEventType === 'distraction' ? '#ef4444' :
                    selectedEventType === 'fatigue' ? '#f97316' :
                    selectedEventType === 'fieldOfView' ? '#3b82f6' :
                    '#6b7280'
                  }
                  strokeWidth={3}
                  dot={{ 
                    fill: selectedEventType === 'distraction' ? '#ef4444' :
                          selectedEventType === 'fatigue' ? '#f97316' :
                          selectedEventType === 'fieldOfView' ? '#3b82f6' :
                          '#6b7280',
                    strokeWidth: 2, 
                    r: 5 
                  }}
                  activeDot={{ r: 7 }}
                />
              )}
              
              {/* Verified Events Line - Always shown in focus mode */}
              {(showVerifiedEvents || verifiedEventsFocusMode) && (
                <Line
                  yAxisId="events"
                  type="monotone"
                  dataKey="verifiedEvents"
                  name="Verified Events"
                  stroke="#10b981"
                  strokeWidth={verifiedEventsFocusMode ? 4 : 3}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: verifiedEventsFocusMode ? 6 : 5 }}
                  activeDot={{ r: verifiedEventsFocusMode ? 8 : 7 }}
                  strokeDasharray="0"
                />
              )}
              
              {/* Verification Rate Line */}
              {showVerificationRate && (
                <Line
                  yAxisId="rate"
                  type="monotone"
                  dataKey="verificationRate"
                  name="Verification Rate %"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                  strokeDasharray="5 5"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-60 text-gray-500">
            <div className="text-center">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No Data Available</p>
              <p className="text-sm">No {selectedEventType === 'all' ? '' : selectedEventType + ' '}events found for the selected period</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GuardianMonthlyChart;