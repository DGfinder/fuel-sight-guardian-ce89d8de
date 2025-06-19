import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { TankModalProvider } from './contexts/TankModalContext'
import { GlobalModalsProvider } from './contexts/GlobalModalsContext'

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GlobalModalsProvider>
      <TankModalProvider>
        <App />
      </TankModalProvider>
    </GlobalModalsProvider>
  </React.StrictMode>
);
