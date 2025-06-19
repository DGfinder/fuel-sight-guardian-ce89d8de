import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertTriangle, Filter, PlusCircle } from "lucide-react";
import { AlertsDrawer } from '@/components/AlertsDrawer';
import { TankDetailsModal } from '@/components/TankDetailsModal';
import { useTanks } from '@/hooks/useTanks';
import { KPICards } from '@/components/KPICards';
import { GroupSnapshotCards } from '@/components/GroupSnapshotCards';
import { TankStatusTable } from '@/components/TankStatusTable';
import { FuelInsightsPanel } from '@/components/FuelInsightsPanel';
import { useAlerts } from "@/hooks/useAlerts";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { Tank } from '@/types/fuel';
import { StickyMobileNav } from '@/components/StickyMobileNav';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FuelDipForm } from '@/components/fuel-dip/FuelDipForm';
import { supabase } from '@/lib/supabase';
import EditDipModal from '@/components/modals/EditDipModal';
import { useTankModal } from '@/contexts/TankModalContext';

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

  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [dipModalOpen, setDipModalOpen] = useState(false);
  const [editDipModalOpen, setEditDipModalOpen] = useState(false);
  const [editDipTank, setEditDipTank] = useState<Tank | null>(null);
  const tankTableRef = useRef<HTMLDivElement>(null);

  const { tanks, isLoading: tanksLoading, error: tanksError } = useTanks();
  const { alerts, isLoading: alertsLoading } = useAlerts();

  const { openModal } = useTankModal();

  // Filter tanks based on selected group
  const filteredTanks = tanks?.filter(tank => {
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
  }) ?? [];

  const allGroupNames = Array.from(new Set(tanks?.map(t => t.group_name).filter(Boolean)));
  const groupSnapshots = tanks ? [
    {
      id: "all",
      name: "All Groups",
      totalTanks: tanks.length,
      criticalTanks: tanks.filter(t => t.days_to_min_level !== null && t.days_to_min_level <= 2).length,
      averageLevel: tanks.filter(t => t.last_dip?.created_at && t.current_level != null && t.safe_level != null).length > 0
        ? Math.round(
            tanks.filter(t => t.last_dip?.created_at && t.current_level != null && t.safe_level != null)
              .reduce((acc, t) => acc + ((t.current_level / t.safe_level) * 100), 0) /
            tanks.filter(t => t.last_dip?.created_at && t.current_level != null && t.safe_level != null).length
          )
        : 0,
      lastUpdated: new Date().toISOString()
    },
    ...allGroupNames.map(groupName => {
      const groupTanks = tanks.filter(t => t.group_name === groupName);
      const groupTanksWithDip = groupTanks.filter(t => t.last_dip?.created_at && t.current_level != null && t.safe_level != null);
      return {
        id: groupName,
        name: groupName,
        totalTanks: groupTanks.length,
        criticalTanks: groupTanks.filter(t => t.days_to_min_level !== null && t.days_to_min_level <= 2).length,
        averageLevel: groupTanksWithDip.length > 0
          ? Math.round(groupTanksWithDip.reduce((acc, t) => acc + ((t.current_level / t.safe_level) * 100), 0) / groupTanksWithDip.length)
          : 0,
        lastUpdated: new Date().toISOString()
      };
    })
  ] : [];

  const handleTankClick = (tank: Tank) => {
    openModal(tank);
  };

  const handleCardClick = (filter: string) => {
    setSelectedFilter(filter === selectedFilter ? null : filter);
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

  if (tanksLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size={32} text="Loading fuel data..." />
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
  const displayTanks = selectedGroup ? filteredTanks : tanks || [];

  return (
    <div className="min-h-screen w-full bg-muted">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-20">
        {/* Unified Fuel Insights Panel */}
        <FuelInsightsPanel 
          tanks={displayTanks} 
          onNeedsActionClick={handleNeedsActionClick}
        />

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {selectedGroup 
                ? `${groupSnapshots.find(g => g.id === selectedGroup)?.name} Dashboard` 
                : 'Fuel Insights Dashboard'
              }
            </h1>
            <p className="text-gray-600 mt-1">
              {selectedGroup 
                ? `Monitoring ${filteredTanks.length} tanks in this group`
                : `Real-time monitoring across ${tanks?.length || 0} fuel tanks`
              }
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setIsAlertsOpen(true)}
              className="relative border-gray-300 hover:border-[#008457] hover:text-[#008457]"
            >
              <Bell className="h-4 w-4 mr-2" />
              Alerts
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
              className="bg-[#008457] hover:bg-[#006b47] text-white font-bold text-base rounded-lg py-2 px-4 shadow flex items-center"
              onClick={() => setDipModalOpen(true)}
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Add Dip Reading
            </Button>
          </div>
          <Dialog open={dipModalOpen} onOpenChange={setDipModalOpen}>
            <DialogContent className="max-w-xl">
              <FuelDipForm />
            </DialogContent>
          </Dialog>
        </div>

        {/* KPI Strip */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Operational Overview</h2>
          <KPICards
            tanks={displayTanks}
            onCardClick={handleCardClick}
            selectedFilter={selectedFilter}
          />
        </div>

        {/* Group Overview - Only show on global dashboard */}
        {!selectedGroup && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Fuel Group Overview</h2>
            <GroupSnapshotCards
              groups={groupSnapshots}
              selectedGroup={null}
              onGroupClick={handleGroupClick}
            />
          </div>
        )}

        {/* Tank Status Table */}
        <div ref={tankTableRef}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {selectedGroup ? 'Tank Status' : 'All Tank Status'}
            </h2>
            {selectedFilter && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedFilter(null)}
                className="border-gray-300 hover:border-[#008457] hover:text-[#008457]"
              >
                <Filter className="w-4 h-4 mr-2" />
                Clear Filter
              </Button>
            )}
          </div>
          <TankStatusTable
            tanks={displayTanks}
            onTankClick={handleTankClick}
            setEditDipTank={setEditDipTank}
            setEditDipModalOpen={setEditDipModalOpen}
          />
        </div>

        <AlertsDrawer
          open={isAlertsOpen}
          onOpenChange={setIsAlertsOpen}
          tanks={tanks ?? []}
        />
        
        <StickyMobileNav />

        <EditDipModal
          isOpen={editDipModalOpen && !!editDipTank}
          onClose={() => {
            setEditDipModalOpen(false);
            setEditDipTank(null);
          }}
          initialGroupId={editDipTank?.group_id || ''}
          initialTankId={editDipTank?.id || ''}
        />
      </div>
    </div>
  );
}
