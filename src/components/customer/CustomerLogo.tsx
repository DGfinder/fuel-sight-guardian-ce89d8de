import React, { useState } from 'react';
import { useTheme } from 'next-themes';
import { useCustomerBranding } from '@/contexts/CustomerBrandingContext';
import gsfLogo from '@/assets/logo.png';
import { cn } from '@/lib/utils';

/**
 * Dynamic customer logo component that switches between light and dark mode variants
 * Falls back to GSF logo if no custom logo is provided
 */

interface CustomerLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  alt?: string;
}

const sizeClasses = {
  sm: 'h-6',
  md: 'h-8',
  lg: 'h-12',
};

export function CustomerLogo({ className, size = 'md', alt }: CustomerLogoProps) {
  const { logoUrl, logoUrlDark, isCustomBranded, isLoading } = useCustomerBranding();
  const { theme, resolvedTheme } = useTheme();
  const [imageError, setImageError] = useState(false);

  // Determine if we're in dark mode
  // resolvedTheme accounts for "system" theme setting
  const isDarkMode = resolvedTheme === 'dark' || (theme === 'dark');

  // Determine which logo to use
  const getLogoSrc = (): string => {
    // If image failed to load or no custom logo, use GSF logo
    if (imageError || !isCustomBranded) {
      return gsfLogo;
    }

    // If in dark mode and dark logo is available, use it
    if (isDarkMode && logoUrlDark) {
      return logoUrlDark;
    }

    // Otherwise use the light logo (or GSF fallback)
    return logoUrl || gsfLogo;
  };

  // Handle image load error
  const handleError = () => {
    console.warn('Failed to load custom logo, falling back to GSF logo');
    setImageError(true);
  };

  // Reset error state when logo URLs change
  React.useEffect(() => {
    setImageError(false);
  }, [logoUrl, logoUrlDark]);

  // Generate alt text
  const altText = alt || (isCustomBranded && !imageError ? 'Customer Logo' : 'Great Southern Fuels Logo');

  const logoSrc = getLogoSrc();

  return (
    <img
      src={logoSrc}
      alt={altText}
      className={cn(
        sizeClasses[size],
        'w-auto object-contain',
        isLoading && 'animate-pulse',
        className
      )}
      onError={handleError}
    />
  );
}

export default CustomerLogo;
