import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface QualityMetric {
  category: string;
  metric: string;
  value: number;
  details: string;
}

export interface DataQualityDashboard {
  metrics: QualityMetric[];
  summary: {
    totalRecords: number;
    avgQualityScore: number;
    relationshipHealth: number;
  };
}

export function useDataQualityDashboard() {
  return useQuery({
    queryKey: ['data-quality-dashboard'],
    queryFn: async (): Promise<DataQualityDashboard> => {
      const { data, error } = await supabase
        .from('data_quality_dashboard')
        .select('*');

      if (error) {
        console.error('Error fetching data quality dashboard:', error);
        throw error;
      }

      // Transform the data
      const metrics: QualityMetric[] = (data || []).map((row) => ({
        category: row.category,
        metric: row.metric,
        value: row.value || 0,
        details: row.details || '',
      }));

      // Calculate summary stats
      const totalRecordsMetric = metrics.find(m => m.metric === 'Total Records');
      const totalRecords = totalRecordsMetric?.value || 0;

      // Calculate average quality from match rates
      const matchRates = metrics
        .filter(m => m.details && m.details.includes('match_rate'))
        .map(m => {
          try {
            const details = JSON.parse(m.details);
            return parseFloat(details.vehicle_match_rate || details.driver_match_rate || '0');
          } catch {
            return 0;
          }
        });

      const avgQualityScore = matchRates.length > 0
        ? Math.round(matchRates.reduce((a, b) => a + b, 0) / matchRates.length)
        : 0;

      // Calculate relationship health (weighted average)
      const correlationMetric = metrics.find(m => m.details && m.details.includes('correlation_rate'));
      let relationshipHealth = 0;
      if (correlationMetric?.details) {
        try {
          const details = JSON.parse(correlationMetric.details);
          relationshipHealth = parseFloat(details.correlation_rate || '0');
        } catch {
          relationshipHealth = 0;
        }
      }

      return {
        metrics,
        summary: {
          totalRecords,
          avgQualityScore,
          relationshipHealth: Math.round(relationshipHealth),
        },
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}
