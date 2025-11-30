/**
 * useFuelTanksCrud Hook
 * CRUD operations for Fuel Tanks with filtering
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { FuelTank, FuelTankFormData, TankFilters, TankGroup } from '@/types/admin';

const defaultFilters: TankFilters = {
  search: '',
  groupId: null,
  subgroup: null,
  productTypes: [],
  statuses: [],
  levelMin: null,
  levelMax: null,
};

export function useFuelTanksCrud(filters: Partial<TankFilters> = {}) {
  const queryClient = useQueryClient();
  const appliedFilters = { ...defaultFilters, ...filters };

  // Fetch all tanks with group info
  const tanksQuery = useQuery({
    queryKey: ['admin-fuel-tanks', appliedFilters],
    queryFn: async (): Promise<FuelTank[]> => {
      let query = supabase
        .from('fuel_tanks')
        .select(`
          *,
          tank_groups(name)
        `)
        .order('location');

      // Apply filters
      if (appliedFilters.groupId) {
        query = query.eq('group_id', appliedFilters.groupId);
      }

      if (appliedFilters.subgroup) {
        query = query.eq('subgroup', appliedFilters.subgroup);
      }

      if (appliedFilters.productTypes.length > 0) {
        query = query.in('product_type', appliedFilters.productTypes);
      }

      if (appliedFilters.statuses.length > 0) {
        query = query.in('status', appliedFilters.statuses);
      }

      if (appliedFilters.levelMin !== null) {
        query = query.gte('current_level', appliedFilters.levelMin);
      }

      if (appliedFilters.levelMax !== null) {
        query = query.lte('current_level', appliedFilters.levelMax);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching fuel tanks:', error);
        throw error;
      }

      let result = (data || []).map((tank: any) => ({
        ...tank,
        group_name: tank.tank_groups?.name || 'Unknown',
      }));

      // Client-side search filter
      if (appliedFilters.search) {
        const searchLower = appliedFilters.search.toLowerCase();
        result = result.filter(
          (t: FuelTank) =>
            t.location.toLowerCase().includes(searchLower) ||
            (t.subgroup || '').toLowerCase().includes(searchLower) ||
            (t.group_name || '').toLowerCase().includes(searchLower)
        );
      }

      return result;
    },
    staleTime: 60 * 1000,
  });

  // Fetch groups for dropdown
  const groupsQuery = useQuery({
    queryKey: ['admin-tank-groups-simple'],
    queryFn: async (): Promise<Pick<TankGroup, 'id' | 'name'>[]> => {
      const { data, error } = await supabase
        .from('tank_groups')
        .select('id, name')
        .order('name');

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch unique subgroups
  const subgroupsQuery = useQuery({
    queryKey: ['admin-subgroups'],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('fuel_tanks')
        .select('subgroup')
        .not('subgroup', 'is', null);

      if (error) throw error;
      const unique = [...new Set((data || []).map((t) => t.subgroup).filter(Boolean))];
      return unique.sort() as string[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Create tank
  const createMutation = useMutation({
    mutationFn: async (input: FuelTankFormData) => {
      const { data, error } = await supabase
        .from('fuel_tanks')
        .insert({
          location: input.location,
          group_id: input.group_id,
          subgroup: input.subgroup || null,
          product_type: input.product_type,
          safe_level: input.safe_level,
          min_level: input.min_level,
          status: input.status,
          current_level: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Fuel tank created successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-fuel-tanks'] });
      queryClient.invalidateQueries({ queryKey: ['admin-entity-counts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-tank-groups'] });
    },
    onError: (error) => {
      console.error('Error creating fuel tank:', error);
      toast.error('Failed to create fuel tank');
    },
  });

  // Update tank
  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<FuelTankFormData> }) => {
      const { data, error } = await supabase
        .from('fuel_tanks')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Fuel tank updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-fuel-tanks'] });
      queryClient.invalidateQueries({ queryKey: ['admin-tank-groups'] });
    },
    onError: (error) => {
      console.error('Error updating fuel tank:', error);
      toast.error('Failed to update fuel tank');
    },
  });

  // Delete tank
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fuel_tanks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Fuel tank deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-fuel-tanks'] });
      queryClient.invalidateQueries({ queryKey: ['admin-entity-counts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-tank-groups'] });
    },
    onError: (error) => {
      console.error('Error deleting fuel tank:', error);
      toast.error('Failed to delete fuel tank');
    },
  });

  // Bulk update tanks
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: Partial<FuelTankFormData> }) => {
      const { error } = await supabase
        .from('fuel_tanks')
        .update(updates)
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: (_, { ids }) => {
      toast.success(`${ids.length} tank(s) updated successfully`);
      queryClient.invalidateQueries({ queryKey: ['admin-fuel-tanks'] });
      queryClient.invalidateQueries({ queryKey: ['admin-tank-groups'] });
    },
    onError: (error) => {
      console.error('Error bulk updating tanks:', error);
      toast.error('Failed to update tanks');
    },
  });

  // Bulk delete tanks
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('fuel_tanks').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      toast.success(`${ids.length} tank(s) deleted successfully`);
      queryClient.invalidateQueries({ queryKey: ['admin-fuel-tanks'] });
      queryClient.invalidateQueries({ queryKey: ['admin-entity-counts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-tank-groups'] });
    },
    onError: (error) => {
      console.error('Error bulk deleting tanks:', error);
      toast.error('Failed to delete tanks');
    },
  });

  return {
    // Data
    tanks: tanksQuery.data || [],
    groups: groupsQuery.data || [],
    subgroups: subgroupsQuery.data || [],
    isLoading: tanksQuery.isLoading,
    error: tanksQuery.error,

    // Mutations
    createTank: createMutation.mutate,
    updateTank: updateMutation.mutate,
    deleteTank: deleteMutation.mutate,
    bulkUpdateTanks: bulkUpdateMutation.mutate,
    bulkDeleteTanks: bulkDeleteMutation.mutate,

    // Loading states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isBulkUpdating: bulkUpdateMutation.isPending,
    isBulkDeleting: bulkDeleteMutation.isPending,
  };
}

export default useFuelTanksCrud;
