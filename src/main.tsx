import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { TankModalProvider } from './contexts/TankModalContext'

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TankModalProvider>
      <App />
    </TankModalProvider>
  </React.StrictMode>
);
