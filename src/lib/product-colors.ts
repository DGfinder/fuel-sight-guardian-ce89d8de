/**
 * Product Color Utility
 * Provides color styling for fuel product type badges
 *
 * Color Scheme: Subtle but Visible (Option 2)
 * - ADF/Diesel: Emerald Green (both are diesel fuels)
 * - ULP: Blue (standard unleaded petrol)
 * - ULP98: Purple (premium unleaded)
 */

export type ProductType = 'Diesel' | 'ULP' | 'ULP98' | 'ADF' | string;

interface ProductBadgeStyle {
  bgColor: string;
  borderColor: string;
  textColor: string;
}

/**
 * Product badge color definitions
 * Using -100 backgrounds for subtle but visible appearance (~15-25% opacity)
 */
export const productBadgeStyles: Record<string, ProductBadgeStyle> = {
  'ADF': {
    bgColor: 'bg-emerald-100',
    borderColor: 'border-emerald-300',
    textColor: 'text-emerald-800',
  },
  'Diesel': {
    bgColor: 'bg-emerald-100',
    borderColor: 'border-emerald-300',
    textColor: 'text-emerald-800',
  },
  'ULP': {
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300',
    textColor: 'text-blue-800',
  },
  'ULP98': {
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-300',
    textColor: 'text-purple-800',
  },
};

/**
 * Get Tailwind class string for product badge styling
 *
 * @param productType - The fuel product type (ADF, Diesel, ULP, ULP98)
 * @returns Tailwind class string for badge styling
 *
 * @example
 * const classes = getProductBadgeClasses('ULP');
 * // Returns: 'bg-blue-100 border-blue-300 text-blue-800 border'
 */
export function getProductBadgeClasses(productType: string): string {
  const style = productBadgeStyles[productType];

  if (!style) {
    // Default fallback for unknown product types
    return 'bg-gray-50 border-gray-200 text-gray-700 border';
  }

  return `${style.bgColor} ${style.borderColor} ${style.textColor} border`;
}

/**
 * Alternative: Very Subtle (Option 1)
 * If you prefer more faded colors (~5-10% opacity), replace -100 with -50 and -300 with -200
 *
 * ADF/Diesel:  bg-emerald-50   border-emerald-200   text-emerald-700
 * ULP:         bg-blue-50      border-blue-200      text-blue-700
 * ULP98:       bg-purple-50    border-purple-200    text-purple-700
 */

/**
 * Alternative: Medium Visibility (Option 3)
 * If you prefer more visible colors (~30-40% opacity), replace -100 with -200 and -300 with -400
 *
 * ADF/Diesel:  bg-emerald-200  border-emerald-400   text-emerald-900
 * ULP:         bg-blue-200     border-blue-400      text-blue-900
 * ULP98:       bg-purple-200   border-purple-400    text-purple-900
 */
