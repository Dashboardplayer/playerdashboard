/**
 * Circuit Breaker Implementation
 * 
 * This service implements the Circuit Breaker pattern to prevent cascading failures
 * when external services are unavailable.
 */

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000; // 30 seconds
    this.timeoutDuration = options.timeoutDuration || 3000; // 3 seconds
    this.healthCheckInterval = options.healthCheckInterval || 10000; // 10 seconds
    
    this.services = new Map();
  }
  
  // Register a service with the circuit breaker
  registerService(serviceName, options = {}) {
    try {
      const serviceOptions = {
        failureThreshold: options.failureThreshold || this.failureThreshold,
        resetTimeout: options.resetTimeout || this.resetTimeout,
        timeoutDuration: options.timeoutDuration || this.timeoutDuration,
        healthCheckFn: options.healthCheckFn || null,
        fallbackFn: options.fallbackFn || null
      };
      
      this.services.set(serviceName, {
        name: serviceName,
        state: 'CLOSED', // CLOSED, OPEN, HALF-OPEN
        failureCount: 0,
        lastFailure: null,
        lastSuccess: Date.now(),
        options: serviceOptions,
        healthCheckTimer: null
      });
      
      // If a health check function is provided, set up periodic health checks
      if (serviceOptions.healthCheckFn) {
        this._setupHealthCheck(serviceName);
      }
      
      return this;
    } catch (error) {
      console.error(`Error registering service ${serviceName}:`, error);
      return this;
    }
  }
  
  // Execute a function with circuit breaker protection
  async exec(serviceName, fn, ...args) {
    try {
      const service = this.services.get(serviceName);
      
      if (!service) {
        console.warn(`Service '${serviceName}' not registered with circuit breaker`);
        return fn(...args); // Fall back to direct execution
      }
      
      // If circuit is OPEN, check if it's time to try again
      if (service.state === 'OPEN') {
        const now = Date.now();
        const timeInOpen = now - service.lastFailure;
        
        if (timeInOpen < service.options.resetTimeout) {
          // Circuit still open, use fallback if available
          console.warn(`Circuit for ${serviceName} is OPEN. Using fallback.`);
          if (service.options.fallbackFn) {
            return service.options.fallbackFn(...args);
          }
          throw new Error(`Service ${serviceName} is unavailable`);
        } else {
          // Try to close the circuit
          console.info(`Circuit for ${serviceName} is switching to HALF-OPEN`);
          service.state = 'HALF-OPEN';
        }
      }
      
      try {
        // Set up a timeout to fail fast
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Service ${serviceName} timed out after ${service.options.timeoutDuration}ms`));
          }, service.options.timeoutDuration);
        });
        
        // Race the function execution against the timeout
        const result = await Promise.race([
          fn(...args),
          timeoutPromise
        ]);
        
        // Success! Reset failure counter
        this._onSuccess(serviceName);
        return result;
      } catch (error) {
        // Failure, increment counter
        this._onFailure(serviceName, error);
        
        // Use fallback if available
        if (service.options.fallbackFn) {
          return service.options.fallbackFn(...args);
        }
        
        throw error;
      }
    } catch (error) {
      console.error(`Circuit breaker execution error for ${serviceName}:`, error);
      // Last resort fallback is to just try the function directly
      return fn(...args);
    }
  }
  
  // Handle successful operation
  _onSuccess(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) return;
    
    service.failureCount = 0;
    service.lastSuccess = Date.now();
    
    if (service.state === 'HALF-OPEN') {
      console.info(`Circuit for ${serviceName} is now CLOSED`);
      service.state = 'CLOSED';
    }
  }
  
  // Handle failed operation
  _onFailure(serviceName, error) {
    const service = this.services.get(serviceName);
    if (!service) return;
    
    service.failureCount++;
    service.lastFailure = Date.now();
    
    console.warn(`Service ${serviceName} failure: ${error.message}. Count: ${service.failureCount}`);
    
    // Check if we need to open the circuit
    if (
      (service.state === 'CLOSED' && service.failureCount >= service.options.failureThreshold) || 
      service.state === 'HALF-OPEN'
    ) {
      console.error(`Circuit for ${serviceName} is now OPEN due to ${service.failureCount} failures`);
      service.state = 'OPEN';
      
      // Schedule a health check
      this._setupHealthCheck(serviceName);
    }
  }
  
  // Setup a health check timer for a service
  _setupHealthCheck(serviceName) {
    const service = this.services.get(serviceName);
    if (!service || !service.options.healthCheckFn) return;
    
    // Clear any existing timer
    if (service.healthCheckTimer) {
      clearInterval(service.healthCheckTimer);
    }
    
    // Set up new health check timer
    service.healthCheckTimer = setInterval(async () => {
      if (service.state !== 'OPEN') {
        clearInterval(service.healthCheckTimer);
        service.healthCheckTimer = null;
        return;
      }
      
      try {
        const isHealthy = await service.options.healthCheckFn();
        if (isHealthy) {
          console.info(`Health check for ${serviceName} succeeded, switching to HALF-OPEN`);
          service.state = 'HALF-OPEN';
          service.failureCount = 0;
          clearInterval(service.healthCheckTimer);
          service.healthCheckTimer = null;
        }
      } catch (error) {
        console.warn(`Health check for ${serviceName} failed: ${error.message}`);
      }
    }, this.healthCheckInterval);
  }
  
  // Get the current status of a service
  getStatus(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) return null;
    
    return {
      name: service.name,
      state: service.state,
      failureCount: service.failureCount,
      lastFailure: service.lastFailure,
      lastSuccess: service.lastSuccess
    };
  }
  
  // Get status of all services
  getAllStatus() {
    const statuses = [];
    this.services.forEach(service => {
      statuses.push({
        name: service.name,
        state: service.state,
        failureCount: service.failureCount,
        lastFailure: service.lastFailure,
        lastSuccess: service.lastSuccess
      });
    });
    return statuses;
  }
  
  // Reset a service's circuit breaker
  resetService(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) return false;
    
    service.state = 'CLOSED';
    service.failureCount = 0;
    service.lastFailure = null;
    service.lastSuccess = Date.now();
    
    if (service.healthCheckTimer) {
      clearInterval(service.healthCheckTimer);
      service.healthCheckTimer = null;
    }
    
    return true;
  }
}

// Create and export a singleton instance
const circuitBreaker = new CircuitBreaker();

module.exports = circuitBreaker; 