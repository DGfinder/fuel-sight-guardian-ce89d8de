import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { 
  CarrierDelivery, 
  UploadBatch,
  AnalyticsFilter,
  PaginatedResponse,
  FileProcessingResult
} from '../types/analytics';

// MYOB Delivery Data Management
export const useCarrierDeliveries = (filters?: AnalyticsFilter & { carrier?: 'SMB' | 'GSF' }) => {
  return useQuery({
    queryKey: ['carrier-deliveries', filters],
    queryFn: async (): Promise<PaginatedResponse<CarrierDelivery>> => {
      let query = supabase
        .from('carrier_deliveries')
        .select('*', { count: 'exact' })
        .order('delivery_date', { ascending: false });

      // Apply filters
      if (filters?.date_range) {
        query = query
          .gte('delivery_date', filters.date_range.start_date)
          .lte('delivery_date', filters.date_range.end_date);
      }

      if (filters?.carrier && filters.carrier.length > 0) {
        query = query.in('carrier', filters.carrier);
      }

      const { data, error, count } = await query.limit(100);

      if (error) {
        throw new Error(`Failed to fetch carrier deliveries: ${error.message}`);
      }

      return {
        data: data || [],
        count: data?.length || 0,
        total: count || 0,
        page: 1,
        per_page: 100,
        total_pages: Math.ceil((count || 0) / 100)
      };
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Monthly Delivery Summary by Carrier
export const useMonthlyDeliverySummary = (monthYear?: string) => {
  return useQuery({
    queryKey: ['monthly-delivery-summary', monthYear],
    queryFn: async () => {
      const targetMonth = monthYear || new Date().toISOString().slice(0, 7) + '-01';
      
      const { data, error } = await supabase
        .from('carrier_deliveries')
        .select('carrier, volume_litres, customer, product')
        .eq('monthly_period', targetMonth)
        .not('volume_litres', 'is', null);

      if (error) {
        throw new Error(`Failed to fetch monthly delivery summary: ${error.message}`);
      }

      // Process data by carrier
      const summary = {
        SMB: {
          total_deliveries: 0,
          total_volume: 0,
          unique_customers: new Set<string>(),
          top_products: {} as Record<string, number>,
          top_customers: {} as Record<string, number>
        },
        GSF: {
          total_deliveries: 0,
          total_volume: 0,
          unique_customers: new Set<string>(),
          top_products: {} as Record<string, number>,
          top_customers: {} as Record<string, number>
        }
      };

      data?.forEach(delivery => {
        const carrier = delivery.carrier as 'SMB' | 'GSF';
        const volume = Math.abs(delivery.volume_litres || 0); // Use absolute value for calculations
        
        summary[carrier].total_deliveries++;
        summary[carrier].total_volume += volume;
        
        if (delivery.customer) {
          summary[carrier].unique_customers.add(delivery.customer);
          summary[carrier].top_customers[delivery.customer] = 
            (summary[carrier].top_customers[delivery.customer] || 0) + volume;
        }
        
        if (delivery.product) {
          summary[carrier].top_products[delivery.product] = 
            (summary[carrier].top_products[delivery.product] || 0) + volume;
        }
      });

      // Convert sets to arrays and sort top items
      return {
        SMB: {
          total_deliveries: summary.SMB.total_deliveries,
          total_volume: summary.SMB.total_volume,
          unique_customers: summary.SMB.unique_customers.size,
          top_products: Object.entries(summary.SMB.top_products)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([product, volume]) => ({ product, volume })),
          top_customers: Object.entries(summary.SMB.top_customers)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([customer, volume]) => ({ customer, volume }))
        },
        GSF: {
          total_deliveries: summary.GSF.total_deliveries,
          total_volume: summary.GSF.total_volume,
          unique_customers: summary.GSF.unique_customers.size,
          top_products: Object.entries(summary.GSF.top_products)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([product, volume]) => ({ product, volume })),
          top_customers: Object.entries(summary.GSF.top_customers)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([customer, volume]) => ({ customer, volume }))
        }
      };
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
};

// Upload MYOB Data with Duplicate Detection
export const useUploadMyobData = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      carrier, 
      deliveries, 
      filename,
      uploadedBy 
    }: {
      carrier: 'SMB' | 'GSF';
      deliveries: Omit<CarrierDelivery, 'id' | 'created_at' | 'updated_at'>[];
      filename: string;
      uploadedBy: string;
    }): Promise<FileProcessingResult> => {
      // Create upload batch
      const { data: batch, error: batchError } = await supabase
        .from('upload_batches')
        .insert({
          data_source_id: carrier === 'SMB' ? 'myob_smb' : 'myob_gsf',
          filename,
          upload_type: 'monthly_cfo',
          file_size: 0, // Will be calculated
          record_count: deliveries.length,
          uploaded_by: uploadedBy,
          upload_status: 'processing'
        })
        .select()
        .single();

      if (batchError) {
        throw new Error(`Failed to create upload batch: ${batchError.message}`);
      }

      // Generate checksums for duplicate detection
      const deliveriesWithMetadata = deliveries.map(delivery => {
        const checksum = generateDeliveryChecksum(delivery);
        return {
          ...delivery,
          carrier,
          upload_batch_id: batch.id,
          data_checksum: checksum,
          monthly_period: delivery.delivery_date.slice(0, 7) + '-01', // YYYY-MM-01 format
          is_adjustment: (delivery.volume_litres || 0) < 0,
          net_volume_litres: Math.abs(delivery.volume_litres || 0)
        };
      });

      // Check for existing checksums to prevent duplicates
      const checksums = deliveriesWithMetadata.map(d => d.data_checksum);
      const { data: existingChecksums, error: checksumError } = await supabase
        .from('data_checksums')
        .select('checksum')
        .in('checksum', checksums)
        .eq('record_type', 'carrier_delivery');

      if (checksumError) {
        console.warn('Could not check for duplicates:', checksumError.message);
      }

      const existingSet = new Set(existingChecksums?.map(c => c.checksum) || []);
      const newDeliveries = deliveriesWithMetadata.filter(d => !existingSet.has(d.data_checksum));
      const duplicateCount = deliveriesWithMetadata.length - newDeliveries.length;

      let processedCount = 0;
      const errors: string[] = [];

      if (newDeliveries.length > 0) {
        // Insert new deliveries
        const { data: insertedDeliveries, error: insertError } = await supabase
          .from('carrier_deliveries')
          .insert(newDeliveries)
          .select();

        if (insertError) {
          errors.push(`Failed to insert deliveries: ${insertError.message}`);
        } else {
          processedCount = insertedDeliveries?.length || 0;

          // Insert checksums for tracking
          const checksumRecords = newDeliveries.map(delivery => ({
            data_source_id: batch.data_source_id,
            record_type: 'carrier_delivery',
            checksum: delivery.data_checksum,
            original_record_id: delivery.bill_of_lading || '',
            upload_batch_id: batch.id
          }));

          const { error: checksumInsertError } = await supabase
            .from('data_checksums')
            .insert(checksumRecords);

          if (checksumInsertError) {
            console.warn('Failed to insert checksums:', checksumInsertError.message);
          }
        }
      }

      // Update upload batch status
      const { error: updateError } = await supabase
        .from('upload_batches')
        .update({
          record_count: processedCount,
          duplicate_count: duplicateCount,
          error_count: errors.length,
          upload_status: errors.length > 0 ? 'error' : 'completed',
          processing_notes: errors.length > 0 ? errors.join('; ') : 'Successfully processed',
          completed_at: new Date().toISOString()
        })
        .eq('id', batch.id);

      if (updateError) {
        console.warn('Failed to update batch status:', updateError.message);
      }

      return {
        success: errors.length === 0,
        records_processed: processedCount,
        duplicates_found: duplicateCount,
        errors,
        upload_batch_id: batch.id,
        preview_data: newDeliveries.slice(0, 5) // First 5 records for preview
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carrier-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-delivery-summary'] });
      queryClient.invalidateQueries({ queryKey: ['upload-batches'] });
    },
  });
};

