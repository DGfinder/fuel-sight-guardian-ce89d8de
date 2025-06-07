import { createContext, useContext, ReactNode, useState, useCallback } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ErrorFallback } from '@/components/ui/error-fallback';
import { useToast } from '@/hooks/use-toast';

interface AppStateContextType {
  setGlobalLoading: (loading: boolean, message?: string) => void;
  setGlobalError: (error: Error | string | null) => void;
  showToast: (title: string, description: string, variant?: 'default' | 'destructive') => void;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

interface AppStateProviderProps {
  children: ReactNode;
}

export function AppStateProvider({ children }: AppStateProviderProps) {
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>();
  const [error, setError] = useState<Error | string | null>(null);
  const { toast } = useToast();

  const setGlobalLoading = useCallback((loading: boolean, message?: string) => {
    setLoading(loading);
    setLoadingMessage(message);
  }, []);

  const setGlobalError = useCallback((error: Error | string | null) => {
    setError(error);
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : error,
      });
    }
  }, [toast]);

  const showToast = useCallback((title: string, description: string, variant: 'default' | 'destructive' = 'default') => {
    toast({
      title,
      description,
      variant,
    });
  }, [toast]);

  return (
    <AppStateContext.Provider value={{ setGlobalLoading, setGlobalError, showToast }}>
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <LoadingSpinner size={32} text={loadingMessage} />
        </div>
      )}
      {error && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <ErrorFallback 
            error={error} 
            resetErrorBoundary={() => setError(null)}
            className="max-w-md mx-auto"
          />
        </div>
      )}
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
} 