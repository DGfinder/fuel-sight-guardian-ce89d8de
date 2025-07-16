import React, { useState, useMemo } from 'react';
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
  ChevronRight
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { useTankHistory, useTankRecorders, useTankReadingStats } from '@/hooks/useTankHistory';
import { Tank, DipReading } from '@/types/fuel';

interface EnhancedDipReadingsProps {
  tank: Tank;
}

interface FilterState {
  searchQuery: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  recordedBy: string;
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

export function EnhancedDipReadings({ tank }: EnhancedDipReadingsProps) {
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    dateFrom: undefined,
    dateTo: undefined,
    recordedBy: '',
    sortBy: 'created_at',
    sortOrder: 'desc',
    dateRange: '30d',
  });
  
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [showFilters, setShowFilters] = useState(false);

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

  // Fetch data with filters
  const dipHistoryQuery = useTankHistory({
    tankId: tank?.id,
    enabled: !!tank?.id,
    dateFrom,
    dateTo,
    searchQuery: filters.searchQuery || undefined,
    recordedBy: filters.recordedBy || undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    limit: pageSize,
    offset: currentPage * pageSize,
  });

  const recordersQuery = useTankRecorders(tank?.id);
  const statsQuery = useTankReadingStats(tank?.id, dateFrom, dateTo);

  const dipHistory = dipHistoryQuery.data?.readings || [];
  const totalCount = dipHistoryQuery.data?.totalCount || 0;
  const hasMore = dipHistoryQuery.data?.hasMore || false;
  const totalPages = Math.ceil(totalCount / pageSize);

  const updateFilter = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(0); // Reset to first page when filtering
  };

  const handleDateRangeChange = (range: string) => {
    if (range === 'custom') {
      setFilters(prev => ({ 
        ...prev, 
        dateRange: range as any,
        dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default to 30 days ago
        dateTo: new Date()
      }));
    } else {
      setFilters(prev => ({ 
        ...prev, 
        dateRange: range as any,
        dateFrom: undefined,
        dateTo: undefined
      }));
    }
    setCurrentPage(0);
  };

  const exportToCSV = () => {
    if (!dipHistory.length) return;
    
    const headers = ['Date', 'Time', 'Reading (L)', 'Capacity %', 'Recorded By', 'Notes'];
    const csvData = dipHistory.map(dip => [
      format(new Date(dip.created_at), 'yyyy-MM-dd'),
      format(new Date(dip.created_at), 'HH:mm:ss'),
      dip.value?.toString() || '',
      tank.safe_level ? Math.round((dip.value / tank.safe_level) * 100).toString() + '%' : '',
      dip.recorded_by || '',
      dip.notes || ''
    ]);
    
    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tank.location}-dip-readings-${format(new Date(), 'yyyy-MM-dd')}.csv`;
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

  return (
    <div className="space-y-4">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Previous Dip Readings</h3>
            <Badge variant="outline" className="text-xs">
              {totalCount.toLocaleString()} total
            </Badge>
          </div>
          
          {statsQuery.data && (
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span>Max: {statsQuery.data.max.toLocaleString()}L</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingDown className="w-4 h-4 text-red-600" />
                <span>Min: {statsQuery.data.min.toLocaleString()}L</span>
              </div>
              <div className="flex items-center gap-1">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                <span>Avg: {Math.round(statsQuery.data.average).toLocaleString()}L</span>
              </div>
            </div>
          )}
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

      {/* Filters Panel */}
      {showFilters && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                    <SelectItem value="">All recorders</SelectItem>
                    {recordersQuery.data?.map(recorder => (
                      <SelectItem key={recorder} value={recorder}>
                        {recorder}
                      </SelectItem>
                    ))}
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
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_80px_1fr_2fr_100px] gap-4 py-3 px-6 border rounded-lg bg-gray-50">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-12 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          ) : dipHistory.length > 0 ? (
            <div className="overflow-hidden">
              {/* Table Header - Fixed */}
              <div className="grid grid-cols-[1fr_1fr_80px_1fr_2fr_100px] gap-4 py-3 px-6 bg-gray-50 border-b text-sm font-medium text-gray-700 sticky top-0 z-10">
                <button
                  onClick={() => toggleSort('created_at')}
                  className="flex items-center gap-1 text-left hover:text-gray-900"
                >
                  Date
                  {getSortIcon('created_at')}
                </button>
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
              <div className="max-h-80 overflow-y-auto">
                <div className="divide-y">
                {dipHistory.map((dip, index) => (
                  <div key={dip.id || index} className="grid grid-cols-[1fr_1fr_80px_1fr_2fr_100px] gap-4 py-3 px-6 hover:bg-gray-50 transition-colors">
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
                        {dip.value?.toLocaleString() || 'N/A'} L
                      </div>
                    </div>
                    <div className="text-sm">
                      {tank.safe_level && (
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
                        {dip.value < (tank.min_level || 0) && (
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
                ))}
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
                No dip readings match your current filters. Try adjusting your search criteria.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}