import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.png';

interface AppLayoutProps {
  children: React.ReactNode;
  selectedGroup?: string | null;
  onGroupSelect: (groupId: string | null) => void;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex h-screen w-full bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 overflow-hidden">
      {/* Mobile Header - fixed at top, outside flex flow */}
      {isMobile && (
        <header className="fixed top-0 left-0 right-0 h-14 bg-white dark:bg-gray-900 shadow-md z-50 flex items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <img src={logo} alt="GSF Logo" className="h-8 w-auto" />
            <span className="font-bold text-base text-gray-900 dark:text-white">TankAlert</span>
          </div>
          <Button
            variant="ghost"
            aria-label="Open sidebar"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-11 w-11 p-0 flex items-center justify-center"
          >
            <Menu size={28} />
          </Button>
        </header>
      )}

      {/* Sidebar - pass mobile state for controlled behavior */}
      <Sidebar
        isMobile={isMobile}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Content */}
      <div className={cn(
        "flex-1 flex flex-col overflow-hidden",
        isMobile ? "mt-14" : "ml-64"
      )}>
        <main className="flex-1 w-full bg-white dark:bg-gray-900 p-4 z-0 pb-20 md:pb-4 overflow-auto">
          {children}
          <Footer className="hidden md:block mt-auto -mx-4 -mb-4 w-[calc(100%+2rem)]" />
        </main>
      </div>
    </div>
  );
}
