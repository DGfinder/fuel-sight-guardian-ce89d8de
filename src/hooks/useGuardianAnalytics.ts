import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { 
  GuardianEvent, 
  GuardianComplianceReport, 
  GuardianMonthlyMetrics,
  AnalyticsFilter,
  PaginatedResponse,
  TrendAnalysis
} from '../types/analytics';

// Guardian Events Management
export const useGuardianEvents = (filters?: AnalyticsFilter) => {
  return useQuery({
    queryKey: ['guardian-events', filters],
    queryFn: async (): Promise<PaginatedResponse<GuardianEvent>> => {
      let query = supabase
        .from('guardian_events')
        .select('*', { count: 'exact' })
        .order('detection_time', { ascending: false });

      // Apply filters
      if (filters?.date_range) {
        query = query
          .gte('detection_time', filters.date_range.start_date)
          .lte('detection_time', filters.date_range.end_date);
      }

      if (filters?.vehicle && filters.vehicle.length > 0) {
        query = query.in('vehicle', filters.vehicle);
      }

      if (filters?.event_type && filters.event_type.length > 0) {
        query = query.in('event_type', filters.event_type);
      }

      if (filters?.verification_status && filters.verification_status.length > 0) {
        query = query.in('confirmation', filters.verification_status);
      }

      const { data, error, count } = await query.limit(50);

      if (error) {
        throw new Error(`Failed to fetch Guardian events: ${error.message}`);
      }

      return {
        data: data || [],
        count: data?.length || 0,
        total: count || 0,
        page: 1,
        per_page: 50,
        total_pages: Math.ceil((count || 0) / 50)
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Monthly Guardian Metrics for Compliance Dashboard
export const useGuardianMonthlyMetrics = (monthYear?: string) => {
  return useQuery({
    queryKey: ['guardian-monthly-metrics', monthYear],
    queryFn: async (): Promise<GuardianMonthlyMetrics> => {
      const targetMonth = monthYear || new Date().toISOString().slice(0, 7) + '-01';
      
      // Get current month metrics
      const { data: currentData, error: currentError } = await supabase
        .from('guardian_events')
        .select('event_type, confirmation')
        .eq('monthly_period', targetMonth);

      if (currentError) {
        throw new Error(`Failed to fetch current month metrics: ${currentError.message}`);
      }

      // Calculate previous month for trend analysis
      const prevMonth = new Date(targetMonth);
      prevMonth.setMonth(prevMonth.getMonth() - 1);
      const prevMonthStr = prevMonth.toISOString().slice(0, 7) + '-01';

      const { data: prevData, error: prevError } = await supabase
        .from('guardian_events')
        .select('event_type, confirmation')
        .eq('monthly_period', prevMonthStr);

      if (prevError) {
        console.warn('Could not fetch previous month for trend analysis:', prevError.message);
      }

      // Process current month data
      const distractionEvents = currentData?.filter(e => e.event_type === 'distraction') || [];
      const fatigueEvents = currentData?.filter(e => e.event_type === 'fatigue') || [];
      
      const distractionVerified = distractionEvents.filter(e => e.confirmation === 'verified').length;
      const fatigueVerified = fatigueEvents.filter(e => e.confirmation === 'verified').length;

      // Process previous month data for trends
      const prevDistractionEvents = prevData?.filter(e => e.event_type === 'distraction') || [];
      const prevFatigueEvents = prevData?.filter(e => e.event_type === 'fatigue') || [];
      const prevDistractionVerified = prevDistractionEvents.filter(e => e.confirmation === 'verified').length;
      const prevFatigueVerified = prevFatigueEvents.filter(e => e.confirmation === 'verified').length;

      // Calculate trends
      const distractionTrend = prevDistractionVerified > 0 
        ? ((distractionVerified - prevDistractionVerified) / prevDistractionVerified) * 100
        : 0;
      
      const fatigueTrend = prevFatigueVerified > 0
        ? ((fatigueVerified - prevFatigueVerified) / prevFatigueVerified) * 100
        : 0;

      // Get top vehicles with most events
      const vehicleEvents = currentData?.reduce((acc, event) => {
        acc[event.vehicle] = (acc[event.vehicle] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const topVehicles = Object.entries(vehicleEvents)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([vehicle]) => vehicle);

      // Identify potential calibration issues (high system error rates)
      const systemErrorVehicles = currentData?.filter(e => e.confirmation === 'system error')
        .reduce((acc, event) => {
          acc[event.vehicle] = (acc[event.vehicle] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {};

      const calibrationIssues = Object.entries(systemErrorVehicles)
        .filter(([, count]) => count > 5) // More than 5 system errors
        .map(([vehicle]) => vehicle);

      return {
        month_year: targetMonth,
        distraction: {
          total: distractionEvents.length,
          verified: distractionVerified,
          rate: distractionEvents.length > 0 ? (distractionVerified / distractionEvents.length) * 100 : 0,
          trend: distractionTrend
        },
        fatigue: {
          total: fatigueEvents.length,
          verified: fatigueVerified,
          rate: fatigueEvents.length > 0 ? (fatigueVerified / fatigueEvents.length) * 100 : 0,
          trend: fatigueTrend
        },
        top_vehicles: topVehicles,
        calibration_issues: calibrationIssues
      };
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Guardian Event Verification
export const useUpdateGuardianVerification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      eventId, 
      confirmation, 
      classification,
      reviewedBy 
    }: {
      eventId: string;
      confirmation: 'verified' | 'normal driving' | 'criteria not met' | 'system error';
      classification?: string;
      reviewedBy: string;
    }) => {
      const { data, error } = await supabase
        .from('guardian_events')
        .update({
          confirmation,
          classification,
          reviewed_by: reviewedBy,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', eventId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update Guardian event verification: ${error.message}`);
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['guardian-events'] });
      queryClient.invalidateQueries({ queryKey: ['guardian-monthly-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['guardian-compliance-report'] });
    },
  });
};

// Guardian Compliance Report Generation
export const useGenerateComplianceReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ monthYear, generatedBy }: { monthYear: string; generatedBy: string }) => {
      // First, get the monthly metrics
      const { data: events, error: eventsError } = await supabase
        .from('guardian_events')
        .select('event_type, confirmation')
        .eq('monthly_period', monthYear);

      if (eventsError) {
        throw new Error(`Failed to fetch events for compliance report: ${eventsError.message}`);
      }

      // Calculate metrics
      const distractionEvents = events?.filter(e => e.event_type === 'distraction') || [];
      const fatigueEvents = events?.filter(e => e.event_type === 'fatigue') || [];

      const distractionVerified = distractionEvents.filter(e => e.confirmation === 'verified').length;
      const distractionNormal = distractionEvents.filter(e => e.confirmation === 'normal driving').length;
      const distractionSystemErrors = distractionEvents.filter(e => e.confirmation === 'system error').length;

      const fatigueVerified = fatigueEvents.filter(e => e.confirmation === 'verified').length;
      const fatigueNormal = fatigueEvents.filter(e => e.confirmation === 'normal driving').length;
      const fatigueSystemErrors = fatigueEvents.filter(e => e.confirmation === 'system error').length;

      // Calculate verification rates
      const distractionRate = distractionEvents.length > 0 
        ? (distractionVerified / distractionEvents.length) * 100 
        : 0;
      
      const fatigueRate = fatigueEvents.length > 0 
        ? (fatigueVerified / fatigueEvents.length) * 100 
        : 0;

      // Create or update compliance report
      const reportData = {
        month_year: monthYear,
        distraction_total_events: distractionEvents.length,
        distraction_verified_events: distractionVerified,
        distraction_verification_rate: distractionRate,
        distraction_false_positives: distractionNormal,
        distraction_system_errors: distractionSystemErrors,
        fatigue_total_events: fatigueEvents.length,
        fatigue_verified_events: fatigueVerified,
        fatigue_verification_rate: fatigueRate,
        fatigue_false_positives: fatigueNormal,
        fatigue_system_errors: fatigueSystemErrors,
        generated_by: generatedBy,
        generated_at: new Date().toISOString(),
        report_status: 'final' as const
      };

      const { data, error } = await supabase
        .from('guardian_compliance_reports')
        .upsert(reportData, { onConflict: 'month_year' })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to generate compliance report: ${error.message}`);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardian-compliance-report'] });
    },
  });
};

// Get Guardian Compliance Report
export const useGuardianComplianceReport = (monthYear: string) => {
  return useQuery({
    queryKey: ['guardian-compliance-report', monthYear],
    queryFn: async (): Promise<GuardianComplianceReport | null> => {
      const { data, error } = await supabase
        .from('guardian_compliance_reports')
        .select('*')
        .eq('month_year', monthYear)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No report found
          return null;
        }
        throw new Error(`Failed to fetch compliance report: ${error.message}`);
      }

      return data;
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
};

// Guardian Event Trends Analysis
export const useGuardianTrends = (months: number = 6) => {
  return useQuery({
    queryKey: ['guardian-trends', months],
    queryFn: async (): Promise<TrendAnalysis[]> => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      const { data, error } = await supabase
        .from('guardian_events')
        .select('monthly_period, event_type, confirmation')
        .gte('monthly_period', startDate.toISOString().slice(0, 7) + '-01')
        .lte('monthly_period', endDate.toISOString().slice(0, 7) + '-01')
        .order('monthly_period');

      if (error) {
        throw new Error(`Failed to fetch Guardian trends: ${error.message}`);
      }

      // Group by month and calculate trends
      const monthlyData = data?.reduce((acc, event) => {
        const month = event.monthly_period;
        if (!acc[month]) {
          acc[month] = { total: 0, verified: 0 };
        }
        acc[month].total++;
        if (event.confirmation === 'verified') {
          acc[month].verified++;
        }
        return acc;
      }, {} as Record<string, { total: number; verified: number }>) || {};

      // Convert to trend analysis
      const trends = Object.entries(monthlyData).map(([month, data]) => {
        const verificationRate = data.total > 0 ? (data.verified / data.total) * 100 : 0;
        
        return {
          current_value: verificationRate,
          previous_value: 0, // Will be calculated with previous month comparison
          change_percentage: 0,
          trend_direction: 'stable' as const,
          significance: 'medium' as const
        };
      });

      return trends;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};

// Bulk Guardian Event Import
export const useImportGuardianEvents = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      events, 
      uploadBatchId 
    }: { 
      events: Omit<GuardianEvent, 'id' | 'created_at' | 'updated_at'>[]; 
      uploadBatchId: string;
    }) => {
      const eventsWithBatch = events.map(event => ({
        ...event,
        upload_batch_id: uploadBatchId,
        monthly_period: event.detection_time.slice(0, 7) + '-01' // YYYY-MM-01 format
      }));

      const { data, error } = await supabase
        .from('guardian_events')
        .insert(eventsWithBatch)
        .select();

      if (error) {
        throw new Error(`Failed to import Guardian events: ${error.message}`);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardian-events'] });
      queryClient.invalidateQueries({ queryKey: ['guardian-monthly-metrics'] });
    },
  });
};