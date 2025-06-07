
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppStateProvider } from "@/contexts/AppStateContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { useState } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const App = () => {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppStateProvider>
          <BrowserRouter>
            <AuthProvider>
              <SidebarProvider>
                <div className="min-h-screen flex w-full">
                  <Toaster />
                  <Sonner />
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
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </div>
              </SidebarProvider>
            </AuthProvider>
          </BrowserRouter>
        </AppStateProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
