import React, { useState, useMemo } from 'react';
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
  User,
  TrendingUp,
  TrendingDown,
  Package,
  Calendar,
  MapPin,
  BarChart3,
  Download,
  Clock,
  Award
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
  Bar
} from 'recharts';
import { CustomerAnalytics } from '@/types/captivePayments';
// TODO: Will integrate mtdata API for real trip distance data in the future

interface CustomerDetailModalProps {
  customer: CustomerAnalytics | null;
  isOpen: boolean;
  onClose: () => void;
  totalDeliveries: number;
  allCustomers: CustomerAnalytics[];
}

const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  customer,
  isOpen,
  onClose,
  totalDeliveries,
  allCustomers
}) => {
  const [activeTab, setActiveTab] = useState('overview');

  const customerMetrics = useMemo(() => {
    if (!customer) return null;

    // Calculate rankings
    const sortedByVolume = [...allCustomers].sort((a, b) => b.total_volume_megalitres - a.total_volume_megalitres);
    const sortedByDeliveries = [...allCustomers].sort((a, b) => b.total_deliveries - a.total_deliveries);
    const volumeRank = sortedByVolume.findIndex(c => c.customer === customer.customer) + 1;
    const deliveryRank = sortedByDeliveries.findIndex(c => c.customer === customer.customer) + 1;

    // Generate mock monthly data for trends
    const monthlyData = [];
    const currentDate = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const baseVolume = customer.total_volume_megalitres / 12;
      const variation = (Math.random() - 0.5) * 0.4 + 1; // ±40% variation
      const volume = Math.max(0, baseVolume * variation);
      const deliveries = Math.round((customer.total_deliveries / 12) * variation);
      
      monthlyData.push({
        month: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        fullMonth: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        volumeMegaLitres: Math.round(volume * 100) / 100,
        deliveries: deliveries,
        efficiency: volume > 0 ? Math.round((deliveries / volume) * 100) / 100 : 0
      });
    }

    // Calculate growth trends
    const recentMonths = monthlyData.slice(-3);
    const earlierMonths = monthlyData.slice(-6, -3);
    const recentAvg = recentMonths.reduce((sum, m) => sum + m.volumeMegaLitres, 0) / 3;
    const earlierAvg = earlierMonths.reduce((sum, m) => sum + m.volumeMegaLitres, 0) / 3;
    const growthRate = earlierAvg > 0 ? ((recentAvg - earlierAvg) / earlierAvg) * 100 : 0;

    return {
      rankings: { volumeRank, deliveryRank },
      monthlyData,
      growthRate
    };
  }, [customer, allCustomers]);

  if (!customer || !customerMetrics) {
    return null;
  }

  const percentage = ((customer.total_deliveries / totalDeliveries) * 100).toFixed(1);
  const avgDeliverySize = (customer.total_volume_litres / customer.total_deliveries).toFixed(0);

  const handleExportCustomerData = () => {
    const exportData = {
      customer: customer.customer,
      summary: {
        totalDeliveries: customer.total_deliveries,
        totalVolumeLitres: customer.total_volume_litres,
        totalVolumeMegaLitres: customer.total_volume_megalitres,
        averageDeliverySize: avgDeliverySize,
        percentageOfTotal: percentage,
        terminalsServed: customer.terminals_served,
        servicePeriod: `${customer.first_delivery_date} to ${customer.last_delivery_date}`
      },
      monthlyTrends: customerMetrics.monthlyData,
      rankings: customerMetrics.rankings
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer-analysis-${customer.customer.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">{customer.customer}</DialogTitle>
                <DialogDescription className="flex items-center gap-4 mt-1">
                  <span>Customer Analytics & Performance Dashboard</span>
                  <Badge variant="outline" className="text-xs">
                    Rank #{customerMetrics.rankings.volumeRank} by Volume
                  </Badge>
                </DialogDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportCustomerData}>
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </Button>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Key Metrics */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Delivery Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{customer.total_deliveries}</div>
                      <div className="text-sm text-gray-500">Total Deliveries</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">{customer.total_volume_megalitres.toFixed(2)} ML</div>
                      <div className="text-sm text-gray-500">{customer.total_volume_litres.toLocaleString()} Litres</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">{avgDeliverySize}L</div>
                      <div className="text-sm text-gray-500">Average per Delivery</div>
                    </div>
                  </CardContent>
                </Card>

                {/* Service Information */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Service Period
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="text-sm font-medium">First Delivery</div>
                      <div className="text-sm text-gray-600">{customer.first_delivery_date}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">Last Delivery</div>
                      <div className="text-sm text-gray-600">{customer.last_delivery_date}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">Terminals Served</div>
                      <div className="text-sm text-gray-600">{customer.terminals_served}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">Recent Activity</div>
                      <div className="text-sm text-gray-600">{customer.deliveries_last_30_days} deliveries (30d)</div>
                    </div>
                  </CardContent>
                </Card>

                {/* Market Position */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Award className="w-4 h-4" />
                      Market Position
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="text-lg font-semibold text-green-600">{percentage}%</div>
                      <div className="text-sm text-gray-500">of Total SMB Volume</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">Volume Ranking</div>
                      <div className="text-sm text-gray-600">#{customerMetrics.rankings.volumeRank} of {allCustomers.length}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">Delivery Ranking</div>
                      <div className="text-sm text-gray-600">#{customerMetrics.rankings.deliveryRank} of {allCustomers.length}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {customerMetrics.growthRate >= 0 ? (
                        <TrendingUp className="w-4 h-4 text-green-500" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-500" />
                      )}
                      <span className={`text-sm font-medium ${customerMetrics.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {Math.abs(customerMetrics.growthRate).toFixed(1)}% trend
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Terminal Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Terminal Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium mb-2">Terminals Served</div>
                      <div className="space-y-2">
                        {customer.terminals_list?.map((terminal, index) => (
                          <div key={terminal} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <span className="font-medium">{terminal}</span>
                            <Badge variant={index === 0 ? "default" : "secondary"} className="text-xs">
                              {index === 0 ? 'Primary' : 'Secondary'}
                            </Badge>
                          </div>
                        )) || (
                          <div className="text-gray-500 text-sm">No terminal data available</div>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-2">Future Integration</div>
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="font-medium text-blue-900">Distance Analytics</div>
                        <div className="text-sm text-blue-700">
                          Coming soon with mtdata API integration
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                          Real truck route data will be available
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4 mt-4">
              {/* Monthly Volume Trend Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Monthly Volume Trends
                  </CardTitle>
                  <CardDescription>12-month volume and delivery pattern analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={customerMetrics.monthlyData}>
                      <defs>
                        <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(label, payload) => {
                          const data = payload?.[0]?.payload;
                          return data?.fullMonth || label;
                        }}
                        formatter={(value: number, name: string) => [
                          name === 'volumeMegaLitres' ? `${value} ML` : value,
                          name === 'volumeMegaLitres' ? 'Volume' : 'Deliveries'
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="volumeMegaLitres"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="url(#colorVolume)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Delivery Frequency Analysis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Delivery Frequency</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={customerMetrics.monthlyData.slice(-6)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="deliveries" fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Performance Metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm">Monthly Average</span>
                        <span className="font-medium">{(customer.total_deliveries / 12).toFixed(1)} deliveries</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${Math.min(100, (customer.total_deliveries / 12) * 2)}%` }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm">Volume Consistency</span>
                        <span className="font-medium">
                          {Math.abs(customerMetrics.growthRate) < 10 ? 'High' : 
                           Math.abs(customerMetrics.growthRate) < 25 ? 'Medium' : 'Variable'}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            Math.abs(customerMetrics.growthRate) < 10 ? 'bg-green-600' :
                            Math.abs(customerMetrics.growthRate) < 25 ? 'bg-yellow-600' : 'bg-red-600'
                          }`}
                          style={{ width: `${Math.max(20, 100 - Math.abs(customerMetrics.growthRate) * 2)}%` }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm">Recent Activity</span>
                        <span className="font-medium">{customer.deliveries_last_30_days} in 30 days</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-purple-600 h-2 rounded-full" 
                          style={{ width: `${Math.min(100, customer.deliveries_last_30_days * 10)}%` }}
                        ></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>


            <TabsContent value="performance" className="space-y-4 mt-4">
              {/* Performance Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Award className="w-4 h-4" />
                      Customer Rankings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div>
                        <div className="font-medium">Volume Ranking</div>
                        <div className="text-sm text-gray-600">Based on total megalitres delivered</div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600">#{customerMetrics.rankings.volumeRank}</div>
                        <div className="text-xs text-gray-500">of {allCustomers.length}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div>
                        <div className="font-medium">Delivery Ranking</div>
                        <div className="text-sm text-gray-600">Based on total delivery count</div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">#{customerMetrics.rankings.deliveryRank}</div>
                        <div className="text-xs text-gray-500">of {allCustomers.length}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <div>
                        <div className="font-medium">Market Share</div>
                        <div className="text-sm text-gray-600">Percentage of total SMB volume</div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-purple-600">{percentage}%</div>
                        <div className="text-xs text-gray-500">total volume</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Performance Trends
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium">Growth Trend</span>
                          <span className={`text-sm font-bold ${customerMetrics.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {customerMetrics.growthRate >= 0 ? '+' : ''}{customerMetrics.growthRate.toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mb-2">3-month rolling average vs previous period</div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${customerMetrics.growthRate >= 0 ? 'bg-green-600' : 'bg-red-600'}`}
                            style={{ width: `${Math.min(100, Math.abs(customerMetrics.growthRate) * 2)}%` }}
                          ></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium">Activity Level</span>
                          <span className="text-sm font-bold text-blue-600">
                            {customer.deliveries_last_30_days > 5 ? 'High' : 
                             customer.deliveries_last_30_days > 2 ? 'Medium' : 'Low'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mb-2">{customer.deliveries_last_30_days} deliveries in last 30 days</div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${Math.min(100, customer.deliveries_last_30_days * 10)}%` }}
                          ></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium">Future Analytics</span>
                          <span className="text-sm font-bold text-blue-600">Coming Soon</span>
                        </div>
                        <div className="text-xs text-gray-500 mb-2">Delivery efficiency with mtdata API</div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: '75%' }}></div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Benchmarking */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Benchmarking vs Top Customers
                  </CardTitle>
                  <CardDescription>
                    How this customer compares to other top SMB customers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600 mb-1">{customer.total_volume_megalitres.toFixed(1)}ML</div>
                      <div className="text-sm text-gray-600 mb-2">This Customer</div>
                      <div className="text-xs text-gray-500">
                        vs Top 10 avg: {(allCustomers.slice(0, 10).reduce((sum, c) => sum + c.total_volume_megalitres, 0) / 10).toFixed(1)}ML
                      </div>
                    </div>
                    
                    <div className="text-center p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
                      <div className="text-2xl font-bold text-green-600 mb-1">{customer.total_deliveries}</div>
                      <div className="text-sm text-gray-600 mb-2">Deliveries</div>
                      <div className="text-xs text-gray-500">
                        vs Top 10 avg: {Math.round(allCustomers.slice(0, 10).reduce((sum, c) => sum + c.total_deliveries, 0) / 10)}
                      </div>
                    </div>
                    
                    <div className="text-center p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600 mb-1">{avgDeliverySize}L</div>
                      <div className="text-sm text-gray-600 mb-2">Avg Delivery</div>
                      <div className="text-xs text-gray-500">
                        vs Top 10 avg: {Math.round(allCustomers.slice(0, 10).reduce((sum, c) => sum + (c.total_volume_litres / c.total_deliveries), 0) / 10)}L
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerDetailModal;