import React, { useEffect, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  Clock, 
  Users, 
  Activity,
  Droplets,
  ChevronRight,
  Bell,
  BarChart3,
  Shield,
  TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tank } from '@/types/fuel';
import { useFavourites } from '@/hooks/useFavourites';
import { useRecentDips } from '@/hooks/useRecentDips';
import { supabase } from '@/lib/supabase';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { formatDistanceToNow } from 'date-fns';

interface FuelInsightsPanelProps {
  tanks: Tank[];
  onNeedsActionClick: () => void;
}

export function FuelInsightsPanel({ tanks, onNeedsActionClick }: FuelInsightsPanelProps) {
  const [user, setUser] = useState(null);
  const { data: recentDips, isLoading: recentDipsLoading } = useRecentDips(30);

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

  const needsActionCount = tanks.filter(
    t => !!t.last_dip?.created_at && ((t.days_to_min_level !== null && t.days_to_min_level <= 2) || t.current_level_percent <= 0.2)
  ).length;

  const fleetHealthPercentage = Math.round((tanks.filter(t => t.current_level_percent && t.current_level_percent > 50).length / tanks.length) * 100);

  return (
    <div className="relative mb-6 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      {/* Subtle header gradient */}
      <div className="bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-100">
        <div className="px-6 py-4">
          {/* Professional Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#008457] rounded-lg shadow-sm">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Welcome back</p>
                <p className="text-gray-900 font-semibold">
                  {user?.email?.split('@')[0] || 'User'}
                </p>
              </div>
            </div>
            
            <div className="text-right">
              <h1 className="text-xl font-semibold text-gray-900">Fuel Management System</h1>
              <div className="flex items-center gap-2 text-gray-600 text-sm">
                <Activity className="h-4 w-4" />
                <span>Monitoring {tanks.length} tanks</span>
                <div className="w-1 h-1 bg-green-500 rounded-full"></div>
                <span className="text-green-600 font-medium">Live</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Professional KPI Cards */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Critical Alerts Card */}
          <Card 
            className={cn(
              "group cursor-pointer transition-all duration-200 hover:shadow-md border",
              needsActionCount > 0 
                ? "border-red-200 bg-red-50 hover:bg-red-100" 
                : "border-green-200 bg-green-50 hover:bg-green-100"
            )}
            onClick={onNeedsActionClick}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2.5 rounded-lg",
                    needsActionCount > 0 ? "bg-red-100" : "bg-green-100"
                  )}>
                    {needsActionCount > 0 ? (
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    ) : (
                      <Shield className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{needsActionCount}</p>
                    <p className="text-sm font-medium text-gray-600">Critical Alerts</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </div>
              
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  {needsActionCount > 0 ? "Immediate attention required" : "All systems normal"}
                </p>
                {needsActionCount > 0 && (
                  <Badge variant="destructive" className="mt-2 text-xs">
                    <Bell className="w-3 h-3 mr-1" />
                    Action Required
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity Card */}
          <Popover>
            <PopoverTrigger asChild>
              <Card className="group cursor-pointer transition-all duration-200 hover:shadow-md border border-blue-200 bg-blue-50 hover:bg-blue-100">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-blue-100 rounded-lg">
                        <Clock className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{recentDips?.length || 0}</p>
                        <p className="text-sm font-medium text-gray-600">Recent Updates</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      {recentDips && recentDips.length > 0 
                        ? `Latest: ${recentDips[0]?.tank_location}` 
                        : "No recent activity"
                      }
                    </p>
                    {recentDips && recentDips.length > 0 && (
                      <Badge variant="outline" className="mt-2 text-xs border-blue-200 text-blue-700">
                        <Activity className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </PopoverTrigger>
            
            <PopoverContent 
              align="end" 
              className="w-80 p-0 bg-white border shadow-xl"
            >
              <div className="p-4 border-b bg-gray-50">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-600" />
                  Recent Dip Readings
                </h3>
              </div>
              
              <div className="max-h-64 overflow-y-auto">
                {recentDipsLoading ? (
                  <div className="p-6 text-center">
                    <div className="animate-spin h-6 w-6 border-2 border-gray-200 border-t-gray-600 rounded-full mx-auto mb-3"></div>
                    <p className="text-gray-500 text-sm">Loading...</p>
                  </div>
                ) : recentDips && recentDips.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {recentDips.slice(0, 8).map((dip) => (
                      <div key={dip.id} className="p-3 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="p-1.5 bg-gray-100 rounded">
                            <Droplets className="h-3 w-3 text-gray-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">
                              {dip.tank_location}
                            </p>
                            <p className="text-xs text-gray-600 mb-1">
                              {dip.value.toLocaleString()}L
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(dip.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-gray-500">
                    <Clock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm">No recent readings</p>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Fleet Status Card */}
          <Card className="border border-[#008457]/20 bg-green-50">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#008457]/10 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-[#008457]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{fleetHealthPercentage}%</p>
                    <p className="text-sm font-medium text-gray-600">Fleet Health</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  {tanks.filter(t => t.current_level_percent && t.current_level_percent > 50).length} tanks above 50%
                </p>
                <Badge variant="outline" className="mt-2 text-xs border-green-200 text-green-700">
                  <BarChart3 className="w-3 h-3 mr-1" />
                  Operational
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status Bar */}
        <div className="mt-6 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>System Operational</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Last sync: {new Date().toLocaleTimeString()}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[#008457] font-medium">
              <Activity className="h-4 w-4" />
              <span>Real-time monitoring active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Professional Fuel Management Dashboard Header
