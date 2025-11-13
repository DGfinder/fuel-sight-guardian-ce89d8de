import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCustomerMatches,
  assignCustomerToPOI,
  autoAssignCustomer,
  bulkAutoAssignCustomers,
  unassignCustomerFromPOI,
  CustomerMatch,
  CustomerAssignmentParams
} from '@/api/customerAssignment';
import { toast } from 'sonner';

/**
 * Hook for getting customer match suggestions
 */
export function useCustomerMatches(params: CustomerAssignmentParams = {}) {
  return useQuery<CustomerMatch[]>({
    queryKey: ['customerMatches', params],
    queryFn: () => getCustomerMatches(params),
    enabled: !!params.poiId, // Only run if we have a POI ID
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for manually assigning a customer to a POI
 */
export function useAssignCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ poiId, customerId }: { poiId: string; customerId: string }) =>
      assignCustomerToPOI(poiId, customerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discoveredPOIs'] });
      queryClient.invalidateQueries({ queryKey: ['customerMatches'] });
      queryClient.invalidateQueries({ queryKey: ['customerPOIAnalytics'] });
      toast.success('Customer assigned successfully');
    },
    onError: (error) => {
      console.error('Error assigning customer:', error);
      toast.error('Failed to assign customer');
    },
  });
}

/**
 * Hook for auto-assigning a customer to a POI
 */
export function useAutoAssignCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (poiId: string) => autoAssignCustomer(poiId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discoveredPOIs'] });
      queryClient.invalidateQueries({ queryKey: ['customerMatches'] });
      queryClient.invalidateQueries({ queryKey: ['customerPOIAnalytics'] });
      toast.success('Customer auto-assigned successfully');
    },
    onError: (error) => {
      console.error('Error auto-assigning customer:', error);
      toast.error('Failed to auto-assign customer');
    },
  });
}

/**
 * Hook for bulk auto-assigning customers to all POIs
 */
export function useBulkAutoAssign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => bulkAutoAssignCustomers(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['discoveredPOIs'] });
      queryClient.invalidateQueries({ queryKey: ['customerMatches'] });
      queryClient.invalidateQueries({ queryKey: ['customerPOIAnalytics'] });
      toast.success(result.message);
    },
    onError: (error) => {
      console.error('Error bulk auto-assigning customers:', error);
      toast.error('Failed to bulk auto-assign customers');
    },
  });
}

/**
 * Hook for removing customer assignment from a POI
 */
export function useUnassignCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (poiId: string) => unassignCustomerFromPOI(poiId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discoveredPOIs'] });
      queryClient.invalidateQueries({ queryKey: ['customerMatches'] });
      queryClient.invalidateQueries({ queryKey: ['customerPOIAnalytics'] });
      toast.success('Customer assignment removed');
    },
    onError: (error) => {
      console.error('Error unassigning customer:', error);
      toast.error('Failed to remove customer assignment');
    },
  });
}

/**
 * Composite hook that provides all customer assignment functionality
 */
export function useCustomerAssignment(poiId?: string) {
  const [selectedPOI, setSelectedPOI] = useState<string | null>(poiId || null);

  const matches = useCustomerMatches({
    poiId: selectedPOI || undefined,
  });

  const assignMutation = useAssignCustomer();
  const autoAssignMutation = useAutoAssignCustomer();
  const bulkAutoAssignMutation = useBulkAutoAssign();
  const unassignMutation = useUnassignCustomer();

  const assignCustomer = useCallback(
    async (poiId: string, customerId: string) => {
      await assignMutation.mutateAsync({ poiId, customerId });
    },
    [assignMutation]
  );

  const autoAssign = useCallback(
    async (poiId: string) => {
      await autoAssignMutation.mutateAsync(poiId);
    },
    [autoAssignMutation]
  );

  const bulkAutoAssign = useCallback(async () => {
    await bulkAutoAssignMutation.mutateAsync();
  }, [bulkAutoAssignMutation]);

  const unassign = useCallback(
    async (poiId: string) => {
      await unassignMutation.mutateAsync(poiId);
    },
    [unassignMutation]
  );

  return {
    // State
    selectedPOI,
    setSelectedPOI,

    // Data
    matches: matches.data || [],
    isLoadingMatches: matches.isLoading,
    matchesError: matches.error,

    // Actions
    assignCustomer,
    autoAssign,
    bulkAutoAssign,
    unassign,

    // Loading states
    isAssigning: assignMutation.isPending,
    isAutoAssigning: autoAssignMutation.isPending,
    isBulkAssigning: bulkAutoAssignMutation.isPending,
    isUnassigning: unassignMutation.isPending,
  };
}
