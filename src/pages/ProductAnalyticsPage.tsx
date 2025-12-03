import React, { useMemo, useState } from 'react';
import { useProductAnalytics } from '@/hooks/useProductAnalytics';
import { useProductConsumptionHistory } from '@/hooks/useProductConsumptionHistory';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Download,
  RefreshCw,
  BarChart3,
  Zap,
  AlertCircle,
  Droplets
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { getProductBadgeClasses } from '@/lib/product-colors';
import { cn } from '@/lib/utils';

export default function ProductAnalyticsPage() {
  const { products, isLoading, error, refetch, getSummary } = useProductAnalytics();
  const { history, isLoading: historyLoading, getGroupedByProduct } = useProductConsumptionHistory();

  const summary = useMemo(() => getSummary(), [products]);

  // Chart: Total consumption by product
  const consumptionChartData = useMemo(() => {
    return products.map(p => ({
      name: p.product_name,
      daily: p.total_daily_consumption_liters,
      weekly: Math.round(p.total_consumption_7_days_liters / 1000), // Convert to kL
      monthly: Math.round(p.total_consumption_30_days_liters / 1000)
    }));
  }, [products]);

  // Chart: Tank status distribution by product
  const statusDistributionData = useMemo(() => {
    return products.map(p => ({
      name: p.product_name,
      critical: p.tanks_critical,
      low: p.tanks_low,
      normal: p.tanks_normal
    }));
  }, [products]);

  // Chart: Historical trends
  const historicalTrendData = useMemo(() => {
    const grouped = getGroupedByProduct();
    const dates = [...new Set(history.map(h => h.snapshot_date))].sort();

    return dates.map(date => {
      const dataPoint: any = { date };

      Object.keys(grouped).forEach(productId => {
        const snapshot = grouped[productId].find(s => s.date === date);
        const productName = products.find(p => p.product_id === productId)?.product_name || productId;
        dataPoint[productName] = snapshot ? snapshot.consumption : 0;
      });

      return dataPoint;
    });
  }, [history, products, getGroupedByProduct]);

  // Export CSV functionality
  const handleExportCSV = () => {
    if (!products.length) return;

    const headers = [
      'Product', 'Tanks', 'Daily Consumption (L)', 'Weekly Consumption (kL)', 'Monthly Consumption (kL)',
      'Avg Fill %', 'Avg Days to Empty', 'Efficiency Score', 'Critical Tanks', 'Low Tanks', 'Normal Tanks'
    ];

    const rows = products.map(p => [
      p.product_name,
      p.total_tanks,
      p.total_daily_consumption_liters,
      Math.round(p.total_consumption_7_days_liters / 1000),
      Math.round(p.total_consumption_30_days_liters / 1000),
      p.avg_fill_percent.toFixed(1),
      p.avg_days_until_empty.toFixed(1),
      p.efficiency_score,
      p.tanks_critical,
      p.tanks_low,
      p.tanks_normal
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Loading product analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center space-y-4">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Error loading product analytics</h3>
          <p className="text-red-600 mt-1">{(error as Error).message}</p>
        </div>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="p-6 text-center space-y-4">
        <Droplets className="w-16 h-16 text-gray-400 mx-auto" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900">No Product Data</h3>
          <p className="text-gray-600 mt-1">No product analytics data is available yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Product Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">Cross-site consumption tracking and product-level insights</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Network Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalProducts}</div>
              <p className="text-xs text-muted-foreground">
                Across {summary.totalTanks} tanks
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Daily Consumption</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(summary.totalDailyConsumptionLiters).toLocaleString()} L
              </div>
              <p className="text-xs text-muted-foreground">
                Network average per day
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Network Fill Level</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary.networkFillPercent.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                {Math.round(summary.totalCurrentLevelLiters / 1000).toLocaleString()} kL / {Math.round(summary.totalCapacityLiters / 1000).toLocaleString()} kL
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical Tanks</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {summary.totalCriticalTanks}
              </div>
              <p className="text-xs text-muted-foreground">
                {((summary.totalCriticalTanks / summary.totalTanks) * 100).toFixed(1)}% of network
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Consumption Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Total Consumption by Product</CardTitle>
            <CardDescription>Daily, weekly, and monthly consumption comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={consumptionChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis label={{ value: 'Liters (Daily) / kL (W/M)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="daily" fill="#3b82f6" name="Daily (L)" />
                <Bar dataKey="weekly" fill="#10b981" name="Weekly (kL)" />
                <Bar dataKey="monthly" fill="#f59e0b" name="Monthly (kL)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Tank Status Distribution</CardTitle>
            <CardDescription>Critical, low, and normal tank counts by product</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statusDistributionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="critical" fill="#ef4444" name="Critical" stackId="a" />
                <Bar dataKey="low" fill="#f59e0b" name="Low" stackId="a" />
                <Bar dataKey="normal" fill="#10b981" name="Normal" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Historical Trend Chart */}
      {historicalTrendData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Consumption Trends Over Time</CardTitle>
            <CardDescription>Historical daily consumption by product</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={historicalTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis label={{ value: 'Liters', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                {products.map((product, index) => (
                  <Line
                    key={product.product_id}
                    type="monotone"
                    dataKey={product.product_name}
                    stroke={['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][index % 4]}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Product Performance Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>Product Performance Leaderboard</CardTitle>
          <CardDescription>Ranked by efficiency score and consumption metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Rank</th>
                  <th className="text-left py-3 px-4">Product</th>
                  <th className="text-right py-3 px-4">Tanks</th>
                  <th className="text-right py-3 px-4">Daily Consumption</th>
                  <th className="text-right py-3 px-4">Avg Fill %</th>
                  <th className="text-right py-3 px-4">Avg Days to Empty</th>
                  <th className="text-right py-3 px-4">Efficiency Score</th>
                  <th className="text-right py-3 px-4">Critical Tanks</th>
                </tr>
              </thead>
              <tbody>
                {products
                  .sort((a, b) => b.efficiency_score - a.efficiency_score)
                  .map((product, index) => (
                    <tr key={product.product_id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">#{index + 1}</td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={cn("font-semibold", getProductBadgeClasses(product.product_name))}
                        >
                          {product.product_name}
                        </Badge>
                      </td>
                      <td className="text-right py-3 px-4">{product.total_tanks}</td>
                      <td className="text-right py-3 px-4">
                        {Math.round(product.total_daily_consumption_liters).toLocaleString()} L
                      </td>
                      <td className="text-right py-3 px-4">{product.avg_fill_percent.toFixed(1)}%</td>
                      <td className="text-right py-3 px-4">
                        {product.avg_days_until_empty > 0 ? product.avg_days_until_empty.toFixed(1) : '—'}
                      </td>
                      <td className="text-right py-3 px-4">
                        <Badge variant={product.efficiency_score >= 70 ? 'default' : product.efficiency_score >= 40 ? 'secondary' : 'destructive'}>
                          {product.efficiency_score}
                        </Badge>
                      </td>
                      <td className="text-right py-3 px-4 text-red-600 font-medium">
                        {product.tanks_critical} ({product.percent_critical?.toFixed(1) || '0.0'}%)
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
