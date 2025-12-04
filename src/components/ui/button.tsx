import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { type VariantProps } from "class-variance-authority"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"
import { buttonVariants as buttonVariantStyles } from "./button.variants"
import { buttonVariants as buttonMotionVariants } from "@/lib/motion-variants"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariantStyles> {
  asChild?: boolean
  animated?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, animated = false, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariantStyles({ variant, size, className }))}
          ref={ref}
          {...props}
        />
      )
    }

    if (animated) {
      return (
        <motion.button
          className={cn(buttonVariantStyles({ variant, size, className }))}
          ref={ref}
          initial="rest"
          whileHover="hover"
          whileTap="tap"
          variants={buttonMotionVariants}
          {...props}
        />
      )
    }

    return (
      <button
        className={cn(buttonVariantStyles({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariantStyles as buttonVariants }
