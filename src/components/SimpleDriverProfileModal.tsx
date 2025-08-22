/**
 * Simple Driver Profile Modal
 * Clean tabbed interface based on tank modal structure
 * Uses reliable data fetching without complex database functions
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  User,
  Car,
  Shield,
  Activity,
  TrendingUp,
  Calendar,
  MapPin,
  AlertTriangle,
  Clock,
  FileText,
  X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import DriverProfileService from '@/services/driverProfileService';

interface SimpleDriverProfile {
  id: string;
  first_name: string;
  last_name: string;
  employee_id?: string;
  fleet: string;
  depot?: string;
  status: string;
  
  // 30-day stats
  lytx_events_30d: number;
  guardian_events_30d: number;
  total_trips_30d: number;
  total_km_30d: number;
  total_hours_30d: number;
  active_days_30d: number;
  last_activity_date?: string;
  
  // Safety metrics
  high_risk_events_30d: number;
  coaching_sessions_30d: number;
  overall_safety_score?: number;
}

interface SimpleDriverProfileModalProps {
  driverId: string;
  driverName: string;
  isOpen: boolean;
  onClose: () => void;
}

// Simple hook that uses existing working methods
function useSimpleDriverProfile(driverId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['simpleDriverProfile', driverId],
    queryFn: async () => {
      // Use existing working method
      const summaries = await DriverProfileService.getDriverSummaries();
      return summaries.find(d => d.id === driverId) || null;
    },
    enabled: enabled && !!driverId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

// Stat card component
const StatCard: React.FC<{ title: string; value: string | number; icon?: React.ReactNode; color?: string }> = ({ 
  title, 
  value, 
  icon, 
  color = "text-gray-900" 
}) => (
  <div className="p-3 bg-gray-50 rounded-lg border">
    <div className="flex items-center justify-between mb-1">
      <div className="text-xs text-gray-500">{title}</div>
      {icon && <div className="text-gray-400">{icon}</div>}
    </div>
    <div className={`text-lg font-semibold ${color}`}>
      {value}
    </div>
  </div>
);

export const SimpleDriverProfileModal: React.FC<SimpleDriverProfileModalProps> = ({
  driverId,
  driverName,
  isOpen,
  onClose,
}) => {
  const [selectedTab, setSelectedTab] = useState('overview');

  const { 
    data: driver, 
    isLoading, 
    error 
  } = useSimpleDriverProfile(driverId, isOpen);

  if (!isOpen) return null;

  const getDaysSinceActivity = (lastActivity: string | null): number | null => {
    if (!lastActivity) return null;
    return Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));
  };

  const getRiskLevel = (driver: SimpleDriverProfile): 'critical' | 'high' | 'medium' | 'low' => {
    if (driver.high_risk_events_30d > 0) return 'critical';
    if ((driver.lytx_events_30d + driver.guardian_events_30d) > 3) return 'high';
    if ((driver.lytx_events_30d + driver.guardian_events_30d) > 0) return 'medium';
    return 'low';
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">
                {driverName || 'Loading...'}
              </DialogTitle>
              {driver && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>{driver.fleet}</span>
                  {driver.depot && (
                    <>
                      <span>•</span>
                      <span>{driver.depot}</span>
                    </>
                  )}
                  <Badge 
                    variant={driver.status === 'Active' ? 'secondary' : 'outline'}
                    className="ml-2"
                  >
                    {driver.status}
                  </Badge>
                </div>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        {error ? (
          <div className="flex-grow flex items-center justify-center">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Profile</h3>
              <p className="text-gray-500 mb-4">Unable to load driver data. Please try again.</p>
              <Button onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex-grow flex flex-col">
            <TabsList className="px-6 py-2 border-b bg-gray-50">
              <TabsTrigger value="overview">
                <User className="w-4 h-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="trips">
                <Car className="w-4 h-4 mr-2" />
                Trips
              </TabsTrigger>
              <TabsTrigger value="safety">
                <Shield className="w-4 h-4 mr-2" />
                Safety
                {driver && (driver.lytx_events_30d + driver.guardian_events_30d) > 0 && (
                  <Badge className="ml-2 bg-orange-500 text-white text-xs px-1.5 py-0.5">
                    {driver.lytx_events_30d + driver.guardian_events_30d}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="guardian">
                <Activity className="w-4 h-4 mr-2" />
                Guardian
                {driver && driver.guardian_events_30d > 0 && (
                  <Badge className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5">
                    {driver.guardian_events_30d}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="performance">
                <TrendingUp className="w-4 h-4 mr-2" />
                Performance
              </TabsTrigger>
            </TabsList>

            <div className="flex-grow overflow-y-auto">
              {isLoading ? (
                <div className="p-6 space-y-6">
                  {/* Loading skeletons */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="p-3 bg-gray-100 rounded-lg animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                        <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : driver ? (
                <>
                  {/* Overview Tab */}
                  <TabsContent value="overview" className="p-6 space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <StatCard 
                        title="Total Trips" 
                        value={driver.total_trips_30d} 
                        icon={<Car className="w-4 h-4" />}
                      />
                      <StatCard 
                        title="Total KM" 
                        value={driver.total_km_30d.toLocaleString()} 
                        icon={<MapPin className="w-4 h-4" />}
                      />
                      <StatCard 
                        title="LYTX Events" 
                        value={driver.lytx_events_30d} 
                        icon={<Shield className="w-4 h-4" />}
                        color={driver.lytx_events_30d > 0 ? 'text-orange-600' : 'text-green-600'}
                      />
                      <StatCard 
                        title="Active Days" 
                        value={driver.active_days_30d} 
                        icon={<Calendar className="w-4 h-4" />}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <User className="w-5 h-5 text-blue-600" />
                            Driver Details
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span className="text-sm text-gray-500">Employee ID</span>
                              <p className="font-medium">{driver.employee_id || 'N/A'}</p>
                            </div>
                            <div>
                              <span className="text-sm text-gray-500">Status</span>
                              <p className="font-medium">{driver.status}</p>
                            </div>
                            <div>
                              <span className="text-sm text-gray-500">Fleet</span>
                              <p className="font-medium">{driver.fleet}</p>
                            </div>
                            <div>
                              <span className="text-sm text-gray-500">Depot</span>
                              <p className="font-medium">{driver.depot || 'N/A'}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Activity className="w-5 h-5 text-green-600" />
                            Recent Activity
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div>
                              <span className="text-sm text-gray-500">Last Activity</span>
                              <p className="font-medium">
                                {driver.last_activity_date ? (
                                  (() => {
                                    const days = getDaysSinceActivity(driver.last_activity_date);
                                    return days === 0 ? 'Today' : 
                                           days === 1 ? '1 day ago' :
                                           `${days} days ago`;
                                  })()
                                ) : 'No data'}
                              </p>
                            </div>
                            <div>
                              <span className="text-sm text-gray-500">Risk Level</span>
                              <p className={`font-medium capitalize ${getRiskColor(getRiskLevel(driver))}`}>
                                {getRiskLevel(driver)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  {/* Trips Tab */}
                  <TabsContent value="trips" className="p-6 space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <StatCard 
                        title="Total Trips" 
                        value={driver.total_trips_30d} 
                        icon={<Car className="w-4 h-4" />}
                      />
                      <StatCard 
                        title="Distance" 
                        value={`${driver.total_km_30d.toLocaleString()} km`} 
                        icon={<MapPin className="w-4 h-4" />}
                      />
                      <StatCard 
                        title="Hours Driven" 
                        value={`${driver.total_hours_30d.toFixed(1)}h`} 
                        icon={<Clock className="w-4 h-4" />}
                      />
                      <StatCard 
                        title="Avg per Day" 
                        value={driver.active_days_30d > 0 ? (driver.total_trips_30d / driver.active_days_30d).toFixed(1) : '0'} 
                        icon={<TrendingUp className="w-4 h-4" />}
                      />
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle>Trip Analytics (Last 30 Days)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center text-gray-500 py-8">
                          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Detailed trip analytics coming soon</p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Safety Tab */}
                  <TabsContent value="safety" className="p-6 space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <StatCard 
                        title="LYTX Events" 
                        value={driver.lytx_events_30d} 
                        icon={<Shield className="w-4 h-4" />}
                        color={driver.lytx_events_30d > 0 ? 'text-orange-600' : 'text-green-600'}
                      />
                      <StatCard 
                        title="High Risk Events" 
                        value={driver.high_risk_events_30d} 
                        icon={<AlertTriangle className="w-4 h-4" />}
                        color={driver.high_risk_events_30d > 0 ? 'text-red-600' : 'text-green-600'}
                      />
                      <StatCard 
                        title="Coaching Sessions" 
                        value={driver.coaching_sessions_30d} 
                        icon={<FileText className="w-4 h-4" />}
                      />
                      <StatCard 
                        title="Safety Score" 
                        value={driver.overall_safety_score || 'N/A'} 
                        icon={<TrendingUp className="w-4 h-4" />}
                      />
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle>Safety Performance</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center text-gray-500 py-8">
                          <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Detailed safety analytics coming soon</p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Guardian Tab */}
                  <TabsContent value="guardian" className="p-6 space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <StatCard 
                        title="Guardian Events" 
                        value={driver.guardian_events_30d} 
                        icon={<Activity className="w-4 h-4" />}
                        color={driver.guardian_events_30d > 0 ? 'text-red-600' : 'text-green-600'}
                      />
                      <StatCard 
                        title="Event Rate" 
                        value={driver.total_trips_30d > 0 ? `${(driver.guardian_events_30d / driver.total_trips_30d * 100).toFixed(1)}%` : '0%'} 
                        icon={<TrendingUp className="w-4 h-4" />}
                      />
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle>Guardian Monitoring</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center text-gray-500 py-8">
                          <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Detailed Guardian analytics coming soon</p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Performance Tab */}
                  <TabsContent value="performance" className="p-6 space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <StatCard 
                        title="Efficiency Score" 
                        value={driver.active_days_30d > 0 ? Math.round(driver.total_km_30d / driver.active_days_30d) : 0} 
                        icon={<TrendingUp className="w-4 h-4" />}
                      />
                      <StatCard 
                        title="Utilization" 
                        value={`${Math.round((driver.active_days_30d / 30) * 100)}%`} 
                        icon={<Calendar className="w-4 h-4" />}
                      />
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle>Performance Analytics</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center text-gray-500 py-8">
                          <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Detailed performance analytics coming soon</p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </>
              ) : (
                <div className="flex-grow flex items-center justify-center">
                  <div className="text-center">
                    <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Found</h3>
                    <p className="text-gray-500">Driver profile could not be found.</p>
                  </div>
                </div>
              )}
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};