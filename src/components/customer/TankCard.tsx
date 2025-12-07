import { Calendar, Droplet, TrendingDown, WifiOff, Wifi, Radio, Gauge, ClipboardEdit } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { CustomerTank, TankSourceType } from '../../hooks/useCustomerAuth';
import { LastRefillData } from '../../hooks/useCustomerAnalytics';

interface TankCardProps {
  tank: CustomerTank;
  lastRefill?: LastRefillData | null;
  onClick?: () => void;
}

export function TankCard({ tank, lastRefill, onClick }: TankCardProps) {
  const fillPercentage = tank.latest_calibrated_fill_percentage || 0;
  const currentLiters = tank.asset_current_level_liters || 0;
  const capacityLiters = tank.asset_profile_water_capacity || 0;
  const dailyConsumption = tank.asset_daily_consumption || 0;
  const daysRemaining = tank.asset_days_remaining;

  // Determine color based on fill level
  const getFillColor = () => {
    if (fillPercentage < 15) return 'text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
    if (fillPercentage < 25) return 'text-yellow-700 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
  };

  // Get source badge config
  const getSourceBadge = () => {
    const sourceType = tank.source_type || 'agbot';
    switch (sourceType) {
      case 'smartfill':
        return {
          icon: Gauge,
          label: 'SmartFill',
          className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
        };
      case 'dip':
      case 'manual':
        return {
          icon: ClipboardEdit,
          label: 'Manual',
          className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
        };
      case 'agbot':
      default:
        return {
          icon: Radio,
          label: 'AgBot',
          className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
        };
    }
  };

  const sourceBadge = getSourceBadge();

  // Format last reading time
  const getLastReadingTime = () => {
    if (!tank.latest_telemetry_epoch) return 'Never';
    const lastReading = new Date(tank.latest_telemetry_epoch * 1000);
    return formatDistanceToNow(lastReading, { addSuffix: true });
  };

  return (
    <div
      onClick={onClick}
      className={`
        bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700
        p-6 transition-all duration-200
        ${onClick ? 'cursor-pointer hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {tank.location_id}
          </h3>
          {tank.address1 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{tank.address1}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Source Type Badge */}
          <div
            className={`
              flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
              ${sourceBadge.className}
            `}
          >
            <sourceBadge.icon className="w-3 h-3" />
            {sourceBadge.label}
          </div>

          {/* Device Status Badge */}
          <div
            className={`
              flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
              ${tank.device_online
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-900/30 dark:text-gray-400'
              }
            `}
          >
            {tank.device_online ? (
              <>
                <Wifi className="w-3 h-3" />
                Online
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" />
                Offline
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Fuel Level */}
        <div>
          <div className={`text-4xl font-bold ${getFillColor()}`}>
            {fillPercentage.toFixed(0)}%
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {currentLiters.toLocaleString()}L / {capacityLiters.toLocaleString()}L
          </div>
        </div>

        {/* Daily Consumption */}
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
            <TrendingDown className="w-4 h-4" />
            <span className="font-medium">Usage</span>
          </div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">
            {dailyConsumption > 0 ? `~${Math.round(dailyConsumption)}L/day` : 'Calculating...'}
          </div>
        </div>

        {/* Days Remaining */}
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
            <Calendar className="w-4 h-4" />
            <span className="font-medium">Remaining</span>
          </div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">
            {daysRemaining ? `${daysRemaining} days` : '—'}
          </div>
        </div>

        {/* Last Refill */}
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
            <Droplet className="w-4 h-4" />
            <span className="font-medium">Last Refill</span>
          </div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">
            {lastRefill ? `${lastRefill.daysAgo} days ago` : 'No recent refills'}
          </div>
        </div>
      </div>

      {/* Footer - Last Reading */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Last data received: {getLastReadingTime()}
        </p>
      </div>
    </div>
  );
}
