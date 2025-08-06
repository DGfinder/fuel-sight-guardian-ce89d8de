/**
 * VERCEL BLOB MANAGEMENT HOOK
 * 
 * React hook for managing Vercel Blob storage files with
 * listing, deletion, metadata management, and usage statistics
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { validateVercelEnvironment } from '@/lib/vercel-environment';

// File metadata interfaces
export interface BlobFile {
  id: string;
  userId: string;
  filename: string;
  fileSize: number;
  fileType: string;
  status: 'pending' | 'completed' | 'failed' | 'processing' | 'deleted';
  description?: string;
  tags: string[];
  createdAt: string;
  completedAt?: string;
  deletedAt?: string;
  blobUrl?: string;
  blobPath?: string;
  blobSize?: number;
  sizeFormatted: string;
  statusDisplay: string;
  daysOld: number;
  blobMetadata?: {
    uploadedAt: string;
    pathname: string;
    contentType: string;
    contentDisposition: string;
  };
}

export interface BlobListSummary {
  totalFiles: number;
  totalSize: number;
  statusBreakdown: Record<string, number>;
  typeBreakdown: Record<string, number>;
}

export interface BlobListOptions {
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

export interface BlobUsageStats {
  period: {
    days: number;
    startDate: string;
    endDate: string;
  };
  storage: {
    totalFiles: number;
    totalSize: number;
    totalSizeFormatted: string;
    averageFileSize: number;
    averageFileSizeFormatted: string;
  };
  status: Record<string, number>;
  types: Record<string, number>;
  daily: Record<string, { files: number; size: number }>;
}

export interface BlobManagementHook {
  // File listing
  files: BlobFile[];
  summary: BlobListSummary | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  listFiles: (options?: BlobListOptions) => void;
  deleteFile: (fileId: string, reason?: string) => Promise<boolean>;
  deleteFiles: (fileIds: string[], reason?: string) => Promise<{ successful: string[]; failed: Array<{ id: string; error: string }> }>;
  refreshFiles: () => void;
  
  // Usage statistics
  usageStats: BlobUsageStats | null;
  loadUsageStats: (userId?: string, days?: number) => void;
  isLoadingStats: boolean;
  
  // Environment
  vercelStatus: any;
  isVercelReady: boolean;
  
  // Pagination
  pagination: {
    cursor?: string;
    hasMore: boolean;
    loadMore: () => void;
  };
}

export function useBlobManagement(defaultUserId?: string): BlobManagementHook {
  const [files, setFiles] = useState<BlobFile[]>([]);
  const [summary, setSummary] = useState<BlobListSummary | null>(null);
  const [usageStats, setUsageStats] = useState<BlobUsageStats | null>(null);
  const [pagination, setPagination] = useState<{ cursor?: string; hasMore: boolean }>({
    hasMore: false
  });
  const [vercelStatus, setVercelStatus] = useState<any>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Initialize Vercel environment status
  useEffect(() => {
    validateVercelEnvironment().then(status => {
      setVercelStatus(status);
    });
  }, []);

  // File listing query
  const {
    data: fileListData,
    isLoading,
    error: listError,
    refetch: refetchFiles
  } = useQuery({
    queryKey: ['blob-files', defaultUserId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (defaultUserId) params.append('userId', defaultUserId);
      params.append('limit', '20');

      const response = await fetch(`/api/blob/list?${params}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to list files');
      }

      return response.json();
    },
    enabled: !!vercelStatus?.blob?.available,
    staleTime: 30 * 1000 // 30 seconds
  });

  // Usage statistics query
  const {
    data: statsData,
    isLoading: isLoadingStats,
    refetch: refetchStats
  } = useQuery({
    queryKey: ['blob-usage-stats', defaultUserId],
    queryFn: async () => {
      const response = await fetch('/api/blob/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: defaultUserId,
          days: 30
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get usage statistics');
      }

      return response.json();
    },
    enabled: !!vercelStatus?.blob?.available && !!defaultUserId,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Update local state when data changes
  useEffect(() => {
    if (fileListData?.success) {
      setFiles(fileListData.data.files);
      setSummary(fileListData.data.summary);
      setPagination({
        cursor: fileListData.data.pagination.nextCursor,
        hasMore: fileListData.data.pagination.hasMore
      });
    }
  }, [fileListData]);

  useEffect(() => {
    if (statsData?.success) {
      setUsageStats(statsData.data);
    }
  }, [statsData]);

  // Delete single file mutation
  const deleteFileMutation = useMutation({
    mutationFn: async ({ fileId, reason }: { fileId: string; reason?: string }) => {
      const response = await fetch('/api/blob/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId: fileId,
          userId: defaultUserId,
          reason
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete file');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blob-files'] });
      queryClient.invalidateQueries({ queryKey: ['blob-usage-stats'] });
    }
  });

  // Delete multiple files mutation
  const deleteFilesMutation = useMutation({
    mutationFn: async ({ fileIds, reason }: { fileIds: string[]; reason?: string }) => {
      const files = fileIds.map(id => ({ uploadId: id }));
      
      const response = await fetch('/api/blob/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files,
          userId: defaultUserId,
          reason
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete files');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blob-files'] });
      queryClient.invalidateQueries({ queryKey: ['blob-usage-stats'] });
    }
  });

  // List files with options
  const listFiles = useCallback((options: BlobListOptions = {}) => {
    const params = new URLSearchParams();
    
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });

    if (defaultUserId) params.append('userId', defaultUserId);

    queryClient.fetchQuery({
      queryKey: ['blob-files', defaultUserId, options],
      queryFn: async () => {
        const response = await fetch(`/api/blob/list?${params}`);
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to list files');
        }
        return response.json();
      }
    });
  }, [defaultUserId, queryClient]);

  // Delete single file
  const deleteFile = useCallback(async (fileId: string, reason?: string): Promise<boolean> => {
    try {
      await deleteFileMutation.mutateAsync({ fileId, reason });
      
      toast({
        title: 'File deleted',
        description: 'File has been successfully deleted from Blob storage'
      });
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      toast({
        title: 'Delete failed',
        description: errorMessage,
        variant: 'destructive'
      });
      
      return false;
    }
  }, [deleteFileMutation, toast]);

  // Delete multiple files
  const deleteFiles = useCallback(async (
    fileIds: string[], 
    reason?: string
  ): Promise<{ successful: string[]; failed: Array<{ id: string; error: string }> }> => {
    try {
      const result = await deleteFilesMutation.mutateAsync({ fileIds, reason });
      
      if (result.success) {
        const successful = result.results?.successful || [];
        const failed = result.results?.failed || [];
        
        toast({
          title: 'Batch delete completed',
          description: `${successful.length}/${fileIds.length} files deleted successfully`,
          variant: failed.length > 0 ? 'default' : 'default'
        });
        
        return {
          successful,
          failed: failed.map((f: any) => ({ id: f.identifier, error: f.error }))
        };
      } else {
        throw new Error(result.error || 'Batch delete failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      toast({
        title: 'Batch delete failed',
        description: errorMessage,
        variant: 'destructive'
      });
      
      return {
        successful: [],
        failed: fileIds.map(id => ({ id, error: errorMessage }))
      };
    }
  }, [deleteFilesMutation, toast]);

  // Refresh files
  const refreshFiles = useCallback(() => {
    refetchFiles();
    if (defaultUserId) {
      refetchStats();
    }
  }, [refetchFiles, refetchStats, defaultUserId]);

  // Load usage statistics
  const loadUsageStats = useCallback((userId?: string, days: number = 30) => {
    queryClient.fetchQuery({
      queryKey: ['blob-usage-stats', userId, days],
      queryFn: async () => {
        const response = await fetch('/api/blob/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userId || defaultUserId,
            days
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to get usage statistics');
        }

        return response.json();
      }
    });
  }, [defaultUserId, queryClient]);

  // Load more files (pagination)
  const loadMore = useCallback(() => {
    if (pagination.hasMore && pagination.cursor) {
      listFiles({ cursor: pagination.cursor });
    }
  }, [pagination, listFiles]);

  return {
    // File listing
    files,
    summary,
    isLoading,
    error: listError instanceof Error ? listError.message : null,
    
    // Actions
    listFiles,
    deleteFile,
    deleteFiles,
    refreshFiles,
    
    // Usage statistics
    usageStats,
    loadUsageStats,
    isLoadingStats,
    
    // Environment
    vercelStatus,
    isVercelReady: vercelStatus?.blob?.available || false,
    
    // Pagination
    pagination: {
      cursor: pagination.cursor,
      hasMore: pagination.hasMore,
      loadMore
    }
  };
}

/**
 * Hook for file upload progress tracking across multiple files
 */
