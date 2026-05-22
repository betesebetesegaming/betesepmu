/**
 * Performance monitoring and optimization script
 * Tracks load metrics and provides debugging information
 */

interface LoadMetrics {
  domReady: number;
  pageLoad: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  cumulativeLayoutShift?: number;
}

const metrics: LoadMetrics = {
  domReady: 0,
  pageLoad: 0,
};

/**
 * Initialize performance monitoring
 */
export const initPerformanceMonitoring = (): void => {
  // Track DOM ready time
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      metrics.domReady = performance.now();
      console.log(`📊 DOM Ready: ${metrics.domReady.toFixed(2)}ms`);
      logPerformanceMetrics();
    });
  } else {
    metrics.domReady = performance.now();
  }

  // Track page load time
  window.addEventListener('load', () => {
    metrics.pageLoad = performance.now();
    console.log(`📊 Page Load: ${metrics.pageLoad.toFixed(2)}ms`);
    logPerformanceMetrics();
  });

  // Monitor Core Web Vitals
  monitorCoreWebVitals();

  // Monitor network performance
  monitorNetworkPerformance();
};

/**
 * Log all collected metrics
 */
const logPerformanceMetrics = (): void => {
  const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  
  if (perfData) {
    console.log('⏱️  Performance Breakdown:');
    console.log(`  DNS Lookup: ${(perfData.domainLookupEnd - perfData.domainLookupStart).toFixed(2)}ms`);
    console.log(`  TCP Connection: ${(perfData.connectEnd - perfData.connectStart).toFixed(2)}ms`);
    console.log(`  Time to First Byte: ${(perfData.responseStart - perfData.fetchStart).toFixed(2)}ms`);
    console.log(`  Content Download: ${(perfData.responseEnd - perfData.responseStart).toFixed(2)}ms`);
    console.log(`  DOM Processing: ${(perfData.domInteractive - perfData.responseEnd).toFixed(2)}ms`);
    console.log(`  Total Load Time: ${metrics.pageLoad.toFixed(2)}ms`);
  }

  // Log resource performance
  logResourceMetrics();
};

/**
 * Log resource loading metrics
 */
const logResourceMetrics = (): void => {
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  
  if (resources.length > 0) {
    const byType = new Map<string, { count: number; bytes: number; time: number }>();
    
    resources.forEach(resource => {
      const type = new URL(resource.name).pathname.split('.').pop() || 'unknown';
      const entry = byType.get(type) || { count: 0, bytes: 0, time: 0 };
      
      entry.count += 1;
      entry.bytes += resource.transferSize || 0;
      entry.time += resource.duration;
      
      byType.set(type, entry);
    });

    console.log('📦 Resources by Type:');
    Array.from(byType.entries()).forEach(([type, data]) => {
      const kbSize = (data.bytes / 1024).toFixed(2);
      console.log(`  ${type}: ${data.count} files, ${kbSize}KB, ${data.time.toFixed(2)}ms`);
    });
  }
};

/**
 * Monitor Core Web Vitals
 */
const monitorCoreWebVitals = (): void => {
  // Largest Contentful Paint
  if ('PerformanceObserver' in window) {
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        const lcp = (lastEntry as any).renderTime || (lastEntry as any).loadTime;
        console.log(`🎨 Largest Contentful Paint: ${lcp.toFixed(2)}ms`);
        metrics.largestContentfulPaint = lcp;
      });
      
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {
      console.debug('LCP observer not supported');
    }

    // Cumulative Layout Shift
    try {
      let cls = 0;
      const clsObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          if (!(entry as any).hadRecentInput) {
            cls += (entry as any).value;
          }
        });
        console.log(`📐 Cumulative Layout Shift: ${cls.toFixed(4)}`);
        metrics.cumulativeLayoutShift = cls;
      });
      
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {
      console.debug('CLS observer not supported');
    }
  }
};

/**
 * Monitor network performance
 */
const monitorNetworkPerformance = (): void => {
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries() as PerformanceResourceTiming[];
        
        entries.forEach(entry => {
          if (entry.duration > 3000) {
            console.warn(`⚠️  Slow resource: ${entry.name} took ${entry.duration.toFixed(2)}ms`);
          }

          // Track failed resources
          if (entry.transferSize === 0 && entry.name.indexOf('http') === 0) {
            console.warn(`❌ Failed/cached resource: ${entry.name}`);
          }
        });
      });

      observer.observe({ type: 'resource', buffered: true });
    } catch (e) {
      console.debug('Resource observer not supported');
    }
  }
};

/**
 * Get current metrics snapshot
 */
export const getMetricsSnapshot = (): LoadMetrics => {
  return { ...metrics };
};

/**
 * Log metrics in a dev-friendly format
 */
export const printMetricsReport = (): void => {
  console.group('📊 Performance Report');
  logPerformanceMetrics();
  console.groupEnd();
};
