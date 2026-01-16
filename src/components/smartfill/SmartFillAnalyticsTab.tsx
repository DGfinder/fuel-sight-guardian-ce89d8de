/**
 * SmartFill Analytics Tab Component
 * Consumption trends, charts, and historical analysis
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Activity,
  BarChart3,
  Calendar,
  Download,
  Filter,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { staggerContainerVariants, fadeUpItemVariants } from '@/lib/motion-variants';
import {
  useSmartFillConsumptionTrends,
  useSmartFillSyncAnalytics,
  useSmartFillFleetOverview,
  useSmartFillCustomerSummaries,
} from '@/hooks/useSmartFillAnalytics';
import { SmartFillSyncHistory } from './SmartFillSyncHistory';

const CHART_COLORS = {
  healthy: '#22c55e',
  warning: '#eab308',
  critical: '#ef4444',
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  muted: '#9ca3af',
};

export function SmartFillAnalyticsTab() {
  const [timeRange, setTimeRange] = useState('30');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');

  const { data: overview } = useSmartFillFleetOverview();
  const { data: consumption } = useSmartFillConsumptionTrends(undefined, parseInt(timeRange));
  const { data: syncAnalytics } = useSmartFillSyncAnalytics(parseInt(timeRange));
  const { data: customerSummaries } = useSmartFillCustomerSummaries();

  // Aggregate consumption by date
  const dailyConsumption = useMemo(() => {
    if (!consumption) return [];

    const byDate = new Map<string, { date: string; consumption: number; refills: number }>();

    consumption.forEach((c) => {
      const existing = byDate.get(c.reading_date) || {
        date: c.reading_date,
        consumption: 0,
        refills: 0,
      };
      existing.consumption += c.daily_consumption || 0;
      if (c.had_refill) existing.refills++;
      byDate.set(c.reading_date, existing);
    });

    return Array.from(byDate.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-parseInt(timeRange));
  }, [consumption, timeRange]);

  // Tank distribution data for pie chart
  const tankDistribution = useMemo(() => {
    if (!overview) return [];
    return [
      { name: 'Healthy', value: overview.healthy_tanks || 0, color: CHART_COLORS.healthy },
      { name: 'Warning', value: overview.warning_tanks || 0, color: CHART_COLORS.warning },
      { name: 'Critical', value: overview.critical_tanks || 0, color: CHART_COLORS.critical },
    ].filter((d) => d.value > 0);
  }, [overview]);

  // Customer comparison data
  const customerComparison = useMemo(() => {
    if (!customerSummaries) return [];
    return customerSummaries
      .slice(0, 10)
      .map((c) => ({
        name: c.customer_name.length > 15 ? c.customer_name.substring(0, 15) + '...' : c.customer_name,
        fullName: c.customer_name,
        tanks: c.tank_count,
        avgFill: c.avg_fill_percent || 0,
        healthScore: c.health_score,
      }))
      .sort((a, b) => b.tanks - a.tanks);
  }, [customerSummaries]);

  // Sync performance data
  const syncPerformance = useMemo(() => {
    if (!syncAnalytics) return [];
    return syncAnalytics.map((s: any) => ({
      date: new Date(s.sync_date).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' }),
      success: s.successful_syncs || 0,
      partial: s.partial_syncs || 0,
      failed: s.failed_syncs || 0,
      rate: s.success_rate || 0,
    }));
  }, [syncAnalytics]);

  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Controls */}
      <motion.div variants={fadeUpItemVariants} className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Analytics</h2>
          <p className="text-sm text-gray-600">Consumption trends and fleet insights</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 Days</SelectItem>
              <SelectItem value="14">14 Days</SelectItem>
              <SelectItem value="30">30 Days</SelectItem>
              <SelectItem value="90">90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </motion.div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Consumption Trend Chart */}
        <motion.div variants={fadeUpItemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-blue-600" />
                Daily Consumption
              </CardTitle>
              <CardDescription>Fleet-wide fuel usage over time</CardDescription>
            </CardHeader>
            <CardContent>
              {dailyConsumption.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={dailyConsumption}>
                    <defs>
                      <linearGradient id="consumptionGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) =>
                        new Date(value).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })
                      }
                      stroke="#9ca3af"
                      fontSize={12}
                    />
                    <YAxis stroke="#9ca3af" fontSize={12} />
                    <Tooltip
                      formatter={(value: number) => [`${value.toLocaleString()} L`, 'Consumption']}
                      labelFormatter={(label) =>
                        new Date(label).toLocaleDateString('en-AU', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="consumption"
                      stroke={CHART_COLORS.primary}
                      fill="url(#consumptionGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  No consumption data available
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Tank Distribution Pie Chart */}
        <motion.div variants={fadeUpItemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-600" />
                Tank Health Distribution
              </CardTitle>
              <CardDescription>Current status breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              {tankDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={tankDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {tankDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [value, 'Tanks']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  No tank data available
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Customer Comparison Chart */}
        <motion.div variants={fadeUpItemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                Customer Comparison
              </CardTitle>
              <CardDescription>Top 10 customers by tank count</CardDescription>
            </CardHeader>
            <CardContent>
              {customerComparison.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={customerComparison} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      stroke="#9ca3af"
                      fontSize={11}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        name === 'avgFill' ? `${value.toFixed(1)}%` : value,
                        name === 'tanks' ? 'Tanks' : 'Avg Fill %',
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="tanks" fill={CHART_COLORS.primary} name="Tanks" />
                    <Bar dataKey="avgFill" fill={CHART_COLORS.secondary} name="Avg Fill %" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  No customer data available
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Sync Performance Chart */}
        <motion.div variants={fadeUpItemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Sync Performance
              </CardTitle>
              <CardDescription>API sync success rate over time</CardDescription>
            </CardHeader>
            <CardContent>
              {syncPerformance.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={syncPerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                    <YAxis stroke="#9ca3af" fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="success" stackId="a" fill={CHART_COLORS.healthy} name="Success" />
                    <Bar dataKey="partial" stackId="a" fill={CHART_COLORS.warning} name="Partial" />
                    <Bar dataKey="failed" stackId="a" fill={CHART_COLORS.critical} name="Failed" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  No sync data available
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Summary Stats */}
      <motion.div variants={fadeUpItemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Period Summary</CardTitle>
            <CardDescription>Key metrics for the selected time period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">
                  {dailyConsumption.reduce((sum, d) => sum + d.consumption, 0).toLocaleString()}
                </p>
                <p className="text-sm text-gray-500">Total Consumption (L)</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-purple-600">
                  {dailyConsumption.reduce((sum, d) => sum + d.refills, 0)}
                </p>
                <p className="text-sm text-gray-500">Refill Events</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">
                  {syncPerformance.length > 0
                    ? `${(syncPerformance.reduce((sum, s) => sum + s.rate, 0) / syncPerformance.length).toFixed(1)}%`
                    : '--'}
                </p>
                <p className="text-sm text-gray-500">Avg Sync Success</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-700">
                  {dailyConsumption.length > 0
                    ? Math.round(
                        dailyConsumption.reduce((sum, d) => sum + d.consumption, 0) /
                          dailyConsumption.length
                      ).toLocaleString()
                    : '--'}
                </p>
                <p className="text-sm text-gray-500">Avg Daily Consumption (L)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Sync History */}
      <SmartFillSyncHistory limit={15} />
    </motion.div>
  );
}

export default SmartFillAnalyticsTab;
