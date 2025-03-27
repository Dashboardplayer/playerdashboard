// Performance monitoring
const performanceMetrics = new Map();
const rateLimitMetrics = new Map();

// Initialize metrics for an endpoint
export function initializeMetrics(endpoint) {
  if (!performanceMetrics.has(endpoint)) {
    performanceMetrics.set(endpoint, {
      totalCalls: 0,
      totalTime: 0,
      slowCalls: 0, // calls taking > 1000ms
      errors: 0,
      lastError: null
    });
  }
}

// Track API call performance
export function trackAPICall(endpoint, startTime, success = true, error = null) {
  const duration = Date.now() - startTime;
  const metrics = performanceMetrics.get(endpoint) || {
    totalCalls: 0,
    totalTime: 0,
    slowCalls: 0,
    errors: 0,
    lastError: null
  };

  metrics.totalCalls++;
  metrics.totalTime += duration;
  if (duration > 1000) metrics.slowCalls++;
  
  if (!success) {
    metrics.errors++;
    metrics.lastError = error;
  }

  performanceMetrics.set(endpoint, metrics);
  
  // Log slow calls for monitoring
  if (duration > 1000) {
    console.warn(`Slow API call to ${endpoint}: ${duration}ms`);
  }
}

// Track rate limit usage
export function trackRateLimit(endpoint, remaining, limit, reset) {
  rateLimitMetrics.set(endpoint, {
    remaining,
    limit,
    reset,
    timestamp: Date.now(),
    usage: ((limit - remaining) / limit) * 100
  });

  // Alert if usage is high
  if (remaining < limit * 0.2) {
    console.warn(`Rate limit warning for ${endpoint}: ${remaining}/${limit} remaining`);
  }
}

// Get performance report
export function getPerformanceReport() {
  const report = {};
  performanceMetrics.forEach((metrics, endpoint) => {
    report[endpoint] = {
      avgResponseTime: metrics.totalCalls ? metrics.totalTime / metrics.totalCalls : 0,
      totalCalls: metrics.totalCalls,
      slowCalls: metrics.slowCalls,
      errorRate: metrics.totalCalls ? (metrics.errors / metrics.totalCalls) * 100 : 0,
      lastError: metrics.lastError
    };
  });
  return report;
}

// Get rate limit report
export function getRateLimitReport() {
  const report = {};
  rateLimitMetrics.forEach((metrics, endpoint) => {
    report[endpoint] = {
      usagePercentage: metrics.usage,
      remaining: metrics.remaining,
      resetsIn: Math.max(0, metrics.reset - Date.now() / 1000)
    };
  });
  return report;
}

// Clear old metrics (call periodically)
export function clearOldMetrics() {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  rateLimitMetrics.forEach((metrics, endpoint) => {
    if (metrics.timestamp < oneHourAgo) {
      rateLimitMetrics.delete(endpoint);
    }
  });
} 