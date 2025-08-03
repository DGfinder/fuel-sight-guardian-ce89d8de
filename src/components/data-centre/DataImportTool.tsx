import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useImportGuardianEvents } from '../../hooks/useGuardianAnalytics';
import { useUploadMyobData } from '../../hooks/useMyobAnalytics';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Download,
  Database,
  Clock,
  TrendingUp
} from 'lucide-react';
import Papa from 'papaparse';

interface ImportStats {
  totalRecords: number;
  successfulImports: number;
  duplicatesSkipped: number;
  errorsEncountered: number;
  processingTime: number;
}

interface DataImportToolProps {
  className?: string;
}

export function DataImportTool({ className }: DataImportToolProps) {
  const [activeImport, setActiveImport] = useState<'guardian' | 'myob' | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [errorLogs, setErrorLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const importGuardianEvents = useImportGuardianEvents();
  const uploadMyobData = useUploadMyobData();

  // Guardian Import
  const onGuardianDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setActiveImport('guardian');
    setIsProcessing(true);
    setImportProgress(0);
    setErrorLogs([]);

    const startTime = Date.now();

    try {
      // Create upload batch first
      const { data: batch, error: batchError } = await supabase
        .from('upload_batches')
        .insert({
          data_source_id: file.name.includes('Distraction') ? 'guardian_distraction' : 'guardian_fatigue',
          filename: file.name,
          upload_type: 'historical_import',
          file_size: file.size,
          record_count: 0,
          uploaded_by: 'system',
          upload_status: 'processing'
        })
        .select()
        .single();

      if (batchError) throw batchError;

      setImportProgress(10);

      // Parse CSV
      const text = await file.text();
      const result = Papa.parse(text, { header: true });
      const rawData = result.data as any[];

      setImportProgress(30);

      // Process Guardian events
      const guardianEvents = processGuardianData(rawData, file.name);
      setImportProgress(60);

      // Import in batches to avoid memory issues
      const batchSize = 1000;
      let totalImported = 0;
      let totalErrors = 0;
      const errors: string[] = [];

      for (let i = 0; i < guardianEvents.length; i += batchSize) {
        const batch = guardianEvents.slice(i, i + batchSize);
        
        try {
          await importGuardianEvents.mutateAsync({
            events: batch,
            uploadBatchId: batch.id
          });
          totalImported += batch.length;
        } catch (error) {
          totalErrors += batch.length;
          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // Update progress
        const progress = 60 + ((i + batchSize) / guardianEvents.length) * 30;
        setImportProgress(Math.min(progress, 90));
      }

      // Update batch status
      await supabase
        .from('upload_batches')
        .update({
          record_count: totalImported,
          error_count: totalErrors,
          upload_status: totalErrors > 0 ? 'error' : 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', batch.id);

      setImportProgress(100);
      setImportStats({
        totalRecords: guardianEvents.length,
        successfulImports: totalImported,
        duplicatesSkipped: 0, // Guardian uses event_id uniqueness
        errorsEncountered: totalErrors,
        processingTime: Date.now() - startTime
      });
      setErrorLogs(errors);

    } catch (error) {
      setErrorLogs([error instanceof Error ? error.message : 'Import failed']);
    } finally {
      setIsProcessing(false);
    }
  };

  // MYOB Import
  const onMyobDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setActiveImport('myob');
    setIsProcessing(true);
    setImportProgress(0);
    setErrorLogs([]);

    const startTime = Date.now();

    try {
      setImportProgress(10);

      // Parse CSV
      const text = await file.text();
      const result = Papa.parse(text, { header: true });
      const rawData = result.data as any[];

      setImportProgress(30);

      // Process MYOB deliveries
      const deliveries = processMyobData(rawData);
      const carrier = file.name.includes('SMB') ? 'SMB' : 'GSF';

      setImportProgress(60);

      // Upload data
      const uploadResult = await uploadMyobData.mutateAsync({
        carrier: carrier as 'SMB' | 'GSF',
        deliveries,
        filename: file.name,
        uploadedBy: 'system'
      });

      setImportProgress(100);
      setImportStats({
        totalRecords: deliveries.length,
        successfulImports: uploadResult.records_processed,
        duplicatesSkipped: uploadResult.duplicates_found,
        errorsEncountered: uploadResult.errors.length,
        processingTime: Date.now() - startTime
      });
      setErrorLogs(uploadResult.errors);

    } catch (error) {
      setErrorLogs([error instanceof Error ? error.message : 'Import failed']);
    } finally {
      setIsProcessing(false);
    }
  };

  const processGuardianData = (rawData: any[], filename: string) => {
    const eventType = filename.includes('Distraction') ? 'distraction' : 'fatigue';
    
    return rawData
      .filter(row => row.event_id && row.detection_time)
      .map(row => ({
        event_id: parseInt(row.event_id),
        vehicle_id: row.vehicle_id ? parseInt(row.vehicle_id) : undefined,
        vehicle: row.vehicle || '',
        driver: row.driver || '',
        detection_time: new Date(row.detection_time).toISOString(),
        utc_offset: row.utc_offset ? parseInt(row.utc_offset) : 480,
        event_type: eventType,
        detected_event_type: row.detected_event_type || eventType,
        duration_seconds: row.duration_seconds ? parseFloat(row.duration_seconds) : undefined,
        speed_kph: row.speed_kph ? parseInt(row.speed_kph) : undefined,
        travel_metres: row.travel_metres ? parseInt(row.travel_metres) : undefined,
        latitude: row.latitude ? parseFloat(row.latitude) : undefined,
        longitude: row.longitude ? parseFloat(row.longitude) : undefined,
        audio_alert: row.audio_alert === 'yes',
        vibration_alert: row.vibration_alert === 'yes',
        trip_distance_metres: row.trip_distance_metres ? parseInt(row.trip_distance_metres) : undefined,
        trip_time_seconds: row.trip_time_seconds ? parseInt(row.trip_time_seconds) : undefined,
        confirmation: row.confirmation || 'normal driving',
        confirmation_time: row.confirmation_time ? new Date(row.confirmation_time).toISOString() : undefined,
        classification: row.classification || 'acceptable driving',
        fleet: row.fleet || '',
        timezone: row.timezone || 'Australia/Perth',
        account: row.account || '',
        service_provider: row.service_provider || '',
        guardian_unit: row.guardian_unit || '',
        software_version: row.software_version || '',
        labels: row.labels || '',
        monthly_period: new Date(row.detection_time).toISOString().slice(0, 7) + '-01'
      }));
  };

  const processMyobData = (rawData: any[]) => {
    return rawData
      .filter(row => row.Date && row.Volume)
      .map(row => ({
        delivery_date: parseDate(row.Date),
        bill_of_lading: row['Bill of Lading'] || '',
        location: row.Location || '',
        customer: row.Customer || '',
        product: row.Product || '',
        volume_litres: parseVolume(row.Volume)
      }));
  };

  const parseDate = (dateStr: string): string => {
    // Handle various date formats from MYOB data
    try {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  };

  const parseVolume = (volumeStr: string): number => {
    const cleaned = String(volumeStr).replace(/[,\"]/g, '');
    return parseFloat(cleaned) || 0;
  };

  const { getRootProps: getGuardianProps, getInputProps: getGuardianInputProps } = useDropzone({
    onDrop: onGuardianDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
    disabled: isProcessing
  });

  const { getRootProps: getMyobProps, getInputProps: getMyobInputProps } = useDropzone({
    onDrop: onMyobDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
    disabled: isProcessing
  });

  return (
    <div className={`space-y-6 ${className}`}>
      <div>
        <h2 className="text-2xl font-bold">Historical Data Import</h2>
        <p className="text-muted-foreground">
          Import large CSV files for Guardian events and MYOB delivery data
        </p>
      </div>

      <Tabs defaultValue="guardian" className="space-y-4">
        <TabsList>
          <TabsTrigger value="guardian">Guardian Events</TabsTrigger>
          <TabsTrigger value="myob">MYOB Deliveries</TabsTrigger>
          <TabsTrigger value="status">Import Status</TabsTrigger>
        </TabsList>

        <TabsContent value="guardian" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Guardian Events Import
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Import Guardian distraction and fatigue monitoring CSV files
              </p>
            </CardHeader>
            <CardContent>
              <div
                {...getGuardianProps()}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                  ${isProcessing 
                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed' 
                    : 'border-gray-300 hover:border-gray-400'
                  }
                `}
              >
                <input {...getGuardianInputProps()} />
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium mb-2">
                  Drop Guardian CSV files here
                </p>
                <p className="text-sm text-gray-500">
                  Supports distraction and fatigue event files
                </p>
              </div>

              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Expected files:</strong> Guardian distraction and fatigue CSV exports
                  <br />
                  <strong>Format:</strong> event_id, vehicle, driver, detection_time, confirmation, etc.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="myob" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                MYOB Deliveries Import
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Import historical MYOB delivery data for SMB and GSF carriers
              </p>
            </CardHeader>
            <CardContent>
              <div
                {...getMyobProps()}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                  ${isProcessing 
                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed' 
                    : 'border-gray-300 hover:border-gray-400'
                  }
                `}
              >
                <input {...getMyobInputProps()} />
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium mb-2">
                  Drop MYOB CSV files here
                </p>
                <p className="text-sm text-gray-500">
                  Supports SMB and GSF carrier delivery data
                </p>
              </div>

              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Expected files:</strong> MYOB carrier delivery exports (SMB/GSF)
                  <br />
                  <strong>Format:</strong> Date, Bill of Lading, Location, Customer, Product, Volume
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          {isProcessing && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Import in Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span>Processing {activeImport} data...</span>
                    <span>{importProgress}%</span>
                  </div>
                  <Progress value={importProgress} />
                </div>
              </CardContent>
            </Card>
          )}

          {importStats && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Import Complete
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{importStats.totalRecords.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Total Records</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{importStats.successfulImports.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Imported</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{importStats.duplicatesSkipped.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Duplicates</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{importStats.errorsEncountered.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Errors</div>
                  </div>
                </div>

                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>Processing time: {(importStats.processingTime / 1000).toFixed(1)}s</span>
                  <Badge variant="outline">
                    {((importStats.successfulImports / importStats.totalRecords) * 100).toFixed(1)}% success rate
                  </Badge>
                </div>

                {errorLogs.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium text-red-600 mb-2">Error Log</h4>
                    <div className="bg-red-50 border border-red-200 rounded p-2 max-h-32 overflow-y-auto">
                      {errorLogs.map((error, index) => (
                        <div key={index} className="text-sm text-red-700 font-mono">
                          {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {!isProcessing && !importStats && (
            <Card>
              <CardContent className="text-center py-8">
                <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No imports in progress. Use the tabs above to import data.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}