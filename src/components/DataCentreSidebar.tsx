import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Menu,
  Shield,
  CreditCard,
  AlertTriangle,
  Upload,
  BarChart3,
  TrendingUp,
  Home,
  ArrowLeft,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  Users,
  Navigation
} from 'lucide-react';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.png';
import { supabase } from '@/lib/supabase';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useQueryClient } from '@tanstack/react-query';

const DATA_CENTRE_NAV_ITEMS = [
  { 
    path: '/data-centre', 
    label: 'Overview', 
    icon: Home, 
    exact: true 
  },
  { 
    path: '/data-centre/guardian', 
    label: 'Guardian', 
    icon: Shield,
    permission: 'view_guardian_events',
    children: [
      { path: '/data-centre/guardian/smb', label: 'SMB Analytics', icon: Shield },
      { path: '/data-centre/guardian/gsf', label: 'GSF Analytics', icon: Shield }
    ]
  },
  { 
    path: '/data-centre/captive-payments', 
    label: 'Captive Payments', 
    icon: CreditCard,
    permission: 'view_myob_deliveries',
    children: [
      { path: '/data-centre/captive-payments/smb', label: 'SMB Analytics', icon: CreditCard },
      { path: '/data-centre/captive-payments/gsf', label: 'GSF Analytics', icon: CreditCard }
    ]
  },
  { 
    path: '/data-centre/lytx-safety', 
    label: 'LYTX Safety', 
    icon: AlertTriangle,
    permission: 'view_lytx_events',
    children: [
      { path: '/data-centre/lytx-safety/stevemacs', label: 'Stevemacs Safety', icon: AlertTriangle },
      { path: '/data-centre/lytx-safety/smb', label: 'Stevemacs (SMB)', icon: AlertTriangle },
      { path: '/data-centre/lytx-safety/gsf', label: 'GSF Safety', icon: AlertTriangle }
    ]
  },
  { 
    path: '/data-centre/import', 
    label: 'Data Import', 
    icon: Upload,
    permission: 'manage_data_sources'
  },
  { 
    path: '/data-centre/reports', 
    label: 'Reports & Analytics', 
    icon: BarChart3,
    permission: 'generate_compliance_reports'
  },
  { 
    path: '/data-centre/fleet', 
    label: 'Fleet Management', 
    icon: TrendingUp,
    permission: 'view_analytics_dashboard',
    children: [
      { path: '/data-centre/fleet/database', label: 'Vehicle Database', icon: TrendingUp },
      { path: '/data-centre/fleet/drivers', label: 'Driver Management', icon: Users },
      { path: '/data-centre/fleet/trip-analytics', label: 'Trip Analytics', icon: Navigation },
      { path: '/data-centre/fleet/stevemacs', label: 'Stevemacs Fleet', icon: TrendingUp },
      { path: '/data-centre/fleet/gsf', label: 'GSF Fleet', icon: TrendingUp },
      { path: '/data-centre/fleet/maintenance', label: 'Maintenance & Assets', icon: TrendingUp }
    ]
  },
  { 
    path: '/data-centre/mtdata', 
    label: 'MtData Analytics', 
    icon: Navigation,
    permission: 'view_analytics_dashboard',
    children: [
      { path: '/data-centre/mtdata/stevemacs', label: 'Stevemacs Operations', icon: Navigation },
      { path: '/data-centre/mtdata/gsf', label: 'GSF Operations', icon: Navigation }
    ]
  }
];

