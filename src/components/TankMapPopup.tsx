import React from 'react';
import { Button } from '@/components/ui/button';
import { FuelStatusBadge, FuelLevelBar, getFuelStatus } from '@/components/ui/fuel-status';
import { Badge } from '@/components/ui/badge';
import { MapPin, Eye, Clock, AlertTriangle, TrendingDown, TrendingUp, Minus, Droplets, Timer } from 'lucide-react';

interface Tank {
  id: string;
  location: string;
  group_name?: string;
  current_level_percent?: number | null;
  days_to_min_level?: number | null;
  product_type?: string;
  latest_dip_date?: string;
  rolling_avg?: number;
  current_level?: number;
  safe_level?: number;
  urgency_status?: string;
}

interface TankMapPopupProps {
  tank: Tank;
  onViewDetails: (tank: Tank) => void;
}

export const TankMapPopup: React.FC<TankMapPopupProps> = ({ tank, onViewDetails }) => {
  const fuelStatus = getFuelStatus(tank.current_level_percent);
  const urgency = tank.urgency_status || fuelStatus;

  const formatLastReading = (dateString?: string) => {
    if (!dateString) return 'No recent reading';
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    }
  };

  // Consumption trend indicator
  const getConsumptionTrend = () => {
    const avg = tank.rolling_avg;
    if (avg === undefined || avg === null) return null;
    if (avg > 500) return { icon: TrendingDown, color: 'text-red-500', label: 'High' };
    if (avg > 200) return { icon: Minus, color: 'text-yellow-500', label: 'Moderate' };
    return { icon: TrendingUp, color: 'text-green-500', label: 'Low' };
  };

  const trend = getConsumptionTrend();

  // Days remaining urgency color
  const getDaysColor = () => {
    const days = tank.days_to_min_level;
    if (days === null || days === undefined) return 'text-gray-500';
    if (days <= 3) return 'text-red-600';
    if (days <= 7) return 'text-orange-500';
    if (days <= 14) return 'text-yellow-600';
    return 'text-green-600';
  };

  // Alert banner based on urgency
  const showAlert = urgency === 'critical' || urgency === 'urgent' || urgency === 'warning';
  const alertConfig = {
    critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', label: 'Critical - Immediate attention required' },
    urgent: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', label: 'Urgent - Schedule refill soon' },
    warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', label: 'Warning - Monitor closely' },
  };

  return (
    <div className="min-w-[280px] max-w-[320px] p-3 space-y-3">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-tight">
              {tank.location}
            </h3>
            {tank.group_name && (
              <div className="flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3 text-gray-400" />
                <p className="text-xs text-gray-600 truncate">
                  {tank.group_name}
                </p>
              </div>
            )}
          </div>
          <FuelStatusBadge
            percentage={tank.current_level_percent}
            size="sm"
            className="ml-2 flex-shrink-0"
          />
        </div>

        {tank.product_type && (
          <Badge variant="outline" className="text-xs">
            {tank.product_type}
          </Badge>
        )}
      </div>

      {/* Fuel Level */}
      <div className="space-y-2">
        <FuelLevelBar
          percentage={tank.current_level_percent}
          size="default"
          showLabel={true}
        />
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 gap-2">
        {/* Days Remaining */}
        <div className="flex items-center gap-2 p-2 rounded-md bg-gray-50 border border-gray-100">
          <Timer className={`h-4 w-4 ${getDaysColor()}`} />
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">Days Left</span>
            <span className={`text-sm font-bold ${getDaysColor()}`}>
              {tank.days_to_min_level !== null && tank.days_to_min_level !== undefined
                ? tank.days_to_min_level <= 0 ? '0' : Math.ceil(tank.days_to_min_level)
                : '—'}
            </span>
          </div>
        </div>

        {/* Consumption Rate */}
        <div className="flex items-center gap-2 p-2 rounded-md bg-gray-50 border border-gray-100">
          <Droplets className="h-4 w-4 text-blue-500" />
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">Usage/Day</span>
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-gray-700">
                {tank.rolling_avg ? `${Math.round(tank.rolling_avg)}L` : '—'}
              </span>
              {trend && <trend.icon className={`h-3 w-3 ${trend.color}`} />}
            </div>
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      {showAlert && alertConfig[urgency as keyof typeof alertConfig] && (
        <div className={`flex items-center gap-2 p-2 rounded-md ${alertConfig[urgency as keyof typeof alertConfig].bg} border ${alertConfig[urgency as keyof typeof alertConfig].border}`}>
          <AlertTriangle className={`h-4 w-4 ${alertConfig[urgency as keyof typeof alertConfig].text} flex-shrink-0`} />
          <span className={`text-xs ${alertConfig[urgency as keyof typeof alertConfig].text}`}>
            {alertConfig[urgency as keyof typeof alertConfig].label}
          </span>
        </div>
      )}

      {/* Last Reading */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Clock className="h-3 w-3" />
        <span>Last reading: {formatLastReading(tank.latest_dip_date)}</span>
      </div>

      {/* Action Button */}
      <Button
        onClick={() => onViewDetails(tank)}
        className="w-full h-8 text-xs"
        size="sm"
      >
        <Eye className="h-3 w-3 mr-1" />
        View Full Details
      </Button>
    </div>
  );
};

export default TankMapPopup;