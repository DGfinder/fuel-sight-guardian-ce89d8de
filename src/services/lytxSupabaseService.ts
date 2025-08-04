import { supabase } from '../lib/supabase';
import { LytxApiService } from './lytxApi';
import { LytxDataTransformer, LYTXEvent } from './lytxDataTransform';
import type { Tables } from '../types/supabase';

type LytxSafetyEventDB = Tables<'lytx_safety_events'>;
type LytxEventBehaviorDB = Tables<'lytx_event_behaviors'>;
type DataImportBatchDB = Tables<'data_import_batches'>;

interface LytxSyncResult {
  batchId: string;
  eventsProcessed: number;
  eventsFailed: number;
  behaviorsCreated: number;
  errors: string[];
  duplicatesSkipped: number;
}

export class LytxSupabaseService {
  private apiService: LytxApiService;
  private transformer: LytxDataTransformer;

  constructor() {
    this.apiService = new LytxApiService();
    this.transformer = new LytxDataTransformer();
  }

  /**
   * Sync LYTX events from API to Supabase
   * This can be called on schedule for real-time sync
   */
  async syncEventsFromApi(daysBack = 7): Promise<LytxSyncResult> {
    const batchReference = `lytx_api_sync_${Date.now()}`;
    
    // Create import batch record
    const { data: batch, error: batchError } = await supabase
      .from('data_import_batches')
      .insert({
        source_type: 'lytx_events',
        source_subtype: 'API',
        batch_reference: batchReference,
        status: 'processing'
      })
      .select()
      .single();

    if (batchError || !batch) {
      throw new Error(`Failed to create import batch: ${batchError?.message}`);
    }

    const result: LytxSyncResult = {
      batchId: batch.id,
      eventsProcessed: 0,
      eventsFailed: 0,
      behaviorsCreated: 0,
      errors: [],
      duplicatesSkipped: 0
    };

    try {
      // Initialize transformer with reference data
      await this.initializeTransformer();
      
      // Fetch events from LYTX API
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
      
      const lytxEvents = await this.apiService.getSafetyEvents(startDate, endDate);
      
      if (!lytxEvents || lytxEvents.length === 0) {
        await this.updateBatchStatus(batch.id, result, 'completed');
        return result;
      }

      // Transform and process events
      for (const lytxEvent of lytxEvents) {
        try {
          const transformedEvent = this.transformer.transformSafetyEvent(lytxEvent);
          const dbRecord = this.convertToDbRecord(transformedEvent);
          
          // Check if event already exists
          const { data: existingEvent } = await supabase
            .from('lytx_safety_events')
            .select('id')
            .eq('event_id', dbRecord.event_id)
            .single();

          if (existingEvent) {
            result.duplicatesSkipped++;
            continue;
          }

          // Insert event
          const { data: insertedEvent, error: eventError } = await supabase
            .from('lytx_safety_events')
            .insert(dbRecord)
            .select()
            .single();

          if (eventError) {
            result.eventsFailed++;
            result.errors.push(`Event ${dbRecord.event_id} failed: ${eventError.message}`);
            continue;
          }

          result.eventsProcessed++;

          // Insert behaviors if available
          if (lytxEvent.behaviors && lytxEvent.behaviors.length > 0) {
            const behaviorRecords = lytxEvent.behaviors.map(behavior => ({
              event_id: dbRecord.event_id,
              behavior_id: behavior.id,
              behavior_name: behavior.name,
              score: behavior.score || null
            }));

            const { error: behaviorError } = await supabase
              .from('lytx_event_behaviors')
              .insert(behaviorRecords);

            if (behaviorError) {
              result.errors.push(`Behaviors for event ${dbRecord.event_id} failed: ${behaviorError.message}`);
            } else {
              result.behaviorsCreated += behaviorRecords.length;
            }
          }

        } catch (error) {
          result.eventsFailed++;
          result.errors.push(`Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      await this.updateBatchStatus(batch.id, result, 'completed');
      return result;

    } catch (error) {
      await this.updateBatchStatus(batch.id, result, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Process LYTX events from CSV export and save to Supabase
   */
  async processCsvEventsToSupabase(
    csvData: string,
    fileName?: string
  ): Promise<LytxSyncResult> {
    
    const batchReference = `lytx_csv_${Date.now()}`;
    
    const { data: batch, error: batchError } = await supabase
      .from('data_import_batches')
      .insert({
        source_type: 'lytx_events',
        source_subtype: 'CSV',
        file_name: fileName,
        batch_reference: batchReference,
        status: 'processing'
      })
      .select()
      .single();

    if (batchError || !batch) {
      throw new Error(`Failed to create import batch: ${batchError?.message}`);
    }

    const result: LytxSyncResult = {
      batchId: batch.id,
      eventsProcessed: 0,
      eventsFailed: 0,
      behaviorsCreated: 0,
      errors: [],
      duplicatesSkipped: 0
    };

    try {
      // Parse CSV events
      const events = this.parseCsvEvents(csvData);
      
      // Process in batches
      const batchSize = 50;
      const eventBatches = this.chunkArray(events, batchSize);
      
      for (const eventBatch of eventBatches) {
        for (const event of eventBatch) {
          try {
            // Check for duplicates
            const { data: existingEvent } = await supabase
              .from('lytx_safety_events')
              .select('id')
              .eq('event_id', event.event_id)
              .single();

            if (existingEvent) {
              result.duplicatesSkipped++;
              continue;
            }

            // Insert event
            const { error: eventError } = await supabase
              .from('lytx_safety_events')
              .insert(event);

            if (eventError) {
              result.eventsFailed++;
              result.errors.push(`Event ${event.event_id} failed: ${eventError.message}`);
            } else {
              result.eventsProcessed++;
            }

          } catch (error) {
            result.eventsFailed++;
            result.errors.push(`Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      await this.updateBatchStatus(batch.id, result, 'completed');
      return result;

    } catch (error) {
      await this.updateBatchStatus(batch.id, result, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Initialize the transformer with reference data from LYTX API
   */
  private async initializeTransformer(): Promise<void> {
    try {
      const [statuses, triggers, behaviors, vehicles] = await Promise.all([
        this.apiService.getEventStatuses(),
        this.apiService.getEventTriggers(),
        this.apiService.getEventBehaviors(),
        this.apiService.getVehicles()
      ]);

      await this.transformer.initializeReferenceMaps(
        statuses || [],
        triggers || [],
        behaviors || [],
        vehicles || []
      );
    } catch (error) {
      console.warn('Failed to initialize transformer reference data:', error);
      // Continue with empty reference data
    }
  }

  /**
   * Convert LYTXEvent to database record format
   */
  private convertToDbRecord(event: LYTXEvent): Omit<LytxSafetyEventDB, 'id' | 'created_at' | 'updated_at'> {
    return {
      event_id: event.eventId,
      vehicle_registration: event.vehicle || null,
      device_serial: event.device,
      driver_name: event.driver,
      employee_id: event.employeeId || null,
      group_name: event.group,
      depot: this.extractDepot(event.group),
      carrier: event.carrier,
      event_datetime: this.parseEventDateTime(event.date, event.time, event.timezone),
      timezone: event.timezone,
      score: event.score,
      status: event.status,
      trigger: event.trigger,
      behaviors: event.behaviors,
      event_type: event.eventType,
      excluded: event.excluded || false,
      assigned_date: event.assignedDate ? new Date(event.assignedDate).toISOString() : null,
      reviewed_by: event.reviewedBy || null,
      notes: event.notes || null,
      raw_data: event
    };
  }

  /**
   * Parse CSV events from export file
   */
  private parseCsvEvents(csvData: string): Omit<LytxSafetyEventDB, 'id' | 'created_at' | 'updated_at'>[] {
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const events: Omit<LytxSafetyEventDB, 'id' | 'created_at' | 'updated_at'>[] = [];

    // Map headers to expected positions
    const headerMap = this.createHeaderMap(headers);

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = this.parseCSVLine(lines[i]);
        if (values.length < headers.length) continue;

        const event = this.mapCsvRowToEvent(values, headerMap);
        if (event) {
          events.push(event);
        }
      } catch (error) {
        // Skip invalid lines
        continue;
      }
    }

    return events;
  }

  /**
   * Create header mapping for CSV parsing
   */
  private createHeaderMap(headers: string[]): Record<string, number> {
    const map: Record<string, number> = {};
    
    headers.forEach((header, index) => {
      const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // Map common header variations
      if (normalized.includes('eventid') || normalized.includes('id')) {
        map.eventId = index;
      } else if (normalized.includes('driver')) {
        map.driver = index;
      } else if (normalized.includes('vehicle') || normalized.includes('registration')) {
        map.vehicle = index;
      } else if (normalized.includes('date')) {
        map.date = index;
      } else if (normalized.includes('time')) {
        map.time = index;
      } else if (normalized.includes('score')) {
        map.score = index;
      } else if (normalized.includes('status')) {
        map.status = index;
      }
      // Add more mappings as needed
    });

    return map;
  }

  /**
   * Map CSV row to event record
   */
  private mapCsvRowToEvent(
    values: string[], 
    headerMap: Record<string, number>
  ): Omit<LytxSafetyEventDB, 'id' | 'created_at' | 'updated_at'> | null {
    
    if (!headerMap.eventId || !values[headerMap.eventId]) {
      return null;
    }

    return {
      event_id: values[headerMap.eventId]?.trim() || '',
      vehicle_registration: values[headerMap.vehicle]?.trim() || null,
      device_serial: values[headerMap.device] || 'Unknown',
      driver_name: values[headerMap.driver]?.trim() || 'Unknown Driver',
      employee_id: values[headerMap.employeeId]?.trim() || null,
      group_name: values[headerMap.group]?.trim() || 'Unknown',
      depot: this.extractDepot(values[headerMap.group]?.trim() || 'Unknown'),
      carrier: this.determineCarrier(values[headerMap.group]?.trim() || 'Unknown'),
      event_datetime: this.parseEventDateTime(
        values[headerMap.date] || '', 
        values[headerMap.time] || '', 
        'Australia/Perth'
      ),
      timezone: 'Australia/Perth',
      score: parseInt(values[headerMap.score] || '0') || 0,
      status: this.mapStatus(values[headerMap.status]?.trim() || 'New'),
      trigger: values[headerMap.trigger]?.trim() || 'Unknown',
      behaviors: values[headerMap.behaviors]?.trim() || '',
      event_type: this.determineEventType(values[headerMap.eventType]?.trim() || ''),
      excluded: false,
      assigned_date: null,
      reviewed_by: null,
      notes: null,
      raw_data: Object.fromEntries(values.map((value, index) => [`field_${index}`, value]))
    };
  }

  /**
   * Helper methods for data transformation
   */
  private extractDepot(groupName: string): string {
    // Extract depot from group name
    if (groupName.toLowerCase().includes('kalgoorlie')) return 'Kalgoorlie';
    if (groupName.toLowerCase().includes('albany')) return 'Albany';
    if (groupName.toLowerCase().includes('kewdale')) return 'Kewdale';
    if (groupName.toLowerCase().includes('perth')) return 'Perth';
    return 'Unknown';
  }

  private determineCarrier(groupName: string): 'Stevemacs' | 'Great Southern Fuels' {
    return groupName.toLowerCase().includes('great southern') ? 
      'Great Southern Fuels' : 'Stevemacs';
  }

  private mapStatus(status: string): 'New' | 'Face-To-Face' | 'FYI Notify' | 'Resolved' {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('face') || statusLower.includes('coaching')) return 'Face-To-Face';
    if (statusLower.includes('fyi') || statusLower.includes('notify')) return 'FYI Notify';
    if (statusLower.includes('resolved') || statusLower.includes('closed')) return 'Resolved';
    return 'New';
  }

  private determineEventType(eventType: string): 'Coachable' | 'Driver Tagged' {
    return eventType.toLowerCase().includes('tagged') ? 'Driver Tagged' : 'Coachable';
  }

  private parseEventDateTime(date: string, time: string, timezone: string): string {
    try {
      const dateTime = new Date(`${date} ${time}`);
      return dateTime.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

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

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private async updateBatchStatus(
    batchId: string, 
    result: LytxSyncResult, 
    status: 'completed' | 'failed' | 'partial',
    error?: string
  ): Promise<void> {
    await supabase
      .from('data_import_batches')
      .update({
        records_processed: result.eventsProcessed,
        records_failed: result.eventsFailed,
        status: status,
        completed_at: new Date().toISOString(),
        error_summary: result.errors.length > 0 || error ? { 
          errors: result.errors,
          main_error: error 
        } : null,
        processing_metadata: {
          behaviors_created: result.behaviorsCreated,
          duplicates_skipped: result.duplicatesSkipped
        }
      })
      .eq('id', batchId);
  }

  /**
   * Get LYTX safety analytics data from Supabase views
   */
  async getLytxSafetyAnalytics(
    carrier?: 'Stevemacs' | 'Great Southern Fuels',
    depot?: string,
    yearFilter?: number
  ) {
    let query = supabase
      .from('lytx_safety_analytics')
      .select('*');

    if (carrier) {
      query = query.eq('carrier', carrier);
    }

    if (depot) {
      query = query.eq('depot', depot);
    }

    if (yearFilter) {
      query = query.eq('year', yearFilter);
    }

    const { data, error } = await query.order('year', { ascending: false });

    if (error) {
      console.error('Error fetching LYTX safety analytics:', error);
      return [];
    }

    return data || [];
  }
}