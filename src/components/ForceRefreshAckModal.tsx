import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, AlertTriangle, RefreshCw, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export interface Acknowledgment {
  userId: string;
  email: string;
  fullName: string;
  acknowledgedAt: number;
}

export interface PresenceUser {
  oduserId: string;
  email: string;
  fullName: string;
  onlineAt: string;
}

interface ForceRefreshAckModalProps {
  open: boolean;
  onClose: () => void;
  acknowledgments: Acknowledgment[];
  connectedUsers: PresenceUser[];
  isLoading: boolean;
}

export function ForceRefreshAckModal({
  open,
  onClose,
  acknowledgments,
  connectedUsers,
  isLoading,
}: ForceRefreshAckModalProps) {
  const [timeoutReached, setTimeoutReached] = useState(false);

  // 30 second timeout for showing warning
  useEffect(() => {
    if (!open) {
      setTimeoutReached(false);
      return;
    }
    const timer = setTimeout(() => setTimeoutReached(true), 30000);
    return () => clearTimeout(timer);
  }, [open]);

  const totalUsers = connectedUsers.length;
  const ackedCount = acknowledgments.length;
  const progressPercent = totalUsers > 0 ? (ackedCount / totalUsers) * 100 : 0;

  // Find pending users (connected but not yet acknowledged)
  const pendingUsers = connectedUsers.filter(
    u => !acknowledgments.some(a => a.userId === u.oduserId)
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
            Force Refresh Status
          </DialogTitle>
          <DialogDescription>
            Monitoring user acknowledgments in real-time
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden">
          {/* Progress Summary */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-lg font-semibold">
                  {ackedCount} / {totalUsers} users refreshed
                </span>
              </div>
              {ackedCount === totalUsers && totalUsers > 0 && (
                <Badge className="bg-green-500">Complete</Badge>
              )}
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>

          {/* Acknowledged Users */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              Acknowledged ({ackedCount})
            </h4>
            <div className="max-h-32 overflow-y-auto space-y-1 bg-muted/50 rounded-lg p-2">
              {acknowledgments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Waiting for acknowledgments...
                </p>
              ) : (
                acknowledgments.map(ack => (
                  <div key={ack.userId} className="flex items-center justify-between text-sm p-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                      <span className="truncate">{ack.fullName || ack.email}</span>
                    </div>
                    <span className="text-muted-foreground text-xs whitespace-nowrap">
                      {formatDistanceToNow(ack.acknowledgedAt, { addSuffix: true })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pending Users */}
          {pendingUsers.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2 text-orange-600">
                <Clock className="h-4 w-4" />
                Pending ({pendingUsers.length})
              </h4>
              <div className="max-h-32 overflow-y-auto space-y-1 bg-muted/50 rounded-lg p-2">
                {pendingUsers.map(user => (
                  <div key={user.oduserId} className="flex items-center gap-2 text-sm p-1">
                    <Clock className="h-3 w-3 text-orange-500 flex-shrink-0" />
                    <span className="truncate">{user.fullName || user.email}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeout Warning */}
          {timeoutReached && pendingUsers.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                <p className="font-medium">Timeout reached</p>
                <p className="text-xs mt-1">
                  Some users may have disconnected, closed their browser, or be on an older app version.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
