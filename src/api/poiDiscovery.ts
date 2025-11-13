import { supabase } from '@/lib/supabase';

/**
 * POI Type classifications
 */
export type POIType = 'terminal' | 'customer' | 'rest_area' | 'depot' | 'unknown';

/**
 * POI Classification status
 */
export type ClassificationStatus = 'discovered' | 'classified' | 'ignored' | 'merged';

/**
 * Discovered Point of Interest from trip data clustering
 */
export interface DiscoveredPOI {
  id: string;
  poi_type: POIType;
  classification_status: ClassificationStatus;
  centroid_latitude: number;
  centroid_longitude: number;
  location_point: unknown; // PostGIS GEOGRAPHY
  service_area: unknown | null;
  trip_count: number;
  start_point_count: number;
  end_point_count: number;
  avg_idle_time_hours: number | null;
  total_idle_time_hours: number | null;
  confidence_score: number;
  gps_accuracy_meters: number | null;
  suggested_name: string | null;
  actual_name: string | null;
  address: string | null;
  matched_terminal_id: string | null;
  matched_customer_id: string | null;
  cluster_id: number | null;
  service_radius_km: number;
  first_seen: string | null;
  last_seen: string | null;
  notes: string | null;
  classified_by: string | null;
  classified_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * POI Discovery result from database function
 */
export interface POIDiscoveryResult {
  poi_count: number;
  start_poi_count: number;
  end_poi_count: number;
  total_trips_analyzed: number;
  message: string;
}

/**
 * Input for classifying a POI
 */
export interface ClassifyPOIInput {
  poi_type: POIType;
  actual_name: string;
  address?: string;
  service_radius_km?: number;
  notes?: string;
  matched_terminal_id?: string | null;
  matched_customer_id?: string | null;
}

/**
 * POI filter options
 */
export interface POIFilters {
  classification_status?: ClassificationStatus | ClassificationStatus[];
  poi_type?: POIType | POIType[];
  min_trip_count?: number;
  min_confidence?: number;
  matched_terminal_only?: boolean;
}

/**
 * Discovery summary statistics
 */
export interface POIDiscoverySummary {
  total: number;
  discovered: number;
  classified: number;
  ignored: number;
  merged: number;
  total_trips_covered: number;
  avg_confidence: number;
  terminals: number;
  customers: number;
  rest_areas: number;
  depots: number;
  unknown: number;
}

/**
 * Run POI discovery from trip data
 * Uses ST_ClusterDBSCAN to find significant stop locations
 *
 * @param epsilonMeters - Maximum distance for clustering (default 500m)
 * @param minPoints - Minimum trips to form a POI (default 10)
 * @param minIdleMinutes - Minimum idle time in minutes to consider a stop (default 30)
 * @param clearExisting - Clear existing discoveries before running (default false)
 * @returns Discovery result with counts and message
 */
export async function discoverPOIsFromTrips(
  epsilonMeters: number = 500,
  minPoints: number = 10,
  minIdleMinutes: number = 30,
  clearExisting: boolean = false
): Promise<POIDiscoveryResult> {
  const { data, error } = await supabase.rpc('discover_poi_from_trips', {
    p_epsilon_meters: epsilonMeters,
    p_min_points: minPoints,
    p_min_idle_minutes: minIdleMinutes,
    p_clear_existing: clearExisting
  });

  if (error) {
    console.error('Error discovering POIs:', error);
    throw new Error(`Failed to discover POIs: ${error.message}`);
  }

  return data[0];
}

/**
 * Get all discovered POIs with optional filtering
 */
export async function getDiscoveredPOIs(filters?: POIFilters): Promise<DiscoveredPOI[]> {
  let query = supabase
    .from('discovered_poi')
    .select('*')
    .order('trip_count', { ascending: false });

  // Apply filters
  if (filters) {
    if (filters.classification_status) {
      if (Array.isArray(filters.classification_status)) {
        query = query.in('classification_status', filters.classification_status);
      } else {
        query = query.eq('classification_status', filters.classification_status);
      }
    }

    if (filters.poi_type) {
      if (Array.isArray(filters.poi_type)) {
        query = query.in('poi_type', filters.poi_type);
      } else {
        query = query.eq('poi_type', filters.poi_type);
      }
    }

    if (filters.min_trip_count !== undefined) {
      query = query.gte('trip_count', filters.min_trip_count);
    }

    if (filters.min_confidence !== undefined) {
      query = query.gte('confidence_score', filters.min_confidence);
    }

    if (filters.matched_terminal_only) {
      query = query.not('matched_terminal_id', 'is', null);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching POIs:', error);
    throw new Error(`Failed to fetch POIs: ${error.message}`);
  }

  return data || [];
}

/**
 * Get unclassified POIs (discovered status only)
 */
export async function getUnclassifiedPOIs(): Promise<DiscoveredPOI[]> {
  return getDiscoveredPOIs({ classification_status: 'discovered' });
}

/**
 * Get a single POI by ID
 */
export async function getPOI(id: string): Promise<DiscoveredPOI | null> {
  const { data, error } = await supabase
    .from('discovered_poi')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching POI:', error);
    throw new Error(`Failed to fetch POI: ${error.message}`);
  }

  return data;
}

/**
 * Classify a discovered POI
 * Updates POI type, name, and status to 'classified'
 */
export async function classifyPOI(
  poiId: string,
  classification: ClassifyPOIInput,
  userId?: string
): Promise<void> {
  const { error } = await supabase
    .from('discovered_poi')
    .update({
      poi_type: classification.poi_type,
      actual_name: classification.actual_name,
      address: classification.address,
      service_radius_km: classification.service_radius_km,
      notes: classification.notes,
      matched_terminal_id: classification.matched_terminal_id,
      matched_customer_id: classification.matched_customer_id,
      classification_status: 'classified',
      classified_by: userId,
      classified_at: new Date().toISOString()
    })
    .eq('id', poiId);

  if (error) {
    console.error('Error classifying POI:', error);
    throw new Error(`Failed to classify POI: ${error.message}`);
  }
}

/**
 * Ignore a discovered POI
 * Marks POI as 'ignored' so it won't appear in unclassified list
 */
export async function ignorePOI(poiId: string, reason?: string): Promise<void> {
  const { error } = await supabase
    .from('discovered_poi')
    .update({
      classification_status: 'ignored',
      notes: reason ? `Ignored: ${reason}` : 'Ignored by user'
    })
    .eq('id', poiId);

  if (error) {
    console.error('Error ignoring POI:', error);
    throw new Error(`Failed to ignore POI: ${error.message}`);
  }
}

/**
 * Delete a discovered POI
 */
export async function deletePOI(poiId: string): Promise<void> {
  const { error } = await supabase
    .from('discovered_poi')
    .delete()
    .eq('id', poiId);

  if (error) {
    console.error('Error deleting POI:', error);
    throw new Error(`Failed to delete POI: ${error.message}`);
  }
}

/**
 * Get discovery summary statistics
 */
export async function getDiscoverySummary(): Promise<POIDiscoverySummary> {
  const pois = await getDiscoveredPOIs();

  const summary: POIDiscoverySummary = {
    total: pois.length,
    discovered: pois.filter(p => p.classification_status === 'discovered').length,
    classified: pois.filter(p => p.classification_status === 'classified').length,
    ignored: pois.filter(p => p.classification_status === 'ignored').length,
    merged: pois.filter(p => p.classification_status === 'merged').length,
    total_trips_covered: pois.reduce((sum, p) => sum + p.trip_count, 0),
    avg_confidence: pois.length > 0
      ? Math.round(pois.reduce((sum, p) => sum + p.confidence_score, 0) / pois.length)
      : 0,
    terminals: pois.filter(p => p.poi_type === 'terminal').length,
    customers: pois.filter(p => p.poi_type === 'customer').length,
    rest_areas: pois.filter(p => p.poi_type === 'rest_area').length,
    depots: pois.filter(p => p.poi_type === 'depot').length,
    unknown: pois.filter(p => p.poi_type === 'unknown').length
  };

  return summary;
}

/**
 * Get POI type label for display
 */
export function getPOITypeLabel(type: POIType): string {
  const labels: Record<POIType, string> = {
    terminal: 'Terminal',
    customer: 'Customer',
    rest_area: 'Rest Area',
    depot: 'Depot',
    unknown: 'Unknown'
  };
  return labels[type] || type;
}

/**
 * Get POI type color for badges
 */
export function getPOITypeColor(type: POIType): 'default' | 'secondary' | 'destructive' | 'outline' {
  const colors: Record<POIType, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    terminal: 'default',      // Blue
    customer: 'secondary',    // Green
    rest_area: 'outline',     // Gray
    depot: 'default',         // Blue
    unknown: 'destructive'    // Red
  };
  return colors[type] || 'outline';
}

