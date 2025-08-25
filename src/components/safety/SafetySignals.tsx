/**
 * Safety Signals Component
 * Actionable safety insights for driver modal
 * Shows Most Common Event and Events per 1,000 km with fleet comparison
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp } from 'lucide-react';

interface SafetySignalsProps {
  events30: number;
  km30: number;
  events90: number;
  fleetMedianPer1k: number;
  mostCommonEvent?: string;
  driverName?: string;
}

const SafetySignals: React.FC<SafetySignalsProps> = ({
  events30,
  km30,
  events90,
  fleetMedianPer1k,
  mostCommonEvent,
  driverName
}) => {
  // Calculate events per 1,000 km for 30-day period
  const eventsPer1k = km30 > 0 ? (events30 / km30) * 1000 : 0;
  
  // Determine fleet comparison badge
  const getFleetComparisonBadge = () => {
    if (eventsPer1k === 0) {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Excellent</Badge>;
    }
    
    const ratio = eventsPer1k / fleetMedianPer1k;
    
    if (ratio <= 0.5) {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Above Fleet Avg</Badge>;
    } else if (ratio <= 0.8) {
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Near Fleet Avg</Badge>;
    } else if (ratio <= 1.2) {
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">At Fleet Avg</Badge>;
    } else if (ratio <= 2.0) {
      return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Below Fleet Avg</Badge>;
    } else {
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Requires Attention</Badge>;
    }
  };

  // Human-readable event type formatting
  const formatEventType = (eventType: string): string => {
    const humanLabels: Record<string, string> = {
      food_or_drink: "Food or drink",
      mobile_phone: "Mobile phone use", 
      seatbelt: "Seatbelt violation",
      distracted_driving: "Distracted driving",
      harsh_acceleration: "Harsh acceleration",
      harsh_braking: "Harsh braking",
      harsh_cornering: "Harsh cornering",
      speeding: "Speeding",
      following_too_close: "Following too close",
      drowsy_driving: "Drowsy driving",
      fatigue: "Driver fatigue"
    };
    
    return humanLabels[eventType] || eventType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-orange-600" />
          Safety Signals
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Most Common Event */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <span className="font-medium text-gray-700">Most Common Event</span>
          </div>
          <div className="text-right">
            {mostCommonEvent ? (
              <span className="font-semibold text-gray-900">{formatEventType(mostCommonEvent)}</span>
            ) : (
              <span className="text-gray-500">No events recorded</span>
            )}
          </div>
        </div>

        {/* Events per 1,000 km with Fleet Comparison */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-gray-700">Events per 1,000 km</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg text-gray-900">
              {eventsPer1k.toFixed(1)}
            </span>
            {getFleetComparisonBadge()}
          </div>
        </div>

        {/* Context Information */}
        <div className="text-xs text-gray-500 pt-2 border-t">
          Based on {events30} events over {Math.round(km30).toLocaleString()} km in the last 30 days
          {fleetMedianPer1k > 0 && ` • Fleet average: ${fleetMedianPer1k.toFixed(1)} events/1,000km`}
        </div>
      </CardContent>
    </Card>
  );
};

export default SafetySignals;