import { CaptivePaymentsSupabaseService } from './captivePaymentsSupabaseService';
import { LytxSupabaseService } from './lytxSupabaseService';
import { GuardianSupabaseService } from './guardianSupabaseService';
import { supabase } from '../lib/supabase';

interface MigrationStatus {
  source: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  recordsProcessed: number;
  recordsFailed: number;
  errors: string[];
  startedAt?: Date;
  completedAt?: Date;
}

interface MigrationResult {
  overallStatus: 'completed' | 'partial' | 'failed';
  sources: MigrationStatus[];
  totalRecordsProcessed: number;
  totalRecordsFailed: number;
  duration: number; // milliseconds
}

export class DataMigrationService {
  private captiveService: CaptivePaymentsSupabaseService;
  private lytxService: LytxSupabaseService;
  private guardianService: GuardianSupabaseService;

  constructor() {
    this.captiveService = new CaptivePaymentsSupabaseService();
    this.lytxService = new LytxSupabaseService();
    this.guardianService = new GuardianSupabaseService();
  }

  /**
   * Migrate all historical data to Supabase
   * This function coordinates the migration of captive payments, LYTX events, and Guardian events
   */
  async migrateAllHistoricalData(): Promise<MigrationResult> {
    const startTime = Date.now();
    
    const sources: MigrationStatus[] = [
      { source: 'captive_payments_smb', status: 'pending', recordsProcessed: 0, recordsFailed: 0, errors: [] },
      { source: 'captive_payments_gsf', status: 'pending', recordsProcessed: 0, recordsFailed: 0, errors: [] },
      { source: 'lytx_events', status: 'pending', recordsProcessed: 0, recordsFailed: 0, errors: [] },
      { source: 'guardian_events', status: 'pending', recordsProcessed: 0, recordsFailed: 0, errors: [] }
    ];

    // Migrate Captive Payments - SMB
    sources[0] = await this.migrateCaptivePaymentsSMB();
    
    // Migrate Captive Payments - GSF
    sources[1] = await this.migrateCaptivePaymentsGSF();
    
    // Migrate LYTX Events
    sources[2] = await this.migrateLytxEvents();
    
    // Migrate Guardian Events
    sources[3] = await this.migrateGuardianEvents();

    const endTime = Date.now();
    const duration = endTime - startTime;

    const totalRecordsProcessed = sources.reduce((sum, s) => sum + s.recordsProcessed, 0);
    const totalRecordsFailed = sources.reduce((sum, s) => sum + s.recordsFailed, 0);
    
    const overallStatus = this.determineOverallStatus(sources);

    return {
      overallStatus,
      sources,
      totalRecordsProcessed,
      totalRecordsFailed,
      duration
    };
  }

  /**
   * Migrate SMB Captive Payments data
   */
  private async migrateCaptivePaymentsSMB(): Promise<MigrationStatus> {
    const status: MigrationStatus = {
      source: 'captive_payments_smb',
      status: 'in_progress',
      recordsProcessed: 0,
      recordsFailed: 0,
      errors: [],
      startedAt: new Date()
    };

    try {
      // Read SMB CSV file
      const csvData = await this.readCsvFile('Captive Payments - SMB - Jun \'25(YYOITRM06_Q_R0001_WEEKLY_00000).csv');
      
      if (!csvData) {
        status.status = 'failed';
        status.errors.push('SMB CSV file not found or empty');
        return status;
      }

      const result = await this.captiveService.processCsvToSupabase(
        csvData, 
        'SMB', 
        'Historical SMB Captive Payments Migration'
      );

      status.recordsProcessed = result.recordsProcessed;
      status.recordsFailed = result.recordsFailed;
      status.errors = result.errors;
      status.status = result.recordsFailed > 0 ? 'partial' : 'completed';
      status.completedAt = new Date();

    } catch (error) {
      status.status = 'failed';
      status.errors.push(error instanceof Error ? error.message : 'Unknown error');
      status.completedAt = new Date();
    }

    return status;
  }

