/**
 * LYTX CSV Processor Service
 * 
 * Processes LYTX safety event CSV files and transforms them into database records
 * Uses the same transformation logic as existing LYTX API import tools
 */

import { supabase } from '../lib/supabase';
import type { Tables } from '../types/supabase';

type LytxSafetyEventDB = Tables<'lytx_safety_events'>;

interface LytxCsvProcessingResult {
  success: boolean;
  records: LytxSafetyEventDB[];
  metadata: {
    totalRows: number;
    validRows: number;
    skippedRows: number;
    duplicateRows: number;
    errors: string[];
    warnings: string[];
    carrier?: 'Stevemacs' | 'Great Southern Fuels';
    dateRange?: {
      start: string;
      end: string;
    };
  };
  preview: any[];
}

interface CsvRowData {
  [key: string]: string | undefined;
}

export class LytxCsvProcessor {
  private static readonly CSV_DELIMITER = ',';
  private static readonly EXPECTED_HEADERS = [
    'event_id', 'eventId', 'id', 'Event ID',
    'vehicle', 'vehicleId', 'name', 'Vehicle', 'Vehicle Registration',
    'driver', 'driverName', 'Driver', 'Driver Name',
    'group', 'groupName', 'Group', 'Group Name', 'Depot',
    'event_datetime', 'eventDateTime', 'Event Date', 'Date/Time',
    'trigger', 'Trigger', 'Event Type',
    'status', 'Status', 'Event Status',
    'behaviors', 'Behaviors', 'Behaviour',
    'score', 'Score', 'Risk Score'
  ];

  /**
   * Parse CSV content and return structured data
   */
  private static parseCsv(csvContent: string): { headers: string[]; rows: CsvRowData[] } {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV file must contain at least a header row and one data row');
    }

