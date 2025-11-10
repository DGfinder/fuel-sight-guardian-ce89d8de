import React, { useState, useMemo } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowUp, ArrowDown, Wifi, WifiOff, Signal, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgbotLocation } from '@/services/agbot-api';
import { 
  usePercentageColor, 
  usePercentageBackground, 
  formatTimestamp 
} from '@/hooks/useAgbotData';
import { useAgbotModal } from '@/contexts/AgbotModalContext';

interface AgbotTableProps {
  locations: AgbotLocation[];
  className?: string;
}

type SortField = 'location' | 'customer' | 'percentage' | 'status' | 'lastReading' | 'capacity' | 'consumption' | 'daysRemaining';
type SortDirection = 'asc' | 'desc';

export default function AgbotTable({ locations, className }: AgbotTableProps) {
  const { openModal } = useAgbotModal();
  const [sortField, setSortField] = useState<SortField>('location');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedLocations = useMemo(() => {
    return [...locations].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'location':
          aValue = a.location_id || '';
          bValue = b.location_id || '';
          break;
        case 'customer':
          aValue = a.customer_name || '';
          bValue = b.customer_name || '';
          break;
        case 'percentage':
          aValue = a.latest_calibrated_fill_percentage ?? -1;
          bValue = b.latest_calibrated_fill_percentage ?? -1;
          break;
        case 'status':
          aValue = a.location_status;
          bValue = b.location_status;
          break;
        case 'lastReading':
          aValue = new Date(a.latest_telemetry || 0).getTime();
          bValue = new Date(b.latest_telemetry || 0).getTime();
          break;
        case 'capacity':
          // Calculate capacity from asset profile or default
          const aAsset = a.assets?.[0];
          const bAsset = b.assets?.[0];
          const aCapacity = a.raw_data?.AssetProfileWaterCapacity ||
                           aAsset?.asset_profile_water_capacity ||
                           aAsset?.asset_refill_capacity_litres ||
                           (aAsset?.asset_profile_name?.match(/[\d,]+/)?.[0]?.replace(/,/g, '') ?
                            parseInt(aAsset.asset_profile_name.match(/[\d,]+/)[0].replace(/,/g, '')) : 50000);
          const bCapacity = b.raw_data?.AssetProfileWaterCapacity ||
                           bAsset?.asset_profile_water_capacity ||
                           bAsset?.asset_refill_capacity_litres ||
                           (bAsset?.asset_profile_name?.match(/[\d,]+/)?.[0]?.replace(/,/g, '') ?
                            parseInt(bAsset.asset_profile_name.match(/[\d,]+/)[0].replace(/,/g, '')) : 50000);
          aValue = aCapacity;
          bValue = bCapacity;
          break;
        case 'consumption':
          const aConsumption = a.assets?.[0]?.asset_daily_consumption || a.location_daily_consumption || 0;
          const bConsumption = b.assets?.[0]?.asset_daily_consumption || b.location_daily_consumption || 0;
          aValue = aConsumption;
          bValue = bConsumption;
          break;
        case 'daysRemaining':
          aValue = a.assets?.[0]?.asset_days_remaining || 999999;
          bValue = b.assets?.[0]?.asset_days_remaining || 999999;
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      const comparison = aValue - bValue;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [locations, sortField, sortDirection]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4" /> 
      : <ArrowDown className="h-4 w-4" />;
  };

  const getStatusBadge = (location: AgbotLocation) => {
    const isOnline = location.location_status === 2;
    const mainAsset = location.assets?.[0];
    const deviceOnline = mainAsset?.device_online ?? false;

    // Check if we have recent data (within 12 hours - more reasonable for fuel monitoring)
    const hasRecentData = location.latest_telemetry ? 
      (new Date().getTime() - new Date(location.latest_telemetry).getTime()) < (12 * 60 * 60 * 1000) : false;

    // More lenient reliability check - if location is online OR we have recent data with fuel percentage
    const hasFuelData = location.latest_calibrated_fill_percentage !== null || mainAsset?.latest_calibrated_fill_percentage !== null;
    
    if ((isOnline || hasRecentData) && hasFuelData) {
      return <Badge className="bg-green-500 text-white">Reliable</Badge>;
    } else {
      return <Badge variant="destructive">Unreliable</Badge>;
    }
  };

  const getPercentageDisplay = (percentage: number | null | undefined) => {
    if (percentage === null || percentage === undefined) {
      return <span className="text-muted-foreground">No Data</span>;
    }

    const colorClass = usePercentageColor(percentage);
    return (
      <div className="flex items-center gap-2">
        <span className={`font-semibold ${colorClass}`}>
          {percentage.toFixed(1)}%
        </span>
        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${
              percentage < 20 ? 'bg-red-500' : 
              percentage < 50 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className={cn("border rounded-lg bg-white", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleSort('location')}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Location
                <SortIcon field="location" />
              </Button>
            </TableHead>
            <TableHead>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleSort('percentage')}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Fuel Level
                <SortIcon field="percentage" />
              </Button>
            </TableHead>
            <TableHead>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleSort('capacity')}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Capacity
                <SortIcon field="capacity" />
              </Button>
            </TableHead>
            <TableHead>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleSort('consumption')}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Daily Usage
                <SortIcon field="consumption" />
              </Button>
            </TableHead>
            <TableHead>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleSort('daysRemaining')}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Days Left
                <SortIcon field="daysRemaining" />
              </Button>
            </TableHead>
            <TableHead>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleSort('status')}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Status
                <SortIcon field="status" />
              </Button>
            </TableHead>
            <TableHead>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleSort('lastReading')}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Last Reading
                <SortIcon field="lastReading" />
              </Button>
            </TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedLocations.map((location) => {
            const mainAsset = location.assets?.[0];
            const isOnline = location.location_status === 2 && (mainAsset?.device_online ?? false);
            const percentage = location.latest_calibrated_fill_percentage ?? mainAsset?.latest_calibrated_fill_percentage;
            
            // Calculate capacity and current volume
            const capacityFromName = mainAsset?.asset_profile_name?.match(/[\d,]+/)?.[0]?.replace(/,/g, '');
            const capacityFromRawData = location.raw_data?.AssetProfileWaterCapacity;
            const capacity = capacityFromRawData ||
                            mainAsset?.asset_profile_water_capacity ||
                            mainAsset?.asset_refill_capacity_litres ||
                            (capacityFromName ? parseInt(capacityFromName) : 50000);
            const currentVolume = percentage ? Math.round((percentage / 100) * capacity) : 0;
            
            // Consumption data - convert percentage to actual litres
            const dailyConsumptionPct = mainAsset?.asset_daily_consumption || location.location_daily_consumption;
            const dailyConsumptionLitres = dailyConsumptionPct ? Math.round((dailyConsumptionPct / 100) * capacity) : null;
            const daysRemaining = mainAsset?.asset_days_remaining;
            
            return (
              <TableRow 
                key={location.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => openModal(location)}
              >
                {/* Location */}
                <TableCell className="font-medium">
                  <div>
                    <div className="font-semibold">
                      {location.location_id || 'Unknown Location'}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3" />
                      {[location.address1, location.address2, location.state]
                        .filter(Boolean)
                        .join(', ') || 'No address'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {location.customer_name || 'Unknown Customer'}
                    </div>
                  </div>
                </TableCell>
                
                {/* Fuel Level */}
                <TableCell>
                  <div className="space-y-1">
                    {getPercentageDisplay(percentage)}
                    <div className="text-xs text-muted-foreground">
                      {currentVolume.toLocaleString()}L current
                    </div>
                  </div>
                </TableCell>
                
                {/* Capacity */}
                <TableCell>
                  <div className="text-sm">
                    <div className="font-semibold">{capacity.toLocaleString()}L</div>
                    <div className="text-xs text-muted-foreground">
                      {mainAsset?.asset_profile_name?.includes('Diesel') ? 'Diesel' : 
                       mainAsset?.asset_profile_name?.includes('Water') ? 'Water' : 'Fuel'}
                    </div>
                  </div>
                </TableCell>
                
                {/* Daily Usage */}
                <TableCell>
                  {dailyConsumptionLitres ? (
                    <div className="text-sm">
                      <div className="font-semibold">{dailyConsumptionLitres.toLocaleString()}L</div>
                      <div className="text-xs text-muted-foreground">per day</div>
                    </div>
                  ) : dailyConsumptionPct ? (
                    <div className="text-sm">
                      <div className="font-semibold">{dailyConsumptionPct.toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">per day</div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">No data</span>
                  )}
                </TableCell>
                
                {/* Days Remaining */}
                <TableCell>
                  {daysRemaining ? (
                    <div className="text-sm">
                      <div className={`font-semibold ${
                        daysRemaining <= 7 ? 'text-red-600' : 
                        daysRemaining <= 30 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {daysRemaining} days
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">–</span>
                  )}
                </TableCell>
                
                {/* Status */}
                <TableCell>
                  <div className="space-y-1">
                    {getStatusBadge(location)}
                    <div className="text-xs text-muted-foreground">
                      {mainAsset?.device_serial_number && `#${mainAsset.device_serial_number.slice(-4)}`}
                    </div>
                  </div>
                </TableCell>
                
                {/* Last Reading */}
                <TableCell>
                  <div className="text-sm">
                    <div className={isOnline ? 'text-green-600' : 'text-red-600'}>
                      {formatTimestamp(location.latest_telemetry)}
                    </div>
                    {location.latest_telemetry && (
                      <div className="text-xs text-muted-foreground">
                        {new Date(location.latest_telemetry).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      
      {sortedLocations.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Signal className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No agbot locations to display</p>
        </div>
      )}
    </div>
  );
}