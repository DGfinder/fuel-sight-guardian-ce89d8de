import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// Heading component variants
const headingVariants = cva(
  "font-semibold tracking-tight",
  {
    variants: {
      level: {
        h1: "text-heading-2xl md:text-4xl",      // Dashboard titles
        h2: "text-heading-xl md:text-3xl",       // Page titles  
        h3: "text-heading-lg md:text-2xl",       // Section titles
        h4: "text-heading md:text-xl",           // Subsection titles
        h5: "text-heading-sm md:text-lg",        // Card titles
        h6: "text-heading-xs md:text-base",      // Small headings
      },
      color: {
        default: "text-gray-900",
        muted: "text-gray-600",
        primary: "text-primary",
        secondary: "text-secondary",
        success: "text-success",
        warning: "text-warning",
        error: "text-error",
      }
    },
    defaultVariants: {
      level: "h3",
      color: "default",
    },
  }
)

// Text component variants
const textVariants = cva(
  "",
  {
    variants: {
      variant: {
        // Standard text sizes
        body: "text-base leading-relaxed",              // Main body text
        "body-sm": "text-sm leading-relaxed",           // Smaller body text
        caption: "text-xs leading-normal",              // Caption text
        
        // Data display text (for fuel readings, numbers)
        "reading-xl": "text-reading-xl font-mono font-semibold",    // Large readings
        "reading-lg": "text-reading-lg font-mono font-medium",      // Medium readings  
        "reading": "text-reading font-mono",                        // Standard readings
        "reading-sm": "text-reading-sm font-mono",                  // Small readings
        
        // Label text (for tank names, locations)
        "label-lg": "text-label-lg font-medium",        // Large labels
        "label": "text-label font-medium",              // Standard labels
        "label-sm": "text-label-sm font-medium",        // Small labels
        "label-xs": "text-label-xs font-medium",        // Extra small labels
        
        // Alert text
        "alert-lg": "text-alert-lg font-medium",        // Large alerts
        "alert": "text-alert font-medium",              // Standard alerts
        "alert-sm": "text-alert-sm font-medium",        // Small alerts
        
        // Special variants
        muted: "text-sm text-gray-600",                 // Muted text
        lead: "text-lg leading-relaxed text-gray-600",  // Lead paragraph
        small: "text-xs text-gray-500",                 // Small helper text
        large: "text-lg font-medium",                   // Large text
      },
      color: {
        default: "text-gray-900",
        muted: "text-gray-600",
        subtle: "text-gray-500",
        disabled: "text-gray-400",
        inverse: "text-white",
        primary: "text-primary",
        secondary: "text-secondary",
        success: "text-success",
        warning: "text-warning",
        error: "text-error",
        // Fuel status colors
        "fuel-critical": "text-fuel-critical",
        "fuel-low": "text-fuel-low", 
        "fuel-normal": "text-fuel-normal",
        "fuel-unknown": "text-fuel-unknown",
      }
    },
    defaultVariants: {
      variant: "body",
      color: "default",
    },
  }
)

// Heading Component
export interface HeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof headingVariants> {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className, level, color, as, children, ...props }, ref) => {
    const Component = as || level || "h3";
    
    return React.createElement(
      Component,
      {
        className: cn(headingVariants({ level: level || (as as any), color }), className),
        ref,
        ...props,
      },
      children
    );
  }
)
Heading.displayName = "Heading"

// Text Component  
export interface TextProps
  extends React.HTMLAttributes<HTMLParagraphElement>,
    VariantProps<typeof textVariants> {
  as?: "p" | "span" | "div" | "label";
}

const Text = React.forwardRef<HTMLParagraphElement, TextProps>(
  ({ className, variant, color, as = "p", children, ...props }, ref) => {
    return React.createElement(
      as,
      {
        className: cn(textVariants({ variant, color }), className),
        ref,
        ...props,
      },
      children
    );
  }
)
Text.displayName = "Text"

// Specialized components for fuel industry context

