import React from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from "@sentry/react";
import App from './App.tsx'
import './index.css'
import { TankModalProvider } from './contexts/TankModalContext'
import { GlobalModalsProvider } from './contexts/GlobalModalsContext'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
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
