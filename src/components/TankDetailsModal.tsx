import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Bell, BellOff, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { Tank, TankAlert } from "@/types/fuel";
import { useTankHistory } from "@/hooks/useTankHistory";
import { useTankAlerts } from "@/hooks/useTankAlerts";
import { ALERT_TYPE_CONFIG } from "@/lib/constants";

interface TankDetailsModalProps {
  tank: Tank | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TankDetailsModal({ tank, open, onOpenChange }: TankDetailsModalProps) {
  if (!tank) return null;

  const { alerts, acknowledgeAlert, snoozeAlert } = useTankAlerts(tank.id);
  const { data: history } = useTankHistory({ 
    tankId: tank.id,
    enabled: open,
    days: 30
  });

  const handleAlertAction = (alertId: string, action: 'acknowledge' | 'snooze') => {
    if (action === 'acknowledge') {
      acknowledgeAlert(alertId);
    } else {
      snoozeAlert(alertId);
    }
  };

  const renderAlert = (alert: TankAlert) => {
    const config = ALERT_TYPE_CONFIG[alert.type];
    const Icon = config.icon;
    const isSnoozed = alert.snoozed_until && new Date(alert.snoozed_until) > new Date();
    const isAcknowledged = !!alert.acknowledged_at;

    return (
      <div
        key={alert.id}
        className={`flex items-start gap-3 p-4 rounded-lg border ${
          config.borderColor
        } ${config.bgColor} ${
          (isSnoozed || isAcknowledged) ? 'opacity-60' : ''
        }`}
      >
        <Icon className={`w-5 h-5 mt-0.5 ${config.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={config.color}>
                  {config.label}
                </Badge>
                {isSnoozed && (
                  <Badge variant="outline" className="text-gray-500">
                    <BellOff className="w-3 h-3 mr-1" />
                    Snoozed
                  </Badge>
                )}
                {isAcknowledged && (
                  <Badge variant="outline" className="text-gray-500">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Acknowledged
                  </Badge>
                )}
              </div>
              <p className="font-medium mt-1">{alert.message}</p>
              <p className="text-sm text-gray-500 mt-1">
                {format(new Date(alert.created_at), 'MMM d, HH:mm')}
              </p>
            </div>
            {!isAcknowledged && !isSnoozed && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAlertAction(alert.id, 'acknowledge')}
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Acknowledge
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAlertAction(alert.id, 'snooze')}
                >
                  <Clock className="w-4 h-4 mr-1" />
                  Snooze
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold">{tank.location}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{tank.product_type}</Badge>
              {tank.group_id && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {tank.group_id}
                </Badge>
              )}
            </div>
          </div>
          {/* ... rest of the JSX ... */}
        </div>
      </DialogContent>
    </Dialog>
  );
} 