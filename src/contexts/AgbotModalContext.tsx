import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AgbotLocation } from '@/services/agbot-api';
import { MapItem } from '@/hooks/useMapData';

interface AgbotModalContextType {
  selectedLocation: AgbotLocation | null;
  open: boolean;
  openModal: (location: AgbotLocation) => void;
  openModalFromMap: (mapItem: MapItem) => void;
  closeModal: () => void;
}

const AgbotModalContext = createContext<AgbotModalContextType | undefined>(undefined);

export function AgbotModalProvider({ children }: { children: ReactNode }) {
  const [selectedLocation, setSelectedLocation] = useState<AgbotLocation | null>(null);
  const [open, setOpen] = useState(false);

  const openModal = (location: AgbotLocation) => {
    setSelectedLocation(location);
    setOpen(true);
  };

  const openModalFromMap = (mapItem: MapItem) => {
    // Extract the original AgbotLocation from the MapItem
    if (mapItem.source === 'agbot' && mapItem.originalData) {
      setSelectedLocation(mapItem.originalData as AgbotLocation);
      setOpen(true);
    }
  };

  const closeModal = () => {
    setOpen(false);
    setSelectedLocation(null);
  };

  return (
    <AgbotModalContext.Provider value={{ selectedLocation, open, openModal, openModalFromMap, closeModal }}>
      {children}
    </AgbotModalContext.Provider>
  );
}

export function useAgbotModal() {
  const context = useContext(AgbotModalContext);
  if (!context) {
    throw new Error('useAgbotModal must be used within an AgbotModalProvider');
  }
  return context;
}