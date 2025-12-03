import React, { useState, useEffect, useRef, Suspense, lazy } from "react";
import { QueryClientProvider, QueryClient, Query, useQueryClient } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppStateProvider } from "@/contexts/AppStateContext";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { SpeedInsights } from '@vercel/speed-insights/react';
import '@/lib/auth-cleanup'; // Initialize auth cleanup utilities
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RealtimeErrorBoundary } from '@/components/RealtimeErrorBoundary';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { DatabaseErrorBoundary } from '@/components/ErrorBoundary/DatabaseErrorBoundary';
import { useTankModal } from './contexts/TankModalContext';
import { TankDetailsModal } from './components/TankDetailsModal';
import { useGlobalModals } from './contexts/GlobalModalsContext';
import { CommandPalette, useCommandPalette } from './components/CommandPalette';
import EditDipModal from './components/modals/EditDipModal';
import { AlertsDrawer } from './components/AlertsDrawer';
import { AgbotModalProvider } from './contexts/AgbotModalContext';
import AgbotDetailsModal from './components/AgbotDetailsModal';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/lib/supabase';
import { getNetworkQualityMultiplier, isSlowNetwork } from '@/hooks/useReducedMotion';
import { useTenantInit } from '@/hooks/useTenantInit';

// Lazy load page components for better code splitting
const Index = lazy(() => import("@/pages/Index"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const SwanTransit = lazy(() => import('@/pages/SwanTransit'));
const Kalgoorlie = lazy(() => import('@/pages/Kalgoorlie'));
const KalgoorlieBulkEntry = lazy(() => import('@/pages/KalgoorlieBulkEntry'));
const Settings = lazy(() => import('@/pages/Settings'));
const Login = lazy(() => import("@/pages/Login"));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const Geraldton = lazy(() => import('@/pages/Geraldton'));
const GeraldtonBulkEntry = lazy(() => import('@/pages/GeraldtonBulkEntry'));
const GeraldtonLinehaul = lazy(() => import('@/pages/GeraldtonLinehaul'));
const GeraldtonLinehaulBulkEntry = lazy(() => import('@/pages/GeraldtonLinehaulBulkEntry'));
const GSFDepots = lazy(() => import('@/pages/GSFDepots'));
const BGC = lazy(() => import('@/pages/BGC'));
const TanksPage = lazy(() => import('@/pages/TanksPage'));
const AlertsPage = lazy(() => import('@/pages/AlertsPage'));
const HealthPage = lazy(() => import('@/pages/HealthPage'));
const MapView = lazy(() => import('@/pages/MapView'));
const PerformancePage = lazy(() => import('@/pages/PerformancePage'));
const ProductAnalyticsPage = lazy(() => import('@/pages/ProductAnalyticsPage'));
const DipHistoryPage = lazy(() => import('@/pages/DipHistoryPage'));
const AgbotPage = lazy(() => import('@/pages/AgbotPage'));
const AgbotPredictions = lazy(() => import('@/pages/AgbotPredictions'));
const SmartFillPage = lazy(() => import('@/pages/SmartFillPage'));

// Customer Portal Pages
const CustomerDashboard = lazy(() => import('@/pages/customer/CustomerDashboard'));
const CustomerCalendar = lazy(() => import('@/pages/customer/CustomerCalendar'));
const CustomerTanks = lazy(() => import('@/pages/customer/CustomerTanks'));
const CustomerTankDetail = lazy(() => import('@/pages/customer/CustomerTankDetail'));
const RequestDelivery = lazy(() => import('@/pages/customer/RequestDelivery'));
const DeliveryHistory = lazy(() => import('@/pages/customer/DeliveryHistory'));
const CustomerReports = lazy(() => import('@/pages/customer/CustomerReports'));

// Admin Pages
const FleetRefillCalendar = lazy(() => import('@/pages/admin/FleetRefillCalendar'));
const CustomerAccountManagement = lazy(() => import('@/pages/admin/CustomerAccountManagement'));
const FuelManagement = lazy(() => import('@/pages/admin/FuelManagement'));

// Customer Portal Layout
import { CustomerPortalLayout } from '@/components/customer/CustomerPortalLayout';

// Enhanced loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="flex flex-col items-center space-y-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
);

// Base intervals (will be multiplied by network quality)
const BASE_REFETCH_INTERVAL = 2 * 60 * 1000; // 2 minutes (was 30 seconds)
const BASE_STALE_TIME = 2 * 60 * 1000; // 2 minutes

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors except 408, 429
        const errorWithStatus = error as { status?: number; response?: { status?: number } };
        const status = typeof errorWithStatus?.status === 'number' ? errorWithStatus.status : errorWithStatus?.response?.status;
        if (status >= 400 && status < 500 && ![408, 429].includes(status)) {
          return false;
        }
        // Reduce retries on slow networks
        return failureCount < (isSlowNetwork() ? 2 : 3);
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true,
      // Stale time: 2 minutes (network-aware refetching handles slow connections)
      staleTime: BASE_STALE_TIME,
      gcTime: 10 * 60 * 1000, // 10 minutes garbage collection (formerly cacheTime)
      // Device-aware background refetch
      refetchInterval: (query) => {
        // Refetch tank data when page is visible
        if ((query as Query)?.queryKey?.[0] === 'tanks' && document.visibilityState === 'visible') {
          // Check if mobile or slow network
          const isMobileOrSlow = window.innerWidth <= 768 || isSlowNetwork();
          if (isMobileOrSlow) {
            // Mobile/slow: 2 min base, up to 12 min on very slow networks
            return BASE_REFETCH_INTERVAL * getNetworkQualityMultiplier();
          }
          // Desktop on fast network: 30 seconds (original behavior)
          return 30 * 1000;
        }
        return false;
      },
      // Optimize for tank-heavy pages
      structuralSharing: true,
      // Persist important queries
      networkMode: 'online',
    },
    mutations: {
      retry: (failureCount, error) => {
        // Only retry mutations on network errors or 5xx
        const errorWithStatus = error as { status?: number; response?: { status?: number } };
        const status = typeof errorWithStatus?.status === 'number' ? errorWithStatus.status : errorWithStatus?.response?.status;
        if (status >= 500 || !status) {
          return failureCount < 2;
        }
        return false;
      },
      retryDelay: 1000,
      networkMode: 'online',
    },
  },
});

