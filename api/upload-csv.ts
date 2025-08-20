/**
 * SERVERLESS CSV UPLOAD AND PROCESSING API
 * 
 * Handles CSV file uploads using Vercel Blob storage,
 * processes files server-side, and returns processed results
 */

import { uploadCSVFile, generateExport, createBackup } from './lib/vercel-blob';
import { processCaptivePaymentsCsv } from './lib/captivePaymentsCsvProcessor';
import { cacheSet, cacheGet, CACHE_CONFIG, CACHE_KEYS } from './lib/vercel-kv';
import { supabase } from './lib/supabase';

// Configuration - Vercel Server Upload Limits
const SERVER_MAX_FILE_SIZE = 4.5 * 1024 * 1024; // 4.5MB (Vercel server upload limit)
const CLIENT_MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB (for client uploads)
const ALLOWED_TYPES = ['text/csv', 'application/csv', 'text/plain'];

interface ProcessingRequest {
  action: 'upload' | 'process' | 'preview';
  fileId?: string;
  userId: string;
  processingOptions?: {
    carrier?: 'SMB' | 'GSF';
    skipValidation?: boolean;
    batchSize?: number;
  };
}

export default async function handler(req: any, res: any) {
  if (req.method === 'POST') {
    try {
      const contentType = req.headers['content-type'] || '';
      
      if (contentType.includes('multipart/form-data')) {
        // Handle file upload
        return await handleFileUpload(req, res);
      } else {
        // Handle processing request
        return await handleProcessingRequest(req, res);
      }
    } catch (error) {
      console.error('[CSV API] Request failed:', error);
      return res.status(500).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }
  
  if (req.method === 'GET') {
    try {
      return res.json({
        success: true,
        service: 'CSV Upload API',
        timestamp: new Date().toISOString(),
        limits: {
          maxFileSize: SERVER_MAX_FILE_SIZE,
          allowedTypes: ALLOWED_TYPES
        }
      });
    } catch (error) {
      return res.status(503).json({
        success: false, 
        error: 'Service unavailable'
      });
    }
  }

  // Method not allowed
  return res.status(405).json({
    success: false,
    error: 'Method not allowed'
  });
}

/**
 * Handle CSV file upload
 */
async function handleFileUpload(req: any, res: any) {
  try {
    // Note: In Vercel serverless functions, form data handling might need a different approach
    // For now, we'll assume the req object has been parsed for multipart/form-data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    const description = formData.get('description') as string || undefined;
    
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
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.csv')) {
      return res.status(400).json({
        success: false, 
        error: 'Invalid file type. Only CSV files are allowed.'
      });
    }

    // Check file size and determine upload method
    if (file.size > CLIENT_MAX_FILE_SIZE) {
      return res.status(400).json({
        success: false, 
        error: `File too large. Maximum size is ${CLIENT_MAX_FILE_SIZE / 1024 / 1024}MB`
      });
    }

    if (file.size > SERVER_MAX_FILE_SIZE) {
      // File is too large for server upload, suggest client upload
      return res.status(413).json({
        success: false, 
        error: 'File exceeds server upload limit (4.5MB)',
        suggestion: 'client-upload',
        fileSize: file.size,
        serverLimit: SERVER_MAX_FILE_SIZE
      });
    }

    // Upload file to Blob storage
    const uploadResult = await uploadCSVFile(file, userId, {
      description,
      tags: ['captive-payments', 'upload']
    });

    if (!uploadResult.success) {
      return res.status(400).json({
        success: false, 
        error: uploadResult.error || 'Upload failed'
      });
    }

    // Extract data from successful upload
    const { fileId, url, metadata } = uploadResult.data;

    // Cache upload result for quick access
    const cacheKey = `${CACHE_KEYS.CAPTIVE_ANALYTICS}upload_${fileId}`;
    await cacheSet(cacheKey, uploadResult.data, CACHE_CONFIG.CAPTIVE_PAYMENTS);

    // Log the upload
    await supabase
      .from('data_import_batches')
      .insert({
        source_type: 'captive_payments',
        source_subtype: 'CSV_UPLOAD',
        file_name: file.name,
        batch_reference: fileId,
        status: 'pending',
        processing_metadata: {
          fileId: fileId,
          originalUrl: url,
          fileSize: file.size,
          uploadedAt: new Date().toISOString()
        },
        created_by: userId
      });

    return res.json({
      success: true,
      data: {
        fileId: fileId,
        filename: file.name,
        size: file.size,
        uploadUrl: url,
        processingStatus: 'uploaded',
        // Note: rowCount, columnCount, previewData will be available after processing
        metadata: metadata
      }
    });

  } catch (error) {
    console.error('[CSV API] Upload failed:', error);
    return res.status(500).json({
      success: false, 
      error: 'File upload failed'
    });
  }
}

/**
 * Handle CSV processing request
 */
