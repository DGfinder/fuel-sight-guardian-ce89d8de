/**
 * BLOB DELETE API ENDPOINT
 * 
 * Securely deletes files from Vercel Blob storage with proper authorization
 */

import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { validateVercelEnvironment } from '../lib/vercel-environment';
import { supabase } from '../lib/supabase';

interface DeleteRequest {
  blobUrl?: string;
  uploadId?: string;
  userId: string;
  reason?: string;
}

export async function DELETE(request: NextRequest) {
  try {
    // Validate Vercel environment
    const envStatus = await validateVercelEnvironment();
    if (!envStatus.blob.available) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Blob storage not available',
          details: envStatus.blob.error
        },
        { status: 503 }
      );
    }

    const body: DeleteRequest = await request.json();
    const { blobUrl, uploadId, userId, reason } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required for authorization' },
        { status: 401 }
      );
    }

    if (!blobUrl && !uploadId) {
      return NextResponse.json(
        { success: false, error: 'Either blobUrl or uploadId must be provided' },
        { status: 400 }
      );
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
        return NextResponse.json(
          { success: false, error: 'Upload session not found' },
          { status: 404 }
        );
      }

      fileRecord = data;
      targetBlobUrl = data.blob_url;

      // Verify ownership
      if (data.user_id !== userId) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized: You can only delete your own files' },
          { status: 403 }
        );
      }
    }

    if (!targetBlobUrl) {
      return NextResponse.json(
        { success: false, error: 'No blob URL available for deletion' },
        { status: 400 }
      );
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

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully',
      deletedUrl: targetBlobUrl,
      uploadId: uploadId || fileRecord?.id
    });

  } catch (error) {
    console.error('[BLOB_DELETE] Request failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Deletion failed'
      },
      { status: 500 }
    );
  }
}

/**
 * Batch delete multiple files
 */
export async function POST(request: NextRequest) {
  try {
    const body: {
      files: Array<{ blobUrl?: string; uploadId?: string }>;
      userId: string;
      reason?: string;
    } = await request.json();

    const { files, userId, reason } = body;

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Files array is required and cannot be empty' },
        { status: 400 }
      );
    }

    if (files.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Maximum 50 files can be deleted at once' },
        { status: 400 }
      );
    }

    const results = {
      successful: [] as string[],
      failed: [] as { identifier: string; error: string }[],
      total: files.length
    };

    // Process each file deletion
    for (const file of files) {
      try {
        const deleteResponse = await fetch(request.url, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...file,
            userId,
            reason
          })
        });

        const deleteResult = await deleteResponse.json();
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

    return NextResponse.json({
      success: results.failed.length === 0,
      message: `Deleted ${results.successful.length}/${results.total} files`,
      results
    });

  } catch (error) {
    console.error('[BLOB_DELETE] Batch delete failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Batch deletion failed'
      },
      { status: 500 }
    );
  }
}