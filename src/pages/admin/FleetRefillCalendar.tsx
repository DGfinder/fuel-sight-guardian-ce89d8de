import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefillCalendar } from '@/components/calendar/RefillCalendar';
import { TankRunwayBar } from '@/components/calendar/TankRunwayBar';
import { WeekSummaryCard } from '@/components/calendar/WeekSummaryCard';
import { useFleetRefillCalendar, getUniqueCustomers } from '@/hooks/useRefillCalendar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  calculateUrgencySummary,
  sortByUrgency,
  RefillPrediction,
  UrgencyLevel,
} from '@/lib/urgency-calculator';
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  HelpCircle,
  Search,
  Download,
  CalendarDays,
  LayoutGrid,
  List,
  Users,
  Fuel,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewMode = 'calendar' | 'timeline' | 'customer';

export default function FleetRefillCalendar() {
  const { data: predictions, isLoading } = useFleetRefillCalendar();
  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyLevel | 'all'>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');

  // Get unique customers for filter
  const customers = useMemo(() => {
    return getUniqueCustomers(predictions || []);
  }, [predictions]);

  // Apply filters
  const filteredPredictions = useMemo(() => {
    let result = predictions || [];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.tankName.toLowerCase().includes(query) ||
          p.customerName.toLowerCase().includes(query) ||
          p.address.toLowerCase().includes(query)
      );
    }

    // Urgency filter
    if (urgencyFilter !== 'all') {
      result = result.filter((p) => p.urgency === urgencyFilter);
    }

    // Customer filter
    if (customerFilter !== 'all') {
      result = result.filter((p) => p.customerName === customerFilter);
    }

    return result;
  }, [predictions, searchQuery, urgencyFilter, customerFilter]);

  const summary = calculateUrgencySummary(filteredPredictions);
  const sortedPredictions = sortByUrgency(filteredPredictions);

  // Group by customer for customer view
  const customerGroups = useMemo(() => {
    const groups = new Map<string, RefillPrediction[]>();
    sortedPredictions.forEach((tank) => {
      if (!groups.has(tank.customerName)) {
        groups.set(tank.customerName, []);
      }
      groups.get(tank.customerName)!.push(tank);
    });
    // Sort groups by most urgent tank in each group
    return Array.from(groups.entries()).sort((a, b) => {
      const aUrgent = a[1].some((t) => t.urgency === 'critical');
      const bUrgent = b[1].some((t) => t.urgency === 'critical');
      if (aUrgent && !bUrgent) return -1;
      if (!aUrgent && bUrgent) return 1;
      return a[0].localeCompare(b[0]);
    });
  }, [sortedPredictions]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Tank', 'Customer', 'Address', 'Level %', 'Days Remaining', 'Urgency', 'Predicted Date'];
    const rows = sortedPredictions.map((p) => [
      p.tankName,
      p.customerName,
      p.address,
      p.currentLevel.toFixed(1),
      p.daysRemaining?.toFixed(0) || 'N/A',
      p.urgency,
      p.predictedRefillDate?.toLocaleDateString() || 'N/A',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `refill-calendar-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export to iCal format
  const handleExportICal = () => {
    const events = sortedPredictions
      .filter((p) => p.predictedRefillDate)
      .map((p) => {
        const date = p.predictedRefillDate!;
        const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
        const urgencyLabel = p.urgency === 'critical' ? '[CRITICAL] ' : p.urgency === 'warning' ? '[WARNING] ' : '';

        return [
          'BEGIN:VEVENT',
          `DTSTART;VALUE=DATE:${dateStr}`,
          `DTEND;VALUE=DATE:${dateStr}`,
          `SUMMARY:${urgencyLabel}Refill: ${p.tankName}`,
          `DESCRIPTION:Tank: ${p.tankName}\\nCustomer: ${p.customerName}\\nCurrent Level: ${p.currentLevel.toFixed(1)}%\\nDays Remaining: ${p.daysRemaining?.toFixed(0) || 'N/A'}\\nAddress: ${p.address}`,
          `LOCATION:${p.address}`,
          `UID:${p.tankId}-${dateStr}@tankalert`,
          `STATUS:CONFIRMED`,
          'END:VEVENT',
        ].join('\r\n');
      });

    const ical = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//TankAlert//Refill Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:TankAlert Refill Calendar',
      ...events,
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([ical], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `refill-calendar-${new Date().toISOString().split('T')[0]}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CalendarDays className="h-6 w-6" />
            AgBot Refill Calendar
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Predicted refill dates for all AgBot monitored tanks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportCSV} className="gap-2">
            <Download size={16} />
            CSV
          </Button>
          <Button variant="outline" onClick={handleExportICal} className="gap-2">
            <CalendarDays size={16} />
            iCal
          </Button>
        </div>
      </div>

      {/* This Week Summary */}
      <WeekSummaryCard
        predictions={filteredPredictions}
        onExportCSV={handleExportCSV}
        onExportICal={handleExportICal}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <SummaryCard
          title="Total Tanks"
          count={summary.total}
          icon={CalendarDays}
          color="blue"
        />
        <SummaryCard
          title="Critical"
          count={summary.critical}
          description="< 3 days"
          icon={AlertTriangle}
          color="red"
          onClick={() => setUrgencyFilter(urgencyFilter === 'critical' ? 'all' : 'critical')}
          active={urgencyFilter === 'critical'}
        />
        <SummaryCard
          title="Warning"
          count={summary.warning}
          description="3-7 days"
          icon={Clock}
          color="yellow"
          onClick={() => setUrgencyFilter(urgencyFilter === 'warning' ? 'all' : 'warning')}
          active={urgencyFilter === 'warning'}
        />
        <SummaryCard
          title="Normal"
          count={summary.normal}
          description="7+ days"
          icon={CheckCircle}
          color="green"
          onClick={() => setUrgencyFilter(urgencyFilter === 'normal' ? 'all' : 'normal')}
          active={urgencyFilter === 'normal'}
        />
        <SummaryCard
          title="Unknown"
          count={summary.unknown}
          description="No data"
          icon={HelpCircle}
          color="gray"
          onClick={() => setUrgencyFilter(urgencyFilter === 'unknown' ? 'all' : 'unknown')}
          active={urgencyFilter === 'unknown'}
        />
      </div>

      {/* Filters & View Toggle */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search tanks, customers, addresses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Customer Filter */}
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer} value={customer}>
                    {customer}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Urgency Filter */}
            <Select
              value={urgencyFilter}
              onValueChange={(v) => setUrgencyFilter(v as UrgencyLevel | 'all')}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Urgency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Urgency</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear Filters */}
            {(searchQuery || urgencyFilter !== 'all' || customerFilter !== 'all') && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearchQuery('');
                  setUrgencyFilter('all');
                  setCustomerFilter('all');
                }}
              >
                Clear Filters
              </Button>
            )}

            {/* View Toggle */}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="ml-auto">
              <TabsList>
                <TabsTrigger value="calendar" className="gap-1">
                  <LayoutGrid className="h-4 w-4" />
                  <span className="hidden sm:inline">Calendar</span>
                </TabsTrigger>
                <TabsTrigger value="timeline" className="gap-1">
                  <List className="h-4 w-4" />
                  <span className="hidden sm:inline">Timeline</span>
                </TabsTrigger>
                <TabsTrigger value="customer" className="gap-1">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">By Customer</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Main Content - View Specific */}
      {viewMode === 'calendar' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <RefillCalendar
              predictions={filteredPredictions}
              showCustomerName={true}
            />
          </div>

          {/* Tank List with Runway Bars */}
          <div>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>All Tanks</span>
                  <Badge variant="outline">{filteredPredictions.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  {sortedPredictions.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No tanks match filters</p>
                  ) : (
                    sortedPredictions.map((tank) => (
                      <TankRunwayBar key={tank.tankId} tank={tank} maxDays={30} />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {viewMode === 'timeline' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">30-Day Refill Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sortedPredictions.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No tanks match filters</p>
              ) : (
                sortedPredictions.map((tank) => (
                  <TankRunwayBar key={tank.tankId} tank={tank} maxDays={30} />
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {viewMode === 'customer' && (
        <div className="space-y-6">
          {customerGroups.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-gray-500 text-center">No tanks match filters</p>
              </CardContent>
            </Card>
          ) : (
            customerGroups.map(([customerName, tanks]) => (
              <Card key={customerName}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-gray-400" />
                      {customerName}
                    </div>
                    <div className="flex items-center gap-2">
                      {tanks.some((t) => t.urgency === 'critical') && (
                        <Badge variant="destructive" className="text-xs">
                          {tanks.filter((t) => t.urgency === 'critical').length} Critical
                        </Badge>
                      )}
                      {tanks.some((t) => t.urgency === 'warning') && (
                        <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-700 border-yellow-300">
                          {tanks.filter((t) => t.urgency === 'warning').length} Warning
                        </Badge>
                      )}
                      <Badge variant="outline">{tanks.length} tanks</Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {tanks.map((tank) => (
                      <TankRunwayBar key={tank.tankId} tank={tank} maxDays={30} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  count,
  description,
  icon: Icon,
  color,
  onClick,
  active,
}: {
  title: string;
  count: number;
  description?: string;
  icon: React.ElementType;
  color: 'red' | 'yellow' | 'green' | 'gray' | 'blue';
  onClick?: () => void;
  active?: boolean;
}) {
  const colorClasses = {
    red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
    yellow: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    gray: 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
  };

  return (
    <Card
      className={cn(
        onClick && 'cursor-pointer hover:shadow-md transition-shadow',
        active && 'ring-2 ring-offset-2 ring-primary'
      )}
      onClick={onClick}
    >
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-bold mt-1">{count}</p>
            {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
          </div>
          <div className={cn('p-2 rounded-lg', colorClasses[color])}>
            <Icon size={20} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
