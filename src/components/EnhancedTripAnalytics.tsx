/**
 * ENHANCED TRIP ANALYTICS WITH CORRELATION DATA
 * 
 * Integrates MTdata trip analytics with captive payment correlation information
 * Shows delivery correlation status alongside trip performance metrics
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Truck, 
  MapPin, 
  Clock, 
  Target,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Package,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface TripWithCorrelation {
  id: string;
  trip_external_id: string;
  vehicle_registration: string;
  group_name: string;
  start_time: string;
  end_time: string;
  start_location: string;
  end_location: string;
  distance_km: number;
  travel_time_hours: number;
  average_speed_kph: number;
  trip_date: string;
  
  // Correlation data
  correlation_id?: string;
  correlation_confidence?: number;
  correlation_terminal?: string;
  correlation_customer?: string;
  correlation_verified?: boolean;
  correlation_needs_review?: boolean;
  delivery_volume_litres?: number;
  correlation_status: 'matched' | 'potential' | 'none' | 'verified';
}

interface CorrelationSummary {
  total_trips: number;
  matched_trips: number;
  verified_matches: number;
  potential_matches: number;
  correlation_rate: number;
  avg_confidence: number;
  total_correlated_volume: number;
}

interface EnhancedTripAnalyticsProps {
  dateRange?: number; // days to look back
  fleet?: string;
  depot?: string;
}

const EnhancedTripAnalytics: React.FC<EnhancedTripAnalyticsProps> = ({
  dateRange = 7,
  fleet,
  depot
}) => {
  const [trips, setTrips] = useState<TripWithCorrelation[]>([]);
  const [summary, setSummary] = useState<CorrelationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<TripWithCorrelation | null>(null);

  // Load trips with correlation data
  const loadTripsWithCorrelations = async () => {
    setLoading(true);
    setError(null);

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - dateRange);

      // Query trips with left join to correlations
      let query = supabase
        .from('mtdata_trip_history')
        .select(`
          id,
          trip_external_id,
          vehicle_registration,
          group_name,
          start_time,
          end_time,
          start_location,
          end_location,
          distance_km,
          travel_time_hours,
          average_speed_kph,
          trip_date_computed,
          mtdata_captive_correlations(
            id,
            confidence_score,
            terminal_name,
            customer_name,
            verified_by_user,
            requires_manual_review,
            delivery_volume_litres
          )
        `)
        .gte('trip_date_computed', startDate.toISOString().split('T')[0])
        .lte('trip_date_computed', endDate.toISOString().split('T')[0])
        .order('start_time', { ascending: false })
        .limit(200);

      if (fleet) {
        // Assuming group_name corresponds to fleet
        query = query.ilike('group_name', `%${fleet}%`);
      }

      const { data: tripsData, error: tripsError } = await query;

      if (tripsError) throw tripsError;

      // Transform data to include correlation status
      const transformedTrips: TripWithCorrelation[] = (tripsData || []).map(trip => {
        const correlation = Array.isArray(trip.mtdata_captive_correlations) 
          ? trip.mtdata_captive_correlations[0] 
          : trip.mtdata_captive_correlations;

        let correlationStatus: 'matched' | 'potential' | 'none' | 'verified' = 'none';
        
        if (correlation) {
          if (correlation.verified_by_user) {
            correlationStatus = 'verified';
          } else if (correlation.confidence_score >= 75) {
            correlationStatus = 'matched';
          } else {
            correlationStatus = 'potential';
          }
        }

        return {
          id: trip.id,
          trip_external_id: trip.trip_external_id,
          vehicle_registration: trip.vehicle_registration,
          group_name: trip.group_name,
          start_time: trip.start_time,
          end_time: trip.end_time,
          start_location: trip.start_location || '',
          end_location: trip.end_location || '',
          distance_km: trip.distance_km,
          travel_time_hours: trip.travel_time_hours,
          average_speed_kph: trip.average_speed_kph,
          trip_date: trip.trip_date_computed,
          
          correlation_id: correlation?.id,
          correlation_confidence: correlation?.confidence_score,
          correlation_terminal: correlation?.terminal_name,
          correlation_customer: correlation?.customer_name,
          correlation_verified: correlation?.verified_by_user || false,
          correlation_needs_review: correlation?.requires_manual_review || false,
          delivery_volume_litres: correlation?.delivery_volume_litres,
          correlation_status: correlationStatus
        };
      });

      setTrips(transformedTrips);

      // Calculate summary
      const totalTrips = transformedTrips.length;
      const matchedTrips = transformedTrips.filter(t => t.correlation_status !== 'none').length;
      const verifiedMatches = transformedTrips.filter(t => t.correlation_status === 'verified').length;
      const potentialMatches = transformedTrips.filter(t => t.correlation_status === 'potential').length;
      const correlationRate = totalTrips > 0 ? (matchedTrips / totalTrips) * 100 : 0;
      
      const confidenceScores = transformedTrips
        .filter(t => t.correlation_confidence !== undefined)
        .map(t => t.correlation_confidence!);
      const avgConfidence = confidenceScores.length > 0 
        ? confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length 
        : 0;

      const totalVolume = transformedTrips
        .filter(t => t.delivery_volume_litres)
        .reduce((sum, t) => sum + (t.delivery_volume_litres || 0), 0);

      setSummary({
        total_trips: totalTrips,
        matched_trips: matchedTrips,
        verified_matches: verifiedMatches,
        potential_matches: potentialMatches,
        correlation_rate: correlationRate,
        avg_confidence: avgConfidence,
        total_correlated_volume: totalVolume
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trip data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTripsWithCorrelations();
  }, [dateRange, fleet, depot]);

  // Helper functions
  const getCorrelationStatusBadge = (status: string, confidence?: number) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-100 text-green-800">Verified</Badge>;
      case 'matched':
        return <Badge className="bg-blue-100 text-blue-800">{confidence?.toFixed(0)}% Match</Badge>;
      case 'potential':
        return <Badge className="bg-yellow-100 text-yellow-800">{confidence?.toFixed(0)}% Potential</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">No Match</Badge>;
    }
  };

  const getCorrelationIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'matched':
        return <Target className="h-4 w-4 text-blue-600" />;
      case 'potential':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading trip analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="p-6">
          <div className="text-center text-red-800">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>Error loading trip analytics: {error}</p>
            <Button onClick={loadTripsWithCorrelations} className="mt-4">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Enhanced Trip Analytics</h2>
        <p className="text-gray-600">Trip performance with delivery correlation analysis</p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="text-2xl font-bold">{summary.total_trips}</div>
                  <p className="text-sm text-gray-600">Total Trips</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-green-600" />
                <div>
                  <div className="text-2xl font-bold">{summary.matched_trips}</div>
                  <p className="text-sm text-gray-600">Correlated Trips</p>
                  <p className="text-xs text-gray-500">{summary.correlation_rate.toFixed(1)}% rate</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <div className="text-2xl font-bold">{summary.verified_matches}</div>
                  <p className="text-sm text-gray-600">Verified Matches</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-purple-600" />
                <div>
                  <div className="text-2xl font-bold">
                    {(summary.total_correlated_volume / 1000000).toFixed(1)}ML
                  </div>
                  <p className="text-sm text-gray-600">Correlated Volume</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Trips Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Recent Trips with Correlation Status
          </CardTitle>
          <CardDescription>
            Last {dateRange} days • {trips.length} trips
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Trip</th>
                  <th className="text-left py-2">Vehicle</th>
                  <th className="text-left py-2">Route</th>
                  <th className="text-left py-2">Performance</th>
                  <th className="text-left py-2">Correlation</th>
                  <th className="text-left py-2">Delivery Info</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((trip) => (
                  <tr key={trip.id} className="border-b hover:bg-gray-50">
                    <td className="py-2">
                      <div>
                        <div className="font-medium">{trip.trip_external_id}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(trip.start_time).toLocaleDateString()}
                        </div>
                      </div>
                    </td>
                    <td className="py-2">
                      <div>
                        <div className="font-medium">{trip.vehicle_registration}</div>
                        <div className="text-xs text-gray-500">{trip.group_name}</div>
                      </div>
                    </td>
                    <td className="py-2">
                      <div className="max-w-xs">
                        <div className="flex items-center gap-1 text-xs">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{trip.start_location || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <span>→</span>
                          <span className="truncate">{trip.end_location || 'Unknown'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2">
                      <div className="text-xs space-y-1">
                        <div>{trip.distance_km.toFixed(1)}km</div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {trip.travel_time_hours.toFixed(1)}h
                        </div>
                        <div>{trip.average_speed_kph?.toFixed(0) || 0}kph</div>
                      </div>
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        {getCorrelationIcon(trip.correlation_status)}
                        {getCorrelationStatusBadge(trip.correlation_status, trip.correlation_confidence)}
                      </div>
                    </td>
                    <td className="py-2">
                      {trip.correlation_terminal ? (
                        <div className="text-xs space-y-1">
                          <div className="font-medium">{trip.correlation_terminal}</div>
                          <div className="text-gray-500 truncate max-w-xs">
                            {trip.correlation_customer}
                          </div>
                          {trip.delivery_volume_litres && (
                            <div className="text-green-600">
                              {(trip.delivery_volume_litres / 1000).toFixed(1)}kL
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">No delivery match</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Correlation Performance Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Correlation Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Correlation Rate</span>
                <span className="font-medium">{summary?.correlation_rate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Average Confidence</span>
                <span className="font-medium">{summary?.avg_confidence.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Verified Accuracy</span>
                <span className="font-medium">
                  {summary?.matched_trips && summary.matched_trips > 0 
                    ? ((summary.verified_matches / summary.matched_trips) * 100).toFixed(1)
                    : 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delivery Context</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Trips with Delivery Data</span>
                <span className="font-medium">{summary?.matched_trips || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Total Correlated Volume</span>
                <span className="font-medium">
                  {((summary?.total_correlated_volume || 0) / 1000000).toFixed(1)}ML
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Avg Volume per Trip</span>
                <span className="font-medium">
                  {summary?.matched_trips && summary.matched_trips > 0
                    ? ((summary.total_correlated_volume / summary.matched_trips) / 1000).toFixed(1)
                    : 0}kL
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EnhancedTripAnalytics;