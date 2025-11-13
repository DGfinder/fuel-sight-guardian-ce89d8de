/**
 * CAPTIVE PAYMENTS IMPORT MODAL
 * 
 * Specialized import modal for captive payments CSV files
 * Features drag-and-drop, validation, preview, and batch import with rollback
 */

import React, { useState, useCallback } from 'react';
import { Upload, AlertTriangle, CheckCircle2, FileText, X, Download } from 'lucide-react';
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
import { 
  processCaptivePaymentsCsv, 
  validateProcessedData,
  type ProcessedCsvData 
} from '@/services/captivePaymentsCsvProcessor';
import { 
  insertCaptivePaymentBatch, 
  checkDuplicateImport 
} from '@/api/captivePayments';
import { cn } from '@/lib/utils';

interface CaptivePaymentsImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess: () => void;
}

type ImportStep = 'upload' | 'processing' | 'preview' | 'importing' | 'complete';

export default function CaptivePaymentsImportModal({ 
  open, 
  onOpenChange, 
  onImportSuccess 
}: CaptivePaymentsImportModalProps) {
  const { toast } = useToast();
  const { data: permissions } = useUserPermissions();
  
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedCsvData | null>(null);
  const [duplicateCheck, setDuplicateCheck] = useState<{
    duplicates: unknown[];
    conflicts: unknown[];
    summary: Record<string, unknown>;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message?: string;
    stats?: Record<string, unknown>;
    errors?: string[];
  } | null>(null);

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

    // Validate filename pattern
    if (!file.name.match(/Captive Payments - (GSFS?|SMB)/i)) {
      toast({
        title: 'Invalid Filename Format',
        description: 'Filename must match pattern: "Captive Payments - [SMB|GSF] - [Period]..."',
        variant: 'destructive'
      });
      return;
    }

    setSelectedFile(file);
    setCurrentStep('processing');
    setIsProcessing(true);
    setProcessingProgress(0);

    try {
      // Check for duplicates
      setProcessingProgress(20);
      const duplicateResult = await checkDuplicateImport(file.name);
      setDuplicateCheck(duplicateResult);

      // Process CSV
      setProcessingProgress(40);
      const userId = permissions?.isAdmin ? 'admin' : 'unknown';
      const result = await processCaptivePaymentsCsv(file, userId);
      
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
  }, [permissions, toast]);

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

    // Final validation
    const validation = validateProcessedData(processedData);
    if (!validation.isValid) {
      toast({
        title: 'Validation Failed',
        description: `Cannot import: ${validation.errors.join(', ')}`,
        variant: 'destructive'
      });
      return;
    }

    setCurrentStep('importing');
    setIsProcessing(true);

    try {
      const result = await insertCaptivePaymentBatch(
        processedData.records,
        {
          import_batch_id: processedData.metadata.import_batch_id,
          source_file: selectedFile.name,
          created_by: permissions?.isAdmin ? 'admin' : 'unknown'
        }
      );

      setImportResult(result);
      setCurrentStep('complete');
      
      toast({
        title: 'Import Successful',
        description: `Successfully imported ${result.insertedCount} records`
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
    setDuplicateCheck(null);
    setImportResult(null);
    onOpenChange(false);
  };

  const exportPreview = () => {
    if (!processedData) return;
    
    const csvContent = [
      // Headers
      'bill_of_lading,delivery_date,terminal,customer,product,volume_litres,carrier',
      // Data rows (first 10)
      ...processedData.records.slice(0, 10).map(record => 
        `${record.bill_of_lading},${record.delivery_date},${record.terminal},${record.customer},${record.product},${record.volume_litres},${record.carrier}`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `preview-${selectedFile?.name || 'data'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-white max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import Captive Payments Data
          </DialogTitle>
          <DialogDescription>
            Upload SMB or GSF carrier CSV files with automatic processing and validation
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
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300 hover:border-gray-400"
                )}
              >
                <input {...getInputProps()} />
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {isDragActive ? 'Drop the CSV file here' : 'Upload Captive Payments CSV'}
                </h3>
                <p className="text-gray-600 mb-4">
                  Drag and drop your file here, or click to browse
                </p>
                <p className="text-sm text-gray-500">
                  Supports: SMB and GSF formats • Expected pattern: "Captive Payments - [SMB|GSF] - [Period]..."
                </p>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>File Format Requirements:</strong>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>• Headers: Date, Bill of Lading, Location, Customer, Product, Volume</li>
                    <li>• Date format: DD.MM.YYYY (will be converted to YYYY-MM-DD)</li>
                    <li>• Volume: Numbers with commas (negatives preserved, zeros become 0.1)</li>
                    <li>• Filename must contain carrier identifier (SMB or GSF/GSFS)</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Processing Step */}
          {currentStep === 'processing' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-medium mb-2">Processing CSV File</h3>
              <p className="text-gray-600 mb-4">
                Parsing data, validating records, and checking for duplicates...
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
                    <div className="text-gray-500">Carrier</div>
                    <Badge variant="outline" className={
                      processedData.metadata.carrier === 'GSF' 
                        ? 'text-green-600 border-green-200' 
                        : 'text-blue-600 border-blue-200'
                    }>
                      {processedData.metadata.carrier}
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

              {/* Duplicate Warning */}
              {duplicateCheck?.exists && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Duplicate File Detected:</strong> This file was previously imported on {' '}
                    {new Date(duplicateCheck.existingImport.created_at).toLocaleDateString()} with {' '}
                    {duplicateCheck.existingImport.record_count} records. 
                    Importing again will create duplicate data.
                  </AlertDescription>
                </Alert>
              )}

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

              {processedData.metadata.warnings.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Warnings ({processedData.metadata.warnings.length}):</strong>
                    <ul className="mt-2 space-y-1">
                      {processedData.metadata.warnings.slice(0, 3).map((warning, i) => (
                        <li key={i} className="text-sm">• {warning}</li>
                      ))}
                      {processedData.metadata.warnings.length > 3 && (
                        <li className="text-sm">• ...and {processedData.metadata.warnings.length - 3} more</li>
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
                    <TabsTrigger value="transformed">Transformed Data</TabsTrigger>
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
                          <TableHead>Date</TableHead>
                          <TableHead>Bill of Lading</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Volume</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processedData.preview.originalSample.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{row.Date}</TableCell>
                            <TableCell className="font-mono text-xs">{row['Bill of Lading']}</TableCell>
                            <TableCell className="text-xs">{row.Location}</TableCell>
                            <TableCell className="text-xs">{row.Customer}</TableCell>
                            <TableCell className="text-xs">{row.Product}</TableCell>
                            <TableCell className="font-mono text-xs">{row.Volume}</TableCell>
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
                          <TableHead>Delivery Date</TableHead>
                          <TableHead>Bill of Lading</TableHead>
                          <TableHead>Terminal</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Volume (L)</TableHead>
                          <TableHead>Carrier</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processedData.preview.transformedSample.map((record, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{record.delivery_date}</TableCell>
                            <TableCell className="font-mono text-xs">{record.bill_of_lading}</TableCell>
                            <TableCell className="text-xs">{record.terminal}</TableCell>
                            <TableCell className="text-xs">{record.customer}</TableCell>
                            <TableCell className="text-xs">{record.product}</TableCell>
                            <TableCell className="font-mono text-xs">{record.volume_litres.toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={
                                record.carrier === 'GSF' 
                                  ? 'text-green-600 border-green-200' 
                                  : 'text-blue-600 border-blue-200'
                              }>
                                {record.carrier}
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-medium mb-2">Importing to Database</h3>
              <p className="text-gray-600">
                Saving {processedData?.metadata.validRows.toLocaleString()} records...
              </p>
            </div>
          )}

          {/* Complete Step */}
          {currentStep === 'complete' && importResult && (
            <div className="text-center py-8">
              <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Import Complete</h3>
              <p className="text-gray-600 mb-4">
                Successfully imported {importResult.insertedCount.toLocaleString()} records
              </p>
              <div className="bg-green-50 rounded-lg p-4 text-left max-w-md mx-auto">
                <h4 className="font-medium text-green-900 mb-2">Import Details</h4>
                <div className="space-y-1 text-sm text-green-800">
                  <div>Batch ID: {importResult.batchId}</div>
                  <div>File: {selectedFile?.name}</div>
                  <div>Records: {importResult.insertedCount.toLocaleString()}</div>
                  <div>Carrier: {processedData?.metadata.carrier}</div>
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
              className="bg-green-600 hover:bg-green-700"
            >
              Import {processedData?.metadata.validRows.toLocaleString()} Records
            </Button>
          )}
          
          {currentStep === 'complete' && (
            <Button onClick={handleClose} className="bg-blue-600 hover:bg-blue-700">
              Import Another File
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}