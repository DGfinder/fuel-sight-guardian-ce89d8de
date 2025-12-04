import { useLocation } from 'react-router-dom';

export type AppMode = 'fuel' | 'data-centre';

/**
 * Hook to detect and manage the current application mode
 * Returns 'data-centre' for routes starting with /data-centre
 * Returns 'fuel' for all other routes
 */
export function useAppMode(): {
  mode: AppMode;
  isDataCentreMode: boolean;
  isFuelMode: boolean;
  switchToDataCentre: () => string;
  switchToFuel: () => string;
} {
  const location = useLocation();
  
  const isDataCentreMode = location.pathname.startsWith('/data-centre');
  const mode: AppMode = isDataCentreMode ? 'data-centre' : 'fuel';
  
  return {
    mode,
    isDataCentreMode,
    isFuelMode: !isDataCentreMode,
    switchToDataCentre: () => '/data-centre',
    switchToFuel: () => '/'
  };
}