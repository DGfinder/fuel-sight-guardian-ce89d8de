/**
 * GUARDIAN EVENTS IMPORT MODAL
 * 
 * Specialized import modal for Guardian events CSV files
 * Features drag-and-drop, validation, preview, and batch import
 */

import React, { useState, useCallback } from 'react';
import { Upload, AlertTriangle, CheckCircle2, FileText, X, Download, Shield } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { cn } from '@/lib/utils';
import { GuardianSupabaseService } from '../services/GuardianSupabaseService';

interface GuardianEventsImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess: () => void;
}

type ImportStep = 'upload' | 'processing' | 'preview' | 'importing' | 'complete';

interface GuardianEvent {
  event_id: string;
  vehicle_id: string;
  vehicle: string;
  driver: string;
  detection_time: string;
  event_type: string;
  confirmation: string;
  classification: string;
  fleet: string;
}

interface ProcessedCsvData {
  records: GuardianEvent[];
  metadata: {
    validRows: number;
    skippedRows: number;
    errors: string[];
    warnings: string[];
    import_batch_id: string;
    fleet: string;
    period: string;
  };
  preview: {
    originalSample: any[];
    transformedSample: GuardianEvent[];
  };
}

export default function GuardianEventsImportModal({ 
  open, 
  onOpenChange, 
  onImportSuccess 
}: GuardianEventsImportModalProps) {
  const { toast } = useToast();
  const { data: permissions } = useUserPermissions();
  
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedCsvData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message?: string;
    stats?: Record<string, unknown>;
    errors?: string[];
  } | null>(null);

  const processGuardianCsv = async (file: File): Promise<ProcessedCsvData> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n');
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          
          // Expected headers for Guardian events
          const expectedHeaders = ['event_id', 'vehicle_id', 'vehicle', 'driver', 'detection_time', 'event_type', 'confirmation', 'classification', 'fleet'];
          const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
          
          if (missingHeaders.length > 0) {
            reject(new Error(`Missing required headers: ${missingHeaders.join(', ')}`));
            return;
          }

          const records: GuardianEvent[] = [];
          const errors: string[] = [];
          const warnings: string[] = [];
          let validRows = 0;
          let skippedRows = 0;

          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            try {
              const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
              const record: GuardianEvent = {
                event_id: values[headers.indexOf('event_id')] || '',
                vehicle_id: values[headers.indexOf('vehicle_id')] || '',
                vehicle: values[headers.indexOf('vehicle')] || '',
                driver: values[headers.indexOf('driver')] || '',
                detection_time: values[headers.indexOf('detection_time')] || '',
                event_type: values[headers.indexOf('event_type')] || '',
                confirmation: values[headers.indexOf('confirmation')] || '',
                classification: values[headers.indexOf('classification')] || '',
                fleet: values[headers.indexOf('fleet')] || ''
              };

              // Basic validation
              if (!record.event_id || !record.vehicle || !record.detection_time) {
                errors.push(`Row ${i + 1}: Missing required fields (event_id, vehicle, detection_time)`);
                skippedRows++;
                continue;
              }

              records.push(record);
              validRows++;
            } catch (error) {
              errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Parse error'}`);
              skippedRows++;
            }
          }

          const fleetName = records[0]?.fleet || 'Unknown Fleet';
          const importBatchId = `guardian_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          resolve({
            records,
            metadata: {
              validRows,
              skippedRows,
              errors,
              warnings,
              import_batch_id: importBatchId,
              fleet: fleetName,
              period: new Date().toISOString().split('T')[0]
            },
            preview: {
              originalSample: lines.slice(1, 6).map(line => {
                const values = line.split(',');
                const obj: any = {};
                headers.forEach((header, index) => {
                  obj[header] = values[index]?.replace(/"/g, '') || '';
                });
                return obj;
              }),
              transformedSample: records.slice(0, 5)
            }
          });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: 'Invalid File Type',
        description: 'Please select a CSV file.',
        variant: 'destructive'
      });
      return;
    }

    // Validate filename pattern for Guardian events
    if (!file.name.match(/events?[-_].*\.csv$/i)) {
      toast({
        title: 'Invalid Filename Format',
        description: 'Filename should contain "events" (e.g., "events-2025-08-07T10_05_51.csv")',
        variant: 'destructive'
      });
      return;
    }

    setSelectedFile(file);
    setCurrentStep('processing');
    setIsProcessing(true);
    setProcessingProgress(0);

    try {
      setProcessingProgress(30);
      const result = await processGuardianCsv(file);
      
      setProcessingProgress(80);
      setProcessedData(result);
      
      setProcessingProgress(100);
      setCurrentStep('preview');
      
    } catch (error) {
      console.error('Processing error:', error);
      toast({
        title: 'Processing Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive'
      });
      setCurrentStep('upload');
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv']
    },
    multiple: false,
    disabled: currentStep !== 'upload'
  });

  const handleImport = async () => {
    if (!processedData || !selectedFile) return;

    setCurrentStep('importing');
    setIsProcessing(true);

    try {
      const guardianService = new GuardianSupabaseService();
      
      const result = await guardianService.processGuardianCsvImport(
        processedData.records,
        {
          import_batch_id: processedData.metadata.import_batch_id,
          source_file: selectedFile.name,
          fleet: processedData.metadata.fleet,
          created_by: permissions?.user?.email || 'unknown'
        }
      );

      setImportResult({
        success: result.success,
        insertedCount: result.insertedCount,
        batchId: result.batchId,
        errors: result.errors
      });
      
      setCurrentStep('complete');
      
      toast({
        title: 'Import Successful',
        description: `Successfully imported ${result.insertedCount} Guardian events`
      });

      onImportSuccess();

    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive'
      });
      setCurrentStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setCurrentStep('upload');
    setSelectedFile(null);
    setProcessedData(null);
    setImportResult(null);
    onOpenChange(false);
  };

  const exportPreview = () => {
    if (!processedData) return;
    
    const csvContent = [
      'event_id,vehicle,driver,detection_time,event_type,confirmation,classification,fleet',
      ...processedData.records.slice(0, 10).map(record => 
        `${record.event_id},${record.vehicle},${record.driver},${record.detection_time},${record.event_type},${record.confirmation},${record.classification},${record.fleet}`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `preview-${selectedFile?.name || 'guardian-data'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-600" />
            Import Guardian Events Data
          </DialogTitle>
          <DialogDescription>
            Upload Guardian safety event CSV files with automatic processing and validation
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Upload Step */}
          {currentStep === 'upload' && (
            <div className="space-y-4">
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                  isDragActive
                    ? "border-purple-500 bg-purple-50"
                    : "border-gray-300 hover:border-gray-400"
                )}
              >
                <input {...getInputProps()} />
                <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {isDragActive ? 'Drop the CSV file here' : 'Upload Guardian Events CSV'}
                </h3>
                <p className="text-gray-600 mb-4">
                  Drag and drop your file here, or click to browse
                </p>
                <p className="text-sm text-gray-500">
                  Supports: Guardian event exports • Expected pattern: "events-YYYY-MM-DD..."
                </p>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>File Format Requirements:</strong>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>• Headers: event_id, vehicle_id, vehicle, driver, detection_time, event_type, confirmation, classification, fleet</li>
                    <li>• Date format: ISO 8601 (YYYY-MM-DDTHH:MM:SS)</li>
                    <li>• Event types: Distraction, Fatigue, Speeding, etc.</li>
                    <li>• Fleet: Stevemacs or Great Southern Fuels</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Processing Step */}
          {currentStep === 'processing' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-medium mb-2">Processing Guardian Events CSV</h3>
              <p className="text-gray-600 mb-4">
                Parsing safety events, validating records, and preparing import...
              </p>
              <Progress value={processingProgress} className="w-64 mx-auto" />
            </div>
          )}

          {/* Preview Step */}
          {currentStep === 'preview' && processedData && (
            <div className="space-y-6">
              {/* Metadata Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium mb-3">Import Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">Fleet</div>
                    <Badge variant="outline" className="text-purple-600 border-purple-200">
                      {processedData.metadata.fleet}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-gray-500">Period</div>
                    <div className="font-medium">{processedData.metadata.period}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Valid Records</div>
                    <div className="font-medium">{processedData.metadata.validRows.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Skipped</div>
                    <div className="font-medium">{processedData.metadata.skippedRows.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* Errors and Warnings */}
              {processedData.metadata.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Errors ({processedData.metadata.errors.length}):</strong>
                    <ul className="mt-2 space-y-1">
                      {processedData.metadata.errors.slice(0, 5).map((error, i) => (
                        <li key={i} className="text-sm">• {error}</li>
                      ))}
                      {processedData.metadata.errors.length > 5 && (
                        <li className="text-sm">• ...and {processedData.metadata.errors.length - 5} more</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Data Preview */}
              <Tabs defaultValue="transformed">
                <div className="flex justify-between items-center mb-4">
                  <TabsList>
                    <TabsTrigger value="original">Original Data</TabsTrigger>
                    <TabsTrigger value="transformed">Processed Data</TabsTrigger>
                  </TabsList>
                  <Button variant="outline" size="sm" onClick={exportPreview}>
                    <Download className="w-4 h-4 mr-2" />
                    Export Preview
                  </Button>
                </div>

                <TabsContent value="original">
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Event ID</TableHead>
                          <TableHead>Vehicle</TableHead>
                          <TableHead>Driver</TableHead>
                          <TableHead>Detection Time</TableHead>
                          <TableHead>Event Type</TableHead>
                          <TableHead>Fleet</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processedData.preview.originalSample.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{row.event_id}</TableCell>
                            <TableCell className="text-xs">{row.vehicle}</TableCell>
                            <TableCell className="text-xs">{row.driver}</TableCell>
                            <TableCell className="font-mono text-xs">{row.detection_time}</TableCell>
                            <TableCell className="text-xs">{row.event_type}</TableCell>
                            <TableCell className="text-xs">{row.fleet}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="transformed">
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Event ID</TableHead>
                          <TableHead>Vehicle</TableHead>
                          <TableHead>Driver</TableHead>
                          <TableHead>Event Type</TableHead>
                          <TableHead>Confirmation</TableHead>
                          <TableHead>Classification</TableHead>
                          <TableHead>Fleet</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processedData.preview.transformedSample.map((record, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{record.event_id}</TableCell>
                            <TableCell className="text-xs">{record.vehicle}</TableCell>
                            <TableCell className="text-xs">{record.driver}</TableCell>
                            <TableCell className="text-xs">{record.event_type}</TableCell>
                            <TableCell className="text-xs">{record.confirmation}</TableCell>
                            <TableCell className="text-xs">{record.classification}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-purple-600 border-purple-200">
                                {record.fleet}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Importing Step */}
          {currentStep === 'importing' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-medium mb-2">Importing to Database</h3>
              <p className="text-gray-600">
                Saving {processedData?.metadata.validRows.toLocaleString()} Guardian events...
              </p>
            </div>
          )}

          {/* Complete Step */}
          {currentStep === 'complete' && importResult && (
            <div className="text-center py-8">
              <CheckCircle2 className="w-16 h-16 text-purple-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Import Complete</h3>
              <p className="text-gray-600 mb-4">
                Successfully imported {importResult.insertedCount?.toLocaleString()} Guardian events
              </p>
              <div className="bg-purple-50 rounded-lg p-4 text-left max-w-md mx-auto">
                <h4 className="font-medium text-purple-900 mb-2">Import Details</h4>
                <div className="space-y-1 text-sm text-purple-800">
                  <div>Batch ID: {importResult.batchId}</div>
                  <div>File: {selectedFile?.name}</div>
                  <div>Records: {importResult.insertedCount?.toLocaleString()}</div>
                  <div>Fleet: {processedData?.metadata.fleet}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={handleClose}>
            {currentStep === 'complete' ? 'Close' : 'Cancel'}
          </Button>
          
          {currentStep === 'preview' && (
            <Button 
              onClick={handleImport}
              disabled={!processedData || processedData.metadata.errors.length > 0}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Import {processedData?.metadata.validRows.toLocaleString()} Events
            </Button>
          )}
          
          {currentStep === 'complete' && (
            <Button onClick={handleClose} className="bg-purple-600 hover:bg-purple-700">
              Import Another File
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}