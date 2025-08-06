/**
 * SERVERLESS CSV UPLOAD AND PROCESSING API
 * 
 * Handles CSV file uploads using Vercel Blob storage,
 * processes files server-side, and returns processed results
 */

import { NextRequest, NextResponse } from 'next/server';
import { uploadCSVFile, generateExport, createBackup } from './lib/vercel-blob';
import { processCaptivePaymentsCsv } from './lib/captivePaymentsCsvProcessor';
import { cacheSet, CACHE_CONFIG, CACHE_KEYS } from './lib/vercel-kv';
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

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      return await handleFileUpload(request);
    } else {
      // Handle processing request
      return await handleProcessingRequest(request);
    }
  } catch (error) {
    console.error('[CSV API] Request failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

/**
 * Handle CSV file upload
 */
async function handleFileUpload(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    const description = formData.get('description') as string || undefined;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Validate file
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only CSV files are allowed.' },
        { status: 400 }
      );
    }

    // Check file size and determine upload method
    if (file.size > CLIENT_MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File too large. Maximum size is ${CLIENT_MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    if (file.size > SERVER_MAX_FILE_SIZE) {
      // File is too large for server upload, suggest client upload
      return NextResponse.json(
        { 
          success: false, 
          error: 'File exceeds server upload limit (4.5MB)',
          suggestion: 'client-upload',
          fileSize: file.size,
          serverLimit: SERVER_MAX_FILE_SIZE
        },
        { status: 413 } // Payload Too Large
      );
    }

    // Upload file to Blob storage
    const uploadResult = await uploadCSVFile(file, userId, {
      description,
      tags: ['captive-payments', 'upload']
    });

    if (!uploadResult.success) {
      return NextResponse.json(
        { success: false, error: uploadResult.errors.join(', ') },
        { status: 400 }
      );
    }

    // Cache upload result for quick access
    const cacheKey = `${CACHE_KEYS.CAPTIVE_ANALYTICS}upload_${uploadResult.fileId}`;
    await cacheSet(cacheKey, uploadResult, CACHE_CONFIG.CAPTIVE_PAYMENTS);

    // Log the upload
    await supabase
      .from('data_import_batches')
      .insert({
        source_type: 'captive_payments',
        source_subtype: 'CSV_UPLOAD',
        file_name: file.name,
        batch_reference: uploadResult.fileId,
        status: 'pending',
        processing_metadata: {
          fileId: uploadResult.fileId,
          originalUrl: uploadResult.originalUrl,
          fileSize: file.size,
          uploadedAt: new Date().toISOString()
        },
        created_by: userId
      });

    return NextResponse.json({
      success: true,
      data: {
        fileId: uploadResult.fileId,
        filename: file.name,
        size: file.size,
        rowCount: uploadResult.rowCount,
        columnCount: uploadResult.columnCount,
        previewData: uploadResult.previewData.slice(0, 5), // First 5 rows
        uploadUrl: uploadResult.originalUrl,
        processingStatus: 'uploaded',
        errors: uploadResult.errors
      }
    });

  } catch (error) {
    console.error('[CSV API] Upload failed:', error);
    return NextResponse.json(
      { success: false, error: 'File upload failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle CSV processing request
 */
async function handleProcessingRequest(request: NextRequest) {
  try {
    const body: ProcessingRequest = await request.json();
    const { action, fileId, userId, processingOptions = {} } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'preview':
        return await handlePreview(fileId!, userId);
      case 'process':
        return await handleProcessing(fileId!, userId, processingOptions);
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('[CSV API] Processing request failed:', error);
    return NextResponse.json(
      { success: false, error: 'Processing request failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle file preview request
 */
async function handlePreview(fileId: string, userId: string) {
  try {
    // Check cache first
    const cacheKey = `${CACHE_KEYS.CAPTIVE_ANALYTICS}upload_${fileId}`;
    let uploadResult = await cacheSet(cacheKey, null);
    
    if (!uploadResult) {
      return NextResponse.json(
        { success: false, error: 'File not found or expired' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        fileId,
        previewData: uploadResult.previewData,
        rowCount: uploadResult.rowCount,
        columnCount: uploadResult.columnCount,
        metadata: uploadResult.metadata
      }
    });

  } catch (error) {
    console.error('[CSV API] Preview failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate preview' },
      { status: 500 }
    );
  }
}

/**
 * Handle CSV processing
 */
async function handleProcessing(
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
    let uploadResult = await cacheSet(cacheKey, null);
    
    if (!uploadResult) {
      return NextResponse.json(
        { success: false, error: 'File not found or expired. Please re-upload the file.' },
        { status: 404 }
      );
    }

    // Fetch the file content from Blob storage
    const response = await fetch(uploadResult.originalUrl);
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

    return NextResponse.json({
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

    return NextResponse.json(
      { success: false, error: 'CSV processing failed' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      service: 'CSV Upload API',
      timestamp: new Date().toISOString(),
      limits: {
        maxFileSize: MAX_FILE_SIZE,
        allowedTypes: ALLOWED_TYPES
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Service unavailable' },
      { status: 503 }
    );
  }
}