/**
 * VERCEL BLOB STORAGE UTILITIES
 * 
 * Handles file uploads, CSV processing, exports, and document storage
 * using Vercel's high-performance Blob storage infrastructure
 */

import { put, del, list, head, type PutBlobResult } from '@vercel/blob';
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';

// Blob storage configuration
export const BLOB_CONFIG = {
  // File size limits (in bytes)
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_CSV_SIZE: 500 * 1024 * 1024,  // 500MB for CSV files
  
  // Supported file types
  ALLOWED_CSV_TYPES: ['text/csv', 'application/csv', 'text/plain'],
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_DOC_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  
  // Storage paths
  PATHS: {
    CSV_UPLOADS: 'uploads/csv/',
    CSV_PROCESSED: 'processed/csv/',
    EXPORTS: 'exports/',
    REPORTS: 'reports/',
    DOCUMENTS: 'documents/',
    TEMP: 'temp/',
    BACKUPS: 'backups/'
  },
  
  // Retention periods (in days)
  RETENTION: {
    CSV_UPLOADS: 30,    // Keep uploaded CSV files for 30 days
    TEMP_FILES: 1,      // Clean up temp files daily
    EXPORTS: 7,         // Keep exports for 7 days
    REPORTS: 90,        // Keep reports for 90 days
    BACKUPS: 365        // Keep backups for 1 year
  }
} as const;

// File metadata interface
export interface FileMetadata {
  id: string;
  filename: string;
  size: number;
  contentType: string;
  uploadedBy: string;
  uploadedAt: string;
  path: string;
  tags?: string[];
  description?: string;
}

// CSV processing result interface
export interface CSVProcessingResult {
  success: boolean;
  fileId: string;
  originalUrl: string;
  processedUrl?: string;
  rowCount: number;
  columnCount: number;
  errors: string[];
  metadata: FileMetadata;
  previewData: any[];
}

/**
 * Upload a file to Vercel Blob storage
 */
