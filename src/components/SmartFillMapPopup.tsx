import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { MapPin, Eye, Clock, Activity, Building2, AlertTriangle, Fuel } from 'lucide-react';
import { MapItem } from '@/hooks/useMapData';
import { formatSmartFillTimestamp } from '@/hooks/useSmartFillData';
import { PopupWeatherSection } from '@/components/map/PopupWeatherSection';

interface SmartFillMapPopupProps {
  smartfill: MapItem;
  onViewDetails: (smartfill: MapItem) => void;
}

export const SmartFillMapPopup: React.FC<SmartFillMapPopupProps> = ({ smartfill, onViewDetails }) => {
  const percentage = smartfill.current_level_percent;
  const hasData = percentage !== null && percentage !== undefined;
  
  const getPercentageColor = () => {
    if (!hasData) return 'text-gray-400';
    
    if (percentage <= 20) return 'text-red-600';
    if (percentage <= 50) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getProgressColor = () => {
    if (!hasData) return undefined;
    
    if (percentage <= 20) return 'bg-red-500';
    if (percentage <= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getFuelStatus = () => {
    if (!hasData) return 'No Data';
    
    if (percentage <= 20) return 'Critical';
    if (percentage <= 50) return 'Low';
    return 'Good';
  };

  const getFuelStatusVariant = () => {
    if (!hasData) return 'secondary';
    
    if (percentage <= 20) return 'destructive';
    if (percentage <= 50) return 'secondary';
    return 'outline';
  };

  const showLowFuelWarning = hasData && percentage <= 20;
  const tankCount = smartfill.tanks?.length || 0;

  return (
    <div className="min-w-[280px] max-w-[320px] p-3 space-y-3">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-tight">
              {smartfill.location}
            </h3>
            {smartfill.customer_name && (
              <div className="flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3 text-gray-400" />
                <p className="text-xs text-gray-600 truncate">
                  {smartfill.customer_name}
                </p>
              </div>
            )}
            {smartfill.unit_number && (
              <div className="flex items-center gap-1 mt-1">
                <Building2 className="h-3 w-3 text-gray-400" />
                <p className="text-xs text-gray-500">
                  Unit {smartfill.unit_number}
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 ml-2 flex-shrink-0">
            <Badge 
              variant={getFuelStatusVariant()} 
              className="text-xs"
            >
              {getFuelStatus()}
            </Badge>
            <Badge variant="outline" className="text-xs">
              SmartFill
            </Badge>
          </div>
        </div>
      </div>

      {/* Fuel Level */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Average Fuel Level</span>
          <div className="flex items-center gap-1">
            <Activity className="h-3 w-3 text-blue-500" />
          </div>
        </div>
        
        <div className="text-center">
          <div className={`text-2xl font-bold ${getPercentageColor()}`}>
            {hasData 
              ? `${percentage.toFixed(1)}%` 
              : 'No Data'
            }
          </div>
          {hasData && (
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
            <div className="text-gray-500">Tanks</div>
            <div className="font-semibold">
              {tankCount} tank{tankCount !== 1 ? 's' : ''}
            </div>
          </div>
          <div className="text-center">
            <div className="text-gray-500">Type</div>
            <div className="font-semibold">
              JSON-RPC
            </div>
          </div>
        </div>

        {smartfill.timezone && (
          <div className="text-center">
            <div className="text-xs text-gray-500">Timezone</div>
            <Badge variant="outline" className="text-xs">
              {smartfill.timezone}
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
        <span>Last update: {formatSmartFillTimestamp(smartfill.latest_dip_date)}</span>
      </div>

      {/* Tank Details */}
      {tankCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Fuel className="h-3 w-3" />
          <span>
            {tankCount} tank{tankCount > 1 ? 's' : ''} monitored
          </span>
        </div>
      )}

      {/* Weather Section */}
      <PopupWeatherSection lat={smartfill.latitude} lng={smartfill.longitude} />

      {/* Action Button */}
      <Button 
        onClick={() => onViewDetails(smartfill)}
        className="w-full h-8 text-xs"
        size="sm"
      >
        <Eye className="h-3 w-3 mr-1" />
        View Tank Details
      </Button>
    </div>
  );
};

export default SmartFillMapPopup;