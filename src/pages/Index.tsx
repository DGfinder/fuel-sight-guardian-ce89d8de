import React, { useState } from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { KPICards } from "@/components/KPICards";
import { GroupSnapshotCards } from "@/components/GroupSnapshotCards";
import { FuelTable } from "@/components/FuelTable";
import { AddDipModal } from "@/components/AddDipModal";
import { AlertsDrawer } from "@/components/AlertsDrawer";
import { RecentActivity } from "@/components/RecentActivity";
import { Button } from "@/components/ui/button";
import { Bell, Plus, Filter, ChevronDown } from "lucide-react";
import { Tank, KPIData, User, GroupSnapshot } from "@/types/fuel";

// Mock data - in production this would come from Supabase
const mockUser: User = {
  id: '1',
  name: 'Steve Admin',
  email: 'steve@gsf.com.au',
  role: 'admin',
  assignedGroups: ['Swan Transit', 'Kalgoorlie', 'Geraldton']
};

const mockTanks: Tank[] = [
  {
    id: '1',
    location: 'Canningvale 1',
    depot: 'Canningvale',
    group: 'Swan Transit',
    productType: 'ADF',
    currentLevel: 2500,
    capacity: 25000,
    minLevel: 2000,
    safeLevel: 5000,
    lastDipDate: '2024-06-05T14:30:00Z',
    lastDipBy: 'Adam Smith',
    rollingAvg: 850,
    daysToMinLevel: 2,
    alerts: [
      {
        id: 'a1',
        tankId: '1',
        type: 'critical',
        message: 'Tank below 10% capacity',
        timestamp: '2024-06-05T14:30:00Z',
        acknowledged: false
      }
    ]
  },
  {
    id: '2',
    location: 'Canningvale 2',
    depot: 'Canningvale',
    group: 'Swan Transit',
    productType: 'ULP',
    currentLevel: 12000,
    capacity: 30000,
    minLevel: 3000,
    safeLevel: 6000,
    lastDipDate: '2024-06-05T16:15:00Z',
    lastDipBy: 'Sarah Jones',
    rollingAvg: 1200,
    daysToMinLevel: 8,
    alerts: []
  },
  {
    id: '3',
    location: 'Kalgoorlie Main',
    depot: 'Kalgoorlie',
    group: 'Kalgoorlie',
    productType: 'Diesel',
    currentLevel: 18000,
    capacity: 20000,
    minLevel: 2000,
    safeLevel: 4000,
    lastDipDate: '2024-06-05T10:00:00Z',
    lastDipBy: 'Mike Wilson',
    rollingAvg: 950,
    daysToMinLevel: 17,
    alerts: []
  },
  {
    id: '4',
    location: 'Geraldton Depot',
    depot: 'Geraldton',
    group: 'Geraldton',
    productType: 'ADF',
    currentLevel: 4500,
    capacity: 22000,
    minLevel: 2200,
    safeLevel: 4400,
    lastDipDate: '2024-06-05T12:45:00Z',
    lastDipBy: 'Lisa Brown',
    rollingAvg: 750,
    daysToMinLevel: 3,
    alerts: [
      {
        id: 'a2',
        tankId: '4',
        type: 'warning',
        message: 'Tank below 20% capacity',
        timestamp: '2024-06-05T12:45:00Z',
        acknowledged: false
      }
    ]
  }
];

const mockKPIData: KPIData = {
  tanksBelow10: 1,
  tanksBelow20: 2,
  totalStock: 37000,
  avgDaysToEmpty: 7.5
};

const mockGroupSnapshots: GroupSnapshot[] = [
  {
    groupName: 'Swan Transit',
    totalTanks: 8,
    avgPercentFull: 42,
    tanksBelow10: 1,
    tanksBelow20: 3,
    totalStock: 180000,
    status: 'warning'
  },
  {
    groupName: 'Kalgoorlie',
    totalTanks: 4,
    avgPercentFull: 78,
    tanksBelow10: 0,
    tanksBelow20: 0,
    totalStock: 95000,
    status: 'good'
  },
  {
    groupName: 'Geraldton',
    totalTanks: 6,
    avgPercentFull: 35,
    tanksBelow10: 0,
    tanksBelow20: 2,
    totalStock: 120000,
    status: 'warning'
  }
];

const Index = () => {
  const [addDipModalOpen, setAddDipModalOpen] = useState(false);
  const [alertsDrawerOpen, setAlertsDrawerOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const filteredTanks = selectedFilter 
    ? mockTanks.filter(tank => {
        const percentage = (tank.currentLevel / tank.capacity) * 100;
        switch (selectedFilter) {
          case 'below10':
            return percentage <= 10;
          case 'below20':
            return percentage <= 20;
          default:
            return true;
        }
      })
    : selectedGroup 
    ? mockTanks.filter(tank => tank.group === selectedGroup)
    : mockTanks;

  const handleKPICardClick = (filter: string) => {
    setSelectedFilter(selectedFilter === filter ? null : filter);
    setSelectedGroup(null);
  };

  const handleGroupClick = (groupName: string) => {
    setSelectedGroup(groupName);
    setSelectedFilter(null);
  };

  const handleTankRowClick = (tank: Tank) => {
    console.log('Tank clicked:', tank);
  };

  const isGlobalView = mockUser.role === 'admin' && !selectedGroup;
  const alertCount = mockTanks.filter(tank => tank.alerts.length > 0).length;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <AppSidebar 
          userRole={mockUser.role}
          assignedGroups={mockUser.assignedGroups}
          onAddDip={() => setAddDipModalOpen(true)}
        />
        
        <main className="flex-1 flex flex-col">
          {/* Greeting Header */}
          <header className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Welcome back, {mockUser.name.split(' ')[0]} 👋
                  </h1>
                  <p className="text-sm text-gray-500">
                    {isGlobalView ? 'Global fuel monitoring across all depots' : selectedGroup ? `${selectedGroup} depot overview` : 'Real-time fuel monitoring'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {(selectedFilter || selectedGroup) && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setSelectedFilter(null);
                      setSelectedGroup(null);
                    }}
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    Clear Filter
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm"
                  className="relative"
                  onClick={() => setAlertsDrawerOpen(true)}
                >
                  <Bell className="w-4 h-4" />
                  {alertCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-fuel-critical text-white text-xs rounded-full flex items-center justify-center">
                      {alertCount}
                    </span>
                  )}
                </Button>
                <Button 
                  onClick={() => setAddDipModalOpen(true)}
                  className="bg-primary hover:bg-primary/90"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Dip
                </Button>
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-bold">
                    {mockUser.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <div className="flex-1 p-6">
            <div className="animate-fade-in space-y-6">
              {/* KPI Cards - Always Visible */}
              <KPICards data={mockKPIData} onCardClick={handleKPICardClick} />
              
              {/* Conditional Content Based on View */}
              {isGlobalView ? (
                /* Global Admin View - Group Snapshots */
                <GroupSnapshotCards 
                  groups={mockGroupSnapshots}
                  onGroupClick={handleGroupClick}
                />
              ) : (
                /* Group/Filtered View - Tank Table */
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  <div className="lg:col-span-3">
                    <FuelTable tanks={filteredTanks} onRowClick={handleTankRowClick} />
                  </div>
                  <div className="lg:col-span-1">
                    <RecentActivity />
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        <AddDipModal 
          open={addDipModalOpen}
          onOpenChange={setAddDipModalOpen}
        />

        <AlertsDrawer 
          open={alertsDrawerOpen}
          onOpenChange={setAlertsDrawerOpen}
          tanks={mockTanks}
        />
      </div>
    </SidebarProvider>
  );
};

export default Index;
