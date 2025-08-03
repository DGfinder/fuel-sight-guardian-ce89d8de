import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Shield, 
  AlertTriangle, 
  Eye, 
  Calendar,
  TrendingDown,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3
} from 'lucide-react';

export function GuardianPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('current');

  // Mock data - replace with real API calls
  const guardianStats = {
    totalEvents: 24961,
    distractionEvents: 13317,
    fatigueEvents: 11644,
    verifiedDistraction: 850,
    verifiedFatigue: 166,
    verificationRate: {
      distraction: 6.4,
      fatigue: 1.4
    }
  };

  const monthlyTrends = [
    { month: 'Jan', events: 2100, verified: 180 },
    { month: 'Feb', events: 1950, verified: 165 },
    { month: 'Mar', events: 2300, verified: 195 },
    { month: 'Apr', events: 2050, verified: 175 },
    { month: 'May', events: 1850, verified: 155 },
    { month: 'Jun', events: 2200, verified: 185 }
  ];

  const recentEvents = [
    {
      id: 1,
      type: 'Distraction',
      driver: 'Driver 001',
      timestamp: '2024-01-15 14:30',
      status: 'verified',
      severity: 'high'
    },
    {
      id: 2,
      type: 'Fatigue',
      driver: 'Driver 042',
      timestamp: '2024-01-15 13:45',
      status: 'pending',
      severity: 'medium'
    },
    {
      id: 3,
      type: 'Distraction',
      driver: 'Driver 018',
      timestamp: '2024-01-15 12:20',
      status: 'false_positive',
      severity: 'low'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Guardian Compliance Dashboard</h1>
          <p className="text-gray-600 mt-1">Monitor safety events and compliance rates</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant={selectedPeriod === 'current' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedPeriod('current')}
          >
            Current Month
          </Button>
          <Button 
            variant={selectedPeriod === 'historical' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedPeriod('historical')}
          >
            Historical
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Shield className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{guardianStats.totalEvents.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Distraction + Fatigue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Distraction Events</CardTitle>
            <Eye className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{guardianStats.distractionEvents.toLocaleString()}</div>
            <div className="flex items-center space-x-1 text-xs">
              <span className="text-green-600">{guardianStats.verifiedDistraction}</span>
              <span className="text-muted-foreground">verified ({guardianStats.verificationRate.distraction}%)</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fatigue Events</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{guardianStats.fatigueEvents.toLocaleString()}</div>
            <div className="flex items-center space-x-1 text-xs">
              <span className="text-green-600">{guardianStats.verifiedFatigue}</span>
              <span className="text-muted-foreground">verified ({guardianStats.verificationRate.fatigue}%)</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verification Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4.1%</div>
            <p className="text-xs text-muted-foreground">Overall accuracy</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trends Chart Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Event Trends</CardTitle>
          <CardDescription>Guardian events and verification rates over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-md">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">Chart visualization would be implemented here</p>
              <p className="text-sm text-gray-400">Using Recharts or D3.js for data visualization</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
          <CardDescription>Latest Guardian safety events requiring attention</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className={`p-2 rounded-full ${
                    event.type === 'Distraction' ? 'bg-orange-100' : 'bg-red-100'
                  }`}>
                    {event.type === 'Distraction' ? (
                      <Eye className={`w-4 h-4 ${event.type === 'Distraction' ? 'text-orange-600' : 'text-red-600'}`} />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{event.type} Event</p>
                    <p className="text-sm text-gray-500">{event.driver} • {event.timestamp}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    event.severity === 'high' ? 'bg-red-100 text-red-800' :
                    event.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {event.severity}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    event.status === 'verified' ? 'bg-green-100 text-green-800' :
                    event.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {event.status}
                  </span>
                  <Button size="sm" variant="outline">
                    Review
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>System Performance</CardTitle>
            <CardDescription>Guardian monitoring system health</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">API Response Time</span>
                <span className="text-sm font-medium text-green-600">142ms</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Event Processing Rate</span>
                <span className="text-sm font-medium text-green-600">99.2%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">System Uptime</span>
                <span className="text-sm font-medium text-green-600">99.8%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Calibration Status</CardTitle>
            <CardDescription>Device calibration and maintenance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Devices Online</span>
                <span className="text-sm font-medium text-green-600">47/50</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Calibration Current</span>
                <span className="text-sm font-medium text-yellow-600">42/50</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Maintenance Required</span>
                <span className="text-sm font-medium text-red-600">8 devices</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}