  /**
   * Migrate GSF Captive Payments data
   */
  private async migrateCaptivePaymentsGSF(): Promise<MigrationStatus> {
    const status: MigrationStatus = {
      source: 'captive_payments_gsf',
      status: 'in_progress',
      recordsProcessed: 0,
      recordsFailed: 0,
      errors: [],
      startedAt: new Date()
    };

    try {
      // Read GSF CSV file
      const csvData = await this.readCsvFile('Captive Payments - GSFS - Jun \'25(YYOITRM06_Q_R0001_WEEKLY_00000).csv');
      
      if (!csvData) {
        status.status = 'failed';
        status.errors.push('GSF CSV file not found or empty');
        return status;
      }

      const result = await this.captiveService.processCsvToSupabase(
        csvData, 
        'GSF', 
        'Historical GSF Captive Payments Migration'
      );

      status.recordsProcessed = result.recordsProcessed;
      status.recordsFailed = result.recordsFailed;
      status.errors = result.errors;
      status.status = result.recordsFailed > 0 ? 'partial' : 'completed';
      status.completedAt = new Date();

    } catch (error) {
      status.status = 'failed';
      status.errors.push(error instanceof Error ? error.message : 'Unknown error');
      status.completedAt = new Date();
    }

    return status;
  }

  /**
   * Migrate LYTX Events data
   */
  private async migrateLytxEvents(): Promise<MigrationStatus> {
    const status: MigrationStatus = {
      source: 'lytx_events',
      status: 'in_progress',
      recordsProcessed: 0,
      recordsFailed: 0,
      errors: [],
      startedAt: new Date()
    };

    try {
      // Try to sync from API first (more recent data)
      try {
        const apiResult = await this.lytxService.syncEventsFromApi(365); // Last year
        status.recordsProcessed += apiResult.eventsProcessed;
        status.recordsFailed += apiResult.eventsFailed;
        status.errors.push(...apiResult.errors);
      } catch (apiError) {
        status.errors.push(`API sync failed: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
      }

      // Also process CSV data if available
      const csvData = await this.readCsvFile('Event Data 2024-08-04_2025-08-03.csv');
      
      if (csvData) {
        const csvResult = await this.lytxService.processCsvEventsToSupabase(
          csvData,
          'Historical LYTX Events Migration'
        );

        status.recordsProcessed += csvResult.eventsProcessed;
        status.recordsFailed += csvResult.eventsFailed;
        status.errors.push(...csvResult.errors);
      } else {
        status.errors.push('LYTX CSV file not found');
      }

      status.status = status.recordsFailed > 0 ? 'partial' : 'completed';
      status.completedAt = new Date();

    } catch (error) {
      status.status = 'failed';
      status.errors.push(error instanceof Error ? error.message : 'Unknown error');
      status.completedAt = new Date();
    }

    return status;
  }

  /**
   * Migrate Guardian Events data
   */
  private async migrateGuardianEvents(): Promise<MigrationStatus> {
    const status: MigrationStatus = {
      source: 'guardian_events',
      status: 'in_progress',
      recordsProcessed: 0,
      recordsFailed: 0,
      errors: [],
      startedAt: new Date()
    };

    try {
      // Check if Guardian CSV data is available
      // Note: Guardian data might come from different sources or APIs
      // For now, we'll simulate processing existing vehicle_events data
      
      const { data: existingEvents, error } = await supabase
        .from('vehicle_events')
        .select('*')
        .eq('source', 'Guardian')
        .limit(1000);

      if (error) {
        status.errors.push(`Failed to fetch existing Guardian events: ${error.message}`);
        status.status = 'failed';
        return status;
      }

      if (existingEvents && existingEvents.length > 0) {
        // Convert existing vehicle_events to Guardian events format
        const guardianEvents = existingEvents.map(event => ({
          vehicleRegistration: event.vehicle_id, // This would need proper vehicle lookup
          eventType: event.event_type,
          occurredAt: event.occurred_at,
          location: event.location || undefined,
          latitude: event.latitude || undefined,
          longitude: event.longitude || undefined,
          driverName: event.driver_name || undefined,
          duration: event.duration || undefined,
          speed: event.speed || undefined,
          severity: (event.severity as 'Low' | 'Medium' | 'High' | 'Critical') || 'Medium',
          verified: event.verified,
          fleet: 'Stevemacs' as const, // Would need proper fleet determination
          rawData: event.metadata
        }));

        const result = await this.guardianService.processApiEventsToSupabase(guardianEvents);
        
        status.recordsProcessed = result.eventsProcessed;
        status.recordsFailed = result.eventsFailed;
        status.errors = result.errors;
      }

      status.status = status.recordsFailed > 0 ? 'partial' : 'completed';
      status.completedAt = new Date();

    } catch (error) {
      status.status = 'failed';
      status.errors.push(error instanceof Error ? error.message : 'Unknown error');
      status.completedAt = new Date();
    }

    return status;
  }

  /**
   * Read CSV file from the file system
   * This is a placeholder - in a real implementation, you'd read from actual files
   */
  private async readCsvFile(fileName: string): Promise<string | null> {
    try {
      // In a real implementation, you would read the actual CSV file
      // For now, we'll return null to indicate file not available
      console.log(`Attempting to read CSV file: ${fileName}`);
      
      // This would be something like:
      // const fs = require('fs').promises;
      // const data = await fs.readFile(filePath, 'utf8');
      // return data;
      
      return null; // Placeholder
    } catch (error) {
      console.error(`Error reading CSV file ${fileName}:`, error);
      return null;
    }
  }

  /**
   * Determine overall migration status
   */
  private determineOverallStatus(sources: MigrationStatus[]): 'completed' | 'partial' | 'failed' {
    const completedSources = sources.filter(s => s.status === 'completed').length;
    const failedSources = sources.filter(s => s.status === 'failed').length;
    
    if (completedSources === sources.length) {
      return 'completed';
    } else if (failedSources === sources.length) {
      return 'failed';
    } else {
      return 'partial';
    }
  }

  /**
   * Get migration status for all data sources
   */
  async getMigrationStatus(): Promise<{
    lastMigration?: Date;
    batches: Array<{
      source_type: string;
      source_subtype: string | null;
      status: string;
      records_processed: number;
      records_failed: number;
      started_at: string;
      completed_at: string | null;
    }>;
  }> {
    const { data: batches, error } = await supabase
      .from('data_import_batches')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching migration status:', error);
      return { batches: [] };
    }

    const lastMigration = batches?.[0]?.completed_at 
      ? new Date(batches[0].completed_at) 
      : undefined;

    return {
      lastMigration,
      batches: batches || []
    };
  }

  /**
   * Clean up failed or partial migrations
   */
  async cleanupFailedMigrations(): Promise<{
    batchesDeleted: number;
    recordsDeleted: number;
  }> {
    const result = {
      batchesDeleted: 0,
      recordsDeleted: 0
    };

    try {
      // Get failed batches
      const { data: failedBatches, error: batchError } = await supabase
        .from('data_import_batches')
        .select('*')
        .in('status', ['failed', 'partial'])
        .lt('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Older than 24 hours

      if (batchError || !failedBatches) {
        console.error('Error fetching failed batches:', batchError);
        return result;
      }

      // Delete associated data and batches
      for (const batch of failedBatches) {
        // This would involve deleting associated records based on batch reference
        // For now, we'll just delete the batch record
        
        const { error: deleteError } = await supabase
          .from('data_import_batches')
          .delete()
          .eq('id', batch.id);

        if (!deleteError) {
          result.batchesDeleted++;
        }
      }

    } catch (error) {
      console.error('Error cleaning up failed migrations:', error);
    }

    return result;
  }
}