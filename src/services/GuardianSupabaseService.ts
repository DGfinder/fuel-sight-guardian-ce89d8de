import { supabase } from '../lib/supabase';
import type { Tables } from '../types/supabase';

type GuardianEventDB = Tables<'guardian_events'>;
type DataImportBatchDB = Tables<'data_import_batches'>;

export interface GuardianEventData {
  vehicleRegistration: string;
  guardianUnit?: string;
  eventType: string;
  detection_time: string;
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
   * Lookup vehicle fleet from database
   */
  private async lookupVehicleFleet(vehicleRegistration: string): Promise<string | null> {
    try {
      const { data: vehicle, error } = await supabase
        .from('vehicles')
        .select('fleet')
        .eq('registration', vehicleRegistration.trim().replace(/\s+/g, '').toUpperCase())
        .single();
      
      if (error || !vehicle) {
        return null;
      }
      
      return vehicle.fleet;
    } catch (error) {
      console.warn(`Failed to lookup fleet for vehicle ${vehicleRegistration}:`, error);
      return null;
    }
  }

  /**
   * Process Guardian events from new CSV format and save to Supabase
   * Enhanced to handle the Guardian CSV format: event_id, vehicle_id, vehicle, driver, detection_time, event_type, confirmation, classification, fleet
   */
  async processGuardianCsvImport(
    records: any[],
    metadata: {
      import_batch_id: string;
      source_file: string;
      fleet: string;
      created_by: string;
    }
  ): Promise<{
    success: boolean;
    insertedCount: number;
    batchId: string;
    errors?: string[];
  }> {
    
    // Create import batch record
    const { data: batch, error: batchError } = await supabase
      .from('data_import_batches')
      .insert({
        source_type: 'guardian_events',
        source_subtype: 'CSV',
        file_name: metadata.source_file,
        batch_reference: metadata.import_batch_id,
        status: 'processing',
        created_by: metadata.created_by
      })
      .select()
      .single();

    if (batchError || !batch) {
      throw new Error(`Failed to create import batch: ${batchError?.message}`);
    }

    try {
      // Transform records to enhanced database format with fleet lookup
      console.log('🔍 Looking up vehicle fleets for accurate classification...');
      const dbRecords = [];
      
      for (const record of records) {
        // Lookup actual fleet from vehicles table
        const actualFleet = await this.lookupVehicleFleet(record.vehicle);
        const finalFleet = actualFleet || this.determineFleet(record.fleet || metadata.fleet, record.vehicle);
        
        dbRecords.push({
          external_event_id: record.event_id,
          vehicle_id: record.vehicle_id || null,
          vehicle_registration: record.vehicle,
          driver_name: record.driver || null,
          detection_time: this.parseDateTime(record.detection_time),
          utc_offset: record.utc_offset ? parseInt(record.utc_offset) : null,
          timezone: record.timezone || null,
          latitude: this.parseNumber(record.latitude),
          longitude: this.parseNumber(record.longitude),
          event_type: record.event_type,
          detected_event_type: record.detected_event_type || null,
          confirmation: record.confirmation || null,
          confirmation_time: record.confirmation_time ? this.parseDateTime(record.confirmation_time) : null,
          classification: record.classification || null,
          duration_seconds: this.parseNumber(record.duration_seconds),
          speed_kph: this.parseNumber(record.speed_kph),
          travel_metres: this.parseNumber(record.travel_metres),
          trip_distance_metres: this.parseNumber(record.trip_distance_metres),
          trip_time_seconds: record.trip_time_seconds ? parseInt(record.trip_time_seconds) : null,
          audio_alert: record.audio_alert === 'yes',
          vibration_alert: record.vibration_alert === 'yes',
          fleet: finalFleet,
          account: record.account || null,
          service_provider: record.service_provider || null,
          shift_info: record.shift || null,
          crew: record.crew || null,
          guardian_unit: record.guardian_unit || null,
          software_version: record.software_version || null,
          tags: record.tags || null,
          severity: this.mapGuardianSeverity(record.event_type, record.classification, record.confirmation),
          verified: this.shouldAutoVerify(record.event_type, record.confirmation),
          status: this.mapGuardianStatus(record.confirmation, record.classification),
          depot: this.inferDepotFromVehicle(record.vehicle),
          import_batch_id: metadata.import_batch_id,
          raw_data: {
            complete_guardian_record: record,
            fleet_lookup_result: {
              original_fleet: record.fleet || metadata.fleet,
              actual_fleet: actualFleet,
              final_fleet: finalFleet
            }
          }
        });
      }

      // Insert in batches to avoid timeouts
      const batchSize = 100;
      let insertedCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < dbRecords.length; i += batchSize) {
        const batch = dbRecords.slice(i, i + batchSize);
        
        const { error: insertError, count } = await supabase
          .from('guardian_events')
          .insert(batch)
          .select('*', { count: 'exact' });

        if (insertError) {
          errors.push(`Batch ${Math.floor(i/batchSize) + 1}: ${insertError.message}`);
        } else {
          insertedCount += count || batch.length;
        }
      }

      // Update batch status
      await supabase
        .from('data_import_batches')
        .update({
          records_processed: insertedCount,
          records_failed: records.length - insertedCount,
          status: errors.length > 0 ? 'partial' : 'completed',
          completed_at: new Date().toISOString(),
          error_summary: errors.length > 0 ? { errors } : null
        })
        .eq('id', batch.id);

      return {
        success: true,
        insertedCount,
        batchId: batch.id,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      // Update batch as failed
      await supabase
        .from('data_import_batches')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_summary: { main_error: error instanceof Error ? error.message : 'Unknown error' }
        })
        .eq('id', batch.id);
      