export default function DataCentreSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const { data: permissions } = useUserPermissions();
  const queryClient = useQueryClient();

  // Check mobile breakpoint
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

  const handleToggle = () => setOpen((prev) => !prev);

  const toggleExpanded = (itemPath: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemPath)) {
        newSet.delete(itemPath);
      } else {
        newSet.add(itemPath);
      }
      return newSet;
    });
  };

  const handleLogout = async () => {
    try {
      queryClient.clear();
      localStorage.clear();
      sessionStorage.clear();
      
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        console.error('Supabase logout error:', error);
      }
      
      await supabase.auth.refreshSession();
      window.location.replace('/login');
      
    } catch (error) {
      console.error('Logout process failed:', error);
      localStorage.clear();
      sessionStorage.clear();
      queryClient.clear();
      window.location.replace('/login');
    }
  };

  // Filter nav items based on permissions
  const visibleNavItems = DATA_CENTRE_NAV_ITEMS.filter(item => {
    if (!item.permission) return true; // Always show items without permission requirements
    if (!permissions) return false; // Hide if permissions not loaded
    
    // Admin/Manager can see everything
    if (permissions.isAdmin || permissions.role === 'manager') return true;
    
    // For other roles, would need to implement specific permission checking
    // For now, show all items to compliance_manager and viewer roles
    return permissions.role === 'compliance_manager' || permissions.role === 'viewer';
  });

  return (
    <>
      {/* Mobile header */}
      {isMobile && (
        <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 shadow-md md:hidden sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <img src={logo} alt="GSF Logo" className="h-8 w-auto" />
            <span className="font-bold text-base text-[#111111] dark:text-white">Data Centre</span>
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
          "fixed top-0 left-0 h-full w-64 bg-gray-800 border-r-4 border-t-4 border-blue-500 z-40 flex flex-col justify-between transition-transform duration-200",
          "rounded-r-xl shadow-lg",
          isMobile ? (open ? "translate-x-0" : "-translate-x-full") : "translate-x-0"
        )}
        aria-label="Data Centre Sidebar"
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
              Data Centre
            </span>
            <span className="text-sm font-medium text-blue-400 tracking-wide text-center">
              Analytics Platform
            </span>
          </div>

          {/* Back to Main App */}
          <Link
            to="/"
            className="flex items-center gap-3 p-2 rounded-lg transition-colors text-gray-300 hover:bg-gray-700 mb-4 border border-gray-600"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Fuel App</span>
          </Link>

          {/* Nav Links */}
          <ul className="flex flex-col gap-1">
            {visibleNavItems.map((item) => {
              const { path, label, icon: Icon, exact, coming_soon, children } = item;
              const isActive = exact 
                ? location.pathname === path 
                : location.pathname.startsWith(path) && location.pathname !== '/data-centre';
              const isExpanded = expandedItems.has(path);
              const hasActiveChild = children?.some(child => location.pathname === child.path);

              return (
                <li key={path}>
                  {coming_soon ? (
                    <div className="flex items-center justify-between p-2 rounded-lg text-gray-500 cursor-not-allowed">
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5" />
                        <span>{label}</span>
                      </div>
                      <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
                        Soon
                      </span>
                    </div>
                  ) : children ? (
                    // Item with children
                    <>
                      <div className="flex items-center justify-between">
                        <Link
                          to={path}
                          className={cn(
                            "flex items-center gap-3 p-2 rounded-lg transition-colors flex-1",
                            isActive || hasActiveChild
                              ? "bg-blue-600 text-white"
                              : "hover:bg-gray-700 text-gray-300"
                          )}
                        >
                          <Icon className="w-5 h-5" />
                          <span>{label}</span>
                        </Link>
                        <button
                          onClick={() => toggleExpanded(path)}
                          className={cn(
                            "p-2 rounded-lg transition-colors",
                            isActive || hasActiveChild
                              ? "text-white hover:bg-blue-700"
                              : "text-gray-300 hover:bg-gray-700"
                          )}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      
                      {/* Child items */}
                      {isExpanded && (
                        <ul className="ml-6 mt-1 space-y-1">
                          {children.map((child) => (
                            <li key={child.path}>
                              <Link
                                to={child.path}
                                className={cn(
                                  "flex items-center gap-3 p-2 rounded-lg transition-colors",
                                  location.pathname === child.path
                                    ? "bg-blue-500 text-white"
                                    : "hover:bg-gray-700 text-gray-300"
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
                    <Link
                      to={path}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg transition-colors",
                        isActive
                          ? "bg-blue-600 text-white"
                          : "hover:bg-gray-700 text-gray-300"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{label}</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Quick Stats */}
          <div className="mt-8 p-3 bg-gray-700 rounded-lg">
            <h3 className="text-white font-semibold text-sm mb-2">Quick Stats</h3>
            <div className="space-y-1 text-xs text-gray-300">
              <div className="flex justify-between">
                <span>Guardian Events:</span>
                <span className="text-blue-400">13,317</span>
              </div>
              <div className="flex justify-between">
                <span>Payment Records:</span>
                <span className="text-green-400">75,000+</span>
              </div>
              <div className="flex justify-between">
                <span>Safety Score:</span>
                <span className="text-orange-400">8.2/10</span>
              </div>
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/20 flex items-center justify-between bg-gray-800 sticky bottom-0">
          <Link
            to="/settings"
            className="flex items-center gap-1 text-white hover:text-blue-400 transition-colors"
          >
            <Settings className="w-5 h-5" />
            <span className="font-semibold">Settings</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-white hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isMobile && open && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={handleToggle}
          aria-label="Close sidebar overlay"
        />
      )}
    </>
  );
}