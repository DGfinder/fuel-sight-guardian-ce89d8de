/**
 * ENHANCED CSV UPLOAD HOOK WITH VERCEL BLOB STORAGE
 * 
 * Provides React hook for uploading and processing CSV files using
 * Vercel Blob storage with support for both server (<4.5MB) and
 * client (>4.5MB) uploads, advanced progress tracking, and error handling
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { validateVercelEnvironment } from '@/lib/vercel-environment';

// Upload states
export type UploadState = 'idle' | 'uploading' | 'uploaded' | 'processing' | 'completed' | 'error';

// Upload methods
export type UploadMethod = 'server' | 'client' | 'auto';

// Vercel-specific constants
const SERVER_UPLOAD_LIMIT = 4.5 * 1024 * 1024; // 4.5MB Vercel server limit
const CLIENT_UPLOAD_LIMIT = 500 * 1024 * 1024; // 500MB client limit

// Upload result interface
export interface UploadResult {
  fileId: string;
  filename: string;
  size: number;
  rowCount: number;
  columnCount: number;
  previewData: any[];
  uploadUrl: string;
  processingStatus: string;
  errors: string[];
  uploadMethod: UploadMethod;
  blobPath?: string;
  vercelMetadata?: {
    uploadTime: number;
    serverProcessing: boolean;
    clientUpload: boolean;
  };
}

// Processing result interface
export interface ProcessingResult {
  fileId: string;
  processedRecords: number;
  totalRows: number;
  skippedRows: number;
  errors: string[];
  warnings: string[];
  processedFileUrl: string;
  carrier: 'SMB' | 'GSF';
  period: string;
  processingCompleted: boolean;
  preview: {
    originalSample: any[];
    transformedSample: any[];
  };
}

// Hook return interface
export interface CsvUploadHook {
  // State
  uploadState: UploadState;
  uploadProgress: number;
  uploadResult: UploadResult | null;
  processingResult: ProcessingResult | null;
  error: string | null;
  uploadMethod: UploadMethod;
  
  // Actions
  uploadFile: (file: File, description?: string, method?: UploadMethod) => void;
  processFile: (fileId: string, options?: ProcessingOptions) => void;
  previewFile: (fileId: string) => Promise<any>;
  resetUpload: () => void;
  downloadProcessed: (url: string) => void;
  cancelUpload: () => void;
  
  // Status helpers
  isUploading: boolean;
  isProcessing: boolean;
  canProcess: boolean;
  hasErrors: boolean;
  
  // Vercel-specific helpers
  vercelEnvironmentStatus: any;
  recommendedUploadMethod: (fileSize: number) => UploadMethod;
  uploadCapabilities: {
    serverUpload: boolean;
    clientUpload: boolean;
    maxServerSize: number;
    maxClientSize: number;
  };
}

// Processing options interface
export interface ProcessingOptions {
  carrier?: 'SMB' | 'GSF';
  skipValidation?: boolean;
  batchSize?: number;
}

export function useCsvUpload(userId: string): CsvUploadHook {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadMethod, setUploadMethod] = useState<UploadMethod>('auto');
  const [vercelEnvironmentStatus, setVercelEnvironmentStatus] = useState<any>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Initialize Vercel environment status
  useEffect(() => {
    validateVercelEnvironment().then(status => {
      setVercelEnvironmentStatus(status);
    });
  }, []);

  // Helper function for server upload (<4.5MB)
  const performServerUpload = useCallback(async (
    file: File, 
    description?: string, 
    startTime?: number
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);
    if (description) {
      formData.append('description', description);
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentage = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentage);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            if (response.success) {
              resolve({
                ...response,
                data: {
                  ...response.data,
                  uploadMethod: 'server',
                  vercelMetadata: {
                    uploadTime: (Date.now() - (startTime || Date.now())),
                    serverProcessing: true,
                    clientUpload: false
                  }
                }
              });
            } else {
              reject(new Error(response.error || 'Server upload failed'));
            }
          } catch (error) {
            reject(new Error('Invalid response from server'));
          }
        } else if (xhr.status === 413) {
          // File too large for server, try client upload
          performClientUpload(file, description, startTime).then(resolve).catch(reject);
        } else {
          reject(new Error(`Server upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during server upload'));
      
      // Handle abort
      if (abortControllerRef.current) {
        abortControllerRef.current.signal.addEventListener('abort', () => {
          xhr.abort();
        });
      }

      xhr.open('POST', '/api/upload-csv');
      xhr.send(formData);
    });
  }, [userId]);

  // Helper function for client upload (>4.5MB)
  const performClientUpload = useCallback(async (
    file: File, 
    description?: string, 
    startTime?: number
  ) => {
    // Step 1: Get signed URL for client upload
    const prepResponse = await fetch('/api/blob/client-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        fileSize: file.size,
        fileType: file.type,
        userId,
        description
      }),
      signal: abortControllerRef.current?.signal
    });

    if (!prepResponse.ok) {
      const error = await prepResponse.json();
      throw new Error(error.error || 'Failed to prepare client upload');
    }

    const prepResult = await prepResponse.json();
    
    // Step 2: Upload directly to Blob storage
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentage = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentage);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 201) {
          resolve({
            success: true,
            data: {
              fileId: prepResult.data.uploadId,
              filename: file.name,
              size: file.size,
              uploadUrl: prepResult.data.uploadUrl,
              blobPath: prepResult.data.blobPath,
              uploadMethod: 'client',
              vercelMetadata: {
                uploadTime: (Date.now() - (startTime || Date.now())),
                serverProcessing: false,
                clientUpload: true
              },
              rowCount: 0, // Will be determined during processing
              columnCount: 0,
              previewData: [],
              processingStatus: 'pending',
              errors: []
            }
          });
        } else {
          reject(new Error('Client upload failed'));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during client upload'));
      
      // Handle abort
      if (abortControllerRef.current) {
        abortControllerRef.current.signal.addEventListener('abort', () => {
          xhr.abort();
        });
      }

      xhr.open('PUT', prepResult.data.uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });
  }, [userId]);

  // Enhanced upload mutation with Vercel-specific logic
  const uploadMutation = useMutation({
    mutationFn: async ({ 
      file, 
      description, 
      method = 'auto' 
    }: { 
      file: File; 
      description?: string; 
      method?: UploadMethod;
    }) => {
      const startTime = Date.now();
      
      // Determine upload method
      const actualMethod = method === 'auto' 
        ? (file.size > SERVER_UPLOAD_LIMIT ? 'client' : 'server')
        : method;
      
      setUploadMethod(actualMethod);

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      if (actualMethod === 'client' || (actualMethod === 'auto' && file.size > SERVER_UPLOAD_LIMIT)) {
        return await performClientUpload(file, description, startTime);
      } else {
        return await performServerUpload(file, description, startTime);
      }
    },
    onMutate: () => {
      setUploadState('uploading');
      setUploadProgress(0);
      setError(null);
    },
    onSuccess: (data) => {
      if (data.success) {
        setUploadState('uploaded');
        setUploadProgress(100);
        setUploadResult(data.data);
        toast({
          title: 'File uploaded successfully',
          description: `${data.data.filename} uploaded with ${data.data.rowCount} rows`,
        });
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    },
    onError: (error: Error) => {
      setUploadState('error');
      setError(error.message);
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Processing mutation
  const processingMutation = useMutation({
    mutationFn: async ({ fileId, options }: { fileId: string; options?: ProcessingOptions }) => {
      const response = await fetch('/api/upload-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'process',
          fileId,
          userId,
          processingOptions: options,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Processing failed');
      }

      return response.json();
    },
    onMutate: () => {
      setUploadState('processing');
      setError(null);
    },
    onSuccess: (data) => {
      if (data.success) {
        setUploadState('completed');
        setProcessingResult(data.data);
        
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: ['captive-payments'] });
        queryClient.invalidateQueries({ queryKey: ['data-import-batches'] });
        
        const hasErrors = data.data.errors.length > 0;
        toast({
          title: hasErrors ? 'Processing completed with issues' : 'Processing completed successfully',
          description: `Processed ${data.data.processedRecords} of ${data.data.totalRows} records`,
          variant: hasErrors ? 'default' : 'default',
        });
      } else {
        throw new Error(data.error || 'Processing failed');
      }
    },
    onError: (error: Error) => {
      setUploadState('error');
      setError(error.message);
      toast({
        title: 'Processing failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Enhanced upload file function with method selection
  const uploadFile = useCallback((file: File, description?: string, method: UploadMethod = 'auto') => {
    uploadMutation.mutate({ file, description, method });
  }, [uploadMutation]);

  // Cancel upload function
  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setUploadState('idle');
      setUploadProgress(0);
      setError('Upload cancelled by user');
    }
  }, []);

  // Process file function
  const processFile = useCallback((fileId: string, options?: ProcessingOptions) => {
    processingMutation.mutate({ fileId, options });
  }, [processingMutation]);

  // Preview file function
  const previewFile = useCallback(async (fileId: string) => {
    try {
      const response = await fetch('/api/upload-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'preview',
          fileId,
          userId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Preview failed');
      }

      const data = await response.json();
      return data.success ? data.data : null;
    } catch (error) {
      console.error('Preview failed:', error);
      toast({
        title: 'Preview failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      return null;
    }
  }, [userId, toast]);

  // Reset upload function
  const resetUpload = useCallback(() => {
    setUploadState('idle');
    setUploadProgress(0);
    setUploadResult(null);
    setProcessingResult(null);
    setError(null);
  }, []);

  // Download processed file
  const downloadProcessed = useCallback((url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  // Vercel-specific helper functions
  const recommendedUploadMethod = useCallback((fileSize: number): UploadMethod => {
    if (fileSize > CLIENT_UPLOAD_LIMIT) {
      return 'server'; // Force server to get proper error message
    }
    return fileSize > SERVER_UPLOAD_LIMIT ? 'client' : 'server';
  }, []);

  const uploadCapabilities = {
    serverUpload: vercelEnvironmentStatus?.blob?.available || false,
    clientUpload: vercelEnvironmentStatus?.blob?.available || false,
    maxServerSize: SERVER_UPLOAD_LIMIT,
    maxClientSize: CLIENT_UPLOAD_LIMIT
  };

  // Computed values
  const isUploading = uploadState === 'uploading';
  const isProcessing = uploadState === 'processing';
  const canProcess = uploadState === 'uploaded' && uploadResult !== null;
  const hasErrors = error !== null || (processingResult?.errors.length || 0) > 0;

  return {
    // State
    uploadState,
    uploadProgress,
    uploadResult,
    processingResult,
    error,
    uploadMethod,
    
    // Actions
    uploadFile,
    processFile,
    previewFile,
    resetUpload,
    downloadProcessed,
    cancelUpload,
    
    // Status helpers
    isUploading,
    isProcessing,
    canProcess,
    hasErrors,
    
    // Vercel-specific helpers
    vercelEnvironmentStatus,
    recommendedUploadMethod,
    uploadCapabilities,
  };
}

// Utility hook for file validation
export function useFileValidation() {
  const validateCsvFile = useCallback((file: File) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check file type
    const validTypes = ['text/csv', 'application/csv', 'text/plain'];
    const isValidType = validTypes.includes(file.type) || file.name.toLowerCase().endsWith('.csv');
    
    if (!isValidType) {
      errors.push('Invalid file type. Only CSV files are allowed.');
    }

    // Check file size with Vercel-specific limits
    if (file.size > CLIENT_UPLOAD_LIMIT) {
      errors.push(`File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds maximum allowed size of ${(CLIENT_UPLOAD_LIMIT / 1024 / 1024).toFixed(1)}MB.`);
    }

    // Warnings for different upload methods
    if (file.size > SERVER_UPLOAD_LIMIT) {
      warnings.push(`File size ${(file.size / 1024 / 1024).toFixed(1)}MB will use client-side upload (direct to Vercel Blob storage).`);
    }

    // Warnings for large files
    if (file.size > 100 * 1024 * 1024) {
      warnings.push('Large file detected. Processing may take several minutes.');
    }

    // Warnings for very large files
    if (file.size > 200 * 1024 * 1024) {
      warnings.push('Very large file. Consider splitting into smaller files for better performance.');
    }

    // Check filename patterns
    if (file.name.toLowerCase().includes('captive') && file.name.toLowerCase().includes('payment')) {
      // Likely a captive payments file
    } else {
      warnings.push('Filename does not match expected pattern. Please verify this is a captive payments file.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }, []);

  return { validateCsvFile };
}

// Progress tracking hook
export function useUploadProgress() {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<string>('');

  const updateProgress = useCallback((newProgress: number, newStage: string) => {
    setProgress(Math.min(100, Math.max(0, newProgress)));
    setStage(newStage);
  }, []);

  const resetProgress = useCallback(() => {
    setProgress(0);
    setStage('');
  }, []);

  return {
    progress,
    stage,
    updateProgress,
    resetProgress
  };
}