/**
 * LYTX CSV IMPORT API ENDPOINT
 * 
 * Handles LYTX safety events CSV file uploads and processing
 * Integrates with existing LYTX infrastructure and database schema
 */

import { supabase } from './lib/supabase';
import { LytxCsvProcessor } from '../src/services/lytxCsvProcessor';

// Configuration
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ['text/csv', 'application/csv', 'text/plain'];

interface ImportRequest {
  action: 'upload' | 'process' | 'preview';
  userId: string;
  fileContent?: string;
  fileName?: string;
  processingOptions?: {
    skipValidation?: boolean;
    batchSize?: number;
  };
}

export default async function handler(req, res) {
  // Set CORS headers for client-side uploads
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    try {
      const contentType = req.headers['content-type'] || '';
      
      if (contentType.includes('multipart/form-data')) {
        // Handle multipart file upload
        return await handleFileUpload(req, res);
      } else {
        // Handle JSON request (process or preview)
        return await handleProcessingRequest(req, res);
      }
    } catch (error) {
      console.error('[LYTX CSV API] Request failed:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }

  if (req.method === 'GET') {
    return res.json({
      success: true,
      service: 'LYTX CSV Import API',
      timestamp: new Date().toISOString(),
      limits: {
        maxFileSize: MAX_FILE_SIZE,
        allowedTypes: ALLOWED_TYPES
      }
    });
  }

  return res.status(405).json({
    success: false,
    error: 'Method not allowed'
  });
}

/**
 * Handle multipart file upload
 */
async function handleFileUpload(req, res) {
  try {
    // Parse multipart form data
    const formData = await parseMultipartData(req);
    const file = formData.file;
    const userId = formData.userId;
    const fileName = formData.fileName || file?.name || 'lytx-events.csv';

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    // Validate file
    const fileBuffer = Buffer.isBuffer(file) ? file : Buffer.from(file);
    const fileSize = fileBuffer.length;

    if (fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({
        success: false,
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
      });
    }

    if (!fileName.toLowerCase().endsWith('.csv')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type. Only CSV files are allowed.'
      });
    }

    // Convert buffer to string
    const csvContent = fileBuffer.toString('utf-8');

    // Process CSV immediately for preview
    const processingResult = await LytxCsvProcessor.processCsv(csvContent, userId);

    if (!processingResult.success) {
      return res.status(400).json({
        success: false,
        error: 'CSV processing failed',
        details: processingResult.metadata.errors
      });
    }

    // Create import batch record
    const { data: batch, error: batchError } = await supabase
      .from('data_import_batches')
      .insert({
        source_type: 'lytx_events',
        source_subtype: 'CSV_UPLOAD',
        file_name: fileName,
        batch_reference: `lytx_csv_${Date.now()}`,
        status: 'pending',
        records_processed: 0,
        records_failed: 0,
        processing_metadata: {
          fileName,
          fileSize,
          totalRows: processingResult.metadata.totalRows,
          validRows: processingResult.metadata.validRows,
          skippedRows: processingResult.metadata.skippedRows,
          carrier: processingResult.metadata.carrier,
          dateRange: processingResult.metadata.dateRange,
          uploadedAt: new Date().toISOString()
        },
        created_by: userId
      })
      .select()
      .single();

    if (batchError || !batch) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create import batch record'
      });
    }

    return res.json({
      success: true,
      data: {
        batchId: batch.id,
        batchReference: batch.batch_reference,
        fileName,
        fileSize,
        rowCount: processingResult.metadata.totalRows,
        validRows: processingResult.metadata.validRows,
        skippedRows: processingResult.metadata.skippedRows,
        duplicateRows: processingResult.metadata.duplicateRows,
        previewData: processingResult.preview,
        carrier: processingResult.metadata.carrier,
        dateRange: processingResult.metadata.dateRange,
        processingStatus: 'ready_for_import',
        warnings: processingResult.metadata.warnings,
        errors: processingResult.metadata.errors,
        // Store processed records for import
        recordsData: Buffer.from(JSON.stringify(processingResult.records)).toString('base64')
      }
    });

  } catch (error) {
    console.error('[LYTX CSV API] Upload failed:', error);
    return res.status(500).json({
      success: false,
      error: 'File upload failed'
    });
  }
}

/**
 * Handle processing requests (import to database)
 */
async function handleProcessingRequest(req, res) {
  try {
    const body: ImportRequest = req.body;
    const { action, userId, processingOptions = {} } = body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    switch (action) {
      case 'process':
        return await handleImport(req, res, body);
      case 'preview':
        return await handlePreview(req, res, body);
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid action'
        });
    }

  } catch (error) {
    console.error('[LYTX CSV API] Processing request failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Processing request failed'
    });
  }
}

