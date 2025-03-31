import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5001/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use(config => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (user.token) {
    config.headers.Authorization = `Bearer ${user.token}`;
  }
  return config;
});

// Auth API
export const auth = {
  login: (email, password) => 
    api.post('/auth/login', { email, password }),
  
  register: (email, password, role, company_id) =>
    api.post('/auth/register', { email, password, role, company_id }),
  
  resetPassword: (email) =>
    api.post('/auth/forgot-password', { email }),
  
  verifyToken: () =>
    api.get('/auth/verify'),
  
  refreshToken: () =>
    api.post('/auth/refresh-token')
};

// Users API
export const users = {
  getCurrent: () => 
    api.get('/users/me'),
  
  getById: (id) =>
    api.get(`/users/${id}`),
  
  update: (id, data) =>
    api.put(`/users/${id}`, data),
  
  delete: (id) =>
    api.delete(`/users/${id}`)
};

// Companies API
export const companies = {
  getAll: () =>
    api.get('/companies'),
  
  getById: (id) =>
    api.get(`/companies/${id}`),
  
  create: (data) =>
    api.post('/companies', data),
  
  update: (id, data) =>
    api.put(`/companies/${id}`, data),
  
  delete: (id) =>
    api.delete(`/companies/${id}`)
};

// Players API
export const players = {
  getAll: () =>
    api.get('/players'),
  
  getById: (id) =>
    api.get(`/players/${id}`),
  
  create: (data) =>
    api.post('/players', data),
  
  update: (id, data) =>
    api.put(`/players/${id}`, data),
  
  delete: (id) =>
    api.delete(`/players/${id}`)
};

export default {
  auth,
  users,
  companies,
  players
}; 