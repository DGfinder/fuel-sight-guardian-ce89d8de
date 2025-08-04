import React, { useState, useCallback } from 'react';
import { Upload, AlertTriangle, CheckCircle2, Download, FileText, Users, TrendingUp } from 'lucide-react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Z_INDEX } from '@/lib/z-index';
import { 
  DriverCsvProcessor, 
  ProcessedDriverData, 
  DriverCsvRow 
} from '@/services/driverCsvProcessor';
import { bulkCreateDrivers, bulkCreateDriverNameMappings } from '@/api/drivers';

interface DriverCSVImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: (result: ProcessedDriverData) => void;
}

export default function DriverCSVImportModal({ 
  open, 
  onOpenChange, 
  onImportComplete 
}: DriverCSVImportModalProps) {
  const { toast } = useToast();
  const [csvData, setCsvData] = useState<DriverCsvRow[]>([]);
  const [processedData, setProcessedData] = useState<ProcessedDriverData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [step, setStep] = useState<'upload' | 'review' | 'import' | 'complete'>('upload');
  const [importProgress, setImportProgress] = useState(0);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsProcessing(true);
    setStep('upload');

    try {
      const text = await file.text();
      
      // Validate CSV structure
      const validation = DriverCsvProcessor.validateCsvStructure(text);
      if (!validation.isValid) {
        toast({
          variant: "destructive",
          title: "Invalid CSV Format",
          description: validation.errors[0]
        });
        return;
      }

      // Parse CSV
      const parsedRows = DriverCsvProcessor.parseCsvContent(text);
      setCsvData(parsedRows);

      // Process the data
      const processed = DriverCsvProcessor.processDriverData(parsedRows, {
        skipDuplicates: true,
        normalizeNames: true,
        createIds: true,
        validateFleets: true
      });

      setProcessedData(processed);
      setStep('review');

      toast({
        title: "CSV Processed Successfully",
        description: `Processed ${processed.totalProcessed} rows, found ${processed.uniqueDrivers} unique drivers`
      });

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Processing Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv']
    },
    maxFiles: 1,
    multiple: false
  });

  const handleImport = async () => {
    if (!processedData) return;

    setIsImporting(true);
    setStep('import');
    setImportProgress(0);

    try {
      // Import drivers
      setImportProgress(25);
      const createdDrivers = await bulkCreateDrivers(processedData.drivers);
      
      // Update name mappings with actual driver IDs
      const mappingsWithIds = processedData.nameMappings.map(mapping => {
        const driver = createdDrivers.find(d => 
          d.first_name === processedData.drivers.find(pd => pd.id === mapping.driver_id)?.first_name &&
          d.last_name === processedData.drivers.find(pd => pd.id === mapping.driver_id)?.last_name
        );
        return {
          ...mapping,
          driver_id: driver?.id || mapping.driver_id
        };
      });

      setImportProgress(75);
      await bulkCreateDriverNameMappings(mappingsWithIds);

      setImportProgress(100);
      setStep('complete');

      toast({
        title: "Import Successful",
        description: `Successfully imported ${createdDrivers.length} drivers with ${mappingsWithIds.length} name mappings`
      });

      onImportComplete?.(processedData);

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred"
      });
      setStep('review');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = DriverCsvProcessor.generateCsvTemplate();
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'driver_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetModal = () => {
    setCsvData([]);
    setProcessedData(null);
    setStep('upload');
    setImportProgress(0);
  };

  const handleClose = () => {
    resetModal();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="max-w-6xl max-h-[90vh] overflow-hidden"
        style={{ zIndex: Z_INDEX.modal }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Import Driver Data
          </DialogTitle>
          <DialogDescription>
            Import driver information and name mappings from a CSV file
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-medium">Upload CSV File</h3>
                  <p className="text-sm text-muted-foreground">
                    Upload a CSV file containing driver information and name mappings
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadTemplate}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Template
                </Button>
              </div>

              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                )}
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                {isDragActive ? (
                  <p className="text-lg">Drop the CSV file here...</p>
                ) : (
                  <div>
                    <p className="text-lg mb-2">Drag and drop a CSV file here</p>
                    <p className="text-sm text-muted-foreground mb-4">or click to select a file</p>
                    <Button variant="secondary">
                      <FileText className="h-4 w-4 mr-2" />
                      Select CSV File
                    </Button>
                  </div>
                )}
              </div>

              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span className="text-sm">Processing CSV file...</span>
                  </div>
                  <Progress value={50} />
                </div>
              )}
            </div>
          )}

          {step === 'review' && processedData && (
            <div className="space-y-6 max-h-[60vh] overflow-y-auto">
              <div>
                <h3 className="text-lg font-medium mb-4">Review Import Data</h3>
                
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="text-2xl font-bold">{processedData.uniqueDrivers}</p>
                          <p className="text-xs text-muted-foreground">Unique Drivers</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="text-2xl font-bold">{processedData.validationResults.validRows}</p>
                          <p className="text-xs text-muted-foreground">Valid Rows</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        <div>
                          <p className="text-2xl font-bold">{processedData.validationResults.invalidRows}</p>
                          <p className="text-xs text-muted-foreground">Invalid Rows</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-purple-500" />
                        <div>
                          <p className="text-2xl font-bold">{processedData.nameMappings.length}</p>
                          <p className="text-xs text-muted-foreground">Name Mappings</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Tabs defaultValue="summary" className="w-full">
                  <TabsList>
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                    <TabsTrigger value="drivers">Drivers</TabsTrigger>
                    <TabsTrigger value="errors">Errors</TabsTrigger>
                    <TabsTrigger value="distributions">Distributions</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="summary" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Fleet Distribution</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {processedData.fleetDistribution.map(item => (
                            <div key={item.fleet} className="flex justify-between items-center mb-2">
                              <span className="text-sm">{item.fleet}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">{item.count}</Badge>
                                <span className="text-xs text-muted-foreground">
                                  {item.percentage.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Top Depots</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {processedData.depotDistribution.slice(0, 5).map(item => (
                            <div key={item.depot} className="flex justify-between items-center mb-2">
                              <span className="text-sm">{item.depot}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">{item.count}</Badge>
                                <span className="text-xs text-muted-foreground">
                                  {item.percentage.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="drivers">
                    <div className="max-h-64 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Fleet</TableHead>
                            <TableHead>Depot</TableHead>
                            <TableHead>Systems</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {processedData.drivers.slice(0, 10).map((driver, index) => {
                            const mappings = processedData.nameMappings.filter(m => m.driver_id === driver.id);
                            return (
                              <TableRow key={index}>
                                <TableCell>{`${driver.first_name} ${driver.last_name}`}</TableCell>
                                <TableCell>{driver.fleet}</TableCell>
                                <TableCell>{driver.depot}</TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {Array.from(new Set(mappings.map(m => m.system_name))).map(system => (
                                      <Badge key={system} variant="outline" className="text-xs">
                                        {system}
                                      </Badge>
                                    ))}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      {processedData.drivers.length > 10 && (
                        <p className="text-sm text-muted-foreground text-center mt-2">
                          ... and {processedData.drivers.length - 10} more drivers
                        </p>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="errors">
                    {processedData.validationResults.errors.length > 0 ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {processedData.validationResults.errors.map((error, index) => (
                          <Alert key={index} variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              Row {error.row}: {error.error}
                            </AlertDescription>
                          </Alert>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                        <p className="text-lg font-medium">No Errors Found</p>
                        <p className="text-sm text-muted-foreground">All rows passed validation</p>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="distributions" className="space-y-4">
                    {processedData.duplicateNames.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Potential Duplicates</CardTitle>
                          <CardDescription>Names that appear multiple times or across systems</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="max-h-32 overflow-y-auto">
                            {processedData.duplicateNames.slice(0, 5).map((dup, index) => (
                              <div key={index} className="flex justify-between items-center mb-2">
                                <span className="text-sm">{dup.name}</span>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{dup.count} occurrences</Badge>
                                  <Badge variant="secondary">{dup.systems.length} systems</Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}

          {step === 'import' && (
            <div className="space-y-6 flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <div className="text-center">
                <h3 className="text-lg font-medium mb-2">Importing Drivers...</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Please wait while we import your driver data
                </p>
                <Progress value={importProgress} className="w-64" />
                <p className="text-xs text-muted-foreground mt-2">{importProgress}% complete</p>
              </div>
            </div>
          )}

          {step === 'complete' && processedData && (
            <div className="space-y-6 flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <div className="text-center">
                <h3 className="text-xl font-medium mb-2">Import Complete!</h3>
                <p className="text-muted-foreground mb-4">
                  Successfully imported {processedData.uniqueDrivers} drivers with {processedData.nameMappings.length} name mappings
                </p>
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{processedData.uniqueDrivers}</p>
                    <p className="text-sm text-muted-foreground">Drivers Created</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{processedData.nameMappings.length}</p>
                    <p className="text-sm text-muted-foreground">Name Mappings</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'review' && (
            <>
              <Button variant="outline" onClick={resetModal}>
                Upload Different File
              </Button>
              <Button 
                onClick={handleImport}
                disabled={!processedData || processedData.validationResults.invalidRows > 0}
              >
                Import {processedData?.uniqueDrivers} Drivers
              </Button>
            </>
          )}
          {step === 'complete' && (
            <Button onClick={handleClose}>
              Close
            </Button>
          )}
          {(step === 'upload' || step === 'import') && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}