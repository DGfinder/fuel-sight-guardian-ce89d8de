import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, RefreshCw, Wifi, WifiOff, X, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWA } from '@/hooks/usePWA';

// Install prompt component
interface InstallPromptProps {
  show: boolean;
  onInstall: () => void;
  onDismiss: () => void;
}

export function InstallPrompt({ show, onInstall, onDismiss }: InstallPromptProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
        >
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <Smartphone className="h-6 w-6 text-white" />
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900">
                  Install Fuel Sight Guardian
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Add to your home screen for quick access and offline functionality.
                </p>
                
                <div className="flex space-x-2 mt-3">
                  <Button 
                    onClick={onInstall}
                    size="sm"
                    className="flex-1"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Install
                  </Button>
                  <Button 
                    onClick={onDismiss}
                    variant="outline"
                    size="sm"
                  >
                    Later
                  </Button>
                </div>
              </div>
              
              <button
                onClick={onDismiss}
                className="flex-shrink-0 p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Update available prompt
interface UpdatePromptProps {
  show: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
}

export function UpdatePrompt({ show, onUpdate, onDismiss }: UpdatePromptProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -100 }}
          className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
        >
          <div className="bg-blue-50 border border-blue-200 rounded-lg shadow-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 text-white" />
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-blue-900">
                  Update Available
                </h3>
                <p className="text-sm text-blue-700 mt-1">
                  A new version of Fuel Sight Guardian is available with improvements and bug fixes.
                </p>
                
                <div className="flex space-x-2 mt-3">
                  <Button 
                    onClick={onUpdate}
                    size="sm"
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Update Now
                  </Button>
                  <Button 
                    onClick={onDismiss}
                    variant="outline"
                    size="sm"
                    className="border-blue-300 text-blue-700 hover:bg-blue-100"
                  >
                    Later
                  </Button>
                </div>
              </div>
              
              <button
                onClick={onDismiss}
                className="flex-shrink-0 p-1 hover:bg-blue-100 rounded transition-colors"
              >
                <X className="h-4 w-4 text-blue-400" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Offline status indicator
interface OfflineIndicatorProps {
  isOffline: boolean;
}

export function OfflineIndicator({ isOffline }: OfflineIndicatorProps) {
  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50"
        >
          <div className="bg-amber-50 border border-amber-200 rounded-lg shadow-lg px-4 py-2">
            <div className="flex items-center space-x-2">
              <WifiOff className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">
                You're offline
              </span>
              <span className="text-xs text-amber-600">
                • Using cached data
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Network status indicator
export function NetworkStatus() {
  const { isOffline } = usePWA();
  const [showReconnected, setShowReconnected] = React.useState(false);
  const [wasOffline, setWasOffline] = React.useState(false);

  React.useEffect(() => {
    if (wasOffline && !isOffline) {
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    }
    setWasOffline(isOffline);
  }, [isOffline, wasOffline]);

  return (
    <>
      <OfflineIndicator isOffline={isOffline} />
      
      <AnimatePresence>
        {showReconnected && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50"
          >
            <div className="bg-green-50 border border-green-200 rounded-lg shadow-lg px-4 py-2">
              <div className="flex items-center space-x-2">
                <Wifi className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  Back online
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// PWA Manager component that handles all PWA-related UI
export function PWAManager() {
  const { 
    isUpdateAvailable, 
    isInstallable, 
    updateServiceWorker, 
    installApp 
  } = usePWA();
  
  const [showInstallPrompt, setShowInstallPrompt] = React.useState(false);
  const [showUpdatePrompt, setShowUpdatePrompt] = React.useState(false);
  const [installDismissed, setInstallDismissed] = React.useState(false);

  React.useEffect(() => {
    // Show install prompt after 10 seconds if installable and not dismissed
    if (isInstallable && !installDismissed) {
      const timer = setTimeout(() => {
        setShowInstallPrompt(true);
      }, 10000);
      
      return () => clearTimeout(timer);
    }
  }, [isInstallable, installDismissed]);

  React.useEffect(() => {
    // Show update prompt immediately when available
    if (isUpdateAvailable) {
      setShowUpdatePrompt(true);
    }
  }, [isUpdateAvailable]);

  const handleInstall = () => {
    installApp();
    setShowInstallPrompt(false);
  };

  const handleInstallDismiss = () => {
    setShowInstallPrompt(false);
    setInstallDismissed(true);
    // Remember dismissal for 24 hours
    localStorage.setItem('pwa-install-dismissed', String(Date.now() + 24 * 60 * 60 * 1000));
  };

  const handleUpdate = () => {
    updateServiceWorker();
    setShowUpdatePrompt(false);
  };

  const handleUpdateDismiss = () => {
    setShowUpdatePrompt(false);
  };

  // Check if install was previously dismissed
  React.useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed && Date.now() < parseInt(dismissed)) {
      setInstallDismissed(true);
    }
  }, []);

  return (
    <>
      <InstallPrompt
        show={showInstallPrompt}
        onInstall={handleInstall}
        onDismiss={handleInstallDismiss}
      />
      
      <UpdatePrompt
        show={showUpdatePrompt}
        onUpdate={handleUpdate}
        onDismiss={handleUpdateDismiss}
      />
      
      <NetworkStatus />
    </>
  );
}

// Sync status indicator for background operations
interface SyncStatusProps {
  pendingSyncs: string[];
}

export function SyncStatus({ pendingSyncs }: SyncStatusProps) {
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    setShow(pendingSyncs.length > 0);
  }, [pendingSyncs]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="fixed bottom-4 left-4 z-40"
        >
          <div className="bg-blue-50 border border-blue-200 rounded-lg shadow-sm px-3 py-2">
            <div className="flex items-center space-x-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <RefreshCw className="h-4 w-4 text-blue-600" />
              </motion.div>
              <span className="text-sm text-blue-800">
                Syncing {pendingSyncs.length} item{pendingSyncs.length > 1 ? 's' : ''}...
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}