// Expose queryClient globally for debugging in development
if (import.meta.env.DEV) {
  (window as unknown as Window & { queryClient?: QueryClient }).queryClient = queryClient;
}

// Component for window focus refetch with 5-minute threshold
// Only refetches tank data if user was away for more than 5 minutes
// Must be rendered inside QueryClientProvider
function WindowFocusHandler() {
  const queryClientInstance = useQueryClient();
  const lastHiddenTimeRef = useRef<number | null>(null);
  const AWAY_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Record when user left
        lastHiddenTimeRef.current = Date.now();
      } else if (document.visibilityState === 'visible' && lastHiddenTimeRef.current) {
        // Check how long user was away
        const awayTime = Date.now() - lastHiddenTimeRef.current;
        if (awayTime > AWAY_THRESHOLD_MS) {
          // Invalidate tank data to trigger fresh fetch
          queryClientInstance.invalidateQueries({ queryKey: ['tanks'] });
          console.log(`[WINDOW FOCUS] Refetching data after ${Math.round(awayTime / 60000)} min away`);
        }
        lastHiddenTimeRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [queryClientInstance]);

  return null; // This is a behavior-only component
}

// Force refresh listener - listens for admin-triggered refresh broadcasts
function ForceRefreshListener() {
  useEffect(() => {
    const channel = supabase.channel('force-refresh');

    channel
      .on('broadcast', { event: 'refresh' }, async (message) => {
        console.log('[FORCE REFRESH] Admin triggered refresh - sending acknowledgment');

        const sessionId = message.payload?.sessionId;

        // Get current user info and send acknowledgment before reloading
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const currentUser = session?.user;

          if (currentUser && sessionId) {
            // Send acknowledgment BEFORE reload on dedicated ack channel
            const ackChannel = supabase.channel('force-refresh-ack');
            await ackChannel.subscribe();

            await ackChannel.send({
              type: 'broadcast',
              event: 'ack',
              payload: {
                sessionId: sessionId,
                oduserId: currentUser.id,
                email: currentUser.email,
                fullName: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Unknown',
                acknowledgedAt: Date.now(),
              }
            });

            // Brief delay to ensure message delivery
            await new Promise(resolve => setTimeout(resolve, 100));

            await supabase.removeChannel(ackChannel);
          }
        } catch (error) {
          console.error('[FORCE REFRESH] Failed to send ack:', error);
          // Continue with reload regardless of ack failure
        }

        console.log('[FORCE REFRESH] Clearing caches and reloading');

        // Clear service worker caches
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        }

        // Clear localStorage cache keys
        const cacheKeys = ['fuel-data-cache', 'fuel-data-last-sync'];
        cacheKeys.forEach(key => localStorage.removeItem(key));

        // Clear React Query cache
        queryClient.clear();

        // Force hard reload (bypass cache)
        window.location.reload();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}

// Track user presence for force-refresh acknowledgment feature
function PresenceTracker() {
  useEffect(() => {
    let presenceChannel: ReturnType<typeof supabase.channel> | null = null;

    const initPresence = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      presenceChannel = supabase.channel('app-presence');

      presenceChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel?.track({
            oduserId: session.user.id,
            email: session.user.email,
            fullName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
            onlineAt: new Date().toISOString(),
          });
        }
      });
    };

    initPresence();

    return () => {
      if (presenceChannel) {
        supabase.removeChannel(presenceChannel);
      }
    };
  }, []);

  return null;
}

