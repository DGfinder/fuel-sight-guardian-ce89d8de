import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ChevronDown, ChevronUp, Eye, MessageSquare, Send, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import GuardianCorrelationBadge from './GuardianCorrelationBadge';
import { guardianAnalytics, CriticalFatigueEvent, FatigueTrend } from '@/services/guardianAnalyticsService';

interface GuardianCriticalFatigueAlertsProps {
  fleet?: 'Stevemacs' | 'Great Southern Fuels';
}

const GuardianCriticalFatigueAlerts: React.FC<GuardianCriticalFatigueAlertsProps> = ({ fleet }) => {
  const [events, setEvents] = useState<CriticalFatigueEvent[]>([]);
  const [trend, setTrend] = useState<FatigueTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchFatigueEvents();
    fetchTrend();

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchFatigueEvents();
      fetchTrend();
    }, 30000);

    return () => clearInterval(interval);
  }, [fleet]);

  const fetchFatigueEvents = async () => {
    try {
      setLoading(true);
      const data = await guardianAnalytics.getCriticalFatigueEvents(fleet, 168); // 7 days
      setEvents(data);
    } catch (error) {
      console.error('Error fetching fatigue events:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrend = async () => {
    try {
      const trendData = await guardianAnalytics.getFatigueTrend(fleet);
      setTrend(trendData);
    } catch (error) {
      console.error('Error fetching fatigue trend:', error);
    }
  };

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const events24h = events.filter(e => new Date(e.detection_time) >= twentyFourHoursAgo);
  const eventsOlder = events.filter(e => new Date(e.detection_time) < twentyFourHoursAgo);

  if (events.length === 0 && !loading) {
    return (
      <Card className="border-green-200 bg-green-50/30 dark:bg-green-950/20 mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <AlertTriangle className="w-5 h-5" />
            Critical Fatigue Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-lg font-medium text-green-700 dark:text-green-400">
              ✓ No Critical Fatigue Events
            </div>
            <p className="text-sm text-green-600 dark:text-green-500 mt-1">
              No fatigue or microsleep events in the last 7 days
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatEventTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday =
      date.toDateString() === new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString();

    if (isToday) {
      return `Today ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    } else if (isYesterday) {
      return `Yesterday ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    }
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.changeDirection === 'up') return <TrendingUp className="w-4 h-4 text-red-600" />;
    if (trend.changeDirection === 'down') return <TrendingDown className="w-4 h-4 text-green-600" />;
    return <Minus className="w-4 h-4 text-gray-600" />;
  };

  const getTrendColor = () => {
    if (!trend) return 'text-gray-600';
    if (trend.changeDirection === 'up') return 'text-red-600';
    if (trend.changeDirection === 'down') return 'text-green-600';
    return 'text-gray-600';
  };

  const renderEvent = (event: CriticalFatigueEvent) => {
    const isMicrosleep = event.event_type.toLowerCase().includes('microsleep');
    const driverDisplay = event.driver_name || event.primary_driver_name || 'Unknown Driver';

    return (
      <div
        key={event.id}
        className="p-4 border rounded-lg bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${isMicrosleep ? 'bg-red-600 animate-pulse' : 'bg-orange-500'}`}></div>
              <span className="font-bold text-lg">
                {isMicrosleep ? 'MICROSLEEP' : 'FATIGUE'}
              </span>
              <Badge
                variant="outline"
                className={
                  event.severity === 'Critical'
                    ? 'border-red-500 text-red-700 bg-red-50'
                    : 'border-orange-500 text-orange-700 bg-orange-50'
                }
              >
                {event.severity}
              </Badge>
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{event.vehicle_registration}</span>
                <span className="text-gray-400">•</span>
                <span className="font-medium">{driverDisplay}</span>
                {event.driver_name && (
                  <GuardianCorrelationBadge
                    driverName={event.driver_name}
                    correlationMethod={event.correlation_method}
                    confidence={event.confidence}
                    size="sm"
                  />
                )}
                {!event.driver_name && event.primary_driver_name && (
                  <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-700 border-yellow-300">
                    ⚠ Assumed (Primary Driver)
                  </Badge>
                )}
                {!event.driver_name && !event.primary_driver_name && (
                  <Badge variant="outline" className="text-xs bg-red-100 text-red-700 border-red-300">
                    ⚠ URGENT - Driver Unknown
                  </Badge>
                )}
              </div>

              <div className="text-gray-600 dark:text-gray-400">
                {formatEventTime(event.detection_time)}
                {event.duration_seconds && ` • ${event.duration_seconds} seconds`}
                {event.speed_kph && ` • ${Math.round(event.speed_kph)} km/h`}
                {event.fleet && ` • ${event.fleet === 'Stevemacs' ? 'SMB' : 'GSF'}`}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button size="sm" variant="outline" className="text-xs">
              <Eye className="w-3 h-3 mr-1" />
              View Video
            </Button>
            <Button size="sm" variant="outline" className="text-xs">
              <MessageSquare className="w-3 h-3 mr-1" />
              Mark Coached
            </Button>
            <Button size="sm" variant="outline" className="text-xs text-red-600 border-red-300 hover:bg-red-50">
              <Send className="w-3 h-3 mr-1" />
              Dispatch Alert
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="border-red-200 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="w-6 h-6" />
              🚨 CRITICAL FATIGUE ALERTS - Last 7 Days
            </CardTitle>
            <CardDescription className="text-red-600 dark:text-red-500">
              Drivers falling asleep at the wheel - Requires immediate attention
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            {trend && (
              <div className={`flex items-center gap-2 ${getTrendColor()} font-medium`}>
                {getTrendIcon()}
                <span>
                  {Math.abs(trend.change).toFixed(0)}% vs previous week
                </span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="text-red-700 dark:text-red-400"
            >
              {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-red-600 border-r-transparent"></div>
              <p className="mt-2 text-sm text-gray-600">Loading fatigue events...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Last 24 Hours - Urgent Section */}
              {events24h.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-red-700 dark:text-red-400">
                      ⚠️ LAST 24 HOURS ({events24h.length} events)
                    </h3>
                    <Badge className="bg-red-600 text-white text-sm px-3 py-1 animate-pulse">
                      URGENT
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {events24h.map(event => renderEvent(event))}
                  </div>
                </div>
              )}

              {/* Last 7 Days - Older Events */}
              {eventsOlder.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-bold text-orange-700 dark:text-orange-400">
                      📊 LAST 7 DAYS ({eventsOlder.length} events)
                    </h3>
                    {eventsOlder.length > 5 && !showAll && (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => setShowAll(true)}
                        className="text-orange-700 dark:text-orange-400"
                      >
                        View All {eventsOlder.length} Events
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {(showAll ? eventsOlder : eventsOlder.slice(0, 5)).map(event => (
                      <div
                        key={event.id}
                        className="p-3 border rounded-lg bg-white dark:bg-gray-900 text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <span className="font-medium">{event.event_type.toUpperCase()}</span>
                            <span className="text-gray-400 mx-2">•</span>
                            <span className="font-medium">{event.vehicle_registration}</span>
                            <span className="text-gray-400 mx-2">•</span>
                            <span>{event.driver_name || event.primary_driver_name || 'Unknown Driver'}</span>
                            {event.driver_name && (
                              <>
                                <span className="text-gray-400 mx-2">•</span>
                                <GuardianCorrelationBadge
                                  driverName={event.driver_name}
                                  correlationMethod={event.correlation_method}
                                  confidence={event.confidence}
                                  size="sm"
                                  showIcon={false}
                                />
                              </>
                            )}
                          </div>
                          <span className="text-gray-600 dark:text-gray-400 text-xs">
                            {formatEventTime(event.detection_time)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {!showAll && eventsOlder.length > 5 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAll(true)}
                      className="w-full mt-3"
                    >
                      Show {eventsOlder.length - 5} More Events
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default GuardianCriticalFatigueAlerts;
