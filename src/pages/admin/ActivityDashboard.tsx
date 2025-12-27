import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Activity,
  Search,
  Download,
  RefreshCw,
  User,
  LogIn,
  LogOut,
  Key,
  Truck,
  Fuel,
  Settings,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow, subHours, subDays } from 'date-fns';
import { useActivityLogs, useActivitySummary } from '@/hooks/useActivityLog';
import {
  formatActionType,
  formatCategory,
  getCategoryColor,
  downloadCSV,
  type ActivityLogEntry,
  type ActionCategory,
} from '@/lib/activityLogger';

// Time range options
const TIME_RANGES = [
  { value: '24h', label: 'Last 24 hours', hours: 24 },
  { value: '7d', label: 'Last 7 days', hours: 168 },
  { value: '30d', label: 'Last 30 days', hours: 720 },
  { value: 'all', label: 'All time', hours: null },
];

// Category options
const CATEGORY_OPTIONS: { value: ActionCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All Categories' },
  { value: 'auth', label: 'Authentication' },
  { value: 'customer', label: 'Customer' },
  { value: 'tank', label: 'Tank Access' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'settings', label: 'Settings' },
];

// Get icon for action type
function getActionIcon(actionType: string, category: string) {
  if (category === 'auth') {
    if (actionType.includes('login')) return LogIn;
    if (actionType.includes('logout')) return LogOut;
    if (actionType.includes('password')) return Key;
    return User;
  }
  if (category === 'customer') return User;
  if (category === 'tank') return Fuel;
  if (category === 'delivery') return Truck;
  if (category === 'settings') return Settings;
  return Activity;
}

// Get badge variant for category
function getCategoryBadgeClass(category: string) {
  const colors: Record<string, string> = {
    auth: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    customer: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    tank: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    delivery: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    settings: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  };
  return colors[category] || colors.settings;
}

export default function ActivityDashboard() {
  // Filters
  const [timeRange, setTimeRange] = useState('24h');
  const [category, setCategory] = useState<ActionCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 25;

  // Detail dialog
  const [selectedLog, setSelectedLog] = useState<ActivityLogEntry | null>(null);

  // Calculate date range
  const startDate = useMemo(() => {
    const range = TIME_RANGES.find(r => r.value === timeRange);
    if (!range?.hours) return undefined;
    return subHours(new Date(), range.hours);
  }, [timeRange]);

  // Fetch activity logs
  const { data: logs = [], isLoading, refetch, isFetching } = useActivityLogs({
    category: category === 'all' ? undefined : category,
    start_date: startDate,
    limit: 500, // Get more for client-side filtering
  });

  // Fetch summary stats
  const { data: summary = [] } = useActivitySummary(
    TIME_RANGES.find(r => r.value === timeRange)?.hours || 24
  );

  // Filter logs by search query
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const query = searchQuery.toLowerCase();
    return logs.filter(log =>
      log.user_email?.toLowerCase().includes(query) ||
      log.action_type.toLowerCase().includes(query) ||
      log.resource_id?.toLowerCase().includes(query)
    );
  }, [logs, searchQuery]);

  // Paginate
  const paginatedLogs = useMemo(() => {
    const start = page * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, page, pageSize]);

  const totalPages = Math.ceil(filteredLogs.length / pageSize);

  // Summary stats by category
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = { auth: 0, customer: 0, tank: 0, delivery: 0, settings: 0 };
    summary.forEach(s => {
      if (stats[s.category] !== undefined) {
        stats[s.category] += Number(s.count);
      }
    });
    return stats;
  }, [summary]);

  // Handle export
  const handleExport = () => {
    downloadCSV(filteredLogs, `activity-log-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Activity Log
          </h1>
          <p className="text-muted-foreground">
            Monitor user actions and system events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={filteredLogs.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <SummaryCard
          label="Auth Events"
          count={categoryStats.auth}
          icon={LogIn}
          color="blue"
        />
        <SummaryCard
          label="Customer"
          count={categoryStats.customer}
          icon={User}
          color="purple"
        />
        <SummaryCard
          label="Tank Access"
          count={categoryStats.tank}
          icon={Fuel}
          color="green"
        />
        <SummaryCard
          label="Delivery"
          count={categoryStats.delivery}
          icon={Truck}
          color="orange"
        />
        <SummaryCard
          label="Settings"
          count={categoryStats.settings}
          icon={Settings}
          color="gray"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Time range */}
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-full sm:w-48">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGES.map(range => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Category filter */}
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as ActionCategory | 'all')}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email, action, or resource ID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(0);
                }}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Activity ({filteredLogs.length} events)
          </CardTitle>
          <CardDescription>
            Click a row to see full details
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
              <p>No activity found for the selected filters</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLogs.map((log) => {
                    const Icon = getActionIcon(log.action_type, log.action_category);
                    return (
                      <TableRow
                        key={log.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedLog(log)}
                      >
                        <TableCell className="font-mono text-sm">
                          <div>{format(new Date(log.created_at), 'MMM d, HH:mm:ss')}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate max-w-[200px]">
                              {log.user_email || 'Anonymous'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getCategoryBadgeClass(log.action_category)}>
                            {formatCategory(log.action_category)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span>{formatActionType(log.action_type)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {log.resource_type && (
                            <span className="truncate max-w-[200px] block">
                              {log.resource_type}
                              {log.resource_id && `: ${log.resource_id.slice(0, 8)}...`}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, filteredLogs.length)} of {filteredLogs.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Page {page + 1} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activity Details
            </DialogTitle>
            <DialogDescription>
              Full details for this activity event
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <DetailItem label="Time" value={format(new Date(selectedLog.created_at), 'PPpp')} />
                <DetailItem label="User" value={selectedLog.user_email || 'Anonymous'} />
                <DetailItem label="Category" value={formatCategory(selectedLog.action_category)} />
                <DetailItem label="Action" value={formatActionType(selectedLog.action_type)} />
                <DetailItem label="Resource Type" value={selectedLog.resource_type || '-'} />
                <DetailItem label="Resource ID" value={selectedLog.resource_id || '-'} mono />
                <DetailItem label="User Agent" value={selectedLog.user_agent || '-'} className="col-span-2" />
              </div>

              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Details</p>
                  <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto max-h-64">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Summary card component
function SummaryCard({
  label,
  count,
  icon: Icon,
  color,
}: {
  label: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20',
    gray: 'bg-gray-50 text-gray-600 dark:bg-gray-800',
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', colorClasses[color])}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{count}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Detail item component
function DetailItem({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn('text-sm', mono && 'font-mono')}>{value}</p>
    </div>
  );
}
