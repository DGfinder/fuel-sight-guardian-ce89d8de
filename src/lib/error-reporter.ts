import * as Sentry from "@sentry/react";
import type { SeverityLevel } from "@sentry/react";

// Performance metrics data structure
export interface PerformanceData {
  loadTime?: number;
  renderTime?: number;
  apiLatency?: number;
  memoryUsage?: number;
  [key: string]: unknown;
}

// Breadcrumb data structure
export type BreadcrumbData = Record<string, string | number | boolean | null | undefined>;

// Window extension for performance monitor
declare global {
  interface Window {
    performanceMonitor?: {
      trackCustomEvent: (event: string, data: Record<string, unknown>) => void;
    };
  }
}

export interface ErrorReport {
  id: string;
  timestamp: number;
  error: {
    message: string;
    stack?: string;
    name: string;
  };
  context: {
    url: string;
    userAgent: string;
    userId?: string;
    sessionId?: string;
    component?: string;
    level: 'info' | 'warning' | 'error' | 'fatal';
    tags?: Record<string, string>;
  };
  performance?: PerformanceData;
  user?: {
    id?: string;
    email?: string;
    role?: string;
  };
  breadcrumbs?: Array<{
    message: string;
    category: string;
    timestamp: number;
    level: string;
    data?: BreadcrumbData;
  }>;
}

class ErrorReporter {
  private reports: ErrorReport[] = [];
  private maxReports = 100;
  private breadcrumbs: ErrorReport['breadcrumbs'] = [];
  private maxBreadcrumbs = 50;

  constructor() {
    this.setupGlobalErrorHandlers();
    this.loadStoredReports();
  }

