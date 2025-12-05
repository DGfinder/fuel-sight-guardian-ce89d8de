import React from 'react';
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
  TrendingUp,
  Database
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tank } from '@/types/fuel';
import { useRecentDips } from '@/hooks/useRecentDips';
import { useFilterTanksBySubgroup } from '@/hooks/useUserPermissions';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { logger } from '@/lib/logger';
import { shouldIncludeInAlerts } from '@/lib/tank-validation';
import { getFuelStatusWithValidation } from '@/lib/fuel-colors';

interface FuelInsightsPanelProps {
  tanks: Tank[];
  onNeedsActionClick: () => void;
}

export function FuelInsightsPanel({ tanks, onNeedsActionClick }: FuelInsightsPanelProps) {
  const { data: recentDips, isLoading: recentDipsLoading } = useRecentDips(30);
  const { filterTanks, permissions, isLoading: permissionsLoading } = useFilterTanksBySubgroup();

  // Filter recent dips to only show readings from authorized tanks
  const authorizedTankIds = new Set(tanks.map(tank => tank.id));
  const permissionFilteredRecentDips = recentDips?.filter(dip => 
    authorizedTankIds.has(dip.tank_id)
  ) || [];
  
  // Debug recent dips filtering
  if (recentDips && !permissions?.isAdmin && recentDips.length !== permissionFilteredRecentDips.length) {
    logger.debug('[RECENT DIPS] Filtering applied', {
      originalDips: recentDips.length,
      filteredDips: permissionFilteredRecentDips.length,
      hiddenDips: recentDips.length - permissionFilteredRecentDips.length,
      userRole: permissions?.role
    });
  }

  // Separate tanks by data validity - only count tanks with fresh data (<14 days) and valid configuration
  const validTanks = tanks.filter(t => shouldIncludeInAlerts(t));
  const noDataTanks = tanks.filter(t => !shouldIncludeInAlerts(t));

  // Only count valid tanks with actual low fuel
  const needsActionCount = validTanks.filter(t => {
    const status = getFuelStatusWithValidation(t);
    return status === 'critical' || status === 'low';
  }).length;

  // Fleet health only considers valid tanks to avoid skewing the percentage
  const fleetHealthPercentage = validTanks.length > 0
    ? Math.round((validTanks.filter(t => t.current_level_percent && t.current_level_percent > 50).length / validTanks.length) * 100)
    : 0;

  return (
    <div className="relative mb-6 backdrop-blur-xl bg-white/80 border border-white/30 rounded-xl shadow-xl overflow-hidden">
      {/* Commanding header */}
      <div className="bg-gradient-to-r from-[#008457]/5 to-slate-50/80 backdrop-blur-sm border-b border-white/20">
        <div className="px-4 md:px-6 py-4 md:py-5">
          {/* Professional Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#008457] rounded-xl shadow-lg">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-lg sm:text-xl font-bold text-gray-900">
                  Welcome back, {permissions?.display_name || 'User'}
                </p>
                <p className="text-sm text-gray-500">Fleet Status at a Glance</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white/50 px-4 py-2 rounded-lg">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#008457]" />
                <span className="font-semibold text-gray-900">{tanks.length}</span>
                <span className="text-gray-500">tanks</span>
              </div>
              <div className="w-px h-4 bg-gray-200"></div>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-green-600 font-semibold text-sm">Live</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Professional KPI Cards */}
      <div className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          
          {/* Critical Alerts Card */}
          <Card
            className={cn(
              "group cursor-pointer transition-all duration-300 border shadow-lg hover:shadow-xl hover:-translate-y-1",
              "backdrop-blur-md",
              needsActionCount > 0
                ? "bg-red-50/80 border-red-200/50 hover:bg-red-50/90"
                : "bg-green-50/80 border-green-200/50 hover:bg-green-50/90"
            )}
            onClick={onNeedsActionClick}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2.5 rounded-xl transition-all duration-300",
                    needsActionCount > 0
                      ? "bg-red-100/80 shadow-lg shadow-red-200/50"
                      : "bg-green-100/80 shadow-lg shadow-green-200/50"
                  )}>
                    {needsActionCount > 0 ? (
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    ) : (
                      <Shield className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-gray-900">{needsActionCount}</p>
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
                  <Badge variant="destructive" className="mt-2 text-xs shadow-sm backdrop-blur-sm animate-pulse">
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
              <Card className="group cursor-pointer transition-all duration-300 border shadow-lg hover:shadow-xl hover:-translate-y-1 backdrop-blur-md bg-blue-50/80 border-blue-200/50 hover:bg-blue-50/90">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-blue-100/80 rounded-xl shadow-lg shadow-blue-200/50 transition-all duration-300">
                        <Clock className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-gray-900">{permissionFilteredRecentDips.length}</p>
                        <p className="text-sm font-medium text-gray-600">Recent Updates</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      {permissionFilteredRecentDips && permissionFilteredRecentDips.length > 0 
                        ? `Latest: ${permissionFilteredRecentDips[0]?.tank_location}` 
                        : "No recent activity"
                      }
                    </p>
                    {permissionFilteredRecentDips && permissionFilteredRecentDips.length > 0 && (
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
                ) : permissionFilteredRecentDips && permissionFilteredRecentDips.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {permissionFilteredRecentDips.slice(0, 8).map((dip) => (
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

          {/* Data Quality Alerts Card */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Card
                className={cn(
                  "group cursor-pointer transition-all duration-300 border shadow-lg hover:shadow-xl hover:-translate-y-1",
                  "backdrop-blur-md",
                  noDataTanks.length > 0
                    ? "bg-amber-50/80 border-amber-200/50 hover:bg-amber-50/90"
                    : "bg-green-50/80 border-green-200/50 hover:bg-green-50/90"
                )}
                onClick={onNeedsActionClick}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2.5 rounded-xl transition-all duration-300",
                        noDataTanks.length > 0
                          ? "bg-amber-100/80 shadow-lg shadow-amber-200/50"
                          : "bg-green-100/80 shadow-lg shadow-green-200/50"
                      )}>
                        <Database className={cn(
                          "h-5 w-5",
                          noDataTanks.length > 0 ? "text-amber-600" : "text-green-600"
                        )} />
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-gray-900">{noDataTanks.length}</p>
                        <p className="text-sm font-medium text-gray-600">Data Quality Alerts</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      {noDataTanks.length > 0
                        ? "Tanks need fresh readings or configuration"
                        : "All tanks have valid data"
                      }
                    </p>
                    {noDataTanks.length > 0 && (
                      <Badge variant="outline" className="mt-2 text-xs border-amber-300 text-amber-700 bg-amber-50">
                        <Clock className="w-3 h-3 mr-1" />
                        Stale Data
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="text-sm">
                These tanks are excluded from low-fuel alerts because their data is older than 14 days
                or they're missing configuration (min/safe levels).
              </p>
            </TooltipContent>
          </Tooltip>

          {/* Fleet Status Card */}
          <Card className="border border-[#008457]/30 bg-green-50/80 backdrop-blur-md shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#008457]/20 rounded-xl shadow-lg shadow-green-200/50 transition-all duration-300">
                    <TrendingUp className="h-5 w-5 text-[#008457]" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-gray-900">{fleetHealthPercentage}%</p>
                    <p className="text-sm font-medium text-gray-600">Fleet Health</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  {validTanks.filter(t => t.current_level_percent && t.current_level_percent > 50).length} of {validTanks.length} tanks above 50%
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
        <div className="mt-4 md:mt-6 pt-3 md:pt-4 border-t border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs sm:text-sm text-gray-600">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Operational</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Last sync:</span> {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 text-[#008457] font-medium">
              <Activity className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Real-time monitoring</span>
              <span className="sm:hidden">Live</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Professional Fuel Management Dashboard Header
