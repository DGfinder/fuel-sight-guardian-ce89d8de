import React, { useState, useCallback } from 'react';
import { Upload, AlertTriangle, CheckCircle2, FileText, Database, Clock, Users } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Z_INDEX } from '@/lib/z-index';

interface LytxEventPreview {
  event_id: string;
  driver_name: string;
  vehicle_registration?: string;
  event_datetime: string;
  trigger: string;
  status: 'New' | 'Face-To-Face' | 'FYI Notify' | 'Resolved';
  carrier: 'Stevemacs' | 'Great Southern Fuels';
  depot: string;
}

interface ImportResult {
  batchId: string;
  fileName: string;
  fileSize: number;
  rowCount: number;
  validRows: number;
  skippedRows: number;
  duplicateRows: number;
  previewData: LytxEventPreview[];
  carrier?: 'Stevemacs' | 'Great Southern Fuels';
  dateRange?: {
    start: string;
    end: string;
  };
  warnings: string[];
  errors: string[];
  recordsData: string;
}

interface LytxCsvImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: (result: { imported: number; duplicates: number; failed: number }) => void;
  userId: string;
}

export default function LytxCsvImportModal({ 
  open, 
  onOpenChange, 
  onImportComplete,
  userId 
}: LytxCsvImportModalProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [uploadResult, setUploadResult] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsUploading(true);
    setUploadResult(null);

    try {
      // Create form data for upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', userId);
      formData.append('fileName', file.name);

      // Upload and process CSV
      const response = await fetch('/api/lytx-csv-import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      setUploadResult(result.data);
      
      toast({
        title: 'CSV Processed Successfully',
        description: `${result.data.validRows} valid events found in ${result.data.fileName}`,
      });

    } catch (error) {
      console.error('Upload failed:', error);
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }, [userId, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/csv': ['.csv'],
      'text/plain': ['.csv'],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const handleImport = async () => {
    if (!uploadResult) return;

    setIsImporting(true);
    setImportProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      // Import to database
      const response = await fetch('/api/lytx-csv-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'process',
          userId,
          batchId: uploadResult.batchId,
          recordsData: uploadResult.recordsData,
        }),
      });

      const result = await response.json();
      clearInterval(progressInterval);
      setImportProgress(100);

      if (!result.success) {
        throw new Error(result.error || 'Import failed');
      }

      const importData = result.data;
      
      toast({
        title: 'Import Completed',
        description: `${importData.imported} events imported, ${importData.duplicates} duplicates skipped`,
      });

      onImportComplete({
        imported: importData.imported,
        duplicates: importData.duplicates,
        failed: importData.failed,
      });

      // Close modal after successful import
      onOpenChange(false);

    } catch (error) {
      console.error('Import failed:', error);
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const handleReset = () => {
    setUploadResult(null);
    setImportProgress(0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'New': return 'bg-blue-500';
      case 'Face-To-Face': return 'bg-orange-500';
      case 'FYI Notify': return 'bg-yellow-500';
      case 'Resolved': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-6xl max-h-[90vh] overflow-y-auto", Z_INDEX.modal)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Import LYTX Safety Events
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file containing LYTX safety event data to import into the database.
          </DialogDescription>
        </DialogHeader>

        {!uploadResult ? (
          /* Upload Section */
          <div className="space-y-6">
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary hover:bg-primary/5",
                isUploading && "cursor-not-allowed opacity-50"
              )}
            >
              <input {...getInputProps()} disabled={isUploading} />
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              {isUploading ? (
                <div>
                  <p className="text-lg font-medium">Processing CSV file...</p>
                  <Progress className="w-64 mx-auto mt-4" value={undefined} />
                </div>
              ) : (
                <div>
                  <p className="text-lg font-medium">
                    {isDragActive ? "Drop the CSV file here" : "Drop your LYTX CSV file here"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    or <span className="text-primary font-medium">browse files</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-4">
                    Supports .csv files up to 50MB
                  </p>
                </div>
              )}
            </div>

            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                <strong>Expected CSV Format:</strong> Your CSV should contain columns for Event ID, 
                Driver Name, Vehicle, Date/Time, Event Type, Status, and other LYTX safety event fields.
                The system will automatically map columns based on common field names.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          /* Results Section */
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-card p-4 rounded-lg border">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">Total Rows</span>
                </div>
                <p className="text-2xl font-bold mt-1">{uploadResult.rowCount}</p>
              </div>
              
              <div className="bg-card p-4 rounded-lg border">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Valid Events</span>
                </div>
                <p className="text-2xl font-bold mt-1">{uploadResult.validRows}</p>
              </div>
              
              <div className="bg-card p-4 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium">Carrier</span>
                </div>
                <p className="text-sm font-bold mt-1">{uploadResult.carrier || 'Mixed'}</p>
              </div>

              <div className="bg-card p-4 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">Date Range</span>
                </div>
                <p className="text-xs font-bold mt-1">
                  {uploadResult.dateRange ? (
                    `${formatDate(uploadResult.dateRange.start)} - ${formatDate(uploadResult.dateRange.end)}`
                  ) : (
                    'N/A'
                  )}
                </p>
              </div>
            </div>

            {/* Warnings and Errors */}
            {(uploadResult.warnings.length > 0 || uploadResult.errors.length > 0) && (
              <div className="space-y-2">
                {uploadResult.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Errors:</strong>
                      <ul className="list-disc list-inside mt-1">
                        {uploadResult.errors.slice(0, 3).map((error, idx) => (
                          <li key={idx} className="text-sm">{error}</li>
                        ))}
                        {uploadResult.errors.length > 3 && (
                          <li className="text-sm">...and {uploadResult.errors.length - 3} more</li>
                        )}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {uploadResult.warnings.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Warnings:</strong>
                      <ul className="list-disc list-inside mt-1">
                        {uploadResult.warnings.slice(0, 2).map((warning, idx) => (
                          <li key={idx} className="text-sm">{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Preview Table */}
            {uploadResult.previewData.length > 0 && (
              <div>
                <h4 className="font-medium mb-3">Preview (First 5 Records)</h4>
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event ID</TableHead>
                        <TableHead>Driver</TableHead>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Date/Time</TableHead>
                        <TableHead>Trigger</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Depot</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uploadResult.previewData.map((event, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-sm">{event.event_id}</TableCell>
                          <TableCell>{event.driver_name}</TableCell>
                          <TableCell>{event.vehicle_registration || 'N/A'}</TableCell>
                          <TableCell className="text-sm">{formatDate(event.event_datetime)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{event.trigger}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("text-white", getStatusColor(event.status))}>
                              {event.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{event.depot}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Import Progress */}
            {isImporting && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Importing events to database...</span>
                  <span>{importProgress}%</span>
                </div>
                <Progress value={importProgress} />
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex justify-between">
          <div>
            {uploadResult && !isImporting && (
              <Button variant="outline" onClick={handleReset}>
                Upload Different File
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isUploading || isImporting}
            >
              Cancel
            </Button>
            
            {uploadResult && (
              <Button 
                onClick={handleImport}
                disabled={isImporting || uploadResult.validRows === 0}
                className="min-w-[120px]"
              >
                {isImporting ? (
                  <>
                    <Progress className="w-4 h-4 mr-2" value={importProgress} />
                    Importing...
                  </>
                ) : (
                  `Import ${uploadResult.validRows} Events`
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}