import { supabase } from '@/lib/supabase';

export interface CustomerMatch {
  poi_id: string;
  poi_name: string;
  customer_id: string;
  customer_name: string;
  customer_bp_id: string | null;
  match_method: string;
  confidence_score: number;
  distance_km: number;
  name_similarity: number;
  recommendation: string;
}

export interface CustomerAssignmentParams {
  poiId?: string;
  maxDistanceKm?: number;
  minNameSimilarity?: number;
  autoAssign?: boolean;
}

/**
 * Get customer match suggestions for POIs
 */
export async function getCustomerMatches(
  params: CustomerAssignmentParams = {}
): Promise<CustomerMatch[]> {
  const {
    poiId = null,
    maxDistanceKm = 2.0,
    minNameSimilarity = 70,
    autoAssign = false
  } = params;

  const { data, error } = await supabase.rpc('match_poi_to_customers', {
    p_poi_id: poiId,
    p_max_distance_km: maxDistanceKm,
    p_min_name_similarity: minNameSimilarity,
    p_auto_assign: autoAssign,
    p_assigned_by: null
  });

  if (error) {
    console.error('Error getting customer matches:', error);
    throw error;
  }

  return data || [];
}

/**
 * Manually assign a customer to a POI
 */
export async function assignCustomerToPOI(
  poiId: string,
  customerId: string,
  assignedBy?: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = assignedBy || user?.id;

  const { error } = await supabase
    .from('discovered_poi')
    .update({
      matched_customer_id: customerId,
      customer_assignment_method: 'manual',
      customer_assignment_confidence: 100, // Manual assignments are 100% confident
      customer_assigned_at: new Date().toISOString(),
      customer_assigned_by: userId
    })
    .eq('id', poiId);

  if (error) {
    console.error('Error assigning customer to POI:', error);
    throw error;
  }
}

/**
 * Auto-assign customers to POI using the matching function
 */
export async function autoAssignCustomer(poiId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.rpc('match_poi_to_customers', {
    p_poi_id: poiId,
    p_max_distance_km: 2.0,
    p_min_name_similarity: 70,
    p_auto_assign: true,
    p_assigned_by: user?.id || null
  });

  if (error) {
    console.error('Error auto-assigning customer:', error);
    throw error;
  }
}

/**
 * Bulk auto-assign all unmatched customer POIs
 */
export async function bulkAutoAssignCustomers(): Promise<{
  matched: number;
  message: string;
}> {
  const { data: { user } } = await supabase.auth.getUser();

  // Get match results before auto-assign
  const beforeMatches = await getCustomerMatches({ autoAssign: false });
  const unmatchedCount = beforeMatches.filter(m => m.confidence_score >= 75).length;

  // Perform auto-assignment
  const { error } = await supabase.rpc('match_poi_to_customers', {
    p_poi_id: null, // All POIs
    p_max_distance_km: 2.0,
    p_min_name_similarity: 70,
    p_auto_assign: true,
    p_assigned_by: user?.id || null
  });

  if (error) {
    console.error('Error bulk auto-assigning customers:', error);
    throw error;
  }

  return {
    matched: unmatchedCount,
    message: `Successfully auto-assigned ${unmatchedCount} POIs to customers`
  };
}

/**
 * Remove customer assignment from a POI
 */
export async function unassignCustomerFromPOI(poiId: string): Promise<void> {
  const { error } = await supabase
    .from('discovered_poi')
    .update({
      matched_customer_id: null,
      customer_assignment_method: null,
      customer_assignment_confidence: null,
      customer_assigned_at: null,
      customer_assigned_by: null
    })
    .eq('id', poiId);

  if (error) {
    console.error('Error unassigning customer from POI:', error);
    throw error;
  }
}

/**
 * Get customer POI analytics
 */
export async function getCustomerPOIAnalytics(filters?: {
  customerId?: string;
  hasAssignment?: boolean;
  minTripCount?: number;
}) {
  let query = supabase
    .from('customer_poi_analytics')
    .select('*');

  if (filters?.customerId) {
    query = query.eq('customer_id', filters.customerId);
  }

  if (filters?.hasAssignment !== undefined) {
    if (filters.hasAssignment) {
      query = query.not('customer_id', 'is', null);
    } else {
      query = query.is('customer_id', null);
    }
  }

  if (filters?.minTripCount) {
    query = query.gte('poi_trip_count', filters.minTripCount);
  }

  const { data, error } = await query.order('poi_trip_count', { ascending: false });

  if (error) {
    console.error('Error getting customer POI analytics:', error);
    throw error;
  }

  return data || [];
}
