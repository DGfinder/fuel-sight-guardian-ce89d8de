import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// Stack component for vertical spacing
const stackVariants = cva(
  "flex flex-col",
  {
    variants: {
      spacing: {
        none: "space-y-0",
        xs: "space-y-1",      // 4px
        sm: "space-y-2",      // 8px  
        md: "space-y-4",      // 16px
        lg: "space-y-6",      // 24px
        xl: "space-y-8",      // 32px
        "2xl": "space-y-12",  // 48px
      },
      align: {
        start: "items-start",
        center: "items-center", 
        end: "items-end",
        stretch: "items-stretch",
      }
    },
    defaultVariants: {
      spacing: "md",
      align: "stretch",
    },
  }
)

// Inline component for horizontal spacing
const inlineVariants = cva(
  "flex flex-row",
  {
    variants: {
      spacing: {
        none: "space-x-0",
        xs: "space-x-1",      // 4px
        sm: "space-x-2",      // 8px
        md: "space-x-4",      // 16px
        lg: "space-x-6",      // 24px
        xl: "space-x-8",      // 32px
        "2xl": "space-x-12",  // 48px
      },
      align: {
        start: "items-start",
        center: "items-center",
        end: "items-end", 
        stretch: "items-stretch",
      },
      justify: {
        start: "justify-start",
        center: "justify-center",
        end: "justify-end",
        between: "justify-between",
        around: "justify-around",
        evenly: "justify-evenly",
      }
    },
    defaultVariants: {
      spacing: "md",
      align: "center",
      justify: "start",
    },
  }
)

// Container component for consistent max-widths and padding
const containerVariants = cva(
  "mx-auto",
  {
    variants: {
      size: {
        sm: "max-w-screen-sm",      // 640px
        md: "max-w-screen-md",      // 768px
        lg: "max-w-screen-lg",      // 1024px
        xl: "max-w-screen-xl",      // 1280px
        "2xl": "max-w-screen-2xl",  // 1536px
        full: "max-w-full",
      },
      padding: {
        none: "px-0",
        sm: "px-4",     // 16px
        md: "px-6",     // 24px
        lg: "px-8",     // 32px
      }
    },
    defaultVariants: {
      size: "xl",
      padding: "md",
    },
  }
)

// Section component for page sections with consistent spacing
const sectionVariants = cva(
  "",
  {
    variants: {
      spacing: {
        none: "py-0",
        sm: "py-8",      // 32px
        md: "py-12",     // 48px
        lg: "py-16",     // 64px
        xl: "py-20",     // 80px
      },
      background: {
        none: "",
        white: "bg-white",
        gray: "bg-gray-50",
        primary: "bg-primary-50",
        secondary: "bg-secondary-50",
      }
    },
    defaultVariants: {
      spacing: "md",
      background: "none",
    },
  }
)

// Grid component for responsive layouts
const gridVariants = cva(
  "grid",
  {
    variants: {
      cols: {
        1: "grid-cols-1",
        2: "grid-cols-1 md:grid-cols-2",
        3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
        4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
        6: "grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
        12: "grid-cols-12",
      },
      gap: {
        none: "gap-0",
        xs: "gap-1",      // 4px
        sm: "gap-2",      // 8px
        md: "gap-4",      // 16px
        lg: "gap-6",      // 24px
        xl: "gap-8",      // 32px
      }
    },
    defaultVariants: {
      cols: 1,
      gap: "md",
    },
  }
)

// Card component for consistent card layouts
const cardVariants = cva(
  "rounded-lg border bg-white shadow-sm",
  {
    variants: {
      padding: {
        none: "p-0",
        sm: "p-4",       // 16px
        md: "p-6",       // 24px
        lg: "p-8",       // 32px
      },
      shadow: {
        none: "shadow-none",
        sm: "shadow-sm",
        md: "shadow-md",
        lg: "shadow-lg",
      },
      border: {
        none: "border-0",
        default: "border",
        thick: "border-2",
      }
    },
    defaultVariants: {
      padding: "md",
      shadow: "sm",
      border: "default",
    },
  }
)

// Stack Component
export interface StackProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof stackVariants> {}

