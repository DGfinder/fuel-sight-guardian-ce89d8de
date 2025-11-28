import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, RefreshCw, Bug, Send, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import * as Sentry from "@sentry/react";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePerformanceMonitor, type PerformanceMetrics } from '@/lib/performance-monitor';

// Window extension for performance monitor
declare global {
  interface Window {
    performanceMonitor?: {
      trackCustomEvent: (event: string, data: Record<string, unknown>) => void;
      getMetrics: () => Partial<PerformanceMetrics>;
    };
  }
}

interface ErrorInfo {
  componentStack?: string;
  errorBoundary?: string;
  errorBoundaryStack?: string;
}

interface EnhancedErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
  retryCount: number;
  showDetails: boolean;
  reportSent: boolean;
}

interface EnhancedErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ 
    error?: Error; 
    resetError: () => void; 
    errorInfo?: ErrorInfo;
  }>;
  level?: 'page' | 'component' | 'feature';
  name?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  maxRetries?: number;
  showReportButton?: boolean;
}

export class EnhancedErrorBoundary extends React.Component<
  EnhancedErrorBoundaryProps, 
  EnhancedErrorBoundaryState
> {
  private retryTimeouts: number[] = [];

  constructor(props: EnhancedErrorBoundaryProps) {
    super(props);
    this.state = { 
      hasError: false, 
      retryCount: 0,
      showDetails: false,
      reportSent: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<EnhancedErrorBoundaryState> {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return { 
      hasError: true, 
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const enhancedErrorInfo: ErrorInfo = {
      componentStack: errorInfo.componentStack,
      errorBoundary: this.props.name || 'Unknown',
      errorBoundaryStack: errorInfo.errorBoundaryStack,
    };

    this.setState({ errorInfo: enhancedErrorInfo });

    // Report to Sentry with enhanced context
    Sentry.withScope((scope) => {
      scope.setTag('errorBoundary', this.props.name || 'unknown');
      scope.setTag('errorLevel', this.props.level || 'component');
      scope.setContext('errorBoundary', {
        name: this.props.name,
        level: this.props.level,
        retryCount: this.state.retryCount,
        componentStack: errorInfo.componentStack,
      });
      scope.setLevel('error');
      
      Sentry.captureException(error);
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, enhancedErrorInfo);
    }

    // Log to performance monitor
    if (typeof window !== 'undefined' && window.performanceMonitor) {
      window.performanceMonitor.trackCustomEvent('error_boundary_triggered', {
        errorMessage: error.message,
        errorName: error.name,
        boundaryName: this.props.name,
        level: this.props.level,
      });
    }

    console.error('Enhanced Error Boundary caught an error:', error, enhancedErrorInfo);
  }

  componentWillUnmount() {
    // Clear any pending retry timeouts
    this.retryTimeouts.forEach(clearTimeout);
  }

  resetError = (autoRetry = false) => {
    if (autoRetry && this.state.retryCount >= (this.props.maxRetries || 3)) {
      return;
    }

    const newRetryCount = autoRetry ? this.state.retryCount + 1 : 0;
    
    this.setState({ 
      hasError: false, 
      error: undefined,
      errorInfo: undefined,
      retryCount: newRetryCount,
      showDetails: false,
      reportSent: false,
    });

    // Track retry attempts
    if (typeof window !== 'undefined' && window.performanceMonitor) {
      window.performanceMonitor.trackCustomEvent('error_boundary_retry', {
        retryCount: newRetryCount,
        boundaryName: this.props.name,
        autoRetry,
      });
    }
  };

  autoRetry = () => {
    if (this.state.retryCount < (this.props.maxRetries || 3)) {
      const delay = Math.min(1000 * Math.pow(2, this.state.retryCount), 10000); // Exponential backoff
      
      const timeoutId = window.setTimeout(() => {
        this.resetError(true);
      }, delay);
      
      this.retryTimeouts.push(timeoutId);
    }
  };

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  sendReport = async () => {
    if (!this.state.error || this.state.reportSent) return;

    try {
      // Send detailed error report
      const report = {
        error: {
          message: this.state.error.message,
          stack: this.state.error.stack,
          name: this.state.error.name,
        },
        errorInfo: this.state.errorInfo,
        context: {
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          boundaryName: this.props.name,
          level: this.props.level,
          retryCount: this.state.retryCount,
        },
        performance: typeof window !== 'undefined' && window.performanceMonitor
          ? window.performanceMonitor.getMetrics()
          : null,
      };

      // In production, send to your error reporting service
      console.log('Error report:', report);
      
      this.setState({ reportSent: true });
      
      // Track report sent
      if (typeof window !== 'undefined' && window.performanceMonitor) {
        window.performanceMonitor.trackCustomEvent('error_report_sent', {
          errorId: this.state.errorId,
          boundaryName: this.props.name,
        });
      }
    } catch (reportError) {
      console.error('Failed to send error report:', reportError);
    }
  };

  copyErrorDetails = () => {
    if (!this.state.error) return;

    const errorDetails = {
      error: this.state.error.message,
      stack: this.state.error.stack,
      boundary: this.props.name,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    };

    navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2))
      .then(() => {
        // Could show a toast notification here
        console.log('Error details copied to clipboard');
      })
      .catch(err => {
        console.error('Failed to copy error details:', err);
      });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent 
            error={this.state.error} 
            resetError={this.resetError}
            errorInfo={this.state.errorInfo}
          />
        );
      }

      return (
        <EnhancedErrorFallback 
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          errorId={this.state.errorId}
          retryCount={this.state.retryCount}
          maxRetries={this.props.maxRetries || 3}
          level={this.props.level}
          name={this.props.name}
          showDetails={this.state.showDetails}
          reportSent={this.state.reportSent}
          showReportButton={this.props.showReportButton !== false}
          onReset={this.resetError}
          onAutoRetry={this.autoRetry}
          onToggleDetails={this.toggleDetails}
          onSendReport={this.sendReport}
          onCopyDetails={this.copyErrorDetails}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
  retryCount: number;
  maxRetries: number;
  level?: string;
  name?: string;
  showDetails: boolean;
  reportSent: boolean;
  showReportButton: boolean;
  onReset: () => void;
  onAutoRetry: () => void;
  onToggleDetails: () => void;
  onSendReport: () => void;
  onCopyDetails: () => void;
}

function EnhancedErrorFallback({
  error,
  errorInfo,
  errorId,
  retryCount,
  maxRetries,
  level,
  name,
  showDetails,
  reportSent,
  showReportButton,
  onReset,
  onAutoRetry,
  onToggleDetails,
  onSendReport,
  onCopyDetails,
}: ErrorFallbackProps) {
  const canRetry = retryCount < maxRetries;
  
  const getLevelColor = () => {
    switch (level) {
      case 'page': return 'bg-red-100 text-red-800 border-red-200';
      case 'feature': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'component': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getLevelIcon = () => {
    switch (level) {
      case 'page': return '🚨';
      case 'feature': return '⚠️';
      case 'component': return '🔧';
      default: return '❌';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="max-w-2xl mx-auto mt-8"
    >
      <Card className="border-red-200 shadow-lg">
        <CardHeader className="bg-red-50">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-red-900">Something went wrong</span>
                  {level && (
                    <Badge className={`text-xs ${getLevelColor()}`}>
                      {getLevelIcon()} {level}
                    </Badge>
                  )}
                </div>
                {name && (
                  <p className="text-sm text-red-600 font-normal">in {name}</p>
                )}
              </div>
            </div>
            
            {errorId && (
              <Badge variant="outline" className="text-xs font-mono">
                {errorId.slice(-8)}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4 pt-6">
          <div className="text-gray-700">
            <p className="mb-2">
              We encountered an unexpected error. Our team has been notified and is working on a fix.
            </p>
            
            {retryCount > 0 && (
              <p className="text-sm text-amber-600">
                Retry attempt {retryCount} of {maxRetries}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={onReset} 
              variant="default" 
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            
            {canRetry && (
              <Button 
                onClick={onAutoRetry} 
                variant="outline" 
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Auto Retry
              </Button>
            )}
            
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline"
            >
              Refresh Page
            </Button>
            
            {showReportButton && (
              <Button 
                onClick={onSendReport} 
                variant="outline"
                disabled={reportSent}
                className="flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {reportSent ? 'Report Sent' : 'Send Report'}
              </Button>
            )}
          </div>

          {/* Error Details Toggle */}
          {error && (
            <div className="border-t pt-4">
              <Button
                onClick={onToggleDetails}
                variant="ghost"
                size="sm"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
              >
                <Bug className="w-4 h-4" />
                {showDetails ? 'Hide' : 'Show'} Error Details
                {showDetails ? 
                  <ChevronUp className="w-4 h-4" /> : 
                  <ChevronDown className="w-4 h-4" />
                }
              </Button>
              
              <AnimatePresence>
                {showDetails && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-4 p-4 bg-gray-50 rounded-lg overflow-hidden"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium text-gray-900">Error Details</h4>
                      <Button
                        onClick={onCopyDetails}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        Copy
                      </Button>
                    </div>
                    
                    <div className="space-y-3 text-sm">
                      <div>
                        <strong className="text-gray-700">Message:</strong>
                        <p className="mt-1 text-gray-600 font-mono text-xs bg-white p-2 rounded border">
                          {error.message}
                        </p>
                      </div>
                      
                      {error.stack && (
                        <div>
                          <strong className="text-gray-700">Stack Trace:</strong>
                          <pre className="mt-1 text-xs bg-white p-2 rounded border overflow-x-auto text-gray-600 font-mono whitespace-pre-wrap">
                            {error.stack}
                          </pre>
                        </div>
                      )}
                      
                      {errorInfo?.componentStack && (
                        <div>
                          <strong className="text-gray-700">Component Stack:</strong>
                          <pre className="mt-1 text-xs bg-white p-2 rounded border overflow-x-auto text-gray-600 font-mono whitespace-pre-wrap">
                            {errorInfo.componentStack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Specialized error boundaries for different contexts
export function PageErrorBoundary({ children, name }: { 
  children: React.ReactNode; 
  name?: string; 
}) {
  return (
    <EnhancedErrorBoundary 
      level="page" 
      name={name}
      maxRetries={1}
      showReportButton={true}
    >
      {children}
    </EnhancedErrorBoundary>
  );
}

export function FeatureErrorBoundary({ children, name }: { 
  children: React.ReactNode; 
  name?: string; 
}) {
  return (
    <EnhancedErrorBoundary 
      level="feature" 
      name={name}
      maxRetries={2}
      showReportButton={true}
    >
      {children}
    </EnhancedErrorBoundary>
  );
}

export function ComponentErrorBoundary({ children, name }: { 
  children: React.ReactNode; 
  name?: string; 
}) {
  return (
    <EnhancedErrorBoundary 
      level="component" 
      name={name}
      maxRetries={3}
      showReportButton={false}
    >
      {children}
    </EnhancedErrorBoundary>
  );
}

// Enhanced HOC for wrapping components
export function withEnhancedErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options: {
    level?: 'page' | 'component' | 'feature';
    name?: string;
    maxRetries?: number;
    showReportButton?: boolean;
  } = {}
) {
  return function WrappedComponent(props: P) {
    return (
      <EnhancedErrorBoundary {...options}>
        <Component {...props} />
      </EnhancedErrorBoundary>
    );
  };
}