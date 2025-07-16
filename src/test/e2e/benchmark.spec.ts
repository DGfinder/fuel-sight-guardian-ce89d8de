import { test, expect } from '@playwright/test';
import { performanceBenchmark, commonBenchmarks } from '../performance-benchmarks';

test.describe('Performance Benchmarks', () => {
  test('Run comprehensive performance benchmarks', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Inject performance benchmark utilities into the page
    await page.addScriptTag({
      content: `
        window.performanceBenchmarks = {
          async runBenchmarks() {
            const results = [];
            
            // Array processing benchmark
            console.log('Running array processing benchmark...');
            const arrayStart = performance.now();
            const data = Array.from({ length: 10000 }, (_, i) => i);
            const processed = data.map(x => x * 2).filter(x => x % 4 === 0);
            const arrayEnd = performance.now();
            results.push({
              name: 'Array Processing (10k items)',
              duration: arrayEnd - arrayStart,
              description: 'Map, filter operations on large array'
            });

            // Object creation benchmark
            console.log('Running object creation benchmark...');
            const objStart = performance.now();
            const objects = [];
            for (let i = 0; i < 1000; i++) {
              objects.push({
                id: i,
                name: \`Item \${i}\`,
                timestamp: Date.now(),
                data: { value: Math.random() }
              });
            }
            const objEnd = performance.now();
            results.push({
              name: 'Object Creation (1k objects)',
              duration: objEnd - objStart,
              description: 'Creating complex objects in loop'
            });

            // DOM manipulation benchmark
            console.log('Running DOM manipulation benchmark...');
            const domStart = performance.now();
            for (let i = 0; i < 100; i++) {
              const div = document.createElement('div');
              div.innerHTML = '<span>Test</span>';
              div.style.display = 'block';
              div.classList.add('test-class');
              document.body.appendChild(div);
              document.body.removeChild(div);
            }
            const domEnd = performance.now();
            results.push({
              name: 'DOM Manipulation (100 operations)',
              duration: domEnd - domStart,
              description: 'Create, modify, and remove DOM elements'
            });

            // JSON serialization benchmark
            console.log('Running JSON serialization benchmark...');
            const jsonData = {
              tanks: Array.from({ length: 100 }, (_, i) => ({
                id: i,
                name: \`Tank \${i}\`,
                fuelLevel: Math.random() * 100,
                coordinates: [Math.random() * 180, Math.random() * 90],
                readings: Array.from({ length: 10 }, () => ({
                  timestamp: Date.now(),
                  value: Math.random() * 100
                }))
              }))
            };
            
            const jsonStart = performance.now();
            for (let i = 0; i < 100; i++) {
              const serialized = JSON.stringify(jsonData);
              JSON.parse(serialized);
            }
            const jsonEnd = performance.now();
            results.push({
              name: 'JSON Serialization (100 iterations)',
              duration: jsonEnd - jsonStart,
              description: 'Serialize and parse complex object structure'
            });

            // Regex operations benchmark
            console.log('Running regex benchmark...');
            const text = 'This is a test string with email@example.com and phone 123-456-7890';
            const emailRegex = /\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b/g;
            const phoneRegex = /\\b\\d{3}-\\d{3}-\\d{4}\\b/g;
            
            const regexStart = performance.now();
            for (let i = 0; i < 1000; i++) {
              emailRegex.test(text);
              phoneRegex.test(text);
              text.match(emailRegex);
              text.match(phoneRegex);
            }
            const regexEnd = performance.now();
            results.push({
              name: 'Regex Operations (1k iterations)',
              duration: regexEnd - regexStart,
              description: 'Email and phone number pattern matching'
            });

            return results;
          }
        };
      `
    });

    // Run benchmarks in the browser context
    const benchmarkResults = await page.evaluate(() => {
      return window.performanceBenchmarks.runBenchmarks();
    });

    console.log('Benchmark Results:');
    benchmarkResults.forEach((result: any) => {
      console.log(`${result.name}: ${result.duration.toFixed(2)}ms - ${result.description}`);
    });

    // Assert performance thresholds
    benchmarkResults.forEach((result: any) => {
      switch (result.name) {
        case 'Array Processing (10k items)':
          expect(result.duration).toBeLessThan(100); // Should be under 100ms
          break;
        case 'Object Creation (1k objects)':
          expect(result.duration).toBeLessThan(50); // Should be under 50ms
          break;
        case 'DOM Manipulation (100 operations)':
          expect(result.duration).toBeLessThan(100); // Should be under 100ms
          break;
        case 'JSON Serialization (100 iterations)':
          expect(result.duration).toBeLessThan(200); // Should be under 200ms
          break;
        case 'Regex Operations (1k iterations)':
          expect(result.duration).toBeLessThan(50); // Should be under 50ms
          break;
      }
    });

    // Generate performance report
    const report = {
      timestamp: new Date().toISOString(),
      browser: await page.evaluate(() => navigator.userAgent),
      results: benchmarkResults,
      summary: {
        totalTests: benchmarkResults.length,
        totalDuration: benchmarkResults.reduce((sum: number, r: any) => sum + r.duration, 0),
        averageDuration: benchmarkResults.reduce((sum: number, r: any) => sum + r.duration, 0) / benchmarkResults.length
      }
    };

    console.log('Performance Report:', JSON.stringify(report, null, 2));
  });

  test('Tank data processing performance', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="tank-card"]', { timeout: 15000 });

    const processingMetrics = await page.evaluate(() => {
      const tanks = Array.from(document.querySelectorAll('[data-testid="tank-card"]'));
      
      const start = performance.now();
      
      // Simulate heavy data processing
      const processedData = tanks.map(tank => {
        const text = tank.textContent || '';
        const fuelLevel = text.match(/(\d+(?:\.\d+)?)%/)?.[1];
        const status = text.toLowerCase().includes('critical') ? 'critical' :
                      text.toLowerCase().includes('low') ? 'low' : 'normal';
        
        return {
          fuelLevel: parseFloat(fuelLevel || '0'),
          status,
          element: tank,
          processed: true
        };
      });
      
      // Sort by fuel level
      processedData.sort((a, b) => a.fuelLevel - b.fuelLevel);
      
      // Filter critical tanks
      const criticalTanks = processedData.filter(tank => tank.status === 'critical');
      
      const end = performance.now();
      
      return {
        duration: end - start,
        tanksProcessed: processedData.length,
        criticalTanks: criticalTanks.length,
        processingRate: processedData.length / (end - start) * 1000 // tanks per second
      };
    });

    console.log('Tank Processing Metrics:', processingMetrics);
    
    // Assert reasonable processing performance
    expect(processingMetrics.duration).toBeLessThan(100); // Should process under 100ms
    expect(processingMetrics.processingRate).toBeGreaterThan(50); // Should process 50+ tanks per second
  });

  test('Map rendering performance', async ({ page }) => {
    const start = Date.now();
    await page.goto('/map');
    
    // Wait for map to be fully rendered with markers
    await page.waitForSelector('.leaflet-container');
    await page.waitForFunction(() => {
      const markers = document.querySelectorAll('.leaflet-marker-icon');
      return markers.length > 0;
    }, { timeout: 15000 });

    const renderTime = Date.now() - start;
    
    // Measure map interaction performance
    const interactionMetrics = await page.evaluate(() => {
      const map = document.querySelector('.leaflet-container');
      if (!map) return null;

      const measurements = [];
      
      // Simulate zoom operations
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        
        // Trigger zoom event
        const zoomEvent = new WheelEvent('wheel', {
          deltaY: i % 2 === 0 ? -100 : 100,
          bubbles: true
        });
        map.dispatchEvent(zoomEvent);
        
        // Wait for next frame
        requestAnimationFrame(() => {
          const end = performance.now();
          measurements.push(end - start);
        });
      }
      
      return {
        averageZoomTime: measurements.reduce((sum, time) => sum + time, 0) / measurements.length,
        maxZoomTime: Math.max(...measurements),
        minZoomTime: Math.min(...measurements)
      };
    });

    console.log(`Map render time: ${renderTime}ms`);
    console.log('Map interaction metrics:', interactionMetrics);
    
    // Assert performance thresholds
    expect(renderTime).toBeLessThan(8000); // Map should render within 8 seconds
    
    if (interactionMetrics) {
      expect(interactionMetrics.averageZoomTime).toBeLessThan(50); // Zoom should be responsive
    }
  });

  test('Table sorting and filtering performance', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="tank-table"]', { timeout: 10000 });

    // Measure sorting performance
    const sortingMetrics = await page.evaluate(() => {
      const table = document.querySelector('[data-testid="tank-table"]');
      if (!table) return null;

      const sortButton = table.querySelector('[data-testid="sort-fuel-level"]') as HTMLElement;
      if (!sortButton) return null;

      const measurements = [];
      
      // Perform multiple sort operations
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        sortButton.click();
        
        // Wait for sort to complete (assume it's synchronous)
        const end = performance.now();
        measurements.push(end - start);
      }
      
      return {
        averageSortTime: measurements.reduce((sum, time) => sum + time, 0) / measurements.length,
        maxSortTime: Math.max(...measurements),
        totalOperations: measurements.length
      };
    });

    console.log('Table sorting metrics:', sortingMetrics);
    
    if (sortingMetrics) {
      expect(sortingMetrics.averageSortTime).toBeLessThan(100); // Sorting should be under 100ms
    }
  });

  test('Memory usage monitoring during heavy operations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const memoryMetrics = await page.evaluate(() => {
      if (!('memory' in performance)) {
        return null;
      }

      const measurements = [];
      const memory = (performance as any).memory;
      
      // Initial measurement
      measurements.push({
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        timestamp: Date.now(),
        operation: 'initial'
      });

      // Perform memory-intensive operations
      const largeArrays = [];
      for (let i = 0; i < 10; i++) {
        // Create large data structures
        const largeArray = new Array(100000).fill(0).map((_, index) => ({
          id: index,
          data: Math.random().toString(36),
          timestamp: Date.now(),
          nested: {
            value: Math.random(),
            text: `Item ${index}`,
            more: new Array(10).fill('data')
          }
        }));
        
        largeArrays.push(largeArray);
        
        measurements.push({
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          timestamp: Date.now(),
          operation: `iteration_${i}`
        });
      }

      // Force garbage collection if available
      if ('gc' in window) {
        (window as any).gc();
      }

      // Final measurement
      measurements.push({
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        timestamp: Date.now(),
        operation: 'final'
      });

      return {
        measurements,
        peakMemory: Math.max(...measurements.map(m => m.used)),
        memoryGrowth: measurements[measurements.length - 1].used - measurements[0].used,
        operationsCount: largeArrays.length
      };
    });

    if (memoryMetrics) {
      console.log('Memory usage metrics:', {
        peakMemoryMB: Math.round(memoryMetrics.peakMemory / 1024 / 1024),
        memoryGrowthMB: Math.round(memoryMetrics.memoryGrowth / 1024 / 1024),
        operationsCount: memoryMetrics.operationsCount
      });

      // Assert reasonable memory usage
      const peakMemoryMB = memoryMetrics.peakMemory / 1024 / 1024;
      expect(peakMemoryMB).toBeLessThan(200); // Should stay under 200MB
    } else {
      console.log('Memory API not available in this browser');
    }
  });
});