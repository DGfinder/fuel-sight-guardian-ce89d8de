import React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'subtle';
  gradient?: 'primary' | 'secondary' | 'accent' | 'none';
  hover?: boolean;
  onClick?: () => void;
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      children,
      className,
      variant = 'default',
      gradient = 'none',
      hover = false,
      onClick,
    },
    ref
  ) => {
    const variants = {
      default:
        'backdrop-blur-xl bg-white/30 dark:bg-gray-900/30 border border-white/20 dark:border-gray-700/30',
      elevated:
        'backdrop-blur-2xl bg-white/40 dark:bg-gray-900/40 border border-white/30 dark:border-gray-700/40 shadow-2xl shadow-black/10',
      subtle:
        'backdrop-blur-md bg-white/20 dark:bg-gray-900/20 border border-white/10 dark:border-gray-700/20',
    };

    const gradients = {
      primary: 'bg-gradient-primary',
      secondary: 'bg-gradient-secondary',
      accent: 'bg-gradient-accent',
      none: '',
    };

    const hoverStyles = hover
      ? 'transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/20 hover:border-white/30 dark:hover:border-gray-600/40 cursor-pointer'
      : '';

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl p-6 relative overflow-hidden',
          variants[variant],
          hoverStyles,
          className
        )}
        onClick={onClick}
      >
        {/* Gradient Overlay */}
        {gradient !== 'none' && (
          <div
            className={cn(
              'absolute inset-0 opacity-10 dark:opacity-20',
              gradients[gradient]
            )}
          />
        )}

        {/* Glass Gradient Border Effect */}
        <div className="absolute inset-0 rounded-2xl bg-glass-gradient dark:bg-glass-gradient-dark pointer-events-none" />

        {/* Content */}
        <div className="relative z-10">{children}</div>
      </div>
    );
  }
);

GlassCard.displayName = 'GlassCard';

export { GlassCard };
export type { GlassCardProps };
