import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'slide' | 'fade' | 'scale';
}

const pageVariants = {
  slide: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  },
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.05 }
  }
};

export function PageTransition({ 
  children, 
  className, 
  variant = 'slide' 
}: PageTransitionProps) {
  const variants = pageVariants[variant];
  
  return (
    <motion.div
      className={className}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      transition={{
        duration: 0.3,
        ease: "easeInOut"
      }}
    >
      {children}
    </motion.div>
  );
}

// Enhanced loading animation
export function AnimatedLoader({ 
  size = 40, 
  color = "primary" 
}: { 
  size?: number; 
  color?: string; 
}) {
  return (
    <div className="flex items-center justify-center">
      <motion.div
        className={`w-${size/4} h-${size/4} border-4 border-${color} border-t-transparent rounded-full`}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "linear"
        }}
      />
    </div>
  );
}

// Skeleton loader with animation
export function AnimatedSkeleton({ 
  className, 
  lines = 1 
}: { 
  className?: string; 
  lines?: number; 
}) {
  return (
    <div className={className}>
      {Array.from({ length: lines }).map((_, i) => (
        <motion.div
          key={i}
          className="bg-muted rounded mb-2 last:mb-0"
          style={{ height: '1rem' }}
          animate={{
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.1
          }}
        />
      ))}
    </div>
  );
}

// Number counter animation
interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
  className?: string;
  suffix?: string;
  prefix?: string;
}

export function AnimatedNumber({
  value,
  duration = 1,
  decimals = 0,
  className,
  suffix = '',
  prefix = ''
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = React.useState(0);

  React.useEffect(() => {
    const startTime = Date.now();
    const startValue = displayValue;
    const endValue = value;
    const change = endValue - startValue;

    const animateValue = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      
      // Easing function
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValue + (change * easeOut);
      
      setDisplayValue(currentValue);
      
      if (progress < 1) {
        requestAnimationFrame(animateValue);
      }
    };

    requestAnimationFrame(animateValue);
  }, [value, duration, displayValue]);

  return (
    <span className={className}>
      {prefix}{displayValue.toFixed(decimals)}{suffix}
    </span>
  );
}

// Progress bar animation
interface AnimatedProgressProps {
  value: number;
  max?: number;
  className?: string;
  showValue?: boolean;
  variant?: 'default' | 'fuel';
}

export function AnimatedProgress({
  value,
  max = 100,
  className,
  showValue = false,
  variant = 'default'
}: AnimatedProgressProps) {
  const percentage = Math.min((value / max) * 100, 100);
  
  const getColor = () => {
    if (variant === 'fuel') {
      if (percentage <= 10) return 'bg-red-500';
      if (percentage <= 20) return 'bg-amber-500';
      return 'bg-green-500';
    }
    return 'bg-primary';
  };

  return (
    <div className={`relative ${className}`}>
      <div className="w-full bg-muted rounded-full h-2">
        <motion.div
          className={`h-2 rounded-full ${getColor()}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{
            duration: 1,
            ease: "easeOut"
          }}
        />
      </div>
      {showValue && (
        <motion.span
          className="absolute -top-6 right-0 text-xs font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <AnimatedNumber value={percentage} decimals={1} suffix="%" />
        </motion.span>
      )}
    </div>
  );
}

// Floating action button with animation
interface FloatingActionButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export function FloatingActionButton({
  children,
  onClick,
  className,
  variant = 'primary',
  position = 'bottom-right'
}: FloatingActionButtonProps) {
  const positionClasses = {
    'bottom-right': 'fixed bottom-6 right-6',
    'bottom-left': 'fixed bottom-6 left-6',
    'top-right': 'fixed top-6 right-6',
    'top-left': 'fixed top-6 left-6',
  };

  const variantClasses = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/90',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  };

  return (
    <motion.button
      className={`
        ${positionClasses[position]}
        ${variantClasses[variant]}
        w-14 h-14 rounded-full shadow-lg z-50
        flex items-center justify-center
        transition-colors duration-200
        ${className}
      `}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      whileHover={{ 
        scale: 1.1,
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)"
      }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 25
      }}
    >
      {children}
    </motion.button>
  );
}