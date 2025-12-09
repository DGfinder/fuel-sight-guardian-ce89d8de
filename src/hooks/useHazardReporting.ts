/**
 * Hazard Reporting Hook
 * Provides mutations and queries for customer hazard reports
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCustomerAccount } from './useCustomerAuth';
import { toast } from 'sonner';
import type { HazardReport, CreateHazardReportInput } from '@/types/hazard';

/**
 * Hook to create a hazard report with optional photo upload
 */
export function useCreateHazardReport() {
  const queryClient = useQueryClient();
  const { data: customerAccount } = useCustomerAccount();

  return useMutation({
    mutationFn: async (input: CreateHazardReportInput) => {
      if (!customerAccount) {
        throw new Error('No customer account found');
      }

      let photoUrl: string | null = null;

      // Upload photo if provided
      if (input.photo) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const fileExt = input.photo.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('hazard-photos')
          .upload(fileName, input.photo, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error('Photo upload failed:', uploadError);
          // Don't fail the whole submission if photo upload fails
          toast.error('Photo upload failed, submitting report without photo');
        } else if (uploadData) {
          // Get public URL for the uploaded file
          const { data: urlData } = supabase.storage
            .from('hazard-photos')
            .getPublicUrl(uploadData.path);
          photoUrl = urlData.publicUrl;
        }
      }

      // Create the hazard report
      const { data, error } = await supabase
        .from('hazard_reports')
        .insert({
          customer_account_id: customerAccount.id,
          tank_id: input.tank_id || null,
          hazard_category: input.hazard_category,
          hazard_type: input.hazard_type,
          severity: input.severity,
          description: input.description,
          photo_url: photoUrl,
          location_description: input.location_description || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating hazard report:', error);
        throw new Error(error.message || 'Failed to create hazard report');
      }

      // Send notification to dispatch team (fire and forget)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          fetch('/api/customer/send-hazard-notification', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ hazardReportId: data.id }),
          }).catch(err => {
            console.error('Failed to send hazard notification:', err);
          });
        }
      } catch (notifyError) {
        console.error('Failed to trigger hazard notification:', notifyError);
        // Don't fail the mutation - report was created successfully
      }

      return data as HazardReport;
    },
    onSuccess: () => {
      toast.success('Hazard report submitted successfully', {
        description: 'Our dispatch team has been notified.',
      });
      queryClient.invalidateQueries({ queryKey: ['customer-hazard-reports'] });
    },
    onError: (error) => {
      console.error('Error creating hazard report:', error);
      toast.error('Failed to submit hazard report', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    },
  });
}

/**
 * Hook to get customer's hazard reports
 */
export function useCustomerHazardReports() {
  const { data: customerAccount } = useCustomerAccount();

  return useQuery<HazardReport[]>({
    queryKey: ['customer-hazard-reports', customerAccount?.id],
    queryFn: async () => {
      if (!customerAccount) return [];

      const { data, error } = await supabase
        .from('hazard_reports')
        .select(`
          *,
          ta_agbot_locations (
            name,
            address
          )
        `)
        .eq('customer_account_id', customerAccount.id)
        .order('reported_at', { ascending: false });

      if (error) {
        console.error('Error fetching hazard reports:', error);
        return [];
      }

      // Transform the nested data
      return (data || []).map(report => ({
        ...report,
        tank_name: report.ta_agbot_locations?.name || null,
        tank_address: report.ta_agbot_locations?.address || null,
      })) as HazardReport[];
    },
    enabled: !!customerAccount,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to get a single hazard report by ID
 */
export function useHazardReport(reportId: string | undefined) {
  const { data: customerAccount } = useCustomerAccount();

  return useQuery<HazardReport | null>({
    queryKey: ['hazard-report', reportId],
    queryFn: async () => {
      if (!reportId || !customerAccount) return null;

      const { data, error } = await supabase
        .from('hazard_reports')
        .select(`
          *,
          ta_agbot_locations (
            name,
            address
          )
        `)
        .eq('id', reportId)
        .eq('customer_account_id', customerAccount.id)
        .single();

      if (error) {
        console.error('Error fetching hazard report:', error);
        return null;
      }

      return {
        ...data,
        tank_name: data.ta_agbot_locations?.name || null,
        tank_address: data.ta_agbot_locations?.address || null,
      } as HazardReport;
    },
    enabled: !!reportId && !!customerAccount,
  });
}

/**
 * Hook to get count of pending hazard reports (for badges)
 */
export function useHazardReportCount() {
  const { data: customerAccount } = useCustomerAccount();

  return useQuery<number>({
    queryKey: ['customer-hazard-reports-count', customerAccount?.id],
    queryFn: async () => {
      if (!customerAccount) return 0;

      const { count, error } = await supabase
        .from('hazard_reports')
        .select('*', { count: 'exact', head: true })
        .eq('customer_account_id', customerAccount.id)
        .in('status', ['pending_review', 'acknowledged']);

      if (error) {
        console.error('Error fetching hazard report count:', error);
        return 0;
      }

      return count || 0;
    },
    enabled: !!customerAccount,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
