import React, { useState, useEffect } from 'react';
import { CustomerSidebar } from './CustomerSidebar';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.png';

interface CustomerPortalLayoutProps {
  children: React.ReactNode;
}

export function CustomerPortalLayout({ children }: CustomerPortalLayoutProps) {
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
    <div className="flex h-screen w-full bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden">
      {/* Mobile Header */}
      {isMobile && (
        <header className="fixed top-0 left-0 right-0 h-14 bg-white dark:bg-gray-900 shadow-md z-50 flex items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Logo" className="h-8 w-auto" />
            <div>
              <span className="font-bold text-base text-gray-900 dark:text-white">TankAlert</span>
              <span className="text-xs text-gray-500 ml-1">Customer</span>
            </div>
          </div>
          <Button
            variant="ghost"
            aria-label="Open menu"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-11 w-11 p-0 flex items-center justify-center"
          >
            <Menu size={28} />
          </Button>
        </header>
      )}

      {/* Sidebar */}
      <CustomerSidebar
        isMobile={isMobile}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <div
        className={cn(
          "flex-1 flex flex-col overflow-hidden",
          isMobile ? "mt-14" : "ml-64"
        )}
      >
        <main className="flex-1 w-full bg-gray-50 dark:bg-gray-950 p-4 md:p-6 overflow-auto">
          {children}
        </main>

        {/* Footer */}
        <footer className="hidden md:block px-6 py-3 bg-white dark:bg-gray-900 border-t dark:border-gray-800 text-center text-xs text-gray-500">
          <p>Powered by Great Southern Fuels</p>
        </footer>
      </div>

      {/* Mobile Bottom Nav */}
      {isMobile && <CustomerMobileNav />}
    </div>
  );
}

// Simple mobile bottom navigation
function CustomerMobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-gray-900 border-t dark:border-gray-800 z-40 flex items-center justify-around px-2">
      <MobileNavItem to="/customer" icon="dashboard" label="Home" />
      <MobileNavItem to="/customer/tanks" icon="tank" label="Tanks" />
      <MobileNavItem to="/customer/calendar" icon="calendar" label="Calendar" />
      <MobileNavItem to="/customer/request" icon="truck" label="Request" />
    </nav>
  );
}

function MobileNavItem({
  to,
  icon,
  label,
}: {
  to: string;
  icon: string;
  label: string;
}) {
  const isActive = window.location.pathname === to;

  return (
    <a
      href={to}
      className={cn(
        "flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-colors",
        isActive
          ? "text-green-600 dark:text-green-400"
          : "text-gray-500 dark:text-gray-400"
      )}
    >
      <span className="text-xl mb-0.5">
        {icon === 'dashboard' && '📊'}
        {icon === 'tank' && '⛽'}
        {icon === 'calendar' && '📅'}
        {icon === 'truck' && '🚚'}
      </span>
      <span className="text-xs font-medium">{label}</span>
    </a>
  );
}

export default CustomerPortalLayout;
