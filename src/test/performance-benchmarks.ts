import { performance } from 'perf_hooks';

export interface BenchmarkResult {
  name: string;
  duration: number;
  iterations: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  ops: number; // operations per second
}

export class PerformanceBenchmark {
  private results: BenchmarkResult[] = [];

  async benchmark(
    name: string,
    fn: () => Promise<void> | void,
    options: {
      iterations?: number;
      warmup?: number;
      timeout?: number;
    } = {}
  ): Promise<BenchmarkResult> {
    const {
      iterations = 100,
      warmup = 10,
      timeout = 30000
    } = options;

    console.log(`🏃 Running benchmark: ${name}`);

    // Warmup runs
    for (let i = 0; i < warmup; i++) {
      await fn();
    }

    const durations: number[] = [];
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      // Check timeout
      if (performance.now() - startTime > timeout) {
        throw new Error(`Benchmark "${name}" timed out after ${timeout}ms`);
      }

      const iterationStart = performance.now();
      await fn();
      const iterationEnd = performance.now();
      
      durations.push(iterationEnd - iterationStart);
    }

    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const avgDuration = totalDuration / iterations;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    const ops = 1000 / avgDuration; // operations per second

    const result: BenchmarkResult = {
      name,
      duration: totalDuration,
      iterations,
      avgDuration,
      minDuration,
      maxDuration,
      ops
    };

    this.results.push(result);
    
    console.log(`✅ ${name}: ${avgDuration.toFixed(2)}ms avg (${ops.toFixed(2)} ops/s)`);
    
    return result;
  }

  getResults(): BenchmarkResult[] {
    return [...this.results];
  }

  generateReport(): string {
    const report = [
      '# Performance Benchmark Report',
      '',
      `Generated at: ${new Date().toISOString()}`,
      '',
      '## Results',
      '',
      '| Benchmark | Avg Duration | Min | Max | Ops/sec | Iterations |',
      '|-----------|--------------|-----|-----|---------|------------|'
    ];

    this.results.forEach(result => {
      report.push(
        `| ${result.name} | ${result.avgDuration.toFixed(2)}ms | ${result.minDuration.toFixed(2)}ms | ${result.maxDuration.toFixed(2)}ms | ${result.ops.toFixed(2)} | ${result.iterations} |`
      );
    });

    report.push('');
    report.push('## Analysis');
    report.push('');

    // Find slowest operations
    const slowest = [...this.results].sort((a, b) => b.avgDuration - a.avgDuration);
    if (slowest.length > 0) {
      report.push('### Slowest Operations');
      slowest.slice(0, 3).forEach((result, index) => {
        report.push(`${index + 1}. ${result.name}: ${result.avgDuration.toFixed(2)}ms`);
      });
      report.push('');
    }

    // Find fastest operations
    const fastest = [...this.results].sort((a, b) => a.avgDuration - b.avgDuration);
    if (fastest.length > 0) {
      report.push('### Fastest Operations');
      fastest.slice(0, 3).forEach((result, index) => {
        report.push(`${index + 1}. ${result.name}: ${result.avgDuration.toFixed(2)}ms`);
      });
      report.push('');
    }

    return report.join('\n');
  }

  clear(): void {
    this.results = [];
  }

  // Static utility methods for common performance tests
  static async measureMemoryUsage(): Promise<{ used: number; total: number; limit: number } | null> {
    if (typeof window !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024), // MB
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024), // MB
        limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024), // MB
      };
    }
    return null;
  }

  static async measureRenderTime(element: HTMLElement): Promise<number> {
    return new Promise(resolve => {
      const observer = new MutationObserver(() => {
        observer.disconnect();
        requestAnimationFrame(() => {
          const endTime = performance.now();
          resolve(endTime);
        });
      });

      const startTime = performance.now();
      observer.observe(element, { childList: true, subtree: true });
      
      // Fallback timeout
      setTimeout(() => {
        observer.disconnect();
        resolve(performance.now());
      }, 1000);
    }).then(endTime => endTime - performance.now());
  }

  static async measureComponentMount(
    mountFn: () => void,
    unmountFn: () => void
  ): Promise<{ mount: number; unmount: number }> {
    const mountStart = performance.now();
    mountFn();
    const mountEnd = performance.now();
    
    const unmountStart = performance.now();
    unmountFn();
    const unmountEnd = performance.now();
    
    return {
      mount: mountEnd - mountStart,
      unmount: unmountEnd - unmountStart
    };
  }

  static async measureDataProcessing<T>(
    data: T[],
    processFn: (item: T) => void
  ): Promise<{ total: number; perItem: number }> {
    const start = performance.now();
    
    data.forEach(processFn);
    
    const end = performance.now();
    const total = end - start;
    const perItem = total / data.length;
    
    return { total, perItem };
  }
}

// Pre-configured benchmark instance
export const performanceBenchmark = new PerformanceBenchmark();

// Common benchmark tests
export const commonBenchmarks = {
  async arrayProcessing(size: number = 10000): Promise<BenchmarkResult> {
    const data = Array.from({ length: size }, (_, i) => i);
    
    return performanceBenchmark.benchmark('Array Processing', () => {
      return data.map(x => x * 2).filter(x => x % 4 === 0).reduce((sum, x) => sum + x, 0);
    });
  },

  async objectCreation(count: number = 1000): Promise<BenchmarkResult> {
    return performanceBenchmark.benchmark('Object Creation', () => {
      const objects = [];
      for (let i = 0; i < count; i++) {
        objects.push({
          id: i,
          name: `Item ${i}`,
          timestamp: Date.now(),
          data: { value: Math.random() }
        });
      }
      return objects;
    });
  },

  async domManipulation(): Promise<BenchmarkResult> {
    return performanceBenchmark.benchmark('DOM Manipulation', () => {
      const div = document.createElement('div');
      div.innerHTML = '<span>Test</span>';
      div.style.display = 'block';
      div.style.width = '100px';
      div.classList.add('test-class');
      document.body.appendChild(div);
      document.body.removeChild(div);
    });
  },

  async jsonSerialization(data: any): Promise<BenchmarkResult> {
    return performanceBenchmark.benchmark('JSON Serialization', () => {
      const serialized = JSON.stringify(data);
      return JSON.parse(serialized);
    });
  },

  async regexOperations(text: string, pattern: RegExp): Promise<BenchmarkResult> {
    return performanceBenchmark.benchmark('Regex Operations', () => {
      return pattern.test(text) && text.match(pattern);
    });
  }
};

// React-specific benchmarks
export const reactBenchmarks = {
  async componentRender(Component: React.ComponentType, props: any = {}): Promise<BenchmarkResult> {
    const { render, unmount } = await import('@testing-library/react');
    
    return performanceBenchmark.benchmark('Component Render', () => {
      const result = render(React.createElement(Component, props));
      result.unmount();
    });
  },

  async stateUpdates(count: number = 100): Promise<BenchmarkResult> {
    const { render, act } = await import('@testing-library/react');
    const { useState } = await import('react');
    
    const TestComponent = () => {
      const [counter, setCounter] = useState(0);
      return React.createElement('div', {
        onClick: () => setCounter(c => c + 1)
      }, counter);
    };
    
    return performanceBenchmark.benchmark('State Updates', async () => {
      const { container } = render(React.createElement(TestComponent));
      const button = container.firstChild as HTMLElement;
      
      for (let i = 0; i < count; i++) {
        await act(async () => {
          button.click();
        });
      }
    });
  }
};