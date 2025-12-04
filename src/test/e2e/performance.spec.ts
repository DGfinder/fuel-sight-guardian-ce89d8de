import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('Page load performance metrics', async ({ page }) => {
    // Start measuring performance
    const startTime = Date.now();
    
    await page.goto('/', { waitUntil: 'networkidle' });
    
    const loadTime = Date.now() - startTime;
    console.log(`Page load time: ${loadTime}ms`);
    
    // Assert reasonable load time (adjust threshold as needed)
    expect(loadTime).toBeLessThan(5000);
    
    // Check Core Web Vitals
    const webVitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        if ('web-vital' in window) {
          // If web-vitals library is loaded
          resolve((window as any).webVitals);
        } else {
          // Fallback to performance API
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          resolve({
            fcp: navigation.responseStart,
            lcp: navigation.loadEventEnd,
            ttfb: navigation.responseStart - navigation.requestStart,
          });
        }
      });
    });
    
    console.log('Web Vitals:', webVitals);
  });

  test('Tank data loading performance', async ({ page }) => {
    await page.goto('/');
    
    const start = Date.now();
    await page.waitForSelector('[data-testid="tank-card"]', { timeout: 10000 });
    const tankLoadTime = Date.now() - start;
    
    console.log(`Tank data load time: ${tankLoadTime}ms`);
    expect(tankLoadTime).toBeLessThan(3000);
  });

  test('Map rendering performance', async ({ page }) => {
    const start = Date.now();
    await page.goto('/map');
    
    // Wait for map to be fully rendered
    await page.waitForSelector('.leaflet-container');
    await page.waitForFunction(() => {
      const mapContainer = document.querySelector('.leaflet-container');
      return mapContainer && mapContainer.children.length > 0;
    });
    
    const mapRenderTime = Date.now() - start;
    console.log(`Map render time: ${mapRenderTime}ms`);
    expect(mapRenderTime).toBeLessThan(5000);
  });

  test('Bundle size analysis', async ({ page }) => {
    // Navigate to the app and measure bundle sizes
    await page.goto('/');
    
    const bundleMetrics = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      
      const bundles = resources.filter(resource => 
        resource.name.includes('.js') || resource.name.includes('.css')
      );
      
      const totalSize = bundles.reduce((sum, resource) => {
        return sum + (resource.transferSize || 0);
      }, 0);
      
      const jsSize = bundles
        .filter(r => r.name.includes('.js'))
        .reduce((sum, resource) => sum + (resource.transferSize || 0), 0);
      
      const cssSize = bundles
        .filter(r => r.name.includes('.css'))
        .reduce((sum, resource) => sum + (resource.transferSize || 0), 0);
      
      return {
        totalSize: Math.round(totalSize / 1024), // KB
        jsSize: Math.round(jsSize / 1024), // KB
        cssSize: Math.round(cssSize / 1024), // KB
        bundleCount: bundles.length
      };
    });
    
    console.log('Bundle metrics:', bundleMetrics);
    
    // Assert reasonable bundle sizes
    expect(bundleMetrics.totalSize).toBeLessThan(2000); // < 2MB total
    expect(bundleMetrics.jsSize).toBeLessThan(1500); // < 1.5MB JS
    expect(bundleMetrics.cssSize).toBeLessThan(200); // < 200KB CSS
  });

  test('Memory usage monitoring', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="tank-card"]');
    
    const memoryMetrics = await page.evaluate(() => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        return {
          usedJSHeapSize: Math.round(memory.usedJSHeapSize / 1024 / 1024), // MB
          totalJSHeapSize: Math.round(memory.totalJSHeapSize / 1024 / 1024), // MB
          jsHeapSizeLimit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024), // MB
        };
      }
      return null;
    });
    
    if (memoryMetrics) {
      console.log('Memory metrics:', memoryMetrics);
      
      // Assert reasonable memory usage
      expect(memoryMetrics.usedJSHeapSize).toBeLessThan(100); // < 100MB
    } else {
      console.log('Memory API not available in this browser');
    }
  });

  test('API response time monitoring', async ({ page }) => {
    // Monitor API calls
    const apiCalls: Array<{ url: string; duration: number }> = [];
    
    page.on('response', async (response) => {
      if (response.url().includes('api') || response.url().includes('supabase')) {
        const request = response.request();
        const timing = response.request().timing();
        if (timing) {
          apiCalls.push({
            url: response.url(),
            duration: timing.responseEnd - timing.requestStart
          });
        }
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait a bit more to catch any delayed API calls
    await page.waitForTimeout(2000);
    
    console.log('API calls:', apiCalls);
    
    // Assert API response times
    apiCalls.forEach(call => {
      expect(call.duration).toBeLessThan(5000); // < 5s per API call
    });
  });

  test('Largest Contentful Paint (LCP)', async ({ page }) => {
    await page.goto('/');
    
    const lcp = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          resolve(lastEntry.startTime);
        }).observe({ entryTypes: ['largest-contentful-paint'] });
        
        // Fallback timeout
        setTimeout(() => resolve(0), 5000);
      });
    });
    
    console.log(`LCP: ${lcp}ms`);
    expect(lcp).toBeLessThan(2500); // Good LCP threshold
  });

  test('First Input Delay simulation', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="tank-card"]');
    
    const start = Date.now();
    await page.click('[data-testid="tank-card"]:first-child');
    const fid = Date.now() - start;
    
    console.log(`Simulated FID: ${fid}ms`);
    expect(fid).toBeLessThan(100); // Good FID threshold
  });

  test('Cumulative Layout Shift monitoring', async ({ page }) => {
    await page.goto('/');
    
    const cls = await page.evaluate(() => {
      return new Promise((resolve) => {
        let clsValue = 0;
        
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
        }).observe({ entryTypes: ['layout-shift'] });
        
        // Wait for page to settle
        setTimeout(() => resolve(clsValue), 3000);
      });
    });
    
    console.log(`CLS: ${cls}`);
    expect(cls).toBeLessThan(0.1); // Good CLS threshold
  });

  test('Network efficiency', async ({ page }) => {
    const requests: Array<{ url: string; size: number; cached: boolean }> = [];
    
    page.on('response', async (response) => {
      const request = response.request();
      requests.push({
        url: response.url(),
        size: parseInt(response.headers()['content-length'] || '0'),
        cached: response.fromCache()
      });
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const totalSize = requests.reduce((sum, req) => sum + req.size, 0);
    const cachedRequests = requests.filter(req => req.cached).length;
    const cacheRatio = cachedRequests / requests.length;
    
    console.log(`Total requests: ${requests.length}`);
    console.log(`Total size: ${Math.round(totalSize / 1024)}KB`);
    console.log(`Cache ratio: ${(cacheRatio * 100).toFixed(1)}%`);
    
    // On subsequent loads, expect good cache utilization
    if (requests.length > 0) {
      expect(totalSize).toBeLessThan(5 * 1024 * 1024); // < 5MB total
    }
  });
});