import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Tank } from '@/types/fuel';

interface GlobalModalsContextType {
  editDipOpen: boolean;
  editDipTank: Tank | null;
  openEditDip: (tank: Tank) => void;
  closeEditDip: () => void;
  alertsOpen: boolean;
  openAlerts: () => void;
  closeAlerts: () => void;
}

const GlobalModalsContext = createContext<GlobalModalsContextType | undefined>(undefined);

export function GlobalModalsProvider({ children }: { children: ReactNode }) {
  const [editDipOpen, setEditDipOpen] = useState(false);
  const [editDipTank, setEditDipTank] = useState<Tank | null>(null);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const openEditDip = (tank: Tank) => {
    setEditDipTank(tank);
    setEditDipOpen(true);
  };
  const closeEditDip = () => {
    setEditDipOpen(false);
    setEditDipTank(null);
  };
  const openAlerts = () => setAlertsOpen(true);
  const closeAlerts = () => setAlertsOpen(false);

  return (
    <GlobalModalsContext.Provider value={{ editDipOpen, editDipTank, openEditDip, closeEditDip, alertsOpen, openAlerts, closeAlerts }}>
      {children}
    </GlobalModalsContext.Provider>
  );
}

export function useGlobalModals() {
  const context = useContext(GlobalModalsContext);
  if (!context) {
    throw new Error('useGlobalModals must be used within a GlobalModalsProvider');
  }
  return context;
} 