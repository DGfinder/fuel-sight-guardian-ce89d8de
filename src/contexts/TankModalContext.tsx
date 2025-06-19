import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Tank } from '@/types/fuel';

interface TankModalContextType {
  selectedTank: Tank | null;
  open: boolean;
  openModal: (tank: Tank) => void;
  closeModal: () => void;
}

const TankModalContext = createContext<TankModalContextType | undefined>(undefined);

export function TankModalProvider({ children }: { children: ReactNode }) {
  const [selectedTank, setSelectedTank] = useState<Tank | null>(null);
  const [open, setOpen] = useState(false);

  const openModal = (tank: Tank) => {
    setSelectedTank(tank);
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setSelectedTank(null);
  };

  return (
    <TankModalContext.Provider value={{ selectedTank, open, openModal, closeModal }}>
      {children}
    </TankModalContext.Provider>
  );
}

export function useTankModal() {
  const context = useContext(TankModalContext);
  if (!context) {
    throw new Error('useTankModal must be used within a TankModalProvider');
  }
  return context;
} 