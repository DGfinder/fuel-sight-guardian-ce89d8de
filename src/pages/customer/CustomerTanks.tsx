import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { useCustomerTanks } from '@/hooks/useCustomerAuth';
import { useLastRefill } from '@/hooks/useCustomerAnalytics';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { TankCard as TankCardComponent } from '@/components/customer/TankCard';
import { KPICard } from '@/components/ui/KPICard';
import { FilterCard } from '@/components/ui/FilterCard';
import {
  calculateUrgency,
  sortByUrgency,
  UrgencyLevel,
} from '@/lib/urgency-calculator';
import {
  Fuel,
  Wifi,
  TrendingDown,
  Clock,
} from 'lucide-react';
import { staggerContainerVariants, fadeUpItemVariants } from '@/lib/motion-variants';
import { WeatherStrip } from '@/components/ui/WeatherStrip';

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

      {/* Weather Strip - Fleet-wide based on first tank with coords */}
      {(() => {
        const tankWithCoords = tanks?.find(t => t.lat && t.lng);
        if (!tankWithCoords) return null;
        return (
          <WeatherStrip
            lat={tankWithCoords.lat!}
            lng={tankWithCoords.lng!}
            context="delivery"
          />
        );
      })()}

      {/* Stats - Now using KPICard */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
        initial="hidden"
        animate="visible"
        variants={staggerContainerVariants}
      >
        <KPICard
          title="Total Tanks"
          value={stats.total}
          icon={Fuel}
          color="blue"
          trend="neutral"
        />
        <KPICard
          title="Online"
          value={stats.online}
          subtitle={`of ${stats.total}`}
          icon={Wifi}
          color={stats.online === stats.total ? 'green' : 'yellow'}
          trend={stats.online === stats.total ? 'neutral' : 'down'}
          trendValue={stats.online === stats.total ? 'All connected' : `${stats.total - stats.online} offline`}
        />
        <motion.div
          variants={fadeUpItemVariants}
          onClick={() => setUrgencyFilter(urgencyFilter === 'critical' ? 'all' : 'critical')}
          className="cursor-pointer"
        >
          <KPICard
            title="Critical"
            value={stats.critical}
            subtitle="urgent"
            icon={TrendingDown}
            color="red"
            alert={stats.critical > 0}
            trend={stats.critical > 0 ? 'down' : 'neutral'}
            trendValue={stats.critical > 0 ? 'Needs immediate attention' : 'No emergencies'}
          />
        </motion.div>
        <motion.div
          variants={fadeUpItemVariants}
          onClick={() => setUrgencyFilter(urgencyFilter === 'warning' ? 'all' : 'warning')}
          className="cursor-pointer"
        >
          <KPICard
            title="Warning"
            value={stats.warning}
            subtitle="attention"
            icon={Clock}
            color="yellow"
            alert={stats.warning > 0}
            trend={stats.warning > 0 ? 'down' : 'neutral'}
            trendValue={stats.warning > 0 ? 'Monitor closely' : 'Fleet healthy'}
          />
        </motion.div>
      </motion.div>

      {/* Filters - Now using FilterCard */}
      <FilterCard
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search tanks by location or address..."
        filters={[
          {
            id: 'urgency',
            label: 'Status',
            value: urgencyFilter,
            onChange: (v) => setUrgencyFilter(v as UrgencyLevel | 'all'),
            options: [
              { value: 'all', label: 'All Status' },
              { value: 'critical', label: 'Critical' },
              { value: 'warning', label: 'Warning' },
              { value: 'normal', label: 'Normal' },
            ],
          },
        ]}
        onClearAll={() => {
          setSearchQuery('');
          setUrgencyFilter('all');
        }}
        activeFilterCount={urgencyFilter !== 'all' ? 1 : 0}
        defaultExpanded={true}
      />

      {/* Tank Grid - Now with stagger animation */}
      {filteredTanks.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardContent className="py-12 text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.3 }}
                transition={{ delay: 0.2 }}
              >
                <Fuel className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              </motion.div>
              <p className="text-gray-500">
                {tanks?.length === 0
                  ? 'No tanks assigned to your account yet'
                  : 'No tanks match your filters'}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-4"
          initial="hidden"
          animate="visible"
          variants={staggerContainerVariants}
        >
          {filteredTanks.map((tank, idx) => (
            <motion.div key={tank.id} variants={fadeUpItemVariants}>
              <TankCardWrapper tank={tank} navigate={navigate} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

// Wrapper component to handle the useLastRefill hook for each tank
function TankCardWrapper({ tank, navigate }: { tank: any; navigate: any }) {
  const { data: lastRefill } = useLastRefill(tank.asset_id);

  return (
    <TankCardComponent
      tank={tank}
      lastRefill={lastRefill}
      onClick={() => navigate(`/customer/tanks/${tank.id}`)}
    />
  );
}
