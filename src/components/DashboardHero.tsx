import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown,
  Truck, 
  Package, 
  Users,
  Calendar,
  BarChart3
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip,
  Area,
  AreaChart
} from 'recharts';

interface MonthlyData {
  month: string;
  volume_megalitres: number;
  total_deliveries: number;
  total_volume_litres: number;
}

interface DashboardHeroProps {
  carrier: 'GSF' | 'SMB';
  totalDeliveries: number;
  totalVolumeMegaLitres: number;
  totalVolumeLitres: number;
  uniqueCustomers: number;
  terminalCount: number;
  monthlyData: MonthlyData[];
  dateRange?: {
    startDate: string;
    endDate: string;
    monthsCovered: number;
  } | null;
  isFiltered: boolean;
  className?: string;
}

const DashboardHero: React.FC<DashboardHeroProps> = ({
  carrier,
  totalDeliveries,
  totalVolumeMegaLitres,
  totalVolumeLitres,
  uniqueCustomers,
  terminalCount,
  monthlyData,
  dateRange,
  isFiltered,
  className
}) => {
  const carrierColors = {
    GSF: {
      primary: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-200',
      accent: 'text-green-800'
    },
    SMB: {
      primary: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      accent: 'text-blue-800'
    }
  };

  const colors = carrierColors[carrier];

  // Calculate month-over-month change for trend indicator
  const calculateTrend = () => {
    if (!monthlyData || monthlyData.length < 2) return null;
    
    const lastMonth = monthlyData[monthlyData.length - 1];
    const previousMonth = monthlyData[monthlyData.length - 2];
    
    if (!lastMonth || !previousMonth) return null;
    
    const change = ((lastMonth.volume_megalitres - previousMonth.volume_megalitres) / previousMonth.volume_megalitres) * 100;
    
    return {
      percentage: Math.abs(change).toFixed(1),
      isPositive: change >= 0,
      isFlat: Math.abs(change) < 1
    };
  };

  const trend = calculateTrend();

  // Format monthly data for mini chart
  const chartData = monthlyData?.slice(-6).map(item => ({
    month: item.month,
    volume: item.volume_megalitres,
    deliveries: item.total_deliveries
  })) || [];

  const formatCarrierName = (carrier: string) => {
    return carrier === 'GSF' ? 'GSF (Great Southern Fuels)' : 'SMB (Stevemacs)';
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle className={`text-xl sm:text-2xl font-bold ${colors.accent} flex items-center gap-2 sm:gap-3`}>
              <Truck className={`w-6 h-6 sm:w-7 sm:h-7 ${colors.primary} flex-shrink-0`} />
              <span className="truncate">{formatCarrierName(carrier)} Dashboard</span>
            </CardTitle>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              {isFiltered ? 'Filtered period overview' : 'Complete operational overview'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <Badge variant="outline" className={`${colors.primary} ${colors.border} text-xs sm:text-sm`}>
              <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              {totalVolumeMegaLitres.toFixed(1)} ML Total
            </Badge>
            {trend && !trend.isFlat && (
              <Badge 
                variant={trend.isPositive ? "default" : "secondary"}
                className={`text-xs sm:text-sm ${trend.isPositive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
              >
                {trend.isPositive ? (
                  <TrendingUp className="w-3 h-3 mr-1" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-1" />
                )}
                {trend.percentage}% MoM
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Key Metrics */}
          <div className="xl:col-span-2 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Deliveries */}
            <div className={`p-3 sm:p-4 rounded-lg ${colors.bg} ${colors.border} border-2`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <Truck className={`w-4 h-4 sm:w-5 sm:h-5 ${colors.primary} flex-shrink-0`} />
                <div className="text-left sm:text-right">
                  <div className={`text-lg sm:text-2xl font-bold ${colors.accent}`}>
                    {totalDeliveries.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-600">Deliveries</div>
                </div>
              </div>
            </div>

            {/* Total Volume */}
            <div className="p-3 sm:p-4 rounded-lg bg-purple-50 border-2 border-purple-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <Package className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 flex-shrink-0" />
                <div className="text-left sm:text-right">
                  <div className="text-lg sm:text-2xl font-bold text-purple-800">
                    {totalVolumeMegaLitres.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-600">ML Volume</div>
                </div>
              </div>
            </div>

            {/* Unique Customers */}
            <div className="p-3 sm:p-4 rounded-lg bg-orange-50 border-2 border-orange-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 flex-shrink-0" />
                <div className="text-left sm:text-right">
                  <div className="text-lg sm:text-2xl font-bold text-orange-800">
                    {uniqueCustomers}
                  </div>
                  <div className="text-xs text-gray-600">Customers</div>
                </div>
              </div>
            </div>

            {/* Data Coverage */}
            <div className="p-3 sm:p-4 rounded-lg bg-gray-50 border-2 border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 flex-shrink-0" />
                <div className="text-left sm:text-right">
                  <div className="text-lg sm:text-2xl font-bold text-gray-800">
                    {dateRange ? `${dateRange.monthsCovered}` : '0'}
                  </div>
                  <div className="text-xs text-gray-600">Months</div>
                </div>
              </div>
            </div>
          </div>

          {/* Mini Volume Trend Chart */}
          <div className="xl:col-span-1">
            <div className="h-full min-h-[180px] sm:min-h-[160px]">
              <div className="mb-3">
                <h4 className="text-sm sm:text-base font-medium text-gray-700 mb-1">
                  Volume Trend (Last 6 Months)
                </h4>
                <p className="text-xs sm:text-sm text-gray-500">
                  {totalVolumeLitres.toLocaleString()} litres total
                </p>
              </div>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <defs>
                      <linearGradient id={`colorVolume${carrier}`} x1="0" y1="0" x2="0" y2="1">
                        <stop 
                          offset="5%" 
                          stopColor={carrier === 'GSF' ? '#10b981' : '#3b82f6'} 
                          stopOpacity={0.8}
                        />
                        <stop 
                          offset="95%" 
                          stopColor={carrier === 'GSF' ? '#10b981' : '#3b82f6'} 
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="month" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 9, fill: '#6b7280' }}
                      tickFormatter={(value) => String(value).slice(0, 3)}
                      interval="preserveStartEnd"
                    />
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{
                        background: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '11px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                      formatter={(value: number) => [`${value.toFixed(1)} ML`, 'Volume']}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="volume"
                      stroke={carrier === 'GSF' ? '#10b981' : '#3b82f6'}
                      strokeWidth={2}
                      fill={`url(#colorVolume${carrier})`}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[140px] text-gray-500 text-xs sm:text-sm">
                  No trend data available
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Additional Context Info */}
        {dateRange && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs sm:text-sm">
              <div className="text-gray-600">
                Data period: <span className="font-medium">{dateRange.startDate} - {dateRange.endDate}</span>
              </div>
              <div className="text-gray-600">
                Serving <span className="font-medium">{terminalCount} terminals</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DashboardHero;