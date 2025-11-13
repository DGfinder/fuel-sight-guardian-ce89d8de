import { useEffect, useRef } from 'react';
import L from 'leaflet';

/**
 * Custom hook to ensure proper cleanup of Leaflet map containers
 * Prevents "Map container is already initialized" error in React 19
 *
 * @param containerId - Optional unique ID for the map container
 * @returns Ref object indicating if cleanup has occurred
 */
export const useMapCleanup = (containerId?: string) => {
  const cleanupRef = useRef(false);

  useEffect(() => {
    return () => {
      // Mark cleanup as done
      cleanupRef.current = true;

      // If container ID provided, clean up Leaflet's internal state
      if (containerId) {
        const container = L.DomUtil.get(containerId);
        if (container && '_leaflet_id' in container) {
          // Remove Leaflet's internal ID to allow reinitialization
          delete (container as any)._leaflet_id;
        }
      }
    };
  }, [containerId]);

  return cleanupRef;
};

/**
 * Generate a unique map container ID
 * Useful for forcing complete remounts when needed
 */
export const useMapContainerId = () => {
  const idRef = useRef(`map-container-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  return idRef.current;
};
