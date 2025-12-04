import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Search,
  Filter,
  Download,
  Calendar,
  SortAsc,
  SortDesc,
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronRightIcon,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  Fuel,
  AlertCircle,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ExpandableCard, AnalyticsCard } from '@/components/ui/expandable-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTaTanksCompat as useTanks } from '@/hooks/useTaTanksCompat';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useTankHistory, useTankRecorders, useTankReadingStats, useGroupTankHistory, useGroupTankRecorders } from '@/hooks/useTankHistory';
import { useFuelAnalytics } from '@/hooks/useFuelAnalytics';
import { Tank, DipReading } from '@/types/fuel';

interface FilterState {
  searchQuery: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  recordedBy: string;
  tankId: string;
  sortBy: 'created_at' | 'value' | 'recorded_by';
  sortOrder: 'asc' | 'desc';
  dateRange: 'all' | '7d' | '30d' | '3m' | '6m' | '1y' | 'custom';
}

const DATE_RANGE_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '3m', label: 'Last 3 months' },
  { value: '6m', label: 'Last 6 months' },
  { value: '1y', label: 'Last year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom range' },
];

// Group name mapping for display
const GROUP_DISPLAY_NAMES = {
  'swan-transit': 'Swan Transit',
  'gsf-depots': 'GSF Depots',
  'kalgoorlie': 'Kalgoorlie',
  'geraldton': 'Geraldton',
  'bgc': 'BGC'
};

// Group name mapping for API calls
const GROUP_API_NAMES = {
  'swan-transit': 'Swan Transit',
  'gsf-depots': 'GSF Depots',
  'kalgoorlie': 'Kalgoorlie',
  'geraldton': 'Geraldton',
  'bgc': 'BGC'
};

