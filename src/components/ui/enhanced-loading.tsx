import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Enhanced spinner with different variants
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'dots' | 'pulse' | 'bars' | 'fuel';
  className?: string;
  color?: 'primary' | 'secondary' | 'muted';
}

export function Spinner({ 
  size = 'md', 
  variant = 'default', 
  className,
  color = 'primary'
}: SpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };

  const colorClasses = {
    primary: 'border-primary',
    secondary: 'border-secondary',
    muted: 'border-muted-foreground'
  };

  if (variant === 'default') {
    return (
      <motion.div
        className={cn(
          sizeClasses[size],
          `border-2 ${colorClasses[color]} border-t-transparent rounded-full`,
          className
        )}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "linear"
        }}
      />
    );
  }

  if (variant === 'dots') {
    return (
      <div className={cn('flex space-x-1', className)}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className={cn(
              size === 'sm' ? 'w-1 h-1' : 
              size === 'md' ? 'w-2 h-2' :
              size === 'lg' ? 'w-3 h-3' : 'w-4 h-4',
              `bg-${color} rounded-full`
            )}
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2
            }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <motion.div
        className={cn(
          sizeClasses[size],
          `bg-${color} rounded-full`,
          className
        )}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 1, 0.5]
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity
        }}
      />
    );
  }

  if (variant === 'bars') {
    return (
      <div className={cn('flex space-x-1', className)}>
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className={cn(
              size === 'sm' ? 'w-1 h-4' : 
              size === 'md' ? 'w-1 h-6' :
              size === 'lg' ? 'w-2 h-8' : 'w-2 h-10',
              `bg-${color} rounded-sm`
            )}
            animate={{
              scaleY: [1, 2, 1]
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.1
            }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'fuel') {
    return (
      <div className={cn('relative', sizeClasses[size], className)}>
        <motion.div
          className="absolute inset-0 border-2 border-gray-200 rounded-full"
        />
        <motion.div
          className={`absolute inset-0 border-2 ${colorClasses[color]} border-t-transparent rounded-full`}
          animate={{ rotate: 360 }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="w-1 h-1 bg-primary rounded-full"
            animate={{
              scale: [0, 1, 0]
            }}
            transition={{
              duration: 1,
              repeat: Infinity
            }}
          />
        </div>
      </div>
    );
  }

  return null;
}

// Enhanced skeleton loader
interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'tank-card' | 'table-row';
  lines?: number;
  animated?: boolean;
}

export function Skeleton({ 
  className,
  variant = 'rectangular',
  lines = 1,
  animated = true
}: SkeletonProps) {
  const baseClasses = 'bg-muted rounded animate-pulse';

  if (variant === 'text') {
    return (
      <div className={className}>
        {Array.from({ length: lines }).map((_, i) => (
          <motion.div
            key={i}
            className={cn(baseClasses, 'h-4 mb-2 last:mb-0')}
            style={{ width: `${Math.random() * 40 + 60}%` }}
            animate={animated ? {
              opacity: [0.5, 1, 0.5],
            } : undefined}
            transition={animated ? {
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.1
            } : undefined}
          />
        ))}
      </div>
    );
  }

  if (variant === 'circular') {
    return (
      <motion.div
        className={cn(baseClasses, 'rounded-full', className)}
        animate={animated ? {
          opacity: [0.5, 1, 0.5],
        } : undefined}
        transition={animated ? {
          duration: 1.5,
          repeat: Infinity
        } : undefined}
      />
    );
  }

  if (variant === 'tank-card') {
    return (
      <div className={cn('p-4 border rounded-lg space-y-3', className)}>
        <div className="flex items-center space-x-3">
          <Skeleton variant="circular" className="w-12 h-12" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" lines={1} className="w-3/4" />
            <Skeleton variant="text" lines={1} className="w-1/2" />
          </div>
        </div>
        <Skeleton variant="rectangular" className="h-20" />
        <div className="flex space-x-2">
          <Skeleton variant="rectangular" className="h-8 flex-1" />
          <Skeleton variant="rectangular" className="h-8 w-20" />
        </div>
      </div>
    );
  }

  if (variant === 'table-row') {
    return (
      <div className={cn('flex space-x-4 py-3', className)}>
        <Skeleton variant="rectangular" className="h-4 w-8" />
        <Skeleton variant="rectangular" className="h-4 flex-1" />
        <Skeleton variant="rectangular" className="h-4 w-16" />
        <Skeleton variant="rectangular" className="h-4 w-20" />
        <Skeleton variant="rectangular" className="h-4 w-12" />
      </div>
    );
  }

  return (
    <motion.div
      className={cn(baseClasses, className)}
      animate={animated ? {
        opacity: [0.5, 1, 0.5],
      } : undefined}
      transition={animated ? {
        duration: 1.5,
        repeat: Infinity
      } : undefined}
    />
  );
}

// Loading overlay component
interface LoadingOverlayProps {
  loading: boolean;
  children: React.ReactNode;
  spinner?: React.ComponentProps<typeof Spinner>;
  message?: string;
  className?: string;
}

export function LoadingOverlay({
  loading,
  children,
  spinner = { variant: 'fuel', size: 'lg' },
  message,
  className
}: LoadingOverlayProps) {
  return (
    <div className={cn('relative', className)}>
      {children}
      {loading && (
        <motion.div
          className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="flex flex-col items-center space-y-4">
            <Spinner {...spinner} />
            {message && (
              <motion.p
                className="text-sm text-muted-foreground"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                {message}
              </motion.p>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Progressive loading component for images
interface ProgressiveImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
  blurDataURL?: string;
}

export function ProgressiveImage({
  src,
  alt,
  className,
  placeholder,
  blurDataURL
}: ProgressiveImageProps) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Spinner size="md" variant="pulse" />
        </div>
      )}
      
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground">
          <div className="text-center">
            <div className="text-2xl mb-2">⚠️</div>
            <div className="text-sm">Failed to load image</div>
          </div>
        </div>
      ) : (
        <motion.img
          src={src}
          alt={alt}
          className={cn('w-full h-full object-cover', className)}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: loading ? 0 : 1 }}
          transition={{ duration: 0.3 }}
        />
      )}
    </div>
  );
}

// Smart loading states for different content types
interface SmartLoadingProps {
  type: 'tank-grid' | 'table' | 'chart' | 'map' | 'form';
  loading: boolean;
  children: React.ReactNode;
  count?: number;
  className?: string;
}

export function SmartLoading({
  type,
  loading,
  children,
  count = 6,
  className
}: SmartLoadingProps) {
  if (!loading) {
    return <>{children}</>;
  }

  if (type === 'tank-grid') {
    return (
      <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} variant="tank-card" />
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className={cn('space-y-2', className)}>
        <Skeleton variant="rectangular" className="h-12 w-full" />
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} variant="table-row" />
        ))}
      </div>
    );
  }

  if (type === 'chart') {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex justify-between items-center">
          <Skeleton variant="text" lines={1} className="w-48" />
          <Skeleton variant="rectangular" className="h-8 w-24" />
        </div>
        <Skeleton variant="rectangular" className="h-64 w-full" />
      </div>
    );
  }

  if (type === 'map') {
    return (
      <div className={cn('relative bg-muted rounded-lg overflow-hidden', className)}>
        <Skeleton variant="rectangular" className="h-64 w-full" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Spinner size="lg" variant="fuel" />
            <p className="mt-2 text-sm text-muted-foreground">Loading map data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'form') {
    return (
      <div className={cn('space-y-4', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton variant="text" lines={1} className="w-24" />
            <Skeleton variant="rectangular" className="h-10 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return <>{children}</>;
}