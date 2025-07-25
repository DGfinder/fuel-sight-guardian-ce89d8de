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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { validateBulkReadings } from '@/hooks/useBulkDipEntry';
import { cn } from '@/lib/utils';
import { Z_INDEX } from '@/lib/z-index';

interface CSVRow {
  tankId: string;
  tankLocation: string;
  subgroup: string;
  safeLevel: number;
  currentLevel: number;
  newDipReading: string;
  rowIndex: number;
  error?: string;
}

interface CSVImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (validReadings: Array<{ tank_id: string; value: number }>) => void;
  tanks: Array<{
    id: string;
    location: string;
    subgroup?: string;
    safe_level: number;
    current_level: number;
  }>;
}

export default function CSVImportModal({ open, onOpenChange, onImport, tanks }: CSVImportModalProps) {
  const { toast } = useToast();
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validRows, setValidRows] = useState<CSVRow[]>([]);
  const [invalidRows, setInvalidRows] = useState<CSVRow[]>([]);

  const parseCSV = (text: string): CSVRow[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const expectedHeaders = ['subgroup', 'tank location', 'tank id', 'safe level', 'current level', 'new dip reading'];
    
    // Check if all expected headers are present
    const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
    }

    const rows: CSVRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length !== headers.length) {
        continue; // Skip malformed rows
      }

      const rowData: any = {};
      headers.forEach((header, index) => {
        rowData[header] = values[index];
      });

      rows.push({
        tankId: rowData['tank id'] || '',
        tankLocation: rowData['tank location'] || '',
        subgroup: rowData['subgroup'] || '',
        safeLevel: parseFloat(rowData['safe level']) || 0,
        currentLevel: parseFloat(rowData['current level']) || 0,
        newDipReading: rowData['new dip reading'] || '',
        rowIndex: i,
      });
    }

    return rows;
  };

  const validateCSVData = (data: CSVRow[]): { valid: CSVRow[]; invalid: CSVRow[] } => {
    const valid: CSVRow[] = [];
    const invalid: CSVRow[] = [];

    data.forEach(row => {
      const errors: string[] = [];

      // Check if tank exists
      const tank = tanks.find(t => t.id === row.tankId);
      if (!tank) {
        errors.push('Tank not found');
      }

      // Validate dip reading
      if (!row.newDipReading || isNaN(Number(row.newDipReading))) {
        errors.push('Invalid dip reading');
      } else {
        const dipValue = Number(row.newDipReading);
        if (dipValue < 0) {
          errors.push('Dip reading cannot be negative');
        } else if (tank && dipValue > tank.safe_level) {
          errors.push(`Exceeds safe level (${tank.safe_level}L)`);
        }
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
        title: 'CSV parsed successfully',
        description: `${valid.length} valid rows, ${invalid.length} invalid rows`,
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
  }, [tanks, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
  });

  const handleImport = () => {
    const readings = validRows.map(row => ({
      tank_id: row.tankId,
      value: Number(row.newDipReading),
    }));
    onImport(readings);
    onOpenChange(false);
  };

  const generateTemplate = () => {
    const headers = ['Subgroup', 'Tank Location', 'Tank ID', 'Safe Level', 'Current Level', 'New Dip Reading'];
    const rows = tanks.map(tank => [
      tank.subgroup || 'No Subgroup',
      tank.location,
      tank.id,
      tank.safe_level,
      tank.current_level,
      '', // Empty for new dip reading
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bulk-dip-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" style={{ zIndex: Z_INDEX.NESTED_MODAL_CONTENT }}>
        <DialogHeader>
          <DialogTitle>Import Dip Readings from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with dip readings. Download the template first to ensure correct format.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* Template Download */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="font-medium">First time? Download the template</span>
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
                <p>Processing CSV file...</p>
                <Progress value={50} className="w-32 mx-auto" />
              </div>
            ) : csvData.length > 0 ? (
              <div className="space-y-2">
                <CheckCircle2 className="h-8 w-8 mx-auto text-green-600" />
                <p className="text-green-600 font-medium">CSV loaded successfully</p>
                <p className="text-sm text-muted-foreground">
                  {validRows.length} valid entries, {invalidRows.length} errors
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-lg font-medium">
                  {isDragActive ? 'Drop your CSV file here' : 'Drag and drop a CSV file here'}
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
                    <TableHead>Tank</TableHead>
                    <TableHead>Subgroup</TableHead>
                    <TableHead>Dip Reading</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvData.slice(0, 100).map((row, index) => {
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
                            <div className="font-medium">{row.tankLocation}</div>
                            <div className="text-xs text-muted-foreground">{row.tankId}</div>
                          </div>
                        </TableCell>
                        <TableCell>{row.subgroup}</TableCell>
                        <TableCell>{row.newDipReading}L</TableCell>
                        <TableCell className="text-red-600 text-sm">{row.error}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {csvData.length > 100 && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Showing first 100 rows of {csvData.length} total
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
            Import {validRows.length} Readings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}