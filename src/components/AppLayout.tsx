
import React, { useState } from 'react';
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from '@/components/AppSidebar';
import { useUserRole } from '@/hooks/useUserRole';
import { AddDipModal } from '@/components/AddDipModal';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
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
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live Fuel Monitoring
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          {children}
        </div>
      </SidebarInset>
      
      <AddDipModal
        open={isAddDipOpen}
        onOpenChange={setIsAddDipOpen}
      />
    </>
  );
}
