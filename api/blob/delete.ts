/**
 * BLOB DELETE API ENDPOINT
 * 
 * Securely deletes files from Vercel Blob storage with proper authorization
 */

import { del } from '@vercel/blob';
import { validateVercelEnvironment } from '../lib/vercel-environment';
import { supabase } from '../lib/supabase';

interface DeleteRequest {
  blobUrl?: string;
  uploadId?: string;
  userId: string;
  reason?: string;
}

export default async function handler(req: any, res: any) {
  if (req.method === 'DELETE') {
    try {
      // Validate Vercel environment
      const envStatus = await validateVercelEnvironment();
      if (!envStatus.blob.available) {
        return res.status(503).json({
          success: false, 
          error: 'Blob storage not available'
        });
      }

      const body: DeleteRequest = req.body;
      const { blobUrl, uploadId, userId, reason } = body;

      if (!userId) {
        return res.status(401).json({
          success: false, 
          error: 'User ID is required for authorization'
        });
      }

      if (!blobUrl && !uploadId) {
        return res.status(400).json({
          success: false, 
          error: 'Either blobUrl or uploadId must be provided'
        });
      }

      let fileRecord = null;
      let targetBlobUrl = blobUrl;

      // If uploadId provided, get the blob URL from database
      if (uploadId) {
        const { data, error } = await supabase
          .from('csv_upload_sessions')
          .select('*')
          .eq('id', uploadId)
          .single();

        if (error || !data) {
          return res.status(404).json({
            success: false, 
            error: 'Upload session not found'
          });
        }

        fileRecord = data;
        targetBlobUrl = data.blob_url;

        // Verify ownership
        if (data.user_id !== userId) {
          return res.status(403).json({
            success: false, 
            error: 'Unauthorized: You can only delete your own files'
          });
        }
      }

      if (!targetBlobUrl) {
        return res.status(400).json({
          success: false, 
          error: 'No blob URL available for deletion'
        });
      }

      // Delete from Blob storage
      try {
        await del(targetBlobUrl);
        console.log(`[BLOB_DELETE] Successfully deleted: ${targetBlobUrl}`);
      } catch (blobError) {
        console.error('[BLOB_DELETE] Blob deletion failed:', blobError);
        // Continue with database cleanup even if blob deletion fails
      }

      // Update database record
      if (fileRecord || uploadId) {
        const updateData = {
          upload_status: 'deleted',
          deleted_at: new Date().toISOString(),
          deletion_reason: reason || 'User requested deletion',
          blob_url: null // Clear the URL since file is deleted
        };

        const { error: updateError } = await supabase
          .from('csv_upload_sessions')
          .update(updateData)
          .eq('id', uploadId || fileRecord?.id);

        if (updateError) {
          console.error('[BLOB_DELETE] Database update failed:', updateError);
          // Don't fail the request if blob was deleted successfully
        }
      }

      // Log the deletion for audit
      try {
        await supabase
          .from('file_deletion_logs')
          .insert({
            user_id: userId,
            blob_url: targetBlobUrl,
            upload_id: uploadId,
            reason: reason || 'User requested deletion',
            deleted_at: new Date().toISOString()
          });
      } catch (logError) {
        console.warn('[BLOB_DELETE] Failed to log deletion:', logError);
        // Don't fail the request for logging errors
      }

      return res.json({
        success: true,
        message: 'File deleted successfully',
        deletedUrl: targetBlobUrl,
        uploadId: uploadId || fileRecord?.id
      });

    } catch (error) {
      console.error('[BLOB_DELETE] Request failed:', error);
      return res.status(500).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Deletion failed'
      });
    }
  }

  if (req.method === 'POST') {
    try {
      const body: {
        files: Array<{ blobUrl?: string; uploadId?: string }>;
        userId: string;
        reason?: string;
      } = req.body;

      const { files, userId, reason } = body;

      if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({
          success: false, 
          error: 'Files array is required and cannot be empty'
        });
      }

      if (files.length > 50) {
        return res.status(400).json({
          success: false, 
          error: 'Maximum 50 files can be deleted at once'
        });
      }

      const results = {
        successful: [] as string[],
        failed: [] as { identifier: string; error: string }[],
        total: files.length
      };

      // Process each file deletion using the same logic as DELETE method
      for (const file of files) {
        try {
          const deleteResult = await handleSingleFileDeletion({
            blobUrl: file.blobUrl,
            uploadId: file.uploadId,
            userId,
            reason
          });

          const identifier = file.uploadId || file.blobUrl || 'unknown';

          if (deleteResult.success) {
            results.successful.push(identifier);
          } else {
            results.failed.push({
              identifier,
              error: deleteResult.error || 'Unknown deletion error'
            });
          }
        } catch (error) {
          results.failed.push({
            identifier: file.uploadId || file.blobUrl || 'unknown',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return res.json({
        success: results.failed.length === 0,
        message: `Deleted ${results.successful.length}/${results.total} files`,
        results
      });

    } catch (error) {
      console.error('[BLOB_DELETE] Batch delete failed:', error);
      return res.status(500).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Batch deletion failed'
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
 * Helper function to handle single file deletion (shared between DELETE and POST)
 */
async function handleSingleFileDeletion(params: {
  blobUrl?: string;
  uploadId?: string;
  userId: string;
  reason?: string;
}): Promise<{ success: boolean; error?: string; deletedUrl?: string; uploadId?: string }> {
  try {
    const { blobUrl, uploadId, userId, reason } = params;

    // Validate Vercel environment
    const envStatus = await validateVercelEnvironment();
    if (!envStatus.blob.available) {
      return {
        success: false,
        error: 'Blob storage not available'
      };
    }

    if (!userId) {
      return {
        success: false,
        error: 'User ID is required for authorization'
      };
    }

    if (!blobUrl && !uploadId) {
      return {
        success: false,
        error: 'Either blobUrl or uploadId must be provided'
      };
    }

    let fileRecord = null;
    let targetBlobUrl = blobUrl;

    // If uploadId provided, get the blob URL from database
    if (uploadId) {
      const { data, error } = await supabase
        .from('csv_upload_sessions')
        .select('*')
        .eq('id', uploadId)
        .single();

      if (error || !data) {
        return {
          success: false,
          error: 'Upload session not found'
        };
      }

      fileRecord = data;
      targetBlobUrl = data.blob_url;

      // Verify ownership
      if (data.user_id !== userId) {
        return {
          success: false,
          error: 'Unauthorized: You can only delete your own files'
        };
      }
    }

    if (!targetBlobUrl) {
      return {
        success: false,
        error: 'No blob URL available for deletion'
      };
    }

    // Delete from Blob storage
    try {
      await del(targetBlobUrl);
      console.log(`[BLOB_DELETE] Successfully deleted: ${targetBlobUrl}`);
    } catch (blobError) {
      console.error('[BLOB_DELETE] Blob deletion failed:', blobError);
      // Continue with database cleanup even if blob deletion fails
    }

    // Update database record
    if (fileRecord || uploadId) {
      const updateData = {
        upload_status: 'deleted',
        deleted_at: new Date().toISOString(),
        deletion_reason: reason || 'User requested deletion',
        blob_url: null // Clear the URL since file is deleted
      };

      const { error: updateError } = await supabase
        .from('csv_upload_sessions')
        .update(updateData)
        .eq('id', uploadId || fileRecord?.id);

      if (updateError) {
        console.error('[BLOB_DELETE] Database update failed:', updateError);
        // Don't fail the request if blob was deleted successfully
      }
    }

    // Log the deletion for audit
    try {
      await supabase
        .from('file_deletion_logs')
        .insert({
          user_id: userId,
          blob_url: targetBlobUrl,
          upload_id: uploadId,
          reason: reason || 'User requested deletion',
          deleted_at: new Date().toISOString()
        });
    } catch (logError) {
      console.warn('[BLOB_DELETE] Failed to log deletion:', logError);
      // Don't fail the request for logging errors
    }

    return {
      success: true,
      deletedUrl: targetBlobUrl,
      uploadId: uploadId || fileRecord?.id
    };

  } catch (error) {
    console.error('[BLOB_DELETE] Single file deletion failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Deletion failed'
    };
  }
}