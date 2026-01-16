import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefillCalendar } from '@/components/calendar/RefillCalendar';
import { useTaTanksCompat } from '@/hooks/useTaTanksCompat';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  calculateUrgencySummary,
  sortByUrgency,
  RefillPrediction,
  UrgencyLevel,
  calculateUrgencyWithFallback,
  determineConfidence,
  calculatePredictedRefillDate,
} from '@/lib/urgency-calculator';
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  HelpCircle,
  Search,
  Download,
  CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AppLayout from '@/components/AppLayout';

interface GroupRefillScheduleProps {
  groupName: string;
}

export default function GroupRefillSchedule({ groupName }: GroupRefillScheduleProps) {
  const { tanks, isLoading, error } = useTaTanksCompat();
  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyLevel | 'all'>('all');

  // Filter tanks to this group
  const groupTanks = useMemo(() =>
    (tanks || []).filter(t => t.group_name === groupName),
    [tanks, groupName]
  );

  // Transform to RefillPrediction format for calendar component
  const predictions: RefillPrediction[] = useMemo(() =>
    groupTanks.map(tank => ({
      tankId: tank.id,
      tankName: tank.location || 'Unknown',
      customerName: tank.group_name || groupName,
      locationId: tank.location || '',
      address: tank.address || '',
      currentLevel: tank.current_level_percent || 0,
      daysRemaining: tank.days_to_min_level,
      predictedRefillDate: calculatePredictedRefillDate(tank.days_to_min_level),
      urgency: calculateUrgencyWithFallback(tank.days_to_min_level, tank.current_level_percent),
      confidence: determineConfidence(tank.days_to_min_level, tank.rolling_avg, true),
      dailyConsumption: tank.rolling_avg || null,
      capacity: tank.safe_level || null,
      deviceOnline: true, // Manual tanks are always "online"
    })),
    [groupTanks, groupName]
  );

  // Apply filters
  const filteredPredictions = useMemo(() => {
    let result = predictions;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.tankName.toLowerCase().includes(query) ||
          p.address.toLowerCase().includes(query)
      );
    }

    // Urgency filter
    if (urgencyFilter !== 'all') {
      result = result.filter((p) => p.urgency === urgencyFilter);
    }

    return result;
  }, [predictions, searchQuery, urgencyFilter]);

  const summary = calculateUrgencySummary(filteredPredictions);
  const sortedPredictions = sortByUrgency(filteredPredictions);

  // Get tanks needing attention this week
  const thisWeekTanks = useMemo(() => {
    const today = new Date();
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    return filteredPredictions.filter((p) => {
      if (!p.predictedRefillDate) return false;
      return p.predictedRefillDate >= today && p.predictedRefillDate <= weekEnd;
    });
  }, [filteredPredictions]);

  const handleExport = () => {
    // Export to CSV
    const headers = ['Tank', 'Address', 'Level %', 'Days Remaining', 'Urgency', 'Predicted Date', 'Daily Consumption (L)'];
    const rows = sortedPredictions.map((p) => [
      p.tankName,
      p.address,
      p.currentLevel.toFixed(1),
      p.daysRemaining?.toFixed(0) || 'N/A',
      p.urgency,
      p.predictedRefillDate?.toLocaleDateString() || 'N/A',
      p.dailyConsumption?.toFixed(1) || 'N/A',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${groupName.toLowerCase().replace(/\s+/g, '-')}-refill-schedule-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle error state
  if (error) {
    const errorMessage = typeof error === 'string' ? error :
      (error && typeof error === 'object' && 'message' in error) ? String(error.message) :
      'Unable to load tank data.';

    return (
      <AppLayout selectedGroup={groupName} onGroupSelect={() => {}}>
        <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
          <div className="p-6 text-center space-y-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="w-16 h-16 text-red-500 mx-auto text-4xl">⚠️</div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Error loading data</h3>
              <p className="text-red-600 dark:text-red-400 mt-1">{errorMessage}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Reload Page
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout selectedGroup={groupName} onGroupSelect={() => {}}>
        <div className="flex items-center justify-center min-h-[50vh]">
          <LoadingSpinner />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout selectedGroup={groupName} onGroupSelect={() => {}}>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <CalendarDays className="h-6 w-6" />
              {groupName} Refill Schedule
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Predicted refill dates for {groupName} tanks
            </p>
          </div>
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download size={16} />
            Export CSV
          </Button>
        </div>

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

        {/* This Week Alert */}
        {thisWeekTanks.length > 0 && (
          <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    {thisWeekTanks.length} tank{thisWeekTanks.length > 1 ? 's' : ''} need refill this week
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {thisWeekTanks.filter((t) => t.urgency === 'critical').length} critical,{' '}
                    {thisWeekTanks.filter((t) => t.urgency === 'warning').length} warning
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4">
              {/* Search */}
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search tanks, addresses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

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
              {(searchQuery || urgencyFilter !== 'all') && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearchQuery('');
                    setUrgencyFilter('all');
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <RefillCalendar
              predictions={filteredPredictions}
              showCustomerName={false}
            />
          </div>

          {/* Tank List */}
          <div>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>All Tanks</span>
                  <Badge variant="outline">{filteredPredictions.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {sortedPredictions.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No tanks match filters</p>
                  ) : (
                    sortedPredictions.map((tank) => (
                      <TankRow key={tank.tankId} tank={tank} />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
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

function TankRow({ tank }: { tank: RefillPrediction }) {
  const urgencyColors = {
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200',
    warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200',
    normal: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200',
    unknown: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200',
  };

  return (
    <div
      className={cn(
        'p-3 rounded-lg border transition-colors',
        urgencyColors[tank.urgency]
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm bg-white dark:bg-gray-900'
          )}
        >
          {tank.currentLevel.toFixed(0)}%
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{tank.tankName}</p>
          <p className="text-xs opacity-75 truncate">{tank.address || 'No address'}</p>
        </div>
        <div className="text-right">
          {tank.daysRemaining !== null ? (
            <>
              <p className="text-sm font-medium">{Math.round(tank.daysRemaining)}d</p>
              <p className="text-xs opacity-75">remaining</p>
            </>
          ) : (
            <p className="text-xs opacity-75">No data</p>
          )}
        </div>
      </div>
    </div>
  );
}
