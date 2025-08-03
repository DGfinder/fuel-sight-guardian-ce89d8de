import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Download, 
  RefreshCw,
  Eye,
  Lock,
  FileText,
  Activity
} from 'lucide-react';
import { useSecurityMonitor } from '@/lib/security';

interface SecurityMetric {
  name: string;
  value: number;
  status: 'good' | 'warning' | 'critical';
  description: string;
  icon: React.ComponentType<any>;
}

function SecurityMetricCard({ 
  name, 
  value, 
  status, 
  description, 
  icon: Icon 
}: SecurityMetric) {
  const statusColors = {
    good: 'text-green-600 bg-green-50 border-green-200',
    warning: 'text-amber-600 bg-amber-50 border-amber-200',
    critical: 'text-red-600 bg-red-50 border-red-200'
  };

  const statusIcons = {
    good: '✅',
    warning: '⚠️',
    critical: '🚨'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`${statusColors[status]} border-2`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-white">
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">{name}</h3>
                <p className="text-xs opacity-75">{description}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-lg">{statusIcons[status]}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface SecurityEvent {
  type: string;
  data: any;
  timestamp: number;
}

function SecurityEventsList({ events }: { events: SecurityEvent[] }) {
  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'csp_violation':
        return 'bg-red-100 text-red-800';
      case 'suspicious_script':
        return 'bg-orange-100 text-orange-800';
      case 'suspicious_attribute':
        return 'bg-yellow-100 text-yellow-800';
      case 'blocked_request':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'csp_violation':
        return <Shield className="h-4 w-4" />;
      case 'suspicious_script':
        return <AlertTriangle className="h-4 w-4" />;
      case 'suspicious_attribute':
        return <Eye className="h-4 w-4" />;
      case 'blocked_request':
        return <Lock className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-3 max-h-64 overflow-y-auto">
      {events.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
          <p>No security events detected</p>
          <p className="text-sm">Your application is secure</p>
        </div>
      ) : (
        events.slice(-10).reverse().map((event, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50"
          >
            <div className={`p-1 rounded ${getEventColor(event.type)}`}>
              {getEventIcon(event.type)}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium capitalize">
                  {event.type.replace('_', ' ')}
                </span>
                <span className="text-xs text-gray-500">
                  {formatTime(event.timestamp)}
                </span>
              </div>
              {event.data && (
                <div className="text-xs text-gray-600 mt-1">
                  {event.type === 'csp_violation' && (
                    <div>
                      <div>Directive: {event.data.directive}</div>
                      <div>Blocked: {event.data.blockedURI}</div>
                    </div>
                  )}
                  {event.type === 'suspicious_script' && (
                    <div>Location: {event.data.location}</div>
                  )}
                  {event.type === 'suspicious_attribute' && (
                    <div>
                      {event.data.element} - {event.data.attribute}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        ))
      )}
    </div>
  );
}

export function SecurityDashboard() {
  const { getMetrics, exportReport } = useSecurityMonitor();
  const [metrics, setMetrics] = useState(getMetrics());
  const [events, setEvents] = useState<SecurityEvent[]>([]);

  useEffect(() => {
    // Update metrics every 10 seconds
    const interval = setInterval(() => {
      setMetrics(getMetrics());
      
      // Load events from localStorage
      try {
        const storedEvents = JSON.parse(localStorage.getItem('security_events') || '[]');
        setEvents(storedEvents);
      } catch (error) {
        console.error('Failed to load security events:', error);
      }
    }, 10000);

    // Load initial events
    try {
      const storedEvents = JSON.parse(localStorage.getItem('security_events') || '[]');
      setEvents(storedEvents);
    } catch (error) {
      console.error('Failed to load security events:', error);
    }

    return () => clearInterval(interval);
  }, [getMetrics]);

  const securityMetrics: SecurityMetric[] = [
    {
      name: 'Security Score',
      value: metrics.securityScore,
      status: metrics.securityScore >= 90 ? 'good' : metrics.securityScore >= 70 ? 'warning' : 'critical',
      description: 'Overall security rating',
      icon: Shield
    },
    {
      name: 'CSP Violations',
      value: metrics.cspViolations,
      status: metrics.cspViolations === 0 ? 'good' : metrics.cspViolations < 5 ? 'warning' : 'critical',
      description: 'Content Security Policy violations',
      icon: AlertTriangle
    },
    {
      name: 'XSS Attempts',
      value: metrics.xssAttempts,
      status: metrics.xssAttempts === 0 ? 'good' : metrics.xssAttempts < 3 ? 'warning' : 'critical',
      description: 'Cross-site scripting attempts detected',
      icon: Eye
    },
    {
      name: 'Suspicious Activity',
      value: metrics.suspiciousActivity,
      status: metrics.suspiciousActivity === 0 ? 'good' : metrics.suspiciousActivity < 5 ? 'warning' : 'critical',
      description: 'Suspicious attributes or content',
      icon: Activity
    }
  ];

  const refreshMetrics = () => {
    setMetrics(getMetrics());
    try {
      const storedEvents = JSON.parse(localStorage.getItem('security_events') || '[]');
      setEvents(storedEvents);
    } catch (error) {
      console.error('Failed to refresh security data:', error);
    }
  };

  const downloadReport = () => {
    const report = exportReport();
    const blob = new Blob([report], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearEvents = () => {
    localStorage.removeItem('security_events');
    setEvents([]);
  };

  const overallStatus = securityMetrics.some(m => m.status === 'critical') ? 'critical' :
                      securityMetrics.some(m => m.status === 'warning') ? 'warning' : 'good';

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center space-x-2">
            <Shield className="h-6 w-6" />
            <span>Security Dashboard</span>
          </h1>
          <p className="text-gray-600">Monitor application security in real-time</p>
        </div>
        
        <div className="flex space-x-2">
          <Button onClick={refreshMetrics} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={downloadReport} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Overall Status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Security Status</span>
            <Badge 
              className={
                overallStatus === 'good' ? 'bg-green-100 text-green-800' :
                overallStatus === 'warning' ? 'bg-amber-100 text-amber-800' :
                'bg-red-100 text-red-800'
              }
            >
              {overallStatus === 'good' ? '✅ Secure' :
               overallStatus === 'warning' ? '⚠️ Warning' :
               '🚨 Critical'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {securityMetrics.map((metric, index) => (
              <SecurityMetricCard key={index} {...metric} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Recent Security Events</span>
            </div>
            <div className="flex space-x-2">
              <Badge variant="outline">
                {events.length} total events
              </Badge>
              {events.length > 0 && (
                <Button onClick={clearEvents} variant="outline" size="sm">
                  Clear Events
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SecurityEventsList events={events} />
        </CardContent>
      </Card>

      {/* Security Recommendations */}
      {overallStatus !== 'good' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span>Security Recommendations</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.cspViolations > 0 && (
                <div className="p-3 bg-amber-50 rounded-lg">
                  <p className="text-sm text-amber-800">
                    <strong>CSP Violations:</strong> Review and tighten Content Security Policy directives to prevent unauthorized resource loading.
                  </p>
                </div>
              )}
              {metrics.xssAttempts > 0 && (
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-sm text-red-800">
                    <strong>XSS Attempts:</strong> Implement additional input validation and output encoding to prevent cross-site scripting attacks.
                  </p>
                </div>
              )}
              {metrics.suspiciousActivity > 5 && (
                <div className="p-3 bg-orange-50 rounded-lg">
                  <p className="text-sm text-orange-800">
                    <strong>Suspicious Activity:</strong> Consider implementing additional client-side security monitoring and stricter content validation.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}