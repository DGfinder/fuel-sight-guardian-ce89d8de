import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
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
import { cn } from '../lib/utils';

interface AnalyticsLayoutProps {
  children: React.ReactNode;
}

export function AnalyticsLayout({ children }: AnalyticsLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, permissions, signOut, checkPermission } = useAuth();
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: BarChart3, current: location.pathname === '/' },
    { 
      name: 'Guardian Compliance', 
      href: '/guardian', 
      icon: Shield, 
      current: location.pathname === '/guardian',
      permission: 'view_guardian'
    },
    { 
      name: 'Delivery Analytics', 
      href: '/deliveries', 
      icon: Truck, 
      current: location.pathname === '/deliveries',
      permission: 'view_deliveries'
    },
    { 
      name: 'Data Import', 
      href: '/import', 
      icon: Database, 
      current: location.pathname === '/import',
      permission: 'upload_data'
    },
    { 
      name: 'Reports', 
      href: '/reports', 
      icon: FileText, 
      current: location.pathname === '/reports',
      permission: 'generate_reports'
    },
    { 
      name: 'Settings', 
      href: '/settings', 
      icon: Settings, 
      current: location.pathname === '/settings',
      permission: 'manage_settings'
    },
  ];

  const filteredNavigation = navigation.filter(item => 
    !item.permission || checkPermission(item.permission)
  );

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-gray-600 opacity-75" />
        </div>
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
            <div className="flex items-center">
              <BarChart3 className="w-8 h-8 text-blue-600" />
              <span className="ml-2 text-lg font-semibold text-gray-900">Fleet Analytics</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Back to Fuel App */}
          <div className="px-4 py-3 border-b border-gray-200">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => window.location.href = '/'}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Fuel App
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {filteredNavigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors",
                  item.current
                    ? "bg-blue-100 text-blue-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon
                  className={cn(
                    "mr-3 flex-shrink-0 h-5 w-5",
                    item.current ? "text-blue-500" : "text-gray-400 group-hover:text-gray-500"
                  )}
                />
                {item.name}
              </Link>
            ))}
          </nav>

          {/* User info and sign out */}
          <div className="px-4 py-4 border-t border-gray-200">
            <div className="flex items-center mb-3">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700">
                  {user?.email?.split('@')[0] || 'User'}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {permissions?.role || 'Loading...'}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 lg:pl-0">
        {/* Mobile header */}
        <div className="flex items-center justify-between h-16 px-4 bg-white border-b border-gray-200 lg:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <span className="text-lg font-semibold text-gray-900">Fleet Analytics</span>
          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}