// Tank Reading Component - for displaying fuel readings
export interface TankReadingProps extends Omit<TextProps, 'variant'> {
  value: number | null | undefined;
  unit?: string;
  size?: "sm" | "default" | "lg" | "xl";
  showUnit?: boolean;
}

const TankReading = React.forwardRef<HTMLParagraphElement, TankReadingProps>(
  ({ value, unit = "%", size = "default", showUnit = true, className, color, ...props }, ref) => {
    const variant = size === "sm" ? "reading-sm" : 
                   size === "lg" ? "reading-lg" :
                   size === "xl" ? "reading-xl" : "reading";
    
    const displayValue = value !== null && value !== undefined ? value.toFixed(1) : "--";
    
    return (
      <Text
        ref={ref}
        variant={variant}
        color={color}
        className={cn("tabular-nums", className)}
        {...props}
      >
        {displayValue}{showUnit && unit}
      </Text>
    );
  }
)
TankReading.displayName = "TankReading"

// Tank Label Component - for tank names and locations
export interface TankLabelProps extends Omit<TextProps, 'variant'> {
  size?: "xs" | "sm" | "default" | "lg";
}

const TankLabel = React.forwardRef<HTMLParagraphElement, TankLabelProps>(
  ({ size = "default", className, ...props }, ref) => {
    const variant = size === "xs" ? "label-xs" :
                   size === "sm" ? "label-sm" :
                   size === "lg" ? "label-lg" : "label";
    
    return (
      <Text
        ref={ref}
        variant={variant}
        className={cn("truncate", className)}
        {...props}
      />
    );
  }
)
TankLabel.displayName = "TankLabel"

// Alert Text Component - for alert messages
export interface AlertTextProps extends Omit<TextProps, 'variant'> {
  severity?: "info" | "warning" | "error" | "success";
  size?: "sm" | "default" | "lg";
}

const AlertText = React.forwardRef<HTMLParagraphElement, AlertTextProps>(
  ({ severity = "info", size = "default", className, ...props }, ref) => {
    const variant = size === "sm" ? "alert-sm" :
                   size === "lg" ? "alert-lg" : "alert";
    
    const color = severity === "warning" ? "warning" :
                  severity === "error" ? "error" :
                  severity === "success" ? "success" : "primary";
    
    return (
      <Text
        ref={ref}
        variant={variant}
        color={color}
        className={className}
        {...props}
      />
    );
  }
)
AlertText.displayName = "AlertText"

// Data List Component - for key-value pairs common in fuel monitoring
export interface DataListProps extends React.HTMLAttributes<HTMLDListElement> {
  items: Array<{
    label: string;
    value: React.ReactNode;
    color?: VariantProps<typeof textVariants>["color"];
  }>;
  orientation?: "horizontal" | "vertical";
  spacing?: "compact" | "default" | "relaxed";
}

const DataList = React.forwardRef<HTMLDListElement, DataListProps>(
  ({ items, orientation = "vertical", spacing = "default", className, ...props }, ref) => {
    const isHorizontal = orientation === "horizontal";
    const spacingClass = spacing === "compact" ? "space-y-1" :
                        spacing === "relaxed" ? "space-y-3" : "space-y-2";
    
    return (
      <dl
        ref={ref}
        className={cn(
          isHorizontal ? "grid grid-cols-2 gap-x-4 gap-y-2" : spacingClass,
          className
        )}
        {...props}
      >
        {items.map((item, index) => (
          <React.Fragment key={index}>
            <dt className={cn(
              "text-label-sm text-gray-600",
              isHorizontal && "font-medium"
            )}>
              {item.label}
            </dt>
            <dd className={cn(
              "text-label font-medium",
              item.color && `text-${item.color}`,
              isHorizontal && "text-right"
            )}>
              {item.value}
            </dd>
          </React.Fragment>
        ))}
      </dl>
    );
  }
)
DataList.displayName = "DataList"

export {
  Heading,
  Text,
  TankReading,
  TankLabel,
  AlertText,
  DataList,
  headingVariants,
  textVariants,
}