import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

interface NetworkInformation extends EventTarget {
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  saveData?: boolean;
  downlink?: number;
  rtt?: number;
}

declare global {
  interface Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  }
}

interface ReducedMotionState {
  /** Whether animations should be reduced/disabled */
  shouldReduceMotion: boolean;
  /** Whether the device is mobile */
  isMobile: boolean;
  /** Whether user prefers reduced motion */
  prefersReducedMotion: boolean;
  /** Whether the network is slow (2g, 3g, or saveData enabled) */
  isSlowNetwork: boolean;
  /** The detected network type */
  networkType: string | null;
}

/**
 * Hook to detect if animations should be reduced based on:
 * - Mobile device detection
 * - User's prefers-reduced-motion preference
 * - Slow network connections (2G, 3G, or data saver mode)
 */
export function useReducedMotion(): ReducedMotionState {
  const [state, setState] = useState<ReducedMotionState>({
    shouldReduceMotion: false,
    isMobile: false,
    prefersReducedMotion: false,
    isSlowNetwork: false,
    networkType: null,
  });

  useEffect(() => {
    // Check mobile
    const checkMobile = () => window.innerWidth <= MOBILE_BREAKPOINT;

    // Check prefers-reduced-motion
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const checkReducedMotion = () => motionQuery.matches;

    // Check network
    const getConnection = (): NetworkInformation | null => {
      return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
    };

    const checkSlowNetwork = (): { isSlowNetwork: boolean; networkType: string | null } => {
      const connection = getConnection();
      if (!connection) {
        return { isSlowNetwork: false, networkType: null };
      }

      const effectiveType = connection.effectiveType;
      const saveData = connection.saveData;

      // Consider slow if: 2G, 3G, slow-2g, or data saver is on
      const isSlowNetwork = saveData ||
        effectiveType === 'slow-2g' ||
        effectiveType === '2g' ||
        effectiveType === '3g';

      return { isSlowNetwork, networkType: effectiveType || null };
    };

    const updateState = () => {
      const isMobile = checkMobile();
      const prefersReducedMotion = checkReducedMotion();
      const { isSlowNetwork, networkType } = checkSlowNetwork();

      // Reduce motion if any condition is true
      const shouldReduceMotion = isMobile || prefersReducedMotion || isSlowNetwork;

      setState({
        shouldReduceMotion,
        isMobile,
        prefersReducedMotion,
        isSlowNetwork,
        networkType,
      });
    };

    // Initial check
    updateState();

    // Listen for changes
    const mobileQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    mobileQuery.addEventListener('change', updateState);
    motionQuery.addEventListener('change', updateState);

    const connection = getConnection();
    if (connection) {
      connection.addEventListener('change', updateState);
    }

    return () => {
      mobileQuery.removeEventListener('change', updateState);
      motionQuery.removeEventListener('change', updateState);
      if (connection) {
        connection.removeEventListener('change', updateState);
      }
    };
  }, []);

  return state;
}

/**
 * Get current network quality for adaptive fetching
 * Returns multiplier for staleTime/refetchInterval
 */
export function getNetworkQualityMultiplier(): number {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  if (!connection) return 1;

  // If data saver is on, be very conservative
  if (connection.saveData) return 4;

  switch (connection.effectiveType) {
    case 'slow-2g':
      return 6; // 6x longer stale times
    case '2g':
      return 4; // 4x longer
    case '3g':
      return 2; // 2x longer
    case '4g':
    default:
      return 1; // Normal
  }
}

/**
 * Check if we're on a slow network (useful outside React components)
 */
export function isSlowNetwork(): boolean {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  if (!connection) return false;

  return connection.saveData ||
    connection.effectiveType === 'slow-2g' ||
    connection.effectiveType === '2g' ||
    connection.effectiveType === '3g';
}
