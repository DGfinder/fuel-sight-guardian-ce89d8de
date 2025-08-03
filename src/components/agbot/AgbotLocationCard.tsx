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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  usePercentageColor, 
  usePercentageBackground, 
  formatTimestamp 
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
  const isOnline = location.location_status === 2 && (mainAsset?.device_online ?? false);
  const lastSeen = mainAsset?.latest_telemetry_event_timestamp || location.latest_telemetry;

  // Get color classes
  const percentageColor = usePercentageColor(displayPercentage);
  const percentageBackground = usePercentageBackground(displayPercentage);

  // Determine status icon and color
  const getStatusIcon = () => {
    if (!isOnline) {
      return <WifiOff className="h-4 w-4 text-red-500" />;
    }
    if (displayPercentage && displayPercentage > 70) {
      return <SignalHigh className="h-4 w-4 text-green-500" />;
    }
    if (displayPercentage && displayPercentage > 30) {
      return <Signal className="h-4 w-4 text-yellow-500" />;
    }
    return <SignalLow className="h-4 w-4 text-red-500" />;
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
              variant={isOnline ? "default" : "secondary"}
              className="text-xs"
            >
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main Percentage Display */}
        <div className="text-center">
          <div className={`text-4xl font-bold ${percentageColor}`}>
            {displayPercentage !== null && displayPercentage !== undefined 
              ? `${displayPercentage.toFixed(1)}%` 
              : 'No Data'
            }
          </div>
          <p className="text-sm text-muted-foreground">Current Fuel Level</p>
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

        {/* Device Info */}
        {mainAsset && (
          <div className="space-y-2 p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Device Info</span>
              <Badge variant="outline" className="text-xs">
                {mainAsset.device_sku_name || 'Unknown Model'}
              </Badge>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div>Serial: {mainAsset.device_serial_number}</div>
              {mainAsset.latest_raw_fill_percentage !== null && 
               mainAsset.latest_raw_fill_percentage !== undefined && (
                <div>Raw: {mainAsset.latest_raw_fill_percentage.toFixed(1)}%</div>
              )}
            </div>
          </div>
        )}

        {/* Multiple Assets Indicator */}
        {allAssets.length > 1 && (
          <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
            <span className="text-sm text-blue-700">
              {allAssets.length} devices at this location
            </span>
            <Badge variant="secondary" className="text-xs">
              {allAssets.filter(asset => asset.device_online).length} online
            </Badge>
          </div>
        )}

        {/* Last Seen */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Last reading:</span>
          <span className={isOnline ? 'text-green-600' : 'text-red-600'}>
            {formatTimestamp(lastSeen)}
          </span>
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