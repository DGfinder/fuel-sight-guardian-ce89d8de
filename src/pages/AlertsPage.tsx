import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAlerts } from '@/hooks/useAlerts';
import { AlertTriangle, CheckCircle, Clock, MapPin } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from 'date-fns';

export default function AlertsPage() {
  const { alerts, isLoading, error } = useAlerts();

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-center mt-4 text-gray-600">Loading alerts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">Error loading alerts: {error.message}</p>
      </div>
    );
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'low':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      default:
        return <Clock className="w-5 h-5 text-blue-600" />;
    }
  };

  const getAlertVariant = (type: string) => {
    switch (type) {
      case 'critical':
        return 'destructive';
      case 'low':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const activeAlerts = alerts?.filter(alert => !alert.acknowledged_at) || [];
  const acknowledgedAlerts = alerts?.filter(alert => alert.acknowledged_at) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Alerts</h1>
          <p className="text-gray-600 mt-1">Monitor and manage system alerts</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="px-3 py-1">
            {activeAlerts.length} Active
          </Badge>
          <Button variant="outline">
            <CheckCircle className="w-4 h-4 mr-2" />
            Mark All Read
          </Button>
        </div>
      </div>

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Active Alerts ({activeAlerts.length})
          </h2>
          <div className="space-y-3">
            {activeAlerts.map((alert) => (
              <Card key={alert.id} className="border-l-4 border-l-red-500">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {getAlertIcon(alert.type)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{alert.message}</h3>
                          <Badge variant={getAlertVariant(alert.type) as any}>
                            {alert.type.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="flex items-center text-sm text-gray-600 gap-4">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <span>{alert.fuel_tanks?.location || 'Unknown Location'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Acknowledge
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Acknowledged Alerts */}
      {acknowledgedAlerts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Recent Activity ({acknowledgedAlerts.length})
          </h2>
          <div className="space-y-3">
            {acknowledgedAlerts.slice(0, 10).map((alert) => (
              <Card key={alert.id} className="border-l-4 border-l-green-500 opacity-75">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-700">{alert.message}</h3>
                        <Badge variant="outline" className="text-green-700 border-green-200">
                          RESOLVED
                        </Badge>
                      </div>
                      <div className="flex items-center text-sm text-gray-500 gap-4">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>{alert.fuel_tanks?.location || 'Unknown Location'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>Acknowledged {formatDistanceToNow(new Date(alert.acknowledged_at!), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* No Alerts State */}
      {(!alerts || alerts.length === 0) && (
        <div className="text-center py-12">
          <CheckCircle className="w-16 h-16 text-green-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No alerts</h3>
          <p className="text-gray-600">All systems are running normally.</p>
        </div>
      )}
    </div>
  );
} 