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
  ChevronDownIcon,
  BusIcon,
  MapPinIcon,
  Building2Icon,
  TrendingUp,
  History,
  Mail,
  Signal,
  BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";
import { supabase } from '@/lib/supabase';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useTanks } from "@/hooks/useTanks";
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { getActiveAlertsCount } from '@/lib/alertService';
import { Skeleton } from "@/components/ui/skeleton";

const ALL_NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: HomeIcon, badge: null, group: null },
  { path: '/tanks', label: 'Tanks', icon: TankIcon, badge: 'totalTanks', group: null },
  { path: '/map', label: 'Map View', icon: MapPin, badge: null, group: null },
  { path: '/agbot', label: 'Agbot Monitoring', icon: Signal, badge: null, group: null },
  { 
    path: '/swan-transit', 
    label: 'Swan Transit', 
    icon: BusIcon, 
    badge: null, 
    group: 'Swan Transit',
    children: [
      { path: '/groups/swan-transit/dip-history', label: 'Dip History', icon: History }
    ]
  },
  { 
    path: '/kalgoorlie', 
    label: 'Kalgoorlie', 
    icon: MapPinIcon, 
    badge: null, 
    group: 'Kalgoorlie',
    children: [
      { path: '/groups/kalgoorlie/dip-history', label: 'Dip History', icon: History }
    ]
  },
  { 
    path: '/gsf-depots', 
    label: 'GSF Depots', 
    icon: Building2Icon, 
    badge: null, 
    group: 'GSF Depots',
    children: [
      { path: '/groups/gsf-depots/dip-history', label: 'Dip History', icon: History }
    ]
  },
  { 
    path: '/geraldton', 
    label: 'Geraldton', 
    icon: MapPinIcon, 
    badge: null, 
    group: 'Geraldton',
    children: [
      { path: '/groups/geraldton/dip-history', label: 'Dip History', icon: History }
    ]
  },
  { 
    path: '/bgc', 
    label: 'BGC', 
    icon: Building2Icon, 
    badge: null, 
    group: 'BGC',
    children: [
      { path: '/groups/bgc/dip-history', label: 'Dip History', icon: History }
    ]
  }
];

