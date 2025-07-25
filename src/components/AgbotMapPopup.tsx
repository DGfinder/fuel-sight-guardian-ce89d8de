import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { MapPin, Eye, Clock, Signal, Wifi, WifiOff, Gauge, AlertTriangle } from 'lucide-react';
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
  
  const getPercentageColor = () => {
    if (!isOnline) return 'text-gray-500';
    if (percentage === null || percentage === undefined) return 'text-gray-400';
    
    if (percentage <= 20) return 'text-red-600';
    if (percentage <= 50) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getProgressColor = () => {
    if (!isOnline || percentage === null || percentage === undefined) return undefined;
    
    if (percentage <= 20) return 'bg-red-500';
    if (percentage <= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const showLowFuelWarning = isOnline && percentage !== null && percentage !== undefined && percentage <= 20;

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
            <Badge variant={isOnline ? "default" : "secondary"} className="text-xs">
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
            <Badge 
              variant={fuelStatus === 'critical' ? "destructive" : fuelStatus === 'low' ? "secondary" : "outline"} 
              className="text-xs"
            >
              Agbot
            </Badge>
          </div>
        </div>
      </div>

      {/* Fuel Level */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Fuel Level</span>
          <div className="flex items-center gap-1">
            {isOnline ? (
              <Wifi className="h-3 w-3 text-green-500" />
            ) : (
              <WifiOff className="h-3 w-3 text-red-500" />
            )}
            <Signal className="h-3 w-3 text-gray-400" />
          </div>
        </div>
        
        <div className="text-center">
          <div className={`text-2xl font-bold ${getPercentageColor()}`}>
            {percentage !== null && percentage !== undefined 
              ? `${percentage.toFixed(1)}%` 
              : 'No Data'
            }
          </div>
          {percentage !== null && percentage !== undefined && (
            <Progress 
              value={percentage} 
              className="h-2 mt-2" 
              style={{ backgroundColor: getProgressColor() }}
            />
          )}
        </div>
      </div>

      {/* Status Information */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-center">
            <div className="text-gray-500">Status</div>
            <div className={`font-semibold ${getPercentageColor()}`}>
              {statusText}
            </div>
          </div>
          <div className="text-center">
            <div className="text-gray-500">Type</div>
            <div className="font-semibold">
              Cellular
            </div>
          </div>
        </div>

        {agbot.installation_status_label && (
          <div className="text-center">
            <div className="text-xs text-gray-500">Installation</div>
            <Badge variant="outline" className="text-xs">
              {agbot.installation_status_label}
            </Badge>
          </div>
        )}
      </div>

      {/* Low Fuel Warning */}
      {showLowFuelWarning && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-red-50 border border-red-200">
          <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
          <span className="text-xs text-red-800">
            Critical fuel level - immediate attention required
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