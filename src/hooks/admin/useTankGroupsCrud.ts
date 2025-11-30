/**
 * useTankGroupsCrud Hook
 * CRUD operations for Tank Groups
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { TankGroup, TankGroupFormData } from '@/types/admin';

export function useTankGroupsCrud() {
  const queryClient = useQueryClient();

  // Fetch all tank groups with tank count
  const groupsQuery = useQuery({
    queryKey: ['admin-tank-groups'],
    queryFn: async (): Promise<TankGroup[]> => {
      const { data, error } = await supabase
        .from('tank_groups')
        .select(`
          id,
          name,
          description,
          created_at,
          fuel_tanks(count)
        `)
        .order('name');

      if (error) {
        console.error('Error fetching tank groups:', error);
        throw error;
      }

      return (data || []).map((group: any) => ({
        ...group,
        tank_count: group.fuel_tanks?.[0]?.count || 0,
      }));
    },
    staleTime: 60 * 1000, // 1 minute
  });

  // Create group
  const createMutation = useMutation({
    mutationFn: async (input: TankGroupFormData) => {
      const { data, error } = await supabase
        .from('tank_groups')
        .insert({
          name: input.name,
          description: input.description || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Tank group created successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-tank-groups'] });
      queryClient.invalidateQueries({ queryKey: ['admin-entity-counts'] });
    },
    onError: (error) => {
      console.error('Error creating tank group:', error);
      toast.error('Failed to create tank group');
    },
  });

  // Update group
  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: TankGroupFormData }) => {
      const { data, error } = await supabase
        .from('tank_groups')
        .update({
          name: input.name,
          description: input.description || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Tank group updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-tank-groups'] });
    },
    onError: (error) => {
      console.error('Error updating tank group:', error);
      toast.error('Failed to update tank group');
    },
  });

  // Delete group
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tank_groups')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tank group deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-tank-groups'] });
      queryClient.invalidateQueries({ queryKey: ['admin-entity-counts'] });
    },
    onError: (error: any) => {
      console.error('Error deleting tank group:', error);
      if (error.code === '23503') {
        toast.error('Cannot delete group with existing tanks. Move or delete tanks first.');
      } else {
        toast.error('Failed to delete tank group');
      }
    },
  });

  // Bulk delete groups
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('tank_groups')
        .delete()
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      toast.success(`${ids.length} tank group(s) deleted successfully`);
      queryClient.invalidateQueries({ queryKey: ['admin-tank-groups'] });
      queryClient.invalidateQueries({ queryKey: ['admin-entity-counts'] });
    },
    onError: (error: any) => {
      console.error('Error bulk deleting tank groups:', error);
      if (error.code === '23503') {
        toast.error('Cannot delete groups with existing tanks');
      } else {
        toast.error('Failed to delete tank groups');
      }
    },
  });

  return {
    // Data
    groups: groupsQuery.data || [],
    isLoading: groupsQuery.isLoading,
    error: groupsQuery.error,

    // Mutations
    createGroup: createMutation.mutate,
    updateGroup: updateMutation.mutate,
    deleteGroup: deleteMutation.mutate,
    bulkDeleteGroups: bulkDeleteMutation.mutate,

    // Loading states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isBulkDeleting: bulkDeleteMutation.isPending,
  };
}

export default useTankGroupsCrud;
