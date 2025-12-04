import { cva } from "class-variance-authority"

export const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-white hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-white hover:bg-secondary/90",
        destructive:
          "border-transparent bg-error text-white hover:bg-error/90",
        outline: "text-foreground border-gray-200",
        
        // Fuel status variants using design system colors
        success:
          "border-transparent bg-success text-white hover:bg-success/90",
        warning:
          "border-transparent bg-warning text-white hover:bg-warning/90",
        error:
          "border-transparent bg-error text-white hover:bg-error/90",
        
        // Fuel level specific variants
        "fuel-critical":
          "border-transparent bg-fuel-critical text-white hover:bg-fuel-critical/90 shadow-sm",
        "fuel-low":
          "border-transparent bg-fuel-low text-white hover:bg-fuel-low/90 shadow-sm",
        "fuel-normal":
          "border-transparent bg-fuel-normal text-white hover:bg-fuel-normal/90 shadow-sm",
        "fuel-unknown":
          "border-transparent bg-fuel-unknown text-white hover:bg-fuel-unknown/90 shadow-sm",
          
        // Outline variants for subtle display
        "fuel-critical-outline":
          "border-fuel-critical text-fuel-critical bg-fuel-critical/10 hover:bg-fuel-critical/20",
        "fuel-low-outline":
          "border-fuel-low text-fuel-low bg-fuel-low/10 hover:bg-fuel-low/20",
        "fuel-normal-outline":
          "border-fuel-normal text-fuel-normal bg-fuel-normal/10 hover:bg-fuel-normal/20",
        "fuel-unknown-outline":
          "border-fuel-unknown text-fuel-unknown bg-fuel-unknown/10 hover:bg-fuel-unknown/20",
          
        // Subtle variant for product types and other low-emphasis badges
        subtle:
          "border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
) 