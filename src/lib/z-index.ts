// Z-Index Design System
// Note: dialog.tsx uses z-[1000] for overlay and z-[1001] for content
// Nested modals must be above these values
export const Z_INDEX = {
  // Base layers
  NORMAL: 0,
  DROPDOWN: 10,
  STICKY: 20,
  FIXED: 30,

  // Modal layers (aligned with dialog.tsx)
  MODAL_BACKDROP: 1000,
  MODAL_CONTENT: 1001,
  NESTED_MODAL_BACKDROP: 1002,
  NESTED_MODAL_CONTENT: 1003,
  MODAL_DROPDOWN: 1010,
  TOOLTIP: 1020,

  // Global overlays
  LOADING_OVERLAY: 1050,
  TOAST: 1100,
} as const;

export type ZIndexLevel = keyof typeof Z_INDEX;