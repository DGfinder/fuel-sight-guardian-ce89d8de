import { supabase } from '@/lib/supabase';

/**
 * Terminal GPS verification result from database analysis
 */
export interface TerminalVerificationResult {
  terminal_id: string;
  terminal_name: string;
  recorded_latitude: number;
  recorded_longitude: number;
  actual_centroid_lat: number | null;
  actual_centroid_lon: number | null;
  drift_meters: number | null;
  trip_count: number;
  start_point_count: number;
  end_point_count: number;
  confidence_score: number;
  status: 'VERIFIED' | 'GOOD' | 'NEEDS_REVIEW' | 'INACCURATE' | 'NO_DATA';
  recommendations: string;
}

/**
 * Verify GPS accuracy for all terminals or a specific terminal
 * Analyzes actual trip data to compare recorded GPS vs actual trip endpoints
 *
 * @param terminalId - Optional UUID of specific terminal to verify (null = all terminals)
 * @returns Array of verification results with drift analysis and recommendations
 */
export async function verifyTerminalGPS(
  terminalId: string | null = null
): Promise<TerminalVerificationResult[]> {
  const { data, error } = await supabase.rpc('verify_terminal_gps_accuracy', {
    p_terminal_id: terminalId
  });

  if (error) {
    console.error('Error verifying terminal GPS:', error);
    throw new Error(`Failed to verify terminal GPS: ${error.message}`);
  }

  return (data || []).map(row => ({
    terminal_id: row.terminal_id,
    terminal_name: row.terminal_name,
    recorded_latitude: parseFloat(row.recorded_latitude),
    recorded_longitude: parseFloat(row.recorded_longitude),
    actual_centroid_lat: row.actual_centroid_lat ? parseFloat(row.actual_centroid_lat) : null,
    actual_centroid_lon: row.actual_centroid_lon ? parseFloat(row.actual_centroid_lon) : null,
    drift_meters: row.drift_meters ? parseFloat(row.drift_meters) : null,
    trip_count: row.trip_count,
    start_point_count: row.start_point_count,
    end_point_count: row.end_point_count,
    confidence_score: row.confidence_score,
    status: row.status,
    recommendations: row.recommendations
  }));
}

/**
 * Accept GPS correction for a terminal
 * Updates terminal coordinates to the actual centroid from trip data
 *
 * @param terminalId - UUID of terminal to update
 * @param newLatitude - Corrected latitude from verification analysis
 * @param newLongitude - Corrected longitude from verification analysis
 */
export async function acceptGPSCorrection(
  terminalId: string,
  newLatitude: number,
  newLongitude: number
): Promise<void> {
  const { error } = await supabase
    .from('terminal_locations')
    .update({
      latitude: newLatitude,
      longitude: newLongitude,
      updated_at: new Date().toISOString()
    })
    .eq('id', terminalId);

  if (error) {
    console.error('Error accepting GPS correction:', error);
    throw new Error(`Failed to update terminal GPS: ${error.message}`);
  }
}

/**
 * Get verification summary statistics
 */
export async function getVerificationSummary(): Promise<{
  total: number;
  verified: number;
  good: number;
  needsReview: number;
  inaccurate: number;
  noData: number;
}> {
  const results = await verifyTerminalGPS(null);

  return {
    total: results.length,
    verified: results.filter(r => r.status === 'VERIFIED').length,
    good: results.filter(r => r.status === 'GOOD').length,
    needsReview: results.filter(r => r.status === 'NEEDS_REVIEW').length,
    inaccurate: results.filter(r => r.status === 'INACCURATE').length,
    noData: results.filter(r => r.status === 'NO_DATA').length
  };
}

/**
 * Format drift distance for display
 */
export function formatDrift(driftMeters: number | null): string {
  if (driftMeters === null) return 'No data';
  if (driftMeters < 1000) {
    return `${Math.round(driftMeters)}m`;
  }
  return `${(driftMeters / 1000).toFixed(2)}km`;
}

/**
 * Get status color for badge display
 */
export function getStatusColor(
  status: TerminalVerificationResult['status']
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'VERIFIED':
      return 'default'; // Green
    case 'GOOD':
      return 'secondary'; // Blue
    case 'NEEDS_REVIEW':
      return 'outline'; // Yellow/Warning
    case 'INACCURATE':
    case 'NO_DATA':
      return 'destructive'; // Red
    default:
      return 'outline';
  }
}

/**
 * Get status icon/indicator
 */
export function getStatusLabel(status: TerminalVerificationResult['status']): string {
  switch (status) {
    case 'VERIFIED':
      return '✓ Verified';
    case 'GOOD':
      return '✓ Good';
    case 'NEEDS_REVIEW':
      return '⚠ Needs Review';
    case 'INACCURATE':
      return '✗ Inaccurate';
    case 'NO_DATA':
      return '− No Data';
    default:
      return status;
  }
}
