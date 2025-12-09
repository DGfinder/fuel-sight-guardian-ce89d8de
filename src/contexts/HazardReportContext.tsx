/**
 * Hazard Report Context
 * Provides global state for the hazard report dialog
 * Allows any component to open the dialog, optionally pre-selecting a tank
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { CustomerTank } from '@/hooks/useCustomerAuth';

interface HazardReportContextType {
  /** Whether the hazard report dialog is open */
  isOpen: boolean;
  /** Pre-selected tank (if opened from tank detail page) */
  preselectedTank: CustomerTank | null;
  /** Open the hazard report dialog, optionally pre-selecting a tank */
  openHazardReport: (tank?: CustomerTank) => void;
  /** Close the hazard report dialog */
  closeHazardReport: () => void;
}

const HazardReportContext = createContext<HazardReportContextType | undefined>(undefined);

interface HazardReportProviderProps {
  children: ReactNode;
}

export function HazardReportProvider({ children }: HazardReportProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [preselectedTank, setPreselectedTank] = useState<CustomerTank | null>(null);

  const openHazardReport = useCallback((tank?: CustomerTank) => {
    setPreselectedTank(tank || null);
    setIsOpen(true);
  }, []);

  const closeHazardReport = useCallback(() => {
    setIsOpen(false);
    // Delay clearing the tank to allow for exit animation
    setTimeout(() => {
      setPreselectedTank(null);
    }, 300);
  }, []);

  return (
    <HazardReportContext.Provider
      value={{
        isOpen,
        preselectedTank,
        openHazardReport,
        closeHazardReport,
      }}
    >
      {children}
    </HazardReportContext.Provider>
  );
}

/**
 * Hook to access the hazard report context
 * Must be used within a HazardReportProvider
 */
export function useHazardReportContext() {
  const context = useContext(HazardReportContext);
  if (!context) {
    throw new Error('useHazardReportContext must be used within a HazardReportProvider');
  }
  return context;
}
