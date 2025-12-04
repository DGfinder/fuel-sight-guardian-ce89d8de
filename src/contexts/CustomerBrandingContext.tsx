import React, { createContext, useContext, useEffect, useState } from 'react';
import { useCustomerAccount } from '@/hooks/useCustomerAuth';
import { parseColorToRgb, lightenColor } from '@/utils/colorConversion';

/**
 * Customer branding configuration
 */
export interface CustomerBranding {
  logoUrl: string | null;
  logoUrlDark: string | null;
  primaryColor: string;
  secondaryColor: string;
  primaryColorDark: string;
  secondaryColorDark: string;
  isCustomBranded: boolean;
  isLoading: boolean;
}

/**
 * Default GSF branding colors
 */
const GSF_BRANDING = {
  primary: '#008457',      // GSF Green
  secondary: '#FEDF19',    // GSF Gold
  primaryDark: '#006b47',  // Darker GSF Green for dark mode
  secondaryDark: '#FEDF19', // Same gold for dark mode
};

/**
 * Context for customer branding
 */
const CustomerBrandingContext = createContext<CustomerBranding | undefined>(undefined);

/**
 * Hook to access customer branding
 */
export function useCustomerBranding(): CustomerBranding {
  const context = useContext(CustomerBrandingContext);
  if (!context) {
    throw new Error('useCustomerBranding must be used within CustomerBrandingProvider');
  }
  return context;
}

/**
 * Provider component that manages customer branding
 * Injects CSS custom properties into the document root
 */
export function CustomerBrandingProvider({ children }: { children: React.ReactNode }) {
  const { data: customerAccount, isLoading } = useCustomerAccount();
  const [branding, setBranding] = useState<CustomerBranding>({
    logoUrl: null,
    logoUrlDark: null,
    primaryColor: GSF_BRANDING.primary,
    secondaryColor: GSF_BRANDING.secondary,
    primaryColorDark: GSF_BRANDING.primaryDark,
    secondaryColorDark: GSF_BRANDING.secondaryDark,
    isCustomBranded: false,
    isLoading: true,
  });

  useEffect(() => {
    if (isLoading) {
      setBranding(prev => ({ ...prev, isLoading: true }));
      return;
    }

    // Check if customer has custom branding
    const hasCustomBranding =
      !!customerAccount?.logo_url ||
      !!customerAccount?.primary_color ||
      !!customerAccount?.secondary_color;

    // Get colors (custom or default)
    const primaryColor = customerAccount?.primary_color || GSF_BRANDING.primary;
    const secondaryColor = customerAccount?.secondary_color || GSF_BRANDING.secondary;

    // Calculate dark mode colors if not explicitly set
    let primaryColorDark = customerAccount?.primary_color_dark;
    if (!primaryColorDark && customerAccount?.primary_color) {
      primaryColorDark = lightenColor(customerAccount.primary_color, 15);
    } else if (!primaryColorDark) {
      primaryColorDark = GSF_BRANDING.primaryDark;
    }

    let secondaryColorDark = customerAccount?.secondary_color_dark;
    if (!secondaryColorDark && customerAccount?.secondary_color) {
      secondaryColorDark = lightenColor(customerAccount.secondary_color, 15);
    } else if (!secondaryColorDark) {
      secondaryColorDark = GSF_BRANDING.secondaryDark;
    }

    // Update branding state
    setBranding({
      logoUrl: customerAccount?.logo_url || null,
      logoUrlDark: customerAccount?.logo_url_dark || null,
      primaryColor,
      secondaryColor,
      primaryColorDark,
      secondaryColorDark,
      isCustomBranded: hasCustomBranding,
      isLoading: false,
    });

    // Inject CSS variables into document root
    try {
      const root = document.documentElement;

      // Convert colors to RGB format for CSS custom properties
      const primaryRgb = parseColorToRgb(primaryColor);
      const secondaryRgb = parseColorToRgb(secondaryColor);

      // Set CSS variables for light mode
      root.style.setProperty('--customer-primary-rgb', primaryRgb);
      root.style.setProperty('--customer-secondary-rgb', secondaryRgb);

      // Set dark mode colors
      const primaryDarkRgb = parseColorToRgb(primaryColorDark);
      const secondaryDarkRgb = parseColorToRgb(secondaryColorDark);

      // Store dark mode values as separate variables
      root.style.setProperty('--customer-primary-dark-rgb', primaryDarkRgb);
      root.style.setProperty('--customer-secondary-dark-rgb', secondaryDarkRgb);

      console.log('✅ Customer branding applied:', {
        isCustom: hasCustomBranding,
        customer: customerAccount?.customer_name,
        primaryRgb,
        secondaryRgb,
        primaryDarkRgb,
        secondaryDarkRgb,
      });
    } catch (error) {
      console.error('Failed to inject branding CSS variables:', error);
    }
  }, [customerAccount, isLoading]);

  // Cleanup: Reset to GSF branding on unmount
  useEffect(() => {
    return () => {
      try {
        const root = document.documentElement;
        const gsfPrimaryRgb = parseColorToRgb(GSF_BRANDING.primary);
        const gsfSecondaryRgb = parseColorToRgb(GSF_BRANDING.secondary);
        const gsfPrimaryDarkRgb = parseColorToRgb(GSF_BRANDING.primaryDark);
        const gsfSecondaryDarkRgb = parseColorToRgb(GSF_BRANDING.secondaryDark);

        root.style.setProperty('--customer-primary-rgb', gsfPrimaryRgb);
        root.style.setProperty('--customer-secondary-rgb', gsfSecondaryRgb);
        root.style.setProperty('--customer-primary-dark-rgb', gsfPrimaryDarkRgb);
        root.style.setProperty('--customer-secondary-dark-rgb', gsfSecondaryDarkRgb);

        console.log('🔄 Customer branding reset to GSF defaults');
      } catch (error) {
        console.error('Failed to reset branding CSS variables:', error);
      }
    };
  }, []);

  return (
    <CustomerBrandingContext.Provider value={branding}>
      {children}
    </CustomerBrandingContext.Provider>
  );
}