async function handleProcessingRequest(req: any, res: any) {
  try {
    const body: ProcessingRequest = req.body;
    const { action, fileId, userId, processingOptions = {} } = body;

    if (!userId) {
      return res.status(400).json({
        success: false, 
        error: 'User ID is required'
      });
    }

    switch (action) {
      case 'preview':
        return await handlePreview(res, fileId!, userId);
      case 'process':
        return await handleProcessing(res, fileId!, userId, processingOptions);
      default:
        return res.status(400).json({
          success: false, 
          error: 'Invalid action'
        });
    }

  } catch (error) {
    console.error('[CSV API] Processing request failed:', error);
    return res.status(500).json({
      success: false, 
      error: 'Processing request failed'
    });
  }
}

/**
 * Handle file preview request
 */
async function handlePreview(res: any, fileId: string, userId: string) {
  try {
    // Check cache first
    const cacheKey = `${CACHE_KEYS.CAPTIVE_ANALYTICS}upload_${fileId}`;
    let uploadResult = await cacheGet(cacheKey);
    
    if (!uploadResult) {
      return res.status(404).json({
        success: false, 
        error: 'File not found or expired'
      });
    }

    return res.json({
      success: true,
      data: {
        fileId,
        metadata: uploadResult.metadata || uploadResult,
        // Note: Preview data would need to be generated by reading and parsing the CSV file
        message: 'File uploaded successfully. Use process action to get detailed data.'
      }
    });

  } catch (error) {
    console.error('[CSV API] Preview failed:', error);
    return res.status(500).json({
      success: false, 
      error: 'Failed to generate preview'
    });
  }
}

/**
 * Handle CSV processing
 */
async function handleProcessing(
  res,
  fileId: string, 
  userId: string, 
  options: {
    carrier?: 'SMB' | 'GSF';
    skipValidation?: boolean;
    batchSize?: number;
  }
) {
  try {
    // Update import batch status
    await supabase
      .from('data_import_batches')
      .update({ 
        status: 'processing',
        processing_metadata: {
          ...options,
          processingStarted: new Date().toISOString()
        }
      })
      .eq('batch_reference', fileId);

    // Get cached upload result
    const cacheKey = `${CACHE_KEYS.CAPTIVE_ANALYTICS}upload_${fileId}`;
    let uploadResult = await cacheGet(cacheKey);
    
    if (!uploadResult) {
      return res.status(404).json({
        success: false, 
        error: 'File not found or expired. Please re-upload the file.'
      });
    }

    // Fetch the file content from Blob storage
    const response = await fetch(uploadResult.url);
    const fileContent = await response.text();

    // Create a File object for processing
    const file = new File([fileContent], uploadResult.metadata.filename, {
      type: 'text/csv'
    });

    // Process the CSV using the existing processor
    const processedData = await processCaptivePaymentsCsv(file, userId);

    // Generate processed file export
    const processedExport = await generateExport(
      processedData.records,
      'json',
      `processed_${uploadResult.metadata.filename.replace('.csv', '')}`,
      userId,
      {
        description: 'Processed captive payments data',
        metadata: {
          originalFileId: fileId,
          processingOptions: options,
          processedAt: new Date().toISOString()
        }
      }
    );

    // Create backup of important processing results
    await createBackup(
      {
        originalFile: uploadResult.metadata,
        processedData: processedData.metadata,
        processingOptions: options,
        processedAt: new Date().toISOString()
      },
      `captive_processing_${fileId}`,
      userId
    );

    // Update import batch with results
    const batchUpdate = {
      status: processedData.metadata.errors.length === 0 ? 'completed' : 'partial',
      records_processed: processedData.metadata.validRows,
      records_failed: processedData.metadata.skippedRows,
      error_summary: processedData.metadata.errors.length > 0 ? 
        { errors: processedData.metadata.errors, warnings: processedData.metadata.warnings } : null,
      processing_metadata: {
        ...options,
        processingCompleted: new Date().toISOString(),
        processedFileUrl: processedExport.url,
        totalRows: processedData.metadata.totalRows,
        validRows: processedData.metadata.validRows,
        skippedRows: processedData.metadata.skippedRows
      }
    };

    await supabase
      .from('data_import_batches')
      .update(batchUpdate)
      .eq('batch_reference', fileId);

    // Cache the processing results
    const resultsCacheKey = `${CACHE_KEYS.CAPTIVE_ANALYTICS}processed_${fileId}`;
    await cacheSet(resultsCacheKey, processedData, CACHE_CONFIG.CAPTIVE_PAYMENTS);

    return res.json({
      success: true,
      data: {
        fileId,
        processedRecords: processedData.metadata.validRows,
        totalRows: processedData.metadata.totalRows,
        skippedRows: processedData.metadata.skippedRows,
        errors: processedData.metadata.errors,
        warnings: processedData.metadata.warnings,
        processedFileUrl: processedExport.url,
        carrier: processedData.metadata.carrier,
        period: processedData.metadata.period,
        processingCompleted: true,
        preview: processedData.preview
      }
    });

  } catch (error) {
    console.error('[CSV API] Processing failed:', error);

    // Update import batch with error
    await supabase
      .from('data_import_batches')
      .update({
        status: 'failed',
        error_summary: { 
          error: error instanceof Error ? error.message : 'Unknown processing error' 
        },
        processing_metadata: {
          processingFailed: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
      .eq('batch_reference', fileId);

    return res.status(500).json({
      success: false, 
      error: 'CSV processing failed'
    });
  }
}

