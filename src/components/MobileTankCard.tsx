import React, { useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  MapPin, 
  Droplets, 
  Clock, 
  AlertTriangle, 
  Fuel,
  TrendingDown,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { useTouchGestures } from '@/hooks/useTouchGestures';
import type { Tank } from '@/types/fuel';

interface MobileTankCardProps {
  tank: Tank;
  onTap?: () => void;
  onLongPress?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export function MobileTankCard({ 
  tank, 
  onTap, 
  onLongPress,
  onSwipeLeft,
  onSwipeRight 
}: MobileTankCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const { attachListeners } = useTouchGestures({
    onTap,
    onLongPress,
    onSwipeLeft,
    onSwipeRight,
    enableTap: !!onTap,
    enableLongPress: !!onLongPress,
    enableSwipe: !!(onSwipeLeft || onSwipeRight),
    threshold: 60,
    longPressDelay: 600,
  });

  useEffect(() => {
    if (cardRef.current) {
      return attachListeners(cardRef.current);
    }
  }, [attachListeners]);

  const getStatusColor = () => {
    const level = tank.current_level_percent || 0;
    if (level <= 10) return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'destructive' as const };
    if (level <= 20) return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'secondary' as const };
    return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'default' as const };
  };

  const statusColor = getStatusColor();
  const level = tank.current_level_percent || 0;

  return (
    <Card 
      ref={cardRef}
      className={`
        ${statusColor.bg} ${statusColor.border} 
        border-2 transition-all duration-200 
        active:scale-95 active:shadow-lg
        touch-manipulation select-none
        relative overflow-hidden
      `}
      style={{ 
        WebkitTapHighlightColor: 'transparent',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* Swipe indicators */}
      {(onSwipeLeft || onSwipeRight) && (
        <div className="absolute top-2 right-2 text-xs text-gray-400">
          ← →
        </div>
      )}

      <CardContent className="p-4 space-y-3">
        {/* Header with location and status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate flex items-center gap-1">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              {tank.location || 'Unknown Location'}
            </h3>
            {tank.group_name && (
              <p className="text-xs text-gray-600 mt-1">{tank.group_name}</p>
            )}
          </div>
          <Badge 
            variant={statusColor.badge}
            className="text-xs px-2 py-1 flex-shrink-0"
          >
            {level <= 10 ? 'Critical' : level <= 20 ? 'Low' : 'Normal'}
          </Badge>
        </div>

        {/* Fuel level progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1">
              <Fuel className="h-3 w-3" />
              Fuel Level
            </span>
            <span className={`font-medium ${statusColor.text}`}>
              {level.toFixed(1)}%
            </span>
          </div>
          <Progress 
            value={level} 
            className="h-2"
            indicatorClassName={
              level <= 10 ? 'bg-red-500' : 
              level <= 20 ? 'bg-amber-500' : 
              'bg-green-500'
            }
          />
        </div>

        {/* Key metrics in grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          {/* Current volume */}
          <div className="flex items-center gap-1">
            <Droplets className="h-3 w-3 text-blue-500" />
            <div>
              <div className="font-medium">{tank.current_level || 0}L</div>
              <div className="text-gray-500">Current</div>
            </div>
          </div>

          {/* Days to minimum */}
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-orange-500" />
            <div>
              <div className="font-medium">
                {tank.days_to_min_level ? `${tank.days_to_min_level}d` : 'N/A'}
              </div>
              <div className="text-gray-500">To Min</div>
            </div>
          </div>

          {/* Rolling average */}
          {tank.rolling_avg && (
            <div className="flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-purple-500" />
              <div>
                <div className="font-medium">{tank.rolling_avg.toFixed(0)}L/d</div>
                <div className="text-gray-500">Avg Use</div>
              </div>
            </div>
          )}

          {/* Last reading */}
          {tank.latest_dip_date && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-gray-500" />
              <div>
                <div className="font-medium">
                  {format(new Date(tank.latest_dip_date), 'MMM d')}
                </div>
                <div className="text-gray-500">Last Dip</div>
              </div>
            </div>
          )}
        </div>

        {/* Critical level warning */}
        {level <= 10 && (
          <div className="flex items-center gap-2 p-2 bg-red-100 rounded-md">
            <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
            <span className="text-xs text-red-700">
              Critical fuel level - immediate attention required
            </span>
          </div>
        )}

        {/* Touch instruction hint */}
        {(onTap || onLongPress) && (
          <div className="text-center">
            <div className="text-xs text-gray-400 border-t pt-2">
              {onTap && 'Tap for details'}
              {onTap && onLongPress && ' • '}
              {onLongPress && 'Hold for menu'}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}