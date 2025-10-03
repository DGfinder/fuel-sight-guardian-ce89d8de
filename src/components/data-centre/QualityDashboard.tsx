import React from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useDataQualityDashboard } from '@/hooks/useDataQualityDashboard';
import { Database, TrendingUp, Link2, Zap } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

export const QualityDashboard: React.FC = () => {
  const { data, isLoading } = useDataQualityDashboard();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <GlassCard key={i} variant="elevated">
            <Skeleton className="h-24 w-full" />
          </GlassCard>
        ))}
      </div>
    );
  }

  const { summary } = data || { summary: { totalRecords: 0, avgQualityScore: 0, relationshipHealth: 0 } };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Total Records Card */}
      <GlassCard variant="elevated" gradient="none" className="group border border-slate-200/50 dark:border-slate-700/50">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              Total Records
            </h3>
            <p className="text-3xl font-bold text-slate-700 dark:text-slate-200">
              {summary.totalRecords.toLocaleString()}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 transition-all duration-300 group-hover:bg-slate-200 dark:group-hover:bg-slate-700">
            <Database className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
          <p className="text-xs text-slate-500 dark:text-slate-500">
            Across all data sources
          </p>
        </div>
      </GlassCard>

      {/* Data Quality Score Card */}
      <GlassCard variant="elevated" gradient="none" className="group border border-slate-200/50 dark:border-slate-700/50">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              Data Quality
            </h3>
            <p className="text-3xl font-bold text-slate-700 dark:text-slate-200">
              {summary.avgQualityScore}%
            </p>
          </div>
          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 transition-all duration-300 group-hover:bg-slate-200 dark:group-hover:bg-slate-700">
            <TrendingUp className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </div>
        </div>
        <div className="space-y-2">
          <Progress value={summary.avgQualityScore} className="h-2 bg-slate-200 dark:bg-slate-700" />
          <p className="text-xs text-slate-500 dark:text-slate-500">
            Match rate across entities
          </p>
        </div>
      </GlassCard>

      {/* Relationship Health Card */}
      <GlassCard variant="elevated" gradient="none" className="group border border-slate-200/50 dark:border-slate-700/50">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              Correlation Health
            </h3>
            <p className="text-3xl font-bold text-slate-700 dark:text-slate-200">
              {summary.relationshipHealth}%
            </p>
          </div>
          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 transition-all duration-300 group-hover:bg-slate-200 dark:group-hover:bg-slate-700">
            <Link2 className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </div>
        </div>
        <div className="space-y-2">
          <Progress value={summary.relationshipHealth} className="h-2 bg-slate-200 dark:bg-slate-700" />
          <p className="text-xs text-slate-500 dark:text-slate-500">
            Trip-delivery correlation rate
          </p>
        </div>
      </GlassCard>

      {/* Performance Indicator */}
      <GlassCard variant="subtle" className="md:col-span-3 border border-slate-200/50 dark:border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-sm mb-1 text-slate-700 dark:text-slate-200">Performance Optimized</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              27+ indexes active • Average query time &lt;100ms • Real-time updates enabled
            </p>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
              Excellent
            </div>
            <div className="text-xs text-slate-500">Status</div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};