const SidebarSkeleton = () => (
  <aside
    className={cn(
      "fixed top-0 left-0 h-full w-64 bg-primary border-r-4 border-secondary z-40 flex flex-col justify-between",
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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const { data: permissions, isLoading: permissionsLoading } = useUserPermissions();
  const { tanks, isLoading: tanksLoading } = useTanks();
  const queryClient = useQueryClient();
  
  // Calculate tank count from tanks array (respects RBAC since tanks are already filtered)
  const tanksCount = tanks?.length || 0;
  
  // Get actual alert count from database
  const { data: activeAlertCount = 0 } = useQuery({
    queryKey: ['activeAlerts'],
    queryFn: getActiveAlertsCount,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  const navItems = useMemo(() => {
    if (!permissions) return [];

    const allItems = [...ALL_NAV_ITEMS];

    // Add admin-only Performance page
    if (permissions.isAdmin) {
      allItems.push({
        path: '/performance',
        label: 'Performance',
        icon: TrendingUp,
        badge: null,
        group: null
      });
    }

    // Add analytics for admin, manager, and compliance_manager roles
    if (permissions.isAdmin || permissions.role === 'manager' || permissions.role === 'compliance_manager') {
      allItems.push({
        path: 'analytics-app', // Special identifier for external app
        label: 'Fleet Analytics',
        icon: BarChart3,
        badge: null,
        group: null,
        external: true // Mark as external app
      });
    }

    const accessibleGroups = new Set(permissions.accessibleGroups.map(g => g.name));
    return allItems.filter(item => {
      if (permissions.isAdmin) return true;
      if (!item.group) return true;
      return accessibleGroups.has(item.group);
    }).map(item => ({
      ...item,
      badge: item.badge === 'totalTanks' ? tanksCount : null
    }));
  }, [permissions, tanksCount]);

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
  }, [location.pathname, isMobile]);

  // Auto-expand groups when child routes are active
  useEffect(() => {
    const currentPath = location.pathname;
    const newExpandedGroups = new Set(expandedGroups);
    
    // Check if current path matches any child route
    ALL_NAV_ITEMS.forEach(item => {
      if (item.children) {
        const hasActiveChild = item.children.some(child => child.path === currentPath);
        if (hasActiveChild) {
          newExpandedGroups.add(item.label);
        }
      }
    });
    
    setExpandedGroups(newExpandedGroups);
  }, [location.pathname]);

  const handleToggle = () => setOpen((prev) => !prev);

  const toggleGroup = (groupLabel: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupLabel)) {
        newSet.delete(groupLabel);
      } else {
        newSet.add(groupLabel);
      }
      return newSet;
    });
  };

  const handleLogout = async () => {
    try {
      console.log('🚪 Starting logout process...');
      
      // Step 1: Clear React Query cache first to prevent stale data
      queryClient.clear();
      console.log('✅ React Query cache cleared');
      
      // Step 2: Clear browser storage
      localStorage.clear();
      sessionStorage.clear();
      console.log('✅ Browser storage cleared');
      
      // Step 3: Sign out from Supabase
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        console.error('⚠️ Supabase logout error (proceeding anyway):', error);
      } else {
        console.log('✅ Supabase signout successful');
      }
      
      // Step 4: Clear any remaining auth state
      await supabase.auth.refreshSession();
      
      // Step 5: Force a clean redirect (use replace to prevent back button issues)
      console.log('🔄 Redirecting to login...');
      window.location.replace('/login');
      
    } catch (error) {
      console.error('💥 Logout process failed:', error);
      
      // Emergency cleanup - clear everything and force redirect
      try {
        localStorage.clear();
        sessionStorage.clear();
        queryClient.clear();
      } catch (cleanupError) {
        console.error('Cleanup failed:', cleanupError);
      }
      
      // Force redirect even on complete failure
      window.location.replace('/login');
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
          "fixed top-0 left-0 h-full w-64 bg-primary border-r-4 border-t-4 border-secondary z-40 flex flex-col justify-between transition-transform duration-200",
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
            <span className="text-sm font-medium text-secondary tracking-wide text-center">
              Great Southern Fuels
            </span>
          </div>

          {/* Nav Links */}
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => {
              const { path, label, icon: Icon, badge, children, external } = item;
              const hasChildren = children && children.length > 0;
              const isExpanded = expandedGroups.has(label);
              const isActive = location.pathname === path;
              const hasActiveChild = children?.some(child => child.path === location.pathname);

              const handleNavigation = (e: React.MouseEvent) => {
                if (external && path === 'analytics-app') {
                  e.preventDefault();
                  // Open analytics app (tries 3001, falls back to 3002)
                  window.open('http://localhost:3002', '_blank');
                }
              };

              return (
                <li key={path}>
                  {hasChildren ? (
                    // Parent item with children
                    <>
                      <div
                        onClick={() => toggleGroup(label)}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer",
                          isActive || hasActiveChild
                            ? "bg-blue-600 text-white"
                            : "hover:bg-gray-800 text-gray-300"
                        )}
                      >
                        {external ? (
                          <div
                            className="flex items-center gap-3 flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNavigation(e);
                            }}
                          >
                            <Icon className="w-5 h-5" />
                            <span>{label}</span>
                          </div>
                        ) : (
                          <Link
                            to={path}
                            className="flex items-center gap-3 flex-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Icon className="w-5 h-5" />
                            <span>{label}</span>
                          </Link>
                        )}
                        <div className="flex items-center gap-2">
                          {badge !== null && (
                            <span className="bg-gray-700 text-white px-2 py-0.5 rounded-full text-sm">
                              {badge}
                            </span>
                          )}
                          {isExpanded ? (
                            <ChevronDownIcon className="w-4 h-4" />
                          ) : (
                            <ChevronRightIcon className="w-4 h-4" />
                          )}
                        </div>
                      </div>
                      
                      {/* Child items */}
                      {isExpanded && (
                        <ul className="ml-4 mt-1 space-y-1">
                          {children.map((child) => (
                            <li key={child.path}>
                              <Link
                                to={child.path}
                                className={cn(
                                  "flex items-center gap-3 p-2 rounded-lg transition-colors",
                                  location.pathname === child.path
                                    ? "bg-blue-500 text-white"
                                    : "hover:bg-gray-800 text-gray-300"
                                )}
                              >
                                <child.icon className="w-4 h-4" />
                                <span className="text-sm">{child.label}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    // Regular item without children
                    external ? (
                      <div
                        onClick={handleNavigation}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer",
                          "hover:bg-gray-800 text-gray-300"
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
                      </div>
                    ) : (
                      <Link
                        to={path}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-lg transition-colors",
                          isActive
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
                      </Link>
                    )
                  )}
                </li>
              );
            })}
          </ul>

          {/* Quick Actions */}
          <div className="flex flex-col gap-2 mt-8">
            <button
              onClick={() => {
                const subject = "TankAlert Support Request";
                const body = `Hi Hayden,\n\nI need help with TankAlert.\n\nIssue Description:\n[Please describe your issue here]\n\n---\nSystem Information:\nPage: ${location.pathname}\nTimestamp: ${new Date().toLocaleString()}`;
                window.open(`mailto:Hayden@stevemacs.com.au?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
              }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white border-2 border-secondary rounded-lg font-bold hover:bg-primary/90 transition-colors shadow-md"
            >
              <Mail className="w-5 h-5" />
              Get Help
            </button>
            <Link
              to="/alerts"
              className="w-full flex items-center justify-center gap-2 py-2 border border-white text-white rounded-lg font-semibold hover:bg-white/10 transition-colors"
            >
              <AlertIcon className="w-5 h-5" />
              Alerts
              {activeAlertCount > 0 && (
                <span className="ml-2 bg-gray-700 text-white px-2 py-0.5 rounded-full text-sm">
                  {activeAlertCount}
                </span>
              )}
            </Link>
          </div>
        </nav>

        {/* Sticky Footer */}
        <div className="p-4 border-t border-white/20 flex items-center justify-between bg-primary sticky bottom-0">
          <Link
            to="/settings"
            className="flex items-center gap-1 text-white hover:text-secondary transition-colors"
          >
            <Settings className="w-5 h-5" />
            <span className="font-semibold">Settings</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-white hover:text-secondary transition-colors"
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

    </>
  );
};

export default Sidebar;
