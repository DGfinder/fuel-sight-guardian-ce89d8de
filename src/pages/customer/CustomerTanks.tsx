import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCustomerTanks } from '@/hooks/useCustomerAuth';
import { useLastRefill } from '@/hooks/useCustomerAnalytics';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { TankCard as TankCardComponent } from '@/components/customer/TankCard';
import {
  calculateUrgency,
  sortByUrgency,
  UrgencyLevel,
} from '@/lib/urgency-calculator';
import {
  Fuel,
  Search,
  Wifi,
  TrendingDown,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CustomerTanks() {
  const navigate = useNavigate();
  const { data: tanks, isLoading } = useCustomerTanks();
  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyLevel | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Apply filters and sorting
  const filteredTanks = useMemo(() => {
    let result = tanks || [];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          (t.location_id || '').toLowerCase().includes(query) ||
          (t.address1 || '').toLowerCase().includes(query)
      );
    }

    // Urgency filter
    if (urgencyFilter !== 'all') {
      result = result.filter(
        (t) => calculateUrgency(t.asset_days_remaining ?? null) === urgencyFilter
      );
    }

    // Sort by urgency
    return sortByUrgency(
      result.map((t) => ({
        ...t,
        urgency: calculateUrgency(t.asset_days_remaining ?? null),
        daysRemaining: t.asset_days_remaining,
      }))
    );
  }, [tanks, searchQuery, urgencyFilter]);

  // Stats
  const stats = useMemo(() => {
    const all = tanks || [];
    return {
      total: all.length,
      online: all.filter((t) => t.device_online).length,
      critical: all.filter((t) => calculateUrgency(t.asset_days_remaining ?? null) === 'critical').length,
      warning: all.filter((t) => calculateUrgency(t.asset_days_remaining ?? null) === 'warning').length,
    };
  }, [tanks]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Tanks</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Monitor fuel levels across all your assigned tanks
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Tanks" value={stats.total} icon={Fuel} color="blue" />
        <StatCard label="Online" value={stats.online} icon={Wifi} color="green" />
        <StatCard
          label="Critical"
          value={stats.critical}
          icon={TrendingDown}
          color="red"
          onClick={() => setUrgencyFilter('critical')}
          active={urgencyFilter === 'critical'}
        />
        <StatCard
          label="Warning"
          value={stats.warning}
          icon={Clock}
          color="yellow"
          onClick={() => setUrgencyFilter('warning')}
          active={urgencyFilter === 'warning'}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search tanks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select
              value={urgencyFilter}
              onValueChange={(v) => setUrgencyFilter(v as UrgencyLevel | 'all')}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
              </SelectContent>
            </Select>
            {(searchQuery || urgencyFilter !== 'all') && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearchQuery('');
                  setUrgencyFilter('all');
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tank Grid */}
      {filteredTanks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Fuel className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {tanks?.length === 0
                ? 'No tanks assigned to your account yet'
                : 'No tanks match your filters'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTanks.map((tank) => (
            <TankCardWrapper key={tank.id} tank={tank} navigate={navigate} />
          ))}
        </div>
      )}
    </div>
  );
}

// Wrapper component to handle the useLastRefill hook for each tank
function TankCardWrapper({ tank, navigate }: { tank: any; navigate: any }) {
  const { data: lastRefill } = useLastRefill(tank.id);

  return (
    <TankCardComponent
      tank={tank}
      lastRefill={lastRefill}
      onClick={() => navigate(`/customer/tanks/${tank.id}`)}
    />
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  onClick,
  active,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'red' | 'yellow';
  onClick?: () => void;
  active?: boolean;
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
    yellow: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400',
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
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <div className={cn('p-2 rounded-lg', colorClasses[color])}>
            <Icon size={20} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
