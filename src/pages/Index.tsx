import React, { useState } from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Bell, Plus } from "lucide-react";
import { AddDipModal } from '@/components/AddDipModal';
import { AlertsDrawer } from '@/components/AlertsDrawer';
import { TankDetailsModal } from '@/components/TankDetailsModal';
import { useTanks } from '@/hooks/useTanks';
import { useAuth } from '@/hooks/useAuth';
import { KPICards } from '@/components/KPICards';
import { GroupSnapshotCards } from '@/components/GroupSnapshotCards';
import { FuelTable } from '@/components/FuelTable';
import { useAlerts } from "@/hooks/useAlerts";
import type { Tank } from '@/types/fuel';

export default function Index() {
  const { user } = useAuth();
  const [isAddDipOpen, setIsAddDipOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedTankId, setSelectedTankId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [tankDetailsOpen, setTankDetailsOpen] = useState(false);

  const { tanks, isLoading: tanksLoading, error: tanksError } = useTanks();
  const { alerts, isLoading: alertsLoading } = useAlerts();

  const selectedTank = tanks?.find(t => t.id === selectedTankId) ?? null;

  const filteredTanks = tanks?.filter(tank => {
    if (!selectedGroup) return true;
    return tank.group_id === selectedGroup;
  }) ?? [];

  const groupSnapshots = tanks ? [
    {
      id: "all",
      name: "All Groups",
      totalTanks: tanks.length,
      criticalTanks: tanks.filter(t => t.current_level_percent <= 10).length,
      averageLevel: Math.round(tanks.reduce((acc, t) => acc + (t.current_level_percent || 0), 0) / tanks.length),
      lastUpdated: new Date().toISOString()
    },
    ...Array.from(new Set(tanks.map(t => t.group_id))).map(groupId => {
      const groupTanks = tanks.filter(t => t.group_id === groupId);
      const groupName = groupTanks[0]?.tank_groups?.name || `Group ${groupId}`;
      return {
        id: groupId,
        name: groupName,
        totalTanks: groupTanks.length,
        criticalTanks: groupTanks.filter(t => t.current_level_percent <= 10).length,
        averageLevel: Math.round(groupTanks.reduce((acc, t) => acc + (t.current_level_percent || 0), 0) / groupTanks.length),
        lastUpdated: new Date().toISOString()
      };
    })
  ] : [];

  const handleTankClick = (tank: Tank) => {
    setSelectedTankId(tank.id);
    setIsAddDipOpen(true);
  };

  const handleCardClick = (filter: string) => {
    setSelectedFilter(filter === selectedFilter ? null : filter);
  };

  const handleGroupClick = (groupId: string) => {
    setSelectedGroup(groupId === selectedGroup ? null : groupId);
  };

  if (tanksError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Error Loading Data</h2>
          <p className="text-gray-600">{tanksError.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Fuel Management</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsAlertsOpen(true)}
            className="relative"
          >
            <Bell className="h-4 w-4" />
            {alerts && alerts.length > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                {alerts.length}
              </span>
            )}
          </Button>
          <Button onClick={() => setIsAddDipOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Dip Reading
          </Button>
        </div>
      </div>

      <KPICards
        tanks={tanks ?? []}
        onCardClick={handleCardClick}
        selectedFilter={selectedFilter}
      />

      <GroupSnapshotCards
        groups={groupSnapshots}
        selectedGroup={selectedGroup}
        onGroupClick={handleGroupClick}
      />

      <FuelTable
        tanks={filteredTanks}
        onTankClick={handleTankClick}
      />

      <AddDipModal
        open={isAddDipOpen}
        onOpenChange={setIsAddDipOpen}
        preSelectedTank={selectedTankId ?? undefined}
      />

      <TankDetailsModal
        tank={selectedTank}
        open={tankDetailsOpen}
        onOpenChange={setTankDetailsOpen}
      />

      <AlertsDrawer
        open={isAlertsOpen}
        onOpenChange={setIsAlertsOpen}
        tanks={tanks ?? []}
      />
    </div>
  );
}
