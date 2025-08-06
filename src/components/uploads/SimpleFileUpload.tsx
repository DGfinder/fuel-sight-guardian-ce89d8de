/**
 * SIMPLE FILE UPLOAD COMPONENT
 * 
 * Basic file upload component following Vercel Blob documentation example.
 * Handles both server uploads (<4.5MB) and client uploads (>4.5MB).
 */

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, File, CheckCircle, AlertCircle, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SimpleFileUploadProps {
  onUploadComplete?: (result: UploadResult) => void;
  onUploadError?: (error: string) => void;
  userId: string;
  acceptedTypes?: string[];
  maxSize?: number;
  description?: string;
  className?: string;
}

interface UploadResult {
  success: boolean;
  uploadId?: string;
  blobUrl?: string;
  filename?: string;
  size?: number;
  uploadType: 'server' | 'client';
  error?: string;
}

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

const SERVER_LIMIT = 4.5 * 1024 * 1024; // 4.5MB
const DEFAULT_MAX_SIZE = 500 * 1024 * 1024; // 500MB
const DEFAULT_ACCEPTED_TYPES = ['text/csv', 'application/csv'];

export function SimpleFileUpload({
  onUploadComplete,
  onUploadError,
  userId,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  maxSize = DEFAULT_MAX_SIZE,
  description,
  className = ''
}: SimpleFileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setError(null);
    setUploadResult(null);

    // Validate file type
    if (!acceptedTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.csv')) {
      const errorMsg = `Invalid file type. Accepted types: ${acceptedTypes.join(', ')}`;
      setError(errorMsg);
      return;
    }

    // Validate file size
    if (file.size > maxSize) {
      const errorMsg = `File too large. Maximum size: ${(maxSize / 1024 / 1024).toFixed(1)}MB`;
      setError(errorMsg);
      return;
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress({ loaded: 0, total: selectedFile.size, percentage: 0 });

    try {
      let result: UploadResult;

      if (selectedFile.size <= SERVER_LIMIT) {
        // Server upload for small files
        result = await performServerUpload(selectedFile);
      } else {
        // Client upload for large files
        result = await performClientUpload(selectedFile);
      }

      setUploadResult(result);
      
      if (result.success) {
        toast({
          title: 'Upload successful',
          description: `${selectedFile.name} uploaded successfully`
        });
        onUploadComplete?.(result);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      onUploadError?.(errorMessage);
      
      toast({
        title: 'Upload failed',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const performServerUpload = async (file: File): Promise<UploadResult> => {
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
          setUploadProgress({
            loaded: event.loaded,
            total: event.total,
            percentage
          });
        }
      };

      xhr.onload = async () => {
        try {
          const response = JSON.parse(xhr.responseText);
          
          if (xhr.status === 413) {
            // File too large for server upload, try client upload
            const clientResult = await performClientUpload(file);
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
            size: file.size
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

  const performClientUpload = async (file: File): Promise<UploadResult> => {
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
      })
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
          setUploadProgress({
            loaded: event.loaded,
            total: event.total,
            percentage
          });
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
            size: file.size
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

  const resetUpload = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setError(null);
    setUploadProgress(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          File Upload
        </CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* File Input */}
        <div className="space-y-2">
          <Label htmlFor="file-upload">Choose File</Label>
          <Input
            ref={fileInputRef}
            id="file-upload"
            type="file"
            accept={acceptedTypes.join(',')}
            onChange={handleFileSelect}
            disabled={isUploading}
            className="cursor-pointer"
          />
          <p className="text-xs text-muted-foreground">
            Maximum file size: {(maxSize / 1024 / 1024).toFixed(1)}MB
            {maxSize > SERVER_LIMIT && (
              <span> (Files &gt;4.5MB use direct upload)</span>
            )}
          </p>
        </div>

        {/* Selected File Info */}
        {selectedFile && (
          <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
            <File className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(selectedFile.size)}
                {selectedFile.size > SERVER_LIMIT && (
                  <span className="ml-2 text-blue-600">(Client Upload)</span>
                )}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetUpload}
              disabled={isUploading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Upload Progress */}
        {uploadProgress && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Uploading...</span>
              <span>{uploadProgress.percentage}%</span>
            </div>
            <Progress value={uploadProgress.percentage} />
            <p className="text-xs text-muted-foreground">
              {formatFileSize(uploadProgress.loaded)} / {formatFileSize(uploadProgress.total)}
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success Message */}
        {uploadResult?.success && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              File uploaded successfully via {uploadResult.uploadType} upload
              {uploadResult.blobUrl && (
                <a 
                  href={uploadResult.blobUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-2 underline"
                >
                  View File
                </a>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Upload Button */}
        <div className="flex gap-2">
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="flex-1"
          >
            {isUploading ? (
              <>
                <Upload className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload File
              </>
            )}
          </Button>
          
          {selectedFile && (
            <Button
              variant="outline"
              onClick={resetUpload}
              disabled={isUploading}
            >
              Clear
            </Button>
          )}
        </div>

        {/* Upload Method Info */}
        {selectedFile && (
          <div className="text-xs text-muted-foreground border-t pt-3">
            <p>
              <strong>Upload Method:</strong>{' '}
              {selectedFile.size > SERVER_LIMIT 
                ? 'Client-side upload (direct to Blob storage)' 
                : 'Server-side upload (through API)'
              }
            </p>
            {selectedFile.size > SERVER_LIMIT && (
              <p className="mt-1">
                Large files are uploaded directly to Vercel Blob storage for better performance.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}