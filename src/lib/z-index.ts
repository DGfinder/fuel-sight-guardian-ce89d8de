// Z-Index Design System
export const Z_INDEX = {
  // Base layers
  NORMAL: 0,
  DROPDOWN: 10,
  STICKY: 20,
  FIXED: 30,
  
  // Modal layers
  MODAL_BACKDROP: 40,
  MODAL_CONTENT: 50,
  NESTED_MODAL_BACKDROP: 55,
  NESTED_MODAL_CONTENT: 60,
  MODAL_DROPDOWN: 70,
  TOOLTIP: 80,
  
  // Global overlays
  LOADING_OVERLAY: 90,
  TOAST: 100,
} as const;

export type ZIndexLevel = keyof typeof Z_INDEX;