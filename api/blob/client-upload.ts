/**
 * CLIENT-SIDE BLOB UPLOAD API
 * 
 * Handles large file uploads (>4.5MB) using Vercel Blob client-side upload.
 * Returns a signed URL for direct client upload to Blob storage.
 */

import { put, handleUpload, type HandleUploadBody } from '@vercel/blob';
import { validateVercelEnvironment } from '../lib/vercel-environment';
import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

// Configuration
const CLIENT_MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const ALLOWED_TYPES = ['text/csv', 'application/csv', 'text/plain'];

interface ClientUploadRequest {
  filename: string;
  fileSize: number;
  fileType: string;
  userId: string;
  description?: string;
  tags?: string[];
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      // Validate Vercel environment
      const envStatus = await validateVercelEnvironment();
      if (!envStatus.blob.available) {
        return res.status(503).json({
          success: false, 
          error: 'Blob storage not available',
          details: envStatus.blob.error
        });
      }

      const body: ClientUploadRequest = req.body;
      const { filename, fileSize, fileType, userId, description, tags = [] } = body;

      // Validate required fields
      if (!filename || !fileSize || !fileType || !userId) {
        return res.status(400).json({
          success: false, 
          error: 'Missing required fields: filename, fileSize, fileType, userId'
        });
      }

      // Validate file type
      if (!ALLOWED_TYPES.includes(fileType) && !filename.toLowerCase().endsWith('.csv')) {
        return res.status(400).json({
          success: false, 
          error: 'Invalid file type. Only CSV files are allowed.'
        });
      }

      // Validate file size
      if (fileSize > CLIENT_MAX_FILE_SIZE) {
        return res.status(413).json({
          success: false, 
          error: `File too large. Maximum size is ${CLIENT_MAX_FILE_SIZE / 1024 / 1024}MB`,
          maxSize: CLIENT_MAX_FILE_SIZE
        });
      }

      // Generate unique file path
      const fileId = uuidv4();
      const timestamp = new Date().toISOString().split('T')[0];
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const blobPath = `uploads/csv/${timestamp}/${fileId}_${sanitizedFilename}`;

      // Create metadata record in database
      const { data: uploadRecord, error: dbError } = await supabase
        .from('csv_upload_sessions')
        .insert({
          id: fileId,
          user_id: userId,
          original_filename: filename,
          file_size: fileSize,
          file_type: fileType,
          blob_path: blobPath,
          upload_status: 'pending',
          description,
          tags: tags.join(','),
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (dbError) {
        console.error('[CLIENT_UPLOAD] Database error:', dbError);
        return res.status(500).json({
          success: false, 
          error: 'Failed to create upload session'
        });
      }

      // Generate signed URL for client upload
      const uploadUrl = await put(blobPath, Buffer.from('placeholder'), {
        access: 'public',
        addRandomSuffix: false,
        multipart: fileSize > 50 * 1024 * 1024 // Use multipart for files >50MB
      }).then(result => result.url);

      // Return upload instructions
      return res.json({
        success: true,
        data: {
          uploadId: fileId,
          uploadUrl: uploadUrl.replace('/placeholder', ''), // Remove placeholder from URL
          blobPath,
          metadata: uploadRecord,
          instructions: {
            method: 'PUT',
            maxSize: CLIENT_MAX_FILE_SIZE,
            allowedTypes: ALLOWED_TYPES,
            uploadType: 'client-direct'
          }
        }
      });

    } catch (error) {
      console.error('[CLIENT_UPLOAD] Request failed:', error);
      return res.status(500).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }

  if (req.method === 'PUT') {
    try {
      const body: HandleUploadBody = req.body;
      
      // Verify the upload using Vercel's handleUpload utility
      const jsonResponse = await handleUpload({
        body,
        request: req, // Note: This might need adaptation for Vercel serverless
        onBeforeGenerateToken: async (pathname /* , clientPayload */) => {
          // Validate pathname and return metadata
          return {
            allowedContentTypes: ALLOWED_TYPES,
            maximumSizeInBytes: CLIENT_MAX_FILE_SIZE,
          };
        },
        onUploadCompleted: async ({ blob, tokenPayload }) => {
          // Update database record
          try {
            const pathParts = blob.pathname.split('/');
            const fileIdPart = pathParts[pathParts.length - 1];
            const fileId = fileIdPart.split('_')[0];

            await supabase
              .from('csv_upload_sessions')
              .update({
                upload_status: 'completed',
                blob_url: blob.url,
                blob_size: blob.size,
                completed_at: new Date().toISOString()
              })
              .eq('id', fileId);

            console.log(`[CLIENT_UPLOAD] Upload completed: ${blob.url}`);
          } catch (error) {
            console.error('[CLIENT_UPLOAD] Failed to update completion status:', error);
          }
        },
      });

      return res.json(jsonResponse);
    } catch (error) {
      console.error('[CLIENT_UPLOAD] Completion callback failed:', error);
      return res.status(500).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Upload completion failed'
      });
    }
  }

  if (req.method === 'GET') {
    try {
      const { searchParams } = new URL(`http://localhost${req.url}`);
      const uploadId = searchParams.get('uploadId');

      if (!uploadId) {
        return res.status(400).json({
          success: false, 
          error: 'Upload ID required'
        });
      }

      const { data: uploadSession, error } = await supabase
        .from('csv_upload_sessions')
        .select('*')
        .eq('id', uploadId)
        .single();

      if (error || !uploadSession) {
        return res.status(404).json({
          success: false, 
          error: 'Upload session not found'
        });
      }

      return res.json({
        success: true,
        data: {
          uploadId: uploadSession.id,
          status: uploadSession.upload_status,
          filename: uploadSession.original_filename,
          fileSize: uploadSession.file_size,
          blobUrl: uploadSession.blob_url,
          createdAt: uploadSession.created_at,
          completedAt: uploadSession.completed_at,
          description: uploadSession.description
        }
      });

    } catch (error) {
      console.error('[CLIENT_UPLOAD] Status check failed:', error);
      return res.status(500).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Status check failed'
      });
    }
  }

  // Method not allowed
  return res.status(405).json({
    success: false,
    error: 'Method not allowed'
  });
}