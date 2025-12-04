import React, { useState, useEffect } from 'react';
import { useTaTanksCompat as useTanks } from "@/hooks/useTaTanksCompat";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, CheckCircle, AlertCircle, AlertTriangle, Info, Filter, Check, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ErrorFallback } from "@/components/ui/error-fallback";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { useAlerts } from '@/hooks/useAlerts';
import type { Tank } from '@/types/fuel';

type Alert = Database["public"]["Tables"]["tank_alerts"]["Row"];
type AlertType = Alert["type"];
type AlertAction = 'acknowledge' | 'snooze';

interface AlertWithTank extends Alert {
  tank: Pick<Tank, "location" | "group_id" | "product_type">;
}

const ALERT_TYPE_CONFIG = {
  critical: {
    icon: AlertCircle,
    color: "text-fuel-critical",
    bgColor: "bg-fuel-critical/10",
    borderColor: "border-fuel-critical/20",
    label: "Critical"
  },
  low_level: {
    icon: AlertTriangle,
    color: "text-fuel-warning",
    bgColor: "bg-fuel-warning/10",
    borderColor: "border-fuel-warning/20",
    label: "Low Level"
  },
  low_days: {
    icon: Clock,
    color: "text-fuel-warning",
    bgColor: "bg-fuel-warning/10",
    borderColor: "border-fuel-warning/20",
    label: "Low Days"
  }
} as const;

interface AlertsDrawerProps {
  tanks: Tank[] | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AlertsDrawer({ tanks = [], open, onOpenChange }: AlertsDrawerProps) {
  const { isLoading: tanksLoading, error: tanksError } = useTanks();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { alerts, isLoading, acknowledgeAlert, snoozeAlert } = useAlerts();
  const [selectedAlertType, setSelectedAlertType] = useState<string | null>(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user || null);
    };
    getSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const handleAlertAction = async (alertId: string, action: 'acknowledge' | 'snooze') => {
    try {
      if (action === 'acknowledge') {
        await acknowledgeAlert(alertId);
        toast({
          title: "Alert acknowledged",
          description: "The alert has been marked as acknowledged.",
        });
      } else {
        const snoozeUntil = new Date();
        snoozeUntil.setHours(snoozeUntil.getHours() + 24);
        await snoozeAlert(alertId, snoozeUntil.toISOString());
        toast({
          title: "Alert snoozed",
          description: "The alert has been snoozed for 24 hours.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update alert status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const filteredAlerts = alerts?.filter(alert => {
    if (!selectedAlertType) return true;
    return (alert.type === selectedAlertType) || (alert.alert_type === selectedAlertType);
  }) || [];

  if (tanksError) {
    return <ErrorFallback error={tanksError} />;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" className="relative">
          <Bell className="w-4 h-4 mr-2" />
          Alerts
          {filteredAlerts.length > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0"
            >
              {filteredAlerts.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader className="space-y-4">
          <SheetTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Alerts
            </div>
          </SheetTitle>
          <div className="flex items-center gap-2">
            <Button
              variant={selectedAlertType === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedAlertType(null)}
            >
              All
            </Button>
            <Button
              variant={selectedAlertType === 'critical' ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedAlertType('critical')}
            >
              Critical
            </Button>
            <Button
              variant={selectedAlertType === 'warning' ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedAlertType('warning')}
            >
              Warning
            </Button>
          </div>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
          <div className="space-y-4 pr-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredAlerts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center h-[200px] text-gray-500">
                  <Bell className="w-8 h-8 mb-2" />
                  <p>No alerts found</p>
                  {selectedAlertType !== null && (
                    <p className="text-sm mt-1">Try changing the filter</p>
                  )}
                </CardContent>
              </Card>
            ) : (
              filteredAlerts.map((alert) => (
                <Card key={alert.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={cn(
                            "h-4 w-4",
                            (alert.type === 'critical' || alert.alert_type === 'critical') ? "text-fuel-critical" : "text-fuel-warning"
                          )} />
                          <Badge variant={(alert.type === 'critical' || alert.alert_type === 'critical') ? "destructive" : "secondary"}>
                            {alert.type || alert.alert_type}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium">{alert.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(alert.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAlertAction(alert.id, 'snooze')}
                        >
                          <Clock className="h-4 w-4 mr-1" />
                          Snooze
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAlertAction(alert.id, 'acknowledge')}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Acknowledge
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
