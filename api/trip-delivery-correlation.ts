import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './lib/supabase';

/**
 * TRIP-DELIVERY CORRELATION API
 * 
 * Endpoint for analyzing correlations between MTdata trips and captive payment deliveries
 * Provides both real-time analysis and access to stored correlations
 */

// Request/Response Types
interface CorrelationAnalysisRequest {
  action: 'analyze' | 'analyze_hybrid' | 'get_correlations' | 'get_summary' | 'verify_correlation' | 'get_quality_report' | 'run_validation' | 
          'analyze_customer_distance' | 'get_customer_analytics' | 'get_bp_performance' | 'refresh_analytics';
  trip_id?: string;
  date_from?: string;
  date_to?: string;
  carrier?: 'SMB' | 'GSF' | 'Combined';
  min_confidence?: number;
  max_distance_km?: number;
  correlation_id?: string;
  verification_notes?: string;
  
  // Hybrid matching options
  enable_text_matching?: boolean;
  enable_geospatial?: boolean;
  enable_lookup_boost?: boolean;
  fleet_filter?: string;
  max_trips?: number;
  clear_existing?: boolean;
  
  // Customer distance tracking options
  correlation_type?: 'terminal' | 'customer' | 'both';
  customer_type?: string;
  region?: string;
  is_bp_customer?: boolean;
  max_search_radius_km?: number;
}

interface TripCorrelationSummary {
  trip_summary: any;
  terminal_matches: any[];
  delivery_correlations: any[];
  customer_name_matches: any[];
  overall_confidence: number;
  recommended_action: string;
}

interface CorrelationResult {
  id: string;
  mtdata_trip_id: string;
  trip_external_id: string;
  trip_date: string;
  delivery_key: string;
  bill_of_lading: string;
  delivery_date: string;
  customer_name: string;
  terminal_name: string;
  carrier: string;
  match_type: string;
  confidence_score: number;
  confidence_level: string;
  terminal_distance_km: number;
  within_terminal_service_area: boolean;
  date_difference_days: number;
  delivery_volume_litres: number;
  verified_by_user: boolean;
  requires_manual_review: boolean;
  quality_flags: string[];
  
