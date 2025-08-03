import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { safeReactKey, safeStringify } from '@/lib/typeGuards';
import logo from '@/assets/logo.png';
import { 
  Menu, 
  X, 
  BarChart3, 
  Shield, 
  Truck, 
  Database, 
  FileText, 
  Settings, 
  LogOut,
  ArrowLeft,
  User,
  Home
} from 'lucide-react';

interface DataCentreSidebarProps {
  onBackToFuel: () => void;
}

export function DataCentreSidebar({ onBackToFuel }: DataCentreSidebarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: permissions, isLoading } = useUserPermissions();
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/data-centre', icon: BarChart3, current: location.pathname === '/data-centre' },
    { 
      name: 'Guardian Compliance', 
      href: '/data-centre/guardian', 
      icon: Shield, 
      current: location.pathname === '/data-centre/guardian',
      permission: 'view_guardian'
    },
    { 
      name: 'Delivery Analytics', 
      href: '/data-centre/deliveries', 
      icon: Truck, 
      current: location.pathname === '/data-centre/deliveries',
      permission: 'view_deliveries'
    },
    { 
      name: 'Data Import', 
      href: '/data-centre/import', 
      icon: Database, 
      current: location.pathname === '/data-centre/import',
      permission: 'upload_data'
    },
    { 
      name: 'Reports', 
      href: '/data-centre/reports', 
      icon: FileText, 
      current: location.pathname === '/data-centre/reports',
      permission: 'generate_reports'
    },
  ];

  const checkPermission = (permission: string): boolean => {
    if (!permissions || typeof permissions !== 'object') return false;
    if (permissions.isAdmin === true) return true;

    const permissionMap: Record<string, string[]> = {
      'view_guardian': ['admin', 'manager', 'compliance_manager'],
      'manage_guardian': ['admin', 'manager', 'compliance_manager'],
      'view_deliveries': ['admin', 'manager'],
      'upload_data': ['admin', 'manager'],
      'generate_reports': ['admin', 'manager', 'compliance_manager'],
      'manage_settings': ['admin'],
    };

    const allowedRoles = permissionMap[permission] || [];
    const userRole = safeStringify(permissions.role);
    return allowedRoles.includes(userRole);
  };

  const filteredNavigation = navigation.filter(item => {
    // Validate item structure
    if (!item || typeof item !== 'object') return false;
    if (typeof item.name !== 'string' || typeof item.href !== 'string') return false;
    
    // Check permissions
    return !item.permission || checkPermission(item.permission);
  });

  if (isLoading) {
    return (
      <div className="fixed top-0 left-0 h-full w-64 bg-primary border-r-4 border-secondary z-40 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile header */}
      <header className="flex items-center justify-between p-4 bg-white shadow-md md:hidden sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <img src={logo} alt="GSF Logo" className="h-8 w-auto" />
          <span className="font-bold text-base text-[#111111]">Data Centre</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open sidebar"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu size={24} />
        </Button>
      </header>

      {/* Sidebar */}
      <div className={cn(
        "fixed top-0 left-0 h-full w-64 bg-primary border-r-4 border-t-4 border-secondary z-40 flex flex-col justify-between transition-transform duration-200",
        "rounded-r-xl shadow-lg",
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-white/20">
            <div className="flex items-center">
              <img
                src={logo}
                alt="Great Southern Fuels Logo"
                className="h-8 w-auto mr-2 bg-white rounded p-1"
              />
              <span className="text-lg font-semibold text-white">Data Centre</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden text-white hover:bg-white/10"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Back to Fuel App */}
          <div className="px-4 py-3 border-b border-white/20">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-white border-white hover:bg-white hover:text-primary"
              onClick={onBackToFuel}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Fuel App
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {filteredNavigation.map((item, index) => {
              const itemKey = safeReactKey(item?.name, `nav-item-${index}`);
              const itemName = safeStringify(item?.name || 'Unknown');
              const itemHref = safeStringify(item?.href || '/data-centre');
              
              return (
                <Link
                  key={itemKey}
                  to={itemHref}
                  className={cn(
                    "group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors",
                    item?.current
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  {item?.icon && (
                    <item.icon
                      className={cn(
                        "mr-3 flex-shrink-0 h-5 w-5",
                        item?.current ? "text-white" : "text-gray-400 group-hover:text-white"
                      )}
                    />
                  )}
                  {itemName}
                </Link>
              );
            })}
          </nav>

          {/* User info */}
          <div className="px-4 py-4 border-t border-white/20">
            <div className="flex items-center mb-3">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-white">
                  Analytics User
                </p>
                <p className="text-xs text-gray-300 capitalize">
                  {safeStringify(permissions?.role) || 'Loading...'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
}