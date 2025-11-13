import React, { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Database } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { parseMtDataExcel, validateMtDataExcel } from '@/utils/mtdataExcelParser';
import { useImportMtDataTrips } from '@/hooks/useRoutePatterns';

interface ImportResult {
  fileName: string;
  tripsParsed: number;
  tripsImported: number;
  errors: number;
  warnings: string[];
}

export default function RouteAnalysisUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState(0);

  const importMutation = useImportMtDataTrips();

  const handleFile = useCallback(async (file: File) => {
    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      '.xlsx',
      '.xls'
    ];

    const isValidType = validTypes.some(type =>
      file.type === type || file.name.toLowerCase().endsWith(type)
    );

    if (!isValidType) {
      setError('Please upload an Excel file (.xlsx or .xls)');
      return;
    }

    setError(null);
    setImportResult(null);
    setIsProcessing(true);
    setProgress(10);

    try {
      // Validate file format
      const validation = await validateMtDataExcel(file);
      if (!validation.valid) {
        setError(validation.message);
        setIsProcessing(false);
        return;
      }

      setProgress(30);

      // Parse Excel file
      const parseResult = await parseMtDataExcel(file);

      if (!parseResult.success || parseResult.trips.length === 0) {
        setError(
          parseResult.errors.length > 0
            ? parseResult.errors[0].message
            : 'No valid trip data found in Excel file'
        );
        setIsProcessing(false);
        return;
      }

      setProgress(60);

      // Import to database
      const importedTrips = await importMutation.mutateAsync(parseResult.trips);

      setProgress(100);

      // Show results
      setImportResult({
        fileName: file.name,
        tripsParsed: parseResult.rowsParsed,
        tripsImported: importedTrips.length,
        errors: parseResult.rowsSkipped,
        warnings: parseResult.errors.slice(0, 5).map(e => `Row ${e.row}: ${e.message}`)
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process Excel file');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, [importMutation]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleReset = () => {
    setImportResult(null);
    setError(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Import Trip History to Database
        </CardTitle>
        <CardDescription>
          Upload an MtData Trip History Report Excel file to import trips into the database
        </CardDescription>
      </CardHeader>
      <CardContent>
        {importResult ? (
          // Show import results
          <div className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Import Successful</AlertTitle>
              <AlertDescription>
                <div className="space-y-2 mt-2">
                  <p><strong>File:</strong> {importResult.fileName}</p>
                  <p><strong>Trips Parsed:</strong> {importResult.tripsParsed}</p>
                  <p><strong>Trips Imported:</strong> {importResult.tripsImported}</p>
                  {importResult.errors > 0 && (
                    <p className="text-orange-600"><strong>Rows Skipped:</strong> {importResult.errors}</p>
                  )}
                </div>
              </AlertDescription>
            </Alert>

            {importResult.warnings.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Parsing Warnings</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1 mt-2 text-sm">
                    {importResult.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button onClick={handleReset} variant="outline">
                Import Another File
              </Button>
            </div>

            <Alert>
              <Database className="h-4 w-4" />
              <AlertTitle>Next Step</AlertTitle>
              <AlertDescription>
                Trips have been imported to the database. Use the "Generate Route Patterns" button
                below to analyze routes and calculate average times and distances.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <>
            {/* Upload Area */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-colors
                ${isDragging ? 'border-primary bg-primary/5' : 'border-gray-300 dark:border-gray-700'}
                ${isProcessing ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-800'}
              `}
            >
              <input
                type="file"
                id="excel-upload"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isProcessing}
              />

              <label
                htmlFor="excel-upload"
                className="flex flex-col items-center gap-4 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
                    <div className="space-y-2 w-full max-w-xs">
                      <p className="text-sm text-muted-foreground">Processing and importing...</p>
                      <Progress value={progress} className="w-full" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-full bg-primary/10 p-4">
                      <FileSpreadsheet className="h-8 w-8 text-primary" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        Drop MtData Excel file here, or click to browse
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Supports .xlsx and .xls Trip History Reports
                      </p>
                    </div>
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  </>
                )}
              </label>
            </div>

            {/* Error Display */}
            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Import Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Instructions */}
            <div className="mt-6 space-y-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Expected File Format:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>MtData Trip History Report</strong> exported from MtData system</li>
                <li>Multi-row header format with metadata in rows 1-9</li>
                <li>Column headers in rows 10-11</li>
                <li>Trip data starting from row 12</li>
              </ul>

              <div className="border-l-2 border-primary pl-3 mt-4">
                <p className="text-xs">
                  <strong>Note:</strong> This parser is specifically designed for MtData Excel exports.
                  If you have a different format, it may not parse correctly. The file must be the
                  original Excel export from MtData, not a modified or converted version.
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
