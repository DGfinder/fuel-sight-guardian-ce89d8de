import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  className?: string;
  size?: number;
  text?: string;
}

export function LoadingSpinner({ 
  className, 
  size = 24, 
  text 
}: LoadingSpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
      <Loader2 className="animate-spin text-primary" size={size} />
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
    </div>
  );
} 