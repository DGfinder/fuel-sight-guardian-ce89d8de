import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useUploadMyobData, useUploadBatches } from '../../hooks/useMyobAnalytics';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertCircle, 
  X,
  Download,
  History,
  Trash2,
  Eye
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

interface MyobUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  carrier: 'SMB' | 'GSF';
}

interface ProcessedDelivery {
  delivery_date: string;
  bill_of_lading: string;
  location: string;
  customer: string;
  product: string;
  volume_litres: number;
}

export function MyobUploadModal({ isOpen, onClose, carrier }: MyobUploadModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'processing' | 'complete'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ProcessedDelivery[]>([]);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const { data: permissions } = useUserPermissions();
  const { data: uploadHistory } = useUploadBatches(`myob_${carrier.toLowerCase()}`);
  const uploadMutation = useUploadMyobData();

  // Check permissions
  const canUpload = permissions?.isAdmin || permissions?.role === 'manager';

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setFile(file);
    setProcessingError(null);
    
    // Process file and generate preview
    processFile(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const processFile = async (file: File) => {
    try {
      setUploadProgress(10);
      
      let data: any[][] = [];
      
      if (file.name.endsWith('.csv')) {
        // Process CSV file
        const text = await file.text();
        const result = Papa.parse(text, { header: false });
        data = result.data as any[][];
      } else {
        // Process Excel file
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      }

      setUploadProgress(50);

      // Expected format: Date, Bill of Lading, Location, Customer, Product, Volume
      if (data.length === 0) {
        throw new Error('File appears to be empty');
      }

      // Skip header row and process data
      const processedData: ProcessedDelivery[] = [];
      const dataRows = data.slice(1); // Skip header
      
      for (const row of dataRows) {
        // Skip empty rows
        if (!row || row.length === 0 || !row[0]) continue;
        
        try {
          const delivery: ProcessedDelivery = {
            delivery_date: parseDate(row[0]),
            bill_of_lading: String(row[1] || ''),
            location: String(row[2] || ''),
            customer: String(row[3] || ''),
            product: String(row[4] || ''),
            volume_litres: parseVolume(row[5])
          };
          
          // Validate required fields
          if (!delivery.delivery_date) {
            console.warn('Skipping row with invalid date:', row);
            continue;
          }
          
          processedData.push(delivery);
        } catch (error) {
          console.warn('Error processing row:', row, error);
        }
      }

      if (processedData.length === 0) {
        throw new Error('No valid delivery records found in file');
      }

      setPreviewData(processedData);
      setUploadProgress(100);
      setStep('preview');
      
    } catch (error) {
      setProcessingError(error instanceof Error ? error.message : 'Failed to process file');
      setUploadProgress(0);
    }
  };

  const handleUpload = async () => {
    if (!file || !permissions?.isAdmin) return;
    
    setStep('processing');
    setUploadProgress(0);
    
    try {
      const result = await uploadMutation.mutateAsync({
        carrier,
        deliveries: previewData,
        filename: file.name,
        uploadedBy: permissions.role || 'unknown'
      });
      
      setUploadProgress(100);
      setStep('complete');
      
    } catch (error) {
      setProcessingError(error instanceof Error ? error.message : 'Upload failed');
      setStep('preview');
    }
  };

  const resetUpload = () => {
    setStep('upload');
    setFile(null);
    setPreviewData([]);
    setProcessingError(null);
    setUploadProgress(0);
  };

  const parseDate = (dateValue: any): string => {
    if (!dateValue) return '';
    
    // Handle Excel date serial numbers
    if (typeof dateValue === 'number') {
      const date = new Date((dateValue - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    
    // Handle string dates
    const dateStr = String(dateValue);
    
    // Try different date formats
    const formats = [
      /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/, // MM/DD/YYYY or DD/MM/YYYY
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/, // YYYY-MM-DD
    ];
    
    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        const [, a, b, c] = match;
        
        // Assume DD/MM/YYYY format for your Australian data
        if (format === formats[0]) {
          const day = parseInt(a);
          const month = parseInt(b);
          let year = parseInt(c);
          
          // Handle 2-digit years
          if (year < 100) {
            year += year < 50 ? 2000 : 1900;
          }
          
          const date = new Date(year, month - 1, day);
          return date.toISOString().split('T')[0];
        }
        
        // YYYY-MM-DD format
        if (format === formats[1]) {
          const date = new Date(parseInt(a), parseInt(b) - 1, parseInt(c));
          return date.toISOString().split('T')[0];
        }
      }
    }
    
    // Fallback: try to parse as-is
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch {
      // Ignore
    }
    
    return '';
  };

  const parseVolume = (volumeValue: any): number => {
    if (volumeValue === null || volumeValue === undefined || volumeValue === '') {
      return 0;
    }
    
    // Convert to string and remove commas
    const volumeStr = String(volumeValue).replace(/,/g, '');
    
    // Handle negative values (adjustments)
    const isNegative = volumeStr.includes('-');
    const cleanValue = volumeStr.replace('-', '');
    
    const volume = parseFloat(cleanValue);
    return isNaN(volume) ? 0 : (isNegative ? -volume : volume);
  };

  if (!canUpload) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Access Denied</DialogTitle>
          </DialogHeader>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You don't have permission to upload MYOB data.
            </AlertDescription>
          </Alert>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Upload MYOB Data - {carrier === 'SMB' ? 'Stevemacs Bulk Fuel' : 'Great Southern Fuels'}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="upload" className="space-y-4">
          <TabsList>
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="history">Upload History</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            {step === 'upload' && (
              <div className="space-y-4">
                {/* File Upload Area */}
                <div
                  {...getRootProps()}
                  className={`
                    border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                    ${isDragActive 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 hover:border-gray-400'
                    }
                  `}
                >
                  <input {...getInputProps()} />
                  <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  {isDragActive ? (
                    <p className="text-blue-600 font-medium">Drop the file here...</p>
                  ) : (
                    <div>
                      <p className="text-gray-600 font-medium mb-2">
                        Drag & drop MYOB file here, or click to select
                      </p>
                      <p className="text-sm text-gray-500">
                        Supports Excel (.xlsx, .xls) and CSV files up to 50MB
                      </p>
                    </div>
                  )}
                </div>

                {/* Expected Format */}
                <Alert>
                  <FileSpreadsheet className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Expected format:</strong> Date, Bill of Lading, Location, Customer, Product, Volume
                    <br />
                    <small>The system will automatically detect duplicates from previous uploads.</small>
                  </AlertDescription>
                </Alert>

                {processingError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{processingError}</AlertDescription>
                  </Alert>
                )}

                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Processing file...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} />
                  </div>
                )}
              </div>
            )}

            {step === 'preview' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Preview Data</h3>
                    <p className="text-sm text-muted-foreground">
                      Found {previewData.length} delivery records in {file?.name}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={resetUpload}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button onClick={handleUpload} disabled={uploadMutation.isPending}>
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadMutation.isPending ? 'Uploading...' : 'Upload Data'}
                    </Button>
                  </div>
                </div>

                {/* Data Preview Table */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left">Date</th>
                          <th className="px-4 py-2 text-left">Bill of Lading</th>
                          <th className="px-4 py-2 text-left">Customer</th>
                          <th className="px-4 py-2 text-left">Product</th>
                          <th className="px-4 py-2 text-right">Volume (L)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.slice(0, 50).map((delivery, index) => (
                          <tr key={index} className="border-t">
                            <td className="px-4 py-2">{delivery.delivery_date}</td>
                            <td className="px-4 py-2">{delivery.bill_of_lading}</td>
                            <td className="px-4 py-2">{delivery.customer}</td>
                            <td className="px-4 py-2">{delivery.product}</td>
                            <td className={`px-4 py-2 text-right font-mono ${
                              delivery.volume_litres < 0 ? 'text-red-600' : ''
                            }`}>
                              {delivery.volume_litres.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {previewData.length > 50 && (
                    <div className="px-4 py-2 bg-gray-50 text-sm text-muted-foreground">
                      Showing first 50 of {previewData.length} records
                    </div>
                  )}
                </div>

                {processingError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{processingError}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {step === 'processing' && (
              <div className="text-center space-y-4 py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <div>
                  <h3 className="text-lg font-medium">Processing Upload</h3>
                  <p className="text-sm text-muted-foreground">
                    Importing {previewData.length} delivery records...
                  </p>
                </div>
                <Progress value={uploadProgress} className="max-w-md mx-auto" />
              </div>
            )}

            {step === 'complete' && (
              <div className="text-center space-y-4 py-8">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                <div>
                  <h3 className="text-lg font-medium text-green-600">Upload Complete</h3>
                  <p className="text-sm text-muted-foreground">
                    Successfully processed {uploadMutation.data?.records_processed} records
                    {uploadMutation.data?.duplicates_found ? 
                      ` (${uploadMutation.data.duplicates_found} duplicates skipped)` : ''
                    }
                  </p>
                </div>
                <div className="flex justify-center gap-2">
                  <Button variant="outline" onClick={resetUpload}>
                    Upload Another File
                  </Button>
                  <Button onClick={onClose}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div>
              <h3 className="text-lg font-medium mb-4">Upload History</h3>
              <div className="space-y-2">
                {uploadHistory?.map((batch) => (
                  <div key={batch.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{batch.filename}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(batch.uploaded_at).toLocaleDateString()} • 
                        {batch.record_count} records • 
                        {batch.duplicate_count} duplicates
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        batch.upload_status === 'completed' ? 'default' :
                        batch.upload_status === 'error' ? 'destructive' : 'secondary'
                      }>
                        {batch.upload_status}
                      </Badge>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )) || (
                  <p className="text-center text-muted-foreground py-8">
                    No upload history found
                  </p>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}