import { onCLS, onINP, onFCP, onLCP, onTTFB, type Metric } from 'web-vitals';

// Performance metrics interface
export interface PerformanceMetrics {
  // Core Web Vitals
  cls: number | null; // Cumulative Layout Shift
  fid: number | null; // First Input Delay
  fcp: number | null; // First Contentful Paint
  lcp: number | null; // Largest Contentful Paint
  ttfb: number | null; // Time to First Byte
  
  // Custom metrics
  pageLoadTime: number | null;
  domContentLoaded: number | null;
  resourceLoadTime: number | null;
  jsExecutionTime: number | null;
  
  // User interaction metrics
  userInteractions: number;
  errorCount: number;
  sessionDuration: number;
  
  // Device/browser info
  deviceType: 'desktop' | 'mobile' | 'tablet';
  connectionType: string;
  userAgent: string;
  
  // App-specific metrics
  tanksLoaded: number;
  apiResponseTime: number;
  realTimeUpdates: number;
}

export interface UserSession {
  sessionId: string;
  userId?: string;
  startTime: number;
  endTime?: number;
  pageViews: string[];
  interactions: Array<{
    type: string;
    timestamp: number;
    element?: string;
    duration?: number;
  }>;
  errors: Array<{
    message: string;
    stack?: string;
    timestamp: number;
    url: string;
  }>;
  performance: PerformanceMetrics;
}

class PerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {};
  private session: UserSession;
  private startTime: number;
  private isMonitoring: boolean = false;
  private observers: PerformanceObserver[] = [];

  constructor() {
    this.startTime = performance.now();
    this.session = this.initializeSession();
    this.startMonitoring();
  }

  private initializeSession(): UserSession {
    const sessionId = this.generateSessionId();
    return {
      sessionId,
      startTime: Date.now(),
      pageViews: [window.location.pathname],
      interactions: [],
      errors: [],
      performance: {} as PerformanceMetrics,
    };
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Monitor Core Web Vitals
    this.monitorWebVitals();
    
    // Monitor custom metrics
    this.monitorCustomMetrics();
    
    // Monitor user interactions
    this.monitorUserInteractions();
    
    // Monitor errors
    this.monitorErrors();
    
    // Monitor page navigation
    this.monitorNavigation();
    
    // Set up periodic reporting
    this.setupPeriodicReporting();
  }

  private monitorWebVitals(): void {
    onCLS((metric: Metric) => {
      this.metrics.cls = metric.value;
      this.reportMetric('CLS', metric.value);
    });

    onINP((metric: Metric) => {
      this.metrics.fid = metric.value;
      this.reportMetric('INP', metric.value);
    });

    onFCP((metric: Metric) => {
      this.metrics.fcp = metric.value;
      this.reportMetric('FCP', metric.value);
    });

    onLCP((metric: Metric) => {
      this.metrics.lcp = metric.value;
      this.reportMetric('LCP', metric.value);
    });

    onTTFB((metric: Metric) => {
      this.metrics.ttfb = metric.value;
      this.reportMetric('TTFB', metric.value);
    });
  }

  private monitorCustomMetrics(): void {
    // Page load metrics
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      this.metrics.pageLoadTime = navigation.loadEventEnd - navigation.fetchStart;
      this.metrics.domContentLoaded = navigation.domContentLoadedEventEnd - navigation.fetchStart;
      this.metrics.resourceLoadTime = navigation.loadEventEnd - navigation.domContentLoadedEventEnd;
    });

    // Monitor JavaScript execution time
    if ('PerformanceObserver' in window) {
      const measureObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        let totalJSTime = 0;
        
        entries.forEach((entry) => {
          if (entry.entryType === 'measure') {
            totalJSTime += entry.duration;
          }
        });
        
        this.metrics.jsExecutionTime = totalJSTime;
      });
      
      measureObserver.observe({ entryTypes: ['measure'] });
      this.observers.push(measureObserver);
    }

    // Monitor resource loading
    if ('PerformanceObserver' in window) {
      const resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const slowResources = entries.filter((entry) => entry.duration > 1000);
        
        if (slowResources.length > 0) {
          this.reportSlowResources(slowResources);
        }
      });
      
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.push(resourceObserver);
    }
  }

  private monitorUserInteractions(): void {
    // Click tracking
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      this.recordInteraction('click', {
        element: this.getElementSelector(target),
        timestamp: Date.now(),
      });
    });

    // Form submissions
    document.addEventListener('submit', (event) => {
      const target = event.target as HTMLFormElement;
      this.recordInteraction('form_submit', {
        element: this.getElementSelector(target),
        timestamp: Date.now(),
      });
    });

    // Route changes (for SPA)
    let currentPath = window.location.pathname;
    const checkRouteChange = () => {
      if (window.location.pathname !== currentPath) {
        currentPath = window.location.pathname;
        this.session.pageViews.push(currentPath);
        this.recordInteraction('page_view', {
          element: currentPath,
          timestamp: Date.now(),
        });
      }
    };

    // Check for route changes periodically
    setInterval(checkRouteChange, 1000);
  }

  private monitorErrors(): void {
    // JavaScript errors
    window.addEventListener('error', (event) => {
      this.recordError({
        message: event.message,
        stack: event.error?.stack,
        url: event.filename,
        timestamp: Date.now(),
      });
    });

    // Promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.recordError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        url: window.location.href,
        timestamp: Date.now(),
      });
    });
  }

  private monitorNavigation(): void {
    // Monitor browser navigation performance
    if ('PerformanceObserver' in window) {
      const navObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'navigation') {
            const nav = entry as PerformanceNavigationTiming;
            this.reportNavigationMetrics(nav);
          }
        });
      });
      
      navObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navObserver);
    }
  }

  private setupPeriodicReporting(): void {
    // Report metrics every 30 seconds
    setInterval(() => {
      this.reportSessionMetrics();
    }, 30000);

    // Report on page unload
    window.addEventListener('beforeunload', () => {
      this.finalizeSession();
    });

    // Report on visibility change (user switches tabs)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.reportSessionMetrics();
      }
    });
  }

  private recordInteraction(type: string, data: any): void {
    this.session.interactions.push({
      type,
      timestamp: data.timestamp,
      element: data.element,
      duration: data.duration,
    });
    
    this.metrics.userInteractions = (this.metrics.userInteractions || 0) + 1;
  }

  private recordError(error: any): void {
    this.session.errors.push(error);
    this.metrics.errorCount = (this.metrics.errorCount || 0) + 1;
  }

  private getElementSelector(element: HTMLElement): string {
    if (element.id) return `#${element.id}`;
    // Guard for non-string className (SVGElement, components etc.)
    const className = typeof (element as any).className === 'string' ? (element as any).className : '';
    if (className) return `.${className.split(' ')[0]}`;
    return element.tagName ? element.tagName.toLowerCase() : 'unknown';
  }

  private reportMetric(name: string, value: number): void {
    // Send to analytics service (implement based on your needs)
    console.log(`Performance Metric - ${name}: ${value}`);
    
    // You can integrate with services like:
    // - Google Analytics
    // - Sentry Performance
    // - Custom analytics endpoint
    
    this.sendToAnalytics({
      type: 'performance_metric',
      metric: name,
      value,
      sessionId: this.session.sessionId,
      timestamp: Date.now(),
      url: window.location.href,
    });
  }

  private reportSlowResources(resources: PerformanceEntry[]): void {
    resources.forEach((resource) => {
      this.sendToAnalytics({
        type: 'slow_resource',
        name: resource.name,
        duration: resource.duration,
        sessionId: this.session.sessionId,
        timestamp: Date.now(),
      });
    });
  }

  private reportNavigationMetrics(nav: PerformanceNavigationTiming): void {
    const metrics = {
      dns: nav.domainLookupEnd - nav.domainLookupStart,
      tcp: nav.connectEnd - nav.connectStart,
      ssl: nav.connectEnd - nav.secureConnectionStart,
      ttfb: nav.responseStart - nav.requestStart,
      download: nav.responseEnd - nav.responseStart,
      domParse: nav.domContentLoadedEventStart - nav.responseEnd,
      domReady: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
      pageLoad: nav.loadEventEnd - nav.loadEventStart,
    };

    this.sendToAnalytics({
      type: 'navigation_metrics',
      metrics,
      sessionId: this.session.sessionId,
      timestamp: Date.now(),
    });
  }

  private reportSessionMetrics(): void {
    this.session.performance = {
      ...this.metrics,
      sessionDuration: Date.now() - this.session.startTime,
      deviceType: this.getDeviceType(),
      connectionType: this.getConnectionType(),
      userAgent: navigator.userAgent,
    } as PerformanceMetrics;

    this.sendToAnalytics({
      type: 'session_metrics',
      session: this.session,
      timestamp: Date.now(),
    });
  }

  private finalizeSession(): void {
    this.session.endTime = Date.now();
    this.reportSessionMetrics();
    
    // Cleanup observers
    this.observers.forEach(observer => observer.disconnect());
  }

  private getDeviceType(): 'desktop' | 'mobile' | 'tablet' {
    const userAgent = navigator.userAgent;
    if (/tablet|ipad|playbook|silk/i.test(userAgent)) return 'tablet';
    if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent)) return 'mobile';
    return 'desktop';
  }

  private getConnectionType(): string {
    // @ts-expect-error - Navigator connection API not fully typed
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return connection?.effectiveType || 'unknown';
  }

  private sendToAnalytics(data: any): void {
    // In production, you would send this to your analytics service
    // For now, we'll just log it and store in localStorage for demo
    
    if (import.meta.env.DEV) {
      console.log('Performance Analytics:', JSON.stringify(data));
    }

    // Store in localStorage (in production, send to analytics service)
    try {
      const existingData = JSON.parse(localStorage.getItem('performance_analytics') || '[]');
      existingData.push(data);
      
      // Keep only last 100 entries to prevent localStorage bloat
      if (existingData.length > 100) {
        existingData.splice(0, existingData.length - 100);
      }
      
      localStorage.setItem('performance_analytics', JSON.stringify(existingData));
    } catch (error) {
      console.error('Failed to store analytics data:', error);
    }
  }

  // Public methods for manual tracking
  public trackCustomEvent(eventName: string, data?: any): void {
    this.sendToAnalytics({
      type: 'custom_event',
      eventName,
      data,
      sessionId: this.session.sessionId,
      timestamp: Date.now(),
      url: window.location.href,
    });
  }

  public trackTankLoad(count: number, loadTime: number): void {
    this.metrics.tanksLoaded = count;
    this.sendToAnalytics({
      type: 'tank_load',
      count,
      loadTime,
      sessionId: this.session.sessionId,
      timestamp: Date.now(),
    });
  }

  public trackApiResponse(endpoint: string, responseTime: number, success: boolean): void {
    this.metrics.apiResponseTime = responseTime;
    this.sendToAnalytics({
      type: 'api_response',
      endpoint,
      responseTime,
      success,
      sessionId: this.session.sessionId,
      timestamp: Date.now(),
    });
  }

  public getMetrics(): Partial<PerformanceMetrics> {
    return { ...this.metrics };
  }

  public getSession(): UserSession {
    return { ...this.session };
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for performance monitoring
export function usePerformanceMonitor() {
  const trackEvent = (eventName: string, data?: any) => {
    performanceMonitor.trackCustomEvent(eventName, data);
  };

  const trackTankLoad = (count: number, loadTime: number) => {
    performanceMonitor.trackTankLoad(count, loadTime);
  };

  const trackApiResponse = (endpoint: string, responseTime: number, success: boolean) => {
    performanceMonitor.trackApiResponse(endpoint, responseTime, success);
  };

  const getMetrics = () => performanceMonitor.getMetrics();
  const getSession = () => performanceMonitor.getSession();

  return {
    trackEvent,
    trackTankLoad,
    trackApiResponse,
    getMetrics,
    getSession,
  };
}