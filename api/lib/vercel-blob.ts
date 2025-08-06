/**
 * SERVER-SIDE VERCEL BLOB STORAGE UTILITIES
 * 
 * Handles file uploads, CSV processing, exports, and document storage
 * for serverless API functions
 */

import { put, del, list, head, type PutBlobResult } from '@vercel/blob';
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
  uploadedAt: Date;
  description?: string;
  tags?: string[];
  expiresAt?: Date;
}

/**
 * Upload a CSV file to Blob storage
 */
export async function uploadCSVFile(
  file: File | Buffer, 
  userId: string,
  options: {
    filename?: string;
    description?: string;
    tags?: string[];
  } = {}
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const fileId = uuidv4();
    const filename = options.filename || `upload-${fileId}.csv`;
    const path = `${BLOB_CONFIG.PATHS.CSV_UPLOADS}${userId}/${filename}`;
    
    const result = await put(path, file, {
      access: 'public',
      addRandomSuffix: false
    });

    const metadata: FileMetadata = {
      id: fileId,
      filename,
      size: file instanceof File ? file.size : file.length,
      contentType: 'text/csv',
      uploadedBy: userId,
      uploadedAt: new Date(),
      description: options.description,
      tags: options.tags
    };

    return {
      success: true,
      data: {
        fileId,
        url: result.url,
        path,
        metadata
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
}

/**
 * Create a backup of processed data
 */
export async function createBackup(
  data: any,
  backupType: string,
  userId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const backupId = uuidv4();
    const filename = `backup-${backupType}-${Date.now()}.json`;
    const path = `${BLOB_CONFIG.PATHS.BACKUPS}${userId}/${filename}`;
    
    const result = await put(path, JSON.stringify(data, null, 2), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json'
    });

    return {
      success: true,
      url: result.url
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Backup failed'
    };
  }
}

/**
 * Generate export file
 */
export async function generateExport(
  data: any[],
  format: 'csv' | 'json',
  exportType: string,
  userId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const exportId = uuidv4();
    const filename = `export-${exportType}-${Date.now()}.${format}`;
    const path = `${BLOB_CONFIG.PATHS.EXPORTS}${userId}/${filename}`;
    
    let content: string;
    let contentType: string;
    
    if (format === 'json') {
      content = JSON.stringify(data, null, 2);
      contentType = 'application/json';
    } else {
      // Simple CSV generation for server-side
      const headers = data.length > 0 ? Object.keys(data[0]).join(',') : '';
      const rows = data.map(row => 
        Object.values(row).map(val => 
          typeof val === 'string' && val.includes(',') ? `"${val}"` : val
        ).join(',')
      );
      content = [headers, ...rows].join('\n');
      contentType = 'text/csv';
    }
    
    const result = await put(path, content, {
      access: 'public',
      addRandomSuffix: false,
      contentType
    });

    return {
      success: true,
      url: result.url
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Export failed'
    };
  }
}

/**
 * Clean up expired files
 */
export async function cleanupExpiredFiles(): Promise<void> {
  try {
    const { blobs } = await list();
    const now = Date.now();
    
    for (const blob of blobs) {
      // Check if file is expired based on path and retention policy
      if (blob.pathname.startsWith(BLOB_CONFIG.PATHS.TEMP)) {
        const ageInDays = (now - blob.uploadedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (ageInDays > BLOB_CONFIG.RETENTION.TEMP_FILES) {
          await del(blob.url);
        }
      }
    }
  } catch (error) {
    console.error('Cleanup failed:', error);
  }
}