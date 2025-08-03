import { useLocation } from 'react-router-dom';

export type AppMode = 'fuel' | 'analytics';

/**
 * Hook to detect and manage the current application mode
 * Returns 'analytics' for routes starting with /analytics
 * Returns 'fuel' for all other routes
 */
export function useAppMode(): {
  mode: AppMode;
  isAnalyticsMode: boolean;
  isFuelMode: boolean;
  switchToAnalytics: () => string;
  switchToFuel: () => string;
} {
  const location = useLocation();
  
  const isAnalyticsMode = location.pathname.startsWith('/analytics');
  const mode: AppMode = isAnalyticsMode ? 'analytics' : 'fuel';
  
  return {
    mode,
    isAnalyticsMode,
    isFuelMode: !isAnalyticsMode,
    switchToAnalytics: () => '/analytics',
    switchToFuel: () => '/'
  };
}