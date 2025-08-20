import { supabase } from '@/lib/supabase';
import { updateDataAvailability } from '@/api/dataFreshness';

/**
 * Helper functions to integrate data freshness tracking with upload processes
 */

export interface UploadCompletionInfo {
  sourceKey: string;
  recordCount: number;
  uploadDate?: string; // ISO date string, defaults to today
  userId?: string;
  filename?: string;
  uploadSessionId?: string;
}

/**
 * Call this function after successfully uploading data to update freshness tracking
 */
export async function notifyDataUploadComplete(info: UploadCompletionInfo): Promise<void> {
  try {
    const uploadDate = info.uploadDate || new Date().toISOString().split('T')[0];
    
    await updateDataAvailability(
      info.sourceKey,
      uploadDate,
      info.recordCount,
      {
        user_id: info.userId,
        filename: info.filename,
        upload_session_id: info.uploadSessionId
      }
    );

    // Also trigger a freshness refresh for this source
    await refreshSourceFreshness(info.sourceKey);
    
  } catch (error) {
    console.error('Failed to update data freshness:', error);
    // Don't throw - this shouldn't block the main upload process
  }
}

/**
 * Refresh freshness data for a specific source
 */
export async function refreshSourceFreshness(sourceKey: string): Promise<void> {
  try {
    await supabase.rpc('refresh_source_freshness', { source_key_param: sourceKey });
  } catch (error) {
    console.error(`Failed to refresh freshness for source ${sourceKey}:`, error);
  }
}

/**
 * Bulk update data availability for multiple dates/sources
 */
export async function notifyBulkDataUploadComplete(uploads: UploadCompletionInfo[]): Promise<void> {
  try {
    // Process uploads in batches to avoid overwhelming the database
    const batchSize = 10;
    
    for (let i = 0; i < uploads.length; i += batchSize) {
      const batch = uploads.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(upload => notifyDataUploadComplete(upload))
      );
    }
  } catch (error) {
    console.error('Failed to process bulk upload notifications:', error);
  }
}

/**
 * Update data availability using the database function for better performance
 */
export async function updateDataAvailabilityBatch(
  sourceKey: string,
  dataDate: string,
  recordCount: number,
  userId?: string,
  filename?: string
): Promise<void> {
  try {
    await supabase.rpc('update_data_availability_batch', {
      source_key_param: sourceKey,
      data_date_param: dataDate,
      record_count_param: recordCount,
      user_id_param: userId || null,
      filename_param: filename || null
    });
  } catch (error) {
    console.error('Failed to update data availability batch:', error);
    throw error;
  }
}

/**
 * Helper to extract data dates from uploaded records
 */
export function extractDataDatesFromRecords(
  records: Record<string, unknown>[],
  dateField: string = 'created_at'
): string[] {
  const dates = new Set<string>();
  
  records.forEach(record => {
    if (record[dateField]) {
      try {
        const date = new Date(record[dateField]);
        if (!isNaN(date.getTime())) {
          dates.add(date.toISOString().split('T')[0]);
        }
      } catch {
        // Skip invalid dates
      }
    }
  });
  
  return Array.from(dates);
}

/**
 * Integration hook for CSV upload completion
 * Call this from your CSV upload success handlers
 */
export async function onCsvUploadComplete(
  sourceKey: string,
  uploadedRecords: Record<string, unknown>[],
  uploadInfo: {
    userId?: string;
    filename?: string;
    uploadSessionId?: string;
    dataDateField?: string;
  } = {}
): Promise<void> {
  try {
    const { dataDateField = 'created_at' } = uploadInfo;
    
    // Extract unique dates from the uploaded records
    const dateCounts = new Map<string, number>();
    
    uploadedRecords.forEach(record => {
      if (record[dataDateField]) {
        try {
          const date = new Date(record[dataDateField]);
          if (!isNaN(date.getTime())) {
            const dateStr = date.toISOString().split('T')[0];
            dateCounts.set(dateStr, (dateCounts.get(dateStr) || 0) + 1);
          }
        } catch {
          // Skip invalid dates, count as today
          const today = new Date().toISOString().split('T')[0];
          dateCounts.set(today, (dateCounts.get(today) || 0) + 1);
        }
      }
    });

    // If no valid dates found, count everything as today
    if (dateCounts.size === 0) {
      const today = new Date().toISOString().split('T')[0];
      dateCounts.set(today, uploadedRecords.length);
    }

    // Update availability for each date
    const updatePromises = Array.from(dateCounts.entries()).map(([date, count]) =>
      updateDataAvailabilityBatch(
        sourceKey,
        date,
        count,
        uploadInfo.userId,
        uploadInfo.filename
      )
    );

    await Promise.all(updatePromises);
    
  } catch (error) {
    console.error('Failed to process CSV upload completion:', error);
    // Don't throw - this shouldn't block the upload process
  }
}

/**
 * Integration hook for API sync completion
 * Call this from your API sync success handlers
 */
export async function onApiSyncComplete(
  sourceKey: string,
  syncedRecordCount: number,
  syncInfo: {
    syncDate?: string;
    userId?: string;
  } = {}
): Promise<void> {
  try {
    const syncDate = syncInfo.syncDate || new Date().toISOString().split('T')[0];
    
    await updateDataAvailabilityBatch(
      sourceKey,
      syncDate,
      syncedRecordCount,
      syncInfo.userId,
      `API Sync - ${new Date().toISOString()}`
    );
    
  } catch (error) {
    console.error('Failed to process API sync completion:', error);
  }
}

/**
 * Get the appropriate source key for different data types
 */
export function getSourceKeyForDataType(dataType: string): string {
  const mappings: Record<string, string> = {
    'guardian_events': 'guardian_events',
    'guardian': 'guardian_events',
    'captive_payments': 'captive_payments',
    'captive': 'captive_payments',
    'lytx_safety': 'lytx_safety',
    'lytx': 'lytx_safety',
    'mtdata_trips': 'mtdata_trips',
    'mtdata': 'mtdata_trips',
    'driver_profiles': 'driver_profiles',
    'drivers': 'driver_profiles',
    'csv_upload': 'data_import',
    'data_import': 'data_import',
    'upload': 'data_import'
  };

  return mappings[dataType.toLowerCase()] || dataType;
}

/**
 * Wrapper function to safely execute freshness updates
 * This ensures that freshness update failures don't break the main application flow
 */
export async function safelyUpdateFreshness(
  operation: () => Promise<void>,
  errorContext: string = 'data freshness update'
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    console.warn(`${errorContext} failed, but continuing:`, error);
    
    // Optionally, you could send this to a monitoring service
    // reportError(error, { context: errorContext });
  }
}

/**
 * Example usage in upload handlers:
 * 
 * // In your CSV upload success handler:
 * await safelyUpdateFreshness(async () => {
 *   await onCsvUploadComplete('guardian_events', uploadedRecords, {
 *     userId: currentUser.id,
 *     filename: file.name,
 *     uploadSessionId: sessionId,
 *     dataDateField: 'detection_time'
 *   });
 * }, 'Guardian events upload');
 * 
 * // In your API sync handler:
 * await safelyUpdateFreshness(async () => {
 *   await onApiSyncComplete('lytx_safety', syncedCount, {
 *     syncDate: syncDate,
 *     userId: systemUserId
 *   });
 * }, 'LYTX safety sync');
 */