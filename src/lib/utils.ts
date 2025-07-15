import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Debug logging utility - only logs in development
const DEBUG_ENABLED = import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true';

export const debugLog = {
  log: (...args: unknown[]) => {
    if (DEBUG_ENABLED) {
      console.log(...args);
    }
  },
  error: (...args: unknown[]) => {
    if (DEBUG_ENABLED) {
      console.error(...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (DEBUG_ENABLED) {
      console.warn(...args);
    }
  },
  info: (...args: unknown[]) => {
    if (DEBUG_ENABLED) {
      console.info(...args);
    }
  }
};
