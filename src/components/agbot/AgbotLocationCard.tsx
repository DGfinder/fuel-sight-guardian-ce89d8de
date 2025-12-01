import React from 'react';
import { 
  MapPin, 
  Signal, 
  SignalHigh, 
  SignalLow, 
  Battery, 
  Wifi, 
  WifiOff,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  usePercentageColor, 
  usePercentageBackground, 
  formatTimestamp,
  getDeviceOnlineStatus,
  validateLocationData
} from '@/hooks/useAgbotData';
import { useAgbotModal } from '@/contexts/AgbotModalContext';
import type { AgbotLocation } from '@/services/agbot-api';

interface AgbotLocationCardProps {
  location: AgbotLocation;
}

export default function AgbotLocationCard({ location }: AgbotLocationCardProps) {
  const { openModal } = useAgbotModal();
  const mainAsset = location.assets?.[0]; // Primary asset for this location
  const allAssets = location.assets || [];
  
  // Use location-level percentage if available, otherwise use main asset
  const displayPercentage = location.latest_calibrated_fill_percentage ?? mainAsset?.latest_calibrated_fill_percentage;
  const lastSeen = mainAsset?.latest_telemetry_event_timestamp || location.latest_telemetry;
  
  // Use new Perth-timezone-aware device status logic
  const deviceStatus = getDeviceOnlineStatus(lastSeen);
  const isOnline = deviceStatus.isOnline;
  
  // Data quality validation
  const dataQuality = validateLocationData(location);

  // Get color classes
  const percentageColor = usePercentageColor(displayPercentage);
  const percentageBackground = usePercentageBackground(displayPercentage);

  // Determine status icon and color based on device status and fuel level
  const getStatusIcon = () => {
    if (deviceStatus.status === 'offline' || deviceStatus.status === 'no-data') {
      return <WifiOff className="h-4 w-4 text-red-500" />;
    }
    if (deviceStatus.status === 'stale') {
      return <Wifi className="h-4 w-4 text-yellow-500" />;
    }
    // Device is online, show signal strength based on fuel level
    if (displayPercentage && displayPercentage > 70) {
      return <SignalHigh className="h-4 w-4 text-green-500" />;
    }
    if (displayPercentage && displayPercentage > 30) {
      return <Signal className="h-4 w-4 text-yellow-500" />;
    }
    if (displayPercentage && displayPercentage > 0) {
      return <SignalLow className="h-4 w-4 text-red-500" />;
    }
    return <Wifi className="h-4 w-4 text-green-500" />; // Online but no fuel data
  };

  // Format address
  const formatAddress = () => {
    const parts = [location.address1, location.address2, location.state].filter(Boolean);
    return parts.join(', ') || 'No address';
  };

  return (
    <Card 
      className={`cursor-pointer hover:shadow-lg transition-all duration-200 ${
        !isOnline ? 'opacity-75 border-gray-300' : 'border-border hover:border-primary'
      }`}
      onClick={() => openModal(location)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-semibold truncate">
              {location.location_id || 'Unknown Location'}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1 truncate">
              {location.customer_name}
            </p>
          </div>
          <div className="flex items-center gap-1 ml-2">
            {getStatusIcon()}
            <Badge 
              variant={deviceStatus.status === 'online' ? "default" : "secondary"}
              className={`text-xs ${deviceStatus.colorClass}`}
            >
              {deviceStatus.displayText}
            </Badge>
            {dataQuality.hasIssues && dataQuality.severity === 'high' && (
              <Badge variant="destructive" className="text-xs ml-1">
                ⚠️ Data Issues
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Enhanced Fuel Level Display */}
        <div className="text-center space-y-2">
          <div className={`text-4xl font-bold ${percentageColor}`}>
            {displayPercentage !== null && displayPercentage !== undefined 
              ? `${displayPercentage.toFixed(1)}%` 
              : 'No Data'
            }
          </div>
          <p className="text-sm text-muted-foreground">Current Fuel Level</p>
          
          {/* Volume and Capacity Information */}
          {mainAsset && displayPercentage !== null && (
            <div className="text-center">
              <div className="text-lg font-semibold text-slate-700">
                {(() => {
                  const capacityFromName = mainAsset.asset_profile_name?.match(/[\d,]+/)?.[0]?.replace(/,/g, '');
                  const capacity = location.raw_data?.AssetProfileWaterCapacity ||
                                  mainAsset.asset_profile_water_capacity ||
                                  mainAsset.asset_refill_capacity_litres ||
                                  (capacityFromName ? parseInt(capacityFromName) : 50000);
                  const currentVolume = Math.round((displayPercentage / 100) * capacity);
                  return `${currentVolume.toLocaleString()}L`;
                })()}
              </div>
              <div className="text-xs text-muted-foreground">
                of {(() => {
                  const capacityFromName = mainAsset.asset_profile_name?.match(/[\d,]+/)?.[0]?.replace(/,/g, '');
                  const capacity = location.raw_data?.AssetProfileWaterCapacity ||
                                  mainAsset.asset_profile_water_capacity ||
                                  mainAsset.asset_refill_capacity_litres ||
                                  (capacityFromName ? parseInt(capacityFromName) : 50000);
                  return capacity.toLocaleString();
                })()}L capacity
              </div>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {displayPercentage !== null && displayPercentage !== undefined && (
          <div className="space-y-2">
            <Progress 
              value={displayPercentage} 
              className="h-3"
              style={{
                '--progress-background': displayPercentage < 20 ? '#ef4444' : 
                                       displayPercentage < 50 ? '#eab308' : '#22c55e'
              } as React.CSSProperties}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>
        )}

        {/* Location Info */}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <span className="text-sm text-muted-foreground">
              {formatAddress()}
            </span>
          </div>
        </div>

        {/* Enhanced Technical Info */}
        {mainAsset && (
          <div className="space-y-3">
            {/* Consumption Analytics */}
            {(mainAsset.asset_daily_consumption || location.location_daily_consumption || mainAsset.asset_days_remaining) && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-800">Consumption</span>
                  <TrendingDown className="h-4 w-4 text-slate-600" />
                </div>
                <div className="space-y-1 text-xs">
                  {(mainAsset.asset_daily_consumption || location.location_daily_consumption) && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Daily Usage:</span>
                      <span className="font-semibold text-slate-800">
                        {(() => {
                          const dailyConsumptionPct = mainAsset.asset_daily_consumption || location.location_daily_consumption;
                          const capacityFromName = mainAsset.asset_profile_name?.match(/[\d,]+/)?.[0]?.replace(/,/g, '');
                          const capacity = location.raw_data?.AssetProfileWaterCapacity ||
                                          mainAsset.asset_profile_water_capacity ||
                                          mainAsset.asset_refill_capacity_litres ||
                                          (capacityFromName ? parseInt(capacityFromName) : 50000);
                          const dailyConsumptionLitres = Math.round((dailyConsumptionPct / 100) * capacity);
                          return dailyConsumptionLitres.toLocaleString();
                        })()}L
                      </span>
                    </div>
                  )}
                  {mainAsset.asset_days_remaining && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Days Remaining:</span>
                      <span className="font-semibold text-slate-800">{mainAsset.asset_days_remaining}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Device Technical Info */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Device Info</span>
                <Badge variant="outline" className="text-xs">
                  {mainAsset.device_sku_name || `Model ${mainAsset.device_sku_model || 'Unknown'}`}
                </Badge>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Serial:</span>
                  <span className="font-mono">{mainAsset.device_serial_number}</span>
                </div>
                {mainAsset.latest_raw_fill_percentage !== null && 
                 mainAsset.latest_raw_fill_percentage !== undefined && (
                  <div className="flex justify-between">
                    <span>Raw Reading:</span>
                    <span className="font-semibold">{mainAsset.latest_raw_fill_percentage.toFixed(1)}%</span>
                  </div>
                )}
                {mainAsset.device_activation_date && (
                  <div className="flex justify-between">
                    <span>Activated:</span>
                    <span>{format(new Date(mainAsset.device_activation_date), 'MMM yyyy')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Multiple Assets Indicator */}
        {allAssets.length > 1 && (
          <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
            <span className="text-sm text-slate-700">
              {allAssets.length} devices at this location
            </span>
            <Badge variant="secondary" className="text-xs">
              {allAssets.filter(asset => getDeviceOnlineStatus(asset.latest_telemetry_event_timestamp).isOnline).length} online
            </Badge>
          </div>
        )}

        {/* Last Seen with Data Quality Indicators */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Last reading:</span>
            <span className={deviceStatus.colorClass}>
              {deviceStatus.lastSeenText}
            </span>
          </div>
          {dataQuality.hasIssues && (
            <div className="text-xs text-orange-600 bg-orange-50 p-1 rounded">
              <div className="font-medium">Data Quality Issues:</div>
              <ul className="list-disc list-inside">
                {dataQuality.issues.slice(0, 2).map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Status Indicators */}
        <div className="flex gap-2 pt-2 border-t">
          <Badge 
            variant={location.installation_status === 2 ? "default" : "secondary"}
            className="text-xs flex-1 justify-center"
          >
            {location.installation_status_label || 'Unknown'}
          </Badge>
          {displayPercentage !== null && displayPercentage !== undefined && (
            <Badge 
              variant={displayPercentage < 20 ? "destructive" : "outline"}
              className="text-xs"
            >
              {displayPercentage < 20 ? 'Low Fuel' : 
               displayPercentage < 50 ? 'Medium' : 'Good'}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}