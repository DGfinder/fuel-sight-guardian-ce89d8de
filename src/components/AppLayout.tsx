import React from 'react';
import Sidebar from '@/components/Sidebar';
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";

interface AppLayoutProps {
  children: React.ReactNode;
  selectedGroup?: string | null;
  onGroupSelect: (groupId: string | null) => void;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen w-full bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <Sidebar />
      <main className="flex-1 w-full min-h-screen overflow-auto bg-white dark:bg-gray-900 p-4 ml-0 md:ml-64 z-0">
        {children}
      </main>
    </div>
  );
}
