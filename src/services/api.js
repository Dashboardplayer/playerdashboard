import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5001/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
apiClient.interceptors.request.use(config => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (user.token) {
    config.headers.Authorization = `Bearer ${user.token}`;
  }
  return config;
});

// Auth API
export const auth = {
  login: (email, password) => 
    apiClient.post('/auth/login', { email, password }),
  
  register: (email, password, role, company_id) =>
    apiClient.post('/auth/register', { email, password, role, company_id }),
  
  resetPassword: (email) =>
    apiClient.post('/auth/forgot-password', { email }),
  
  verifyToken: () =>
    apiClient.get('/auth/verify'),
  
  refreshToken: () =>
    apiClient.post('/auth/refresh-token')
};

// Users API
export const users = {
  getCurrent: () => 
    apiClient.get('/users/me'),
  
  getById: (id) =>
    apiClient.get(`/users/${id}`),
  
  update: (id, data) =>
    apiClient.put(`/users/${id}`, data),
  
  delete: (id) =>
    apiClient.delete(`/users/${id}`)
};

// Companies API
export const companies = {
  getAll: () =>
    apiClient.get('/companies'),
  
  getById: (id) =>
    apiClient.get(`/companies/${id}`),
  
  create: (data) =>
    apiClient.post('/companies', data),
  
  update: (id, data) =>
    apiClient.put(`/companies/${id}`, data),
  
  delete: (id) =>
    apiClient.delete(`/companies/${id}`)
};

// Players API
export const players = {
  getAll: () =>
    apiClient.get('/players'),
  
  getById: (id) =>
    apiClient.get(`/players/${id}`),
  
  create: (data) =>
    apiClient.post('/players', data),
  
  update: (id, data) =>
    apiClient.put(`/players/${id}`, data),
  
  delete: (id) =>
    apiClient.delete(`/players/${id}`)
};

export default apiClient; 