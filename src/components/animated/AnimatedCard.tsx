import React from 'react';
import { motion, MotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

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
  const selectedVariant = variants[variant];
  
  return (
    <motion.div
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        hover && "cursor-pointer",
        className
      )}
      custom={direction}
      initial="hidden"
      animate="visible"
      variants={selectedVariant}
      transition={{
        duration,
        delay,
        ease: "easeOut"
      }}
      whileHover={hover ? "hover" : undefined}
      {...(hover && hoverVariants)}
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
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ 
        opacity: 1, 
        y: 0, 
        scale: 1,
        ...statusAnimations[status]
      }}
      transition={{
        duration: 0.4,
        delay,
        ease: "easeOut"
      }}
      whileHover={{
        scale: 1.02,
        y: -4,
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        transition: {
          type: "spring",
          stiffness: 400,
          damping: 25
        }
      }}
      whileTap={{ scale: 0.98 }}
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
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: stagger
          }
        }
      }}
    >
      {children}
    </motion.div>
  );
}