import { supabase } from '../lib/supabase';
import type { Tables } from '../types/supabase';

type GuardianEventDB = Tables<'guardian_events'>;
type DataImportBatchDB = Tables<'data_import_batches'>;

export interface GuardianEventData {
  vehicleRegistration: string;
  guardianUnit?: string;
  eventType: string;
  occurredAt: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  driverName?: string;
  duration?: number; // seconds
  speed?: number; // km/h
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  verified?: boolean;
  status?: string;
  fleet: 'Stevemacs' | 'Great Southern Fuels';
  depot?: string;
  rawData?: any;
}

interface GuardianProcessingResult {
  batchId: string;
  eventsProcessed: number;
  eventsFailed: number;
  errors: string[];
  duplicatesSkipped: number;
}

export class GuardianSupabaseService {

  /**
   * Process Guardian events from CSV and save to Supabase
   */
  async processCsvEventsToSupabase(
    csvData: string,
    fileName?: string
  ): Promise<GuardianProcessingResult> {
    
    const batchReference = `guardian_csv_${Date.now()}`;
    
    const { data: batch, error: batchError } = await supabase
      .from('data_import_batches')
      .insert({
        source_type: 'guardian_events',
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

    const result: GuardianProcessingResult = {
      batchId: batch.id,
      eventsProcessed: 0,
      eventsFailed: 0,
      errors: [],
      duplicatesSkipped: 0
    };

    try {
      // Parse CSV events
      const events = this.parseCsvEvents(csvData);
      
      // Process in batches to avoid timeouts
      const batchSize = 100;
      const eventBatches = this.chunkArray(events, batchSize);
      
      for (const eventBatch of eventBatches) {
        try {
          // Insert events batch
          const { error: insertError } = await supabase
            .from('guardian_events')
            .insert(eventBatch);

          if (insertError) {
            result.eventsFailed += eventBatch.length;
            result.errors.push(`Batch insert failed: ${insertError.message}`);
            continue;
          }

          result.eventsProcessed += eventBatch.length;
        } catch (error) {
          result.eventsFailed += eventBatch.length;
          result.errors.push(`Batch processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
   * Process Guardian events from API data
   */
  async processApiEventsToSupabase(
    events: GuardianEventData[]
  ): Promise<GuardianProcessingResult> {
    
    const batchReference = `guardian_api_${Date.now()}`;
    
    const { data: batch, error: batchError } = await supabase
      .from('data_import_batches')
      .insert({
        source_type: 'guardian_events',
        source_subtype: 'API',
        batch_reference: batchReference,
        status: 'processing'
      })
      .select()
      .single();

    if (batchError || !batch) {
      throw new Error(`Failed to create import batch: ${batchError?.message}`);
    }

    const result: GuardianProcessingResult = {
      batchId: batch.id,
      eventsProcessed: 0,
      eventsFailed: 0,
      errors: [],
      duplicatesSkipped: 0
    };

    try {
      const dbRecords = events.map(event => this.convertToDbRecord(event));
      
      // Process in batches
      const batchSize = 100;
      const eventBatches = this.chunkArray(dbRecords, batchSize);
      
      for (const eventBatch of eventBatches) {
        try {
          const { error: insertError } = await supabase
            .from('guardian_events')
            .insert(eventBatch);

          if (insertError) {
            result.eventsFailed += eventBatch.length;
            result.errors.push(`Batch insert failed: ${insertError.message}`);
            continue;
          }

          result.eventsProcessed += eventBatch.length;
        } catch (error) {
          result.eventsFailed += eventBatch.length;
          result.errors.push(`Batch processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
   * Parse CSV Guardian events data
   */
  private parseCsvEvents(csvData: string): Omit<GuardianEventDB, 'id' | 'created_at' | 'updated_at'>[] {
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const events: Omit<GuardianEventDB, 'id' | 'created_at' | 'updated_at'>[] = [];

    // Create header mapping for flexible CSV parsing
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
      
      // Map common Guardian CSV headers
      if (normalized.includes('vehicle') || normalized.includes('registration') || normalized.includes('rego')) {
        map.vehicle = index;
      } else if (normalized.includes('guardian') || normalized.includes('unit')) {
        map.guardianUnit = index;
      } else if (normalized.includes('event') && normalized.includes('type')) {
        map.eventType = index;
      } else if (normalized.includes('datetime') || normalized.includes('timestamp') || normalized.includes('occurred')) {
        map.occurredAt = index;
      } else if (normalized.includes('location') || normalized.includes('address')) {
        map.location = index;
      } else if (normalized.includes('latitude') || normalized.includes('lat')) {
        map.latitude = index;
      } else if (normalized.includes('longitude') || normalized.includes('lng') || normalized.includes('lon')) {
        map.longitude = index;
      } else if (normalized.includes('driver')) {
        map.driver = index;
      } else if (normalized.includes('duration')) {
        map.duration = index;
      } else if (normalized.includes('speed')) {
        map.speed = index;
      } else if (normalized.includes('severity') || normalized.includes('priority')) {
        map.severity = index;
      } else if (normalized.includes('fleet') || normalized.includes('company')) {
        map.fleet = index;
      } else if (normalized.includes('depot') || normalized.includes('terminal')) {
        map.depot = index;
      }
    });

    return map;
  }

  /**
   * Map CSV row to Guardian event record
   */
  private mapCsvRowToEvent(
    values: string[], 
    headerMap: Record<string, number>
  ): Omit<GuardianEventDB, 'id' | 'created_at' | 'updated_at'> | null {
    
    if (!headerMap.vehicle || !values[headerMap.vehicle] || !headerMap.eventType || !values[headerMap.eventType]) {
      return null;
    }

    const vehicle = values[headerMap.vehicle]?.trim();
    const eventType = values[headerMap.eventType]?.trim();
    
    if (!vehicle || !eventType) {
      return null;
    }

    const fleet = this.determineFleet(
      values[headerMap.fleet]?.trim() || '',
      vehicle
    );

    return {
      vehicle_registration: vehicle,
      guardian_unit: values[headerMap.guardianUnit]?.trim() || null,
      event_type: eventType,
      occurred_at: this.parseDateTime(values[headerMap.occurredAt]?.trim() || ''),
      location: values[headerMap.location]?.trim() || null,
      latitude: this.parseNumber(values[headerMap.latitude]),
      longitude: this.parseNumber(values[headerMap.longitude]),
      driver_name: values[headerMap.driver]?.trim() || null,
      duration: this.parseInteger(values[headerMap.duration]),
      speed: this.parseNumber(values[headerMap.speed]),
      severity: this.mapSeverity(values[headerMap.severity]?.trim() || ''),
      verified: this.shouldAutoVerify(eventType),
      status: 'Active',
      fleet: fleet,
      depot: values[headerMap.depot]?.trim() || this.inferDepot(values[headerMap.location]?.trim() || ''),
      raw_data: Object.fromEntries(values.map((value, index) => [`field_${index}`, value]))
    };
  }

  /**
   * Convert GuardianEventData to database record format
   */
  private convertToDbRecord(event: GuardianEventData): Omit<GuardianEventDB, 'id' | 'created_at' | 'updated_at'> {
    return {
      vehicle_registration: event.vehicleRegistration,
      guardian_unit: event.guardianUnit || null,
      event_type: event.eventType,
      occurred_at: new Date(event.occurredAt).toISOString(),
      location: event.location || null,
      latitude: event.latitude || null,
      longitude: event.longitude || null,
      driver_name: event.driverName || null,
      duration: event.duration || null,
      speed: event.speed || null,
      severity: event.severity,
      verified: event.verified || false,
      status: event.status || 'Active',
      fleet: event.fleet,
      depot: event.depot || null,
      raw_data: event.rawData || {}
    };
  }

  /**
   * Helper methods for data processing
   */
  private determineFleet(fleetValue: string, vehicleRegistration: string): 'Stevemacs' | 'Great Southern Fuels' {
    if (fleetValue.toLowerCase().includes('great southern')) {
      return 'Great Southern Fuels';
    }
    if (fleetValue.toLowerCase().includes('stevemacs')) {
      return 'Stevemacs';
    }
    
    // Infer from vehicle registration patterns if needed
    // This would need to be customized based on actual registration patterns
    return 'Stevemacs'; // Default
  }

  private mapSeverity(severityValue: string): 'Low' | 'Medium' | 'High' | 'Critical' {
    const severity = severityValue.toLowerCase();
    
    if (severity.includes('critical') || severity.includes('severe')) {
      return 'Critical';
    } else if (severity.includes('high') || severity.includes('major')) {
      return 'High';
    } else if (severity.includes('medium') || severity.includes('moderate')) {
      return 'Medium';
    } else {
      return 'Low';
    }
  }

  private shouldAutoVerify(eventType: string): boolean {
    // Auto-verify certain event types
    const autoVerifyTypes = ['harsh braking', 'hard acceleration', 'cornering'];
    return autoVerifyTypes.some(type => eventType.toLowerCase().includes(type));
  }

  private inferDepot(location: string): string {
    const locationLower = location.toLowerCase();
    
    if (locationLower.includes('kalgoorlie')) return 'Kalgoorlie';
    if (locationLower.includes('albany')) return 'Albany';
    if (locationLower.includes('kewdale') || locationLower.includes('perth')) return 'Kewdale';
    if (locationLower.includes('bunbury')) return 'Bunbury';
    
    return 'Unknown';
  }

  private parseDateTime(dateTime: string): string {
    try {
      const parsed = new Date(dateTime);
      return parsed.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  private parseNumber(value: string | undefined): number | null {
    if (!value) return null;
    const parsed = parseFloat(value.replace(/[^0-9.-]/g, ''));
    return isNaN(parsed) ? null : parsed;
  }

  private parseInteger(value: string | undefined): number | null {
    if (!value) return null;
    const parsed = parseInt(value.replace(/[^0-9-]/g, ''));
    return isNaN(parsed) ? null : parsed;
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
    result: GuardianProcessingResult, 
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
          duplicates_skipped: result.duplicatesSkipped
        }
      })
      .eq('id', batchId);
  }

  /**
   * Get Guardian events analytics
   */
  async getGuardianEventsAnalytics(
    fleet?: 'Stevemacs' | 'Great Southern Fuels',
    depot?: string,
    startDate?: Date,
    endDate?: Date
  ) {
    let query = supabase
      .from('guardian_events')
      .select(`
        *,
        count() over() as total_count
      `);

    if (fleet) {
      query = query.eq('fleet', fleet);
    }

    if (depot) {
      query = query.eq('depot', depot);
    }

    if (startDate) {
      query = query.gte('occurred_at', startDate.toISOString());
    }

    if (endDate) {
      query = query.lte('occurred_at', endDate.toISOString());
    }

    const { data, error } = await query
      .order('occurred_at', { ascending: false })
      .limit(1000);

    if (error) {
      console.error('Error fetching Guardian events analytics:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Update event verification status
   */
  async updateEventVerification(
    eventId: string, 
    verified: boolean, 
    notes?: string
  ): Promise<boolean> {
    const { error } = await supabase
      .from('guardian_events')
      .update({ 
        verified, 
        status: verified ? 'Verified' : 'Pending Verification',
        raw_data: notes ? { verification_notes: notes } : undefined
      })
      .eq('id', eventId);

    if (error) {
      console.error('Error updating event verification:', error);
      return false;
    }

    return true;
  }

  /**
   * Get events requiring verification
   */
  async getEventsRequiringVerification(
    fleet?: 'Stevemacs' | 'Great Southern Fuels',
    limit = 50
  ) {
    let query = supabase
      .from('guardian_events')
      .select('*')
      .eq('verified', false)
      .in('severity', ['High', 'Critical']);

    if (fleet) {
      query = query.eq('fleet', fleet);
    }

    const { data, error } = await query
      .order('occurred_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching events requiring verification:', error);
      return [];
    }

    return data || [];
  }
}