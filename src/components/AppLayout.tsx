import React from 'react';
import Sidebar from '@/components/Sidebar';
import { AddDipModal } from '@/components/AddDipModal';
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";

interface AppLayoutProps {
  children: React.ReactNode;
  selectedGroup?: string | null;
  onGroupSelect: (groupId: string | null) => void;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 p-4 ml-0 md:ml-64">
        {children}
      </main>
    </div>
  );
}
