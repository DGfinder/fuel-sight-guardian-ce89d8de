import React from 'react';
import { Button } from '@/components/ui/button';
import { FuelStatusBadge, FuelLevelBar, getFuelStatus } from '@/components/ui/fuel-status';
import { Badge } from '@/components/ui/badge';
import { MapPin, Eye, Clock, AlertTriangle } from 'lucide-react';

interface Tank {
  id: string;
  location: string;
  group_name?: string;
  current_level_percent?: number | null;
  days_to_min_level?: number | null;
  product_type?: string;
  latest_dip_date?: string;
}

interface TankMapPopupProps {
  tank: Tank;
  onViewDetails: (tank: Tank) => void;
}

export const TankMapPopup: React.FC<TankMapPopupProps> = ({ tank, onViewDetails }) => {
  const fuelStatus = getFuelStatus(tank.current_level_percent);
  const showDaysToMin = fuelStatus === 'critical' || fuelStatus === 'low';
  
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

      {/* Warning Info */}
      {showDaysToMin && tank.days_to_min_level !== null && tank.days_to_min_level !== undefined && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-orange-50 border border-orange-200">
          <AlertTriangle className="h-4 w-4 text-orange-600 flex-shrink-0" />
          <span className="text-xs text-orange-800">
            {tank.days_to_min_level <= 0 
              ? 'Below minimum level'
              : `${Math.ceil(tank.days_to_min_level)} days to minimum`
            }
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