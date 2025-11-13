import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Building,
  TrendingUp,
  TrendingDown,
  Package,
  Calendar,
  Users,
  BarChart3,
  Download,
  Award,
  Target,
  Activity,
  DollarSign
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import type { TerminalAnalytics } from '@/api/captivePayments';
import {
  getTerminalDetailedAnalytics,
  getTerminalBenchmarkAnalytics,
  getTerminalMonthlyAnalytics
} from '@/api/captivePayments';
import {
  getCurrentAustralianFY,
  groupDataByAustralianFY,
  calculateAustralianFYTotals,
  formatAustralianFY,
  calculateFYGrowth
} from '@/utils/financialYear';

interface TerminalDetailModalProps {
  terminal: TerminalAnalytics | null;
  isOpen: boolean;
  onClose: () => void;
  carrier?: string;
  allTerminals?: TerminalAnalytics[];
}

// Chart colors
const COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];
const FY_COLORS = ['#1f2937', '#374151', '#4b5563', '#6b7280'];

const TerminalDetailModal: React.FC<TerminalDetailModalProps> = ({
  terminal,
  isOpen,
  onClose,
  carrier = 'SMB',
  allTerminals = []
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [detailedAnalytics, setDetailedAnalytics] = useState<any>(null);
  const [benchmarkAnalytics, setBenchmarkAnalytics] = useState<any>(null);
  const [monthlyAnalytics, setMonthlyAnalytics] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch detailed analytics when terminal changes
  useEffect(() => {
    if (terminal && isOpen) {
      setIsLoading(true);
      Promise.all([
        getTerminalDetailedAnalytics(terminal.terminal, { carrier: carrier as any }),
        getTerminalBenchmarkAnalytics(terminal.terminal, { carrier: carrier as any }),
        getTerminalMonthlyAnalytics(terminal.terminal, { carrier: carrier as any })
      ]).then(([detailed, benchmark, monthly]) => {
        setDetailedAnalytics(detailed);
        setBenchmarkAnalytics(benchmark);
        setMonthlyAnalytics(monthly);
        setIsLoading(false);
      }).catch(error => {
        console.error('Error fetching terminal analytics:', error);
        setIsLoading(false);
      });
    }
  }, [terminal, isOpen, carrier]);

  const terminalMetrics = useMemo(() => {
    if (!terminal || !detailedAnalytics) return null;

    // Calculate Financial Year data
    const currentFY = getCurrentAustralianFY();
    const fyGroups = groupDataByAustralianFY(monthlyAnalytics);
    const fyData = Array.from(fyGroups.values()).sort((a, b) => b.fyYear - a.fyYear);

    // Calculate growth trends
    const recentMonths = monthlyAnalytics.slice(-3);
    const earlierMonths = monthlyAnalytics.slice(-6, -3);
    const recentAvg = recentMonths.reduce((sum, m) => sum + m.total_volume_megalitres, 0) / Math.max(1, recentMonths.length);
    const earlierAvg = earlierMonths.reduce((sum, m) => sum + m.total_volume_megalitres, 0) / Math.max(1, earlierMonths.length);
    const growthRate = earlierAvg > 0 ? ((recentAvg - earlierAvg) / earlierAvg) * 100 : 0;

    // Top customers pie chart data
    const topCustomersPie = detailedAnalytics.customerInsights.topCustomers.slice(0, 5).map((customer: any, index: number) => ({
      name: customer.customer.length > 20 ? customer.customer.substring(0, 20) + '...' : customer.customer,
      value: customer.total_volume_megalitres,
      percentage: (customer.total_volume_megalitres / detailedAnalytics.totalVolumeMegaLitres * 100).toFixed(1)
    }));

    return {
      fyData,
      currentFY,
      growthRate,
      topCustomersPie,
      monthlyTrends: monthlyAnalytics.slice(-12), // Last 12 months
      peakMonth: detailedAnalytics.peakMonth,
      recentActivity: detailedAnalytics.recentActivity,
      customerInsights: detailedAnalytics.customerInsights
    };
  }, [terminal, detailedAnalytics, monthlyAnalytics]);

  const handleExportTerminalData = () => {
    if (!terminal || !detailedAnalytics) return;

    const exportData = {
      terminal: terminal.terminal,
      carrier: terminal.carrier,
      summary: {
        totalDeliveries: terminal.total_deliveries,
        totalVolumeLitres: terminal.total_volume_litres,
        totalVolumeMegaLitres: terminal.total_volume_megalitres,
        percentageOfCarrierVolume: terminal.percentage_of_carrier_volume,
        uniqueCustomers: terminal.unique_customers,
        servicePeriod: `${terminal.first_delivery_date} to ${terminal.last_delivery_date}`
      },
      recentActivity: detailedAnalytics.recentActivity,
      peakMonth: detailedAnalytics.peakMonth,
      financialYearData: terminalMetrics?.fyData || [],
      monthlyTrends: monthlyAnalytics,
      topCustomers: detailedAnalytics.customerInsights.topCustomers,
      benchmarks: benchmarkAnalytics?.benchmarks || {},
      rankings: benchmarkAnalytics?.rankings || {}
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terminal-analysis-${terminal.terminal.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (!terminal) {
    return null;
  }

  const avgDeliverySize = terminal.total_deliveries > 0 
    ? (terminal.total_volume_litres / terminal.total_deliveries).toFixed(0)
    : '0';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Building className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">{terminal.terminal}</DialogTitle>
                <DialogDescription className="flex items-center gap-4 mt-1">
                  <span>Terminal Performance Analytics & Business Intelligence</span>
                  <Badge variant="outline" className="text-xs">
                    {terminal.percentage_of_carrier_volume.toFixed(1)}% of {carrier} Volume
                  </Badge>
                </DialogDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportTerminalData}>
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </Button>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="financial">Financial Year</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Terminal Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{terminal.total_deliveries.toLocaleString()}</div>
                      <div className="text-sm text-gray-500">Total Deliveries</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">{terminal.total_volume_megalitres.toFixed(2)} ML</div>
                      <div className="text-sm text-gray-500">{terminal.total_volume_litres.toLocaleString()} Litres</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">{avgDeliverySize}L</div>
                      <div className="text-sm text-gray-500">Average per Delivery</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Service Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="text-sm font-medium">First Delivery</div>
                      <div className="text-sm text-gray-600">{terminal.first_delivery_date}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">Last Delivery</div>
                      <div className="text-sm text-gray-600">{terminal.last_delivery_date}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">Unique Customers</div>
                      <div className="text-sm text-gray-600">{terminal.unique_customers}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">Recent Activity</div>
                      <div className="text-sm text-gray-600">{terminal.deliveries_last_30_days} deliveries (30d)</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Award className="w-4 h-4" />
                      Market Position
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="text-lg font-semibold text-green-600">
                        {terminal.percentage_of_carrier_volume.toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-500">of {carrier} Volume</div>
                    </div>
                    {benchmarkAnalytics && (
                      <>
                        <div>
                          <div className="text-sm font-medium">Volume Ranking</div>
                          <div className="text-sm text-gray-600">
                            #{benchmarkAnalytics.rankings.volumeRank} of {benchmarkAnalytics.rankings.totalTerminals}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium">Performance Percentile</div>
                          <div className="text-sm text-gray-600">
                            {benchmarkAnalytics.benchmarks.volume.percentile.toFixed(0)}th percentile
                          </div>
                        </div>
                      </>
                    )}
                    {terminalMetrics && (
                      <div className="flex items-center gap-2">
                        {terminalMetrics.growthRate >= 0 ? (
                          <TrendingUp className="w-4 h-4 text-green-500" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-500" />
                        )}
                        <span className={`text-sm font-medium ${terminalMetrics.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {Math.abs(terminalMetrics.growthRate).toFixed(1)}% trend
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Customer Distribution */}
              {terminalMetrics?.topCustomersPie && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Customer Distribution
                    </CardTitle>
                    <CardDescription>Top 5 customers by volume</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={terminalMetrics.topCustomersPie}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percentage }) => `${percentage}%`}
                          >
                            {terminalMetrics.topCustomersPie.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => [`${value.toFixed(2)} ML`, 'Volume']} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2">
                        {terminalMetrics.topCustomersPie.map((customer: any, index: number) => (
                          <div key={customer.name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              <span className="text-sm font-medium">{customer.name}</span>
                            </div>
                            <div className="text-sm text-gray-600">
                              {customer.value.toFixed(2)}ML ({customer.percentage}%)
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4 mt-4">
              {/* Monthly Trends Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Monthly Volume Trends
                  </CardTitle>
                  <CardDescription>12-month delivery and volume pattern analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  {terminalMetrics?.monthlyTrends && terminalMetrics.monthlyTrends.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={terminalMetrics.monthlyTrends}>
                        <defs>
                          <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month_name" />
                        <YAxis />
                        <Tooltip 
                          formatter={(value: number, name: string) => [
                            name === 'total_volume_megalitres' ? `${value.toFixed(2)} ML` : value,
                            name === 'total_volume_megalitres' ? 'Volume' : 'Deliveries'
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey="total_volume_megalitres"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          fill="url(#colorVolume)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      {isLoading ? 'Loading monthly trends...' : 'No monthly data available'}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Performance Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Operational Metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {detailedAnalytics?.recentActivity && (
                      <>
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm">Utilization Score</span>
                            <span className="font-medium">{detailedAnalytics.recentActivity.utilizationScore}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${Math.min(100, detailedAnalytics.recentActivity.utilizationScore)}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm">Daily Average Deliveries</span>
                            <span className="font-medium">{detailedAnalytics.recentActivity.averageDeliveriesPerDay}</span>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm">Daily Average Volume</span>
                            <span className="font-medium">{detailedAnalytics.recentActivity.averageVolumePerDay}ML</span>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {detailedAnalytics?.peakMonth && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Peak Performance</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="font-medium text-blue-900">
                          {detailedAnalytics.peakMonth.month} {detailedAnalytics.peakMonth.year}
                        </div>
                        <div className="text-sm text-blue-700 mt-1">
                          {detailedAnalytics.peakMonth.volumeMegaLitres.toFixed(2)}ML delivered
                        </div>
                        <div className="text-sm text-blue-700">
                          {detailedAnalytics.peakMonth.deliveries} deliveries
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="financial" className="space-y-4 mt-4">
              {/* Financial Year Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Australian Financial Year Analysis
                  </CardTitle>
                  <CardDescription>
                    Performance by Australian Financial Year (July - June)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {terminalMetrics?.fyData && terminalMetrics.fyData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={terminalMetrics.fyData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="fyLabel" />
                          <YAxis />
                          <Tooltip 
                            formatter={(value: number, name: string) => [
                              name === 'totalVolumeMegaLitres' ? `${value.toFixed(2)} ML` : value,
                              name === 'totalVolumeMegaLitres' ? 'Volume' : 'Deliveries'
                            ]}
                          />
                          <Bar dataKey="totalVolumeMegaLitres" fill="#3b82f6" name="Volume (ML)" />
                        </BarChart>
                      </ResponsiveContainer>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                        {terminalMetrics.fyData.map((fy: any, index: number) => (
                          <div key={fy.fyYear} className={`p-3 rounded-lg border ${
                            fy.fyYear === terminalMetrics.currentFY.fyYear 
                              ? 'border-blue-500 bg-blue-50' 
                              : 'border-gray-200 bg-gray-50'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">{fy.fyLabel}</span>
                              {fy.fyYear === terminalMetrics.currentFY.fyYear && (
                                <Badge variant="default" className="text-xs">Current</Badge>
                              )}
                            </div>
                            <div className="space-y-1 text-sm">
                              <div>Volume: {fy.totalVolumeMegaLitres.toFixed(2)}ML</div>
                              <div>Deliveries: {fy.totalDeliveries.toLocaleString()}</div>
                              <div className="text-xs text-gray-500">
                                {fy.monthCount} months of data
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      {isLoading ? 'Loading financial year data...' : 'No financial year data available'}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance" className="space-y-4 mt-4">
              {/* Performance Benchmarks */}
              {benchmarkAnalytics && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Award className="w-4 h-4" />
                          Terminal Rankings
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                          <div>
                            <div className="font-medium">Volume Ranking</div>
                            <div className="text-sm text-gray-600">Total megalitres handled</div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-blue-600">
                              #{benchmarkAnalytics.rankings.volumeRank}
                            </div>
                            <div className="text-xs text-gray-500">
                              of {benchmarkAnalytics.rankings.totalTerminals}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                          <div>
                            <div className="font-medium">Delivery Ranking</div>
                            <div className="text-sm text-gray-600">Total deliveries completed</div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-green-600">
                              #{benchmarkAnalytics.rankings.deliveryRank}
                            </div>
                            <div className="text-xs text-gray-500">
                              of {benchmarkAnalytics.rankings.totalTerminals}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                          <div>
                            <div className="font-medium">Customer Ranking</div>
                            <div className="text-sm text-gray-600">Unique customers served</div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-purple-600">
                              #{benchmarkAnalytics.rankings.customerRank}
                            </div>
                            <div className="text-xs text-gray-500">
                              of {benchmarkAnalytics.rankings.totalTerminals}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Target className="w-4 h-4" />
                          Performance Benchmarks
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium">Volume vs Average</span>
                            <span className="text-sm font-bold text-blue-600">
                              {benchmarkAnalytics.benchmarks.volume.terminal.toFixed(2)}ML
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mb-2">
                            Terminal average: {benchmarkAnalytics.benchmarks.volume.average}ML
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${Math.min(100, benchmarkAnalytics.benchmarks.volume.percentile)}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium">Deliveries vs Average</span>
                            <span className="text-sm font-bold text-green-600">
                              {benchmarkAnalytics.benchmarks.deliveries.terminal.toLocaleString()}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mb-2">
                            Terminal average: {benchmarkAnalytics.benchmarks.deliveries.average.toLocaleString()}
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-600 h-2 rounded-full" 
                              style={{ width: `${Math.min(100, benchmarkAnalytics.benchmarks.deliveries.percentile)}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium">Efficiency Ranking</span>
                            <span className="text-sm font-bold text-purple-600">
                              #{benchmarkAnalytics.rankings.efficiencyRank}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mb-2">
                            Avg delivery: {benchmarkAnalytics.benchmarks.deliverySize.terminal}L
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-purple-600 h-2 rounded-full" 
                              style={{ width: `${Math.min(100, benchmarkAnalytics.benchmarks.deliverySize.percentile)}%` }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Competitive Analysis */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        Competitive Analysis
                      </CardTitle>
                      <CardDescription>
                        How this terminal compares to top performers
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600 mb-1">
                            {terminal.total_volume_megalitres.toFixed(1)}ML
                          </div>
                          <div className="text-sm text-gray-600 mb-2">This Terminal</div>
                          <div className="text-xs text-gray-500">
                            Market share: {terminal.percentage_of_carrier_volume.toFixed(1)}%
                          </div>
                        </div>
                        
                        <div className="text-center p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
                          <div className="text-2xl font-bold text-green-600 mb-1">
                            {benchmarkAnalytics.competitorAnalysis.topPerformer?.total_volume_megalitres.toFixed(1)}ML
                          </div>
                          <div className="text-sm text-gray-600 mb-2">Top Performer</div>
                          <div className="text-xs text-gray-500">
                            {benchmarkAnalytics.competitorAnalysis.topPerformer?.terminal}
                          </div>
                        </div>
                        
                        <div className="text-center p-4 bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg">
                          <div className="text-2xl font-bold text-orange-600 mb-1">
                            {benchmarkAnalytics.benchmarks.volume.average}ML
                          </div>
                          <div className="text-sm text-gray-600 mb-2">Terminal Average</div>
                          <div className="text-xs text-gray-500">
                            Across {benchmarkAnalytics.rankings.totalTerminals} terminals
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TerminalDetailModal;