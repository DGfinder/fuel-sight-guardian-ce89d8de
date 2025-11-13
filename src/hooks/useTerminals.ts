import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTerminals,
  getTerminal,
  getTerminalsWithStats,
  createTerminal,
  updateTerminal,
  deleteTerminal,
  findNearestTerminals,
  terminalNameExists,
  ensureTerminalTableExists,
  type TerminalInput
} from '@/api/terminals';
import { toast } from 'sonner';

/**
 * Query all terminals
 */
export function useTerminals(activeOnly: boolean = false) {
  return useQuery({
    queryKey: ['terminals', activeOnly],
    queryFn: () => getTerminals(activeOnly),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Query single terminal by ID
 */
export function useTerminal(id: string | undefined) {
  return useQuery({
    queryKey: ['terminal', id],
    queryFn: () => getTerminal(id!),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Query terminals with statistics
 */
export function useTerminalsWithStats(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['terminalsWithStats', dateFrom, dateTo],
    queryFn: () => getTerminalsWithStats(dateFrom, dateTo),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Find nearest terminals to a location
 */
export function useNearestTerminals(
  latitude: number | undefined,
  longitude: number | undefined,
  maxDistanceKm: number = 100
) {
  return useQuery({
    queryKey: ['nearestTerminals', latitude, longitude, maxDistanceKm],
    queryFn: () => findNearestTerminals(latitude!, longitude!, maxDistanceKm),
    enabled: latitude !== undefined && longitude !== undefined,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Mutation to create a terminal
 */
export function useCreateTerminal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (terminal: TerminalInput) => createTerminal(terminal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
      queryClient.invalidateQueries({ queryKey: ['terminalsWithStats'] });

      toast.success('Terminal created successfully', {
        description: 'The terminal has been added to the database.'
      });
    },
    onError: (error) => {
      console.error('Error creating terminal:', error);
      toast.error('Failed to create terminal', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });
}

/**
 * Mutation to update a terminal
 */
export function useUpdateTerminal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<TerminalInput> }) =>
      updateTerminal(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
      queryClient.invalidateQueries({ queryKey: ['terminal', data.id] });
      queryClient.invalidateQueries({ queryKey: ['terminalsWithStats'] });

      toast.success('Terminal updated successfully', {
        description: 'The terminal information has been saved.'
      });
    },
    onError: (error) => {
      console.error('Error updating terminal:', error);
      toast.error('Failed to update terminal', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });
}

/**
 * Mutation to delete a terminal
 */
export function useDeleteTerminal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTerminal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
      queryClient.invalidateQueries({ queryKey: ['terminalsWithStats'] });

      toast.success('Terminal deleted successfully', {
        description: 'The terminal has been removed from the database.'
      });
    },
    onError: (error) => {
      console.error('Error deleting terminal:', error);
      toast.error('Failed to delete terminal', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });
}

/**
 * Check if terminal name exists (for validation)
 */
export function useTerminalNameExists(name: string, excludeId?: string) {
  return useQuery({
    queryKey: ['terminalNameExists', name, excludeId],
    queryFn: () => terminalNameExists(name, excludeId),
    enabled: name.length > 0,
    staleTime: 0, // Always fresh for validation
  });
}

/**
 * Check if terminal table exists
 */
export function useTerminalTableExists() {
  return useQuery({
    queryKey: ['terminalTableExists'],
    queryFn: ensureTerminalTableExists,
    staleTime: 60 * 1000, // 1 minute
    retry: false,
  });
}

/**
 * Combined hook for terminal management dashboard
 */
export function useTerminalManagement() {
  const terminals = useTerminals();
  const terminalsWithStats = useTerminalsWithStats();
  const tableExists = useTerminalTableExists();

  return {
    terminals: terminals.data || [],
    terminalsWithStats: terminalsWithStats.data || [],
    tableExists: tableExists.data || false,
    isLoading: terminals.isLoading || terminalsWithStats.isLoading || tableExists.isLoading,
    error: terminals.error || terminalsWithStats.error || tableExists.error,
    refetch: () => {
      terminals.refetch();
      terminalsWithStats.refetch();
      tableExists.refetch();
    }
  };
}
