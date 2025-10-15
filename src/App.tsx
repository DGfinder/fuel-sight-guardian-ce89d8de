import React, { useState, useEffect, Suspense, lazy } from "react";
import { QueryClientProvider, QueryClient, Query } from "@tanstack/react-query";
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
import EditDipModal from './components/modals/EditDipModal';
import { AlertsDrawer } from './components/AlertsDrawer';
import { AgbotModalProvider } from './contexts/AgbotModalContext';
import AgbotDetailsModal from './components/AgbotDetailsModal';
import AppLayout from '@/components/AppLayout';
import DataCentreLayout from '@/components/DataCentreLayout';

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
const DipHistoryPage = lazy(() => import('@/pages/DipHistoryPage'));
const AgbotPage = lazy(() => import('@/pages/AgbotPage'));
// Data Centre Analytics Platform
const DataCentrePage = lazy(() => import('@/pages/DataCentrePage'));
const DataImportPage = lazy(() => import('@/pages/DataImportPage'));
const GuardianDashboard = lazy(() => import('@/pages/GuardianDashboard'));
const CaptivePaymentsDashboard = lazy(() => import('@/pages/CaptivePaymentsDashboard'));
const SMBDashboard = lazy(() => import('@/pages/SMBDashboard'));
const GSFDashboard = lazy(() => import('@/pages/GSFDashboard'));
// LYTX Safety Analytics Platform (simple view active, advanced dashboards commented for later)
// const LYTXSafetyDashboard = lazy(() => import('@/pages/LYTXSafetyDashboard'));
const LytxSimpleDashboard = lazy(() => import('@/pages/LytxSimpleDashboard'));
// const StevemacsSafetyDashboard = lazy(() => import('@/pages/StevemacsSafetyDashboard'));
// const GSFSafetyDashboard = lazy(() => import('@/pages/GSFSafetyDashboard'));
// Fleet Management Platform
const FleetDashboard = lazy(() => import('@/pages/FleetDashboard'));
const VehicleDatabase = lazy(() => import('@/pages/VehicleDatabase'));
const StevemacsFleetDashboard = lazy(() => import('@/pages/StevemacsFleetDashboard'));
const GSFFleetDashboard = lazy(() => import('@/pages/GSFFleetDashboard'));
const MaintenanceDashboard = lazy(() => import('@/pages/MaintenanceDashboard'));
const DriverManagement = lazy(() => import('@/pages/DriverManagement'));
const TripAnalyticsPage = lazy(() => import('@/pages/TripAnalyticsPage'));
const MasterDataPage = lazy(() => import('@/pages/MasterDataPage'));
const SmartFillPage = lazy(() => import('@/pages/SmartFillPage'));
// MtData Analytics Platform
const MtDataDashboard = lazy(() => import('@/pages/MtDataDashboard'));
const MtDataStevemacsDashboard = lazy(() => import('@/pages/MtDataStevemacsDashboard'));
const MtDataGSFDashboard = lazy(() => import('@/pages/MtDataGSFDashboard'));
// Trip-Delivery Correlation Pages
const CorrelationPaymentsPage = lazy(() => import('@/pages/CorrelationPaymentsPage'));
const CorrelationTripsPage = lazy(() => import('@/pages/CorrelationTripsPage'));
// Enhanced Driver Management with Profile Modals
const DriverManagementPage = lazy(() => import('@/pages/DriverManagementPage'));

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
        const errorWithStatus = error as { status?: number; response?: { status?: number } };
        const status = typeof errorWithStatus?.status === 'number' ? errorWithStatus.status : errorWithStatus?.response?.status;
        if (status >= 400 && status < 500 && ![408, 429].includes(status)) {
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
      refetchInterval: (query) => {
        // Refetch tank data every 30 seconds if page is visible
        if ((query as Query)?.queryKey?.[0] === 'tanks' && document.visibilityState === 'visible') {
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
  // Reserved for future simulated date control on analytics pages

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
                  {/* Data Centre Analytics Platform */}
                  <Route 
                    path="/data-centre" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="Data Centre" showHomeButton={true}>
                          <DataCentreLayout>
                            <DataCentrePage />
                          </DataCentreLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/data-centre/guardian" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="Guardian Compliance" showHomeButton={true}>
                          <DataCentreLayout>
                            <GuardianDashboard />
                          </DataCentreLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/data-centre/guardian/smb" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="Stevemacs Guardian Analytics" showHomeButton={true}>
                          <DataCentreLayout>
                            <GuardianDashboard fleet="Stevemacs" />
                          </DataCentreLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/data-centre/guardian/gsf" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="Great Southern Fuels Guardian Analytics" showHomeButton={true}>
                          <DataCentreLayout>
                            <GuardianDashboard fleet="Great Southern Fuels" />
                          </DataCentreLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/data-centre/captive-payments" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="Captive Payments" showHomeButton={true}>
                          <DataCentreLayout>
                            <CaptivePaymentsDashboard />
                          </DataCentreLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/data-centre/captive-payments/smb" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="SMB Analytics" showHomeButton={true}>
                          <DataCentreLayout>
                            <SMBDashboard />
                          </DataCentreLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/data-centre/captive-payments/gsf" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="GSF Analytics" showHomeButton={true}>
                          <DataCentreLayout>
                            <GSFDashboard />
                          </DataCentreLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/data-centre/import" 
                    element={
                      <ProtectedRoute requiredRole="admin">
                        <RouteErrorBoundary routeName="Data Import" showHomeButton={true}>
                          <DataCentreLayout>
                            <DataImportPage />
                          </DataCentreLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  {/* LYTX Safety Analytics Routes (simple view first; advanced later) */}
                  <Route 
                    path="/data-centre/lytx-safety" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="LYTX Safety Dashboard" showHomeButton={true}>
                          <DataCentreLayout>
                            <LytxSimpleDashboard />
                          </DataCentreLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  {/* Stevemacs (aka SMB) simple view */}
                  <Route 
                    path="/data-centre/lytx-safety/stevemacs" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="Stevemacs Safety Analytics" showHomeButton={true}>
                          <DataCentreLayout>
                            <LytxSimpleDashboard />
                          </DataCentreLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  {/* SMB alias to Stevemacs */}
                  <Route 
                    path="/data-centre/lytx-safety/smb" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="Stevemacs Safety Analytics" showHomeButton={true}>
                          <DataCentreLayout>
                            <LytxSimpleDashboard />
                          </DataCentreLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  {/* GSF simple view */}
                  <Route 
                    path="/data-centre/lytx-safety/gsf" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="GSF Safety Analytics" showHomeButton={true}>
                          <DataCentreLayout>
                            <LytxSimpleDashboard />
                          </DataCentreLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  {/* Fleet Management Routes */}
                  <Route 
                    path="/data-centre/fleet" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="Fleet Management" showHomeButton={true}>
                          <DataCentreLayout>
                            <FleetDashboard />
                          </DataCentreLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/data-centre/fleet/database" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="Vehicle Database" showHomeButton={true}>
                          <DataCentreLayout>
                            <VehicleDatabase />
                          </DataCentreLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/data-centre/fleet/stevemacs" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="Stevemacs Fleet Analytics" showHomeButton={true}>
                          <DataCentreLayout>
                            <StevemacsFleetDashboard />
                          </DataCentreLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/data-centre/fleet/gsf" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="GSF Fleet Analytics" showHomeButton={true}>
                          <DataCentreLayout>
                            <GSFFleetDashboard />
                          </DataCentreLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/data-centre/fleet/maintenance" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="Maintenance & Asset Management" showHomeButton={true}>
                          <DataCentreLayout>
                            <MaintenanceDashboard />
                          </DataCentreLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/data-centre/fleet/drivers" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="Driver Management" showHomeButton={true}>
                          <DataCentreLayout>
                            <DriverManagement />
                          </DataCentreLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  <Route
                    path="/data-centre/fleet/trip-analytics"
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="Trip Analytics" showHomeButton={true}>
                          <DataCentreLayout>
                            <TripAnalyticsPage />
                          </DataCentreLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/data-centre/master-data"
                    element={
                      <ProtectedRoute requiredRole="admin">
                        <RouteErrorBoundary routeName="Master Data Configuration" showHomeButton={true}>
                          <MasterDataPage />
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    }
                  />
                  {/* MtData Analytics Platform */}
                  <Route 
                    path="/data-centre/mtdata" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="MtData Analytics" showHomeButton={true}>
                          <DataCentreLayout>
                            <MtDataDashboard />
                          </DataCentreLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/data-centre/mtdata/stevemacs" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="Stevemacs MtData Analytics" showHomeButton={true}>
                          <DataCentreLayout>
                            <MtDataStevemacsDashboard />
                          </DataCentreLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/data-centre/mtdata/gsf" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="GSF MtData Analytics" showHomeButton={true}>
                          <DataCentreLayout>
                            <MtDataGSFDashboard />
                          </DataCentreLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  {/* Trip-Delivery Correlation Routes */}
                  <Route 
                    path="/data-centre/captive-payments/correlation" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="Payment Trip Correlation" showHomeButton={true}>
                          <DataCentreLayout>
                            <CorrelationPaymentsPage />
                          </DataCentreLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/data-centre/mtdata/correlation" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="Trip Delivery Correlation" showHomeButton={true}>
                          <DataCentreLayout>
                            <CorrelationTripsPage />
                          </DataCentreLayout>
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  {/* Enhanced Driver Management with Profile Modals */}
                  <Route 
                    path="/data-centre/drivers" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="Driver Management" showHomeButton={true}>
                          <DriverManagementPage />
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/data-centre/drivers/stevemacs" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="Stevemacs Driver Management" showHomeButton={true}>
                          <DriverManagementPage fleet="Stevemacs" />
                        </RouteErrorBoundary>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/data-centre/drivers/gsf" 
                    element={
                      <ProtectedRoute>
                        <RouteErrorBoundary routeName="GSF Driver Management" showHomeButton={true}>
                          <DriverManagementPage fleet="Great Southern Fuels" />
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
