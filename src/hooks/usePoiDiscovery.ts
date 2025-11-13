import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  discoverPOIsFromTrips,
  getDiscoveredPOIs,
  getUnclassifiedPOIs,
  getPOI,
  classifyPOI,
  ignorePOI,
  deletePOI,
  getDiscoverySummary,
  type DiscoveredPOI,
  type POIFilters,
  type ClassifyPOIInput
} from '@/api/poiDiscovery';
import { toast } from 'sonner';

/**
 * Hook to run POI discovery from trip data
 */
export function useDiscoverPOIs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      epsilonMeters = 500,
      minPoints = 10,
      minIdleMinutes = 30,
      clearExisting = false
    }: {
      epsilonMeters?: number;
      minPoints?: number;
      minIdleMinutes?: number;
      clearExisting?: boolean;
    }) => discoverPOIsFromTrips(epsilonMeters, minPoints, minIdleMinutes, clearExisting),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['discoveredPOIs'] });
      queryClient.invalidateQueries({ queryKey: ['poiSummary'] });
      toast.success(result.message, {
        description: `Discovered ${result.poi_count} locations from ${result.total_trips_analyzed} trips`
      });
    },
    onError: (error: Error) => {
      console.error('Failed to discover POIs:', error);
      toast.error('Failed to discover POIs', {
        description: error.message
      });
    }
  });
}

/**
 * Hook to get all discovered POIs with filtering
 */
export function useDiscoveredPOIs(filters?: POIFilters) {
  return useQuery({
    queryKey: ['discoveredPOIs', filters],
    queryFn: () => getDiscoveredPOIs(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  });
}

/**
 * Hook to get unclassified POIs only
 */
export function useUnclassifiedPOIs() {
  return useQuery({
    queryKey: ['unclassifiedPOIs'],
    queryFn: getUnclassifiedPOIs,
    staleTime: 2 * 60 * 1000 // 2 minutes (shorter for active classification work)
  });
}

/**
 * Hook to get a single POI by ID
 */
export function usePOI(poiId: string | null) {
  return useQuery({
    queryKey: ['poi', poiId],
    queryFn: () => getPOI(poiId!),
    enabled: !!poiId,
    staleTime: 5 * 60 * 1000
  });
}

/**
 * Hook to get POI discovery summary
 */
export function usePOISummary() {
  return useQuery({
    queryKey: ['poiSummary'],
    queryFn: getDiscoverySummary,
    staleTime: 5 * 60 * 1000
  });
}

/**
 * Hook to classify a POI
 */
export function useClassifyPOI() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      poiId,
      classification,
      userId
    }: {
      poiId: string;
      classification: ClassifyPOIInput;
      userId?: string;
    }) => classifyPOI(poiId, classification, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discoveredPOIs'] });
      queryClient.invalidateQueries({ queryKey: ['unclassifiedPOIs'] });
      queryClient.invalidateQueries({ queryKey: ['poiSummary'] });
      toast.success('POI classified successfully');
    },
    onError: (error: Error) => {
      console.error('Failed to classify POI:', error);
      toast.error('Failed to classify POI', {
        description: error.message
      });
    }
  });
}

/**
 * Hook to ignore a POI
 */
export function useIgnorePOI() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ poiId, reason }: { poiId: string; reason?: string }) =>
      ignorePOI(poiId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discoveredPOIs'] });
      queryClient.invalidateQueries({ queryKey: ['unclassifiedPOIs'] });
      queryClient.invalidateQueries({ queryKey: ['poiSummary'] });
      toast.success('POI marked as ignored');
    },
    onError: (error: Error) => {
      console.error('Failed to ignore POI:', error);
      toast.error('Failed to ignore POI', {
        description: error.message
      });
    }
  });
}

/**
 * Hook to delete a POI
 */
export function useDeletePOI() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (poiId: string) => deletePOI(poiId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discoveredPOIs'] });
      queryClient.invalidateQueries({ queryKey: ['unclassifiedPOIs'] });
      queryClient.invalidateQueries({ queryKey: ['poiSummary'] });
      toast.success('POI deleted successfully');
    },
    onError: (error: Error) => {
      console.error('Failed to delete POI:', error);
      toast.error('Failed to delete POI', {
        description: error.message
      });
    }
  });
}

/**
 * Combined hook for POI discovery dashboard
 * Provides all data needed for the discovery page
 */
export function usePOIDiscoveryDashboard() {
  const {
    data: pois,
    isLoading: poisLoading,
    error: poisError
  } = useDiscoveredPOIs();

  const {
    data: unclassified,
    isLoading: unclassifiedLoading,
    error: unclassifiedError
  } = useUnclassifiedPOIs();

  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError
  } = usePOISummary();

  const discoverMutation = useDiscoverPOIs();
  const classifyMutation = useClassifyPOI();
  const ignoreMutation = useIgnorePOI();
  const deleteMutation = useDeletePOI();

  return {
    pois: pois || [],
    unclassified: unclassified || [],
    summary: summary || {
      total: 0,
      discovered: 0,
      classified: 0,
      ignored: 0,
      merged: 0,
      total_trips_covered: 0,
      avg_confidence: 0,
      terminals: 0,
      customers: 0,
      rest_areas: 0,
      depots: 0,
      unknown: 0
    },
    isLoading: poisLoading || unclassifiedLoading || summaryLoading,
    error: poisError || unclassifiedError || summaryError,
    discoverMutation,
    classifyMutation,
    ignoreMutation,
    deleteMutation
  };
}

/**
 * Helper to filter POIs by confidence score
 */
export function filterByConfidence(
  pois: DiscoveredPOI[],
  minConfidence: number
): DiscoveredPOI[] {
  return pois.filter(poi => poi.confidence_score >= minConfidence);
}

/**
 * Helper to sort POIs by trip count (descending)
 */
export function sortByTripCount(pois: DiscoveredPOI[]): DiscoveredPOI[] {
  return [...pois].sort((a, b) => b.trip_count - a.trip_count);
}

/**
 * Helper to sort POIs by confidence score (descending)
 */
export function sortByConfidence(pois: DiscoveredPOI[]): DiscoveredPOI[] {
  return [...pois].sort((a, b) => b.confidence_score - a.confidence_score);
}

/**
 * Helper to get high-priority POIs
 * (high trip count, unclassified, good confidence)
 */
export function getHighPriorityPOIs(pois: DiscoveredPOI[]): DiscoveredPOI[] {
  return pois
    .filter(
      poi =>
        poi.classification_status === 'discovered' &&
        poi.trip_count >= 20 &&
        poi.confidence_score >= 70
    )
    .sort((a, b) => b.trip_count - a.trip_count);
}

/**
 * Helper to check if POI needs classification
 */
export function needsClassification(poi: DiscoveredPOI): boolean {
  return poi.classification_status === 'discovered' && poi.poi_type === 'unknown';
}
