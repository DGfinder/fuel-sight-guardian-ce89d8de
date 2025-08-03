import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// Fuel Status Badge Variants
const fuelStatusVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        critical: "border-fuel-critical bg-fuel-critical text-white shadow-sm",
        low: "border-fuel-low bg-fuel-low text-white shadow-sm",
        normal: "border-fuel-normal bg-fuel-normal text-white shadow-sm",
        unknown: "border-fuel-unknown bg-fuel-unknown text-white shadow-sm",
        // Outline variants for subtle display
        "critical-outline": "border-fuel-critical text-fuel-critical bg-fuel-critical/10",
        "low-outline": "border-fuel-low text-fuel-low bg-fuel-low/10",
        "normal-outline": "border-fuel-normal text-fuel-normal bg-fuel-normal/10",
        "unknown-outline": "border-fuel-unknown text-fuel-unknown bg-fuel-unknown/10",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "unknown",
      size: "default",
    },
  }
)

// Fuel Status Indicator (circular indicator)
const fuelIndicatorVariants = cva(
  "inline-block rounded-full",
  {
    variants: {
      variant: {
        critical: "bg-fuel-critical",
        low: "bg-fuel-low", 
        normal: "bg-fuel-normal",
        unknown: "bg-fuel-unknown",
      },
      size: {
        sm: "h-2 w-2",
        default: "h-3 w-3",
        lg: "h-4 w-4",
        xl: "h-5 w-5",
      },
    },
    defaultVariants: {
      variant: "unknown",
      size: "default",
    },
  }
)

// Fuel Level Bar variants
const fuelLevelBarVariants = cva(
  "relative overflow-hidden rounded-full bg-gray-200",
  {
    variants: {
      size: {
        sm: "h-2",
        default: "h-3",
        lg: "h-4",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

// Utility function to determine fuel status from percentage
export const getFuelStatus = (percentage: number | null | undefined): 'critical' | 'low' | 'normal' | 'unknown' => {
  if (percentage === null || percentage === undefined) return 'unknown';
  if (percentage <= 10) return 'critical';
  if (percentage <= 20) return 'low';
  return 'normal';
}

// Utility function to get fuel status display text
export const getFuelStatusText = (percentage: number | null | undefined): string => {
  const status = getFuelStatus(percentage);
  switch (status) {
    case 'critical': return `Critical (${percentage?.toFixed(1)}%)`;
    case 'low': return `Low (${percentage?.toFixed(1)}%)`;
    case 'normal': return `Normal (${percentage?.toFixed(1)}%)`;
    case 'unknown': return 'Unknown';
  }
}

// Fuel Status Badge Component
export interface FuelStatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof fuelStatusVariants> {
  percentage?: number | null;
  showPercentage?: boolean;
}

const FuelStatusBadge = React.forwardRef<HTMLDivElement, FuelStatusBadgeProps>(
  ({ className, variant, size, percentage, showPercentage = true, children, ...props }, ref) => {
    const status = variant || getFuelStatus(percentage);
    const displayText = children || (showPercentage ? getFuelStatusText(percentage) : status);
    
    return (
      <div className={cn(fuelStatusVariants({ variant: status, size }), className)} ref={ref} {...props}>
        {displayText}
      </div>
    )
  }
)
FuelStatusBadge.displayName = "FuelStatusBadge"

// Fuel Status Indicator Component
export interface FuelStatusIndicatorProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof fuelIndicatorVariants> {
  percentage?: number | null;
}

const FuelStatusIndicator = React.forwardRef<HTMLSpanElement, FuelStatusIndicatorProps>(
  ({ className, variant, size, percentage, ...props }, ref) => {
    const status = variant || getFuelStatus(percentage);
    
    return (
      <span
        className={cn(fuelIndicatorVariants({ variant: status, size }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
FuelStatusIndicator.displayName = "FuelStatusIndicator"

// Fuel Level Bar Component
export interface FuelLevelBarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof fuelLevelBarVariants> {
  percentage: number | null | undefined;
  showLabel?: boolean;
  animate?: boolean;
}

const FuelLevelBar = React.forwardRef<HTMLDivElement, FuelLevelBarProps>(
  ({ className, size, percentage, showLabel = false, animate = true, ...props }, ref) => {
    const validPercentage = Math.max(0, Math.min(100, percentage || 0));
    const status = getFuelStatus(percentage);
    
    const getBarColor = () => {
      switch (status) {
        case 'critical': return 'bg-fuel-critical';
        case 'low': return 'bg-fuel-low';
        case 'normal': return 'bg-fuel-normal';
        default: return 'bg-fuel-unknown';
      }
    };

    return (
      <div className="space-y-1">
        {showLabel && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Fuel Level</span>
            <span className="font-medium">{validPercentage.toFixed(1)}%</span>
          </div>
        )}
        <div
          className={cn(fuelLevelBarVariants({ size }), className)}
          ref={ref}
          {...props}
        >
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              getBarColor(),
              animate && "transition-all duration-500"
            )}
            style={{ width: `${validPercentage}%` }}
          />
        </div>
      </div>
    )
  }
)
FuelLevelBar.displayName = "FuelLevelBar"

// Tank Status Card Component
export interface TankStatusCardProps extends React.HTMLAttributes<HTMLDivElement> {
  tankName: string;
  percentage: number | null | undefined;
  location?: string;
  lastUpdated?: string;
  compact?: boolean;
}

const TankStatusCard = React.forwardRef<HTMLDivElement, TankStatusCardProps>(
  ({ className, tankName, percentage, location, lastUpdated, compact = false, ...props }, ref) => {
    const status = getFuelStatus(percentage);
    
    return (
      <div
        className={cn(
          "rounded-lg border bg-card p-4 shadow-sm transition-colors",
          "hover:shadow-md",
          className
        )}
        ref={ref}
        {...props}
      >
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className={cn(
                "font-semibold leading-none tracking-tight",
                compact ? "text-sm" : "text-base"
              )}>
                {tankName}
              </h3>
              {location && (
                <p className={cn(
                  "text-muted-foreground",
                  compact ? "text-xs" : "text-sm"
                )}>
                  {location}
                </p>
              )}
            </div>
            <FuelStatusBadge percentage={percentage} size={compact ? "sm" : "default"} />
          </div>

          {/* Fuel Level Bar */}
          <FuelLevelBar 
            percentage={percentage} 
            size={compact ? "sm" : "default"}
            showLabel={!compact}
          />

          {/* Footer */}
          {lastUpdated && (
            <div className="flex items-center text-xs text-muted-foreground">
              <span>Last updated: {lastUpdated}</span>
            </div>
          )}
        </div>
      </div>
    )
  }
)
TankStatusCard.displayName = "TankStatusCard"

export { 
  FuelStatusBadge, 
  FuelStatusIndicator, 
  FuelLevelBar, 
  TankStatusCard,
  fuelStatusVariants,
  fuelIndicatorVariants,
  fuelLevelBarVariants
}