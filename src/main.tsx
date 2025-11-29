import React from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from "@sentry/react";
import App from './App.tsx'
import './index.css'
import { TankModalProvider } from './contexts/TankModalContext'
import { GlobalModalsProvider } from './contexts/GlobalModalsContext'
import { performanceMonitor } from './lib/performance-monitor'
import { securityManager } from './lib/security'

// Only initialize Sentry in production
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    // Lower sample rate in production to reduce quota usage
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: import.meta.env.PROD ? 0.05 : 0.1,
    environment: import.meta.env.PROD ? 'production' : 'development',
    beforeSend(event) {
      // Filter out development/testing events
      if (!import.meta.env.PROD) {
        return null;
      }
      return event;
    },
  });
}

// Initialize security monitoring
securityManager.getSecurityMetrics();

// Make performance monitor available globally for error reporting
if (typeof window !== 'undefined') {
  (window as Window & { performanceMonitor: typeof performanceMonitor }).performanceMonitor = performanceMonitor;
}

// Handle stale chunk errors by reloading the page (happens after deployments)
window.addEventListener('error', (event) => {
  if (
    event.message?.includes('Failed to fetch dynamically imported module') ||
    event.message?.includes('Loading chunk') ||
    event.message?.includes('Loading CSS chunk')
  ) {
    // Prevent infinite reload loop with 10-second cooldown
    const lastReload = sessionStorage.getItem('chunk-error-reload');
    const now = Date.now();
    if (!lastReload || now - parseInt(lastReload) > 10000) {
      sessionStorage.setItem('chunk-error-reload', now.toString());
      window.location.reload();
    }
  }
});

// Also catch unhandled promise rejections for dynamic imports
window.addEventListener('unhandledrejection', (event) => {
  if (
    event.reason?.message?.includes('Failed to fetch dynamically imported module') ||
    event.reason?.message?.includes('Loading chunk')
  ) {
    const lastReload = sessionStorage.getItem('chunk-error-reload');
    const now = Date.now();
    if (!lastReload || now - parseInt(lastReload) > 10000) {
      sessionStorage.setItem('chunk-error-reload', now.toString());
      window.location.reload();
    }
  }
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GlobalModalsProvider>
      <TankModalProvider>
        <App />
      </TankModalProvider>
    </GlobalModalsProvider>
  </React.StrictMode>
);
