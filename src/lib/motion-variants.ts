/**
 * Premium Motion Variants System
 * Spring-based animations for React 19 + Framer Motion 11.13
 * Provides consistent interaction patterns across the application
 */

import { Variants } from 'framer-motion';

/**
 * Spring configuration presets
 */
export const springs = {
  // Responsive spring for UI elements
  responsive: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 25,
  },
  // Bouncy spring for playful interactions
  bouncy: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 20,
  },
  // Gentle spring for subtle movements
  gentle: {
    type: 'spring' as const,
    stiffness: 200,
    damping: 30,
  },
} as const;

/**
 * Card hover variants - Premium lift and scale effect
 */
export const cardHoverVariants: Variants = {
  rest: {
    scale: 1,
    y: 0,
    transition: springs.responsive,
  },
  hover: {
    scale: 1.02,
    y: -4,
    transition: springs.responsive,
  },
};

/**
 * Button interaction variants - Tactile press feedback
 */
export const buttonVariants: Variants = {
  rest: {
    scale: 1,
  },
  hover: {
    scale: 1.02,
    transition: springs.responsive,
  },
  tap: {
    scale: 0.98,
    transition: springs.responsive,
  },
};

/**
 * Icon hover variants - Playful rotation
 */
export const iconHoverVariants: Variants = {
  rest: {
    rotate: 0,
  },
  hover: {
    rotate: 5,
    transition: springs.bouncy,
  },
};

/**
 * Stagger children animation - For lists and grids
 */
export const staggerContainerVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

/**
 * Fade up item animation - For stagger children
 */
export const fadeUpItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
};

/**
 * Fade in item animation - For stagger children (no vertical movement)
 */
export const fadeInItemVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
};

/**
 * Slide in from side - For sidebar/panel animations
 */
export const slideInVariants: Variants = {
  hidden: {
    x: -20,
    opacity: 0,
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: springs.responsive,
  },
};

/**
 * Scale pop animation - For modals and alerts
 */
export const scalePopVariants: Variants = {
  hidden: {
    scale: 0.9,
    opacity: 0,
  },
  visible: {
    scale: 1,
    opacity: 1,
    transition: springs.bouncy,
  },
};

/**
 * Pulse animation - For status indicators
 */
export const pulseVariants = {
  critical: {
    scale: [1, 1.05, 1],
    opacity: [1, 0.8, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
  low: {
    scale: [1, 1.02, 1],
    opacity: [1, 0.9, 1],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
} as const;

/**
 * Glow ring animation - For critical status
 */
export const glowRingVariants = {
  critical: {
    boxShadow: [
      '0 0 0 0 rgba(239, 68, 68, 0.7)',
      '0 0 0 10px rgba(239, 68, 68, 0)',
      '0 0 0 0 rgba(239, 68, 68, 0)',
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeOut',
    },
  },
  low: {
    boxShadow: [
      '0 0 0 0 rgba(245, 158, 11, 0.5)',
      '0 0 0 8px rgba(245, 158, 11, 0)',
      '0 0 0 0 rgba(245, 158, 11, 0)',
    ],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: 'easeOut',
    },
  },
} as const;

/**
 * Shimmer loading animation - For skeletons
 */
export const shimmerVariants: Variants = {
  animate: {
    opacity: [0.5, 0.8, 0.5],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

/**
 * Page transition variants - For route changes
 */
export const pageTransitionVariants: Variants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.2,
      ease: 'easeIn',
    },
  },
};
