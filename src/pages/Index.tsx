
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertTriangle, Users, Activity } from "lucide-react";
import { AlertsDrawer } from '@/components/AlertsDrawer';
import { TankDetailsModal } from '@/components/TankDetailsModal';
import { useTanks } from '@/hooks/useTanks';
import { useAuth } from '@/hooks/useAuth';
import { KPICards } from '@/components/KPICards';
import { GroupSnapshotCards } from '@/components/GroupSnapshotCards';
import { FuelTable } from '@/components/FuelTable';
import { useAlerts } from "@/hooks/useAlerts";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { Tank } from '@/types/fuel';

export default function Index() {
  const { user } = useAuth();
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
      criticalTanks: tanks.filter(t => t.days_to_min_level !== null && t.days_to_min_level <= 2).length,
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
        criticalTanks: groupTanks.filter(t => t.days_to_min_level !== null && t.days_to_min_level <= 2).length,
        averageLevel: Math.round(groupTanks.reduce((acc, t) => acc + (t.current_level_percent || 0), 0) / groupTanks.length),
        lastUpdated: new Date().toISOString()
      };
    })
  ] : [];

  const handleTankClick = (tank: Tank) => {
    setSelectedTankId(tank.id);
    setTankDetailsOpen(true);
  };

  const handleCardClick = (filter: string) => {
    setSelectedFilter(filter === selectedFilter ? null : filter);
  };

  const handleGroupClick = (groupId: string) => {
    setSelectedGroup(groupId === selectedGroup ? null : groupId);
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
      <Card className="border-red-200">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-red-600 mb-2">Error Loading Data</h2>
          <p className="text-gray-600 text-center">{tanksError.message}</p>
        </CardContent>
      </Card>
    );
  }

  const criticalAlerts = alerts?.filter(alert => !alert.acknowledged_at && !alert.snoozed_until) || [];

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fuel Insights Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Real-time monitoring across {tanks?.length || 0} fuel tanks
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setIsAlertsOpen(true)}
            className="relative border-gray-300"
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
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Activity className="h-4 w-4 text-green-500" />
            Live Updates
          </div>
        </div>
      </div>

      {/* Welcome Card */}
      {user && (
        <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="p-2 bg-green-500 rounded-full">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-medium text-green-900">Welcome back, {user.email}</p>
              <p className="text-sm text-green-700">
                Monitoring {tanks?.length || 0} tanks across multiple depot groups
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Strip */}
      <div>
        <h2 className="text-xl font-semibold mb-4 text-gray-900">Operational Overview</h2>
        <KPICards
          tanks={tanks ?? []}
          onCardClick={handleCardClick}
          selectedFilter={selectedFilter}
        />
      </div>

      {/* Fuel Group Overview */}
      <div>
        <h2 className="text-xl font-semibold mb-4 text-gray-900">Fuel Group Overview</h2>
        <GroupSnapshotCards
          groups={groupSnapshots}
          selectedGroup={selectedGroup}
          onGroupClick={handleGroupClick}
        />
      </div>

      {/* Tank Status Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {selectedGroup ? `${groupSnapshots.find(g => g.id === selectedGroup)?.name} Tanks` : 'All Tank Status'}
          </h2>
          {selectedGroup && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSelectedGroup(null)}
              className="border-gray-300"
            >
              Show All Groups
            </Button>
          )}
        </div>
        <FuelTable
          tanks={filteredTanks}
          onTankClick={handleTankClick}
        />
      </div>

      {/* Modals */}
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
