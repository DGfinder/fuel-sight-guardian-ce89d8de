import React from 'react';
import { format } from 'date-fns';
import {
  TrendingUp,
  TrendingDown,
  History,
  User,
  Calendar,
  Droplets
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tank, DipReading } from '@/types/fuel';

interface SimplePreviousDipsProps {
  tank: Tank;
  dipHistory: DipReading[];
  isLoading?: boolean;
}

export function SimplePreviousDips({ tank, dipHistory, isLoading }: SimplePreviousDipsProps) {
  // Get the most recent 20 dip readings
  const recentDips = React.useMemo(() => {
    if (!dipHistory || !Array.isArray(dipHistory)) return [];
    
    return [...dipHistory]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20);
  }, [dipHistory]);

  // Calculate change from previous reading
  const getDipChange = (currentDip: DipReading, index: number) => {
    if (index >= recentDips.length - 1) return null;
    
    const nextDip = recentDips[index + 1]; // Next in chronological order (older)
    const change = currentDip.value - nextDip.value;
    
    return {
      value: change,
      isIncrease: change > 0,
      isDecrease: change < 0,
      isRefuel: change > 100 // Likely a refuel if increase > 100L
    };
  };

  const formatVolumeChange = (change: number) => {
    const absChange = Math.abs(change);
    if (absChange < 1) return `${change.toFixed(1)}L`;
    return `${Math.round(absChange).toLocaleString()}L`;
  };

  const getChangeDisplay = (change: ReturnType<typeof getDipChange>) => {
    if (!change || Math.abs(change.value) < 0.1) return null;

    if (change.isIncrease) {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <TrendingUp className="w-3 h-3" />
          <span className="text-xs font-medium">
            +{formatVolumeChange(change.value)}
            {change.isRefuel && <span className="ml-1 text-green-700">(Refuel)</span>}
          </span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-1 text-blue-600">
          <TrendingDown className="w-3 h-3" />
          <span className="text-xs font-medium">-{formatVolumeChange(change.value)}</span>
        </div>
      );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Previous Dip Readings</h3>
        </div>
        <div className="space-y-3">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!recentDips.length) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Previous Dip Readings</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <Droplets className="w-12 h-12 text-gray-300 mb-3" />
          <h3 className="font-medium text-gray-600 mb-2">No Dip Readings</h3>
          <p className="text-sm text-center">
            No dip readings have been recorded for this tank yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <History className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Previous Dip Readings</h3>
        <Badge variant="outline" className="text-xs">
          {recentDips.length} recent
        </Badge>
      </div>
      
      <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 pr-2">
        {recentDips.map((dip, index) => {
          const change = getDipChange(dip, index);
          
          return (
            <div 
              key={dip.id} 
              className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="font-medium text-sm">
                    {format(new Date(dip.created_at), 'MMM d, yyyy')}
                  </span>
                  <span className="text-xs text-gray-500">
                    {format(new Date(dip.created_at), 'HH:mm')}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-600">
                    {dip.recorded_by || 'Unknown'}
                  </span>
                </div>
              </div>

              <div className="text-right space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">
                    {typeof dip.value === 'number' ? dip.value.toLocaleString() : 'N/A'}L
                  </span>
                </div>
                
                {getChangeDisplay(change)}
              </div>
            </div>
          );
        })}
      </div>
      
      {recentDips.length >= 20 && (
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            Showing most recent 20 readings
          </p>
        </div>
      )}
    </div>
  );
}