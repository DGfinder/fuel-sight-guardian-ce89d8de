
import React, { useState } from 'react';
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from '@/components/AppSidebar';
import { useUserRole } from '@/hooks/useUserRole';
import { AddDipModal } from '@/components/AddDipModal';
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";

interface AppLayoutProps {
  children: React.ReactNode;
  selectedGroup?: string | null;
  onGroupSelect: (groupId: string | null) => void;
}

export function AppLayout({ children, selectedGroup, onGroupSelect }: AppLayoutProps) {
  const { data: userRole } = useUserRole();
  const [isAddDipOpen, setIsAddDipOpen] = useState(false);

  const handleAddDip = () => {
    setIsAddDipOpen(true);
  };

  return (
    <>
      <AppSidebar 
        userRole={(userRole?.role || 'operator') as 'admin' | 'depot_manager' | 'operator'}
        assignedGroups={userRole?.group_id ? [userRole.group_id] : []}
        onAddDip={handleAddDip}
        selectedGroup={selectedGroup}
        onGroupSelect={onGroupSelect}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-6 bg-white">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="-ml-1" />
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="font-medium text-gray-900">Live Fuel Monitoring</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <Activity className="w-3 h-3 mr-1" />
              Online
            </Badge>
          </div>
        </header>
        
        <main className="flex-1 bg-gray-50">
          {children}
        </main>
      </SidebarInset>
      
      <AddDipModal
        open={isAddDipOpen}
        onOpenChange={setIsAddDipOpen}
      />
    </>
  );
}
