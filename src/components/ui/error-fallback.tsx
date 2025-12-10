import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorFallbackProps {
  error: Error | string | { message?: string; code?: string; details?: unknown };
  resetErrorBoundary?: () => void;
  className?: string;
}

export function ErrorFallback({
  error,
  resetErrorBoundary,
  className
}: ErrorFallbackProps) {
  // Handle various error formats: Error object, string, or Supabase error object
  let errorMessage: string;
  if (typeof error === 'string') {
    errorMessage = error;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else if (error && typeof error === 'object' && 'message' in error) {
    errorMessage = String(error.message || 'Unknown error');
  } else {
    errorMessage = 'An unexpected error occurred';
  }

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