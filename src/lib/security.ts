/**
 * Security utilities and Content Security Policy management
 */

export interface CSPDirectives {
  'default-src'?: string[];
  'script-src'?: string[];
  'style-src'?: string[];
  'img-src'?: string[];
  'connect-src'?: string[];
  'font-src'?: string[];
  'object-src'?: string[];
  'media-src'?: string[];
  'frame-src'?: string[];
  'worker-src'?: string[];
  'child-src'?: string[];
  'form-action'?: string[];
  'base-uri'?: string[];
  'manifest-src'?: string[];
}

export class SecurityManager {
  private static instance: SecurityManager;
  private cspViolations: Array<SecurityPolicyViolationEvent> = [];
  private securityMetrics = {
    cspViolations: 0,
    xssAttempts: 0,
    suspiciousActivity: 0,
    blockedRequests: 0
  };

  private constructor() {
    this.initializeCSPReporting();
    this.setupSecurityEventListeners();
  }

  static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  private initializeCSPReporting(): void {
    // Listen for CSP violations
    document.addEventListener('securitypolicyviolation', (event: SecurityPolicyViolationEvent) => {
      this.handleCSPViolation(event);
    });
  }

  private setupSecurityEventListeners(): void {
    // Monitor for potential XSS attempts
    document.addEventListener('DOMContentLoaded', () => {
      this.scanForSuspiciousContent();
    });

    // Monitor console for security-related errors, but avoid interfering with React errors
    const originalError = console.error;
    console.error = (...args) => {
      // Call original error first to ensure normal error logging works
      originalError.apply(console, args);
      
      // Only analyze if it looks like a security-related error
      const firstArg = args[0];
      const errorString = typeof firstArg === 'string' ? firstArg : String(firstArg);
      
      // Only monitor specific security-related patterns to avoid interfering with React errors
      if (this.isSecurityRelatedError(errorString)) {
        this.analyzeConsoleError(args);
      }
    };
  }

  private isSecurityRelatedError(errorString: string): boolean {
    const securityPatterns = [
      'csp', 'content security policy', 'blocked uri', 'refused to execute',
      'mixed content', 'certificate', 'ssl', 'tls', 'cors', 'cross-origin',
      'xss', 'injection', 'script injection', 'unsafe-eval', 'unsafe-inline'
    ];
    
    const lowerError = errorString.toLowerCase();
    return securityPatterns.some(pattern => lowerError.includes(pattern));
  }

  private handleCSPViolation(event: SecurityPolicyViolationEvent): void {
    this.cspViolations.push(event);
    this.securityMetrics.cspViolations++;

    const violation = {
      directive: event.violatedDirective,
      blockedURI: event.blockedURI,
      documentURI: event.documentURI,
      originalPolicy: event.originalPolicy,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('CSP Violation:', violation);
    }

    // Report to monitoring service
    this.reportSecurityEvent('csp_violation', violation);
  }

  private scanForSuspiciousContent(): void {
    // Check for inline scripts that shouldn't be there
    const inlineScripts = document.querySelectorAll('script:not([src])');
    inlineScripts.forEach(script => {
      const content = script.textContent || '';
      if (this.detectSuspiciousScript(content)) {
        this.securityMetrics.xssAttempts++;
        this.reportSecurityEvent('suspicious_script', {
          content: content.substring(0, 200),
          location: script.parentElement?.tagName || 'unknown'
        });
      }
    });

    // Check for suspicious attributes
    const allElements = document.querySelectorAll('*');
    allElements.forEach(element => {
      Array.from(element.attributes).forEach(attr => {
        if (this.detectSuspiciousAttribute(attr.name, attr.value)) {
          this.securityMetrics.suspiciousActivity++;
          this.reportSecurityEvent('suspicious_attribute', {
            element: element.tagName,
            attribute: attr.name,
            value: attr.value.substring(0, 100)
          });
        }
      });
    });
  }

