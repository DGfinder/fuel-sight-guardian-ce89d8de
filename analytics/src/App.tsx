import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AnalyticsLayout } from './components/AnalyticsLayout';
import { Dashboard } from './pages/Dashboard';
import { GuardianPage } from './pages/GuardianPage';
import { DeliveryPage } from './pages/DeliveryPage';
import { ImportPage } from './pages/ImportPage';
import { ReportsPage } from './pages/ReportsPage';

// Create a new QueryClient for the analytics app
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      networkMode: 'online',
    },
    mutations: {
      retry: (failureCount, error: any) => {
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

function App() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/analytics">
        <AuthProvider>
          <Toaster 
            position="top-right" 
            richColors 
            closeButton
            toastOptions={{
              duration: 4000,
            }}
          />
          
          <Routes>
            {/* Protected routes with analytics layout */}
            <Route path="/" element={
              <ProtectedRoute>
                <AnalyticsLayout>
                  <Dashboard />
                </AnalyticsLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/guardian" element={
              <ProtectedRoute requiredRoles={['admin', 'manager', 'compliance_manager']}>
                <AnalyticsLayout>
                  <GuardianPage />
                </AnalyticsLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/deliveries" element={
              <ProtectedRoute requiredRoles={['admin', 'manager']}>
                <AnalyticsLayout>
                  <DeliveryPage />
                </AnalyticsLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/import" element={
              <ProtectedRoute requiredRoles={['admin', 'manager']}>
                <AnalyticsLayout>
                  <ImportPage />
                </AnalyticsLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/reports" element={
              <ProtectedRoute requiredRoles={['admin', 'manager', 'compliance_manager']}>
                <AnalyticsLayout>
                  <ReportsPage />
                </AnalyticsLayout>
              </ProtectedRoute>
            } />
            
            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;