      throw error;
    }
  }

  /**
   * Process Guardian events from CSV and save to Supabase (Legacy method)
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
   * Create header mapping for CSV parsing - Enhanced for Guardian CSV format
   */
  private createHeaderMap(headers: string[]): Record<string, number> {
    const map: Record<string, number> = {};
    
    headers.forEach((header, index) => {
      const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // Map specific Guardian CSV headers (from sample: event_id, vehicle_id, vehicle, driver, detection_time, event_type, confirmation, classification, fleet)
      if (header === 'event_id') {
        map.eventId = index;
      } else if (header === 'vehicle_id') {
        map.vehicleId = index;
      } else if (header === 'vehicle') {
        map.vehicle = index;
      } else if (header === 'driver') {
        map.driver = index;
      } else if (header === 'detection_time') {
        map.detection_time = index;
      } else if (header === 'event_type') {
        map.eventType = index;
      } else if (header === 'confirmation') {
        map.confirmation = index;
      } else if (header === 'classification') {
        map.classification = index;
      } else if (header === 'fleet') {
        map.fleet = index;
      }
      // Fallback patterns for flexibility
      else if (normalized.includes('vehicle') || normalized.includes('registration') || normalized.includes('rego')) {
        map.vehicle = index;
      } else if (normalized.includes('guardian') || normalized.includes('unit')) {
        map.guardianUnit = index;
      } else if (normalized.includes('event') && normalized.includes('type')) {
        map.eventType = index;
      } else if (normalized.includes('datetime') || normalized.includes('timestamp') || normalized.includes('occurred') || normalized.includes('detection')) {
        map.detection_time = index;
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
   * Map CSV row to Guardian event record - Enhanced for Guardian CSV format
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
    const eventId = values[headerMap.eventId]?.trim();
    
    if (!vehicle || !eventType) {
      return null;
    }

    const fleet = this.determineFleet(
      values[headerMap.fleet]?.trim() || '',
      vehicle
    );

    // Map Guardian-specific event severity based on event type and classification
    const classification = values[headerMap.classification]?.trim() || '';
    const confirmation = values[headerMap.confirmation]?.trim() || '';
    const severity = this.mapGuardianSeverity(eventType, classification, confirmation);

    return {
      vehicle_registration: vehicle,
      guardian_unit: values[headerMap.vehicleId]?.trim() || values[headerMap.guardianUnit]?.trim() || null,
      event_type: eventType,
      detection_time: this.parseDateTime(values[headerMap.detection_time]?.trim() || ''),
      location: values[headerMap.location]?.trim() || null,
      latitude: this.parseNumber(values[headerMap.latitude]),
      longitude: this.parseNumber(values[headerMap.longitude]),
      driver_name: values[headerMap.driver]?.trim() || null,
      duration: this.parseInteger(values[headerMap.duration]),
      speed: this.parseNumber(values[headerMap.speed]),
      severity: severity,
      verified: this.shouldAutoVerify(eventType, confirmation),
      status: this.mapGuardianStatus(confirmation, classification),
      fleet: fleet,
      depot: values[headerMap.depot]?.trim() || this.inferDepot(values[headerMap.location]?.trim() || ''),
      raw_data: {
        event_id: eventId,
        confirmation: confirmation,
        classification: classification,
        original_data: Object.fromEntries(values.map((value, index) => [`field_${index}`, value]))
      }
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
      detection_time: new Date(event.detection_time).toISOString(),
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
    const fleetLower = fleetValue.toLowerCase();
    
    if (fleetLower.includes('great southern') || fleetLower.includes('gsf')) {
      return 'Great Southern Fuels';
    }
    if (fleetLower.includes('stevemacs') || fleetLower.includes('steve')) {
      return 'Stevemacs';
    }
    
    // Infer from vehicle registration patterns
    const rego = vehicleRegistration.toLowerCase();
    
    // GSF patterns (customize based on actual patterns)
    if (rego.startsWith('gsf') || rego.includes('southern')) {
      return 'Great Southern Fuels';
    }
    
    // Stevemacs patterns (customize based on actual patterns)
    if (rego.startsWith('sm') || rego.includes('steve')) {
      return 'Stevemacs';
    }
    
    // Default to Stevemacs if uncertain
    return 'Stevemacs';
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

  /**
   * Map Guardian-specific severity based on event type and classification
   */
  private mapGuardianSeverity(
    eventType: string, 
    classification: string, 
    confirmation: string
  ): 'Low' | 'Medium' | 'High' | 'Critical' {
    const type = eventType.toLowerCase();
    const classif = classification.toLowerCase();
    const confirm = confirmation.toLowerCase();
    
    // Critical events
    if (type.includes('fatigue') || type.includes('microsleep')) {
      return 'Critical';
    }
    
    // High severity events
    if (type.includes('distraction') && !type.includes('minor')) {
      return 'High';
    }
    
    if (type.includes('phone') || type.includes('mobile')) {
      return 'High';
    }
    
    // Medium severity events
    if (type.includes('eating') || type.includes('drinking') || type.includes('smoking')) {
      return 'Medium';
    }
    
    if (type.includes('fov') && type.includes('exception')) {
      return 'Medium';
    }
    
    // Check classification for severity indicators
    if (classif.includes('verified') || confirm.includes('verified')) {
      // Bump up severity for verified events
      if (type.includes('distraction')) return 'High';
      return 'Medium';
    }
    
    // Default to low for minor or unverified events
    return 'Low';
  }

  /**
   * Map Guardian status based on confirmation and classification
   */
  private mapGuardianStatus(confirmation: string, classification: string): string {
    const confirm = confirmation.toLowerCase();
    const classif = classification.toLowerCase();
    
    if (confirm.includes('verified') || classif.includes('verified')) {
      return 'Verified';
    }
    
    if (confirm.includes('false') || classif.includes('false')) {
      return 'False Positive';
    }
    
    if (confirm.includes('pending') || classif.includes('pending')) {
      return 'Pending Review';
    }
    
    return 'Active';
  }

  private shouldAutoVerify(eventType: string, confirmation?: string): boolean {
    // Auto-verify based on Guardian confirmation status
    if (confirmation && confirmation.toLowerCase().includes('verified')) {
      return true;
    }
    
    // Auto-verify certain event types
    const autoVerifyTypes = ['harsh braking', 'hard acceleration', 'cornering', 'fov exception'];
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

  /**
   * Infer depot from vehicle registration patterns
   */
  private inferDepotFromVehicle(vehicleRegistration: string): string {
    const vehicle = vehicleRegistration.toLowerCase();
    
    // Customize these patterns based on actual fleet vehicle numbering
    if (vehicle.includes('kal') || vehicle.startsWith('k')) return 'Kalgoorlie';
    if (vehicle.includes('alb') || vehicle.startsWith('a')) return 'Albany';
    if (vehicle.includes('kew') || vehicle.includes('per') || vehicle.startsWith('p')) return 'Kewdale';
    if (vehicle.includes('bun') || vehicle.startsWith('b')) return 'Bunbury';
    
    return 'Unknown';
  }

  private parseDateTime(dateTime: string): string {
    try {
      // Handle Guardian detection_time format (e.g., "2025-08-07T10:05:51")
      if (dateTime.includes('T') && dateTime.length >= 19) {
        const parsed = new Date(dateTime);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString();
        }
      }
      
      // Fallback parsing
      const parsed = new Date(dateTime);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
      
      throw new Error('Invalid date format');
    } catch {
      // If all parsing fails, use current time
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
      query = query.gte('detection_time', startDate.toISOString());
    }

    if (endDate) {
      query = query.lte('detection_time', endDate.toISOString());
    }

    const { data, error } = await query
      .order('detection_time', { ascending: false })
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
      .order('detection_time', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching events requiring verification:', error);
      return [];
    }

    return data || [];
  }
}