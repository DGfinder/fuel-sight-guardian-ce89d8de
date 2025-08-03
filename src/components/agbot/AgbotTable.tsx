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

type SortField = 'location' | 'customer' | 'percentage' | 'status' | 'lastReading';
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

    if (isOnline && deviceOnline) {
      return <Badge className="bg-green-500 text-white">Online</Badge>;
    } else {
      return <Badge variant="secondary">Offline</Badge>;
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
                onClick={() => handleSort('customer')}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Customer
                <SortIcon field="customer" />
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
                onClick={() => handleSort('status')}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Status
                <SortIcon field="status" />
              </Button>
            </TableHead>
            <TableHead>Device</TableHead>
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
            
            return (
              <TableRow 
                key={location.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => openModal(location)}
              >
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
                  </div>
                </TableCell>
                
                <TableCell>
                  <div className="text-sm">
                    {location.customer_name || 'Unknown Customer'}
                  </div>
                </TableCell>
                
                <TableCell>
                  {getPercentageDisplay(location.latest_calibrated_fill_percentage)}
                </TableCell>
                
                <TableCell>
                  {getStatusBadge(location)}
                </TableCell>
                
                <TableCell>
                  <div className="text-sm">
                    <div className="flex items-center gap-1">
                      {isOnline ? 
                        <Signal className="h-3 w-3 text-green-500" /> : 
                        <Signal className="h-3 w-3 text-gray-400" />
                      }
                      {mainAsset?.device_sku_name || 'Unknown Device'}
                    </div>
                    {mainAsset?.device_serial_number && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        #{mainAsset.device_serial_number}
                      </div>
                    )}
                  </div>
                </TableCell>
                
                <TableCell>
                  <div className="text-sm">
                    <div className={isOnline ? 'text-green-600' : 'text-red-600'}>
                      {formatTimestamp(location.latest_telemetry)}
                    </div>
                    {location.latest_telemetry && (
                      <div className="text-xs text-muted-foreground">
                        {new Date(location.latest_telemetry).toLocaleString()}
                      </div>
                    )}
                  </div>
                </TableCell>
                
                <TableCell>
                  <div className="flex items-center justify-center">
                    {location.assets && location.assets.length > 1 && (
                      <Badge variant="outline" className="text-xs">
                        +{location.assets.length - 1}
                      </Badge>
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