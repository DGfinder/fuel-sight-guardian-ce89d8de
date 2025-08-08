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
} else {
  console.log('🔧 Sentry disabled in development or missing VITE_SENTRY_DSN');
}

// Initialize security monitoring
securityManager.getSecurityMetrics();

// Make performance monitor available globally for error reporting
if (typeof window !== 'undefined') {
  (window as Window & { performanceMonitor: typeof performanceMonitor }).performanceMonitor = performanceMonitor;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GlobalModalsProvider>
      <TankModalProvider>
        <App />
      </TankModalProvider>
    </GlobalModalsProvider>
  </React.StrictMode>
);
