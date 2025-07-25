import React, { useState, useEffect, Suspense, lazy } from "react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppStateProvider } from "@/contexts/AppStateContext";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import AppLayout from "@/components/AppLayout";
import '@/lib/auth-cleanup'; // Initialize auth cleanup utilities
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RealtimeErrorBoundary } from '@/components/RealtimeErrorBoundary';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { DatabaseErrorBoundary } from '@/components/ErrorBoundary/DatabaseErrorBoundary';
import { useTankModal } from './contexts/TankModalContext';
import { TankDetailsModal } from './components/TankDetailsModal';
import { useGlobalModals } from './contexts/GlobalModalsContext';
import EditDipModal from './components/modals/EditDipModal';
import { AlertsDrawer } from './components/AlertsDrawer';
import { Calendar } from './components/ui/calendar';
import { AgbotModalProvider, useAgbotModal } from './contexts/AgbotModalContext';
import AgbotDetailsModal from './components/AgbotDetailsModal';

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
const GSFDepots = lazy(() => import('@/pages/GSFDepots'));
const BGC = lazy(() => import('@/pages/BGC'));
const TanksPage = lazy(() => import('@/pages/TanksPage'));
const AlertsPage = lazy(() => import('@/pages/AlertsPage'));
const HealthPage = lazy(() => import('@/pages/HealthPage'));
const MapView = lazy(() => import('@/pages/MapView'));
const PerformancePage = lazy(() => import('@/pages/PerformancePage'));
const DipHistoryPage = lazy(() => import('@/pages/DipHistoryPage'));
const AgbotPage = lazy(() => import('@/pages/AgbotPage'));

// Enhanced loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="flex flex-col items-center space-y-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors except 408, 429
        if (error?.status >= 400 && error?.status < 500 && ![408, 429].includes(error?.status)) {
          return false;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true,
      staleTime: 2 * 60 * 1000, // 2 minutes for real-time data
      gcTime: 10 * 60 * 1000, // 10 minutes garbage collection (formerly cacheTime)
      // Background refetch for fresh data
      refetchInterval: (data, query) => {
        // Refetch tank data every 30 seconds if page is visible
        if (query?.queryKey?.[0] === 'tanks' && document.visibilityState === 'visible') {
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
        if (error?.status >= 500 || !error?.status) {
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
  (window as Window & { queryClient: typeof queryClient }).queryClient = queryClient;
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
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const { selectedTank, open, closeModal } = useTankModal();
  const { editDipOpen, editDipTank, closeEditDip, alertsOpen, closeAlerts } = useGlobalModals();
  const today = new Date();
  const [demoDate, setDemoDate] = useState<Date | undefined>(today);

  return (
    <>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppStateProvider>
            <BrowserRouter>
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
                            <AppLayout 
                              selectedGroup={selectedGroup}
                              onGroupSelect={setSelectedGroup}
                            >
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
                          <AppLayout 
                            selectedGroup={selectedGroup}
                            onGroupSelect={setSelectedGroup}
                          >
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
                          <AppLayout 
                            selectedGroup={selectedGroup}
                            onGroupSelect={setSelectedGroup}
                          >
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
                          <AppLayout 
                            selectedGroup={selectedGroup}
                            onGroupSelect={setSelectedGroup}
                          >
                            <PerformancePage />
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
                          <AppLayout 
                            selectedGroup={selectedGroup}
                            onGroupSelect={setSelectedGroup}
                          >
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
                  <Route 
                    path="/alerts" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="Alerts" showHomeButton={true}>
                          <AppLayout 
                            selectedGroup={selectedGroup}
                            onGroupSelect={setSelectedGroup}
                          >
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
    </AgbotModalProvider>
  );
};

export default App;
