import React, { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useCustomerAccount, useCustomerPortalSummary, useCustomerTanks } from '@/hooks/useCustomerAuth';
import { useHazardReportContext } from '@/contexts/HazardReportContext';
import { CustomerLogo } from './CustomerLogo';
import {
  LayoutDashboard,
  Fuel,
  CalendarDays,
  Truck,
  History,
  FileText,
  LogOut,
  X,
  AlertTriangle,
  Settings,
  Activity,
  CloudSun,
} from 'lucide-react';

interface CustomerSidebarProps {
  isMobile?: boolean;
  open?: boolean;
  onClose?: () => void;
}

// Navigation item type
interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  end?: boolean;
  isAction?: boolean; // For items that trigger actions instead of navigation
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

// Grouped navigation with section headers
const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { path: '/customer', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { path: '/customer/tanks', label: 'My Tanks', icon: Fuel },
      { path: '/customer/health', label: 'Device Health', icon: Activity },
      { path: '/customer/weather', label: 'Weather Intelligence', icon: CloudSun },
    ],
  },
  {
    label: 'Fuel Delivery',
    items: [
      { path: '/customer/calendar', label: 'Refill Calendar', icon: CalendarDays },
      { path: '/customer/request', label: 'Request Delivery', icon: Truck },
      { path: '/customer/history', label: 'Delivery History', icon: History },
      { path: '#report-hazard', label: 'Report Hazard', icon: AlertTriangle, isAction: true },
    ],
  },
  {
    label: 'Account',
    items: [
      { path: '/customer/reports', label: 'Reports', icon: FileText },
      { path: '/customer/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function CustomerSidebar({ isMobile, open, onClose }: CustomerSidebarProps) {
  const location = useLocation();
  const { data: customerAccount } = useCustomerAccount();
  const { data: tanks } = useCustomerTanks();
  const summary = useCustomerPortalSummary();
  const { openHazardReport } = useHazardReportContext();

  // Check if account has any telemetry devices (AgBot or SmartFill)
  // If all tanks are manual dip, hide Device Health from nav
  const hasTelemetry = useMemo(() => {
    if (!tanks?.length) return true; // Default to showing until we know
    return tanks.some(t => t.source_type === 'agbot' || t.source_type === 'smartfill');
  }, [tanks]);

  // Filter nav groups based on account capabilities
  const filteredNavGroups = useMemo(() => {
    return navGroups.map(group => ({
      ...group,
      items: group.items.filter(item => {
        // Hide Device Health for accounts without telemetry devices
        if (item.path === '/customer/health' && !hasTelemetry) {
          return false;
        }
        return true;
      })
    })).filter(group => group.items.length > 0); // Remove empty groups
  }, [hasTelemetry]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.replace('/login');
  };

  // Mobile overlay
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        {open && (
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />
        )}

        {/* Sidebar panel */}
        <aside
          className={cn(
            "fixed top-0 left-0 h-full w-72 bg-white dark:bg-gray-900 shadow-xl z-50 transition-transform duration-300",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-800">
              <div className="flex items-center gap-2">
                <CustomerLogo size="md" />
                <span className="font-bold text-lg">Customer Portal</span>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X size={20} />
              </Button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {filteredNavGroups.map((group, groupIndex) => (
                <div key={groupIndex} className={group.label ? 'mt-4 first:mt-0' : ''}>
                  {group.label && (
                    <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      {group.label}
                    </div>
                  )}
                  {group.items.map((item) => (
                    item.isAction ? (
                      <button
                        key={item.path}
                        onClick={() => {
                          openHazardReport();
                          onClose?.();
                        }}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors w-full text-left",
                          "text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/20"
                        )}
                      >
                        <item.icon size={20} />
                        <span className="font-medium">{item.label}</span>
                      </button>
                    ) : (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.end}
                        onClick={onClose}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                            isActive
                              ? "bg-customer-primary/10 text-customer-primary dark:bg-customer-primary/20 dark:text-customer-primary"
                              : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                          )
                        }
                      >
                        <item.icon size={20} />
                        <span className="font-medium">{item.label}</span>
                      </NavLink>
                    )
                  ))}
                </div>
              ))}
            </nav>

            {/* Alerts summary */}
            {(summary.lowFuelTanks > 0 || summary.criticalTanks > 0) && (
              <div className="p-4 mx-4 mb-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                  <AlertTriangle size={18} />
                  <span className="font-medium text-sm">
                    {summary.criticalTanks > 0
                      ? `${summary.criticalTanks} critical`
                      : `${summary.lowFuelTanks} low fuel`}
                  </span>
                </div>
              </div>
            )}

            {/* User info & Sign out */}
            <div className="p-4 border-t dark:border-gray-800">
              <div className="mb-3">
                <p className="font-medium text-sm truncate">
                  {customerAccount?.contact_name || customerAccount?.customer_name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {customerAccount?.company_name || customerAccount?.customer_name}
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={handleSignOut}
              >
                <LogOut size={18} />
                Sign Out
              </Button>
            </div>
          </div>
        </aside>
      </>
    );
  }

  // Desktop sidebar
  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white dark:bg-gray-900 border-r dark:border-gray-800 z-30">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-2 p-4 border-b dark:border-gray-800">
          <CustomerLogo size="md" />
          <div>
            <span className="font-bold text-lg">TankAlert</span>
            <span className="block text-xs text-gray-500">Customer Portal</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {filteredNavGroups.map((group, groupIndex) => (
            <div key={groupIndex} className={group.label ? 'mt-4 first:mt-0' : ''}>
              {group.label && (
                <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {group.label}
                </div>
              )}
              {group.items.map((item) => (
                item.isAction ? (
                  <button
                    key={item.path}
                    onClick={() => openHazardReport()}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors w-full text-left",
                      "text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/20"
                    )}
                  >
                    <item.icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                ) : (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                        isActive
                          ? "bg-customer-primary/10 text-customer-primary dark:bg-customer-primary/20 dark:text-customer-primary"
                          : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                      )
                    }
                  >
                    <item.icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </NavLink>
                )
              ))}
            </div>
          ))}
        </nav>

        {/* Alerts summary */}
        {(summary.lowFuelTanks > 0 || summary.criticalTanks > 0) && (
          <div className="p-4 mx-4 mb-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
              <AlertTriangle size={18} />
              <span className="font-medium text-sm">
                {summary.criticalTanks > 0
                  ? `${summary.criticalTanks} critical tank${summary.criticalTanks > 1 ? 's' : ''}`
                  : `${summary.lowFuelTanks} tank${summary.lowFuelTanks > 1 ? 's' : ''} low`}
              </span>
            </div>
          </div>
        )}

        {/* User info & Sign out */}
        <div className="p-4 border-t dark:border-gray-800">
          <div className="mb-3">
            <p className="font-medium text-sm truncate">
              {customerAccount?.contact_name || customerAccount?.customer_name}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {customerAccount?.company_name || customerAccount?.customer_name}
            </p>
          </div>
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={handleSignOut}
          >
            <LogOut size={18} />
            Sign Out
          </Button>
        </div>
      </div>
    </aside>
  );
}

export default CustomerSidebar;
