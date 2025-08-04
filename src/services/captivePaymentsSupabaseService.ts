import { supabase } from '../lib/supabase';
import { CaptivePaymentRecord, parseVolume, parseDate } from './captivePaymentsDataProcessor';
import type { Tables } from '../types/supabase';

type CaptivePaymentRecordDB = Tables<'captive_payment_records'>;
type CaptiveDeliverySummaryDB = Tables<'captive_deliveries_summary'>;
type DataImportBatchDB = Tables<'data_import_batches'>;

interface BatchProcessingResult {
  batchId: string;
  recordsProcessed: number;
  recordsFailed: number;
  deliveriesCreated: number;
  errors: string[];
}

export class CaptivePaymentsSupabaseService {
  
  /**
   * Process CSV data and save to Supabase
   * Creates both individual records and aggregated delivery summaries
   */
  async processCsvToSupabase(
    csvData: string,
    carrier: 'SMB' | 'GSF',
    fileName?: string
  ): Promise<BatchProcessingResult> {
    
    // Create import batch record
    const batchReference = `${carrier}_${Date.now()}`;
    const { data: batch, error: batchError } = await supabase
      .from('data_import_batches')
      .insert({
        source_type: 'captive_payments',
        source_subtype: carrier,
        file_name: fileName,
        batch_reference: batchReference,
        status: 'processing'
      })
      .select()
      .single();

    if (batchError || !batch) {
      throw new Error(`Failed to create import batch: ${batchError?.message}`);
    }

    const result: BatchProcessingResult = {
      batchId: batch.id,
      recordsProcessed: 0,
      recordsFailed: 0,
      deliveriesCreated: 0,
      errors: []
    };

    try {
      // Parse CSV data
      const records = this.parseCsvData(csvData, carrier);
      
      // Process records in batches to avoid timeouts
      const batchSize = 100;
      const recordBatches = this.chunkArray(records, batchSize);
      
      for (const recordBatch of recordBatches) {
        try {
          // Insert payment records
          const { error: recordsError } = await supabase
            .from('captive_payment_records')
            .insert(recordBatch);

          if (recordsError) {
            result.recordsFailed += recordBatch.length;
            result.errors.push(`Batch insert failed: ${recordsError.message}`);
            continue;
          }

          result.recordsProcessed += recordBatch.length;
        } catch (error) {
          result.recordsFailed += recordBatch.length;
          result.errors.push(`Batch processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Refresh materialized view after successful import
      if (result.recordsProcessed > 0) {
        try {
          const { error: refreshError } = await supabase.rpc('refresh_captive_analytics');
          if (refreshError) {
            result.errors.push(`Failed to refresh analytics view: ${refreshError.message}`);
          }
        } catch (error) {
          result.errors.push(`Analytics refresh error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Update batch status
      const finalStatus = result.recordsFailed > 0 ? 
        (result.recordsProcessed > 0 ? 'partial' : 'failed') : 
        'completed';

      await supabase
        .from('data_import_batches')
        .update({
          records_processed: result.recordsProcessed,
          records_failed: result.recordsFailed,
          status: finalStatus,
          completed_at: new Date().toISOString(),
          error_summary: result.errors.length > 0 ? { errors: result.errors } : null,
          processing_metadata: {
            deliveries_created: result.deliveriesCreated,
            total_records: records.length
          }
        })
        .eq('id', batch.id);

      return result;

    } catch (error) {
      // Update batch as failed
      await supabase
        .from('data_import_batches')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_summary: { 
            error: error instanceof Error ? error.message : 'Unknown processing error' 
          }
        })
        .eq('id', batch.id);

      throw error;
    }
  }

  /**
   * Parse CSV data into CaptivePaymentRecord format for database
   */
  private parseCsvData(csvData: string, carrier: 'SMB' | 'GSF'): Omit<CaptivePaymentRecordDB, 'id' | 'created_at' | 'updated_at'>[] {
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const records: Omit<CaptivePaymentRecordDB, 'id' | 'created_at' | 'updated_at'>[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = this.parseCSVLine(lines[i]);
        if (values.length < headers.length) continue;

        const record: CaptivePaymentRecord = {
          date: values[0]?.trim() || '',
          billOfLading: values[1]?.trim() || '',
          location: values[2]?.trim() || '',
          customer: values[3]?.trim() || '',
          product: values[4]?.trim() || '',
          volume: parseVolume(values[5] || '0')
        };

        // Skip invalid records
        if (!record.date || !record.billOfLading || !record.customer) {
          continue;
        }

        // Parse and validate date
        const parsedDate = parseDate(record.date);
        if (!parsedDate) continue;

        records.push({
          bill_of_lading: record.billOfLading,
          carrier: carrier,
          delivery_date: parsedDate.toISOString().split('T')[0], // YYYY-MM-DD format
          terminal: record.location,
          customer: record.customer,
          product: record.product,
          volume_litres: record.volume,
          raw_location: record.location,
          source_file: 'CSV Import',
          import_batch_id: null
        });
      } catch (error) {
        // Skip invalid lines
        continue;
      }
    }

    return records;
  }


  /**
   * Parse CSV line handling quoted values and commas
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Get processing statistics for a batch
   */
  async getBatchStatus(batchId: string): Promise<DataImportBatchDB | null> {
    const { data, error } = await supabase
      .from('data_import_batches')
      .select('*')
      .eq('id', batchId)
      .single();

    if (error) {
      console.error('Error fetching batch status:', error);
      return null;
    }

    return data;
  }

  /**
   * Get recent import batches
   */
  async getRecentBatches(limit = 10): Promise<DataImportBatchDB[]> {
    const { data, error } = await supabase
      .from('data_import_batches')
      .select('*')
      .eq('source_type', 'captive_payments')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent batches:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get captive payments analytics data from Supabase views
   */
  async getCaptivePaymentsAnalytics(
    carrier?: 'SMB' | 'GSF',
    yearFilter?: number
  ) {
    let query = supabase
      .from('captive_payments_analytics')
      .select('*');

    if (carrier) {
      query = query.eq('carrier', carrier);
    }

    if (yearFilter) {
      query = query.eq('year', yearFilter);
    }

    const { data, error } = await query.order('year', { ascending: false });

    if (error) {
      console.error('Error fetching captive payments analytics:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get captive deliveries data directly from materialized view
   */
  async getCaptiveDeliveries(filters?: {
    carrier?: 'SMB' | 'GSF';
    startDate?: string;
    endDate?: string;
    customer?: string;
    terminal?: string;
  }) {
    let query = supabase
      .from('captive_deliveries')
      .select('*');

    if (filters?.carrier) {
      query = query.eq('carrier', filters.carrier);
    }

    if (filters?.startDate) {
      query = query.gte('delivery_date', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('delivery_date', filters.endDate);
    }

    if (filters?.customer) {
      query = query.ilike('customer', `%${filters.customer}%`);
    }

    if (filters?.terminal) {
      query = query.eq('terminal', filters.terminal);
    }

    const { data, error } = await query
      .order('delivery_date', { ascending: false })
      .limit(1000);

    if (error) {
      console.error('Error fetching captive deliveries:', error);
      return [];
    }

    return data || [];
  }
}