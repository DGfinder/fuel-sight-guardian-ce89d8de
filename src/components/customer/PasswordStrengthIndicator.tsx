import React from 'react';
import { cn } from '@/lib/utils';
import { getPasswordStrengthDetails } from '@/utils/passwordGenerator';

interface PasswordStrengthIndicatorProps {
  password: string;
}

/**
 * Visual password strength indicator component
 *
 * Shows a colored bar and label indicating password strength
 * based on length, complexity, and character variety.
 */
export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  // Don't show anything if password is empty
  if (!password) {
    return null;
  }

  const { score, label, color, percentage } = getPasswordStrengthDetails(password);

  const colorClasses = {
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    yellow: 'bg-yellow-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
  };

  const textColorClasses = {
    red: 'text-red-600 dark:text-red-400',
    orange: 'text-orange-600 dark:text-orange-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
  };

  return (
    <div className="space-y-1">
      {/* Strength bars */}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors duration-300',
              i <= score
                ? colorClasses[color as keyof typeof colorClasses]
                : 'bg-gray-200 dark:bg-gray-700'
            )}
          />
        ))}
      </div>

      {/* Strength label */}
      <p
        className={cn(
          'text-xs font-medium transition-colors',
          textColorClasses[color as keyof typeof textColorClasses]
        )}
      >
        Password strength: {label}
      </p>
    </div>
  );
}
