/**
 * BLOB LIST API ENDPOINT
 * 
 * Lists user files from Vercel Blob storage with filtering and pagination
 */

import { list, type ListBlobResult } from '@vercel/blob';
import { validateVercelEnvironment } from '../lib/vercel-environment';
import { supabase } from '../lib/supabase';

interface ListQuery {
  userId?: string;
  limit?: number;
  cursor?: string;
  prefix?: string;
  status?: 'pending' | 'completed' | 'failed' | 'processing' | 'deleted';
  fileType?: string;
  dateFrom?: string;
  dateTo?: string;
  tags?: string;
  includeDeleted?: boolean;
}

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      // Validate Vercel environment
      const envStatus = await validateVercelEnvironment();
      if (!envStatus.blob.available) {
        return res.status(503).json({
          success: false, 
          error: 'Blob storage not available'
        });
      }

      const { searchParams } = new URL(`http://localhost${req.url}`);
      
      const query: ListQuery = {
        userId: searchParams.get('userId') || undefined,
        limit: parseInt(searchParams.get('limit') || '20'),
        cursor: searchParams.get('cursor') || undefined,
        prefix: searchParams.get('prefix') || undefined,
        status: (searchParams.get('status') as ListQuery['status']) || undefined,
        fileType: searchParams.get('fileType') || undefined,
        dateFrom: searchParams.get('dateFrom') || undefined,
        dateTo: searchParams.get('dateTo') || undefined,
        tags: searchParams.get('tags') || undefined,
        includeDeleted: searchParams.get('includeDeleted') === 'true'
      };

      // Validate limit
      if (query.limit && (query.limit < 1 || query.limit > 100)) {
        return res.status(400).json({
          success: false, 
          error: 'Limit must be between 1 and 100'
        });
      }

      // Build database query for file metadata
      let dbQuery = supabase
        .from('csv_upload_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (query.userId) {
        dbQuery = dbQuery.eq('user_id', query.userId);
      }

      if (query.status && !query.includeDeleted) {
        dbQuery = dbQuery.eq('upload_status', query.status);
      } else if (!query.includeDeleted) {
        dbQuery = dbQuery.neq('upload_status', 'deleted');
      }

      if (query.fileType) {
        dbQuery = dbQuery.eq('file_type', query.fileType);
      }

      if (query.dateFrom) {
        dbQuery = dbQuery.gte('created_at', query.dateFrom);
      }

      if (query.dateTo) {
        dbQuery = dbQuery.lte('created_at', query.dateTo);
      }

      if (query.tags) {
        dbQuery = dbQuery.like('tags', `%${query.tags}%`);
      }

      if (query.limit) {
        dbQuery = dbQuery.limit(query.limit);
      }

      // Execute database query
      const { data: uploadSessions, error: dbError } = await dbQuery;

      if (dbError) {
        console.error('[BLOB_LIST] Database query failed:', dbError);
        return res.status(500).json({
          success: false, 
          error: 'Failed to fetch file metadata'
        });
      }

      // Get blob storage list (for verification and additional metadata)
      let blobList: ListBlobResult | null = null;
      try {
        blobList = await list({
          limit: query.limit,
          cursor: query.cursor,
          prefix: query.prefix || 'uploads/csv/'
        });
      } catch (blobError) {
        console.warn('[BLOB_LIST] Blob storage query failed:', blobError);
        // Continue with database data only
      }

      // Combine and enrich data
      const enrichedFiles = uploadSessions?.map(session => {
        // Find corresponding blob data
        const blobData = blobList?.blobs.find(blob => 
          blob.pathname.includes(session.id) || blob.url === session.blob_url
        );

        return {
          // Database metadata
          id: session.id,
          userId: session.user_id,
          filename: session.original_filename,
          fileSize: session.file_size,
          fileType: session.file_type,
          status: session.upload_status,
          description: session.description,
          tags: session.tags?.split(',').filter(Boolean) || [],
          
          // Timestamps
          createdAt: session.created_at,
          completedAt: session.completed_at,
          deletedAt: session.deleted_at,
          
          // Blob data
          blobUrl: session.blob_url,
          blobPath: session.blob_path,
          blobSize: blobData?.size || session.blob_size,
          
          // Additional blob metadata if available
          ...(blobData && {
            blobMetadata: {
              uploadedAt: blobData.uploadedAt,
              pathname: blobData.pathname,
              // Note: contentType and contentDisposition may not be available in all Blob API versions
              size: blobData.size || 0,
              downloadUrl: blobData.downloadUrl || blobData.url
            }
          }),
          
          // Computed fields
          sizeFormatted: formatFileSize(session.file_size),
          statusDisplay: formatStatus(session.upload_status),
          daysOld: Math.floor((Date.now() - new Date(session.created_at).getTime()) / (1000 * 60 * 60 * 24))
        };
      }) || [];

      // Calculate summary statistics
      const summary = {
        totalFiles: enrichedFiles.length,
        totalSize: enrichedFiles.reduce((sum, file) => sum + (file.fileSize || 0), 0),
        statusBreakdown: enrichedFiles.reduce((acc, file) => {
          acc[file.status] = (acc[file.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        typeBreakdown: enrichedFiles.reduce((acc, file) => {
          const type = file.fileType || 'unknown';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };

      return res.json({
        success: true,
        data: {
          files: enrichedFiles,
          summary,
          pagination: {
            limit: query.limit,
            cursor: query.cursor,
            nextCursor: blobList?.cursor || null,
            hasMore: blobList?.hasMore || false
          },
          filters: query,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('[BLOB_LIST] Request failed:', error);
      return res.status(500).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to list files'
      });
    }
  }

  if (req.method === 'POST') {
    try {
      const body: { userId?: string; days?: number } = req.body;
      const { userId, days = 30 } = body;

      // Build query for usage statistics
      let statsQuery = supabase
        .from('csv_upload_sessions')
        .select('file_size, upload_status, created_at, file_type')
        .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

      if (userId) {
        statsQuery = statsQuery.eq('user_id', userId);
      }

      const { data: usageData, error } = await statsQuery;

      if (error) {
        throw error;
      }

      // Calculate statistics
      const stats = {
        period: {
          days,
          startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        },
        
        storage: {
          totalFiles: usageData?.length || 0,
          totalSize: usageData?.reduce((sum, file) => sum + (file.file_size || 0), 0) || 0,
          averageFileSize: usageData?.length ? 
            (usageData.reduce((sum, file) => sum + (file.file_size || 0), 0) / usageData.length) : 0
        },
        
        status: usageData?.reduce((acc, file) => {
          acc[file.upload_status] = (acc[file.upload_status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {},
        
        types: usageData?.reduce((acc, file) => {
          acc[file.file_type] = (acc[file.file_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {},
        
        daily: generateDailyStats(usageData || [], days)
      };

      // Add formatted values
      const formattedStats = {
        ...stats,
        storage: {
          ...stats.storage,
          totalSizeFormatted: formatFileSize(stats.storage.totalSize),
          averageFileSizeFormatted: formatFileSize(stats.storage.averageFileSize)
        }
      };

      return res.json({
        success: true,
        data: formattedStats
      });

    } catch (error) {
      console.error('[BLOB_LIST] Usage stats failed:', error);
      return res.status(500).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get usage statistics'
      });
    }
  }

  // Method not allowed
  return res.status(405).json({
    success: false,
    error: 'Method not allowed'
  });
}

// Helper functions
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    pending: 'Pending Upload',
    completed: 'Upload Complete',
    processing: 'Processing',
    failed: 'Upload Failed',
    deleted: 'Deleted'
  };
  
  return statusMap[status] || status;
}

function generateDailyStats(data: any[], days: number) {
  const dailyStats: Record<string, { files: number; size: number }> = {};
  
  // Initialize all days
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    dailyStats[date] = { files: 0, size: 0 };
  }
  
  // Aggregate data by day
  data.forEach(file => {
    const date = file.created_at.split('T')[0];
    if (dailyStats[date]) {
      dailyStats[date].files += 1;
      dailyStats[date].size += file.file_size || 0;
    }
  });
  
  return dailyStats;
}