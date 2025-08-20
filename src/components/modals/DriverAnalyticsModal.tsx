import React, { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Shield, TrendingUp, Activity, Loader2, Download } from 'lucide-react';
import DriverProfileService from '@/services/driverProfileService';
import { useOptimizedDriverProfile } from '@/hooks/useDriverProfile';
import { useInvalidateDriverProfile } from '@/hooks/useDriverProfile';

interface DriverAnalyticsModalProps {
  driverId: string | null;
  open: boolean;
  onClose: () => void;
}

export default function DriverAnalyticsModal({ driverId, open, onClose }: DriverAnalyticsModalProps) {
  const [timeframe, setTimeframe] = useState<'30d' | '90d' | '1y'>('30d');

  const { invalidateDriverProfile } = useInvalidateDriverProfile();

  const profile = useOptimizedDriverProfile(driverId || '', timeframe);

  const eventsQuery = useQuery({
    queryKey: ['driver-events', driverId, timeframe],
    queryFn: () => DriverProfileService.getDriverEventDetails(driverId as string, timeframe === '1y' ? '90d' : timeframe),
    enabled: open && !!driverId,
    staleTime: 2 * 60 * 1000
  });

  const updateStatus = useMutation({
    mutationFn: (status: 'Active' | 'Inactive' | 'Terminated') => DriverProfileService.updateDriverStatus(driverId as string, status),
    onSuccess: () => {
      invalidateDriverProfile(driverId || undefined);
    }
  });

  const headerBadgeVariant = useMemo(() => {
    const s = profile.data?.summary.guardian_risk_level;
    if (s === 'Critical' || s === 'High') return 'destructive' as const;
    if (s === 'Medium') return 'default' as const;
    return 'secondary' as const;
  }, [profile.data?.summary.guardian_risk_level]);

  const handleArchive = () => updateStatus.mutate('Inactive');
  const handleActivate = () => updateStatus.mutate('Active');
  const handleTerminate = () => updateStatus.mutate('Terminated');

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            {profile.data ? profile.data.summary.full_name : 'Driver'}
          </DialogTitle>
          <DialogDescription>
            {profile.data ? (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge variant={headerBadgeVariant}>{profile.data.summary.guardian_risk_level}</Badge>
                <Badge variant="outline">{profile.data.summary.fleet}</Badge>
                {profile.data.summary.depot && <Badge variant="outline">{profile.data.summary.depot}</Badge>}
                <Badge variant="outline">Status: {profile.data.summary.status}</Badge>
              </div>
            ) : 'Loading driver analytics...'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Timeframe</span>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as any)}
              className="px-3 py-1 border rounded-md"
            >
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={updateStatus.isPending} onClick={handleActivate}>Activate</Button>
            <Button variant="outline" size="sm" disabled={updateStatus.isPending} onClick={handleArchive}>Archive</Button>
            <Button variant="destructive" size="sm" disabled={updateStatus.isPending} onClick={handleTerminate}>Terminate</Button>
            <Button variant="outline" size="sm" disabled={!profile.data}><Download className="h-4 w-4 mr-2"/>Export</Button>
          </div>
        </div>

        <Separator className="my-4" />

        {profile.isLoading ? (
          <div className="py-16 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3" />
            Loading driver analytics...
          </div>
        ) : profile.error ? (
          <Card>
            <CardContent className="p-6 text-center">
              <AlertTriangle className="h-5 w-5 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-red-600">Failed to load driver profile</p>
            </CardContent>
          </Card>
        ) : profile.data ? (
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="trips">Trips</TabsTrigger>
              <TabsTrigger value="safety">Safety</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Safety Score</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-blue-500" />
                    <div className="text-2xl font-semibold">{profile.data.summary.overall_safety_score || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Trips (30d)</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <div className="text-2xl font-semibold">{profile.data.summary.total_trips_30d}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">High-risk Events (30d)</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    <div className="text-2xl font-semibold">{profile.data.summary.high_risk_events_30d}</div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="trips" className="mt-4">
              <Card>
                <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total Trips</p>
                    <p className="font-medium">{profile.data.trip_analytics.total_trips}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total KM</p>
                    <p className="font-medium">{profile.data.trip_analytics.total_km.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Avg Distance</p>
                    <p className="font-medium">{profile.data.trip_analytics.avg_trip_distance}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Vehicles Driven</p>
                    <p className="font-medium">{profile.data.trip_analytics.vehicles_driven}</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="safety" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">LYTX Events</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p>Total: {profile.data.safety_analytics.lytx_total_events}</p>
                    <p>Resolution Rate: {profile.data.safety_analytics.lytx_resolution_rate}%</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Guardian Events</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p>Total: {profile.data.safety_analytics.guardian_total_events}</p>
                    <p>Confirmation Rate: {profile.data.safety_analytics.guardian_confirmation_rate}%</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="events" className="mt-4">
              {eventsQuery.isLoading ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Loading events...
                </div>
              ) : eventsQuery.error ? (
                <div className="text-sm text-red-600">Failed to load events</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">LYTX</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm max-h-72 overflow-y-auto">
                      {eventsQuery.data?.lytx_events?.map((e, idx) => (
                        <div key={idx} className="flex items-center justify-between border-b pb-1">
                          <div className="truncate">
                            <div className="font-medium">{e.trigger_type}</div>
                            <div className="text-xs text-muted-foreground">{new Date(e.date).toLocaleString()}</div>
                          </div>
                          <Badge variant="outline">Score {e.score}</Badge>
                        </div>
                      ))}
                      {eventsQuery.data?.lytx_events?.length === 0 && (
                        <p className="text-muted-foreground">No recent LYTX events</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Guardian</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm max-h-72 overflow-y-auto">
                      {eventsQuery.data?.guardian_events?.map((e, idx) => (
                        <div key={idx} className="flex items-center justify-between border-b pb-1">
                          <div className="truncate">
                            <div className="font-medium">{e.event_type}</div>
                            <div className="text-xs text-muted-foreground">{new Date(e.date).toLocaleString()}</div>
                          </div>
                          <Badge variant="outline">{e.severity}</Badge>
                        </div>
                      ))}
                      {eventsQuery.data?.guardian_events?.length === 0 && (
                        <p className="text-muted-foreground">No recent Guardian events</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}


