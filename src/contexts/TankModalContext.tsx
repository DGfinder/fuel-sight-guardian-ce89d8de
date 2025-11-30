import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Tank } from '@/types/fuel';
import { MapItem } from '@/hooks/useMapData';

interface TankModalContextType {
  selectedTank: Tank | null;
  open: boolean;
  openModal: (tank: Tank) => void;
  openModalFromMap: (mapItem: MapItem) => void;
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

  const openModalFromMap = (mapItem: MapItem) => {
    // Convert MapItem to Tank format for the modal
    const tank: Tank = {
      id: mapItem.id,
      location: mapItem.location,
      group_name: mapItem.group_name,
      current_level_percent: mapItem.current_level_percent ?? undefined,
      current_level: mapItem.current_level,
      rolling_avg: mapItem.rolling_avg,
      days_to_min_level: mapItem.days_to_min_level ?? undefined,
      product_type: mapItem.product_type,
      latest_dip_date: mapItem.latest_dip_date ?? undefined,
      subgroup: mapItem.subgroup,
      address: mapItem.address,
      latitude: mapItem.latitude,
      longitude: mapItem.longitude,
      safe_level: mapItem.safe_level,
      min_level: mapItem.min_level,
    };
    setSelectedTank(tank);
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setSelectedTank(null);
  };

  return (
    <TankModalContext.Provider value={{ selectedTank, open, openModal, openModalFromMap, closeModal }}>
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