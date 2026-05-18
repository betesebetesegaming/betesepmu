/**
 * Performance optimizations for faster app startup and reduced bandwidth usage
 */

export interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

const metrics: PerformanceMetric[] = [];

/**
 * Mark the start of a performance measurement
 */
export const markStart = (name: string): number => {
  const startTime = performance.now();
  metrics.push({ name, startTime });
  if (globalThis.console?.time) {
    globalThis.console.time(`perf:${name}`);
  }
  return startTime;
};

/**
 * Mark the end of a performance measurement
 */
export const markEnd = (name: string): PerformanceMetric | undefined => {
  const metric = metrics.find(m => m.name === name && !m.endTime);
  if (!metric) return undefined;

  metric.endTime = performance.now();
  metric.duration = metric.endTime - metric.startTime;

  if (globalThis.console?.timeEnd) {
    globalThis.console.timeEnd(`perf:${name}`);
  }

  // Log slow operations
  if (metric.duration > 1000) {
    console.warn(`⚠️ Slow operation: ${name} took ${metric.duration.toFixed(2)}ms`);
  }

  return metric;
};

/**
 * Get all metrics
 */
export const getMetrics = (): PerformanceMetric[] => {
  return [...metrics];
};

/**
 * Defer a callback to run after the main thread is idle
 * Uses requestIdleCallback with a setTimeout fallback
 */
export const deferWork = (callback: () => void, options?: IdleRequestOptions): void => {
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(callback, options);
  } else {
    // Fallback: schedule after current task
    setTimeout(callback, 0);
  }
};

/**
 * Batch multiple async operations with a limit on concurrent requests
 */
export async function batchAsync<T>(
  items: T[],
  fn: (item: T) => Promise<any>,
  concurrency: number = 3
): Promise<void> {
  const queue = [...items];
  const executing = new Set<Promise<any>>();

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) break;

    const promise = fn(item).then(() => {
      executing.delete(promise);
    }).catch((err) => {
      executing.delete(promise);
      console.error('Batch operation error:', err);
    });

    executing.add(promise);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
}

/**
 * Request data with a timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 5000,
  defaultValue?: T
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | number;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error(`Operation timeout after ${timeoutMs}ms`)),
      timeoutMs
    );
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutHandle as number);
    return result;
  } catch (err) {
    clearTimeout(timeoutHandle as number);
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw err;
  }
}

/**
 * Simple memory cache with TTL
 */
export class CacheWithTTL<T> {
  private cache = new Map<string, { value: T; expiry: number }>();

  constructor(private defaultTTLMs: number = 5 * 60 * 1000) {}

  set(key: string, value: T, ttlMs?: number): void {
    const expiry = Date.now() + (ttlMs ?? this.defaultTTLMs);
    this.cache.set(key, { value, expiry });
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }
}

/**
 * Report Core Web Vitals when available
 */
export const reportWebVitals = (onMetric: (metric: any) => void): void => {
  if ('web-vital' in window) {
    // Use web-vitals library if available
    return;
  }

  // Report basic metrics
  if (typeof PerformanceObserver !== 'undefined') {
    try {
      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        onMetric({
          name: 'LCP',
          value: lastEntry.renderTime || lastEntry.loadTime,
          id: 'lcp',
        });
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

      // First Input Delay
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          onMetric({
            name: 'FID',
            value: (entry as any).processingDuration,
            id: 'fid',
          });
        });
      });
      fidObserver.observe({ type: 'first-input', buffered: true });

      // Cumulative Layout Shift
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
            onMetric({
              name: 'CLS',
              value: clsValue,
              id: 'cls',
            });
          }
        });
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {
      console.error('Error setting up PerformanceObserver:', e);
    }
  }
};