export async function uploadFile(
  file: File | Buffer,
  path: string,
  filename: string,
  options: {
    contentType?: string;
    userId?: string;
    tags?: string[];
    description?: string;
    overwrite?: boolean;
  } = {}
): Promise<{ url: string; metadata: FileMetadata }> {
  try {
    // Validate file size
    const fileSize = file instanceof File ? file.size : file.length;
    if (fileSize > BLOB_CONFIG.MAX_FILE_SIZE) {
      throw new Error(`File size ${fileSize} exceeds maximum allowed size of ${BLOB_CONFIG.MAX_FILE_SIZE} bytes`);
    }

    // Generate unique filename if needed
    const fileId = uuidv4();
    const finalPath = `${path}${fileId}_${filename}`;
    
    // Upload to Vercel Blob
    const result: PutBlobResult = await put(finalPath, file, {
      access: 'public',
      contentType: options.contentType || (file instanceof File ? file.type : 'application/octet-stream')
    });

    // Create metadata
    const metadata: FileMetadata = {
      id: fileId,
      filename,
      size: fileSize,
      contentType: options.contentType || (file instanceof File ? file.type : 'application/octet-stream'),
      uploadedBy: options.userId || 'unknown',
      uploadedAt: new Date().toISOString(),
      path: finalPath,
      tags: options.tags,
      description: options.description
    };

    return {
      url: result.url,
      metadata
    };
  } catch (error) {
    console.error('[BLOB] Upload failed:', error);
    throw new Error(`File upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload CSV file for processing
 */
export async function uploadCSVFile(
  file: File,
  userId: string,
  options: {
    description?: string;
    tags?: string[];
  } = {}
): Promise<CSVProcessingResult> {
  // Validate CSV file
  if (!BLOB_CONFIG.ALLOWED_CSV_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.csv')) {
    throw new Error('Invalid file type. Only CSV files are allowed.');
  }

  if (file.size > BLOB_CONFIG.MAX_CSV_SIZE) {
    throw new Error(`CSV file size ${file.size} exceeds maximum allowed size of ${BLOB_CONFIG.MAX_CSV_SIZE} bytes`);
  }

  const result: CSVProcessingResult = {
    success: false,
    fileId: '',
    originalUrl: '',
    rowCount: 0,
    columnCount: 0,
    errors: [],
    metadata: {} as FileMetadata,
    previewData: []
  };

  try {
    // Upload original CSV file
    const upload = await uploadFile(
      file,
      BLOB_CONFIG.PATHS.CSV_UPLOADS,
      file.name,
      {
        contentType: 'text/csv',
        userId,
        tags: ['csv', 'upload', ...(options.tags || [])],
        description: options.description
      }
    );

    result.fileId = upload.metadata.id;
    result.originalUrl = upload.url;
    result.metadata = upload.metadata;

    // Parse CSV for validation and preview
    const text = await file.text();
    const parseResult = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      preview: 10 // Get first 10 rows for preview
    });

    if (parseResult.errors.length > 0) {
      result.errors = parseResult.errors.map(error => `Row ${error.row}: ${error.message}`);
    }

    if (parseResult.data.length > 0) {
      result.previewData = parseResult.data;
      result.rowCount = parseResult.data.length;
      result.columnCount = Object.keys(parseResult.data[0]).length;
    }

    result.success = result.errors.length === 0;

    return result;
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error occurred');
    console.error('[BLOB] CSV upload failed:', error);
    return result;
  }
}

/**
 * Generate and upload export file
 */
export async function generateExport(
  data: any[],
  format: 'csv' | 'json' | 'excel',
  filename: string,
  userId: string,
  options: {
    metadata?: Record<string, any>;
    description?: string;
  } = {}
): Promise<{ url: string; metadata: FileMetadata }> {
  try {
    let fileContent: string | Buffer;
    let contentType: string;
    let finalFilename: string;

    switch (format) {
      case 'csv':
        fileContent = Papa.unparse(data);
        contentType = 'text/csv';
        finalFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
        break;
      case 'json':
        fileContent = JSON.stringify(data, null, 2);
        contentType = 'application/json';
        finalFilename = filename.endsWith('.json') ? filename : `${filename}.json`;
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    return await uploadFile(
      Buffer.from(fileContent),
      BLOB_CONFIG.PATHS.EXPORTS,
      finalFilename,
      {
        contentType,
        userId,
        tags: ['export', format],
        description: options.description
      }
    );
  } catch (error) {
    console.error('[BLOB] Export generation failed:', error);
    throw new Error(`Export generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload report file
 */
export async function uploadReport(
  content: string | Buffer,
  filename: string,
  contentType: string,
  userId: string,
  options: {
    tags?: string[];
    description?: string;
    reportType?: string;
  } = {}
): Promise<{ url: string; metadata: FileMetadata }> {
  return await uploadFile(
    typeof content === 'string' ? Buffer.from(content) : content,
    BLOB_CONFIG.PATHS.REPORTS,
    filename,
    {
      contentType,
      userId,
      tags: ['report', ...(options.tags || [])],
      description: options.description
    }
  );
}

/**
 * List files in a specific path
 */
export async function listFiles(
  path?: string,
  options: {
    limit?: number;
    cursor?: string;
  } = {}
): Promise<{
  blobs: Array<{
    url: string;
    pathname: string;
    size: number;
    uploadedAt: Date;
  }>;
  hasMore: boolean;
  cursor?: string;
}> {
  try {
    const result = await list({
      prefix: path,
      limit: options.limit || 1000,
      cursor: options.cursor
    });

    return result;
  } catch (error) {
    console.error('[BLOB] List files failed:', error);
    throw new Error(`Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete a file from blob storage
 */
export async function deleteFile(url: string): Promise<void> {
  try {
    await del(url);
    console.log(`[BLOB] File deleted: ${url}`);
  } catch (error) {
    console.error('[BLOB] Delete failed:', error);
    throw new Error(`File deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get file metadata
 */
export async function getFileInfo(url: string): Promise<{
  url: string;
  size: number;
  uploadedAt: Date;
  contentType?: string;
}> {
  try {
    const info = await head(url);
    return info;
  } catch (error) {
    console.error('[BLOB] Get file info failed:', error);
    throw new Error(`Failed to get file info: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Clean up old files based on retention policies
 */
export async function cleanupOldFiles(): Promise<{
  deleted: number;
  errors: string[];
}> {
  const results = {
    deleted: 0,
    errors: []
  };

  try {
    // Clean up temp files (older than 1 day)
    await cleanupPath(BLOB_CONFIG.PATHS.TEMP, BLOB_CONFIG.RETENTION.TEMP_FILES, results);
    
    // Clean up old CSV uploads (older than 30 days)
    await cleanupPath(BLOB_CONFIG.PATHS.CSV_UPLOADS, BLOB_CONFIG.RETENTION.CSV_UPLOADS, results);
    
    // Clean up old exports (older than 7 days)
    await cleanupPath(BLOB_CONFIG.PATHS.EXPORTS, BLOB_CONFIG.RETENTION.EXPORTS, results);

    return results;
  } catch (error) {
    results.errors.push(error instanceof Error ? error.message : 'Unknown cleanup error');
    return results;
  }
}

/**
 * Helper function to clean up files in a specific path
 */
async function cleanupPath(
  path: string, 
  retentionDays: number, 
  results: { deleted: number; errors: string[] }
): Promise<void> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const files = await listFiles(path);
    
    for (const file of files.blobs) {
      if (file.uploadedAt < cutoffDate) {
        try {
          await deleteFile(file.url);
          results.deleted++;
        } catch (error) {
          results.errors.push(`Failed to delete ${file.pathname}: ${error}`);
        }
      }
    }
  } catch (error) {
    results.errors.push(`Failed to cleanup path ${path}: ${error}`);
  }
}

/**
 * Create backup of important data
 */
export async function createBackup(
  data: any,
  backupName: string,
  userId: string
): Promise<{ url: string; metadata: FileMetadata }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${backupName}_${timestamp}.json`;
  
  return await uploadFile(
    Buffer.from(JSON.stringify(data, null, 2)),
    BLOB_CONFIG.PATHS.BACKUPS,
    filename,
    {
      contentType: 'application/json',
      userId,
      tags: ['backup', 'system'],
      description: `System backup created on ${new Date().toISOString()}`
    }
  );
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
  totalFiles: number;
  totalSize: number;
  filesByPath: Record<string, number>;
  oldestFile?: Date;
  newestFile?: Date;
}> {
  try {
    const allFiles = await listFiles();
    
    const stats = {
      totalFiles: allFiles.blobs.length,
      totalSize: allFiles.blobs.reduce((sum, file) => sum + file.size, 0),
      filesByPath: {} as Record<string, number>,
      oldestFile: undefined as Date | undefined,
      newestFile: undefined as Date | undefined
    };

    // Group by path and find date range
    for (const file of allFiles.blobs) {
      const pathParts = file.pathname.split('/');
      const basePath = pathParts.length > 1 ? pathParts[0] + '/' : 'root';
      
      stats.filesByPath[basePath] = (stats.filesByPath[basePath] || 0) + 1;
      
      if (!stats.oldestFile || file.uploadedAt < stats.oldestFile) {
        stats.oldestFile = file.uploadedAt;
      }
      
      if (!stats.newestFile || file.uploadedAt > stats.newestFile) {
        stats.newestFile = file.uploadedAt;
      }
    }

    return stats;
  } catch (error) {
    console.error('[BLOB] Get storage stats failed:', error);
    throw new Error(`Failed to get storage statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}