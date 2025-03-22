// Enhanced client-side shim for jsonwebtoken

// Simple JWT sign implementation that returns a mock token
const sign = (payload, secret, options = {}) => {
  // This is a mock implementation - in a real app, JWT operations should be server-side
  // Just return a placeholder string for the token
  return `mock-jwt-token-${Date.now()}`;
};

// Simple JWT verify implementation that returns the payload
const verify = (token, secret) => {
  // This is a mock implementation - in a real app, JWT operations should be server-side
  if (!token || token.indexOf('mock-jwt-token') === -1) {
    throw new Error('Invalid token');
  }
  
  // Extract user info from localStorage instead
  const authData = JSON.parse(localStorage.getItem('authData') || '{}');
  return authData.user || null;
};

// Export the JWT functions
export default { sign, verify };
export { sign, verify };