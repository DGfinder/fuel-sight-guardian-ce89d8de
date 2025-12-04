/**
 * DRAG & DROP FILE UPLOAD COMPONENT
 * 
 * Advanced drag-and-drop file upload with preview, progress tracking,
 * and automatic Vercel Blob integration
 */

import React, { useState, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  File, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Eye,
  Download,
  Trash2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface DragDropUploadProps {
  onFilesUploaded?: (results: UploadResult[]) => void;
  onUploadError?: (error: string) => void;
  userId: string;
  acceptedTypes?: string[];
  maxSize?: number;
  maxFiles?: number;
  description?: string;
  className?: string;
  showPreview?: boolean;
  allowMultiple?: boolean;
}

interface UploadResult {
  success: boolean;
  uploadId?: string;
  blobUrl?: string;
  filename: string;
  size: number;
  uploadType: 'server' | 'client';
  error?: string;
  file: File;
}

interface FileWithProgress extends File {
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  uploadResult?: UploadResult;
  error?: string;
  preview?: string;
}

const SERVER_LIMIT = 4.5 * 1024 * 1024; // 4.5MB
const DEFAULT_MAX_SIZE = 500 * 1024 * 1024; // 500MB
const DEFAULT_ACCEPTED_TYPES = ['text/csv', 'application/csv'];

export function DragDropUpload({
  onFilesUploaded,
  onUploadError,
  userId,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  maxSize = DEFAULT_MAX_SIZE,
  maxFiles = 5,
  description,
  className = '',
  showPreview = true,
  allowMultiple = true
}: DragDropUploadProps) {
  const [files, setFiles] = useState<FileWithProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setGlobalError(null);

    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles.map(rejected => 
        `${rejected.file.name}: ${rejected.errors.map((e: any) => e.message).join(', ')}`
      );
      setGlobalError(`Some files were rejected: ${errors.join('; ')}`);
    }

    // Add accepted files
    const newFiles: FileWithProgress[] = acceptedFiles.map(file => ({
      ...file,
      id: `${Date.now()}-${Math.random()}`,
      progress: 0,
      status: 'pending' as const,
      preview: showPreview && file.type.startsWith('text/') ? 
        generateTextPreview(file) : undefined
    }));

    setFiles(prev => {
      const combined = [...prev, ...newFiles];
      if (combined.length > maxFiles) {
        setGlobalError(`Maximum ${maxFiles} files allowed. Some files were not added.`);
        return combined.slice(0, maxFiles);
      }
      return combined;
    });
  }, [maxFiles, showPreview]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: Object.fromEntries(acceptedTypes.map(type => [type, []])),
    maxSize,
    multiple: allowMultiple,
    disabled: isUploading
  });

  const generateTextPreview = async (file: File): Promise<string> => {
    try {
      const text = await file.text();
      return text.substring(0, 500) + (text.length > 500 ? '...' : '');
    } catch {
      return 'Preview not available';
    }
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setGlobalError(null);

    const results: UploadResult[] = [];

    // Upload files sequentially to avoid overwhelming the server
    for (const file of files) {
      try {
        setFiles(prev => prev.map(f => 
          f.id === file.id ? { ...f, status: 'uploading', progress: 0 } : f
        ));

        const result = await uploadSingleFile(file);
        
        setFiles(prev => prev.map(f => 
          f.id === file.id ? { 
            ...f, 
            status: result.success ? 'completed' : 'failed',
            progress: 100,
            uploadResult: result,
            error: result.error
          } : f
        ));

        results.push(result);

        if (result.success) {
          toast({
            title: 'File uploaded',
            description: `${file.name} uploaded successfully`
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        
        setFiles(prev => prev.map(f => 
          f.id === file.id ? { 
            ...f, 
            status: 'failed',
            error: errorMessage
          } : f
        ));

        results.push({
          success: false,
          filename: file.name,
          size: file.size,
          uploadType: 'server',
          error: errorMessage,
          file
        });
      }
    }

    setIsUploading(false);
    
    const successfulUploads = results.filter(r => r.success);
    const failedUploads = results.filter(r => !r.success);

    if (successfulUploads.length > 0) {
      onFilesUploaded?.(successfulUploads);
    }

    if (failedUploads.length > 0) {
      const errorMessage = `${failedUploads.length} files failed to upload`;
      onUploadError?.(errorMessage);
    }

    toast({
      title: 'Upload complete',
      description: `${successfulUploads.length}/${results.length} files uploaded successfully`,
      variant: failedUploads.length > 0 ? 'destructive' : 'default'
    });
  };

  const uploadSingleFile = async (file: FileWithProgress): Promise<UploadResult> => {
    const onProgress = (progress: number) => {
      setFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, progress } : f
      ));
    };

    if (file.size <= SERVER_LIMIT) {
      return performServerUpload(file, onProgress);
    } else {
      return performClientUpload(file, onProgress);
    }
  };

  const performServerUpload = async (
    file: FileWithProgress, 
    onProgress: (progress: number) => void
  ): Promise<UploadResult> => {
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
          onProgress(percentage);
        }
      };

      xhr.onload = async () => {
        try {
          const response = JSON.parse(xhr.responseText);
          
          if (xhr.status === 413) {
            const clientResult = await performClientUpload(file, onProgress);
            resolve(clientResult);
            return;
          }
          
          if (xhr.status !== 200) {
            throw new Error(response.error || 'Server upload failed');
          }

          resolve({
            success: true,
            uploadType: 'server',
            uploadId: response.data?.uploadId,
            blobUrl: response.data?.blobUrl,
            filename: file.name,
            size: file.size,
            file
          });
        } catch (err) {
          reject(err);
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      
      xhr.open('POST', '/api/upload-csv');
      xhr.send(formData);
    });
  };

  const performClientUpload = async (
    file: FileWithProgress,
    onProgress: (progress: number) => void
  ): Promise<UploadResult> => {
    // Get signed URL
    const prepResponse = await fetch('/api/blob/client-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        fileSize: file.size,
        fileType: file.type,
        userId,
        description
      })
    });

    if (!prepResponse.ok) {
      const error = await prepResponse.json();
      throw new Error(error.error || 'Failed to prepare client upload');
    }

    const prepResult = await prepResponse.json();
    
    // Upload directly to Blob
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentage = Math.round((event.loaded / event.total) * 100);
          onProgress(percentage);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 201) {
          resolve({
            success: true,
            uploadType: 'client',
            uploadId: prepResult.data.uploadId,
            blobUrl: prepResult.data.uploadUrl,
            filename: file.name,
            size: file.size,
            file
          });
        } else {
          reject(new Error('Client upload failed'));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during client upload'));
      
      xhr.open('PUT', prepResult.data.uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: FileWithProgress['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'uploading':
        return <Upload className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <File className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const clearAllFiles = () => {
    setFiles([]);
    setGlobalError(null);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop Zone */}
      <Card>
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              isDragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-primary/50',
              isUploading && 'pointer-events-none opacity-50'
            )}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            
            {isDragActive ? (
              <p className="text-lg font-medium text-primary">
                Drop files here...
              </p>
            ) : (
              <div>
                <p className="text-lg font-medium mb-2">
                  Drop files here or click to browse
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  {description || `Upload up to ${maxFiles} CSV files (max ${(maxSize / 1024 / 1024).toFixed(1)}MB each)`}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Badge variant="outline">CSV Files</Badge>
                  <Badge variant="outline">Max {(maxSize / 1024 / 1024).toFixed(1)}MB</Badge>
                  {maxFiles > 1 && (
                    <Badge variant="outline">Up to {maxFiles} files</Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Global Error */}
      {globalError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{globalError}</AlertDescription>
        </Alert>
      )}

      {/* File List */}
      {files.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">
                Files ({files.length})
              </h3>
              <div className="flex gap-2">
                {files.some(f => f.status === 'pending') && (
                  <Button
                    onClick={uploadFiles}
                    disabled={isUploading}
                    size="sm"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload All
                  </Button>
                )}
                <Button
                  onClick={clearAllFiles}
                  variant="outline"
                  size="sm"
                  disabled={isUploading}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear All
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {files.map(file => (
                <div key={file.id} className="border rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    {getStatusIcon(file.status)}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium truncate">{file.name}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(file.id)}
                          disabled={isUploading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span>{formatFileSize(file.size)}</span>
                        {file.size > SERVER_LIMIT && (
                          <Badge variant="secondary" className="text-xs">
                            Client Upload
                          </Badge>
                        )}
                        <Badge 
                          variant={
                            file.status === 'completed' ? 'default' :
                            file.status === 'failed' ? 'destructive' :
                            file.status === 'uploading' ? 'secondary' : 'outline'
                          }
                        >
                          {file.status}
                        </Badge>
                      </div>

                      {/* Progress Bar */}
                      {file.status === 'uploading' && (
                        <div className="mt-2">
                          <Progress value={file.progress} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1">
                            {file.progress}% uploaded
                          </p>
                        </div>
                      )}

                      {/* Error Message */}
                      {file.status === 'failed' && file.error && (
                        <p className="text-sm text-red-600 mt-1">
                          Error: {file.error}
                        </p>
                      )}

                      {/* Success Actions */}
                      {file.status === 'completed' && file.uploadResult?.blobUrl && (
                        <div className="flex gap-2 mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <a 
                              href={file.uploadResult.blobUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                              <Eye className="mr-1 h-3 w-3" />
                              View
                            </a>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <a 
                              href={file.uploadResult.blobUrl} 
                              download={file.name}
                            >
                              <Download className="mr-1 h-3 w-3" />
                              Download
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}