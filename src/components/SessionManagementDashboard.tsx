/**
 * SESSION MANAGEMENT DASHBOARD
 * 
 * Provides comprehensive session monitoring and management capabilities
 * including active sessions, analytics, and security controls
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle,
  Clock,
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  Shield,
  Activity,
  Users,
  Zap,
  RefreshCw,
  Trash2,
  Eye,
  Settings
} from 'lucide-react';
import { 
  useEnhancedSession,
  useActiveSessions,
  useSessionAnalytics,
  usePermissionCheck,
  useSessionSecurity
} from '@/hooks/useEnhancedSession';
import { formatDistanceToNow, format } from 'date-fns';

const DeviceIcon = ({ deviceType }: { deviceType: string }) => {
  switch (deviceType) {
    case 'desktop':
      return <Monitor className="h-4 w-4" />;
    case 'mobile':
      return <Smartphone className="h-4 w-4" />;
    case 'tablet':
      return <Tablet className="h-4 w-4" />;
    default:
      return <Globe className="h-4 w-4" />;
  }
};

const SessionStatusBadge = ({ isActive, lastActivity }: { isActive: boolean; lastActivity: string }) => {
  const timeSinceActivity = new Date().getTime() - new Date(lastActivity).getTime();
  const minutesSinceActivity = Math.floor(timeSinceActivity / (1000 * 60));

  if (minutesSinceActivity < 5) {
    return <Badge variant="default" className="bg-green-500">Active</Badge>;
  } else if (minutesSinceActivity < 30) {
    return <Badge variant="secondary">Recent</Badge>;
  } else {
    return <Badge variant="outline">Idle</Badge>;
  }
};

export function SessionManagementDashboard() {
  const { session, isAuthenticated } = useEnhancedSession();
  const { activeSessions, terminateSession, terminateAllSessions, isTerminating } = useActiveSessions();
  const { data: analytics } = useSessionAnalytics();
  const { isAdmin } = usePermissionCheck();
  const { invalidateCache, refreshPermissions, isProcessing } = useSessionSecurity();

  const [showTerminateDialog, setShowTerminateDialog] = useState<string | null>(null);
  const [showTerminateAllDialog, setShowTerminateAllDialog] = useState(false);

  if (!isAuthenticated || !session) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            Please sign in to view session management
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatDuration = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Session Management</h2>
          <p className="text-muted-foreground">
            Monitor and manage your active sessions and security settings
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshPermissions()}
            disabled={isProcessing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
            Refresh Permissions
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => invalidateCache()}
            disabled={isProcessing}
          >
            <Zap className="h-4 w-4 mr-2" />
            Clear Cache
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sessions">Active Sessions</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Current Session</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics?.currentSession 
                    ? formatDuration(analytics.currentSession.duration)
                    : 'N/A'
                  }
                </div>
                <p className="text-xs text-muted-foreground">
                  Since {session.metadata.loginTime 
                    ? format(new Date(session.metadata.loginTime), 'MMM d, HH:mm')
                    : 'Unknown'
                  }
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeSessions.length}</div>
                <p className="text-xs text-muted-foreground">
                  Across {new Set(activeSessions.map(s => s.deviceInfo.deviceType)).size} device types
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Activity Count</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics?.currentSession?.activityCount || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  This session
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Last Activity</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {session.lastActivity 
                    ? formatDistanceToNow(new Date(session.lastActivity), { addSuffix: true })
                    : 'N/A'
                  }
                </div>
                <p className="text-xs text-muted-foreground">
                  Current device
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Current Session Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Current Session Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <DeviceIcon deviceType={session.deviceInfo.deviceType} />
                    <span className="font-medium">Device:</span>
                    <span className="capitalize">{session.deviceInfo.deviceType}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    <span className="font-medium">Browser:</span>
                    <span>{session.deviceInfo.browser}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    <span className="font-medium">OS:</span>
                    <span>{session.deviceInfo.os}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">Login Time:</span>
                    <span>{format(new Date(session.metadata.loginTime), 'MMM d, yyyy HH:mm')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    <span className="font-medium">Session ID:</span>
                    <span className="font-mono text-sm">{session.sessionId.slice(-8)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    <span className="font-medium">Resolution:</span>
                    <span>{session.deviceInfo.screenResolution || 'Unknown'}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Active Sessions ({activeSessions.length})</h3>
            {activeSessions.length > 1 && (
              <Dialog open={showTerminateAllDialog} onOpenChange={setShowTerminateAllDialog}>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Terminate All Other Sessions
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Terminate All Sessions</DialogTitle>
                    <DialogDescription>
                      This will sign you out from all devices except the current one. 
                      You'll need to sign in again on other devices.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowTerminateAllDialog(false)}>
                      Cancel
                    </Button>
                    <Button 
                      variant="destructive"
                      onClick={() => {
                        terminateAllSessions();
                        setShowTerminateAllDialog(false);
                      }}
                      disabled={isTerminating}
                    >
                      Terminate All Sessions
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Browser</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead>Session ID</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeSessions.map((activeSession) => {
                    const isCurrent = activeSession.sessionId === session.sessionId;
                    
                    return (
                      <TableRow key={activeSession.sessionId}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <DeviceIcon deviceType={activeSession.deviceInfo.deviceType} />
                            <div>
                              <div className="capitalize font-medium">
                                {activeSession.deviceInfo.deviceType}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {activeSession.deviceInfo.os}
                              </div>
                            </div>
                            {isCurrent && (
                              <Badge variant="secondary" className="ml-2">Current</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{activeSession.deviceInfo.browser}</TableCell>
                        <TableCell>
                          <SessionStatusBadge 
                            isActive={activeSession.isActive}
                            lastActivity={activeSession.lastActivity}
                          />
                        </TableCell>
                        <TableCell>
                          {formatDistanceToNow(new Date(activeSession.lastActivity), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <code className="text-sm">...{activeSession.sessionId.slice(-8)}</code>
                        </TableCell>
                        <TableCell className="text-right">
                          {!isCurrent && (
                            <Dialog 
                              open={showTerminateDialog === activeSession.sessionId} 
                              onOpenChange={(open) => setShowTerminateDialog(open ? activeSession.sessionId : null)}
                            >
                              <DialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Terminate Session</DialogTitle>
                                  <DialogDescription>
                                    Are you sure you want to terminate this session? The user will be signed out from this device.
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setShowTerminateDialog(null)}>
                                    Cancel
                                  </Button>
                                  <Button 
                                    variant="destructive"
                                    onClick={() => {
                                      terminateSession(activeSession.sessionId);
                                      setShowTerminateDialog(null);
                                    }}
                                    disabled={isTerminating}
                                  >
                                    Terminate Session
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {analytics && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Device Breakdown</CardTitle>
                    <CardDescription>Sessions by device type</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(analytics.deviceBreakdown).map(([deviceType, count]) => (
                        <div key={deviceType} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <DeviceIcon deviceType={deviceType} />
                            <span className="capitalize">{deviceType}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={(count / activeSessions.length) * 100} 
                              className="w-20" 
                            />
                            <span className="text-sm font-medium w-8 text-right">{count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Browser Breakdown</CardTitle>
                    <CardDescription>Sessions by browser</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(analytics.browserBreakdown).map(([browser, count]) => (
                        <div key={browser} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            <span>{browser}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={(count / activeSessions.length) * 100} 
                              className="w-20" 
                            />
                            <span className="text-sm font-medium w-8 text-right">{count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Session Statistics</CardTitle>
                  <CardDescription>Current session performance metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {formatDuration(analytics.currentSession.duration)}
                      </div>
                      <div className="text-sm text-muted-foreground">Session Duration</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {analytics.currentSession.activityCount}
                      </div>
                      <div className="text-sm text-muted-foreground">Activities</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {analytics.totalActiveSessions}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Sessions</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Use these security features to manage your account security and session data.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Refresh Data
                </CardTitle>
                <CardDescription>
                  Update your permissions and clear cached data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={() => refreshPermissions()} 
                  disabled={isProcessing}
                  className="w-full"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
                  Refresh Permissions
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => invalidateCache()} 
                  disabled={isProcessing}
                  className="w-full"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Clear Cache
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Session Security
                </CardTitle>
                <CardDescription>
                  Manage your active sessions and security settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <div>Active Sessions: {activeSessions.length}</div>
                  <div>Current Device: {session.deviceInfo.deviceType}</div>
                  <div>Role: {session.permissions.role}</div>
                </div>
                {activeSessions.length > 1 && (
                  <Button 
                    variant="destructive"
                    onClick={() => setShowTerminateAllDialog(true)}
                    className="w-full"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Terminate All Other Sessions
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}