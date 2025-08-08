import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend 
} from 'recharts';
import { CheckCircle, AlertTriangle, Eye, TrendingUp } from 'lucide-react';

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

const GuardianMonthlyChart: React.FC<GuardianMonthlyChartProps> = ({
  events,
  selectedEventType,
  onEventTypeChange,
  fleet
}) => {

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
        const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('default', { month: 'short', year: '2-digit' });
        
        return {
          month: monthName,
          totalEvents: monthEvents.length,
          verifiedEvents: verifiedEvents.length,
          verificationRate: monthEvents.length > 0 ? (verifiedEvents.length / monthEvents.length) * 100 : 0
        };
      })
      .sort((a, b) => new Date(`${a.month} 01, 20${a.month.slice(-2)}`).getTime() - new Date(`${b.month} 01, 20${b.month.slice(-2)}`).getTime())
      .slice(-6); // Last 6 months

    return chartData;
  }, [events, selectedEventType]);

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
              {fleet ? `${fleet} events` : 'All fleet events'} - last 6 months with verification rates
            </CardDescription>
          </div>
          
          {/* Event Type Stats */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="font-medium">{currentTypeStats.verified} verified</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                <span className="font-medium">{currentTypeStats.total} total</span>
              </div>
              <Badge variant="outline" className="text-blue-700 border-blue-200 bg-blue-50">
                {currentTypeStats.verificationRate.toFixed(1)}% rate
              </Badge>
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
      </CardHeader>

      <CardContent>
        {monthlyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={monthlyData}>
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
              />
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
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              
              {/* Total Events Bar */}
              <Bar 
                yAxisId="events"
                dataKey="totalEvents" 
                name="Total Events"
                fill={
                  selectedEventType === 'distraction' ? '#ef4444' :
                  selectedEventType === 'fatigue' ? '#f97316' :
                  selectedEventType === 'fieldOfView' ? '#3b82f6' :
                  '#6b7280'
                }
                fillOpacity={0.6}
                radius={[2, 2, 0, 0]}
              />
              
              {/* Verified Events Bar */}
              <Bar 
                yAxisId="events"
                dataKey="verifiedEvents" 
                name="Verified Events"
                fill="#10b981"
                fillOpacity={0.8}
                radius={[2, 2, 0, 0]}
              />
              
              {/* Verification Rate Line */}
              <Line
                yAxisId="rate"
                type="monotone"
                dataKey="verificationRate"
                name="Verification Rate %"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
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