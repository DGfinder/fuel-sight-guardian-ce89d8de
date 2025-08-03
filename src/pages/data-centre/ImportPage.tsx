import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  Database,
  Calendar,
  FileSpreadsheet,
  Download,
  History
} from 'lucide-react';

export function ImportPage() {
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (files: FileList) => {
    const file = files[0];
    console.log('File selected:', file.name, file.type, file.size);
    
    // Simulate upload process
    setIsUploading(true);
    setUploadProgress(0);
    
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const importHistory = [
    {
      id: 1,
      filename: 'MYOB_SMB_Dec_2023.xlsx',
      uploadDate: '2024-01-05 09:30',
      status: 'completed',
      records: 1850,
      type: 'SMB Carrier'
    },
    {
      id: 2,
      filename: 'MYOB_GSF_Dec_2023.csv',
      uploadDate: '2024-01-05 09:25',
      status: 'completed',
      records: 4920,
      type: 'GSF Carrier'
    },
    {
      id: 3,
      filename: 'Guardian_Events_Dec_2023.csv',
      uploadDate: '2024-01-04 14:15',
      status: 'completed',
      records: 2156,
      type: 'Guardian Events'
    },
    {
      id: 4,
      filename: 'LYTX_Safety_Dec_2023.xlsx',
      uploadDate: '2024-01-03 11:45',
      status: 'error',
      records: 0,
      type: 'LYTX Safety',
      error: 'Invalid date format in column C'
    }
  ];

  const templates = [
    {
      name: 'MYOB SMB Template',
      description: 'Template for SMB carrier delivery data',
      filename: 'myob_smb_template.xlsx',
      columns: ['Date', 'Customer', 'Delivery_ID', 'Amount', 'Location', 'Status']
    },
    {
      name: 'MYOB GSF Template', 
      description: 'Template for GSF carrier delivery data',
      filename: 'myob_gsf_template.xlsx',
      columns: ['Date', 'Customer', 'Delivery_ID', 'Amount', 'Location', 'Status']
    },
    {
      name: 'Guardian Events Template',
      description: 'Template for Guardian safety event data',
      filename: 'guardian_template.csv',
      columns: ['Timestamp', 'Driver_ID', 'Event_Type', 'Severity', 'Location', 'Verified']
    },
    {
      name: 'LYTX Safety Template',
      description: 'Template for LYTX DriveCam safety data',
      filename: 'lytx_template.xlsx',
      columns: ['Date', 'Driver', 'Event_Type', 'Score', 'Video_ID', 'Location']
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Data Import</h1>
        <p className="text-gray-600 mt-1">Upload monthly data files from MYOB, Guardian, and LYTX systems</p>
      </div>

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Data Files</CardTitle>
          <CardDescription>
            Drag and drop your Excel (.xlsx) or CSV files here, or click to browse
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive 
                ? 'border-blue-400 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileInput}
              disabled={isUploading}
            />
            
            {isUploading ? (
              <div className="space-y-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <Upload className="w-6 h-6 text-blue-600 animate-pulse" />
                </div>
                <div>
                  <p className="text-lg font-medium">Uploading...</p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{uploadProgress}% complete</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                  <Upload className="w-6 h-6 text-gray-500" />
                </div>
                <div>
                  <p className="text-lg font-medium">Drop files here or click to browse</p>
                  <p className="text-sm text-gray-500">Supports Excel (.xlsx) and CSV files up to 10MB</p>
                </div>
              </div>
            )}
          </div>

          {/* File Type Guidelines */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <FileSpreadsheet className="w-4 h-4 text-green-600" />
                <span className="font-medium text-sm">MYOB Data</span>
              </div>
              <p className="text-xs text-gray-500">Monthly delivery records from CFO</p>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Database className="w-4 h-4 text-red-600" />
                <span className="font-medium text-sm">Guardian Events</span>
              </div>
              <p className="text-xs text-gray-500">Safety monitoring data</p>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-sm">LYTX Safety</span>
              </div>
              <p className="text-xs text-gray-500">DriveCam incident reports</p>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Calendar className="w-4 h-4 text-purple-600" />
                <span className="font-medium text-sm">Monthly Upload</span>
              </div>
              <p className="text-xs text-gray-500">CFO cleaned data files</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Download Templates</CardTitle>
          <CardDescription>
            Use these templates to ensure your data files have the correct format
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((template, index) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">{template.name}</h3>
                  <Button size="sm" variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
                <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                <div className="flex flex-wrap gap-1">
                  {template.columns.map((column, idx) => (
                    <span key={idx} className="px-2 py-1 bg-gray-100 text-xs rounded">
                      {column}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Import History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Imports</CardTitle>
          <CardDescription>History of recent data uploads and their status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {importHistory.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className={`p-2 rounded-full ${
                    item.status === 'completed' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {item.status === 'completed' ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{item.filename}</p>
                    <p className="text-sm text-gray-500">{item.type} • {item.uploadDate}</p>
                    {item.error && (
                      <p className="text-sm text-red-600">{item.error}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    item.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {item.status}
                  </span>
                  {item.status === 'completed' && (
                    <p className="text-sm text-gray-500 mt-1">{item.records.toLocaleString()} records</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Data Processing Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Files Processed</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">847</div>
            <p className="text-xs text-muted-foreground">Total uploads this year</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Records Imported</CardTitle>
            <Database className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.1M</div>
            <p className="text-xs text-muted-foreground">Total data records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">98.7%</div>
            <p className="text-xs text-muted-foreground">Import success rate</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}