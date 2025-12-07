import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion-variants';

export type StatusType = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'active';
export type StatusSize = 'sm' | 'md' | 'lg';
export type StatusVariant = 'default' | 'outline' | 'subtle';

export interface StatusBadgeProps {
  status: StatusType;
  label: string;
  icon?: React.ElementType;
  size?: StatusSize;
  variant?: StatusVariant;
  pulse?: boolean;
  animate?: boolean;
  className?: string;
}

const statusColors = {
  success: {
    default: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
    outline: 'border-2 border-green-500 text-green-700 dark:text-green-400',
    subtle: 'bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400',
    pulse: 'shadow-green-500/50',
  },
  warning: {
    default: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400',
    outline: 'border-2 border-yellow-500 text-yellow-700 dark:text-yellow-400',
    subtle: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-950/20 dark:text-yellow-400',
    pulse: 'shadow-yellow-500/50',
  },
  error: {
    default: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
    outline: 'border-2 border-red-500 text-red-700 dark:text-red-400',
    subtle: 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400',
    pulse: 'shadow-red-500/50',
  },
  info: {
    default: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
    outline: 'border-2 border-blue-500 text-blue-700 dark:text-blue-400',
    subtle: 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400',
    pulse: 'shadow-blue-500/50',
  },
  neutral: {
    default: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    outline: 'border-2 border-gray-400 text-gray-700 dark:text-gray-300',
    subtle: 'bg-gray-50 text-gray-600 dark:bg-gray-900/20 dark:text-gray-400',
    pulse: 'shadow-gray-500/50',
  },
  active: {
    default: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    outline: 'border-2 border-emerald-500 text-emerald-700 dark:text-emerald-400',
    subtle: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400',
    pulse: 'shadow-emerald-500/50',
  },
};

const sizeClasses = {
  sm: {
    badge: 'px-2 py-0.5 text-xs',
    icon: 'h-3 w-3',
  },
  md: {
    badge: 'px-2.5 py-1 text-sm',
    icon: 'h-3.5 w-3.5',
  },
  lg: {
    badge: 'px-3 py-1.5 text-base',
    icon: 'h-4 w-4',
  },
};

export function StatusBadge({
  status,
  label,
  icon: Icon,
  size = 'md',
  variant = 'default',
  pulse = false,
  animate = true,
  className,
}: StatusBadgeProps) {
  const colors = statusColors[status];
  const sizes = sizeClasses[size];

  const badgeClasses = cn(
    'inline-flex items-center gap-1.5 rounded-full font-medium transition-all duration-300',
    colors[variant],
    sizes.badge,
    pulse && 'shadow-lg',
    className
  );

  const badgeContent = (
    <>
      {Icon && <Icon className={cn(sizes.icon, pulse && 'animate-pulse')} />}
      <span>{label}</span>
      {pulse && (
        <motion.div
          className={cn('absolute inset-0 rounded-full', colors.pulse)}
          animate={{
            opacity: [0.5, 0.8, 0.5],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
    </>
  );

  if (!animate) {
    return (
      <span className={cn('relative', badgeClasses)}>
        {badgeContent}
      </span>
    );
  }

  return (
    <motion.span
      className={cn('relative', badgeClasses)}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      whileHover={{ scale: 1.05 }}
      transition={springs.responsive}
    >
      {badgeContent}
    </motion.span>
  );
}

// Helper function for common status mappings
export function getStatusFromValue(value: string): StatusType {
  const lowerValue = value.toLowerCase();

  // Success states
  if (['online', 'active', 'delivered', 'completed', 'success', 'healthy', 'good'].includes(lowerValue)) {
    return 'success';
  }

  // Warning states
  if (['warning', 'low', 'pending', 'scheduled', 'moderate'].includes(lowerValue)) {
    return 'warning';
  }

  // Error states
  if (['offline', 'error', 'failed', 'critical', 'cancelled', 'urgent'].includes(lowerValue)) {
    return 'error';
  }

  // Info states
  if (['info', 'processing', 'in-progress', 'syncing'].includes(lowerValue)) {
    return 'info';
  }

  return 'neutral';
}
