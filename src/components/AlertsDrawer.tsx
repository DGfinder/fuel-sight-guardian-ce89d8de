import React from 'react';
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerDescription,
  DrawerClose 
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, X, CheckCircle } from "lucide-react";
import { Tank } from "@/types/fuel";

interface AlertsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tanks: Tank[];
}

export function AlertsDrawer({ open, onOpenChange, tanks }: AlertsDrawerProps) {
  // Get all tanks with alerts
  const tanksWithAlerts = tanks.filter(tank => tank.alerts.length > 0);
  
  // Get additional system alerts
  const systemAlerts = [
    {
      id: 'sys1',
      type: 'warning' as const,
      message: 'No dip recorded for Geraldton Tank 2 in 24 hours',
      timestamp: '2024-06-05T10:00:00Z',
      tankLocation: 'Geraldton Tank 2'
    },
    {
      id: 'sys2',
      type: 'info' as const,
      message: 'Scheduled delivery for Swan Transit in 2 days',
      timestamp: '2024-06-05T08:00:00Z',
      tankLocation: 'Swan Transit'
    }
  ];

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-fuel-critical" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-fuel-warning" />;
      default: return <Clock className="w-4 h-4 text-blue-500" />;
    }
  };

  const getAlertBadgeColor = (type: string) => {
    switch (type) {
      case 'critical': return 'bg-fuel-critical';
      case 'warning': return 'bg-fuel-warning';
      default: return 'bg-blue-500';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const alertTime = new Date(timestamp);
    const diffHours = Math.floor((now.getTime() - alertTime.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[80vh]">
        <DrawerHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-fuel-critical" />
                Active Alerts
              </DrawerTitle>
              <DrawerDescription>
                {tanksWithAlerts.length + systemAlerts.length} active alerts requiring attention
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="sm">
                <X className="w-4 h-4" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>
        
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Tank Alerts */}
          {tanksWithAlerts.map((tank) => (
            tank.alerts.map((alert) => (
              <div key={alert.id} className="bg-white border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getAlertIcon(alert.type)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900">{tank.location}</h4>
                        <Badge className={`${getAlertBadgeColor(alert.type)} text-white text-xs`}>
                          {alert.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{alert.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {tank.depot} • {formatTimeAgo(alert.timestamp)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-xs">
                      <Clock className="w-3 h-3 mr-1" />
                      Snooze
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Ack
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ))}

          {/* System Alerts */}
          {systemAlerts.map((alert) => (
            <div key={alert.id} className="bg-white border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {getAlertIcon(alert.type)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900">{alert.tankLocation}</h4>
                      <Badge className={`${getAlertBadgeColor(alert.type)} text-white text-xs`}>
                        {alert.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{alert.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatTimeAgo(alert.timestamp)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="text-xs">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
