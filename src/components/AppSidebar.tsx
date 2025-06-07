
import React from 'react';
import { 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarGroupLabel, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter 
} from "@/components/ui/sidebar";
import { 
  BarChart3, 
  Building, 
  Settings, 
  Bell,
  Plus,
  Truck
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppSidebarProps {
  userRole: 'admin' | 'depot_manager' | 'operator';
  assignedGroups: string[];
  onAddDip: () => void;
  selectedGroup?: string | null;
  onGroupSelect: (groupId: string | null) => void;
}

export function AppSidebar({ 
  userRole, 
  assignedGroups, 
  onAddDip, 
  selectedGroup, 
  onGroupSelect 
}: AppSidebarProps) {
  const navigationItems = [
    {
      title: "Global Dashboard",
      id: null,
      icon: BarChart3,
    },
    {
      title: "Swan Transit",
      id: "swan-transit",
      icon: Building,
    },
    {
      title: "Kalgoorlie",
      id: "kalgoorlie", 
      icon: Building,
    },
    {
      title: "Geraldton",
      id: "geraldton",
      icon: Building,
    },
    {
      title: "GSF Depots",
      id: "gsf-depots",
      icon: Building,
    },
    {
      title: "BGC",
      id: "bgc",
      icon: Building,
    },
  ];

  return (
    <Sidebar className="border-r border-gray-200" style={{ backgroundColor: '#008457' }}>
      <SidebarHeader className="p-6 border-b border-green-600">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
            <Truck className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="font-bold text-xl text-white">Fuel Sight Guardian</h2>
            <p className="text-xs text-green-100">Great Southern Fuels</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-6">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-green-100 uppercase tracking-wider px-3 mb-3">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    className={`w-full ${
                      selectedGroup === item.id 
                        ? 'bg-green-600 text-white' 
                        : 'text-green-100 hover:bg-green-600 hover:text-white'
                    }`}
                  >
                    <button 
                      onClick={() => onGroupSelect(item.id)}
                      className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors w-full text-left"
                    >
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-8">
          <SidebarGroupLabel className="text-xs font-semibold text-green-100 uppercase tracking-wider px-3 mb-3">
            Quick Actions
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-3 space-y-3">
              <Button 
                onClick={onAddDip}
                className="w-full font-medium shadow-sm"
                style={{ backgroundColor: '#FEDF19', color: '#111111' }}
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Dip Reading
              </Button>
              <Button 
                variant="outline" 
                className="w-full border-green-300 text-green-100 hover:bg-green-600 hover:text-white hover:border-green-600" 
                size="sm"
              >
                <Bell className="w-4 h-4 mr-2" />
                View Alerts
              </Button>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-green-600">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <button 
                className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-green-100 rounded-lg hover:bg-green-600 hover:text-white transition-colors w-full text-left"
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
