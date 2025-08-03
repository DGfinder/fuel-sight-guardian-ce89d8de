import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Download, 
  Calendar,
  BarChart3,
  Shield,
  Truck,
  Clock,
  CheckCircle,
  Filter,
  Share
} from 'lucide-react';

export function ReportsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [selectedReport, setSelectedReport] = useState('compliance');

  const reportTemplates = [
    {
      id: 'compliance',
      name: 'Monthly Compliance Report',
      description: 'Guardian safety events and verification rates',
      icon: Shield,
      color: 'bg-red-500',
      lastGenerated: '2024-01-15',
      frequency: 'Monthly'
    },
    {
      id: 'delivery',
      name: 'Delivery Performance Report',
      description: 'MYOB delivery analytics and trends',
      icon: Truck,
      color: 'bg-blue-500',
      lastGenerated: '2024-01-15',
      frequency: 'Monthly'
    },
    {
      id: 'safety',
      name: 'LYTX Safety Analysis',
      description: 'DriveCam incident analysis and scoring',
      icon: BarChart3,
      color: 'bg-green-500',
      lastGenerated: '2024-01-12',
      frequency: 'Weekly'
    },
    {
      id: 'executive',
      name: 'Executive Summary',
      description: 'Combined insights across all data sources',
      icon: FileText,
      color: 'bg-purple-500',
      lastGenerated: '2024-01-10',
      frequency: 'Monthly'
    }
  ];

  const recentReports = [
    {
      id: 1,
      name: 'December 2023 Compliance Report',
      type: 'compliance',
      generated: '2024-01-05 10:30',
      status: 'completed',
      size: '2.4 MB',
      format: 'PDF'
    },
    {
      id: 2,
      name: 'December 2023 Delivery Analysis',
      type: 'delivery',
      generated: '2024-01-05 09:15',
      status: 'completed',
      size: '3.1 MB',
      format: 'Excel'
    },
    {
      id: 3,
      name: 'Week 52 Safety Report',
      type: 'safety',
      generated: '2024-01-02 16:45',
      status: 'completed',
      size: '1.8 MB',
      format: 'PDF'
    },
    {
      id: 4,
      name: 'Q4 Executive Summary',
      type: 'executive',
      generated: '2024-01-01 12:00',
      status: 'processing',
      size: '-',
      format: 'PDF'
    }
  ];

  const scheduledReports = [
    {
      name: 'Monthly Compliance Review',
      schedule: 'First Monday of each month',
      nextRun: '2024-02-05 09:00',
      recipients: ['compliance@company.com', 'manager@company.com']
    },
    {
      name: 'Weekly Safety Digest',
      schedule: 'Every Friday at 5 PM',
      nextRun: '2024-01-19 17:00',
      recipients: ['safety@company.com']
    },
    {
      name: 'Executive Dashboard',
      schedule: 'Monthly on the 15th',
      nextRun: '2024-02-15 08:00',
      recipients: ['cfo@company.com', 'ceo@company.com']
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1">Generate and manage compliance and performance reports</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" size="sm">
            <Share className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>
      </div>

      {/* Report Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Report Templates</CardTitle>
          <CardDescription>
            Select a report template to generate or schedule automated reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {reportTemplates.map((template) => (
              <div 
                key={template.id} 
                className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                  selectedReport === template.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                }`}
                onClick={() => setSelectedReport(template.id)}
              >
                <div className={`w-12 h-12 rounded-lg ${template.color} flex items-center justify-center mb-3`}>
                  <template.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-medium mb-2">{template.name}</h3>
                <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Last generated:</span>
                    <span>{template.lastGenerated}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Frequency:</span>
                    <span>{template.frequency}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Generate Report Section */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-3">Generate Report</h4>
            <div className="flex items-center space-x-4">
              <div className="flex space-x-2">
                <Button 
                  variant={selectedPeriod === 'weekly' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedPeriod('weekly')}
                >
                  Weekly
                </Button>
                <Button 
                  variant={selectedPeriod === 'monthly' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedPeriod('monthly')}
                >
                  Monthly
                </Button>
                <Button 
                  variant={selectedPeriod === 'quarterly' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedPeriod('quarterly')}
                >
                  Quarterly
                </Button>
              </div>
              <Button className="ml-auto">
                <FileText className="w-4 h-4 mr-2" />
                Generate {selectedReport} Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Reports and Scheduled Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Reports */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Reports</CardTitle>
            <CardDescription>Recently generated reports and their status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentReports.map((report) => (
                <div key={report.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded ${
                      report.status === 'completed' ? 'bg-green-100' : 'bg-yellow-100'
                    }`}>
                      {report.status === 'completed' ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <Clock className="w-4 h-4 text-yellow-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{report.name}</p>
                      <p className="text-xs text-gray-500">{report.generated}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{report.format}</p>
                      <p className="text-xs text-gray-500">{report.size}</p>
                    </div>
                    {report.status === 'completed' && (
                      <Button size="sm" variant="outline">
                        <Download className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Scheduled Reports */}
        <Card>
          <CardHeader>
            <CardTitle>Scheduled Reports</CardTitle>
            <CardDescription>Automated report generation schedule</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {scheduledReports.map((schedule, index) => (
                <div key={index} className="p-3 border rounded">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">{schedule.name}</h4>
                    <Button size="sm" variant="ghost">
                      Edit
                    </Button>
                  </div>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>Schedule:</span>
                      <span>{schedule.schedule}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Next run:</span>
                      <span>{schedule.nextRun}</span>
                    </div>
                    <div className="mt-2">
                      <span className="text-gray-500">Recipients:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {schedule.recipients.map((email, idx) => (
                          <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                            {email}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reports Generated</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">247</div>
            <p className="text-xs text-muted-foreground">This year</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Automated Reports</CardTitle>
            <Clock className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">89%</div>
            <p className="text-xs text-muted-foreground">Of all reports</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Generation Time</CardTitle>
            <BarChart3 className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.3m</div>
            <p className="text-xs text-muted-foreground">Minutes per report</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">99.2%</div>
            <p className="text-xs text-muted-foreground">Generation success</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}