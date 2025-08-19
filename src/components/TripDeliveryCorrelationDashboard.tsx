/**
 * TRIP-DELIVERY CORRELATION DASHBOARD
 * 
 * Dashboard for viewing and managing correlations between MTdata trips and captive payment deliveries
 * Provides analysis results, confidence scoring, and manual verification capabilities
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  TrendingUp, 
  MapPin, 
  Clock, 
  Target,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { useDateRangeFilter } from '@/hooks/useDateRangeFilter';
import CompactDateFilter from '@/components/CompactDateFilter';

interface CorrelationResult {
  id: string;
  mtdata_trip_id: string;
  trip_external_id: string;
  trip_date: string;
  terminal_name: string;
  customer_name: string;
  carrier: string;
  confidence_score: number;
  confidence_level: string;
  terminal_distance_km: number;
  within_terminal_service_area: boolean;
  date_difference_days: number;
  delivery_volume_litres: number;
  verified_by_user: boolean;
  requires_manual_review: boolean;
  vehicle_registration?: string;
  group_name?: string;
}

interface AnalyticsSummary {
  total_correlations: number;
  high_confidence_count: number;
  verified_count: number;
  needs_review_count: number;
  avg_confidence_score: number;
  total_correlated_volume: number;
  correlation_rate: number;
  by_terminal: Array<{
    terminal_name: string;
    correlations: number;
    avg_confidence: number;
  }>;
  by_carrier: Array<{
    carrier: string;
    correlations: number;
    avg_confidence: number;
  }>;
}

const TripDeliveryCorrelationDashboard: React.FC = () => {
  const [correlations, setCorrelations] = useState<CorrelationResult[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [minConfidence, setMinConfidence] = useState(50);
  const [selectedCarrier, setSelectedCarrier] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const { startDate, endDate, setDateRange, isFiltered, clearDateRange } = useDateRangeFilter();

  // Load correlation data
  const loadCorrelations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/trip-delivery-correlation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_correlations',
          date_from: isFiltered && startDate ? startDate.toISOString().split('T')[0] : undefined,
          date_to: isFiltered && endDate ? endDate.toISOString().split('T')[0] : undefined,
          carrier: selectedCarrier || undefined,
          min_confidence: minConfidence
        })
      });

      if (!response.ok) throw new Error('Failed to load correlations');
      
      const data = await response.json();
      setCorrelations(data.correlations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load correlations');
    } finally {
      setIsLoading(false);
    }
  }, [isFiltered, startDate, endDate, selectedCarrier, minConfidence]);

  // Load summary analytics
  const loadSummary = async () => {
    try {
      const response = await fetch('/api/trip-delivery-correlation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_summary' })
      });

      if (!response.ok) throw new Error('Failed to load summary');
      
      const data = await response.json();
      setSummary(data.summary);
    } catch (err) {
      console.error('Failed to load summary:', err);
    }
  };

  // Run new correlation analysis (hybrid by default)
  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch('/api/trip-delivery-correlation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze_hybrid',
          date_from: isFiltered && startDate ? startDate.toISOString().split('T')[0] : undefined,
          date_to: isFiltered && endDate ? endDate.toISOString().split('T')[0] : undefined,
          fleet_filter: selectedCarrier || undefined,
          min_confidence: minConfidence,
          max_trips: 500,
          enable_text_matching: true,
          enable_geospatial: true,
          enable_lookup_boost: true,
          clear_existing: false
        })
      });

      if (!response.ok) throw new Error('Analysis failed');
      
      const data = await response.json();
      
      // Show analysis results
      if (data.success) {
        console.log('Hybrid analysis completed:', {
          trips_processed: data.trips_processed,
          correlations_created: data.correlations_created,
          high_confidence_matches: data.high_confidence_matches,
          avg_confidence: data.avg_confidence,
          processing_time: data.processing_time_seconds
        });
      }
      
      // Refresh data after analysis
      await Promise.all([loadCorrelations(), loadSummary()]);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Verify a correlation
  const verifyCorrelation = async (correlationId: string, notes?: string) => {
    try {
      const response = await fetch('/api/trip-delivery-correlation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_correlation',
          correlation_id: correlationId,
          verification_notes: notes
        })
      });

      if (!response.ok) throw new Error('Verification failed');
      
      // Refresh correlations
      await loadCorrelations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    }
  };

  // Load data on component mount and when filters change
  useEffect(() => {
    loadCorrelations();
    loadSummary();
  }, [loadCorrelations]);

  // Helper function to get confidence badge color
  const getConfidenceBadgeColor = (score: number) => {
    if (score >= 90) return 'bg-green-100 text-green-800';
    if (score >= 75) return 'bg-blue-100 text-blue-800';
    if (score >= 50) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trip-Delivery Correlations</h1>
          <p className="text-gray-600">Match MTdata trips with captive payment deliveries</p>
        </div>
        <Button onClick={runAnalysis} disabled={isAnalyzing} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
          {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Date Range</Label>
              <CompactDateFilter 
                startDate={startDate}
                endDate={endDate}
                onDateRangeChange={setDateRange}
                onClear={clearDateRange}
                isFiltered={isFiltered}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Carrier</Label>
              <select 
                value={selectedCarrier} 
                onChange={(e) => setSelectedCarrier(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="">All Carriers</option>
                <option value="SMB">SMB</option>
                <option value="GSF">GSF</option>
                <option value="Combined">Combined</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <Label>Min Confidence %</Label>
              <Input 
                type="number" 
                value={minConfidence} 
                onChange={(e) => setMinConfidence(parseInt(e.target.value) || 0)}
                min="0" 
                max="100"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="text-2xl font-bold">{summary.total_correlations}</div>
                  <p className="text-sm text-gray-600">Total Correlations</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <div>
                  <div className="text-2xl font-bold">{summary.high_confidence_count}</div>
                  <p className="text-sm text-gray-600">High Confidence</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <div className="text-2xl font-bold">{summary.verified_count}</div>
                  <p className="text-sm text-gray-600">Verified</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <div>
                  <div className="text-2xl font-bold">{summary.needs_review_count}</div>
                  <p className="text-sm text-gray-600">Needs Review</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Correlations Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Correlation Results
          </CardTitle>
          <CardDescription>
            {correlations.length} correlations found
            {isFiltered && ` (filtered)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading correlations...</span>
            </div>
          ) : correlations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No correlations found. Try running an analysis or adjusting filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Trip</th>
                    <th className="text-left py-2">Terminal</th>
                    <th className="text-left py-2">Customer</th>
                    <th className="text-left py-2">Confidence</th>
                    <th className="text-left py-2">Distance</th>
                    <th className="text-left py-2">Date Diff</th>
                    <th className="text-left py-2">Volume</th>
                    <th className="text-left py-2">Status</th>
                    <th className="text-left py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {correlations.map((correlation) => (
                    <tr key={correlation.id} className="border-b hover:bg-gray-50">
                      <td className="py-2">
                        <div>
                          <div className="font-medium">{correlation.trip_external_id}</div>
                          <div className="text-xs text-gray-500">{correlation.vehicle_registration}</div>
                        </div>
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {correlation.terminal_name}
                        </div>
                      </td>
                      <td className="py-2 max-w-xs truncate">{correlation.customer_name}</td>
                      <td className="py-2">
                        <Badge className={getConfidenceBadgeColor(correlation.confidence_score)}>
                          {Math.round(correlation.confidence_score)}%
                        </Badge>
                      </td>
                      <td className="py-2">{correlation.terminal_distance_km.toFixed(1)}km</td>
                      <td className="py-2">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {Math.abs(correlation.date_difference_days)}d
                        </div>
                      </td>
                      <td className="py-2">
                        {correlation.delivery_volume_litres ? 
                          `${(correlation.delivery_volume_litres / 1000).toFixed(1)}kL` : 
                          'N/A'
                        }
                      </td>
                      <td className="py-2">
                        {correlation.verified_by_user ? (
                          <Badge className="bg-green-100 text-green-800">Verified</Badge>
                        ) : correlation.requires_manual_review ? (
                          <Badge className="bg-yellow-100 text-yellow-800">Review</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-800">Pending</Badge>
                        )}
                      </td>
                      <td className="py-2">
                        {!correlation.verified_by_user && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => verifyCorrelation(correlation.id)}
                          >
                            Verify
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Terminal & Carrier Breakdown */}
      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>By Terminal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {summary.by_terminal.slice(0, 5).map((terminal) => (
                  <div key={terminal.terminal_name} className="flex justify-between items-center">
                    <span className="text-sm">{terminal.terminal_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{terminal.correlations}</span>
                      <Badge className="text-xs">
                        {terminal.avg_confidence.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>By Carrier</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {summary.by_carrier.map((carrier) => (
                  <div key={carrier.carrier} className="flex justify-between items-center">
                    <span className="text-sm">{carrier.carrier}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{carrier.correlations}</span>
                      <Badge className="text-xs">
                        {carrier.avg_confidence.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default TripDeliveryCorrelationDashboard;