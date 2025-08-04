import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Shield, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Eye,
  Download,
  Calendar,
  Users,
  Clock
} from 'lucide-react';
import DataCentreLayout from '@/components/DataCentreLayout';

// Static mock data based on the analytics types
const mockGuardianData = {
  currentMonth: {
    period: 'December 2024',
    distraction: {
      total: 847,
      verified: 54,
      rate: 6.4,
      trend: -2.1
    },
    fatigue: {
      total: 312,
      verified: 19,
      rate: 6.1,
      trend: 1.3
    },
    systemPerformance: 94.2,
    calibrationIssues: ['Vehicle-045', 'Vehicle-089']
  },
  yearToDate: {
    totalEvents: 13317,
    verifiedEvents: 852,
    overallRate: 6.4,
    monthlyTrend: [
      { month: 'Jan', distraction: 1205, fatigue: 445, verified: 108 },
      { month: 'Feb', distraction: 1098, fatigue: 398, verified: 95 },
      { month: 'Mar', distraction: 1165, fatigue: 412, verified: 101 },
      { month: 'Apr', distraction: 1089, fatigue: 387, verified: 94 },
      { month: 'May', distraction: 1145, fatigue: 405, verified: 99 },
      { month: 'Jun', distraction: 1078, fatigue: 378, verified: 93 },
      { month: 'Jul', distraction: 1134, fatigue: 389, verified: 97 },
      { month: 'Aug', distraction: 1156, fatigue: 401, verified: 100 },
      { month: 'Sep', distraction: 1087, fatigue: 365, verified: 93 },
      { month: 'Oct', discraction: 1112, fatigue: 378, verified: 95 },
      { month: 'Nov', distraction: 1101, fatigue: 367, verified: 94 },
      { month: 'Dec', distraction: 847, fatigue: 312, verified: 73 }
    ]
  },
  recentEvents: [
    {
      id: 'GE-2024-001234',
      vehicle: 'GSF-045',
      driver: 'John Smith',
      eventType: 'distraction',
      detectedAt: '2024-12-03T14:23:15Z',
      duration: 4.2,
      speed: 67,
      verified: false,
      status: 'pending_review'
    },
    {
      id: 'GE-2024-001233',
      vehicle: 'GSF-089',
      driver: 'Sarah Johnson',
      eventType: 'fatigue',
      detectedAt: '2024-12-03T11:45:22Z',
      duration: 2.8,
      speed: 72,
      verified: true,
      status: 'verified'
    },
    {
      id: 'GE-2024-001232',
      vehicle: 'GSF-023',
      driver: 'Mike Wilson',
      eventType: 'distraction',
      detectedAt: '2024-12-03T09:15:33Z',
      duration: 3.1,
      speed: 58,
      verified: false,
      status: 'normal_driving'
    }
  ],
  topRiskVehicles: ['GSF-045', 'GSF-089', 'GSF-156', 'GSF-023', 'GSF-078']
};

const GuardianDashboard = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('current');
  const { currentMonth } = mockGuardianData;

  const handleExportReport = () => {
    // Mock export functionality
    const reportData = {
      period: currentMonth.period,
      summary: currentMonth,
      events: mockGuardianData.recentEvents
    };
    console.log('Exporting Guardian Compliance Report:', reportData);
    // In real implementation, this would trigger actual export
  };

  return (
    <DataCentreLayout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Guardian Compliance Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Monitor distraction and fatigue events with verification workflows
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportReport}>
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Badge variant="secondary" className="text-green-700 bg-green-100">
            <Shield className="w-4 h-4 mr-1" />
            System Active
          </Badge>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Events ({currentMonth.period})
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(currentMonth.distraction.total + currentMonth.fatigue.total).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {currentMonth.distraction.total} distraction, {currentMonth.fatigue.total} fatigue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verification Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentMonth.distraction.rate}%
            </div>
            <p className="text-xs text-muted-foreground flex items-center">
              <TrendingDown className="w-3 h-3 text-red-500 mr-1" />
              {Math.abs(currentMonth.distraction.trend)}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Performance</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentMonth.systemPerformance}%
            </div>
            <p className="text-xs text-muted-foreground">
              {currentMonth.calibrationIssues.length} calibration issues
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Year to Date</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockGuardianData.yearToDate.totalEvents.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {mockGuardianData.yearToDate.verifiedEvents} verified ({mockGuardianData.yearToDate.overallRate}%)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Event Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Event Type Breakdown
            </CardTitle>
            <CardDescription>
              Current month distraction vs fatigue events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="font-medium">Distraction Events</span>
                </div>
                <div className="text-right">
                  <div className="font-bold">{currentMonth.distraction.total}</div>
                  <div className="text-sm text-gray-500">
                    {currentMonth.distraction.verified} verified ({currentMonth.distraction.rate}%)
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  <span className="font-medium">Fatigue Events</span>
                </div>
                <div className="text-right">
                  <div className="font-bold">{currentMonth.fatigue.total}</div>
                  <div className="text-sm text-gray-500">
                    {currentMonth.fatigue.verified} verified ({currentMonth.fatigue.rate}%)
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Risk Vehicles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Top Risk Vehicles
            </CardTitle>
            <CardDescription>
              Vehicles with highest event frequency
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockGuardianData.topRiskVehicles.slice(0, 5).map((vehicle, index) => (
                <div key={vehicle} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </div>
                    <span className="font-medium">{vehicle}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-red-600 border-red-200">
                      {Math.floor(Math.random() * 20) + 5} events
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent Events Requiring Review
          </CardTitle>
          <CardDescription>
            Latest Guardian events pending verification
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockGuardianData.recentEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${
                    event.eventType === 'distraction' ? 'bg-red-500' : 'bg-orange-500'
                  }`}></div>
                  <div>
                    <div className="font-medium">{event.vehicle} - {event.driver}</div>
                    <div className="text-sm text-gray-500">
                      {event.eventType} • {event.duration}s • {event.speed} km/h
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(event.detectedAt).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={event.verified ? "default" : "secondary"}
                    className={
                      event.status === 'verified' ? 'bg-green-100 text-green-700' :
                      event.status === 'normal_driving' ? 'bg-blue-100 text-blue-700' :
                      'bg-yellow-100 text-yellow-700'
                    }
                  >
                    {event.status.replace('_', ' ')}
                  </Badge>
                  <Button size="sm" variant="outline">
                    <Eye className="w-4 h-4 mr-1" />
                    Review
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      </div>
    </DataCentreLayout>
  );
};

export default GuardianDashboard;