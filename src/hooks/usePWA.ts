import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export interface PWAState {
  isOffline: boolean;
  isUpdateAvailable: boolean;
  isInstallable: boolean;
  isInstalled: boolean;
  updateServiceWorker: () => void;
  installApp: () => void;
}

export function usePWA(): PWAState {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Service Worker registration
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Monitor install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
      }
      
      setDeferredPrompt(null);
    }
  };

  return {
    isOffline,
    isUpdateAvailable: needRefresh,
    isInstallable,
    isInstalled,
    updateServiceWorker: () => updateServiceWorker(true),
    installApp,
  };
}

// Hook for background sync functionality
export function useBackgroundSync() {
  const [pendingSyncs, setPendingSyncs] = useState<string[]>([]);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then((registration) => {
        // Register background sync
        return registration.sync.register('background-sync');
      }).catch((error) => {
        console.log('Background sync registration failed:', error);
      });
    }

    // Listen for sync events
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'SYNC_STATUS') {
        setPendingSyncs(event.data.pendingSyncs || []);
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
    }

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      }
    };
  }, []);

  const addToSyncQueue = (data: any, type: string) => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.controller?.postMessage({
        type: 'ADD_TO_SYNC_QUEUE',
        data,
        syncType: type,
      });
    } else {
      // Fallback: store in localStorage for later sync
      const existingQueue = JSON.parse(localStorage.getItem('offline-queue') || '[]');
      existingQueue.push({ data, type, timestamp: Date.now() });
      localStorage.setItem('offline-queue', JSON.stringify(existingQueue));
    }
  };

  return {
    pendingSyncs,
    addToSyncQueue,
  };
}

// Hook for caching fuel data for offline access
export function useOfflineData() {
  const [cachedData, setCachedData] = useState<any>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  useEffect(() => {
    // Load cached data from localStorage
    const loadCachedData = () => {
      try {
        const cached = localStorage.getItem('fuel-data-cache');
        const lastSync = localStorage.getItem('fuel-data-last-sync');
        
        if (cached) {
          setCachedData(JSON.parse(cached));
        }
        
        if (lastSync) {
          setLastSyncTime(new Date(lastSync));
        }
      } catch (error) {
        console.error('Error loading cached data:', error);
      }
    };

    loadCachedData();
  }, []);

  const cacheData = (data: any) => {
    try {
      localStorage.setItem('fuel-data-cache', JSON.stringify(data));
      localStorage.setItem('fuel-data-last-sync', new Date().toISOString());
      setCachedData(data);
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('Error caching data:', error);
    }
  };

  const clearCache = () => {
    localStorage.removeItem('fuel-data-cache');
    localStorage.removeItem('fuel-data-last-sync');
    setCachedData(null);
    setLastSyncTime(null);
  };

  return {
    cachedData,
    lastSyncTime,
    cacheData,
    clearCache,
  };
}

// Hook for push notifications
export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  };

  const showNotification = (title: string, options?: NotificationOptions) => {
    if (permission === 'granted' && isSupported) {
      new Notification(title, {
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        ...options,
      });
    }
  };

  const subscribeToPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.VITE_VAPID_PUBLIC_KEY,
      });

      return subscription;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return null;
    }
  };

  return {
    permission,
    isSupported,
    requestPermission,
    showNotification,
    subscribeToPush,
  };
}