  private detectSuspiciousScript(content: string): boolean {
    const suspiciousPatterns = [
      /eval\s*\(/i,
      /document\.write\s*\(/i,
      /innerHTML\s*=.*<script/i,
      /javascript:/i,
      /data:text\/html/i,
      /vbscript:/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(content));
  }

  private detectSuspiciousAttribute(name: string, value: string): boolean {
    const suspiciousPatterns = [
      /^on/i, // Event handlers like onclick, onload
      /javascript:/i,
      /vbscript:/i,
      /data:text\/html/i
    ];

    const suspiciousAttributes = ['srcdoc'];

    return suspiciousAttributes.includes(name.toLowerCase()) ||
           suspiciousPatterns.some(pattern => pattern.test(value));
  }

  private analyzeConsoleError(args: any[]): void {
    const errorMessage = args.join(' ').toLowerCase();
    const securityKeywords = [
      'blocked by content security policy',
      'unsafe-eval',
      'unsafe-inline',
      'mixed content',
      'insecure request'
    ];

    if (securityKeywords.some(keyword => errorMessage.includes(keyword))) {
      this.securityMetrics.blockedRequests++;
    }
  }

  private reportSecurityEvent(type: string, data: any): void {
    // Send to monitoring service
    if (typeof window !== 'undefined' && (window as any).performanceMonitor) {
      (window as any).performanceMonitor.trackCustomEvent(`security_${type}`, {
        ...data,
        timestamp: Date.now(),
        url: window.location.href
      });
    }

    // Store locally for analysis
    const events = JSON.parse(localStorage.getItem('security_events') || '[]');
    events.push({
      type,
      data,
      timestamp: Date.now()
    });

    // Keep only recent events (last 100)
    if (events.length > 100) {
      events.splice(0, events.length - 100);
    }

    localStorage.setItem('security_events', JSON.stringify(events));
  }

  public getSecurityMetrics() {
    return {
      ...this.securityMetrics,
      recentViolations: this.cspViolations.slice(-10),
      securityScore: this.calculateSecurityScore()
    };
  }

  private calculateSecurityScore(): number {
    // Calculate a security score based on violations
    const baseScore = 100;
    const violations = this.securityMetrics.cspViolations;
    const xssAttempts = this.securityMetrics.xssAttempts;
    const suspiciousActivity = this.securityMetrics.suspiciousActivity;

    const penalty = (violations * 5) + (xssAttempts * 10) + (suspiciousActivity * 3);
    return Math.max(0, baseScore - penalty);
  }

  public sanitizeHTML(html: string): string {
    // Create a temporary div to parse HTML
    const temp = document.createElement('div');
    temp.textContent = html;
    return temp.innerHTML;
  }

  public sanitizeURL(url: string): string {
    try {
      const parsed = new URL(url);
      // Only allow http, https, and data protocols for images
      if (['http:', 'https:', 'data:'].includes(parsed.protocol)) {
        return url;
      }
      return '';
    } catch {
      return '';
    }
  }

  public validateInput(input: string, type: 'email' | 'url' | 'text' = 'text'): boolean {
    const patterns = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      url: /^https?:\/\/[^\s<>"']+$/,
      text: /^[^<>'"&]*$/ // Basic XSS prevention
    };

    return patterns[type].test(input);
  }

  public generateNonce(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
  }

  public createCSPHeader(directives: CSPDirectives): string {
    const cspParts: string[] = [];

    Object.entries(directives).forEach(([directive, sources]) => {
      if (sources && sources.length > 0) {
        cspParts.push(`${directive} ${sources.join(' ')}`);
      }
    });

    return cspParts.join('; ');
  }

  public getRecommendedCSP(): CSPDirectives {
    return {
      'default-src': ["'self'"],
      'script-src': [
        "'self'",
        "'unsafe-inline'", // Required for Vite in development
        "'unsafe-eval'", // Required for development and some libraries
        'https://js.sentry-cdn.com',
        'https://browser.sentry-cdn.com'
      ],
      'style-src': [
        "'self'",
        "'unsafe-inline'", // Required for CSS-in-JS
        'https://fonts.googleapis.com'
      ],
      'img-src': [
        "'self'",
        'data:',
        'https:',
        'blob:'
      ],
      'connect-src': [
        "'self'",
        'https://*.supabase.co',
        'wss://*.supabase.co',
        'https://o4507869648691200.ingest.us.sentry.io'
      ],
      'font-src': [
        "'self'",
        'https://fonts.gstatic.com'
      ],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'manifest-src': ["'self'"]
    };
  }

  public exportSecurityReport(): string {
    const events = JSON.parse(localStorage.getItem('security_events') || '[]');
    const report = {
      timestamp: new Date().toISOString(),
      metrics: this.getSecurityMetrics(),
      recentEvents: events.slice(-20),
      recommendations: this.getSecurityRecommendations()
    };

    return JSON.stringify(report, null, 2);
  }

  private getSecurityRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.securityMetrics.cspViolations > 0) {
      recommendations.push('Review and tighten Content Security Policy directives');
    }

    if (this.securityMetrics.xssAttempts > 0) {
      recommendations.push('Implement additional input validation and output encoding');
    }

    if (this.securityMetrics.suspiciousActivity > 5) {
      recommendations.push('Consider implementing additional client-side security monitoring');
    }

    if (recommendations.length === 0) {
      recommendations.push('Security posture appears good - continue monitoring');
    }

    return recommendations;
  }
}

// Export singleton instance
export const securityManager = SecurityManager.getInstance();

// Hook for React components
export function useSecurityMonitor() {
  const getMetrics = () => securityManager.getSecurityMetrics();
  const sanitizeHTML = (html: string) => securityManager.sanitizeHTML(html);
  const sanitizeURL = (url: string) => securityManager.sanitizeURL(url);
  const validateInput = (input: string, type?: 'email' | 'url' | 'text') => 
    securityManager.validateInput(input, type);

  return {
    getMetrics,
    sanitizeHTML,
    sanitizeURL,
    validateInput,
    exportReport: () => securityManager.exportSecurityReport()
  };
}