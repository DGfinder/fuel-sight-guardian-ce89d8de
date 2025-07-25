/**
 * Fuel Sight Guardian Design System
 * Comprehensive design tokens for consistent UI/UX
 */

// Brand Colors - Great Southern Fuel brand identity
export const brandColors = {
  primary: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#008457', // GSF Green - Primary brand color
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
    950: '#052e16'
  },
  secondary: {
    50: '#fefce8',
    100: '#fef9c3',
    200: '#fef08a',
    300: '#fde047',
    400: '#facc15',
    500: '#eab308',
    600: '#FEDF19', // GSF Gold - Secondary brand color
    700: '#a16207',
    800: '#854d0e',
    900: '#713f12',
    950: '#422006'
  }
} as const;

// Fuel Industry Semantic Colors - Critical for operational safety
export const fuelStatusColors = {
  // Tank fuel levels
  critical: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444', // Main critical color (≤10%)
    600: '#dc2626', // Main critical color (≤20%)
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
    950: '#450a0a'
  },
  low: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b', // Main low fuel color (21-40%)
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
    950: '#451a03'
  },
  normal: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a', // Main normal color (>40%)
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
    950: '#052e16'
  },
  unknown: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b', // No data available
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617'
  }
} as const;

// Alert and Status Colors
export const alertColors = {
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d'
  },
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f'
  },
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d'
  },
  info: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a'
  }
} as const;

// Neutral Colors - For text, backgrounds, and borders
export const neutralColors = {
  white: '#ffffff',
  black: '#000000',
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    950: '#030712'
  }
} as const;

// Typography Scale - Fuel industry context
export const typography = {
  // Font families
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'monospace'],
    display: ['Inter', 'system-ui', 'sans-serif']
  },
  
  // Font sizes with fuel industry context
  fontSize: {
    // Data display sizes
    'reading-sm': ['0.75rem', { lineHeight: '1rem' }],      // Small sensor readings
    'reading': ['0.875rem', { lineHeight: '1.25rem' }],     // Standard readings
    'reading-lg': ['1rem', { lineHeight: '1.5rem' }],       // Large readings
    'reading-xl': ['1.125rem', { lineHeight: '1.75rem' }],  // Emphasized readings
    
    // Tank and location labels
    'label-xs': ['0.75rem', { lineHeight: '1rem' }],        // Small labels
    'label-sm': ['0.875rem', { lineHeight: '1.25rem' }],    // Standard labels
    'label': ['1rem', { lineHeight: '1.5rem' }],            // Tank names
    'label-lg': ['1.125rem', { lineHeight: '1.75rem' }],    // Location names
    
    // Headings for sections
    'heading-xs': ['0.875rem', { lineHeight: '1.25rem' }],  // Card titles
    'heading-sm': ['1rem', { lineHeight: '1.5rem' }],       // Section titles
    'heading': ['1.125rem', { lineHeight: '1.75rem' }],     // Page sections
    'heading-lg': ['1.25rem', { lineHeight: '1.75rem' }],   // Page titles
    'heading-xl': ['1.5rem', { lineHeight: '2rem' }],       // Main headings
    'heading-2xl': ['1.875rem', { lineHeight: '2.25rem' }], // Dashboard title
    
    // Alert and status text
    'alert-sm': ['0.75rem', { lineHeight: '1rem' }],        // Small alerts
    'alert': ['0.875rem', { lineHeight: '1.25rem' }],       // Standard alerts
    'alert-lg': ['1rem', { lineHeight: '1.5rem' }],         // Important alerts
  },
  
  // Font weights
  fontWeight: {
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800'
  }
} as const;

// Spacing Scale - Systematic spacing for layouts
export const spacing = {
  // Base spacing units
  px: '1px',
  0: '0',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  1.5: '0.375rem',  // 6px
  2: '0.5rem',      // 8px
  2.5: '0.625rem',  // 10px
  3: '0.75rem',     // 12px
  3.5: '0.875rem',  // 14px
  4: '1rem',        // 16px - Base unit
  5: '1.25rem',     // 20px
  6: '1.5rem',      // 24px
  7: '1.75rem',     // 28px
  8: '2rem',        // 32px
  9: '2.25rem',     // 36px
  10: '2.5rem',     // 40px
  11: '2.75rem',    // 44px
  12: '3rem',       // 48px
  14: '3.5rem',     // 56px
  16: '4rem',       // 64px
  20: '5rem',       // 80px
  24: '6rem',       // 96px
  28: '7rem',       // 112px
  32: '8rem',       // 128px
  36: '9rem',       // 144px
  40: '10rem',      // 160px
  44: '11rem',      // 176px
  48: '12rem',      // 192px
  52: '13rem',      // 208px
  56: '14rem',      // 224px
  60: '15rem',      // 240px
  64: '16rem',      // 256px
  72: '18rem',      // 288px
  80: '20rem',      // 320px
  96: '24rem',      // 384px
} as const;

