import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertTriangle, Filter, Map as MapIcon } from "lucide-react";
import { AlertsDrawer } from '@/components/AlertsDrawer';
import { TankDetailsModal } from '@/components/TankDetailsModal';
import { useTanks } from '@/hooks/useTanks';
import { useFilterTanksBySubgroup } from '@/hooks/useUserPermissions';
import { KPICards } from '@/components/KPICards';
import { GroupSnapshotCards } from '@/components/GroupSnapshotCards';
import { TankStatusTable } from '@/components/TankStatusTable';
import { FuelInsightsPanel } from '@/components/FuelInsightsPanel';
import { useAlerts } from "@/hooks/useAlerts";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { Tank } from '@/types/fuel';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useGlobalModals } from '@/contexts/GlobalModalsContext';
import EditDipModal from '@/components/modals/EditDipModal';
import { logger } from '@/lib/logger';

// Helper function to format volume display
const formatVolume = (volume: number): string => {
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(1)}M L`;
  } else if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}K L`;
  } else {
    return `${Math.round(volume)} L`;
  }
};

// Helper function to calculate total volume for a group of tanks
const calculateTotalVolume = (tanks: Tank[]): number | null => {
  const tanksWithValidData = tanks.filter(t => 
    t.current_level != null && 
    t.current_level > 0 && 
    t.last_dip?.created_at
  );
  
  if (tanksWithValidData.length === 0) {
    return null;
  }
  
  return tanksWithValidData.reduce((total, tank) => total + (tank.current_level || 0), 0);
};

interface IndexProps {
  selectedGroup?: string | null;
}

