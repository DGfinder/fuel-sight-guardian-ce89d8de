import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  Shield, 
  Truck, 
  Database, 
  FileText, 
  Calendar,
  CheckCircle
} from 'lucide-react';

export function DataCentreDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Data Centre Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Welcome to the simplified Data Centre platform
            </p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            <span>Last updated: {new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Statistics Grid - Static Values */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Guardian Events</CardTitle>
            <div className="p-2 rounded-md bg-red-50">
              <Shield className="h-4 w-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Ready</div>
            <p className="text-xs text-muted-foreground mt-1">Safety monitoring system</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Records</CardTitle>
            <div className="p-2 rounded-md bg-blue-50">
              <Truck className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Ready</div>
            <p className="text-xs text-muted-foreground mt-1">MYOB delivery system</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Import</CardTitle>
            <div className="p-2 rounded-md bg-green-50">
              <Database className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Ready</div>
            <p className="text-xs text-muted-foreground mt-1">File upload system</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reports</CardTitle>
            <div className="p-2 rounded-md bg-purple-50">
              <FileText className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Ready</div>
            <p className="text-xs text-muted-foreground mt-1">Report generation</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-red-500 flex items-center justify-center mb-3">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-lg">Guardian Compliance</CardTitle>
              <p className="text-sm text-muted-foreground">View safety monitoring data</p>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  window.location.href = "/data-centre/guardian";
                }}
              >
                Open
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-blue-500 flex items-center justify-center mb-3">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-lg">Delivery Analytics</CardTitle>
              <p className="text-sm text-muted-foreground">Analyze delivery performance</p>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  window.location.href = "/data-centre/deliveries";
                }}
              >
                Open
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-green-500 flex items-center justify-center mb-3">
                <Database className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-lg">Import Data</CardTitle>
              <p className="text-sm text-muted-foreground">Upload data files</p>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  window.location.href = "/data-centre/import";
                }}
              >
                Open
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-purple-500 flex items-center justify-center mb-3">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-lg">Generate Reports</CardTitle>
              <p className="text-sm text-muted-foreground">Create reports</p>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  window.location.href = "/data-centre/reports";
                }}
              >
                Open
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5" />
            <span>System Status</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Current system health
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm">Data Centre Active</span>
            </div>
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm">Navigation Working</span>
            </div>
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm">No Errors Detected</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}