/**
 * Get classification status label
 */
export function getStatusLabel(status: ClassificationStatus): string {
  const labels: Record<ClassificationStatus, string> = {
    discovered: 'Needs Review',
    classified: 'Classified',
    ignored: 'Ignored',
    merged: 'Merged'
  };
  return labels[status] || status;
}

/**
 * Suggest POI type based on start/end point ratio
 */
export function suggestPOIType(poi: DiscoveredPOI): POIType {
  if (poi.matched_terminal_id) {
    return 'terminal';
  }

  const startRatio = poi.trip_count > 0 ? poi.start_point_count / poi.trip_count : 0;
  const endRatio = poi.trip_count > 0 ? poi.end_point_count / poi.trip_count : 0;

  // If >80% trips start here, likely terminal/depot
  if (startRatio > 0.8) {
    return 'terminal';
  }

  // If >80% trips end here, likely customer
  if (endRatio > 0.8) {
    return 'customer';
  }

  // Mixed use or unknown
  return 'unknown';
}

/**
 * Format GPS accuracy for display
 */
export function formatAccuracy(meters: number | null): string {
  if (meters === null || meters === undefined) return 'Unknown';
  if (meters < 10) return `${Math.round(meters)}m (Excellent)`;
  if (meters < 50) return `${Math.round(meters)}m (Good)`;
  if (meters < 100) return `${Math.round(meters)}m (Fair)`;
  return `${Math.round(meters)}m (Poor)`;
}
