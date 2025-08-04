import React from 'react';
import DataCentreSidebar from '@/components/DataCentreSidebar';

interface DataCentreLayoutProps {
  children: React.ReactNode;
}

export default function DataCentreLayout({ children }: DataCentreLayoutProps) {
  return (
    <div className="flex min-h-screen w-full bg-gray-50 dark:bg-gray-900">
      <DataCentreSidebar />
      <main className="flex-1 w-full min-h-screen overflow-auto bg-gray-50 dark:bg-gray-900 p-4 ml-0 md:ml-64 z-0">
        {children}
      </main>
    </div>
  );
}