const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  ({ className, spacing, align, ...props }, ref) => {
    return (
      <div
        className={cn(stackVariants({ spacing, align }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Stack.displayName = "Stack"

// Inline Component
export interface InlineProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof inlineVariants> {}

const Inline = React.forwardRef<HTMLDivElement, InlineProps>(
  ({ className, spacing, align, justify, ...props }, ref) => {
    return (
      <div
        className={cn(inlineVariants({ spacing, align, justify }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Inline.displayName = "Inline"

// Container Component
export interface ContainerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof containerVariants> {}

const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  ({ className, size, padding, ...props }, ref) => {
    return (
      <div
        className={cn(containerVariants({ size, padding }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Container.displayName = "Container"

// Section Component
export interface SectionProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof sectionVariants> {
  as?: "section" | "div" | "main" | "article";
}

const Section = React.forwardRef<HTMLElement, SectionProps>(
  ({ className, spacing, background, as = "section", ...props }, ref) => {
    return React.createElement(
      as,
      {
        className: cn(sectionVariants({ spacing, background }), className),
        ref,
        ...props,
      }
    )
  }
)
Section.displayName = "Section"

// Grid Component
export interface GridProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof gridVariants> {}

const Grid = React.forwardRef<HTMLDivElement, GridProps>(
  ({ className, cols, gap, ...props }, ref) => {
    return (
      <div
        className={cn(gridVariants({ cols, gap }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Grid.displayName = "Grid"

// Card Component  
export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, padding, shadow, border, ...props }, ref) => {
    return (
      <div
        className={cn(cardVariants({ padding, shadow, border }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Card.displayName = "Card"

// Specialized layout components for fuel monitoring

// Dashboard Grid - for dashboard layouts
export interface DashboardGridProps extends Omit<GridProps, 'cols'> {
  layout?: "compact" | "default" | "spacious";
}

const DashboardGrid = React.forwardRef<HTMLDivElement, DashboardGridProps>(
  ({ layout = "default", className, ...props }, ref) => {
    const cols = layout === "compact" ? 4 : layout === "spacious" ? 2 : 3;
    const gap = layout === "compact" ? "sm" : layout === "spacious" ? "xl" : "lg";
    
    return (
      <Grid
        ref={ref}
        cols={cols}
        gap={gap}
        className={className}
        {...props}
      />
    )
  }
)
DashboardGrid.displayName = "DashboardGrid"

// Tank List Layout - for vertical tank lists
export interface TankListProps extends StackProps {
  density?: "compact" | "default" | "comfortable";
}

const TankList = React.forwardRef<HTMLDivElement, TankListProps>(
  ({ density = "default", className, ...props }, ref) => {
    const spacing = density === "compact" ? "sm" : density === "comfortable" ? "lg" : "md";
    
    return (
      <Stack
        ref={ref}
        spacing={spacing}
        className={className}
        {...props}
      />
    )
  }
)
TankList.displayName = "TankList"

// Control Bar - for action buttons and controls
export interface ControlBarProps extends InlineProps {
  position?: "left" | "center" | "right" | "between";
}

const ControlBar = React.forwardRef<HTMLDivElement, ControlBarProps>(
  ({ position = "between", className, ...props }, ref) => {
    const justify = position === "left" ? "start" :
                   position === "center" ? "center" :
                   position === "right" ? "end" : "between";
    
    return (
      <Inline
        ref={ref}
        justify={justify}
        spacing="md"
        className={cn("py-4 border-b bg-gray-50/50", className)}
        {...props}
      />
    )
  }
)
ControlBar.displayName = "ControlBar"

// Status Panel - for status displays
export interface StatusPanelProps extends CardProps {
  variant?: "default" | "warning" | "critical" | "success";
}

const StatusPanel = React.forwardRef<HTMLDivElement, StatusPanelProps>(
  ({ variant = "default", className, ...props }, ref) => {
    const borderColor = variant === "warning" ? "border-fuel-low" :
                       variant === "critical" ? "border-fuel-critical" :
                       variant === "success" ? "border-fuel-normal" : "border-gray-200";
    
    const bgColor = variant === "warning" ? "bg-fuel-low/5" :
                   variant === "critical" ? "bg-fuel-critical/5" :
                   variant === "success" ? "bg-fuel-normal/5" : "bg-white";
    
    return (
      <Card
        ref={ref}
        className={cn(borderColor, bgColor, className)}
        {...props}
      />
    )
  }
)
StatusPanel.displayName = "StatusPanel"

export {
  Stack,
  Inline,
  Container,
  Section,
  Grid,
  Card,
  DashboardGrid,
  TankList,
  ControlBar,
  StatusPanel,
  stackVariants,
  inlineVariants,
  containerVariants,
  sectionVariants,
  gridVariants,
  cardVariants,
}