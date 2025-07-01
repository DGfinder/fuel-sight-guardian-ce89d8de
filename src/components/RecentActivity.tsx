import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Droplets, TruckIcon, User } from "lucide-react";
import { supabase } from '@/lib/supabase';
import { useUserPermissions } from '@/hooks/useUserPermissions';

interface ActivityItem {
  id: string;
  type: 'dip' | 'delivery' | 'alert';
  title: string;
  description: string;
  timestamp: string;
  location: string;
  user?: string;
}

interface DipReading {
  id: string;
  value: number;
  created_at: string;
  fuel_tanks: {
    name: string;
    tank_groups: {
      name: string;
    };
  };
}

interface TankAlert {
  id: string;
  alert_type: string;
  message: string;
  created_at: string;
  fuel_tanks: {
    name: string;
    tank_groups: {
      name: string;
    };
  };
}

export function RecentActivity() {
  const { data: permissions } = useUserPermissions();

  // Fetch recent dip readings
  const { data: recentDips, isLoading: dipsLoading, error: dipsError } = useQuery({
    queryKey: ['recent-dips', permissions?.userId],
    queryFn: async (): Promise<DipReading[]> => {
      console.log('🔍 [RECENT ACTIVITY DEBUG] Fetching recent dips...');
      
      if (!permissions?.userId) {
        console.log('🔍 [RECENT ACTIVITY DEBUG] No user permissions, skipping dips query');
        return [];
      }

      let query = supabase
        .from('dip_readings')
        .select(`
          id,
          value,
          created_at,
          fuel_tanks (
            name,
            tank_groups (
              name
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      // Apply RBAC filtering if not admin
      if (!permissions.isAdmin) {
        console.log('🔍 [RECENT ACTIVITY DEBUG] Applying RBAC filter for non-admin user');
        const accessibleGroupIds = permissions.accessibleGroups.map(g => g.id);
        query = query.in('fuel_tanks.group_id', accessibleGroupIds);
      } else {
        console.log('🔍 [RECENT ACTIVITY DEBUG] Admin user - no RBAC filtering applied');
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ [RECENT ACTIVITY DEBUG] Error fetching recent dips:', error);
        throw error;
      }

      console.log('✅ [RECENT ACTIVITY DEBUG] Recent dips fetched:', {
        count: data?.length || 0,
        firstDip: data?.[0],
        accessibleGroups: permissions.accessibleGroups.map(g => g.name)
      });

      return (data as unknown as DipReading[]) || [];
    },
    enabled: !!permissions?.userId
  });

  // Fetch recent alerts
  const { data: recentAlerts, isLoading: alertsLoading, error: alertsError } = useQuery({
    queryKey: ['recent-alerts', permissions?.userId],
    queryFn: async (): Promise<TankAlert[]> => {
      console.log('🔍 [RECENT ACTIVITY DEBUG] Fetching recent alerts...');
      
      if (!permissions?.userId) {
        console.log('🔍 [RECENT ACTIVITY DEBUG] No user permissions, skipping alerts query');
        return [];
      }

      let query = supabase
        .from('tank_alerts')
        .select(`
          id,
          alert_type,
          message,
          created_at,
          fuel_tanks (
            name,
            tank_groups (
              name
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      // Apply RBAC filtering if not admin
      if (!permissions.isAdmin) {
        console.log('🔍 [RECENT ACTIVITY DEBUG] Applying RBAC filter for alerts');
        const accessibleGroupIds = permissions.accessibleGroups.map(g => g.id);
        query = query.in('fuel_tanks.group_id', accessibleGroupIds);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ [RECENT ACTIVITY DEBUG] Error fetching recent alerts:', error);
        throw error;
      }

      console.log('✅ [RECENT ACTIVITY DEBUG] Recent alerts fetched:', {
        count: data?.length || 0,
        firstAlert: data?.[0]
      });

      return (data as unknown as TankAlert[]) || [];
    },
    enabled: !!permissions?.userId
  });

  // Combine and format activities
  const activities: ActivityItem[] = React.useMemo(() => {
    console.log('🔍 [RECENT ACTIVITY DEBUG] Combining activities...');
    
    const dipActivities: ActivityItem[] = (recentDips || []).map(dip => ({
      id: `dip-${dip.id}`,
      type: 'dip' as const,
      title: 'Dip Reading Added',
      description: `${dip.value}L recorded`,
      timestamp: dip.created_at,
      location: dip.fuel_tanks?.name || 'Unknown Tank',
      user: 'System'
    }));

    const alertActivities: ActivityItem[] = (recentAlerts || []).map(alert => ({
      id: `alert-${alert.id}`,
      type: 'alert' as const,
      title: 'Tank Alert',
      description: alert.message,
      timestamp: alert.created_at,
      location: alert.fuel_tanks?.name || 'Unknown Tank'
    }));

    const allActivities = [...dipActivities, ...alertActivities]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    console.log('✅ [RECENT ACTIVITY DEBUG] Combined activities:', {
      dipCount: dipActivities.length,
      alertCount: alertActivities.length,
      totalActivities: allActivities.length,
      activities: allActivities.map(a => ({ type: a.type, location: a.location, timestamp: a.timestamp }))
    });

    return allActivities;
  }, [recentDips, recentAlerts]);

  const isLoading = dipsLoading || alertsLoading;
  const hasError = dipsError || alertsError;

  console.log('🔍 [RECENT ACTIVITY DEBUG] Component state:', {
    isLoading,
    hasError,
    activitiesCount: activities.length,
    permissions: permissions ? {
      isAdmin: permissions.isAdmin,
      role: permissions.role,
      accessibleGroups: permissions.accessibleGroups.map(g => g.name)
    } : null
  });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'dip': return <Droplets className="w-4 h-4 text-primary" />;
      case 'delivery': return <TruckIcon className="w-4 h-4 text-green-600" />;
      case 'alert': return <Clock className="w-4 h-4 text-fuel-critical" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getActivityBadge = (type: string) => {
    switch (type) {
      case 'dip': return <Badge variant="outline" className="text-primary border-primary">Dip</Badge>;
      case 'delivery': return <Badge className="bg-green-600 text-white">Delivery</Badge>;
      case 'alert': return <Badge className="bg-fuel-critical text-white">Alert</Badge>;
      default: return <Badge variant="outline">Event</Badge>;
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffHours = Math.floor((now.getTime() - activityTime.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (isLoading) {
    return (
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500">Loading recent activity...</div>
        </CardContent>
      </Card>
    );
  }

  if (hasError) {
    console.error('❌ [RECENT ACTIVITY DEBUG] Error in RecentActivity component:', { dipsError, alertsError });
    return (
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-red-500">Error loading recent activity</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activities.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No recent activity</p>
            <p className="text-sm text-gray-400 mt-1">
              {permissions?.isAdmin ? 'No activity found across all groups' : `No activity found in your accessible groups: ${permissions?.accessibleGroups.map(g => g.name).join(', ')}`}
            </p>
          </div>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex-shrink-0 mt-0.5">
                {getActivityIcon(activity.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-sm text-gray-900 truncate">
                    {activity.title}
                  </h4>
                  {getActivityBadge(activity.type)}
                </div>
                <p className="text-sm text-gray-600">{activity.description}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                  <span>{activity.location}</span>
                  <span>•</span>
                  <span>{formatTimeAgo(activity.timestamp)}</span>
                  {activity.user && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>{activity.user}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
