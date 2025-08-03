import React, { useState } from 'react';
import { useUserPermissions } from '../hooks/useUserPermissions';
import { GuardianComplianceDashboard } from '../components/analytics/GuardianComplianceDashboard';
import { MyobUploadModal } from '../components/analytics/MyobUploadModal';
import { DataImportTool } from '../components/analytics/DataImportTool';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { 
  BarChart3, 
  Upload, 
  Database, 
  TrendingUp, 
  Shield, 
  Truck,
  AlertCircle,
  Plus,
  FileSpreadsheet,
  Calendar,
  Users,
  Activity
} from 'lucide-react';

export function AnalyticsPage() {
  const [showMyobUpload, setShowMyobUpload] = useState(false);
  const [selectedCarrier, setSelectedCarrier] = useState<'SMB' | 'GSF'>('SMB');
  const { data: permissions, isLoading } = useUserPermissions();

  // Check access permissions
  const canViewAnalytics = permissions?.isAdmin || 
    permissions?.role === 'compliance_manager' ||
    permissions?.role === 'manager';

  const canUploadData = permissions?.isAdmin || permissions?.role === 'manager';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!canViewAnalytics) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You don't have permission to access the analytics platform. Please contact your administrator.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCarrierUpload = (carrier: 'SMB' | 'GSF') => {
    setSelectedCarrier(carrier);
    setShowMyobUpload(true);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Fleet Analytics Platform</h1>
          <p className="text-muted-foreground">
            Multi-source analytics for safety, compliance, and delivery performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {permissions?.role || 'User'}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            Real-time
          </Badge>
        </div>
      </div>

      {/* Quick Actions */}
      {canUploadData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                className="h-16 flex flex-col gap-2"
                onClick={() => handleCarrierUpload('SMB')}
              >
                <Truck className="h-5 w-5" />
                <span>Upload SMB Data</span>
                <span className="text-xs text-muted-foreground">Stevemacs Bulk Fuel</span>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-16 flex flex-col gap-2"
                onClick={() => handleCarrierUpload('GSF')}
              >
                <Truck className="h-5 w-5" />
                <span>Upload GSF Data</span>
                <span className="text-xs text-muted-foreground">Great Southern Fuels</span>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-16 flex flex-col gap-2"
                asChild
              >
                <a href="#import-tool">
                  <Database className="h-5 w-5" />
                  <span>Import Historical Data</span>
                  <span className="text-xs text-muted-foreground">Bulk CSV Import</span>
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="compliance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="compliance" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Guardian Compliance
          </TabsTrigger>
          <TabsTrigger value="deliveries" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Delivery Analytics
          </TabsTrigger>
          <TabsTrigger value="correlations" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Cross-Source Analytics
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Data Import
          </TabsTrigger>
        </TabsList>

        {/* Guardian Compliance Tab */}
        <TabsContent value="compliance">
          <GuardianComplianceDashboard />
        </TabsContent>

        {/* Delivery Analytics Tab */}
        <TabsContent value="deliveries" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                MYOB Delivery Analytics
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Monthly delivery volume and customer analysis for SMB and GSF carriers
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <FileSpreadsheet className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  Delivery Analytics Dashboard
                </h3>
                <p className="text-muted-foreground mb-6">
                  Advanced delivery performance metrics and customer analysis will be displayed here.
                  This includes volume trends, customer rankings, route efficiency, and carrier comparisons.
                </p>
                <div className="flex justify-center gap-4">
                  <Button variant="outline" onClick={() => handleCarrierUpload('SMB')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Upload SMB Data
                  </Button>
                  <Button variant="outline" onClick={() => handleCarrierUpload('GSF')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Upload GSF Data
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cross-Source Analytics Tab */}
        <TabsContent value="correlations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Multi-Source Analytics
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Correlation analysis between LYTX safety, Guardian events, and MYOB deliveries
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  Cross-Source Analytics Engine
                </h3>
                <p className="text-muted-foreground mb-6">
                  Advanced correlation analytics combining safety scores, Guardian verification rates, 
                  and delivery performance metrics. Includes driver risk profiling, route optimization 
                  recommendations, and predictive safety modeling.
                </p>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Cross-source analytics will be enabled once sufficient data is imported from all sources.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>

          {/* Driver Risk Profiling Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Driver Risk Profiling</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Multi-source risk assessment</span>
                    <Badge variant="outline">Coming Soon</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    • LYTX safety scores
                    <br />
                    • Guardian verification rates  
                    <br />
                    • Delivery performance metrics
                    <br />
                    • Composite risk scoring
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Predictive Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">ML-powered insights</span>
                    <Badge variant="outline">Coming Soon</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    • Safety incident prediction
                    <br />
                    • Route optimization recommendations
                    <br />
                    • Fuel efficiency forecasting
                    <br />
                    • Performance trend analysis
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Data Import Tab */}
        <TabsContent value="import" id="import-tool">
          <DataImportTool />
        </TabsContent>
      </Tabs>

      {/* MYOB Upload Modal */}
      <MyobUploadModal
        isOpen={showMyobUpload}
        onClose={() => setShowMyobUpload(false)}
        carrier={selectedCarrier}
      />
    </div>
  );
}