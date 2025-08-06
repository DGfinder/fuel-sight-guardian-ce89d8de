/**
 * DATA IMPORT PAGE
 * 
 * Centralized file upload interface for various data sources
 * Includes captive payments CSV import with validation and rollback capabilities
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  History,
  Trash2,
  Download,
  ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import DataCentreLayout from '@/components/DataCentreLayout';
import CaptivePaymentsImportModal from '@/components/CaptivePaymentsImportModal';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useToast } from '@/hooks/use-toast';
import { getImportBatches, deleteCaptivePaymentBatch } from '@/api/captivePayments';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const DataImportPage: React.FC = () => {
  const { data: permissions, isLoading: permissionsLoading } = useUserPermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isCaptiveModalOpen, setIsCaptiveModalOpen] = useState(false);

  // Fetch import history
  const { data: importBatches = [], isLoading: batchesLoading } = useQuery({
    queryKey: ['import-batches'],
    queryFn: getImportBatches
  });

  // Delete batch mutation
  const deleteBatchMutation = useMutation({
    mutationFn: deleteCaptivePaymentBatch,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['import-batches'] });
      toast({
        title: 'Batch Deleted Successfully',
        description: `Removed ${result.deletedCount} records from the database.`
      });
    },
    onError: (error) => {
      toast({
        title: 'Delete Failed',
        description: `Error: ${error.message}`,
        variant: 'destructive'
      });
    }
  });

  const handleDeleteBatch = async (batchId: string, sourceFile: string) => {
    if (!confirm(`Are you sure you want to delete the import batch from "${sourceFile}"? This action cannot be undone.`)) {
      return;
    }
    
    deleteBatchMutation.mutate(batchId);
  };

  const handleImportSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['import-batches'] });
    toast({
      title: 'Import Successful',
      description: 'Captive payments data has been imported successfully.'
    });
  };

  // Check permissions
  const hasImportPermission = permissions?.isAdmin || permissions?.role === 'manager';

  // Show loading state while checking permissions
  if (permissionsLoading) {
    return (
      <DataCentreLayout>
        <div className="p-8 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <div className="text-gray-500">Checking permissions...</div>
          </div>
        </div>
      </DataCentreLayout>
    );
  }

  // Show access denied if user doesn't have import permission
  if (!hasImportPermission) {
    return (
      <DataCentreLayout>
        <div className="p-8 flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md">
            <div className="bg-red-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-4">
              You don't have permission to import data. This section requires admin or manager access.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Please contact your administrator if you need access to data import functions.
            </p>
            <Link to="/data-centre">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Data Centre
              </Button>
            </Link>
          </div>
        </div>
      </DataCentreLayout>
    );
  }

  return (
    <DataCentreLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link 
                to="/data-centre" 
                className="flex items-center gap-2 text-purple-600 hover:text-purple-800 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Data Centre
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Data Import
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Upload and process CSV files from multiple data sources
            </p>
          </div>
        </div>

        {/* Import Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Captive Payments Import */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setIsCaptiveModalOpen(true)}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Upload className="w-5 h-5 text-green-600" />
                </div>
                <Badge variant="outline" className="text-green-600 border-green-200">
                  Ready
                </Badge>
              </div>
              <CardTitle className="text-lg">Captive Payments</CardTitle>
              <CardDescription>
                Import SMB and GSF carrier delivery data with automatic carrier detection and data validation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-gray-600">
                <div>• Supports SMB and GSF CSV formats</div>
                <div>• Automatic date format conversion</div>
                <div>• Volume processing with negatives preserved</div>
                <div>• Duplicate detection and rollback protection</div>
              </div>
              <Button className="w-full mt-4" onClick={() => setIsCaptiveModalOpen(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Import Captive Data
              </Button>
            </CardContent>
          </Card>

          {/* Future Import Types */}
          <Card className="opacity-60">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-gray-400" />
                </div>
                <Badge variant="secondary">Coming Soon</Badge>
              </div>
              <CardTitle className="text-lg">Guardian Events</CardTitle>
              <CardDescription>
                Import distraction and fatigue event data from Athara Guardian system
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="opacity-60">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-gray-400" />
                </div>
                <Badge variant="secondary">Coming Soon</Badge>
              </div>
              <CardTitle className="text-lg">LYTX Safety</CardTitle>
              <CardDescription>
                Import driver safety scores and coaching data from LYTX platform
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Import History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Import History
            </CardTitle>
            <CardDescription>
              Manage and review previously imported data batches with rollback capabilities
            </CardDescription>
          </CardHeader>
          <CardContent>
            {batchesLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <div className="text-gray-500">Loading import history...</div>
              </div>
            ) : importBatches.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No imports found. Upload your first file to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {importBatches.map((batch) => (
                  <div key={batch.import_batch_id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900">{batch.source_file}</h4>
                        <Badge variant="outline" className={
                          batch.carrier === 'GSF' ? 'text-green-600 border-green-200' : 'text-blue-600 border-blue-200'
                        }>
                          {batch.carrier}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>
                          Imported: {new Date(batch.created_at).toLocaleDateString()} by {batch.created_by}
                        </div>
                        <div>
                          Records: {batch.record_count.toLocaleString()} | 
                          Date range: {batch.date_range.min_date} to {batch.date_range.max_date}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeleteBatch(batch.import_batch_id, batch.source_file)}
                        disabled={deleteBatchMutation.isPending}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Safety Notice */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Important:</strong> All imports are tracked with batch IDs for audit purposes. 
            You can safely remove imported data using the rollback functions above. 
            Always review data before importing to production.
          </AlertDescription>
        </Alert>
      </div>

      {/* Captive Payments Import Modal */}
      <CaptivePaymentsImportModal
        open={isCaptiveModalOpen}
        onOpenChange={setIsCaptiveModalOpen}
        onImportSuccess={handleImportSuccess}
      />
    </DataCentreLayout>
  );
};

export default DataImportPage;