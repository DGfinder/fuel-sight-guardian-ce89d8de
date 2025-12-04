import React from 'react';
import { motion } from 'framer-motion';
import { getBarColor } from '@/lib/fuel-colors';

interface PercentBarProps {
  percent: number;
  className?: string;
  animated?: boolean;
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function PercentBar({
  percent,
  className = '',
  animated = true,
  showValue = false,
  size = 'md'
}: PercentBarProps) {
  const pct = Math.min(Math.max(percent, 0), 100);

  const getSizes = () => {
    switch (size) {
      case 'sm': return { height: 'h-1', text: 'text-xs' };
      case 'lg': return { height: 'h-3', text: 'text-sm' };
      default: return { height: 'h-1.5', text: 'text-xs' };
    }
  };

  const color = getBarColor(pct);
  const sizes = getSizes();

  if (animated) {
    return (
      <div className={`relative ${className}`}>
        <div className={`${sizes.height} w-full rounded-full bg-gray-200/70`}>
          <motion.div 
            className={`${sizes.height} ${color} rounded-full`}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{
              duration: 1,
              ease: "easeOut",
              delay: 0.1
            }}
          />
        </div>
        {showValue && (
          <motion.span
            className={`absolute -top-5 right-0 ${sizes.text} font-medium text-muted-foreground`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            {pct}%
          </motion.span>
        )}
      </div>
    );
  }

  // Fallback to non-animated version
  return (
    <div className={`relative ${className}`}>
      <div className={`${sizes.height} w-full rounded-full bg-gray-200/70`}>
        <div
          className={`${sizes.height} rounded-full ${color} transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showValue && (
        <span className={`absolute -top-5 right-0 ${sizes.text} font-medium text-muted-foreground`}>
          {pct}%
        </span>
      )}
    </div>
  );
} 