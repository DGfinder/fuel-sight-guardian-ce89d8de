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
    very_high: 'bg-emerald-500',
    high: 'bg-green-500',
    medium: 'bg-yellow-500',
    low: 'bg-orange-500',
    very_low: 'bg-red-500',
  };

  const stats = {
    total: relationships?.length || 0,
    highQuality: relationships?.filter(r => ['very_high', 'high'].includes(r.correlation_quality)).length || 0,
    withEvents: relationships?.filter(r => r.total_event_count > 0).length || 0,
  };

  return (
    <GlassCard variant="elevated" gradient="primary">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold mb-1">Trip Relationships Explorer</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Driver-Vehicle-Trip-Delivery correlations
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={filter === 'very_high' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('very_high')}
            >
              Very High
            </Button>
            <Button
              variant={filter === 'high' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('high')}
            >
              High
            </Button>
            <Button
              variant={filter === 'medium' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('medium')}
            >
              Medium
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-3 rounded-lg backdrop-blur-sm bg-white/10 dark:bg-gray-900/10 border border-white/10">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Total Trips</div>
          </div>
          <div className="p-3 rounded-lg backdrop-blur-sm bg-white/10 dark:bg-gray-900/10 border border-white/10">
            <div className="text-2xl font-bold">{stats.highQuality}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">High Quality</div>
          </div>
          <div className="p-3 rounded-lg backdrop-blur-sm bg-white/10 dark:bg-gray-900/10 border border-white/10">
            <div className="text-2xl font-bold">{stats.withEvents}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">With Events</div>
          </div>
        </div>
      </div>

      {/* Relationship Flow Diagram */}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
        {relationships?.slice(0, 10).map((rel) => (
          <div
            key={rel.trip_id}
            className="p-4 rounded-xl backdrop-blur-md bg-white/20 dark:bg-gray-900/20 border border-white/10 hover:bg-white/30 dark:hover:bg-gray-900/30 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              {/* Driver */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium truncate">
                    {rel.driver_name || 'Unknown Driver'}
                  </span>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-gray-400" />

              {/* Vehicle */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Truck className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium truncate">
                    {rel.vehicle_registration || 'Unknown'}
                  </span>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-gray-400" />

              {/* Delivery */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4 text-teal-500" />
                  <span className="text-sm font-medium truncate">
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
                  <div className="flex items-center gap-1 text-xs text-orange-500">
                    <AlertCircle className="w-3 h-3" />
                    {rel.total_event_count}
                  </div>
                )}
              </div>
            </div>

            {/* Additional Details on Hover */}
            <div className="mt-2 pt-2 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
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
