import React, { useMemo, useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useUnifiedEventTimeline } from '@/hooks/useUnifiedEventTimeline';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, startOfDay, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const EventTimelineChart: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'lytx' | 'guardian'>('all');
  const { data: events, isLoading } = useUnifiedEventTimeline({ days: 30, source: filter });

  const chartData = useMemo(() => {
    if (!events) return [];

    // Group events by date
    const eventsByDate = events.reduce((acc, event) => {
      const date = format(startOfDay(parseISO(event.occurred_at)), 'yyyy-MM-dd');
      if (!acc[date]) {
        acc[date] = { date, lytx: 0, guardian: 0 };
      }
      if (event.source === 'lytx') {
        acc[date].lytx++;
      } else {
        acc[date].guardian++;
      }
      return acc;
    }, {} as Record<string, { date: string; lytx: number; guardian: number }>);

    // Convert to array and sort by date
    return Object.values(eventsByDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [events]);

  if (isLoading) {
    return (
      <GlassCard variant="elevated">
        <Skeleton className="h-80 w-full" />
      </GlassCard>
    );
  }

  const totalEvents = events?.length || 0;
  const lytxCount = events?.filter(e => e.source === 'lytx').length || 0;
  const guardianCount = events?.filter(e => e.source === 'guardian').length || 0;

  return (
    <GlassCard variant="elevated" gradient="none">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold mb-1">Event Timeline</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Safety events across all sources - Last 30 days
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All ({totalEvents})
            </Button>
            <Button
              variant={filter === 'lytx' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('lytx')}
            >
              LYTX ({lytxCount})
            </Button>
            <Button
              variant={filter === 'guardian' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('guardian')}
            >
              Guardian ({guardianCount})
            </Button>
          </div>
        </div>

        <div className="flex gap-4 mb-4">
          <Badge variant="outline" className="text-blue-600 border-blue-200">
            <div className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
            LYTX Events
          </Badge>
          <Badge variant="outline" className="text-purple-600 border-purple-200">
            <div className="w-2 h-2 rounded-full bg-purple-500 mr-2" />
            Guardian Events
          </Badge>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorLytx" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="colorGuardian" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="date"
              stroke="rgba(156,163,175,0.5)"
              tick={{ fill: 'rgba(156,163,175,0.8)' }}
              tickFormatter={(value) => format(parseISO(value), 'MMM d')}
            />
            <YAxis stroke="rgba(156,163,175,0.5)" tick={{ fill: 'rgba(156,163,175,0.8)' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(17, 24, 39, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                backdropFilter: 'blur(10px)',
              }}
              labelFormatter={(value) => format(parseISO(value as string), 'MMM d, yyyy')}
            />
            <Legend />
            {filter !== 'guardian' && (
              <Area
                type="monotone"
                dataKey="lytx"
                stroke="#3B82F6"
                fill="url(#colorLytx)"
                name="LYTX Events"
              />
            )}
            {filter !== 'lytx' && (
              <Area
                type="monotone"
                dataKey="guardian"
                stroke="#8B5CF6"
                fill="url(#colorGuardian)"
                name="Guardian Events"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
};
