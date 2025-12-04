/**
 * Color conversion utilities for customer branding
 * Converts various color formats to CSS custom property compatible formats
 */

/**
 * Convert hex color to RGB format for CSS custom properties
 * @param hex - Hex color string (e.g., "#01a1dd" or "01a1dd")
 * @returns RGB string in format "r g b" (e.g., "1 161 221")
 */
export function hexToRgb(hex: string): string {
  // Remove # if present
  const cleanHex = hex.replace('#', '');

  // Parse hex values
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  // Return space-separated format for CSS custom properties
  return `${r} ${g} ${b}`;
}

/**
 * Convert hex color to HSL format
 * @param hex - Hex color string (e.g., "#01a1dd")
 * @returns HSL object with h, s, l values
 */
export function hexToHSL(hex: string): { h: number; s: number; l: number } {
  // Remove # if present
  const cleanHex = hex.replace('#', '');

  // Parse hex values
  let r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  let g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  let b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Convert HSL to hex color
 * @param h - Hue (0-360)
 * @param s - Saturation (0-100)
 * @param l - Lightness (0-100)
 * @returns Hex color string (e.g., "#01a1dd")
 */
export function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  const rHex = Math.round((r + m) * 255).toString(16).padStart(2, '0');
  const gHex = Math.round((g + m) * 255).toString(16).padStart(2, '0');
  const bHex = Math.round((b + m) * 255).toString(16).padStart(2, '0');

  return `#${rHex}${gHex}${bHex}`;
}

/**
 * Lighten a hex color by a percentage (for dark mode)
 * @param hex - Hex color string
 * @param amount - Amount to lighten (0-100), default 15
 * @returns Lightened hex color
 */
export function lightenColor(hex: string, amount: number = 15): string {
  const hsl = hexToHSL(hex);
  const newLightness = Math.min(100, hsl.l + amount);
  return hslToHex(hsl.h, hsl.s, newLightness);
}

/**
 * Darken a hex color by a percentage
 * @param hex - Hex color string
 * @param amount - Amount to darken (0-100), default 15
 * @returns Darkened hex color
 */
export function darkenColor(hex: string, amount: number = 15): string {
  const hsl = hexToHSL(hex);
  const newLightness = Math.max(0, hsl.l - amount);
  return hslToHex(hsl.h, hsl.s, newLightness);
}

/**
 * Convert rgba string to RGB format for CSS custom properties
 * @param rgba - RGBA string (e.g., "rgba(50, 63, 72, 0.9)")
 * @returns RGB string in format "r g b" (e.g., "50 63 72")
 */
export function rgbaToRgb(rgba: string): string {
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) {
    console.warn('Invalid RGBA format:', rgba);
    return '0 0 0';
  }
  return `${match[1]} ${match[2]} ${match[3]}`;
}

/**
 * Parse any color format (hex, rgb, rgba) to RGB format
 * @param color - Color string in any format
 * @returns RGB string in format "r g b"
 */
export function parseColorToRgb(color: string): string {
  const trimmed = color.trim();

  // Hex format
  if (trimmed.startsWith('#')) {
    return hexToRgb(trimmed);
  }

  // RGB/RGBA format
  if (trimmed.startsWith('rgb')) {
    return rgbaToRgb(trimmed);
  }

  // If it's just hex without #
  if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return hexToRgb(trimmed);
  }

  console.warn('Unsupported color format:', color);
  return '0 0 0';
}

/**
 * Check if a color is "light" (for determining text color contrast)
 * @param hex - Hex color string
 * @returns true if the color is light, false if dark
 */
export function isLightColor(hex: string): boolean {
  const hsl = hexToHSL(hex);
  return hsl.l > 50;
}
