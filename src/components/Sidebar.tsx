import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Menu,
  Bell,
  Gauge,
  Building,
  MapPin,
  Home,
  Settings,
  Plus,
  HomeIcon,
  DatabaseIcon as TankIcon,
  BellIcon as AlertIcon,
  ChevronRightIcon,
  BusIcon,
  MapPinIcon,
  Building2Icon
} from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import AddDipModal from '@/components/modals/AddDipModal';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useTanks } from "@/hooks/useTanks";
import { Skeleton } from "@/components/ui/skeleton";

interface TankCount {
  total: number;
  critical: number;
  warning: number;
}

const ALL_NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: HomeIcon, badge: null, group: null },
  { path: '/tanks', label: 'Tanks', icon: TankIcon, badge: 'totalTanks', group: null },
  { path: '/swan-transit', label: 'Swan Transit', icon: BusIcon, badge: null, group: 'Swan Transit' },
  { path: '/kalgoorlie', label: 'Kalgoorlie', icon: MapPinIcon, badge: null, group: 'Kalgoorlie' },
  { path: '/gsf-depots', label: 'GSF Depots', icon: Building2Icon, badge: null, group: 'GSF Depots' },
  { path: '/geraldton', label: 'Geraldton', icon: MapPinIcon, badge: null, group: 'Geraldton' },
  { path: '/bgc', label: 'BGC', icon: Building2Icon, badge: null, group: 'BGC' }
];

const SidebarSkeleton = () => (
  <aside
    className={cn(
      "fixed top-0 left-0 h-full w-64 bg-[#008457] border-r-4 border-[#FEDF19] z-40 flex flex-col justify-between",
      "rounded-r-xl shadow-lg"
    )}
    style={{ minHeight: '100vh' }}
  >
    <div className="flex flex-col flex-1 gap-2 p-4 overflow-y-auto">
      {/* Branding */}
      <div className="flex flex-col items-center mb-8 select-none pt-2 pb-4 border-b border-white/20">
        <Skeleton className="h-16 w-16 mb-2 bg-white/20 rounded-lg" />
        <Skeleton className="h-5 w-24 mt-1 bg-white/20" />
        <Skeleton className="h-4 w-32 mt-1 bg-white/20" />
      </div>

      {/* Nav Links */}
      <ul className="flex flex-col gap-1">
        {[...Array(5)].map((_, i) => (
          <li key={i} className="flex items-center gap-3 p-2">
            <Skeleton className="w-5 h-5 rounded-full bg-white/20" />
            <Skeleton className="w-32 h-5 bg-white/20" />
          </li>
        ))}
      </ul>
    </div>
  </aside>
);


