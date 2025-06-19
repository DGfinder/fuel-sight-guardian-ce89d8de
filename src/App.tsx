import React, { useState, useEffect } from "react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppStateProvider } from "@/contexts/AppStateContext";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import AppLayout from "@/components/AppLayout";
import Index from "@/pages/Index";
import NotFound from "@/pages/NotFound";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import SwanTransit from '@/pages/SwanTransit';
import Kalgoorlie from '@/pages/Kalgoorlie';
import Settings from '@/pages/Settings';
import Login from "@/pages/Login";
import ResetPassword from '@/pages/ResetPassword';
import { RealtimeErrorBoundary } from '@/components/RealtimeErrorBoundary';
import Geraldton from '@/pages/Geraldton';
import GSFDepots from '@/pages/GSFDepots';
import BGC from '@/pages/BGC';
import TanksPage from '@/pages/TanksPage';
import AlertsPage from '@/pages/AlertsPage';
import HealthPage from '@/pages/HealthPage';
import { useTankModal } from './contexts/TankModalContext';
import { TankDetailsModal } from './components/TankDetailsModal';
import { useGlobalModals } from './contexts/GlobalModalsContext';
import EditDipModal from './components/modals/EditDipModal';
import { AlertsDrawer } from './components/AlertsDrawer';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function HashRedirector() {
  const navigate = useNavigate();
  useEffect(() => {
    if (window.location.hash.includes('access_token')) {
      navigate('/reset-password' + window.location.hash, { replace: true });
    }
  }, [navigate]);
  return null;
}

const App = () => {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const { selectedTank, open, closeModal } = useTankModal();
  const { editDipOpen, editDipTank, closeEditDip, alertsOpen, closeAlerts } = useGlobalModals();

  return (
    <>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppStateProvider>
            <BrowserRouter>
              <HashRedirector />
              <Toaster />
              <RealtimeErrorBoundary>
                <Routes>
                  <Route 
                    path="/" 
                    element={
                      <ProtectedRoute>
                        <AppLayout 
                          selectedGroup={selectedGroup}
                          onGroupSelect={setSelectedGroup}
                        >
                          <Index selectedGroup={selectedGroup} />
                        </AppLayout>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/tanks" 
                    element={
                      <ProtectedRoute>
                        <AppLayout 
                          selectedGroup={selectedGroup}
                          onGroupSelect={setSelectedGroup}
                        >
                          <TanksPage />
                        </AppLayout>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/swan-transit" 
                    element={
                      <ProtectedRoute>
                        <SwanTransit />
                      </ProtectedRoute>
                    } 
                  />
                  <Route path="/kalgoorlie" element={<ProtectedRoute><Kalgoorlie /></ProtectedRoute>} />
                  <Route path="/geraldton" element={<ProtectedRoute><Geraldton /></ProtectedRoute>} />
                  <Route path="/gsf-depots" element={<ProtectedRoute><GSFDepots /></ProtectedRoute>} />
                  <Route path="/bgc" element={<ProtectedRoute><BGC /></ProtectedRoute>} />
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
                        <AppLayout 
                          selectedGroup={selectedGroup}
                          onGroupSelect={setSelectedGroup}
                        >
                          <AlertsPage />
                        </AppLayout>
                      </ProtectedRoute>
                    } 
                  />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </RealtimeErrorBoundary>
            </BrowserRouter>
            <TankDetailsModal tank={selectedTank} open={open} onOpenChange={closeModal} />
            <EditDipModal
              isOpen={editDipOpen && !!editDipTank}
              onClose={closeEditDip}
              initialGroupId={editDipTank?.group_id || ''}
              initialTankId={editDipTank?.id || ''}
            />
            <AlertsDrawer
              open={alertsOpen}
              onOpenChange={closeAlerts}
              tanks={[]} // You may want to pass tanks from context or props
            />
          </AppStateProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </>
  );
};

export default App;
