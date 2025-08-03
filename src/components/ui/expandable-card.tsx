import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ExpandableCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  iconBg?: string;
  children?: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
  onExpandChange?: (expanded: boolean) => void;
  disabled?: boolean;
}

export function ExpandableCard({
  title,
  value,
  subtitle,
  icon,
  iconBg = 'bg-blue-100',
  children,
  defaultExpanded = false,
  className,
  onExpandChange,
  disabled = false
}: ExpandableCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleToggle = () => {
    if (disabled || !children) return;
    
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onExpandChange?.(newExpanded);
  };

  const hasExpandableContent = children && !disabled;

  return (
    <Card className={cn("overflow-hidden transition-all duration-200", className)}>
      <CardHeader className="pb-2">
        <div 
          className={cn(
            "flex items-center justify-between",
            hasExpandableContent && "cursor-pointer hover:bg-gray-50 -mx-6 -my-4 px-6 py-4 rounded-t-lg transition-colors"
          )}
          onClick={handleToggle}
        >
          <div className="flex-1">
            <p className="text-sm text-gray-600 font-medium">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              {subtitle && (
                <p className="text-xs text-gray-500">{subtitle}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {icon && (
              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", iconBg)}>
                {icon}
              </div>
            )}
            
            {hasExpandableContent && (
              <div className="ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors">
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-600" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-600" />
                )}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Expandable Content */}
      {hasExpandableContent && (
        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <CardContent className="pt-0 pb-4">
            <div className="border-t border-gray-100 pt-4">
              {children}
            </div>
          </CardContent>
        </div>
      )}

      {/* Non-expandable content */}
      {!hasExpandableContent && (
        <CardContent className="pt-0 pb-4">
          {/* Space for any additional non-expandable content */}
        </CardContent>
      )}
    </Card>
  );
}

// Convenience wrapper for analytics cards
export function AnalyticsCard({
  title,
  value,
  trend,
  trendIcon,
  icon,
  iconBg,
  details,
  className
}: {
  title: string;
  value: string | number;
  trend?: string;
  trendIcon?: React.ReactNode;
  icon?: React.ReactNode;
  iconBg?: string;
  details?: React.ReactNode;
  className?: string;
}) {
  const subtitle = trend && trendIcon ? (
    <span className="flex items-center gap-1">
      {trendIcon}
      {trend}
    </span>
  ) : trend;

  return (
    <ExpandableCard
      title={title}
      value={value}
      subtitle={subtitle}
      icon={icon}
      iconBg={iconBg}
      className={className}
    >
      {details}
    </ExpandableCard>
  );
}