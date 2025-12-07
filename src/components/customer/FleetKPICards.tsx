import { motion } from 'framer-motion';
import { Fuel, TrendingDown, AlertTriangle, CheckCircle, Activity } from 'lucide-react';
import { staggerContainerVariants } from '@/lib/motion-variants';
import { KPICard } from '@/components/ui/KPICard';
import type { CustomerTank } from '@/hooks/useCustomerAuth';
import { formatDistanceToNow } from 'date-fns';

// Format last seen time from epoch timestamp
function formatLastSeen(epochSeconds: number): string {
  const date = new Date(epochSeconds * 1000);
  return formatDistanceToNow(date, { addSuffix: true });
}

interface TankSummary {
  totalTanks: number;
  onlineTanks: number;
  lowFuelTanks: number;
  criticalTanks: number;
}

interface FleetMetrics {
  totalFuelPercent: number;
  dailyUse: number;
  daysToRun: number;
  currentFuelLiters: number;
}

interface FleetKPICardsProps {
  summary: TankSummary;
  fleetMetrics?: FleetMetrics | null;
  tankCount?: number;
  singleTank?: CustomerTank; // For single-tank customers, show tank details instead of fleet status
}

export function FleetKPICards({ summary, fleetMetrics, tankCount = 0, singleTank }: FleetKPICardsProps) {
  // For single-tank customers, hide redundant fleet-aggregate cards
  const isSingleTank = tankCount === 1;

  // Get single tank details for display
  const tankName = singleTank?.customer_name || 'Tank';
  const tankOnline = singleTank?.device_online ?? true;

  return (
    <motion.div
      className={`grid grid-cols-1 gap-4 ${isSingleTank ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'}`}
      initial="hidden"
      animate="visible"
      variants={staggerContainerVariants}
    >
      {/* For single-tank: Show tank name + status. For fleet: Show fleet status */}
      {isSingleTank && singleTank ? (
        <KPICard
          title={tankName}
          value={tankOnline ? 'Online' : 'Offline'}
          subtitle="Status"
          icon={tankOnline ? CheckCircle : Activity}
          color={tankOnline ? 'green' : 'yellow'}
          trend="neutral"
          trendValue={
            singleTank.latest_telemetry_epoch
              ? `Last seen ${formatLastSeen(singleTank.latest_telemetry_epoch)}`
              : 'No data yet'
          }
        />
      ) : (
        <KPICard
          title="Fleet Status"
          value={summary.onlineTanks}
          subtitle={`of ${summary.totalTanks} online`}
          icon={CheckCircle}
          color={summary.onlineTanks === summary.totalTanks ? 'green' : 'yellow'}
          trend={summary.onlineTanks === summary.totalTanks ? 'neutral' : 'down'}
          trendValue={
            summary.onlineTanks === summary.totalTanks
              ? 'All systems operational'
              : `${summary.totalTanks - summary.onlineTanks} offline`
          }
        />
      )}

      {/* Low Fuel Warning - hide for single tank (redundant with fuel level color) */}
      {!isSingleTank && (
        <KPICard
          title="Low Fuel Tanks"
          value={summary.lowFuelTanks}
          subtitle={summary.lowFuelTanks > 0 ? 'needs attention' : 'all good'}
          icon={TrendingDown}
          color={summary.lowFuelTanks > 0 ? 'yellow' : 'gray'}
          alert={summary.lowFuelTanks > 0}
          trend={summary.lowFuelTanks > 0 ? 'down' : 'neutral'}
          trendValue={summary.lowFuelTanks > 0 ? 'Monitor closely' : 'Fleet healthy'}
        />
      )}

      {/* Critical Alert - hide for single tank (redundant with fuel level color) */}
      {!isSingleTank && (
        <KPICard
          title="Critical Alerts"
          value={summary.criticalTanks}
          subtitle={summary.criticalTanks > 0 ? 'urgent action' : 'none'}
          icon={AlertTriangle}
          color={summary.criticalTanks > 0 ? 'red' : 'gray'}
          alert={summary.criticalTanks > 0}
          trend={summary.criticalTanks > 0 ? 'down' : 'neutral'}
          trendValue={
            summary.criticalTanks > 0 ? 'Request delivery now' : 'No emergencies'
          }
        />
      )}

      {/* NEW: Fleet-wide Fuel Metrics - FUEL FIRST! */}
      {fleetMetrics && (
        <>
          <KPICard
            title="Total Fuel Level"
            value={fleetMetrics.currentFuelLiters.toLocaleString()}
            subtitle="L"
            icon={Fuel}
            color={
              fleetMetrics.totalFuelPercent < 25
                ? 'red'
                : fleetMetrics.totalFuelPercent < 50
                ? 'yellow'
                : 'green'
            }
            trend="neutral"
            trendValue={`${Math.round(fleetMetrics.totalFuelPercent)}% of capacity`}
          />

          <KPICard
            title="Daily Fuel Use"
            value={fleetMetrics.dailyUse}
            subtitle="L/day"
            icon={TrendingDown}
            color="blue"
            trend="neutral"
            trendValue="Fleet average"
          />

          <KPICard
            title="Days to Run"
            value={fleetMetrics.daysToRun}
            subtitle="days"
            icon={Activity}
            color={
              fleetMetrics.daysToRun < 7
                ? 'red'
                : fleetMetrics.daysToRun < 14
                ? 'yellow'
                : 'green'
            }
            trend={fleetMetrics.daysToRun < 7 ? 'down' : 'neutral'}
            trendValue={
              fleetMetrics.daysToRun < 7
                ? 'Request delivery soon'
                : 'Adequate supply'
            }
          />
        </>
      )}
    </motion.div>
  );
}
