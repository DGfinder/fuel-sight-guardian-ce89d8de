import React, { useState, useCallback } from 'react';
import { Upload, AlertTriangle, CheckCircle2, Download, FileText } from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Z_INDEX } from '@/lib/z-index';

interface AgbotCSVRow {
  tenancy: string;
  locationId: string;
  locationLevel: number;
  dailyConsumption: number;
  daysRemaining: number;
  lastSeen: string;
  streetAddress: string;
  suburb: string;
  state: string;
  locationStatus: string;
  assetSerialNumber: string;
  assetProfile: string;
  assetCreatedDate: string;
  assetDisabled: string;
  assetLastSeen: string;
  rawTelemetries: string;
  depth: string;
  pressure: string;
  calibratedTelemetries: string;
  deviceSerialNumber: string;
  deviceModel: string;
  deviceSku: string;
  deviceId: string;
  deviceHelmet: string;
  deviceSubscription: string;
  deviceStatus: string;
  deviceOnline: string;
  deviceLastSeen: string;
  deviceActivation: string;
  rowIndex: number;
  error?: string;
}

interface AgbotCSVImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (validData: AgbotCSVRow[]) => void;
}

export default function AgbotCSVImportModal({ open, onOpenChange, onImport }: AgbotCSVImportModalProps) {
  const { toast } = useToast();
  const [csvData, setCsvData] = useState<AgbotCSVRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validRows, setValidRows] = useState<AgbotCSVRow[]>([]);
  const [invalidRows, setInvalidRows] = useState<AgbotCSVRow[]>([]);

  // Robust CSV parser that handles quoted fields with commas
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator outside quotes
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add the last field
    result.push(current.trim());
    return result;
  };

  const parseCSV = useCallback((text: string): AgbotCSVRow[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }

    const headers = parseCSVLine(lines[0]);
    
    // Expected headers from Athara Dashboard CSV
    const expectedHeaders = [
      'Tenancy',
      'Location: ID', 
      'Location: Level',
      'Location: Daily Consumption',
      'Location: Days Remaining',
      'Location: Last Seen',
      'Location: Street Address',
      'Location: Suburb', 
      'Location: State',
      'Location: Status',
      'Asset: Serial Number',
      'Asset: Asset Profile',
      'Asset: Created Date',
      'Asset: Disable Asset',
      'Asset: Last Seen',
      'Asset: Raw Telemetries',
      'Asset: Depth',
      'Asset: Pressure',
      'Asset: Calibrated Telemetries',
      'Device: Serial Number',
      'Device: Model',
      'Device: SKU',
      'Device: ID',
      'Device: Helmet',
      'Device: Subscription',
      'Device: Status',
      'Device: Online',
      'Device: Last Seen',
      'Device: Activation'
    ];

    // Check if this looks like an Athara dashboard export
    const hasAtharaHeaders = expectedHeaders.some(header => 
      headers.some(h => h.toLowerCase().includes(header.toLowerCase().split(':')[0]))
    );
    
    if (!hasAtharaHeaders) {
      throw new Error('This does not appear to be an Athara Dashboard CSV export. Please ensure you have the correct file.');
    }

    const rows: AgbotCSVRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length < 10) { // At least some basic columns
        continue; // Skip malformed rows
      }

      // Map CSV columns to our interface (based on actual Athara CSV structure)
      const row: AgbotCSVRow = {
        tenancy: values[0] || '',
        locationId: values[1] || '',
        locationLevel: parseFloat(values[2]) || 0,
        dailyConsumption: parseFloat(values[3]) || 0,
        daysRemaining: parseFloat(values[4]) || 0,
        lastSeen: values[5] || '',
        streetAddress: values[6] || '',
        suburb: values[7] || '',
        state: values[8] || '',
        locationStatus: values[9] || '',
        assetSerialNumber: values[10] || '',
        assetProfile: values[11] || '',
        assetCreatedDate: values[12] || '',
        assetDisabled: values[13] || 'no',
        assetLastSeen: values[14] || '',
        rawTelemetries: values[15] || '',
        depth: values[16] || '',
        pressure: values[17] || '',
        calibratedTelemetries: values[18] || '',
        deviceSerialNumber: values[19] || '',
        deviceModel: values[20] || '',
        deviceSku: values[21] || '',
        deviceId: values[22] || '',
        deviceHelmet: values[23] || '',
        deviceSubscription: values[24] || '',
        deviceStatus: values[25] || '',
        deviceOnline: values[26] || 'no',
        deviceLastSeen: values[27] || '',
        deviceActivation: values[28] || '',
        rowIndex: i,
      };

      rows.push(row);
    }

    return rows;
  }, []);

  const validateCSVData = (data: AgbotCSVRow[]): { valid: AgbotCSVRow[]; invalid: AgbotCSVRow[] } => {
    const valid: AgbotCSVRow[] = [];
    const invalid: AgbotCSVRow[] = [];

    data.forEach(row => {
      const errors: string[] = [];

      // Required fields validation
      if (!row.locationId || row.locationId.trim() === '') {
        errors.push('Location ID is required');
      }

      if (!row.assetSerialNumber || row.assetSerialNumber.trim() === '') {
        errors.push('Asset Serial Number is required');
      }

      if (!row.deviceSerialNumber || row.deviceSerialNumber.trim() === '') {
        errors.push('Device Serial Number is required');
      }

      // Validate numeric fields
      if (isNaN(row.locationLevel) || row.locationLevel < 0) {
        errors.push('Invalid location level');
      }

      // Validate status fields
      const validStatuses = ['installed', 'active', 'inactive', 'maintenance'];
      if (row.locationStatus && !validStatuses.some(status => 
        row.locationStatus.toLowerCase().includes(status))) {
        // This is a warning, not an error
      }

      if (errors.length > 0) {
        invalid.push({ ...row, error: errors.join(', ') });
      } else {
        valid.push(row);
      }
    });

    return { valid, invalid };
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a CSV file',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const text = await file.text();
      const parsedData = parseCSV(text);
      const { valid, invalid } = validateCSVData(parsedData);

      setCsvData(parsedData);
      setValidRows(valid);
      setInvalidRows(invalid);

      toast({
        title: 'Athara CSV parsed successfully',
        description: `${valid.length} valid Agbot records, ${invalid.length} invalid records`,
      });
    } catch (error) {
      toast({
        title: 'Error parsing CSV',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [toast, parseCSV]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
  });

  const handleImport = () => {
    onImport(validRows);
    onOpenChange(false);
  };

  const generateTemplate = () => {
    const headers = [
      'Tenancy',
      'Location: ID', 
      'Location: Level',
      'Location: Daily Consumption',
      'Location: Days Remaining',
      'Location: Last Seen',
      'Location: Street Address',
      'Location: Suburb', 
      'Location: State',
      'Location: Status',
      'Asset: Serial Number',
      'Asset: Asset Profile',
      'Asset: Created Date',
      'Asset: Disable Asset',
      'Asset: Last Seen',
      'Asset: Raw Telemetries',
      'Asset: Depth',
      'Asset: Pressure',
      'Asset: Calibrated Telemetries',
      'Device: Serial Number',
      'Device: Model',
      'Device: SKU',
      'Device: ID',
      'Device: Helmet',
      'Device: Subscription',
      'Device: Status',
      'Device: Online',
      'Device: Last Seen',
      'Device: Activation'
    ];

    const sampleRow = [
      'Great Southern Fuel Supplies',
      'Sample Tank Location',
      '75.5',
      '150.0',
      '30',
      '25/07/2025, 12:00:00 pm',
      'Sample Address',
      'Sample Suburb',
      'WA',
      'Installed',
      'ASSET123456',
      'Sample Tank Profile',
      '01/01/2025, 10:00:00 am',
      'no',
      '25/07/2025, 11:30:00 am',
      '75.5',
      '2.5',
      '1.8',
      '75.5',
      'DEV123456',
      'Agbot Cellular 43111',
      '43111',
      '867280067150730',
      '',
      'SUBSCRIPTION123',
      'Active',
      'yes',
      '25/07/2025, 11:30:00 am',
      '01/01/2025, 10:00:00 am'
    ];

    const csv = [headers, sampleRow].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'athara-dashboard-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" style={{ zIndex: Z_INDEX.NESTED_MODAL_CONTENT }}>
        <DialogHeader>
          <DialogTitle>Import Agbot Data from Athara Dashboard CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file exported from the Athara Dashboard. This will populate locations, assets, and device data.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* Template Download */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="font-medium">Need a template? Download the expected format</span>
            </div>
            <Button variant="outline" size="sm" onClick={generateTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </div>

          {/* File Drop Zone */}
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
              csvData.length > 0 && 'border-green-500 bg-green-50'
            )}
          >
            <input {...getInputProps()} />
            <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
            {isProcessing ? (
              <div className="space-y-2">
                <p>Processing Athara CSV file...</p>
                <Progress value={50} className="w-32 mx-auto" />
              </div>
            ) : csvData.length > 0 ? (
              <div className="space-y-2">
                <CheckCircle2 className="h-8 w-8 mx-auto text-green-600" />
                <p className="text-green-600 font-medium">Athara CSV loaded successfully</p>
                <p className="text-sm text-muted-foreground">
                  {validRows.length} valid Agbot records, {invalidRows.length} errors
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-lg font-medium">
                  {isDragActive ? 'Drop your Athara Dashboard CSV here' : 'Drag and drop Athara Dashboard CSV here'}
                </p>
                <p className="text-sm text-muted-foreground">or click to browse</p>
              </div>
            )}
          </div>

          {/* Results Summary */}
          {csvData.length > 0 && (
            <div className="flex gap-4">
              <Badge variant="outline" className="gap-1 text-green-700">
                <CheckCircle2 className="h-3 w-3" />
                {validRows.length} Valid
              </Badge>
              {invalidRows.length > 0 && (
                <Badge variant="outline" className="gap-1 text-red-700">
                  <AlertTriangle className="h-3 w-3" />
                  {invalidRows.length} Errors
                </Badge>
              )}
            </div>
          )}

          {/* Preview Table */}
          {csvData.length > 0 && (
            <div className="flex-1 overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Asset</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>Online</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvData.slice(0, 50).map((row, index) => {
                    const isValid = validRows.includes(row);
                    return (
                      <TableRow key={index} className={cn(
                        isValid ? 'bg-green-50' : 'bg-red-50'
                      )}>
                        <TableCell>
                          {isValid ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{row.locationId}</div>
                            <div className="text-xs text-muted-foreground">{row.streetAddress}</div>
                          </div>
                        </TableCell>
                        <TableCell>{row.locationLevel}%</TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <div>{row.assetSerialNumber}</div>
                            <div className="text-muted-foreground">{row.assetProfile}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <div>{row.deviceSerialNumber}</div>
                            <div className="text-muted-foreground">{row.deviceModel}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.deviceOnline.toLowerCase() === 'yes' ? 'default' : 'secondary'}>
                            {row.deviceOnline.toLowerCase() === 'yes' ? 'Online' : 'Offline'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-red-600 text-sm">{row.error}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {csvData.length > 50 && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Showing first 50 rows of {csvData.length} total
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={validRows.length === 0}
          >
            Import {validRows.length} Agbot Records
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { AgbotCSVRow };