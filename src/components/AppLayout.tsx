import React from 'react';
import Sidebar from '@/components/Sidebar';
import { Footer } from '@/components/Footer';

interface AppLayoutProps {
  children: React.ReactNode;
  selectedGroup?: string | null;
  onGroupSelect: (groupId: string | null) => void;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex h-screen w-full bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-0 md:ml-64 overflow-hidden">
        <main className="flex-1 w-full bg-white dark:bg-gray-900 p-4 z-0 pb-20 md:pb-4 overflow-auto">
          {children}
          <Footer className="hidden md:block mt-auto -mx-4 -mb-4 w-[calc(100%+2rem)]" />
        </main>
      </div>
    </div>
  );
}
