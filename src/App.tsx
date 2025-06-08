import React, { useState } from "react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppStateProvider } from "@/contexts/AppStateContext";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import AppLayout from "@/components/AppLayout";
import Index from "@/pages/Index";
import NotFound from "@/pages/NotFound";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import SwanTransit from '@/pages/SwanTransit';
import Kalgoorlie from '@/pages/Kalgoorlie';
import SettingsPage from '@/pages/SettingsPage';
import { Login } from "@/pages/Login";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const Geraldton = () => <div className="p-8 text-2xl">Geraldton Dashboard (Coming Soon)</div>;
const GSFDepots = () => <div className="p-8 text-2xl">GSF Depots Dashboard (Coming Soon)</div>;
const BGC = () => <div className="p-8 text-2xl">BGC Dashboard (Coming Soon)</div>;

const App = () => {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppStateProvider>
          <BrowserRouter>
            <AuthProvider>
              <div className="min-h-screen flex w-full">
                <Toaster />
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
                        <SettingsPage />
                      </AppLayout>
                    </ProtectedRoute>
                  } />
                  <Route path="/login" element={<Login />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </div>
            </AuthProvider>
          </BrowserRouter>
        </AppStateProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