export function useBlobUploadQueue(userId: string) {
  const [queue, setQueue] = useState<Array<{
    id: string;
    file: File;
    progress: number;
    status: 'pending' | 'uploading' | 'completed' | 'failed';
    error?: string;
    uploadId?: string;
    blobUrl?: string;
  }>>([]);

  const addToQueue = useCallback((files: File[]) => {
    const newItems = files.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      progress: 0,
      status: 'pending' as const
    }));

    setQueue(prev => [...prev, ...newItems]);
    return newItems.map(item => item.id);
  }, []);

  const updateProgress = useCallback((id: string, progress: number) => {
    setQueue(prev => prev.map(item => 
      item.id === id ? { ...item, progress, status: 'uploading' as const } : item
    ));
  }, []);

  const markCompleted = useCallback((id: string, uploadId: string, blobUrl: string) => {
    setQueue(prev => prev.map(item => 
      item.id === id ? { ...item, status: 'completed' as const, uploadId, blobUrl } : item
    ));
  }, []);

  const markFailed = useCallback((id: string, error: string) => {
    setQueue(prev => prev.map(item => 
      item.id === id ? { ...item, status: 'failed' as const, error } : item
    ));
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  return {
    queue,
    addToQueue,
    updateProgress,
    markCompleted,
    markFailed,
    removeFromQueue,
    clearQueue,
    
    // Computed values
    totalFiles: queue.length,
    completedFiles: queue.filter(item => item.status === 'completed').length,
    failedFiles: queue.filter(item => item.status === 'failed').length,
    isUploading: queue.some(item => item.status === 'uploading'),
    overallProgress: queue.length > 0 
      ? queue.reduce((sum, item) => sum + item.progress, 0) / queue.length 
      : 0
  };
}