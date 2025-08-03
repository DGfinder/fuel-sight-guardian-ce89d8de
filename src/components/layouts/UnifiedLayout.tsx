import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppMode } from '@/hooks/useAppMode';
import Sidebar from '@/components/Sidebar';
import { DataCentreSidebar } from './DataCentreSidebar';

interface UnifiedLayoutProps {
  children: React.ReactNode;
  selectedGroup?: string | null;
  onGroupSelect?: (groupId: string | null) => void;
}

export function UnifiedLayout({ children, selectedGroup, onGroupSelect }: UnifiedLayoutProps) {
  const { mode, isDataCentreMode } = useAppMode();
  const navigate = useNavigate();

  const handleBackToFuel = () => {
    navigate('/');
  };

  return (
    <div className="flex min-h-screen w-full bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      {isDataCentreMode ? (
        <DataCentreSidebar onBackToFuel={handleBackToFuel} />
      ) : (
        <Sidebar />
      )}
      
      <main className="flex-1 w-full min-h-screen overflow-auto bg-white dark:bg-gray-900 p-4 ml-0 md:ml-64 z-0">
        {children}
      </main>
    </div>
  );
}