export const Sidebar: React.FC = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [addDipModalOpen, setAddDipModalOpen] = useState(false);
  const navigate = useNavigate();
  const { data: permissions, isLoading: permissionsLoading } = useUserPermissions();
  const { tanks, isLoading: tanksLoading } = useTanks();

  const { data: tankCounts } = useQuery<TankCount>({
    queryKey: ['tankCounts', permissions?.userId],
    queryFn: async () => {
      if (!permissions) return { total: 0, critical: 0, warning: 0 };

      let query = supabase
        .from('tanks_with_rolling_avg')
        .select('id', { count: 'exact', head: true });

      if (!permissions.isAdmin && permissions.accessibleGroups.length > 0) {
        const groupIds = permissions.accessibleGroups.map(g => g.id);
        query = query.in('group_id', groupIds);
      }

      const { count } = await query;
        
      return {
        total: count || 0,
        critical: 0, // Placeholder
        warning: 0, // Placeholder
      };
    },
    enabled: !!permissions,
  });

  const navItems = useMemo(() => {
    if (!permissions) return [];
    const accessibleGroups = new Set(permissions.accessibleGroups.map(g => g.name));
    return ALL_NAV_ITEMS.filter(item => {
      if (permissions.isAdmin) return true;
      if (!item.group) return true;
      return accessibleGroups.has(item.group);
    }).map(item => ({
      ...item,
      badge: item.badge === 'totalTanks' ? tankCounts?.total : null
    }));
  }, [permissions, tankCounts]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth > 768) setOpen(false);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close sidebar on route change if mobile
  useEffect(() => {
    if (isMobile) setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, isMobile]);

  const handleToggle = () => setOpen((prev) => !prev);

  const handleLogout = async () => {
    try {
      console.log('Logging out...');
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
        // Force redirect even if there's an error
        window.location.href = '/login';
      } else {
        console.log('Logout successful');
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Logout failed:', error);
      // Force redirect on any error
      window.location.href = '/login';
    }
  };

  if (permissionsLoading || tanksLoading) {
    return <SidebarSkeleton />;
  }
  
  return (
    <>
      {/* Hamburger for mobile */}
      {isMobile && (
        <header className="flex items-center justify-between p-4 bg-white shadow-md md:hidden sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <img src={logo} alt="GSF Logo" className="h-8 w-auto" />
            <span className="font-bold text-base text-[#111111]">TankAlert</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open sidebar"
            onClick={handleToggle}
          >
            <Menu size={24} />
          </Button>
        </header>
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-64 bg-[#008457] border-r-4 border-[#FEDF19] z-40 flex flex-col justify-between transition-transform duration-200",
          "rounded-r-xl shadow-lg",
          isMobile ? (open ? "translate-x-0" : "-translate-x-full") : "translate-x-0"
        )}
        aria-label="Sidebar"
        style={{ minHeight: '100vh' }}
      >
        <nav className="flex flex-col flex-1 gap-2 p-4 overflow-y-auto">
          {/* Branding */}
          <div className="flex flex-col items-center mb-8 select-none pt-2 pb-4 border-b border-white/20">
            <img
              src={logo}
              alt="Great Southern Fuels Logo"
              className="h-16 w-auto mb-2 bg-white rounded-lg p-2 shadow"
            />
            <span className="font-bold text-lg text-white text-center leading-tight tracking-wide">
              TankAlert
            </span>
            <span className="text-sm font-medium text-[#FEDF19] tracking-wide text-center">
              Great Southern Fuels
            </span>
          </div>

          {/* Nav Links */}
          <ul className="flex flex-col gap-1">
            {navItems.map(({ path, label, icon: Icon, badge }) => (
              <li key={path}>
                <Link
                  to={path}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-lg transition-colors",
                    location.pathname === path
                      ? "bg-blue-600 text-white"
                      : "hover:bg-gray-800 text-gray-300"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    <span>{label}</span>
                  </div>
                  {badge !== null && (
                    <span className="bg-gray-700 text-white px-2 py-0.5 rounded-full text-sm">
                      {badge}
                    </span>
                  )}
                  <ChevronRightIcon className="w-4 h-4" />
                </Link>
              </li>
            ))}
          </ul>

          {/* Quick Actions */}
          <div className="flex flex-col gap-2 mt-8">
            <button
              onClick={() => setAddDipModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#008457] text-white border-2 border-[#FEDF19] rounded-lg font-bold hover:bg-[#006B49] transition-colors shadow-md"
            >
              <Plus className="w-5 h-5" />
              Add Dip Reading
            </button>
            <Link
              to="/alerts"
              className="w-full flex items-center justify-center gap-2 py-2 border border-white text-white rounded-lg font-semibold hover:bg-white/10 transition-colors"
            >
              <AlertIcon className="w-5 h-5" />
              Alerts
              {(tankCounts?.critical || 0) + (tankCounts?.warning || 0) > 0 && (
                <span className="ml-2 bg-gray-700 text-white px-2 py-0.5 rounded-full text-sm">
                  {(tankCounts?.critical || 0) + (tankCounts?.warning || 0)}
                </span>
              )}
            </Link>
          </div>
        </nav>

        {/* Sticky Footer */}
        <div className="p-4 border-t border-white/20 flex items-center justify-between bg-[#008457] sticky bottom-0">
          <Link
            to="/settings"
            className="flex items-center gap-1 text-white hover:text-[#FEDF19] transition-colors"
          >
            <Settings className="w-5 h-5" />
            <span className="font-semibold">Settings</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-white hover:text-[#FEDF19] transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isMobile && open && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={handleToggle}
          aria-label="Close sidebar overlay"
        />
      )}

      {/* Add Dip Modal */}
      <AddDipModal
        open={addDipModalOpen}
        onOpenChange={setAddDipModalOpen}
        onSubmit={async (groupId, tankId, dip) => {
          // This is where a refresh/invalidation would happen
          console.log('Dip submitted:', { groupId, tankId, dip });
        }}
      />
    </>
  );
};

export default Sidebar;