export default function Index({ selectedGroup }: IndexProps) {
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

  const navigate = useNavigate();
  const [editDipModalOpen, setEditDipModalOpen] = useState(false);
  const [editDipTank, setEditDipTank] = useState<Tank | null>(null);
  const { openEditDip, openAlerts } = useGlobalModals();
  const tankTableRef = useRef<HTMLDivElement>(null);
  const suppressNextRowClick = useRef(false);

  const { tanks, isLoading: tanksLoading, error: tanksError } = useTanks();
  const { filterTanks, permissions, isLoading: permissionsLoading } = useFilterTanksBySubgroup();
  const { alerts, isLoading: alertsLoading } = useAlerts();

  // Apply subgroup filtering to tanks - only if permissions are loaded
  const permissionFilteredTanks = (!permissionsLoading && permissions) ? filterTanks(tanks || []) : (tanks || []);
  
  // Debug component state including subgroup filtering
  logger.debug('[INDEX] Component State:', {
    tanksLoading,
    permissionsLoading,
    tanksError: tanksError?.message,
    originalTanksCount: tanks?.length || 0,
    permissionFilteredCount: permissionFilteredTanks.length,
    alertsLoading,
    hasTanks: Array.isArray(tanks) && tanks.length > 0,
    userRole: permissions?.role,
    isAdmin: permissions?.isAdmin
  });

  // Debug subgroup filtering results
  if (permissions && !permissionsLoading && !permissions.isAdmin && tanks && tanks.length !== permissionFilteredTanks.length) {
    logger.debug('[INDEX] Subgroup filtering active', {
      original: tanks.length,
      filtered: permissionFilteredTanks.length,
      hidden: tanks.length - permissionFilteredTanks.length
    });
  }

  // Filter tanks based on selected group (using permission-filtered tanks as base)
  const filteredTanks = permissionFilteredTanks.filter(tank => {
    if (!selectedGroup) return true;
    // Map group IDs to group names for filtering
    const groupMapping: Record<string, string> = {
      'swan-transit': 'Swan Transit',
      'kalgoorlie': 'Kalgoorlie',
      'geraldton': 'Geraldton',
      'gsf-depots': 'GSF Depots',
      'bgc': 'BGC'
    };
    const groupName = groupMapping[selectedGroup];
    return tank.group_name === groupName;
  });

  // Optimized single-pass aggregation for group snapshots
  // Previously: O(n * g * f) with multiple filter() calls
  // Now: O(n) single pass through all tanks
  const groupSnapshots = useMemo(() => {
    if (permissionFilteredTanks.length === 0) return [];

    // Single-pass aggregation using Map
    type GroupAggregate = {
      total: number;
      critical: number;
      validCount: number;
      levelSum: number;
      volumeSum: number;
    };

    const aggregates = new Map<string, GroupAggregate>();

    // Initialize "all" aggregate
    aggregates.set('__all__', { total: 0, critical: 0, validCount: 0, levelSum: 0, volumeSum: 0 });

    // Single pass through all tanks
    for (const tank of permissionFilteredTanks) {
      const groupName = tank.group_name || 'Unknown';

      // Get or create group aggregate
      if (!aggregates.has(groupName)) {
        aggregates.set(groupName, { total: 0, critical: 0, validCount: 0, levelSum: 0, volumeSum: 0 });
      }

      const groupAgg = aggregates.get(groupName)!;
      const allAgg = aggregates.get('__all__')!;

      // Update totals
      groupAgg.total++;
      allAgg.total++;

      // Check if critical (days_to_min_level <= 2)
      if (tank.days_to_min_level !== null && tank.days_to_min_level <= 2) {
        groupAgg.critical++;
        allAgg.critical++;
      }

      // Check for valid level data (has recent dip with current level and safe level)
      if (tank.last_dip?.created_at && tank.current_level != null && tank.safe_level != null && tank.safe_level > 0) {
        const levelPercent = (tank.current_level / tank.safe_level) * 100;
        groupAgg.validCount++;
        groupAgg.levelSum += levelPercent;
        allAgg.validCount++;
        allAgg.levelSum += levelPercent;
      }

      // Sum volume if valid (has current level > 0 with recent dip)
      if (tank.current_level != null && tank.current_level > 0 && tank.last_dip?.created_at) {
        groupAgg.volumeSum += tank.current_level;
        allAgg.volumeSum += tank.current_level;
      }
    }

    // Convert to snapshot format
    const result = [];
    const now = new Date().toISOString();

    // All groups first
    const allAgg = aggregates.get('__all__')!;
    result.push({
      id: 'all',
      name: 'All Groups',
      totalTanks: allAgg.total,
      criticalTanks: allAgg.critical,
      averageLevel: allAgg.validCount > 0 ? Math.round(allAgg.levelSum / allAgg.validCount) : 0,
      totalVolume: allAgg.volumeSum > 0 ? allAgg.volumeSum : null,
      lastUpdated: now
    });

    // Individual groups (sorted alphabetically)
    const groupNames = Array.from(aggregates.keys()).filter(k => k !== '__all__').sort();
    for (const groupName of groupNames) {
      const agg = aggregates.get(groupName)!;
      result.push({
        id: groupName,
        name: groupName,
        totalTanks: agg.total,
        criticalTanks: agg.critical,
        averageLevel: agg.validCount > 0 ? Math.round(agg.levelSum / agg.validCount) : 0,
        totalVolume: agg.volumeSum > 0 ? agg.volumeSum : null,
        lastUpdated: now
      });
    }

    return result;
  }, [permissionFilteredTanks]);

  const handleTankClick = (tank: Tank) => {
    // This would typically update the route/state
    // TODO: Implement group navigation
  };

  const handleCardClick = (filter: string) => {
    // Navigate to tanks page with appropriate filters
    switch (filter) {
      case 'low-tanks':
        navigate('/tanks?status=low-fuel');
        break;
      case 'critical-days':
        navigate('/tanks?daysToMin=2');
        break;
      case 'total-stock':
      case 'total-ullage':
      case 'avg-days':
        // These cards navigate to general tanks view
        navigate('/tanks');
        break;
      default:
        navigate('/tanks');
    }
  };

  const handleGroupClick = (groupId: string) => {
    // This would typically update the route/state
    // TODO: Implement group navigation
  };

  const handleNeedsActionClick = () => {
    if (tankTableRef.current) {
      tankTableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (tanksLoading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size={32} text={`Loading ${tanksLoading ? 'fuel data' : ''}${tanksLoading && permissionsLoading ? ' and ' : ''}${permissionsLoading ? 'permissions' : ''}...`} />
      </div>
    );
  }

  if (tanksError) {
    return (
      <Card className="border-red-200 m-6">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-red-600 mb-2">Error Loading Data</h2>
          <p className="text-gray-600 text-center">{tanksError.message}</p>
        </CardContent>
      </Card>
    );
  }

  const criticalAlerts = alerts?.filter(alert => !alert.acknowledged_at && !alert.snoozed_until) || [];
  const displayTanks = selectedGroup ? filteredTanks : permissionFilteredTanks;

  return (
    <div className="min-h-screen w-full bg-muted overflow-x-hidden">
      <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12">
        {/* Unified Fuel Insights Panel */}
        <FuelInsightsPanel 
          tanks={displayTanks} 
          onNeedsActionClick={handleNeedsActionClick}
        />

        {/* Header Section */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl md:text-3xl font-bold text-gray-900 truncate">
                {selectedGroup
                  ? `${groupSnapshots.find(g => g.id === selectedGroup)?.name} Dashboard`
                  : 'Fuel Insights Dashboard'
                }
              </h1>
              <p className="text-xs sm:text-sm md:text-base text-gray-600 mt-1">
                {selectedGroup
                  ? `Monitoring ${filteredTanks.length} tanks`
                  : `Monitoring ${permissionFilteredTanks.length} fuel tanks`
                }
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openAlerts()}
                className="relative border-accent text-accent hover:bg-accent hover:text-accent-foreground flex-1 sm:flex-none"
              >
                <Bell className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Alerts</span>
                {criticalAlerts.length > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs animate-pulse"
                  >
                    {criticalAlerts.length}
                  </Badge>
                )}
              </Button>
              <Button
                size="sm"
                className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold rounded-lg shadow flex items-center flex-1 sm:flex-none"
                onClick={() => navigate('/map')}
              >
                <MapIcon className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">View </span>Map
              </Button>
            </div>
          </div>
        </div>

        {/* KPI Strip */}
        <div>
          <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 text-gray-900">Operational Overview</h2>
          <KPICards
            tanks={displayTanks}
            onCardClick={handleCardClick}
            selectedFilter={null}
          />
        </div>

        {/* Group Overview - Only show on global dashboard */}
        {!selectedGroup && (
          <div>
            <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 text-gray-900">Fuel Group Overview</h2>
            <GroupSnapshotCards
              groups={groupSnapshots}
              selectedGroup={null}
              onGroupClick={handleGroupClick}
            />
          </div>
        )}

        {/* Tank Status Table */}
        <div ref={tankTableRef}>
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">
              {selectedGroup ? 'Tank Status' : 'All Tank Status'}
            </h2>
          </div>
          <TankStatusTable
            tanks={displayTanks}
            onTankClick={handleTankClick}
            setEditDipTank={setEditDipTank}
            setEditDipModalOpen={setEditDipModalOpen}
            suppressNextRowClick={suppressNextRowClick}
          />
        </div>

        <EditDipModal
          isOpen={editDipModalOpen && !!editDipTank}
          onClose={() => {
            setEditDipModalOpen(false);
            setEditDipTank(null);
            suppressNextRowClick.current = false; // Reset the flag when modal closes
            // Force cleanup of any stuck body styles
            setTimeout(() => {
              document.body.style.removeProperty('pointer-events');
            }, 100);
          }}
          initialGroupId={editDipTank?.group_id || ''}
          initialTankId={editDipTank?.id || ''}
        />
      </div>
    </div>
  );
}