  private setupGlobalErrorHandlers(): void {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.captureError(new Error(event.message), {
        level: 'error',
        tags: {
          source: 'global_error',
          filename: event.filename || 'unknown',
          lineno: String(event.lineno || 0),
          colno: String(event.colno || 0),
        },
      });
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError(
        new Error(`Unhandled Promise Rejection: ${event.reason}`),
        {
          level: 'error',
          tags: {
            source: 'unhandled_promise',
            reason: String(event.reason),
          },
        }
      );
    });

    // Console error override
    const originalConsoleError = console.error;
    console.error = (...args) => {
      this.addBreadcrumb({
        message: args.join(' '),
        category: 'console',
        level: 'error',
      });
      originalConsoleError.apply(console, args);
    };

    // Console warn override
    const originalConsoleWarn = console.warn;
    console.warn = (...args) => {
      this.addBreadcrumb({
        message: args.join(' '),
        category: 'console',
        level: 'warning',
      });
      originalConsoleWarn.apply(console, args);
    };
  }

  private loadStoredReports(): void {
    try {
      const stored = localStorage.getItem('error_reports');
      if (stored) {
        this.reports = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load stored error reports:', error);
    }
  }

  private saveReports(): void {
    try {
      // Keep only the most recent reports
      const reportsToSave = this.reports.slice(-this.maxReports);
      localStorage.setItem('error_reports', JSON.stringify(reportsToSave));
    } catch (error) {
      console.warn('Failed to save error reports:', error);
    }
  }

  public captureError(
    error: Error,
    context: Partial<ErrorReport['context']> = {},
    additionalData: Partial<ErrorReport> = {}
  ): string {
    const errorId = this.generateErrorId();
    
    const report: ErrorReport = {
      id: errorId,
      timestamp: Date.now(),
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      context: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        level: 'error',
        ...context,
      },
      breadcrumbs: [...this.breadcrumbs],
      ...additionalData,
    };

    // Add to local reports
    this.reports.push(report);
    this.saveReports();

    // Send to Sentry
    this.sendToSentry(report);

    // Send to custom analytics if available
    this.sendToAnalytics(report);

    // Add to breadcrumbs for future errors
    this.addBreadcrumb({
      message: `Error captured: ${error.message}`,
      category: 'error',
      level: 'error',
      data: { errorId },
    });

    return errorId;
  }

  public captureMessage(
    message: string,
    level: ErrorReport['context']['level'] = 'info',
    context: Partial<ErrorReport['context']> = {}
  ): string {
    return this.captureError(new Error(message), { level, ...context });
  }

  public addBreadcrumb(breadcrumb: Omit<NonNullable<ErrorReport['breadcrumbs']>[0], 'timestamp'>): void {
    const fullBreadcrumb = {
      timestamp: Date.now(),
      ...breadcrumb,
    };

    this.breadcrumbs.push(fullBreadcrumb);

    // Keep only recent breadcrumbs
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs);
    }

    // Also add to Sentry
    Sentry.addBreadcrumb({
      message: breadcrumb.message,
      category: breadcrumb.category,
      level: breadcrumb.level as SeverityLevel,
      data: breadcrumb.data,
    });
  }

  public setUser(user: ErrorReport['user']): void {
    // Set user context for all future errors
    if (user) {
      Sentry.setUser({ id: user.id, email: user.email });
    }
  }

  public setTag(key: string, value: string): void {
    Sentry.setTag(key, value);
  }

  public setContext(name: string, context: Record<string, unknown>): void {
    Sentry.setContext(name, context);
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sendToSentry(report: ErrorReport): void {
    Sentry.withScope((scope) => {
      // Set error level
      scope.setLevel(report.context.level as SeverityLevel);

      // Set tags
      if (report.context.tags) {
        Object.entries(report.context.tags).forEach(([key, value]) => {
          scope.setTag(key, value);
        });
      }

      // Set user context
      if (report.user) {
        scope.setUser({ id: report.user.id, email: report.user.email });
      }

      // Set additional context
      scope.setContext('errorReport', {
        id: report.id,
        timestamp: report.timestamp,
        url: report.context.url,
        component: report.context.component,
      });

      // Set performance context if available
      if (report.performance) {
        scope.setContext('performance', report.performance);
      }

      // Capture the error
      const error = new Error(report.error.message);
      error.name = report.error.name;
      error.stack = report.error.stack;

      Sentry.captureException(error);
    });
  }

  private sendToAnalytics(report: ErrorReport): void {
    // Send to custom analytics service
    if (typeof window !== 'undefined' && window.performanceMonitor) {
      window.performanceMonitor.trackCustomEvent('error_captured', {
        errorId: report.id,
        errorMessage: report.error.message,
        errorName: report.error.name,
        level: report.context.level,
        component: report.context.component,
        url: report.context.url,
      });
    }

    // You can also send to other analytics services here
    // Example: Google Analytics, Mixpanel, etc.
  }

  public getReports(filters: {
    level?: ErrorReport['context']['level'];
    component?: string;
    since?: number;
    limit?: number;
  } = {}): ErrorReport[] {
    let filteredReports = [...this.reports];

    if (filters.level) {
      filteredReports = filteredReports.filter(r => r.context.level === filters.level);
    }

    if (filters.component) {
      filteredReports = filteredReports.filter(r => r.context.component === filters.component);
    }

    if (filters.since) {
      filteredReports = filteredReports.filter(r => r.timestamp >= filters.since);
    }

    if (filters.limit) {
      filteredReports = filteredReports.slice(-filters.limit);
    }

    return filteredReports.sort((a, b) => b.timestamp - a.timestamp);
  }

  public getErrorSummary(): {
    total: number;
    byLevel: Record<string, number>;
    byComponent: Record<string, number>;
    recent: ErrorReport[];
  } {
    const byLevel: Record<string, number> = {};
    const byComponent: Record<string, number> = {};

    this.reports.forEach(report => {
      byLevel[report.context.level] = (byLevel[report.context.level] || 0) + 1;
      
      const component = report.context.component || 'unknown';
      byComponent[component] = (byComponent[component] || 0) + 1;
    });

    return {
      total: this.reports.length,
      byLevel,
      byComponent,
      recent: this.getReports({ limit: 10 }),
    };
  }

  public exportReports(): string {
    const exportData = {
      reports: this.reports,
      summary: this.getErrorSummary(),
      exportTimestamp: Date.now(),
      version: '1.0.0',
    };

    return JSON.stringify(exportData, null, 2);
  }

  public clearReports(): void {
    this.reports = [];
    this.breadcrumbs = [];
    localStorage.removeItem('error_reports');
  }

  // Utility methods for common error scenarios
  public captureApiError(endpoint: string, status: number, message: string): string {
    return this.captureError(new Error(`API Error: ${message}`), {
      level: 'error',
      tags: {
        source: 'api',
        endpoint,
        status: String(status),
      },
    });
  }

  public captureUserAction(action: string, data?: BreadcrumbData): void {
    this.addBreadcrumb({
      message: `User action: ${action}`,
      category: 'user',
      level: 'info',
      data,
    });
  }

  public captureNavigation(from: string, to: string): void {
    this.addBreadcrumb({
      message: `Navigation: ${from} → ${to}`,
      category: 'navigation',
      level: 'info',
      data: { from, to },
    });
  }

  public capturePerformanceIssue(metric: string, value: number, threshold: number): string {
    return this.captureError(
      new Error(`Performance issue: ${metric} (${value}) exceeded threshold (${threshold})`),
      {
        level: 'warning',
        tags: {
          source: 'performance',
          metric,
          value: String(value),
          threshold: String(threshold),
        },
      }
    );
  }
}

// Export singleton instance
export const errorReporter = new ErrorReporter();

// React hook for error reporting
export function useErrorReporter() {
  const captureError = (error: Error, context?: Partial<ErrorReport['context']>) => {
    return errorReporter.captureError(error, context);
  };

  const captureMessage = (message: string, level?: ErrorReport['context']['level']) => {
    return errorReporter.captureMessage(message, level);
  };

  const addBreadcrumb = (message: string, category: string, data?: BreadcrumbData) => {
    errorReporter.addBreadcrumb({
      message,
      category,
      level: 'info',
      data,
    });
  };

  const captureUserAction = (action: string, data?: BreadcrumbData) => {
    errorReporter.captureUserAction(action, data);
  };

  return {
    captureError,
    captureMessage,
    addBreadcrumb,
    captureUserAction,
    getReports: errorReporter.getReports.bind(errorReporter),
    getSummary: errorReporter.getErrorSummary.bind(errorReporter),
  };
}