// Border Radius - Consistent rounded corners
export const borderRadius = {
  none: '0',
  sm: '0.125rem',    // 2px
  DEFAULT: '0.25rem', // 4px
  md: '0.375rem',    // 6px
  lg: '0.5rem',      // 8px
  xl: '0.75rem',     // 12px
  '2xl': '1rem',     // 16px
  '3xl': '1.5rem',   // 24px
  full: '9999px'
} as const;

// Shadows - Depth and elevation
export const boxShadow = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  none: 'none'
} as const;

// Z-Index Scale - Layering system
export const zIndex = {
  auto: 'auto',
  0: '0',
  10: '10',
  20: '20',
  30: '30',
  40: '40',
  50: '50',
  // Application specific layers
  dropdown: '1000',
  sticky: '1020',
  fixed: '1030',
  modalBackdrop: '1040',
  modal: '1050',
  popover: '1060',
  tooltip: '1070',
  toast: '1080'
} as const;

// Semantic color mappings for fuel industry
export const semanticColors = {
  // Brand colors
  primary: brandColors.primary[600],                 // GSF Green
  primaryDark: brandColors.primary[700],             // Darker GSF Green
  secondary: brandColors.secondary[600],             // GSF Gold
  secondaryDark: brandColors.secondary[700],         // Darker GSF Gold
  
  // Tank status mapping - Updated for better scheduler decision making
  tankCritical: fuelStatusColors.critical[600],      // ≤1.5 days OR ≤10% fuel (immediate action)
  tankLow: fuelStatusColors.low[500],                // ≤2.5 days OR ≤20% fuel (schedule soon)
  tankNormal: fuelStatusColors.normal[600],          // >2.5 days AND >20% fuel (no immediate concern)
  tankUnknown: fuelStatusColors.unknown[500],        // No data
  
  // Agbot device status mapping (percentage-based)
  agbotCritical: '#dc2626',                          // ≤20% fuel (urgent)
  agbotLow: '#f59e0b',                              // 21-50% fuel (low)
  agbotNormal: '#16a34a',                           // >50% fuel (good)
  agbotOffline: '#64748b',                          // Device offline/no data
  agbotOnline: '#22c55e',                           // Device online indicator
  
  // Alert severity mapping
  alertCritical: alertColors.error[600],             // Critical alerts
  alertWarning: alertColors.warning[500],            // Warning alerts
  alertInfo: alertColors.info[500],                  // Info alerts
  alertSuccess: alertColors.success[600],            // Success alerts
  
  // Text colors
  textPrimary: neutralColors.gray[900],              // Main text
  textSecondary: neutralColors.gray[600],            // Secondary text
  textMuted: neutralColors.gray[500],                // Muted text
  textDisabled: neutralColors.gray[400],             // Disabled text
  textInverse: neutralColors.white,                  // Text on dark backgrounds
  
  // Background colors
  backgroundPrimary: neutralColors.white,            // Main background
  backgroundSecondary: neutralColors.gray[50],       // Secondary background
  backgroundMuted: neutralColors.gray[100],          // Muted background
  
  // Border colors
  borderDefault: neutralColors.gray[200],            // Default borders
  borderMuted: neutralColors.gray[100],              // Subtle borders
  borderStrong: neutralColors.gray[300],             // Strong borders
} as const;

// Export all design tokens
export const designTokens = {
  colors: {
    brand: brandColors,
    fuelStatus: fuelStatusColors,
    alert: alertColors,
    neutral: neutralColors,
    semantic: semanticColors
  },
  typography,
  spacing,
  borderRadius,
  boxShadow,
  zIndex
} as const;

export default designTokens;