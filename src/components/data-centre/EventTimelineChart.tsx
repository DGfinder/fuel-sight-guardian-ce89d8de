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
    <GlassCard variant="elevated" gradient="none" className="border border-slate-200/50 dark:border-slate-700/50">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold mb-1 text-slate-900 dark:text-slate-100">Event Timeline</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Safety events across all sources - Last 30 days
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
              className={filter !== 'all' ? 'border-slate-300 dark:border-slate-600' : ''}
            >
              All ({totalEvents})
            </Button>
            <Button
              variant={filter === 'lytx' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('lytx')}
              className={filter !== 'lytx' ? 'border-slate-300 dark:border-slate-600' : ''}
            >
              LYTX ({lytxCount})
            </Button>
            <Button
              variant={filter === 'guardian' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('guardian')}
              className={filter !== 'guardian' ? 'border-slate-300 dark:border-slate-600' : ''}
            >
              Guardian ({guardianCount})
            </Button>
          </div>
        </div>

        <div className="flex gap-4 mb-4">
          <Badge variant="outline" className="text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600">
            <div className="w-2 h-2 rounded-full bg-slate-700 dark:bg-slate-300 mr-2" />
            LYTX Events
          </Badge>
          <Badge variant="outline" className="text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600">
            <div className="w-2 h-2 rounded-full bg-slate-600 dark:bg-slate-400 mr-2" />
            Guardian Events
          </Badge>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorLytx" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#475569" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#475569" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="colorGuardian" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#64748b" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#64748b" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
            <XAxis
              dataKey="date"
              stroke="rgba(100,116,139,0.5)"
              tick={{ fill: 'rgba(100,116,139,0.8)' }}
              tickFormatter={(value) => format(parseISO(value), 'MMM d')}
            />
            <YAxis stroke="rgba(100,116,139,0.5)" tick={{ fill: 'rgba(100,116,139,0.8)' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(248, 250, 252, 0.95)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: '8px',
                color: '#1e293b',
              }}
              labelFormatter={(value) => format(parseISO(value as string), 'MMM d, yyyy')}
            />
            <Legend />
            {filter !== 'guardian' && (
              <Area
                type="monotone"
                dataKey="lytx"
                stroke="#475569"
                strokeWidth={2}
                fill="url(#colorLytx)"
                name="LYTX Events"
              />
            )}
            {filter !== 'lytx' && (
              <Area
                type="monotone"
                dataKey="guardian"
                stroke="#64748b"
                strokeWidth={2}
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
