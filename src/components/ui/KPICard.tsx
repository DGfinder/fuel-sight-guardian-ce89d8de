import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fadeUpItemVariants, springs, glowRingVariants } from '@/lib/motion-variants';

export interface KPICardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
  alert?: boolean;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  isLoading?: boolean;
  className?: string;
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
    glow: 'shadow-blue-500/30',
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-600 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
    glow: 'shadow-green-500/30',
  },
  yellow: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    text: 'text-yellow-600 dark:text-yellow-400',
    border: 'border-yellow-200 dark:border-yellow-800',
    glow: 'shadow-yellow-500/30',
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
    glow: 'shadow-red-500/30',
  },
  gray: {
    bg: 'bg-gray-50 dark:bg-gray-900/20',
    text: 'text-gray-600 dark:text-gray-400',
    border: 'border-gray-200 dark:border-gray-800',
    glow: 'shadow-gray-500/30',
  },
};

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  alert = false,
  trend = 'neutral',
  trendValue,
  isLoading = false,
  className,
}: KPICardProps) {
  const colors = colorClasses[color];

  const getTrendIcon = () => {
    if (!trend || trend === 'neutral') return null;
    if (trend === 'up') return <TrendingUp className="h-3 w-3" />;
    return <TrendingDown className="h-3 w-3" />;
  };

  if (isLoading) {
    return (
      <motion.div
        variants={fadeUpItemVariants}
        className={className}
      >
        <Card className="relative overflow-hidden border-2 transition-all duration-300">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-3">
                <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-10 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
              <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={fadeUpItemVariants}
      whileHover={{ scale: 1.02, y: -2 }}
      transition={springs.responsive}
      className={className}
    >
      <Card
        className={cn(
          'relative overflow-hidden border-2 transition-all duration-300',
          alert && `ring-2 ring-offset-2 ${colors.border} ${colors.glow} shadow-lg`,
          !alert && 'hover:shadow-md'
        )}
      >
        {/* Background gradient */}
        <div className={cn('absolute inset-0 opacity-5', colors.bg)} />

        <CardContent className="pt-5 pb-4 px-5 relative">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                {title}
              </p>
              <div className="flex items-baseline gap-2">
                <motion.p
                  className="text-4xl font-bold tabular-nums"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2, ...springs.bouncy }}
                >
                  {value}
                </motion.p>
                {subtitle && (
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {subtitle}
                  </span>
                )}
              </div>
              {/* Trend indicator */}
              {trendValue && (
                <div
                  className={cn(
                    'flex items-center gap-1 mt-2 text-xs font-medium',
                    trend === 'up' && 'text-green-600 dark:text-green-400',
                    trend === 'down' && 'text-red-600 dark:text-red-400',
                    trend === 'neutral' && 'text-gray-500'
                  )}
                >
                  {getTrendIcon()}
                  <span>{trendValue}</span>
                </div>
              )}
            </div>

            {/* Icon */}
            <motion.div
              className={cn('p-3 rounded-xl', colors.bg, colors.text)}
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={springs.bouncy}
            >
              <Icon className="h-6 w-6" />
            </motion.div>
          </div>

          {/* Alert pulse effect */}
          {alert && color === 'red' && (
            <motion.div
              className="absolute inset-0 rounded-lg"
              animate={glowRingVariants.critical}
            />
          )}
          {alert && color === 'yellow' && (
            <motion.div
              className="absolute inset-0 rounded-lg"
              animate={glowRingVariants.low}
            />
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
