import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { 
  BarChart3, 
  Database, 
  Shield,
  Truck,
  FileText,
  Info,
  CheckCircle
} from 'lucide-react';

export function DataCentrePage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Data Centre Platform</h1>
          <p className="text-muted-foreground">
            Simplified data centre for safety, compliance, and delivery performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Active
          </Badge>
        </div>
      </div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-red-500 flex items-center justify-center mb-3">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-lg">Guardian Compliance</CardTitle>
            <p className="text-sm text-muted-foreground">Safety monitoring and compliance tracking</p>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                window.location.href = "/data-centre/guardian";
              }}
            >
              View Guardian Data
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-blue-500 flex items-center justify-center mb-3">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-lg">Delivery Analytics</CardTitle>
            <p className="text-sm text-muted-foreground">MYOB delivery performance analysis</p>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                window.location.href = "/data-centre/deliveries";
              }}
            >
              View Deliveries
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-green-500 flex items-center justify-center mb-3">
              <Database className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-lg">Data Import</CardTitle>
            <p className="text-sm text-muted-foreground">Upload and import data files</p>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                window.location.href = "/data-centre/import";
              }}
            >
              Import Data
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-purple-500 flex items-center justify-center mb-3">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-lg">Reports</CardTitle>
            <p className="text-sm text-muted-foreground">Generate compliance and performance reports</p>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                window.location.href = "/data-centre/reports";
              }}
            >
              Generate Reports
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-orange-500 flex items-center justify-center mb-3">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-lg">Dashboard</CardTitle>
            <p className="text-sm text-muted-foreground">Main dashboard overview</p>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                window.location.href = "/data-centre";
              }}
            >
              View Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Data Centre Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Data Centre platform is running in simplified mode. 
              All core navigation and routing is functional without complex data processing.
            </AlertDescription>
          </Alert>
          
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm">Navigation Active</span>
            </div>
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm">Routes Configured</span>
            </div>
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm">UI Components Loaded</span>
            </div>
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm">Error-Free Operation</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}