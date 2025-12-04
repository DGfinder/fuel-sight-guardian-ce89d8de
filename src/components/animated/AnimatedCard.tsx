import React from 'react';
import { motion, MotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface AnimatedCardProps extends MotionProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  variant?: 'fade' | 'slide' | 'scale' | 'bounce';
  direction?: 'up' | 'down' | 'left' | 'right';
  hover?: boolean;
}

const variants = {
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
  },
  slide: {
    hidden: (direction: string) => ({
      opacity: 0,
      x: direction === 'left' ? -50 : direction === 'right' ? 50 : 0,
      y: direction === 'up' ? 50 : direction === 'down' ? -50 : 0,
    }),
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
    }
  },
  scale: {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1 }
  },
  bounce: {
    hidden: { opacity: 0, scale: 0.3 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: {
        type: "spring",
        damping: 20,
        stiffness: 300
      }
    }
  }
};

const hoverVariants = {
  hover: {
    scale: 1.02,
    y: -2,
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25
    }
  }
};

export function AnimatedCard({
  children,
  className,
  delay = 0,
  duration = 0.5,
  variant = 'fade',
  direction = 'up',
  hover = true,
  ...motionProps
}: AnimatedCardProps) {
  const { shouldReduceMotion } = useReducedMotion();

  // On mobile/reduced motion: use simple fade only, no hover effects
  const selectedVariant = shouldReduceMotion ? variants.fade : variants[variant];
  const effectiveHover = hover && !shouldReduceMotion;

  return (
    <motion.div
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        effectiveHover && "cursor-pointer",
        className
      )}
      custom={direction}
      initial="hidden"
      animate="visible"
      variants={selectedVariant}
      transition={{
        duration: shouldReduceMotion ? 0.2 : duration,
        delay: shouldReduceMotion ? 0 : delay,
        ease: "easeOut"
      }}
      whileHover={effectiveHover ? "hover" : undefined}
      {...(effectiveHover && hoverVariants)}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
}

// Animated Tank Card specifically for fuel tank displays
interface AnimatedTankCardProps {
  children: React.ReactNode;
  status: 'critical' | 'low' | 'normal' | 'unknown';
  className?: string;
  delay?: number;
  onClick?: () => void;
}

const statusAnimations = {
  critical: {
    boxShadow: [
      "0 0 0 0 rgba(239, 68, 68, 0.4)",
      "0 0 0 10px rgba(239, 68, 68, 0)",
      "0 0 0 0 rgba(239, 68, 68, 0)"
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut"
    }
  },
  low: {
    boxShadow: [
      "0 0 0 0 rgba(245, 158, 11, 0.3)",
      "0 0 0 8px rgba(245, 158, 11, 0)",
      "0 0 0 0 rgba(245, 158, 11, 0)"
    ],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut"
    }
  },
  normal: {},
  unknown: {}
};

export function AnimatedTankCard({
  children,
  status,
  className,
  delay = 0,
  onClick
}: AnimatedTankCardProps) {
  const { shouldReduceMotion } = useReducedMotion();

  // On mobile/reduced motion: disable pulsing animations and spring physics
  const animateProps = shouldReduceMotion
    ? { opacity: 1, y: 0, scale: 1 }
    : { opacity: 1, y: 0, scale: 1, ...statusAnimations[status] };

  const hoverProps = shouldReduceMotion
    ? undefined
    : {
        scale: 1.02,
        y: -4,
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        transition: {
          type: "spring",
          stiffness: 400,
          damping: 25
        }
      };

  return (
    <motion.div
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm cursor-pointer",
        "transition-all duration-200",
        status === 'critical' && "border-red-200 bg-red-50/50",
        status === 'low' && "border-amber-200 bg-amber-50/50",
        status === 'normal' && "border-green-200 bg-green-50/50",
        className
      )}
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.95 }}
      animate={animateProps}
      transition={{
        duration: shouldReduceMotion ? 0.15 : 0.4,
        delay: shouldReduceMotion ? 0 : delay,
        ease: "easeOut"
      }}
      whileHover={hoverProps}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}

// Staggered container for multiple cards
interface AnimatedCardGridProps {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
}

export function AnimatedCardGrid({
  children,
  className,
  stagger = 0.1
}: AnimatedCardGridProps) {
  const { shouldReduceMotion } = useReducedMotion();

  // On mobile/reduced motion: no stagger delay
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: shouldReduceMotion ? 0 : stagger
          }
        }
      }}
    >
      {children}
    </motion.div>
  );
}