// Get Upload History
export const useUploadBatches = (dataSourceName?: string) => {
  return useQuery({
    queryKey: ['upload-batches', dataSourceName],
    queryFn: async (): Promise<UploadBatch[]> => {
      let query = supabase
        .from('upload_batches')
        .select(`
          *,
          data_sources!inner(name)
        `)
        .order('uploaded_at', { ascending: false });

      if (dataSourceName) {
        query = query.eq('data_sources.name', dataSourceName);
      }

      const { data, error } = await query.limit(20);

      if (error) {
        throw new Error(`Failed to fetch upload batches: ${error.message}`);
      }

      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Delivery Trends Analysis
export const useDeliveryTrends = (carrier?: 'SMB' | 'GSF', months: number = 12) => {
  return useQuery({
    queryKey: ['delivery-trends', carrier, months],
    queryFn: async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      let query = supabase
        .from('carrier_deliveries')
        .select('monthly_period, carrier, volume_litres, customer')
        .gte('monthly_period', startDate.toISOString().slice(0, 7) + '-01')
        .lte('monthly_period', endDate.toISOString().slice(0, 7) + '-01')
        .not('volume_litres', 'is', null);

      if (carrier) {
        query = query.eq('carrier', carrier);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch delivery trends: ${error.message}`);
      }

      // Group by month and carrier
      const monthlyTrends = data?.reduce((acc, delivery) => {
        const key = `${delivery.monthly_period}-${delivery.carrier}`;
        if (!acc[key]) {
          acc[key] = {
            month: delivery.monthly_period,
            carrier: delivery.carrier,
            total_volume: 0,
            delivery_count: 0,
            unique_customers: new Set()
          };
        }
        
        acc[key].total_volume += Math.abs(delivery.volume_litres || 0);
        acc[key].delivery_count++;
        if (delivery.customer) {
          acc[key].unique_customers.add(delivery.customer);
        }
        
        return acc;
      }, {} as Record<string, any>) || {};

      // Convert to array and add calculated metrics
      return Object.values(monthlyTrends).map((trend: any) => ({
        ...trend,
        unique_customers: trend.unique_customers.size,
        avg_volume_per_delivery: trend.delivery_count > 0 ? trend.total_volume / trend.delivery_count : 0
      }));
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};

// Customer Analysis
export const useCustomerAnalysis = (timeframe: 'month' | 'quarter' | 'year' = 'month') => {
  return useQuery({
    queryKey: ['customer-analysis', timeframe],
    queryFn: async () => {
      const endDate = new Date();
      const startDate = new Date();
      
      switch (timeframe) {
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case 'year':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      const { data, error } = await supabase
        .from('carrier_deliveries')
        .select('carrier, customer, volume_litres, delivery_date, product')
        .gte('delivery_date', startDate.toISOString().slice(0, 10))
        .lte('delivery_date', endDate.toISOString().slice(0, 10))
        .not('volume_litres', 'is', null)
        .not('customer', 'is', null);

      if (error) {
        throw new Error(`Failed to fetch customer analysis: ${error.message}`);
      }

      // Analyze customer patterns
      const customerMetrics = data?.reduce((acc, delivery) => {
        const key = `${delivery.customer}-${delivery.carrier}`;
        if (!acc[key]) {
          acc[key] = {
            customer: delivery.customer,
            carrier: delivery.carrier,
            total_volume: 0,
            delivery_count: 0,
            products: new Set(),
            first_delivery: delivery.delivery_date,
            last_delivery: delivery.delivery_date
          };
        }
        
        acc[key].total_volume += Math.abs(delivery.volume_litres || 0);
        acc[key].delivery_count++;
        
        if (delivery.product) {
          acc[key].products.add(delivery.product);
        }
        
        if (delivery.delivery_date < acc[key].first_delivery) {
          acc[key].first_delivery = delivery.delivery_date;
        }
        
        if (delivery.delivery_date > acc[key].last_delivery) {
          acc[key].last_delivery = delivery.delivery_date;
        }
        
        return acc;
      }, {} as Record<string, any>) || {};

      return Object.values(customerMetrics)
        .map((customer: any) => ({
          ...customer,
          product_count: customer.products.size,
          avg_volume_per_delivery: customer.delivery_count > 0 ? customer.total_volume / customer.delivery_count : 0,
          delivery_frequency: calculateDeliveryFrequency(customer.first_delivery, customer.last_delivery, customer.delivery_count)
        }))
        .sort((a: any, b: any) => b.total_volume - a.total_volume);
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });
};

// Helper function to generate delivery checksum for duplicate detection
function generateDeliveryChecksum(delivery: Omit<CarrierDelivery, 'id' | 'created_at' | 'updated_at'>): string {
  const key = `${delivery.delivery_date}-${delivery.bill_of_lading}-${delivery.customer}-${delivery.product}-${delivery.volume_litres}`;
  return btoa(key).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
}

// Helper function to calculate delivery frequency
function calculateDeliveryFrequency(firstDate: string, lastDate: string, deliveryCount: number): number {
  const first = new Date(firstDate);
  const last = new Date(lastDate);
  const daysDiff = Math.max(1, (last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24));
  return deliveryCount / (daysDiff / 30); // Deliveries per month
}