function HashRedirector() {
  const navigate = useNavigate();
  useEffect(() => {
    if (window.location.hash.includes('access_token')) {
      navigate('/reset-password' + window.location.hash, { replace: true });
    }
  }, [navigate]);
  return null;
}

function AppContent() {
  // Initialize tenant context for multi-tenant routing
  const { isReady: tenantReady, tenant, error: tenantError } = useTenantInit();

  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const { selectedTank, open, closeModal } = useTankModal();
  const { editDipOpen, editDipTank, closeEditDip, alertsOpen, closeAlerts } = useGlobalModals();
  const { open: commandOpen, setOpen: setCommandOpen } = useCommandPalette();

  // Show loading state while tenant initializes
  if (!tenantReady) {
    return <PageLoader />;
  }

  // Show error if tenant initialization failed
  if (tenantError) {
    console.error('Tenant initialization error:', tenantError);
    // Continue anyway - will fall back to public schema
  }

  return (
    <>
      <QueryClientProvider client={queryClient}>
        {/* Custom window focus handler - only refetch if user was away >5 minutes */}
        <WindowFocusHandler />
        {/* Listen for admin-triggered force refresh broadcasts */}
        <ForceRefreshListener />
        {/* Track user presence for force-refresh acknowledgments */}
        <PresenceTracker />
        <TooltipProvider>
          <AppStateProvider>
            <BrowserRouter
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true
              }}
            >
              <HashRedirector />
              <Toaster />
              <RealtimeErrorBoundary>
                <DatabaseErrorBoundary fallbackMessage="Unable to load application data">
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                    <Route 
                      path="/" 
                      element={
                        <ProtectedRoute>
                          <RouteErrorBoundary routeName="Dashboard" showHomeButton={false}>
                            <AppLayout selectedGroup={selectedGroup} onGroupSelect={setSelectedGroup}>
                              <Index selectedGroup={selectedGroup} />
                            </AppLayout>
                          </RouteErrorBoundary>
                        </ProtectedRoute>
                      } 
                    />
                  <Route 
                    path="/tanks" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="Tanks" showHomeButton={true}>
                          <AppLayout selectedGroup={selectedGroup} onGroupSelect={setSelectedGroup}>
                            <TanksPage />
                          </AppLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/map" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="Map View" showHomeButton={true}>
                          <AppLayout selectedGroup={selectedGroup} onGroupSelect={setSelectedGroup}>
                            <MapView />
                          </AppLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/performance" 
                    element={
                      <ProtectedRoute requiredRole="admin">
                        <RouteErrorBoundary routeName="Performance" showHomeButton={true}>
                          <AppLayout selectedGroup={selectedGroup} onGroupSelect={setSelectedGroup}>
                            <PerformancePage />
                          </AppLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/analytics/products" element={
                      <ProtectedRoute requiredRole="admin">
                        <RouteErrorBoundary routeName="Product Analytics" showHomeButton={true}>
                          <AppLayout selectedGroup={selectedGroup} onGroupSelect={setSelectedGroup}>
                            <ProductAnalyticsPage />
                          </AppLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/swan-transit" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="Swan Transit" showHomeButton={true}>
                          <SwanTransit />
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  <Route path="/kalgoorlie" element={
                    <ProtectedRoute>
                      <RouteErrorBoundary routeName="Kalgoorlie" showHomeButton={true}>
                        <Kalgoorlie />
                      </RouteErrorBoundary>
                    </ProtectedRoute>
                  } />
                  <Route path="/kalgoorlie/bulk-entry" element={
                    <ProtectedRoute>
                      <RouteErrorBoundary routeName="Kalgoorlie Bulk Entry" showHomeButton={true}>
                        <KalgoorlieBulkEntry />
                      </RouteErrorBoundary>
                    </ProtectedRoute>
                  } />
                  <Route path="/geraldton" element={
                    <ProtectedRoute>
                      <RouteErrorBoundary routeName="Geraldton" showHomeButton={true}>
                        <Geraldton />
                      </RouteErrorBoundary>
                    </ProtectedRoute>
                  } />
                  <Route path="/geraldton/bulk-entry" element={
                    <ProtectedRoute>
                      <RouteErrorBoundary routeName="Geraldton Bulk Entry" showHomeButton={true}>
                        <GeraldtonBulkEntry />
                      </RouteErrorBoundary>
                    </ProtectedRoute>
                  } />
                  <Route path="/geraldton-linehaul" element={
                    <ProtectedRoute>
                      <RouteErrorBoundary routeName="Geraldton Linehaul" showHomeButton={true}>
                        <GeraldtonLinehaul />
                      </RouteErrorBoundary>
                    </ProtectedRoute>
                  } />
                  <Route path="/geraldton-linehaul/bulk-entry" element={
                    <ProtectedRoute>
                      <RouteErrorBoundary routeName="Geraldton Linehaul Bulk Entry" showHomeButton={true}>
                        <GeraldtonLinehaulBulkEntry />
                      </RouteErrorBoundary>
                    </ProtectedRoute>
                  } />
                  <Route path="/gsf-depots" element={
                    <ProtectedRoute>
                      <RouteErrorBoundary routeName="GSF Depots" showHomeButton={true}>
                        <GSFDepots />
                      </RouteErrorBoundary>
                    </ProtectedRoute>
                  } />
                  <Route path="/bgc" element={
                    <ProtectedRoute>
                      <RouteErrorBoundary routeName="BGC" showHomeButton={true}>
                        <BGC />
                      </RouteErrorBoundary>
                    </ProtectedRoute>
                  } />
                  <Route 
                    path="/groups/:groupName/dip-history" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="Dip History" showHomeButton={true}>
                          <AppLayout selectedGroup={selectedGroup} onGroupSelect={setSelectedGroup}>
                            <DipHistoryPage />
                          </AppLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  <Route
                    path="/agbot"
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="Agbot Monitoring" showHomeButton={true}>
                          <Suspense fallback={<PageLoader />}>
                            <AgbotPage />
                          </Suspense>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/agbot/predictions"
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="Agbot Predictions" showHomeButton={true}>
                          <Suspense fallback={<PageLoader />}>
                            <AgbotPredictions />
                          </Suspense>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/smartfill" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="SmartFill Monitoring" showHomeButton={true}>
                          <AppLayout selectedGroup={selectedGroup} onGroupSelect={setSelectedGroup}>
                            <SmartFillPage />
                          </AppLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  <Route path="/settings" element={
                    <ProtectedRoute>
                      <AppLayout selectedGroup={selectedGroup} onGroupSelect={setSelectedGroup}>
                        <Settings />
                      </AppLayout>
                    </ProtectedRoute>
                  } />
                  <Route path="/settings/health" element={
                    <ProtectedRoute>
                      <AppLayout selectedGroup={selectedGroup} onGroupSelect={setSelectedGroup}>
                        <HealthPage />
                      </AppLayout>
                    </ProtectedRoute>
                  } />
                  <Route path="/login" element={<Login />} />
                  <Route path="/reset-password" element={<ResetPassword />} />

                  {/* Customer Portal Routes */}
                  <Route
                    path="/customer"
                    element={
                      <ProtectedRoute requiredAccountType="customer">
                        <CustomerPortalLayout>
                          <CustomerDashboard />
                        </CustomerPortalLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/customer/tanks"
                    element={
                      <ProtectedRoute requiredAccountType="customer">
                        <CustomerPortalLayout>
                          <CustomerTanks />
                        </CustomerPortalLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/customer/tanks/:tankId"
                    element={
                      <ProtectedRoute requiredAccountType="customer">
                        <CustomerPortalLayout>
                          <CustomerTankDetail />
                        </CustomerPortalLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/customer/calendar"
                    element={
                      <ProtectedRoute requiredAccountType="customer">
                        <CustomerPortalLayout>
                          <CustomerCalendar />
                        </CustomerPortalLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/customer/request"
                    element={
                      <ProtectedRoute requiredAccountType="customer">
                        <CustomerPortalLayout>
                          <RequestDelivery />
                        </CustomerPortalLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/customer/history"
                    element={
                      <ProtectedRoute requiredAccountType="customer">
                        <CustomerPortalLayout>
                          <DeliveryHistory />
                        </CustomerPortalLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/customer/reports"
                    element={
                      <ProtectedRoute requiredAccountType="customer">
                        <CustomerPortalLayout>
                          <CustomerReports />
                        </CustomerPortalLayout>
                      </ProtectedRoute>
                    }
                  />

                  {/* GSF Fleet Refill Calendar */}
                  <Route
                    path="/fleet-calendar"
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="Fleet Calendar" showHomeButton={true}>
                          <AppLayout selectedGroup={selectedGroup} onGroupSelect={setSelectedGroup}>
                            <FleetRefillCalendar />
                          </AppLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    }
                  />

                  {/* Customer Account Management (GSF Admins) */}
                  <Route
                    path="/settings/customers"
                    element={
                      <ProtectedRoute requiredRole="admin">
                        <RouteErrorBoundary routeName="Customer Portal Management" showHomeButton={true}>
                          <AppLayout selectedGroup={selectedGroup} onGroupSelect={setSelectedGroup}>
                            <CustomerAccountManagement />
                          </AppLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    }
                  />

                  {/* Fuel Management Admin */}
                  <Route
                    path="/admin/fuel-management"
                    element={
                      <ProtectedRoute requiredRole="admin">
                        <RouteErrorBoundary routeName="Fuel Management" showHomeButton={true}>
                          <AppLayout selectedGroup={selectedGroup} onGroupSelect={setSelectedGroup}>
                            <FuelManagement />
                          </AppLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/alerts" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="Alerts" showHomeButton={true}>
                          <AppLayout selectedGroup={selectedGroup} onGroupSelect={setSelectedGroup}>
                            <AlertsPage />
                          </AppLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                    <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </DatabaseErrorBoundary>
              </RealtimeErrorBoundary>
              <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
            </BrowserRouter>
            <TankDetailsModal tank={selectedTank} open={open} onOpenChange={closeModal} />
            {editDipOpen && editDipTank && (
              <EditDipModal
                isOpen={true}
                onClose={closeEditDip}
                initialGroupId={editDipTank.group_id || ''}
                initialTankId={editDipTank.id || ''}
              />
            )}
            <AlertsDrawer
              open={alertsOpen}
              onOpenChange={closeAlerts}
              tanks={[]} // You may want to pass tanks from context or props
            />
            <AgbotDetailsModal />
          </AppStateProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </>
  );
}

const App = () => {
  return (
    <AgbotModalProvider>
      <AppContent />
      <SpeedInsights />
    </AgbotModalProvider>
  );
};

export default App;
