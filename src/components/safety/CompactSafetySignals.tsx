/**
 * Compact Safety Signals Component
 * Expandable safety insights for stat card grid
 * Fits within the 4-card layout with collapsible details
 */

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, TrendingUp, AlertTriangle } from 'lucide-react';

interface CompactSafetySignalsProps {
  events30: number;
  km30: number;
  events90?: number;
  fleetMedianPer1k: number;
  mostCommonEvent?: string;
  driverName?: string;
}

const CompactSafetySignals: React.FC<CompactSafetySignalsProps> = ({
  events30,
  km30,
  events90,
  fleetMedianPer1k,
  mostCommonEvent,
  driverName
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate events per 1,000 km for 30-day period
  const eventsPer1k = km30 > 0 ? (events30 / km30) * 1000 : 0;
  
  // Determine fleet comparison badge
  const getFleetComparisonBadge = () => {
    if (eventsPer1k === 0) {
      return { text: "Excellent", className: "bg-green-100 text-green-700 border-green-200" };
    }
    
    const ratio = eventsPer1k / fleetMedianPer1k;
    
    if (ratio <= 0.5) {
      return { text: "Above Avg", className: "bg-green-100 text-green-700 border-green-200" };
    } else if (ratio <= 0.8) {
      return { text: "Near Avg", className: "bg-blue-100 text-blue-700 border-blue-200" };
    } else if (ratio <= 1.2) {
      return { text: "At Avg", className: "bg-yellow-100 text-yellow-700 border-yellow-200" };
    } else if (ratio <= 2.0) {
      return { text: "Below Avg", className: "bg-orange-100 text-orange-700 border-orange-200" };
    } else {
      return { text: "Attention", className: "bg-red-100 text-red-700 border-red-200" };
    }
  };

  // Human-readable event type formatting
  const formatEventType = (eventType: string): string => {
    const humanLabels: Record<string, string> = {
      food_or_drink: "Food/Drink",
      mobile_phone: "Phone Use", 
      seatbelt: "Seatbelt",
      distracted_driving: "Distraction",
      harsh_acceleration: "Hard Accel",
      harsh_braking: "Hard Brake",
      harsh_cornering: "Hard Turn",
      speeding: "Speeding",
      following_too_close: "Following",
      drowsy_driving: "Drowsy",
      fatigue: "Fatigue"
    };
    
    return humanLabels[eventType] || eventType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const badge = getFleetComparisonBadge();

  return (
    <Card 
      className="h-full cursor-pointer transition-all hover:shadow-md border-2 hover:border-orange-200"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-orange-600" />
            <span className="text-sm font-medium text-gray-700">Safety Signals</span>
          </div>
          {isExpanded ? 
            <ChevronDown className="h-4 w-4 text-gray-400" /> : 
            <ChevronRight className="h-4 w-4 text-gray-400" />
          }
        </div>

        {/* Collapsed State */}
        {!isExpanded && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-gray-900">
                {eventsPer1k.toFixed(1)}
              </span>
              <Badge variant="outline" className={`text-xs ${badge.className}`}>
                {badge.text}
              </Badge>
            </div>
            <div className="text-xs text-gray-500">
              Events/1,000km
            </div>
          </div>
        )}

        {/* Expanded State */}
        {isExpanded && (
          <div className="space-y-3">
            {/* Events per 1,000 km */}
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-blue-600" />
                <span className="text-xs font-medium">Events/1,000km</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">{eventsPer1k.toFixed(1)}</span>
                <Badge variant="outline" className={`text-xs ${badge.className}`}>
                  {badge.text}
                </Badge>
              </div>
            </div>

            {/* Most Common Event */}
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-orange-600" />
                <span className="text-xs font-medium">Most Common</span>
              </div>
              <div className="text-xs font-semibold text-gray-900">
                {mostCommonEvent ? formatEventType(mostCommonEvent) : 'None'}
              </div>
            </div>

            {/* Context */}
            <div className="text-xs text-gray-500 pt-1 border-t">
              {events30} events over {Math.round(km30).toLocaleString()} km
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CompactSafetySignals;