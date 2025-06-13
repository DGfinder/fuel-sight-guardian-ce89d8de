import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorFallbackProps {
  error: Error | string;
  resetErrorBoundary?: () => void;
  className?: string;
}

export function ErrorFallback({ 
  error, 
  resetErrorBoundary,
  className 
}: ErrorFallbackProps) {
  const errorMessage = error instanceof Error ? error.message : error;

  return (
    <div className={cn(
      "flex flex-col items-center justify-center gap-4 p-4 text-center",
      className
    )}>
      <AlertCircle className="h-8 w-8 text-destructive" />
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Something went wrong</h3>
        <p className="text-sm text-muted-foreground">{errorMessage}</p>
      </div>
      {resetErrorBoundary && (
        <Button 
          variant="outline" 
          onClick={resetErrorBoundary}
        >
          Try again
        </Button>
      )}
    </div>
  );
} 