
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
  Gauge
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppSidebarProps {
  userRole: 'admin' | 'depot_manager' | 'operator';
  assignedGroups: string[];
  onAddDip: () => void;
}

export function AppSidebar({ userRole, assignedGroups, onAddDip }: AppSidebarProps) {
  const adminItems = [
    {
      title: "Global Dashboard",
      url: "/",
      icon: BarChart3,
    },
    {
      title: "Swan Transit",
      url: "/groups/swan-transit",
      icon: Building,
    },
    {
      title: "Kalgoorlie",
      url: "/groups/kalgoorlie", 
      icon: Building,
    },
    {
      title: "Geraldton",
      url: "/groups/geraldton",
      icon: Building,
    },
    {
      title: "GSF Depots",
      url: "/groups/gsf-depots",
      icon: Building,
    },
    {
      title: "BGC",
      url: "/groups/bgc",
      icon: Building,
    },
  ];

  const groupItems = assignedGroups.map(group => ({
    title: group,
    url: `/groups/${group.toLowerCase().replace(' ', '-')}`,
    icon: Building,
  }));

  const menuItems = userRole === 'admin' ? adminItems : [
    {
      title: "Dashboard",
      url: "/",
      icon: BarChart3,
    },
    ...groupItems
  ];

  return (
    <Sidebar className="border-r border-gray-200" style={{ backgroundColor: '#008457' }}>
      <SidebarHeader className="p-4 border-b border-green-600">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
            <Gauge className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-white">GSF Monitor</h2>
            <p className="text-xs text-green-100">Fuel Insights Platform</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-green-100 uppercase tracking-wider px-3 mb-2">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="w-full">
                    <a 
                      href={item.url}
                      className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-green-100 rounded-lg hover:bg-green-600 hover:text-white transition-colors"
                    >
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="text-xs font-semibold text-green-100 uppercase tracking-wider px-3 mb-2">
            Actions
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-3 space-y-2">
              <Button 
                onClick={onAddDip}
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Dip Reading
              </Button>
              <Button 
                variant="outline" 
                className="w-full border-green-300 text-green-100 hover:bg-green-600 hover:text-white" 
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
              <a 
                href="/settings"
                className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-green-100 rounded-lg hover:bg-green-600 hover:text-white transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
