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
  ArrowLeft
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
import { useTanks } from '@/hooks/useTanks';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useTankHistory, useTankRecorders, useTankReadingStats } from '@/hooks/useTankHistory';
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
  const [showFilters, setShowFilters] = useState(true);

  // Get group display name and API name
  const groupDisplayName = groupName ? GROUP_DISPLAY_NAMES[groupName as keyof typeof GROUP_DISPLAY_NAMES] : '';
  const groupApiName = groupName ? GROUP_API_NAMES[groupName as keyof typeof GROUP_API_NAMES] : '';

  // Filter tanks by group
  const groupTanks = useMemo(() => {
    if (!tanks || !groupApiName) return [];
    return tanks.filter(tank => tank.group_name === groupApiName);
  }, [tanks, groupApiName]);

  // Get first tank ID for initial data fetch (we'll improve this with group-wide query later)
  const selectedTankId = filters.tankId === 'all' ? groupTanks[0]?.id : filters.tankId;

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

  // Fetch data (using first tank for now - will be improved)
  const dipHistoryQuery = useTankHistory({
    tankId: selectedTankId || '',
    enabled: !!selectedTankId,
    dateFrom,
    dateTo,
    searchQuery: filters.searchQuery || undefined,
    recordedBy: filters.recordedBy === 'all' ? undefined : filters.recordedBy,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    limit: pageSize,
    offset: currentPage * pageSize,
  });

  const recordersQuery = useTankRecorders(selectedTankId || '');
  const statsQuery = useTankReadingStats(selectedTankId || '', dateFrom, dateTo);
  const analyticsQuery = useFuelAnalytics({
    tankId: selectedTankId || '',
    enabled: !!selectedTankId,
    analysisRange: 90 // Analyze last 90 days
  });

  const dipHistory = dipHistoryQuery.data?.readings || [];
  const totalCount = dipHistoryQuery.data?.totalCount || 0;
  const hasMore = dipHistoryQuery.data?.hasMore || false;
  const totalPages = Math.ceil(totalCount / pageSize);

  const updateFilter = (key: keyof FilterState, value: string | Date | undefined) => {
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
    
    const headers = ['Date', 'Time', 'Tank', 'Reading (L)', 'Capacity %', 'Recorded By', 'Notes'];
    const csvData = dipHistory.map(dip => {
      const tank = groupTanks.find(t => t.id === dip.tank_id);
      return [
        format(new Date(dip.created_at), 'yyyy-MM-dd'),
        format(new Date(dip.created_at), 'HH:mm:ss'),
        tank?.location || 'Unknown',
        dip.value?.toString() || '',
        tank?.safe_level ? Math.round((dip.value / tank.safe_level) * 100).toString() + '%' : '',
        dip.recorded_by || '',
        dip.notes || ''
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
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="w-4 h-4" />
            Filters
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

      {/* Redesigned Analytics Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Fuel Consumption Analytics */}
        {analyticsQuery.data && (
          <ExpandableCard
            title="Daily Consumption"
            value={`${Math.round(analyticsQuery.data.consumptionMetrics.dailyAverageConsumption)}L`}
            subtitle={
              <span className="flex items-center gap-1 text-xs">
                {analyticsQuery.data.consumptionMetrics.consumptionTrend === 'increasing' ? '📈' : 
                 analyticsQuery.data.consumptionMetrics.consumptionTrend === 'decreasing' ? '📉' : '→'} 
                {analyticsQuery.data.consumptionMetrics.consumptionTrend}
              </span>
            }
            icon={<TrendingDown className="w-4 h-4 text-orange-600" />}
            iconBg="bg-orange-100"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Weekly Average</p>
                  <p className="font-semibold">{Math.round(analyticsQuery.data.consumptionMetrics.weeklyAverageConsumption)}L</p>
                </div>
                <div>
                  <p className="text-gray-600">Monthly Average</p>
                  <p className="font-semibold">{Math.round(analyticsQuery.data.consumptionMetrics.monthlyAverageConsumption)}L</p>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Last 30 Days Total:</span>
                  <span className="font-medium">{Math.round(analyticsQuery.data.consumptionMetrics.totalConsumedLast30Days)}L</span>
                </div>
                {analyticsQuery.data.consumptionMetrics.peakConsumptionDay && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Peak Usage Day:</span>
                    <span className="font-medium">{format(new Date(analyticsQuery.data.consumptionMetrics.peakConsumptionDay), 'MMM d')}</span>
                  </div>
                )}
              </div>
            </div>
          </ExpandableCard>
        )}

        {/* Refuel Analytics with Recent Events */}
        {analyticsQuery.data && (
          <ExpandableCard
            title="Refuel Analytics"
            value={analyticsQuery.data.refuelAnalytics.totalRefuels}
            subtitle={
              analyticsQuery.data.refuelAnalytics.averageDaysBetweenRefuels > 0 
                ? `Every ${Math.round(analyticsQuery.data.refuelAnalytics.averageDaysBetweenRefuels)} days`
                : undefined
            }
            icon={<span className="text-green-600">⛽</span>}
            iconBg="bg-green-100"
          >
            <div className="space-y-4">
              {/* Refuel Stats */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Avg Volume</p>
                  <p className="font-semibold">{Math.round(analyticsQuery.data.refuelAnalytics.averageRefuelVolume)}L</p>
                </div>
                <div>
                  <p className="text-gray-600">Tank Efficiency</p>
                  <p className="font-semibold">{Math.round(analyticsQuery.data.refuelAnalytics.refuelEfficiency)}%</p>
                </div>
              </div>
              
              {/* Recent Refuel Events */}
              {analyticsQuery.data.refuelEvents.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Events</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {analyticsQuery.data.refuelEvents.slice(-4).reverse().map((refuel) => (
                      <div key={refuel.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                        <div>
                          <p className="font-medium">{format(new Date(refuel.date), 'MMM d')}</p>
                          <p className="text-gray-600">+{refuel.volumeAdded.toLocaleString()}L</p>
                        </div>
                        <div className="text-right text-gray-600">
                          {refuel.timeSinceLast && (
                            <p>{Math.round(refuel.timeSinceLast)}d ago</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ExpandableCard>
        )}

        {/* Tank Performance Overview */}
        <ExpandableCard
          title="Tank Performance"
          value={`${groupTanks.length} Tanks`}
          subtitle={`${totalCount.toLocaleString()} readings`}
          icon={<BarChart3 className="w-4 h-4 text-blue-600" />}
          iconBg="bg-blue-100"
        >
          <div className="space-y-4">
            {statsQuery.data && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Average Level</p>
                  <p className="font-semibold">{Math.round(statsQuery.data.average).toLocaleString()}L</p>
                </div>
                <div>
                  <p className="text-gray-600">Total Entries</p>
                  <p className="font-semibold">{statsQuery.data.count}</p>
                </div>
              </div>
            )}
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Active Tanks:</span>
                <span className="font-medium">{groupTanks.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Data Range:</span>
                <span className="font-medium">{filters.dateRange.replace('d', ' days').replace('m', ' months').replace('y', ' year')}</span>
              </div>
            </div>
          </div>
        </ExpandableCard>
      </div>

      {/* Combined Insights & Alerts */}
      {analyticsQuery.data && (analyticsQuery.data.insights.length > 0 || analyticsQuery.data.alerts.length > 0) && (
        <ExpandableCard
          title="Business Intelligence"
          value={`${analyticsQuery.data.insights.length + analyticsQuery.data.alerts.length}`}
          subtitle="insights & alerts"
          icon={<span className="text-purple-600">💡</span>}
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

      {/* Filters Panel */}
      {showFilters && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* Search */}
              <div className="space-y-2">
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

              {/* Tank Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Tank</label>
                <Select value={filters.tankId} onValueChange={(value) => updateFilter('tankId', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All tanks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tanks</SelectItem>
                    {groupTanks.map(tank => (
                      <SelectItem key={tank.id} value={tank.id}>
                        {tank.location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Date Range</label>
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

              {/* Custom Date Picker */}
              {filters.dateRange === 'custom' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">From Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <Calendar className="mr-2 h-4 w-4" />
                          {filters.dateFrom ? format(filters.dateFrom, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
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
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <Calendar className="mr-2 h-4 w-4" />
                          {filters.dateTo ? format(filters.dateTo, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
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
                      <SelectItem key={recorder} value={recorder}>
                        {recorder}
                      </SelectItem>
                    )) || []}
                    {recordersQuery.error && (
                      <SelectItem value="error" disabled>
                        Error loading recorders
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Table */}
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
                  <div key={i} className="grid grid-cols-[1fr_1fr_1fr_80px_1fr_2fr_100px] gap-4 py-3 px-6 border rounded-lg bg-gray-50">
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
              {/* Table Header - Fixed */}
              <div className="grid grid-cols-[1fr_1fr_1fr_80px_1fr_2fr_100px] gap-4 py-3 px-6 bg-gray-50 border-b text-sm font-medium text-gray-700 sticky top-0 z-10">
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
                <div>Notes</div>
                <div>Actions</div>
              </div>

              {/* Table Rows - Scrollable */}
              <div className="max-h-96 overflow-y-auto">
                <div className="divide-y">
                  {dipHistory.map((dip, index) => {
                    const tank = groupTanks.find(t => t.id === dip.tank_id);
                    return (
                      <div key={dip.id || index} className="grid grid-cols-[1fr_1fr_1fr_80px_1fr_2fr_100px] gap-4 py-3 px-6 hover:bg-gray-50 transition-colors">
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
                        </div>
                        <div className="text-sm">
                          <div className="font-medium">
                            {dip.value?.toLocaleString() || 'N/A'} L
                          </div>
                        </div>
                        <div className="text-sm">
                          {tank?.safe_level && (
                            <div className="font-medium">
                              {Math.round((dip.value / tank.safe_level) * 100)}%
                            </div>
                          )}
                        </div>
                        <div className="text-sm">
                          <div className="font-medium">
                            {dip.recorded_by || 'Unknown'}
                          </div>
                        </div>
                        <div className="text-sm">
                          {dip.notes ? (
                            <div className="truncate" title={dip.notes}>
                              {dip.notes}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                        <div className="text-sm">
                          <div className="flex items-center gap-1">
                            {index === 0 && (
                              <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                                Latest
                              </Badge>
                            )}
                            {tank && dip.value < (tank.min_level || 0) && (
                              <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                                Below Min
                              </Badge>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  <MoreHorizontal className="w-3 h-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>View Details</DropdownMenuItem>
                                <DropdownMenuItem>Edit Reading</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-600">
                    Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, totalCount)} of {totalCount.toLocaleString()} readings
                  </div>
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

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 0}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
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
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <BarChart3 className="w-12 h-12 text-gray-300 mb-3" />
              <h3 className="font-medium text-gray-600 mb-2">No Readings Found</h3>
              <p className="text-sm text-center">
                No dip readings found for this group with the current filters.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}