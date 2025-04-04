/**
 * API Versioning middleware
 * This allows for graceful API versioning by handling version-specific logic
 */

// Store route handlers for different API versions
const versionedRoutes = {
  'v1': new Map(), // Default current version
  'v2': new Map()  // Future version
};

// Register a route handler for a specific version
const registerVersionedRoute = (version, route, method, handler) => {
  const key = `${method.toUpperCase()}:${route}`;
  if (!versionedRoutes[version]) {
    versionedRoutes[version] = new Map();
  }
  versionedRoutes[version].set(key, handler);
};

// Get the appropriate route handler based on API version
const getVersionedHandler = (version, route, method) => {
  const key = `${method.toUpperCase()}:${route}`;
  
  // Check if the requested version exists
  if (!versionedRoutes[version]) {
    return null;
  }
  
  // Check if the route exists in the requested version
  if (versionedRoutes[version].has(key)) {
    return versionedRoutes[version].get(key);
  }
  
  // If we're requesting a newer version but the route doesn't exist there,
  // fall back to the latest version that has this route
  if (version === 'v2' && versionedRoutes['v1'].has(key)) {
    return versionedRoutes['v1'].get(key);
  }
  
  return null;
};

// Middleware to determine API version
const versionMiddleware = (req, res, next) => {
  // Determine the requested API version from:
  // 1. URL path prefix (/api/v1/...)
  // 2. Accept header (Accept: application/vnd.playerdashboard.v1+json)
  // 3. Custom header (X-API-Version: v1)
  // 4. Default to v1 if not specified
  
  // Check URL path
  const pathMatch = req.path.match(/^\/api\/v(\d+)/);
  if (pathMatch) {
    req.apiVersion = `v${pathMatch[1]}`;
    // Rewrite the URL to remove the version
    req.url = req.url.replace(/^\/api\/v\d+/, '/api');
  } 
  // Check Accept header
  else if (req.headers.accept && req.headers.accept.includes('application/vnd.playerdashboard.')) {
    const acceptMatch = req.headers.accept.match(/application\/vnd\.playerdashboard\.(v\d+)\+json/);
    if (acceptMatch) {
      req.apiVersion = acceptMatch[1];
    }
  } 
  // Check custom header
  else if (req.headers['x-api-version']) {
    req.apiVersion = req.headers['x-api-version'];
  }
  
  // Default to v1
  if (!req.apiVersion) {
    req.apiVersion = 'v1';
  }
  
  // Add API version to response headers
  res.setHeader('X-API-Version', req.apiVersion);
  
  next();
};

// Route handler middleware
const versionedRouteMiddleware = (req, res, next) => {
  // This is used after versionMiddleware has set req.apiVersion
  const handler = getVersionedHandler(req.apiVersion, req.route.path, req.method);
  
  if (handler) {
    return handler(req, res, next);
  }
  
  next();
};

module.exports = {
  versionMiddleware,
  versionedRouteMiddleware,
  registerVersionedRoute
}; 