    const headers = lines[0].split(this.CSV_DELIMITER).map(h => h.trim().replace(/['"]/g, ''));
    const rows: CsvRowData[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVRow(lines[i]);
      if (values.length === 0) continue; // Skip empty rows
      
      const rowData: CsvRowData = {};
      headers.forEach((header, index) => {
        rowData[header] = values[index]?.trim() || undefined;
      });
      rows.push(rowData);
    }

    return { headers, rows };
  }

  /**
   * Parse a single CSV row, handling quoted values and commas
   */
  private static parseCSVRow(row: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < row.length) {
      const char = row[i];
      
      if (char === '"') {
        if (inQuotes && row[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        }
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
        i++;
        continue;
      } else {
        current += char;
      }
      i++;
    }
    
    result.push(current);
    return result;
  }

  /**
   * Map CSV row to LYTX event fields using flexible field matching
   */
  private static mapCsvRowToEvent(row: CsvRowData): any {
    const getFieldValue = (possibleNames: string[]): string | undefined => {
      for (const name of possibleNames) {
        const value = row[name];
        if (value && value.trim()) return value.trim();
      }
      return undefined;
    };

    return {
      eventId: getFieldValue(['event_id', 'eventId', 'id', 'Event ID']),
      name: getFieldValue(['vehicle', 'vehicleId', 'name', 'Vehicle', 'Vehicle Registration']),
      driverName: getFieldValue(['driver', 'driverName', 'Driver', 'Driver Name']),
      groupName: getFieldValue(['group', 'groupName', 'Group', 'Group Name', 'Depot']),
      eventDateTime: getFieldValue(['event_datetime', 'eventDateTime', 'Event Date', 'Date/Time', 'Date']),
      trigger: getFieldValue(['trigger', 'Trigger', 'Event Type']),
      status: getFieldValue(['status', 'Status', 'Event Status']),
      behaviors: getFieldValue(['behaviors', 'Behaviors', 'Behaviour', 'Behavior']),
      score: getFieldValue(['score', 'Score', 'Risk Score']),
      deviceSerialNumber: getFieldValue(['device', 'deviceSerialNumber', 'Device', 'Device Serial']),
      employeeId: getFieldValue(['employeeId', 'employee_id', 'Employee ID']),
      timezone: getFieldValue(['timezone', 'Timezone']) || 'Australia/Perth'
    };
  }

  /**
   * Transform mapped event data to database record format
   * Uses the same logic as existing LYTX import tools
   */
  private static transformToDbRecord(eventData: any): LytxSafetyEventDB {
    const eventId = eventData.eventId || String(Date.now() + Math.random());
    const groupName = eventData.groupName || '';
    const driverName = eventData.driverName || 'Driver Unassigned';
    const vehicle = eventData.name || eventData.vehicle || null;
    const device = eventData.deviceSerialNumber || '';
    const eventDateTime = eventData.eventDateTime || new Date().toISOString();
    const status = (eventData.status || '').toString();
    const trigger = eventData.trigger || '';
    const behaviorsStr = eventData.behaviors || '';

    // Normalize status using same logic as existing imports
    const safeStatus = (() => {
      const s = status.toLowerCase();
      if (s.includes('face') || s.includes('coach')) return 'Face-To-Face';
      if (s.includes('fyi') || s.includes('notify')) return 'FYI Notify';  
      if (s.includes('resolved') || s.includes('closed')) return 'Resolved';
      return 'New';
    })() as 'New' | 'Face-To-Face' | 'FYI Notify' | 'Resolved';

    // Determine carrier using same logic as existing imports
    const safeCarrier = (() => {
      const g = groupName.toLowerCase();
      if (g.includes('stevemacs') || g.includes('smb') || g.includes('kewdale')) return 'Stevemacs';
      return 'Great Southern Fuels';
    })() as 'Stevemacs' | 'Great Southern Fuels';

    // Determine depot using same logic as existing imports
    const depot = (() => {
      const g = groupName.toLowerCase();
      if (g.includes('kewdale')) return 'Kewdale';
      if (g.includes('geraldton')) return 'Geraldton';
      if (g.includes('kalgoorlie')) return 'Kalgoorlie';
      if (g.includes('narrogin')) return 'Narrogin';
      if (g.includes('albany')) return 'Albany';
      if (g.includes('bunbury')) return 'Bunbury';
      if (g.includes('fremantle')) return 'Fremantle';
      return groupName || 'Unknown';
    })();

    // Determine event type
    const eventType = (() => {
      const t = (trigger || '').toLowerCase();
      return t.includes('tagged') ? 'Driver Tagged' : 'Coachable';
    })() as 'Coachable' | 'Driver Tagged';

    // Parse date safely
    const parsedDate = (() => {
      try {
        return new Date(eventDateTime).toISOString();
      } catch {
        return new Date().toISOString();
      }
    })();

    return {
      event_id: eventId,
      vehicle_registration: vehicle,
      device_serial: device,
      driver_name: driverName,
      employee_id: eventData.employeeId || null,
      group_name: groupName,
      depot,
      carrier: safeCarrier,
      event_datetime: parsedDate,
      timezone: eventData.timezone || 'Australia/Perth',
      score: Number(eventData.score || 0),
      status: safeStatus,
      trigger,
      behaviors: behaviorsStr,
      event_type: eventType,
      excluded: false,
      assigned_date: null,
      reviewed_by: null,
      notes: null,
      raw_data: eventData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Validate CSV headers to ensure compatibility
   */
  private static validateHeaders(headers: string[]): { isValid: boolean; missingFields: string[]; warnings: string[] } {
    const warnings: string[] = [];
    const missingFields: string[] = [];
    
    const hasEventId = headers.some(h => 
      ['event_id', 'eventId', 'id', 'Event ID'].some(expected => 
        h.toLowerCase().includes(expected.toLowerCase())
      )
    );
    
    if (!hasEventId) {
      missingFields.push('Event ID field');
    }

    const hasDateTime = headers.some(h => 
      ['event_datetime', 'eventDateTime', 'Date', 'date'].some(expected =>
        h.toLowerCase().includes(expected.toLowerCase())
      )
    );
    
    if (!hasDateTime) {
      warnings.push('No clear date/time field found - will use current timestamp');
    }

    return {
      isValid: missingFields.length === 0,
      missingFields,
      warnings
    };
  }

  /**
   * Process LYTX CSV file and return transformed records
   */
  static async processCsv(csvContent: string, userId: string): Promise<LytxCsvProcessingResult> {
    const result: LytxCsvProcessingResult = {
      success: false,
      records: [],
      metadata: {
        totalRows: 0,
        validRows: 0,
        skippedRows: 0,
        duplicateRows: 0,
        errors: [],
        warnings: []
      },
      preview: []
    };

    try {
      // Parse CSV content
      const { headers, rows } = this.parseCsv(csvContent);
      result.metadata.totalRows = rows.length;

      // Validate headers
      const headerValidation = this.validateHeaders(headers);
      if (!headerValidation.isValid) {
        result.metadata.errors.push(`Invalid CSV headers: Missing ${headerValidation.missingFields.join(', ')}`);
        return result;
      }
      result.metadata.warnings.push(...headerValidation.warnings);

      // Process rows
      const processedRecords: LytxSafetyEventDB[] = [];
      const seenEventIds = new Set<string>();
      let dateRange: { start: string; end: string } | undefined;
      let primaryCarrier: string | undefined;

      for (let i = 0; i < rows.length; i++) {
        try {
          const row = rows[i];
          const mappedEvent = this.mapCsvRowToEvent(row);
          
          // Skip rows without essential data
          if (!mappedEvent.eventId && !mappedEvent.driverName && !mappedEvent.eventDateTime) {
            result.metadata.skippedRows++;
            continue;
          }

          // Generate event ID if missing
          if (!mappedEvent.eventId) {
            mappedEvent.eventId = `csv_import_${Date.now()}_${i}`;
          }

          // Check for duplicates within CSV
          if (seenEventIds.has(mappedEvent.eventId)) {
            result.metadata.duplicateRows++;
            continue;
          }
          seenEventIds.add(mappedEvent.eventId);

          const dbRecord = this.transformToDbRecord(mappedEvent);
          processedRecords.push(dbRecord);
          result.metadata.validRows++;

          // Track date range
          if (dbRecord.event_datetime) {
            if (!dateRange) {
              dateRange = { start: dbRecord.event_datetime, end: dbRecord.event_datetime };
            } else {
              if (dbRecord.event_datetime < dateRange.start) dateRange.start = dbRecord.event_datetime;
              if (dbRecord.event_datetime > dateRange.end) dateRange.end = dbRecord.event_datetime;
            }
          }

          // Track primary carrier
          if (!primaryCarrier) {
            primaryCarrier = dbRecord.carrier;
          }

        } catch (error) {
          result.metadata.errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          result.metadata.skippedRows++;
        }
      }

      result.records = processedRecords;
      result.metadata.carrier = primaryCarrier as 'Stevemacs' | 'Great Southern Fuels' | undefined;
      result.metadata.dateRange = dateRange;
      result.preview = processedRecords.slice(0, 5); // First 5 records for preview
      result.success = processedRecords.length > 0;

      return result;

    } catch (error) {
      result.metadata.errors.push(`CSV processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Import processed records to database with duplicate checking
   */
  static async importToDatabase(records: LytxSafetyEventDB[], batchId: string): Promise<{
    imported: number;
    duplicates: number;
    failed: number;
    errors: string[];
  }> {
    const result = {
      imported: 0,
      duplicates: 0,
      failed: 0,
      errors: []
    };

    if (records.length === 0) {
      return result;
    }

    try {
      // Process in chunks to avoid payload limits
      const chunkSize = 500;
      
      for (let i = 0; i < records.length; i += chunkSize) {
        const batch = records.slice(i, i + chunkSize);
        
        try {
          const { error } = await supabase
            .from('lytx_safety_events')
            .upsert(batch, { 
              onConflict: 'event_id',
              ignoreDuplicates: false 
            });

          if (error) {
            // If batch fails, try individual inserts
            for (const record of batch) {
              try {
                const { error: individualError } = await supabase
                  .from('lytx_safety_events')
                  .upsert(record, { 
                    onConflict: 'event_id',
                    ignoreDuplicates: false 
                  });

                if (individualError) {
                  if (individualError.message.toLowerCase().includes('duplicate')) {
                    result.duplicates++;
                  } else {
                    result.failed++;
                    result.errors.push(`Event ${record.event_id}: ${individualError.message}`);
                  }
                } else {
                  result.imported++;
                }
              } catch (err) {
                result.failed++;
                result.errors.push(`Event ${record.event_id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
              }
            }
          } else {
            result.imported += batch.length;
          }
        } catch (batchError) {
          result.errors.push(`Batch error: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`);
          result.failed += batch.length;
        }
      }

      return result;

    } catch (error) {
      result.errors.push(`Database import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }
}