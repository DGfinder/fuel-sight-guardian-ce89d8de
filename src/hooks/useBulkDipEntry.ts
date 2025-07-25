import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export interface BulkDipReading {
  tank_id: string;
  value: number;
  created_at: string;
  recorded_by: string | null;
  created_by_name: string | null;
  notes?: string;
}

export interface BulkDipResult {
  success: number;
  failed: number;
  errors: Array<{ tankId: string; error: string }>;
}

export function useBulkDipEntry() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [progress, setProgress] = useState(0);

  const mutation = useMutation<BulkDipResult, Error, BulkDipReading[]>({
    mutationFn: async (readings: BulkDipReading[]) => {
      const result: BulkDipResult = {
        success: 0,
        failed: 0,
        errors: [],
      };

      // Process in batches for better performance and progress tracking
      const batchSize = 10;
      const totalBatches = Math.ceil(readings.length / batchSize);

      for (let i = 0; i < readings.length; i += batchSize) {
        const batch = readings.slice(i, i + batchSize);
        const currentBatch = Math.floor(i / batchSize) + 1;
        
        try {
          const { data, error } = await supabase
            .from('dip_readings')
            .insert(batch)
            .select();

          if (error) {
            result.failed += batch.length;
            batch.forEach(reading => {
              result.errors.push({
                tankId: reading.tank_id,
                error: error.message,
              });
            });
          } else {
            result.success += batch.length;
          }
        } catch (err) {
          result.failed += batch.length;
          batch.forEach(reading => {
            result.errors.push({
              tankId: reading.tank_id,
              error: err instanceof Error ? err.message : 'Unknown error',
            });
          });
        }

        // Update progress
        setProgress((currentBatch / totalBatches) * 100);
      }

      return result;
    },
    onSuccess: async (result) => {
      // Invalidate relevant queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tanks'] }),
        queryClient.invalidateQueries({ queryKey: ['tankHistory'] }),
        queryClient.invalidateQueries({ queryKey: ['tankAlerts'] }),
      ]);

      // Show appropriate toast based on results
      if (result.failed === 0) {
        toast({
          title: 'All readings saved successfully',
          description: `${result.success} dip readings have been recorded.`,
        });
      } else if (result.success > 0) {
        toast({
          title: 'Partial success',
          description: `${result.success} readings saved, ${result.failed} failed.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Failed to save readings',
          description: 'All dip readings failed to save. Please try again.',
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save dip readings',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setProgress(0);
    },
  });

  return {
    submitBulkReadings: mutation.mutate,
    isSubmitting: mutation.isPending,
    progress,
    reset: mutation.reset,
  };
}

// Helper function to validate bulk readings before submission
export function validateBulkReadings(
  readings: Array<{
    tank_id: string;
    value: string;
    safe_level: number;
  }>
): {
  valid: Array<{ tank_id: string; value: number }>;
  invalid: Array<{ tank_id: string; error: string }>;
} {
  const valid: Array<{ tank_id: string; value: number }> = [];
  const invalid: Array<{ tank_id: string; error: string }> = [];

  readings.forEach(reading => {
    const value = Number(reading.value);
    
    if (!reading.value || isNaN(value)) {
      invalid.push({
        tank_id: reading.tank_id,
        error: 'Invalid dip value',
      });
    } else if (value < 0) {
      invalid.push({
        tank_id: reading.tank_id,
        error: 'Dip value cannot be negative',
      });
    } else if (value > reading.safe_level) {
      invalid.push({
        tank_id: reading.tank_id,
        error: `Dip value exceeds safe level (${reading.safe_level}L)`,
      });
    } else {
      valid.push({
        tank_id: reading.tank_id,
        value,
      });
    }
  });

  return { valid, invalid };
}