/**
 * Handle CSV import to database
 */
async function handleImport(req, res, body: ImportRequest) {
  const { userId } = body;
  const { batchId, recordsData } = req.body;

  if (!batchId || !recordsData) {
    return res.status(400).json({
      success: false,
      error: 'Batch ID and records data are required'
    });
  }

  try {
    // Update batch status to processing
    await supabase
      .from('data_import_batches')
      .update({ 
        status: 'processing',
        processing_metadata: {
          processingStarted: new Date().toISOString()
        }
      })
      .eq('id', batchId);

    // Decode and parse records
    const recordsJson = Buffer.from(recordsData, 'base64').toString('utf-8');
    const records = JSON.parse(recordsJson);

    if (!Array.isArray(records)) {
      throw new Error('Invalid records data format');
    }

    // Import records to database
    const importResult = await LytxCsvProcessor.importToDatabase(records, batchId);

    // Update batch with results
    const batchUpdate = {
      status: importResult.failed === 0 ? 'completed' : 'partial',
      records_processed: importResult.imported,
      records_failed: importResult.failed,
      error_summary: importResult.errors.length > 0 ? 
        { errors: importResult.errors, duplicates: importResult.duplicates } : null,
      processing_metadata: {
        processingCompleted: new Date().toISOString(),
        imported: importResult.imported,
        duplicates: importResult.duplicates,
        failed: importResult.failed
      }
    };

    await supabase
      .from('data_import_batches')
      .update(batchUpdate)
      .eq('id', batchId);

    return res.json({
      success: true,
      data: {
        batchId,
        imported: importResult.imported,
        duplicates: importResult.duplicates,
        failed: importResult.failed,
        totalRecords: records.length,
        errors: importResult.errors,
        processingCompleted: true
      }
    });

  } catch (error) {
    console.error('[LYTX CSV API] Import failed:', error);

    // Update batch with error
    await supabase
      .from('data_import_batches')
      .update({
        status: 'failed',
        error_summary: {
          error: error instanceof Error ? error.message : 'Unknown import error'
        },
        processing_metadata: {
          processingFailed: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
      .eq('id', batchId);

    return res.status(500).json({
      success: false,
      error: 'CSV import failed'
    });
  }
}

/**
 * Handle preview request
 */
async function handlePreview(req, res, body: ImportRequest) {
  const { fileContent, fileName = 'preview.csv', userId } = body;

  if (!fileContent) {
    return res.status(400).json({
      success: false,
      error: 'File content is required for preview'
    });
  }

  try {
    const processingResult = await LytxCsvProcessor.processCsv(fileContent, userId);

    return res.json({
      success: true,
      data: {
        fileName,
        rowCount: processingResult.metadata.totalRows,
        validRows: processingResult.metadata.validRows,
        skippedRows: processingResult.metadata.skippedRows,
        previewData: processingResult.preview,
        carrier: processingResult.metadata.carrier,
        dateRange: processingResult.metadata.dateRange,
        warnings: processingResult.metadata.warnings,
        errors: processingResult.metadata.errors
      }
    });

  } catch (error) {
    console.error('[LYTX CSV API] Preview failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate preview'
    });
  }
}

/**
 * Simple multipart form data parser
 * (In production, consider using a library like formidable or busboy)
 */
async function parseMultipartData(req): Promise<{ file?: Buffer; userId?: string; fileName?: string }> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        // This is a simplified parser - in production use a proper library
        const boundary = req.headers['content-type']?.split('boundary=')[1];
        if (!boundary) {
          reject(new Error('No boundary found'));
          return;
        }

        const parts = body.split(`--${boundary}`);
        let file: Buffer | undefined;
        let userId: string | undefined;
        let fileName: string | undefined;

        for (const part of parts) {
          if (part.includes('name="file"')) {
            const contentStart = part.indexOf('\r\n\r\n') + 4;
            const contentEnd = part.lastIndexOf('\r\n');
            if (contentStart > 3 && contentEnd > contentStart) {
              file = Buffer.from(part.slice(contentStart, contentEnd));
            }
            
            // Extract filename
            const filenameMatch = part.match(/filename="([^"]+)"/);
            if (filenameMatch) {
              fileName = filenameMatch[1];
            }
          }
          
          if (part.includes('name="userId"')) {
            const contentStart = part.indexOf('\r\n\r\n') + 4;
            const contentEnd = part.lastIndexOf('\r\n');
            if (contentStart > 3 && contentEnd > contentStart) {
              userId = part.slice(contentStart, contentEnd).trim();
            }
          }
        }

        resolve({ file, userId, fileName });
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};