export default function DipHistoryPage() {
  const { groupName } = useParams<{ groupName: string }>();
  const { data: permissions } = useUserPermissions();
  const { tanks } = useTanks();

  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    dateFrom: undefined,
    dateTo: undefined,
    recordedBy: 'all',
    tankId: 'all',
    sortBy: 'created_at',
    sortOrder: 'desc',
    dateRange: '30d',
  });

  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Get group display name and API name
  const groupDisplayName = groupName ? GROUP_DISPLAY_NAMES[groupName as keyof typeof GROUP_DISPLAY_NAMES] : '';
  const groupApiName = groupName ? GROUP_API_NAMES[groupName as keyof typeof GROUP_API_NAMES] : '';

  // Filter tanks by group and sort alphabetically
  const groupTanks = useMemo(() => {
    if (!tanks || !groupApiName) return [];
    return tanks
      .filter(tank => tank.group_name === groupApiName)
      .sort((a, b) => (a.location || '').localeCompare(b.location || ''));
  }, [tanks, groupApiName]);

  // Enhanced tank selection logic - supports both single tank and group-wide queries
  const selectedTankIds = useMemo(() => {
    if (filters.tankId === 'all') {
      return groupTanks.map(tank => tank.id);
    }
    return [filters.tankId];
  }, [filters.tankId, groupTanks]);

  // Calculate date range based on selection
  const { dateFrom, dateTo } = useMemo(() => {
    if (filters.dateRange === 'custom') {
      return { dateFrom: filters.dateFrom, dateTo: filters.dateTo };
    }
    if (filters.dateRange === 'all') {
      return { dateFrom: undefined, dateTo: undefined };
    }
    
    const now = new Date();
    const from = new Date();
    
    switch (filters.dateRange) {
      case '7d':
        from.setDate(now.getDate() - 7);
        break;
      case '30d':
        from.setDate(now.getDate() - 30);
        break;
      case '3m':
        from.setMonth(now.getMonth() - 3);
        break;
      case '6m':
        from.setMonth(now.getMonth() - 6);
        break;
      case '1y':
        from.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    return { dateFrom: from, dateTo: now };
  }, [filters.dateRange, filters.dateFrom, filters.dateTo]);

  // Enhanced data fetching - use group-wide hooks when "all tanks" is selected
  const singleTankQuery = useTankHistory({
    tankId: selectedTankIds[0] || '',
    enabled: selectedTankIds.length === 1,
    dateFrom,
    dateTo,
    searchQuery: filters.searchQuery || undefined,
    recordedBy: filters.recordedBy === 'all' ? undefined : filters.recordedBy,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    limit: pageSize,
    offset: currentPage * pageSize,
  });

  const groupTankQuery = useGroupTankHistory({
    tankIds: selectedTankIds,
    enabled: selectedTankIds.length > 1,
    dateFrom,
    dateTo,
    searchQuery: filters.searchQuery || undefined,
    recordedBy: filters.recordedBy === 'all' ? undefined : filters.recordedBy,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    limit: pageSize,
    offset: currentPage * pageSize,
  });

  // Use the appropriate query based on selection
  const dipHistoryQuery = filters.tankId === 'all' ? groupTankQuery : singleTankQuery;

  // Enhanced recorder queries
  const singleTankRecordersQuery = useTankRecorders(filters.tankId !== 'all' ? filters.tankId : '');
  const groupTankRecordersQuery = useGroupTankRecorders(filters.tankId === 'all' ? selectedTankIds : []);
  const recordersQuery = filters.tankId === 'all' ? groupTankRecordersQuery : singleTankRecordersQuery;

  const statsQuery = useTankReadingStats(selectedTankIds[0] || '', dateFrom, dateTo);

  // Enhanced analytics for group-wide insights
  const analyticsQuery = useFuelAnalytics({
    tankId: selectedTankIds[0] || '',
    enabled: selectedTankIds.length > 0,
    analysisRange: 90,
    dateFrom,
    dateTo
  });

  // Process data
  const dipHistory = useMemo(() => {
    return dipHistoryQuery.data?.readings || [];
  }, [dipHistoryQuery.data?.readings]);

  const totalCount = dipHistoryQuery.data?.totalCount || 0;
  const hasMore = dipHistoryQuery.data?.hasMore || false;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Enhanced group-wide statistics
  const groupStats = useMemo(() => {
    if (filters.tankId !== 'all') return null;
    
    const totalTanks = groupTanks.length;
    const criticalTanks = groupTanks.filter(tank => 
      tank.current_level_percent && tank.current_level_percent <= 10
    ).length;
    const belowMinTanks = groupTanks.filter(tank => 
      tank.current_level && tank.min_level && tank.current_level < tank.min_level
    ).length;
    
    return {
      totalTanks,
      criticalTanks,
      belowMinTanks,
      totalReadings: totalCount,
    };
  }, [groupTanks, filters.tankId, totalCount]);

  const updateFilter = (key: keyof FilterState, value: string | Date | undefined | boolean) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(0); // Reset to first page when filtering
  };

  const handleDateRangeChange = (range: string) => {
    if (range === 'custom') {
      setFilters(prev => ({ 
        ...prev, 
        dateRange: range as FilterState['dateRange'],
        dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default to 30 days ago
        dateTo: new Date()
      }));
    } else {
      setFilters(prev => ({ 
        ...prev, 
        dateRange: range as FilterState['dateRange'],
        dateFrom: undefined,
        dateTo: undefined
      }));
    }
    setCurrentPage(0);
  };

  const exportToCSV = () => {
    if (!dipHistory.length) return;
    
    const headers = ['Date', 'Time', 'Tank', 'Reading (L)', 'Capacity %', 'Status', 'Change from Previous', 'Recorded By'];
    const csvData = dipHistory.map(dip => {
      const tank = groupTanks.find(t => t.id === dip.tank_id);
      const capacityPercent = tank?.safe_level ? Math.round((dip.value / tank.safe_level) * 100) : 0;
      const status = tank?.min_level && dip.value < tank.min_level ? 'Below Minimum' : 
                    capacityPercent <= 10 ? 'Critical' : 
                    capacityPercent <= 20 ? 'Low' : 'Normal';
      
      return [
        format(new Date(dip.created_at), 'yyyy-MM-dd'),
        format(new Date(dip.created_at), 'HH:mm:ss'),
        tank?.location || 'Unknown',
        dip.value?.toString() || '',
        `${capacityPercent}%`,
        status,
        '', // Change from previous - would need calculation
        dip.recorded_by || ''
      ];
    });
    
    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${groupDisplayName}-dip-history-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (column: 'created_at' | 'value' | 'recorded_by') => {
    if (filters.sortBy === column) {
      updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      updateFilter('sortBy', column);
      updateFilter('sortOrder', 'desc');
    }
  };

  const getSortIcon = (column: 'created_at' | 'value' | 'recorded_by') => {
    if (filters.sortBy !== column) return null;
    return filters.sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />;
  };

  const getStatusBadge = (reading: DipReading) => {
    const tank = groupTanks.find(t => t.id === reading.tank_id);
    if (!tank) return null;
    
    const isMinLevel = tank.min_level && reading.value < tank.min_level;
    const capacityPercent = tank.safe_level ? (reading.value / tank.safe_level) * 100 : 0;
    
    if (isMinLevel) {
      return <Badge variant="destructive" className="text-xs">Below Min</Badge>;
    } else if (capacityPercent <= 10) {
      return <Badge variant="destructive" className="text-xs">Critical</Badge>;
    } else if (capacityPercent <= 20) {
      return <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">Low</Badge>;
    }
    return null;
  };

  // Permission check
  if (!permissions) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-sm text-gray-600">Loading permissions...</p>
        </div>
      </div>
    );
  }

  // Check if user has access to this group
  const hasGroupAccess = permissions.isAdmin || 
    permissions.accessibleGroups.some(g => g.name === groupApiName);

  if (!hasGroupAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">You don't have permission to view this group's dip history.</p>
          <Link to="/" className="text-blue-600 hover:text-blue-800">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!groupDisplayName) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Group Not Found</h2>
          <p className="text-gray-600 mb-4">The requested group could not be found.</p>
          <Link to="/" className="text-blue-600 hover:text-blue-800">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
      {/* Header with Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          {/* Breadcrumb */}
          <div className="flex items-center text-sm text-gray-600">
            <Link to="/" className="hover:text-gray-900">Dashboard</Link>
            <ChevronRightIcon className="w-4 h-4 mx-2" />
            <Link to={`/${groupName}`} className="hover:text-gray-900">{groupDisplayName}</Link>
            <ChevronRightIcon className="w-4 h-4 mx-2" />
            <span className="text-gray-900 font-medium">Dip History</span>
          </div>
          
          {/* Page Title */}
          <div className="flex items-center gap-4">
            <Link 
              to={`/${groupName}`}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{groupDisplayName} - Dip History</h1>
              <p className="text-gray-600">Complete history of fuel level readings</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="gap-2"
          >
            <Filter className="w-4 h-4" />
            Advanced Filters
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            disabled={!dipHistory.length}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* PRIMARY TANK SELECTION - Now prominently at the top */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Fuel className="w-5 h-5 text-blue-600" />
            Tank Selection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Select Tank</label>
              <Select value={filters.tankId} onValueChange={(value) => updateFilter('tankId', value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a tank" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tanks ({groupTanks.length})</SelectItem>
                  {groupTanks.map(tank => (
                    <SelectItem key={tank.id} value={tank.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{tank.location}</span>
                        {tank.current_level_percent && tank.current_level_percent <= 10 && (
                          <Badge variant="destructive" className="ml-2 text-xs">Critical</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Date Range</label>
              <Select value={filters.dateRange} onValueChange={handleDateRangeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Custom Date Range Pickers */}
          {filters.dateRange === 'custom' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">From Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal min-h-[40px]">
                      <Calendar className="mr-2 h-4 w-4" />
                      {filters.dateFrom ? format(filters.dateFrom, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-50">
                    <CalendarComponent
                      mode="single"
                      selected={filters.dateFrom}
                      onSelect={(date) => updateFilter('dateFrom', date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">To Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal min-h-[40px]">
                      <Calendar className="mr-2 h-4 w-4" />
                      {filters.dateTo ? format(filters.dateTo, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-50">
                    <CalendarComponent
                      mode="single"
                      selected={filters.dateTo}
                      onSelect={(date) => updateFilter('dateTo', date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

        </CardContent>
      </Card>

      {/* Enhanced Analytics Dashboard */}
      {analyticsQuery.data && filters.tankId !== 'all' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {/* 1. Refill Insights */}
          <ExpandableCard
            title="Refill Insights"
            value={analyticsQuery.data.refuelAnalytics.totalRefuels.toString()}
            subtitle={
              analyticsQuery.data.refuelAnalytics.nextPredictedRefuelDays !== null
                ? `Next in ${analyticsQuery.data.refuelAnalytics.nextPredictedRefuelDays} days`
                : undefined
            }
            icon="⛽"
            iconBg="bg-green-100"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Avg Volume</p>
                  <p className="font-semibold">{Math.round(analyticsQuery.data.refuelAnalytics.averageRefuelVolume).toLocaleString()}L</p>
                </div>
                <div>
                  <p className="text-gray-600">Avg Interval</p>
                  <p className="font-semibold">{Math.round(analyticsQuery.data.refuelAnalytics.averageDaysBetweenRefuels)} days</p>
                </div>
                <div>
                  <p className="text-gray-600">Days Since Last</p>
                  <p className="font-semibold">{analyticsQuery.data.refuelAnalytics.daysSinceLastRefuel} days</p>
                </div>
                <div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-gray-600 cursor-help">Efficiency</p>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Percentage of tank capacity typically filled during refuels</p>
                    </TooltipContent>
                  </Tooltip>
                  <p className="font-semibold">{Math.round(analyticsQuery.data.refuelAnalytics.refuelEfficiency)}%</p>
                </div>
              </div>
              
              {analyticsQuery.data.refuelEvents.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Events</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {analyticsQuery.data.refuelEvents.slice(-3).reverse().map((refuel) => (
                      <div key={refuel.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                        <div>
                          <p className="font-medium">{format(new Date(refuel.date), 'MMM d')}</p>
                          <p className="text-gray-600">+{refuel.volumeAdded.toLocaleString()}L</p>
                        </div>
                        <div className="text-right text-gray-600">
                          {refuel.timeSinceLast && (
                            <p>{Math.round(refuel.timeSinceLast)}d gap</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ExpandableCard>

          {/* 2. Consumption Analytics */}
          <ExpandableCard
            title="Consumption Analytics"
            value={`${Math.round(analyticsQuery.data.consumptionMetrics.dailyAverageConsumption).toLocaleString()}L`}
            subtitle={`${analyticsQuery.data.consumptionMetrics.consumptionTrend === 'increasing' ? '📈' : 
                        analyticsQuery.data.consumptionMetrics.consumptionTrend === 'decreasing' ? '📉' : '→'} ${analyticsQuery.data.consumptionMetrics.consumptionTrend}`}
            icon={<TrendingDown className="w-4 h-4 text-orange-600" />}
            iconBg="bg-orange-100"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Weekly Avg</p>
                  <p className="font-semibold">{Math.round(analyticsQuery.data.consumptionMetrics.weeklyAverageConsumption).toLocaleString()}L</p>
                </div>
                <div>
                  <p className="text-gray-600">Monthly Avg</p>
                  <p className="font-semibold">{Math.round(analyticsQuery.data.consumptionMetrics.monthlyAverageConsumption).toLocaleString()}L</p>
                </div>
                <div>
                  <p className="text-gray-600">Peak Day</p>
                  <p className="font-semibold">{Math.round(analyticsQuery.data.consumptionMetrics.peakConsumptionValue).toLocaleString()}L</p>
                </div>
                <div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-gray-600 cursor-help">Stability Score</p>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>How consistent daily usage is (100% = very stable, 0% = highly variable)</p>
                    </TooltipContent>
                  </Tooltip>
                  <p className="font-semibold">{Math.round(analyticsQuery.data.consumptionMetrics.consumptionStabilityScore)}%</p>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total in Period:</span>
                  <span className="font-medium">{Math.round(analyticsQuery.data.consumptionMetrics.totalConsumedInPeriod).toLocaleString()}L</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Last 30 Days:</span>
                  <span className="font-medium">{Math.round(analyticsQuery.data.consumptionMetrics.totalConsumedLast30Days).toLocaleString()}L</span>
                </div>
              </div>
            </div>
          </ExpandableCard>

          {/* 3. Tank Performance */}
          <ExpandableCard
            title="Tank Performance"
            value={`${Math.round(analyticsQuery.data.tankPerformance.averageFillPercentage)}%`}
            subtitle={`Score: ${Math.round(analyticsQuery.data.tankPerformance.operationalEfficiencyScore)}%`}
            icon={<BarChart3 className="w-4 h-4 text-blue-600" />}
            iconBg="bg-blue-100"
          >
            <div className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Critical Time (&lt;10%):</span>
                  <span className="font-medium">{Math.round(analyticsQuery.data.tankPerformance.timeInZones.critical)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Low Time (11-25%):</span>
                  <span className="font-medium">{Math.round(analyticsQuery.data.tankPerformance.timeInZones.low)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Normal Time (26-70%):</span>
                  <span className="font-medium">{Math.round(analyticsQuery.data.tankPerformance.timeInZones.normal)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">High Time (&gt;70%):</span>
                  <span className="font-medium">{Math.round(analyticsQuery.data.tankPerformance.timeInZones.high)}%</span>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-gray-600 cursor-help">Capacity Utilisation:</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Range between lowest and highest levels as % of useable capacity (above min level)</p>
                    </TooltipContent>
                  </Tooltip>
                  <span className="font-medium">{Math.round(analyticsQuery.data.tankPerformance.capacityUtilisationRate)}%</span>
                </div>
                {analyticsQuery.data.tankPerformance.daysSinceLastCritical !== null && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Days Since Critical:</span>
                    <span className="font-medium">{analyticsQuery.data.tankPerformance.daysSinceLastCritical}</span>
                  </div>
                )}
              </div>
            </div>
          </ExpandableCard>

          {/* 4. Operational Insights */}
          <ExpandableCard
            title="Operational Insights"
            value={Math.round(analyticsQuery.data.operationalInsights.complianceScore).toString()}
            subtitle="Compliance Score"
            icon={<Settings className="w-4 h-4 text-purple-600" />}
            iconBg="bg-purple-100"
          >
            <div className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Critical Events:</span>
                  <span className="font-medium">{analyticsQuery.data.operationalInsights.lowFuelEvents.criticalLevel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Below Min Events:</span>
                  <span className="font-medium">{analyticsQuery.data.operationalInsights.lowFuelEvents.belowMinLevel}</span>
                </div>
                <div className="flex justify-between">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-gray-600 cursor-help">Readings/Weekday:</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Average readings per weekday (Monday-Friday only)</p>
                    </TooltipContent>
                  </Tooltip>
                  <span className="font-medium">{analyticsQuery.data.operationalInsights.readingFrequency.averagePerDay.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-gray-600 cursor-help">Consistency:</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>How regular reading intervals are during weekdays (Monday-Friday only). 100% = very consistent timing</p>
                    </TooltipContent>
                  </Tooltip>
                  <span className="font-medium">{Math.round(analyticsQuery.data.operationalInsights.readingFrequency.consistencyScore)}%</span>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-gray-600 cursor-help">Data Quality:</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Overall data completeness and reading frequency score</p>
                    </TooltipContent>
                  </Tooltip>
                  <span className="font-medium">{Math.round(analyticsQuery.data.operationalInsights.dataQuality.completenessScore)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Anomalies:</span>
                  <span className="font-medium">{analyticsQuery.data.operationalInsights.dataQuality.anomalyCount}</span>
                </div>
              </div>
            </div>
          </ExpandableCard>
        </div>
      ) : (
        // Group view - simplified metrics
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <AnalyticsCard
            title="Total Readings"
            value={totalCount.toLocaleString()}
            icon={<BarChart3 className="w-5 h-5 text-blue-600" />}
            details={<p className="text-xs text-gray-500">From all tanks in {groupDisplayName}</p>}
          />
          
          {groupStats && (
            <>
              <AnalyticsCard
                title="Critical Tanks"
                value={groupStats.criticalTanks.toString()}
                icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
                trend={groupStats.criticalTanks > 0 ? 'Needs attention' : undefined}
                trendIcon={groupStats.criticalTanks > 0 ? <AlertTriangle className="w-3 h-3 text-red-500" /> : undefined}
                details={<p className="text-xs text-gray-500">Out of {groupStats.totalTanks} tanks</p>}
              />
              
              <AnalyticsCard
                title="Active Tanks"
                value={(groupStats.totalTanks - groupStats.criticalTanks).toString()}
                icon={<CheckCircle className="w-5 h-5 text-green-600" />}
                details={<p className="text-xs text-gray-500">Tanks with normal levels</p>}
              />
              
              <AnalyticsCard
                title="Group Health"
                value={`${Math.round(((groupStats.totalTanks - groupStats.criticalTanks) / groupStats.totalTanks) * 100)}%`}
                icon={<Activity className="w-5 h-5 text-blue-600" />}
                details={<p className="text-xs text-gray-500">Overall tank health score</p>}
              />
            </>
          )}
        </div>
      )}

      {/* Business Intelligence & Insights */}
      {analyticsQuery.data && filters.tankId !== 'all' && (analyticsQuery.data.insights.length > 0 || analyticsQuery.data.alerts.length > 0) && (
        <ExpandableCard
          title="Business Intelligence"
          value={`${analyticsQuery.data.insights.length + analyticsQuery.data.alerts.length}`}
          subtitle="insights & alerts"
          icon="💡"
          iconBg="bg-purple-100"
          defaultExpanded={analyticsQuery.data.alerts.length > 0} // Auto-expand if there are alerts
        >
          <div className="space-y-6">
            {/* Alerts Section */}
            {analyticsQuery.data.alerts.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-orange-700 mb-3 flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-orange-100 flex items-center justify-center text-xs">⚠️</span>
                  Action Required ({analyticsQuery.data.alerts.length})
                </h4>
                <ul className="space-y-2">
                  {analyticsQuery.data.alerts.map((alert, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm p-2 bg-orange-50 rounded">
                      <span className="text-orange-600 mt-0.5">•</span>
                      <span className="text-orange-800">{alert}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Insights Section */}
            {analyticsQuery.data.insights.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-blue-700 mb-3 flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center text-xs">💡</span>
                  Key Insights ({analyticsQuery.data.insights.length})
                </h4>
                <ul className="space-y-2">
                  {analyticsQuery.data.insights.map((insight, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm p-2 bg-blue-50 rounded">
                      <span className="text-blue-600 mt-0.5">•</span>
                      <span className="text-blue-800">{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </ExpandableCard>
      )}

      {/* Advanced Filters Panel - Better mobile layout */}
      {showAdvancedFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Advanced Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                <label className="text-sm font-medium">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search notes or recorder..."
                    value={filters.searchQuery}
                    onChange={(e) => updateFilter('searchQuery', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Recorded By Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Recorded By</label>
                <Select value={filters.recordedBy} onValueChange={(value) => updateFilter('recordedBy', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All recorders" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All recorders</SelectItem>
                    {recordersQuery.data?.map(recorder => (
                      <SelectItem key={recorder.id} value={recorder.fullName}>
                        {recorder.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Date Range - Full width on mobile */}
              {filters.dateRange === 'custom' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">From Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal min-h-[40px]">
                          <Calendar className="mr-2 h-4 w-4" />
                          {filters.dateFrom ? format(filters.dateFrom, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-50">
                        <CalendarComponent
                          mode="single"
                          selected={filters.dateFrom}
                          onSelect={(date) => updateFilter('dateFrom', date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">To Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal min-h-[40px]">
                          <Calendar className="mr-2 h-4 w-4" />
                          {filters.dateTo ? format(filters.dateTo, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-50">
                        <CalendarComponent
                          mode="single"
                          selected={filters.dateTo}
                          onSelect={(date) => updateFilter('dateTo', date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Data Table - Mobile-responsive */}
      <Card>
        <CardContent className="p-0">
          {dipHistoryQuery.isLoading ? (
            <div className="space-y-4 p-6">
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                  <p className="text-sm text-gray-600">Loading dip readings...</p>
                </div>
              </div>
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_1fr_80px_1fr_120px_100px] gap-4 py-3 px-6 border rounded-lg bg-gray-50">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-12 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          ) : dipHistoryQuery.error ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <BarChart3 className="w-12 h-12 text-gray-300 mb-3" />
              <h3 className="font-medium text-gray-600 mb-2">Unable to Load Readings</h3>
              <p className="text-sm text-center mb-4">
                There was an error loading the dip readings data.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => dipHistoryQuery.refetch()}
              >
                Try Again
              </Button>
            </div>
          ) : dipHistory.length > 0 ? (
            <div className="overflow-hidden">
              {/* Mobile-friendly table - Hide on small screens, show cards instead */}
              <div className="hidden md:block">
                {/* Enhanced Table Header */}
                <div className="grid grid-cols-[1fr_1fr_1fr_80px_1fr_120px_100px] gap-4 py-3 px-6 bg-gray-50 border-b text-sm font-medium text-gray-700 sticky top-0 z-10">
                  <button
                    onClick={() => toggleSort('created_at')}
                    className="flex items-center gap-1 text-left hover:text-gray-900"
                  >
                    Date
                    {getSortIcon('created_at')}
                  </button>
                  <div>Tank</div>
                  <button
                    onClick={() => toggleSort('value')}
                    className="flex items-center gap-1 text-left hover:text-gray-900"
                  >
                    Reading (L)
                    {getSortIcon('value')}
                  </button>
                  <div>Capacity</div>
                  <button
                    onClick={() => toggleSort('recorded_by')}
                    className="flex items-center gap-1 text-left hover:text-gray-900"
                  >
                    Recorded By
                    {getSortIcon('recorded_by')}
                  </button>
                  <div>Status & Alerts</div>
                  <div>Actions</div>
                </div>

                {/* Enhanced Table Rows */}
                <div className="max-h-96 overflow-y-auto">
                  <div className="divide-y">
                    {dipHistory.map((dip, index) => {
                      const tank = groupTanks.find(t => t.id === dip.tank_id);
                      const capacityPercent = tank?.safe_level ? Math.round((dip.value / tank.safe_level) * 100) : 0;
                      const statusBadge = getStatusBadge(dip);
                      
                      return (
                        <div key={dip.id || index} className="grid grid-cols-[1fr_1fr_1fr_80px_1fr_120px_100px] gap-4 py-3 px-6 hover:bg-gray-50 transition-colors">
                          <div className="text-sm">
                            <div className="font-medium">
                              {format(new Date(dip.created_at), 'MMM d, yyyy')}
                            </div>
                            <div className="text-xs text-gray-500">
                              {format(new Date(dip.created_at), 'h:mm a')}
                            </div>
                          </div>
                          <div className="text-sm">
                            <div className="font-medium">
                              {tank?.location || 'Unknown Tank'}
                            </div>
                            {filters.tankId === 'all' && (
                              <div className="text-xs text-gray-500">
                                {tank?.group_name}
                              </div>
                            )}
                          </div>
                          <div className="text-sm">
                            <div className="font-medium">
                              {dip.value?.toLocaleString() || 'N/A'} L
                            </div>
                          </div>
                          <div className="text-sm">
                            {tank?.safe_level && (
                              <div className="font-medium">
                                {capacityPercent}%
                              </div>
                            )}
                          </div>
                          <div className="text-sm">
                            <div className="font-medium">
                              {dip.recorded_by || 'Unknown'}
                            </div>
                          </div>
                          <div className="text-sm">
                            <div className="flex items-center gap-1">
                              {index === 0 && (
                                <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                                  Latest
                                </Badge>
                              )}
                              {statusBadge}
                            </div>
                          </div>
                          <div className="text-sm">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  <MoreHorizontal className="w-3 h-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>View Details</DropdownMenuItem>
                                <DropdownMenuItem>Edit Reading</DropdownMenuItem>
                                <DropdownMenuItem>View Tank</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden">
                <div className="divide-y">
                  {dipHistory.map((dip, index) => {
                    const tank = groupTanks.find(t => t.id === dip.tank_id);
                    const capacityPercent = tank?.safe_level ? Math.round((dip.value / tank.safe_level) * 100) : 0;
                    const statusBadge = getStatusBadge(dip);
                    
                    return (
                      <div key={dip.id || index} className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-sm">
                              {format(new Date(dip.created_at), 'MMM d, yyyy')}
                            </div>
                            <div className="text-xs text-gray-500">
                              {format(new Date(dip.created_at), 'h:mm a')}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {index === 0 && (
                              <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                                Latest
                              </Badge>
                            )}
                            {statusBadge}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-xs text-gray-500">Tank</div>
                            <div className="font-medium">{tank?.location || 'Unknown Tank'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Reading</div>
                            <div className="font-medium">{dip.value?.toLocaleString() || 'N/A'} L</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Capacity</div>
                            <div className="font-medium">{capacityPercent}%</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Recorded By</div>
                            <div className="font-medium">{dip.recorded_by || 'Unknown'}</div>
                          </div>
                        </div>
                        
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>View Details</DropdownMenuItem>
                              <DropdownMenuItem>Edit Reading</DropdownMenuItem>
                              <DropdownMenuItem>View Tank</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Enhanced Pagination - Mobile-responsive */}
              <div className="flex flex-col sm:flex-row items-center justify-between px-4 sm:px-6 py-4 border-t bg-gray-50 gap-4">
                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
                  <div className="text-sm text-gray-600 text-center sm:text-left">
                    Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, totalCount)} of {totalCount.toLocaleString()} readings
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Show:</span>
                    <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(Number(value))}>
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 0}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {currentPage + 1} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage >= totalPages - 1}
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <BarChart3 className="w-12 h-12 text-gray-300 mb-3" />
              <h3 className="font-medium text-gray-600 mb-2">No Readings Found</h3>
              <p className="text-sm text-center px-4">
                No dip readings found for the selected criteria.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </TooltipProvider>
  );
}