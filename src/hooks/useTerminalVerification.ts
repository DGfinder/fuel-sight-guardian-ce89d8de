import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  verifyTerminalGPS,
  acceptGPSCorrection,
  getVerificationSummary,
  type TerminalVerificationResult
} from '@/api/terminalVerification';
import { toast } from 'sonner';

/**
 * Hook to verify GPS accuracy for all terminals
 */
export function useTerminalVerification() {
  return useQuery({
    queryKey: ['terminalVerification'],
    queryFn: () => verifyTerminalGPS(null),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  });
}

/**
 * Hook to verify GPS accuracy for a specific terminal
 */
export function useTerminalVerificationById(terminalId: string | null) {
  return useQuery({
    queryKey: ['terminalVerification', terminalId],
    queryFn: () => verifyTerminalGPS(terminalId),
    enabled: !!terminalId,
    staleTime: 5 * 60 * 1000
  });
}

/**
 * Hook to get verification summary statistics
 */
export function useVerificationSummary() {
  return useQuery({
    queryKey: ['verificationSummary'],
    queryFn: getVerificationSummary,
    staleTime: 5 * 60 * 1000
  });
}

/**
 * Hook to accept GPS correction and update terminal coordinates
 */
export function useAcceptGPSCorrection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      terminalId,
      newLatitude,
      newLongitude
    }: {
      terminalId: string;
      newLatitude: number;
      newLongitude: number;
    }) => acceptGPSCorrection(terminalId, newLatitude, newLongitude),
    onSuccess: () => {
      // Invalidate both verification and terminal queries
      queryClient.invalidateQueries({ queryKey: ['terminalVerification'] });
      queryClient.invalidateQueries({ queryKey: ['verificationSummary'] });
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
      toast.success('Terminal GPS coordinates updated successfully');
    },
    onError: (error: Error) => {
      console.error('Failed to accept GPS correction:', error);
      toast.error(`Failed to update GPS coordinates: ${error.message}`);
    }
  });
}

/**
 * Combined hook for terminal verification dashboard
 * Provides all data needed for the verification page
 */
export function useTerminalVerificationDashboard() {
  const {
    data: verifications,
    isLoading: verificationsLoading,
    error: verificationsError
  } = useTerminalVerification();

  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError
  } = useVerificationSummary();

  const acceptCorrection = useAcceptGPSCorrection();

  return {
    verifications: verifications || [],
    summary: summary || {
      total: 0,
      verified: 0,
      good: 0,
      needsReview: 0,
      inaccurate: 0,
      noData: 0
    },
    isLoading: verificationsLoading || summaryLoading,
    error: verificationsError || summaryError,
    acceptCorrection
  };
}

/**
 * Helper to check if terminal needs GPS correction
 */
export function needsCorrection(verification: TerminalVerificationResult): boolean {
  return (
    verification.status === 'NEEDS_REVIEW' ||
    verification.status === 'INACCURATE'
  ) && verification.actual_centroid_lat !== null;
}

/**
 * Helper to get terminals sorted by drift (worst first)
 */
export function sortByDrift(
  verifications: TerminalVerificationResult[]
): TerminalVerificationResult[] {
  return [...verifications].sort((a, b) => {
    // No data goes to end
    if (a.drift_meters === null) return 1;
    if (b.drift_meters === null) return -1;
    // Sort by drift descending (worst first)
    return (b.drift_meters || 0) - (a.drift_meters || 0);
  });
}

/**
 * Helper to filter terminals by status
 */
export function filterByStatus(
  verifications: TerminalVerificationResult[],
  status: TerminalVerificationResult['status']
): TerminalVerificationResult[] {
  return verifications.filter(v => v.status === status);
}
