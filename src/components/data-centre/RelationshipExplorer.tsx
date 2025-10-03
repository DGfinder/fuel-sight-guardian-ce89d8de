import React, { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useDVTDRelationships } from '@/hooks/useDVTDRelationships';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight, TrendingUp, Users, Truck, Package, AlertCircle } from 'lucide-react';

export const RelationshipExplorer: React.FC = () => {
  const [filter, setFilter] = useState<'very_high' | 'high' | 'medium' | undefined>('high');
  const { data: relationships, isLoading } = useDVTDRelationships({
    days: 30,
    correlationQuality: filter,
    limit: 50,
  });

  if (isLoading) {
    return (
      <GlassCard variant="elevated">
        <Skeleton className="h-96 w-full" />
      </GlassCard>
    );
  }

  const qualityColors = {
    very_high: 'bg-slate-700 dark:bg-slate-600',
    high: 'bg-slate-600 dark:bg-slate-500',
    medium: 'bg-slate-500 dark:bg-slate-400',
    low: 'bg-slate-400 dark:bg-slate-300',
    very_low: 'bg-slate-300 dark:bg-slate-200',
  };

  const stats = {
    total: relationships?.length || 0,
    highQuality: relationships?.filter(r => ['very_high', 'high'].includes(r.correlation_quality)).length || 0,
    withEvents: relationships?.filter(r => r.total_event_count > 0).length || 0,
  };

  return (
    <GlassCard variant="elevated" gradient="none" className="border border-slate-200/50 dark:border-slate-700/50">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold mb-1 text-slate-900 dark:text-slate-100">Trip Relationships</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Driver-Vehicle-Trip-Delivery correlations
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={filter === 'very_high' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('very_high')}
              className={filter !== 'very_high' ? 'border-slate-300 dark:border-slate-600' : ''}
            >
              Very High
            </Button>
            <Button
              variant={filter === 'high' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('high')}
              className={filter !== 'high' ? 'border-slate-300 dark:border-slate-600' : ''}
            >
              High
            </Button>
            <Button
              variant={filter === 'medium' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('medium')}
              className={filter !== 'medium' ? 'border-slate-300 dark:border-slate-600' : ''}
            >
              Medium
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">{stats.total}</div>
            <div className="text-xs text-slate-600 dark:text-slate-400">Total Trips</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">{stats.highQuality}</div>
            <div className="text-xs text-slate-600 dark:text-slate-400">High Quality</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">{stats.withEvents}</div>
            <div className="text-xs text-slate-600 dark:text-slate-400">With Events</div>
          </div>
        </div>
      </div>

      {/* Relationship Flow Diagram */}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
        {relationships?.slice(0, 10).map((rel) => (
          <div
            key={rel.trip_id}
            className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              {/* Driver */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span className="text-sm font-medium truncate text-slate-700 dark:text-slate-200">
                    {rel.driver_name || 'Unknown Driver'}
                  </span>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-slate-400" />

              {/* Vehicle */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Truck className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span className="text-sm font-medium truncate text-slate-700 dark:text-slate-200">
                    {rel.vehicle_registration || 'Unknown'}
                  </span>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-slate-400" />

              {/* Delivery */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span className="text-sm font-medium truncate text-slate-700 dark:text-slate-200">
                    {rel.bill_of_lading || 'No BOL'}
                  </span>
                </div>
              </div>

              {/* Quality & Events */}
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`${qualityColors[rel.correlation_quality as keyof typeof qualityColors]} text-white border-0`}
                >
                  {rel.correlation_confidence?.toFixed(0)}%
                </Badge>
                {rel.total_event_count > 0 && (
                  <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                    <AlertCircle className="w-3 h-3" />
                    {rel.total_event_count}
                  </div>
                )}
              </div>
            </div>

            {/* Additional Details on Hover */}
            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{rel.distance_km?.toFixed(1)} km</span>
                <span>{rel.customer_name}</span>
                <span>
                  {rel.lytx_event_count > 0 && `${rel.lytx_event_count} LYTX`}
                  {rel.lytx_event_count > 0 && rel.guardian_event_count > 0 && ' • '}
                  {rel.guardian_event_count > 0 && `${rel.guardian_event_count} Guardian`}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {relationships && relationships.length > 10 && (
        <div className="mt-4 text-center">
          <Button variant="outline" size="sm">
            View All {relationships.length} Relationships
          </Button>
        </div>
      )}
    </GlassCard>
  );
};
