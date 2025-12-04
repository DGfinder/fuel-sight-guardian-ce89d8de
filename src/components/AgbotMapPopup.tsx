import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { MapPin, Eye, Clock, Signal, Wifi, WifiOff, Gauge, AlertTriangle, Timer, Droplets, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { MapItem } from '@/hooks/useMapData';
import { getAgbotFuelStatus, getAgbotStatusText } from '@/components/map/MapIcons';
import { formatTimestamp } from '@/hooks/useAgbotData';

interface AgbotMapPopupProps {
  agbot: MapItem;
  onViewDetails: (agbot: MapItem) => void;
}

export const AgbotMapPopup: React.FC<AgbotMapPopupProps> = ({ agbot, onViewDetails }) => {
  const percentage = agbot.current_level_percent;
  const isOnline = agbot.device_online ?? false;
  const fuelStatus = getAgbotFuelStatus(percentage);
  const statusText = getAgbotStatusText(percentage, isOnline);

  // Days remaining from unified view
  const daysRemaining = (agbot as any).days_to_min;
  const rollingAvg = (agbot as any).rolling_avg;

  const getPercentageColor = () => {
    if (!isOnline) return 'text-gray-500';
    if (percentage === null || percentage === undefined) return 'text-gray-400';

    if (percentage <= 20) return 'text-red-600';
    if (percentage <= 50) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getProgressColor = () => {
    if (!isOnline || percentage === null || percentage === undefined) return 'bg-gray-200';

    if (percentage <= 20) return 'bg-red-500';
    if (percentage <= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Consumption trend indicator
  const getConsumptionTrend = () => {
    if (rollingAvg === undefined || rollingAvg === null) return null;
    if (rollingAvg > 500) return { icon: TrendingDown, color: 'text-red-500', label: 'High' };
    if (rollingAvg > 200) return { icon: Minus, color: 'text-yellow-500', label: 'Moderate' };
    return { icon: TrendingUp, color: 'text-green-500', label: 'Low' };
  };

  const trend = getConsumptionTrend();

  // Days remaining urgency color
  const getDaysColor = () => {
    if (daysRemaining === null || daysRemaining === undefined) return 'text-gray-500';
    if (daysRemaining <= 3) return 'text-red-600';
    if (daysRemaining <= 7) return 'text-orange-500';
    if (daysRemaining <= 14) return 'text-yellow-600';
    return 'text-green-600';
  };

  // Alert banner based on status
  const urgency = (agbot as any).urgency_status || fuelStatus;
  const showAlert = isOnline && (urgency === 'critical' || urgency === 'urgent' || urgency === 'warning' || (percentage !== null && percentage !== undefined && percentage <= 20));
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
              {agbot.location}
            </h3>
            {agbot.customer_name && (
              <div className="flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3 text-gray-400" />
                <p className="text-xs text-gray-600 truncate">
                  {agbot.customer_name}
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 ml-2 flex-shrink-0">
            <Badge variant={isOnline ? "default" : "secondary"} className="text-xs flex items-center gap-1">
              {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
            <Badge
              variant={fuelStatus === 'critical' ? "destructive" : fuelStatus === 'low' ? "secondary" : "outline"}
              className="text-xs"
            >
              <Signal className="h-3 w-3 mr-1" />
              Agbot
            </Badge>
          </div>
        </div>
      </div>

      {/* Large Fuel Level Display */}
      <div className="space-y-2">
        <div className="text-center p-3 rounded-lg bg-gray-50 border border-gray-100">
          <div className={`text-3xl font-bold ${getPercentageColor()}`}>
            {percentage !== null && percentage !== undefined
              ? `${percentage.toFixed(1)}%`
              : 'No Data'
            }
          </div>
          {percentage !== null && percentage !== undefined && (
            <Progress
              value={percentage}
              className={`h-2 mt-2 ${getProgressColor()}`}
            />
          )}
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 gap-2">
        {/* Days Remaining */}
        <div className="flex items-center gap-2 p-2 rounded-md bg-gray-50 border border-gray-100">
          <Timer className={`h-4 w-4 ${getDaysColor()}`} />
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">Days Left</span>
            <span className={`text-sm font-bold ${getDaysColor()}`}>
              {daysRemaining !== null && daysRemaining !== undefined
                ? daysRemaining <= 0 ? '0' : Math.ceil(daysRemaining)
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
                {rollingAvg ? `${Math.round(rollingAvg)}L` : '—'}
              </span>
              {trend && <trend.icon className={`h-3 w-3 ${trend.color}`} />}
            </div>
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      {showAlert && (
        <div className={`flex items-center gap-2 p-2 rounded-md ${alertConfig[urgency as keyof typeof alertConfig]?.bg || alertConfig.critical.bg} border ${alertConfig[urgency as keyof typeof alertConfig]?.border || alertConfig.critical.border}`}>
          <AlertTriangle className={`h-4 w-4 ${alertConfig[urgency as keyof typeof alertConfig]?.text || alertConfig.critical.text} flex-shrink-0`} />
          <span className={`text-xs ${alertConfig[urgency as keyof typeof alertConfig]?.text || alertConfig.critical.text}`}>
            {alertConfig[urgency as keyof typeof alertConfig]?.label || alertConfig.critical.label}
          </span>
        </div>
      )}

      {/* Last Reading */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Clock className="h-3 w-3" />
        <span>Last reading: {formatTimestamp(agbot.latest_dip_date)}</span>
      </div>

      {/* Device Assets Count */}
      {agbot.assets && agbot.assets.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Gauge className="h-3 w-3" />
          <span>
            {agbot.assets.length} device{agbot.assets.length > 1 ? 's' : ''} connected
          </span>
        </div>
      )}

      {/* Action Button */}
      <Button
        onClick={() => onViewDetails(agbot)}
        className="w-full h-8 text-xs"
        size="sm"
      >
        <Eye className="h-3 w-3 mr-1" />
        View Device Details
      </Button>
    </div>
  );
};

export default AgbotMapPopup;