/**
 * StatusPulse Component
 * Animated pulsing indicator for critical and low fuel status
 * Provides visual feedback for urgent monitoring dashboard alerts
 */

import * as React from 'react';
import { motion } from 'framer-motion';
import { glowRingVariants } from '@/lib/motion-variants';
import { cn } from '@/lib/utils';

export type FuelStatus = 'critical' | 'low' | 'normal' | 'full';

interface StatusPulseProps {
  status: FuelStatus;
  children: React.ReactNode;
  className?: string;
  /**
   * Whether to show the pulsing glow ring animation
   * @default true for critical/low, false for normal/full
   */
  showGlow?: boolean;
  /**
   * Whether to add a colored ring border
   * @default true for critical/low
   */
  showRing?: boolean;
}

/**
 * Wraps children with animated status indicators based on fuel level
 *
 * Features:
 * - Pulsing glow ring for critical (red) and low (amber) states
 * - Static colored ring border for emphasis
 * - Smooth spring animations
 * - Accessibility: Uses both motion and color for status indication
 *
 * @example
 * ```tsx
 * <StatusPulse status="critical">
 *   <TankCard tank={tank} />
 * </StatusPulse>
 * ```
 */
export function StatusPulse({
  status,
  children,
  className,
  showGlow,
  showRing,
}: StatusPulseProps) {
  // Determine if we should show animations
  const isUrgent = status === 'critical' || status === 'low';
  const shouldShowGlow = showGlow !== undefined ? showGlow : isUrgent;
  const shouldShowRing = showRing !== undefined ? showRing : isUrgent;

  // Ring styles based on status
  const ringStyles = {
    critical: 'ring-2 ring-red-400 dark:ring-red-500',
    low: 'ring-1 ring-amber-400 dark:ring-amber-500',
    normal: '',
    full: '',
  };

  // If normal/full status and no forced glow, just render children
  if (!shouldShowGlow && !shouldShowRing) {
    return <>{children}</>;
  }

  return (
    <motion.div
      className={cn(
        'relative rounded-lg overflow-hidden',
        shouldShowRing && ringStyles[status],
        className
      )}
      animate={shouldShowGlow && isUrgent ? glowRingVariants[status] : {}}
    >
      {children}
    </motion.div>
  );
}

/**
 * Status badge with pulse animation
 * Displays a small pulsing dot for status indication
 */
interface StatusBadgeProps {
  status: FuelStatus;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, className, size = 'md' }: StatusBadgeProps) {
  const isUrgent = status === 'critical' || status === 'low';

  const sizeStyles = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const colorStyles = {
    critical: 'bg-red-500',
    low: 'bg-amber-500',
    normal: 'bg-green-500',
    full: 'bg-blue-500',
  };

  return (
    <motion.div
      className={cn('relative inline-flex', className)}
      aria-label={`Status: ${status}`}
    >
      <motion.span
        className={cn(
          'rounded-full',
          sizeStyles[size],
          colorStyles[status]
        )}
        animate={
          isUrgent
            ? {
                scale: [1, 1.2, 1],
                opacity: [1, 0.8, 1],
              }
            : {}
        }
        transition={
          isUrgent
            ? {
                duration: status === 'critical' ? 1.5 : 2.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }
            : {}
        }
      />
      {isUrgent && (
        <motion.span
          className={cn(
            'absolute inset-0 rounded-full',
            colorStyles[status],
            'opacity-75'
          )}
          animate={{
            scale: [1, 1.8, 1],
            opacity: [0.75, 0, 0.75],
          }}
          transition={{
            duration: status === 'critical' ? 1.5 : 2.5,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      )}
    </motion.div>
  );
}