  // Enhanced hybrid matching fields
  confidence_breakdown?: {
    text_confidence: number;
    geo_confidence: number;
    temporal_confidence: number;
    weighted_score: number;
  };
  match_methods?: string[];
  match_quality?: 'excellent' | 'good' | 'fair' | 'poor';
  text_confidence?: number;
  text_match_method?: string;
  normalized_trip_location?: string;
  normalized_customer_name?: string;
  business_identifier_match?: boolean;
  location_reference_match?: boolean;
  geo_confidence?: number;
  temporal_confidence?: number;
  temporal_score?: number;
  matching_algorithm_version?: string;
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

/**
 * Main API handler
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const requestData: CorrelationAnalysisRequest = req.body;
    const { action } = requestData;

    switch (action) {
      case 'analyze':
        return await handleAnalyzeCorrelations(req, res, requestData);
      case 'analyze_hybrid':
        return await handleAnalyzeHybridCorrelations(req, res, requestData);
      case 'get_correlations':
        return await handleGetCorrelations(req, res, requestData);
      case 'get_summary':
        return await handleGetSummary(req, res, requestData);
      case 'verify_correlation':
        return await handleVerifyCorrelation(req, res, requestData);
      case 'get_quality_report':
        return await handleGetQualityReport(req, res, requestData);
      case 'run_validation':
        return await handleRunValidation(req, res, requestData);
      case 'analyze_customer_distance':
        return await handleAnalyzeCustomerDistance(req, res, requestData);
      case 'get_customer_analytics':
        return await handleGetCustomerAnalytics(req, res, requestData);
      case 'get_bp_performance':
        return await handleGetBPPerformance(req, res, requestData);
      case 'refresh_analytics':
        return await handleRefreshAnalytics(req, res, requestData);
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Correlation API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Run correlation analysis for trips in date range
 */
async function handleAnalyzeCorrelations(
  req: VercelRequest, 
  res: VercelResponse, 
  data: CorrelationAnalysisRequest
) {
  const { 
    date_from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    date_to = new Date().toISOString().split('T')[0],
    carrier,
    min_confidence = 50,
    max_distance_km = 100
  } = data;

  try {
    // Run batch correlation analysis
    const { data: correlations, error } = await supabase.rpc(
      'batch_correlate_trips_with_terminals',
      {
        start_date: date_from,
        end_date: date_to,
        max_distance_km,
        carrier_filter: carrier,
        min_confidence
      }
    );

    if (error) throw error;

    // Process and store results
    const correlationData = correlations.map((corr: any) => ({
      mtdata_trip_id: corr.trip_id,
      trip_external_id: corr.trip_external_id,
      trip_date: corr.start_time?.split('T')[0] || date_from,
      terminal_name: corr.terminal_name,
      carrier: corr.carrier_primary,
      match_type: corr.match_type === 'start_point' ? 'geographic_only' : 'geographic_only',
      confidence_score: parseFloat(corr.confidence_score || '0'),
      terminal_distance_km: parseFloat(corr.distance_km || '0'),
      within_terminal_service_area: corr.within_service_area || false,
      matching_trip_point: corr.matching_point || 'start'
    }));

    // Store correlations in database (if we have significant matches)
    if (correlationData.length > 0) {
      const { error: insertError } = await supabase.rpc(
        'bulk_insert_correlations',
        {
          correlations_json: JSON.stringify(correlationData)
        }
      );

      if (insertError) {
        console.warn('Failed to store correlations:', insertError);
      }
    }

    return res.status(200).json({
      success: true,
      analysis_date_range: { from: date_from, to: date_to },
      correlations_found: correlations.length,
      high_confidence_matches: correlations.filter((c: any) => parseFloat(c.confidence_score) >= 75).length,
      correlations: correlations.slice(0, 100) // Limit response size
    });

  } catch (error) {
    console.error('Analysis error:', error);
    return res.status(500).json({
      error: 'Failed to analyze correlations',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get stored correlations with filtering
 */
async function handleGetCorrelations(
  req: VercelRequest, 
  res: VercelResponse, 
  data: CorrelationAnalysisRequest
) {
  const { 
    date_from,
    date_to,
    carrier,
    min_confidence = 0,
    trip_id
  } = data;

  try {
    let query = supabase
      .from('high_confidence_correlations')
      .select('*')
      .gte('confidence_score', min_confidence)
      .order('confidence_score', { ascending: false })
      .order('trip_date', { ascending: false })
      .limit(500);

    if (trip_id) {
      query = query.eq('mtdata_trip_id', trip_id);
    }

    if (date_from) {
      query = query.gte('trip_date', date_from);
    }

    if (date_to) {
      query = query.lte('trip_date', date_to);
    }

    if (carrier) {
      query = query.eq('carrier', carrier);
    }

    const { data: correlations, error } = await query;

    if (error) throw error;

    return res.status(200).json({
      success: true,
      correlations: correlations || [],
      count: correlations?.length || 0,
      filters_applied: { date_from, date_to, carrier, min_confidence }
    });

  } catch (error) {
    console.error('Get correlations error:', error);
    return res.status(500).json({
      error: 'Failed to fetch correlations',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get correlation analytics summary
 */
async function handleGetSummary(
  req: VercelRequest, 
  res: VercelResponse, 
  data: CorrelationAnalysisRequest
) {
  try {
    // Get overall statistics
    const { data: stats, error: statsError } = await supabase
      .from('mtdata_captive_correlations')
      .select(`
        confidence_score,
        confidence_level,
        carrier,
        terminal_name,
        verified_by_user,
        requires_manual_review,
        delivery_volume_litres
      `)
      .eq('is_potential_match', true);

    if (statsError) throw statsError;

    // Get materialized view data
    const { data: analyticsData, error: analyticsError } = await supabase
      .from('correlation_analytics_summary')
      .select('*')
      .order('month', { ascending: false })
      .limit(12);

    if (analyticsError) throw analyticsError;

    const totalCorrelations = stats?.length || 0;
    const highConfidenceCount = stats?.filter(s => s.confidence_score >= 75).length || 0;
    const verifiedCount = stats?.filter(s => s.verified_by_user).length || 0;
    const needsReviewCount = stats?.filter(s => s.requires_manual_review).length || 0;
    const avgConfidence = stats?.length ? 
      stats.reduce((sum, s) => sum + s.confidence_score, 0) / stats.length : 0;
    const totalVolume = stats?.reduce((sum, s) => sum + (s.delivery_volume_litres || 0), 0) || 0;

    // Group by terminal
    const byTerminal = Object.entries(
      stats?.reduce((acc: any, s) => {
        if (!acc[s.terminal_name]) {
          acc[s.terminal_name] = { count: 0, totalConfidence: 0 };
        }
        acc[s.terminal_name].count++;
        acc[s.terminal_name].totalConfidence += s.confidence_score;
        return acc;
      }, {}) || {}
    ).map(([terminal, data]: [string, any]) => ({
      terminal_name: terminal,
      correlations: data.count,
      avg_confidence: Math.round(data.totalConfidence / data.count * 100) / 100
    })).sort((a, b) => b.correlations - a.correlations);

    // Group by carrier
    const byCarrier = Object.entries(
      stats?.reduce((acc: any, s) => {
        if (!acc[s.carrier]) {
          acc[s.carrier] = { count: 0, totalConfidence: 0 };
        }
        acc[s.carrier].count++;
        acc[s.carrier].totalConfidence += s.confidence_score;
        return acc;
      }, {}) || {}
    ).map(([carrier, data]: [string, any]) => ({
      carrier: carrier,
      correlations: data.count,
      avg_confidence: Math.round(data.totalConfidence / data.count * 100) / 100
    }));

    const summary: AnalyticsSummary = {
      total_correlations: totalCorrelations,
      high_confidence_count: highConfidenceCount,
      verified_count: verifiedCount,
      needs_review_count: needsReviewCount,
      avg_confidence_score: Math.round(avgConfidence * 100) / 100,
      total_correlated_volume: totalVolume,
      correlation_rate: totalCorrelations > 0 ? 
        Math.round((highConfidenceCount / totalCorrelations) * 100 * 100) / 100 : 0,
      by_terminal: byTerminal,
      by_carrier: byCarrier
    };

    return res.status(200).json({
      success: true,
      summary,
      monthly_trends: analyticsData || []
    });

  } catch (error) {
    console.error('Get summary error:', error);
    return res.status(500).json({
      error: 'Failed to fetch correlation summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Verify/update a correlation manually
 */
async function handleVerifyCorrelation(
  req: VercelRequest, 
  res: VercelResponse, 
  data: CorrelationAnalysisRequest
) {
  const { correlation_id, verification_notes } = data;

  if (!correlation_id) {
    return res.status(400).json({ error: 'correlation_id is required' });
  }

  try {
    const { data: updated, error } = await supabase
      .from('mtdata_captive_correlations')
      .update({
        verified_by_user: true,
        verified_at: new Date().toISOString(),
        verification_notes,
        requires_manual_review: false
      })
      .eq('id', correlation_id)
      .select();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: 'Correlation verified successfully',
      correlation: updated?.[0]
    });

  } catch (error) {
    console.error('Verify correlation error:', error);
    return res.status(500).json({
      error: 'Failed to verify correlation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Run hybrid correlation analysis using enhanced matching algorithms
 */
async function handleAnalyzeHybridCorrelations(
  req: VercelRequest, 
  res: VercelResponse, 
  data: CorrelationAnalysisRequest
) {
  const { 
    date_from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    date_to = new Date().toISOString().split('T')[0],
    fleet_filter,
    min_confidence = 60,
    max_trips = 500,
    clear_existing = false,
    enable_text_matching = true,
    enable_geospatial = true,
    enable_lookup_boost = true
  } = data;

  try {
    const { data: result, error } = await supabase.rpc(
      'run_hybrid_analysis_batch',
      {
        p_start_date: date_from,
        p_end_date: date_to,
        p_fleet_filter: fleet_filter,
        p_min_confidence: min_confidence,
        p_max_trips: max_trips,
        p_clear_existing: clear_existing
      }
    );

    if (error) throw error;

    const analysisResult = result?.[0];

    return res.status(200).json({
      success: true,
      analysis_run_id: analysisResult?.analysis_run_id,
      analysis_date_range: { from: date_from, to: date_to },
      trips_processed: analysisResult?.trips_processed || 0,
      correlations_created: analysisResult?.correlations_created || 0,
      high_confidence_matches: analysisResult?.high_confidence_matches || 0,
      manual_review_needed: analysisResult?.manual_review_needed || 0,
      avg_confidence: analysisResult?.avg_confidence || 0,
      processing_time_seconds: analysisResult?.processing_time_seconds || 0,
      algorithm_features: {
        text_matching_enabled: enable_text_matching,
        geospatial_enabled: enable_geospatial,
        lookup_boost_enabled: enable_lookup_boost
      }
    });

  } catch (error) {
    console.error('Hybrid analysis error:', error);
    return res.status(500).json({
      error: 'Failed to run hybrid correlation analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get correlation quality report
 */
async function handleGetQualityReport(
  req: VercelRequest, 
  res: VercelResponse, 
  data: CorrelationAnalysisRequest
) {
  try {
    // Get quality dashboard
    const { data: qualityDashboard, error: dashboardError } = await supabase
      .from('correlation_quality_dashboard')
      .select('*')
      .limit(1);

    if (dashboardError) throw dashboardError;

    // Get algorithm performance comparison
    const { data: algorithmPerformance, error: algorithmError } = await supabase
      .from('algorithm_performance_comparison')
      .select('*')
      .order('first_used', { ascending: false });

    if (algorithmError) throw algorithmError;

    // Get terminal performance
    const { data: terminalPerformance, error: terminalError } = await supabase
      .from('terminal_matching_performance')
      .select('*')
      .order('total_correlations', { ascending: false })
      .limit(10);

    if (terminalError) throw terminalError;

    // Get quality trends
    const { data: qualityTrends, error: trendsError } = await supabase
      .from('matching_quality_trends')
      .select('*')
      .order('week_start', { ascending: false })
      .limit(12);

    if (trendsError) throw trendsError;

    return res.status(200).json({
      success: true,
      quality_dashboard: qualityDashboard?.[0] || {},
      algorithm_performance: algorithmPerformance || [],
      terminal_performance: terminalPerformance || [],
      quality_trends: qualityTrends || [],
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Quality report error:', error);
    return res.status(500).json({
      error: 'Failed to generate quality report',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Run matching validation tests
 */
async function handleRunValidation(
  req: VercelRequest, 
  res: VercelResponse, 
  data: CorrelationAnalysisRequest
) {
  try {
    const { data: validationResults, error } = await supabase.rpc(
      'run_matching_validation'
    );

    if (error) throw error;

    return res.status(200).json({
      success: true,
      validation_results: validationResults || [],
      test_summary: {
        total_categories: validationResults?.length || 0,
        overall_pass_rate: validationResults?.length > 0 
          ? (validationResults.reduce((sum: number, r: any) => sum + r.pass_rate, 0) / validationResults.length).toFixed(2)
          : 0
      },
      executed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Validation error:', error);
    return res.status(500).json({
      error: 'Failed to run validation tests',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Analyze customer distance for trips
 */
async function handleAnalyzeCustomerDistance(
  req: VercelRequest, 
  res: VercelResponse, 
  data: CorrelationAnalysisRequest
) {
  const { 
    date_from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    date_to = new Date().toISOString().split('T')[0],
    max_search_radius_km = 50
  } = data;

  try {
    const { data: result, error } = await supabase.rpc(
      'calculate_customer_delivery_distance_batch',
      {
        date_from,
        date_to,
        max_trips: 100,
        max_search_radius_km
      }
    );

    if (error) throw error;

    return res.status(200).json({
      success: true,
      analysis_date_range: { from: date_from, to: date_to },
      trips_processed: result?.trips_processed || 0,
      correlations_created: result?.correlations_created || 0,
      processing_time_seconds: result?.processing_time_seconds || 0
    });

  } catch (error) {
    console.error('Customer distance analysis error:', error);
    return res.status(500).json({
      error: 'Failed to analyze customer distances',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get customer analytics data
 */
async function handleGetCustomerAnalytics(
  req: VercelRequest, 
  res: VercelResponse, 
  data: CorrelationAnalysisRequest
) {
  try {
    let query = supabase
      .from('customer_distance_analytics')
      .select('*');

    // Apply filters
    if (data.customer_type) {
      query = query.eq('customer_type', data.customer_type);
    }
    if (data.region) {
      query = query.eq('region', data.region);
    }
    if (data.is_bp_customer !== undefined) {
      query = query.eq('is_bp_customer', data.is_bp_customer);
    }

    const { data: analytics, error } = await query
      .order('total_correlated_trips', { ascending: false })
      .limit(100);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      customer_analytics: analytics || [],
      total_customers: analytics?.length || 0,
      filters_applied: { 
        customer_type: data.customer_type, 
        region: data.region, 
        is_bp_customer: data.is_bp_customer 
      }
    });

  } catch (error) {
    console.error('Customer analytics error:', error);
    return res.status(500).json({
      error: 'Failed to fetch customer analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get BP customer performance data
 */
async function handleGetBPPerformance(
  req: VercelRequest, 
  res: VercelResponse, 
  data: CorrelationAnalysisRequest
) {
  try {
    const { data: bpPerformance, error } = await supabase
      .from('bp_customer_performance')
      .select('*')
      .order('total_trip_distance_km', { ascending: false })
      .limit(50);

    if (error) throw error;

    // Calculate summary metrics
    const totalDistance = bpPerformance?.reduce((sum, customer) => 
      sum + (customer.total_trip_distance_km || 0), 0) || 0;
    const totalTrips = bpPerformance?.reduce((sum, customer) => 
      sum + (customer.total_correlated_trips || 0), 0) || 0;
    const avgEfficiency = bpPerformance?.length > 0 ? 
      bpPerformance.reduce((sum, customer) => sum + (customer.avg_delivery_efficiency || 0), 0) / bpPerformance.length : 0;

    return res.status(200).json({
      success: true,
      bp_customers: bpPerformance || [],
      summary: {
        total_bp_customers: bpPerformance?.length || 0,
        total_distance_km: totalDistance,
        total_trips: totalTrips,
        avg_delivery_efficiency: Math.round(avgEfficiency * 100) / 100
      }
    });

  } catch (error) {
    console.error('BP performance error:', error);
    return res.status(500).json({
      error: 'Failed to fetch BP customer performance',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Refresh analytics materialized views
 */
async function handleRefreshAnalytics(
  req: VercelRequest, 
  res: VercelResponse, 
  data: CorrelationAnalysisRequest
) {
  try {
    const { error } = await supabase.rpc('refresh_customer_analytics');
    
    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: 'Analytics refreshed successfully',
      refreshed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Analytics refresh error:', error);
    return res.status(500).json({
      error: 'Failed to refresh analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get detailed correlation for a specific trip
 */
export async function getTripCorrelationDetails(tripId: string): Promise<TripCorrelationSummary | null> {
  try {
    const { data, error } = await supabase.rpc(
      'get_trip_correlation_summary',
      { trip_id_input: tripId }
    );

    if (error) {
      console.error('Failed to get trip correlation details:', error);
      return null;
    }

    return data?.[0] || null;
  } catch (error) {
    console.error('Trip correlation details error:', error);
    return null;
  }
}