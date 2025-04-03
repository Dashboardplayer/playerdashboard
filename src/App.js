import React, { useEffect, useState } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './contexts/AuthContext';

// Auth Pages
import LoginPage from './components/Auth/LoginPage.js';
import ForgotPassword from './components/Auth/ForgotPassword.js';
import ResetPassword from './components/Auth/ResetPassword.js';
import Settings from './components/Settings/Settings.js';
import SignUp from './components/Auth/SignUp.js';

// Dashboards
import SuperAdminDashboard from './components/Dashboards/SuperAdminDashboard.js';
import CompanyDashboard from './components/Dashboards/CompanyDashboard.js';
import UserManagement from './components/Users/UserManagement.js';
import PerformanceTab from './components/Admin/PerformanceTab.js';

// Forms
import CreateUser from './components/Forms/CreateUser.js';
import CreateProfile from './components/Forms/CreateProfile.js';
import CreateCompany from './components/Forms/CreateCompany.js';
import CreatePlayer from './components/Forms/CreatePlayer.js';

// Layouts
import NavBar from './components/Layouts/Navbar.js';

// Context & Hooks
import { UserProvider, useUser } from './contexts/UserContext.js';
import { authAPI } from './hooks/apiClient.js';

// Protected Route component
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { profile, loading, setProfile } = useUser();
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        console.log('checkSession started...');
        const { data: userData, error: userError } = await authAPI.getCurrentUser();
        console.log('Session check result:', { userData, userError });

        if (userData?.user && !userError) {
          // Session is valid, update profile
          setProfile(userData.user);
          setSessionChecked(true);
        } else {
          // Invalid session, redirect to login
          console.log('Invalid session, redirecting to login...');
          setProfile(null);
          setSessionChecked(true);
          return <Navigate to="/" replace />;
        }
      } catch (error) {
        console.error('Session check error:', error);
        setProfile(null);
        setSessionChecked(true);
        return <Navigate to="/" replace />;
      }
    };

    if (!sessionChecked) {
      checkSession();
    }
  }, [sessionChecked, setProfile]);

  // Show loading state while checking session
  if (loading || !sessionChecked) {
    return <div>Loading...</div>;
  }
  
  // If no profile or not authenticated, redirect to login
  if (!profile) {
    return <Navigate to="/" replace />;
  }
  
  // If roles are specified and user's role is not in the allowed roles, redirect
  if (allowedRoles.length > 0 && !allowedRoles.includes(profile.role)) {
    return <Navigate to={profile.role === 'superadmin' ? '/superadmin-dashboard' : '/company-dashboard'} replace />;
  }
  
  // Otherwise, render the children
  return children;
};

// Main App component
function AppContent() {
  // Get user context - this needs to be at the component top level
  const userContext = useUser();
  
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // Create default functions that will be used if context is null
  const defaultSetProfile = (user) => {
    console.warn('setProfile called before context was ready', user);
  };
  
  const defaultLogout = () => {
    console.warn('logout called before context was ready');
  };

  // Use null-safe destructuring for the context
  const setProfile = userContext?.setProfile || defaultSetProfile;
  const logout = userContext?.logout || defaultLogout;

  // Check for existing session on app load
  useEffect(() => {
    async function checkSession() {
      try {
        console.log('checkSession started...');
        const { data: userData, error: userError } = await authAPI.getCurrentUser();
        
        console.log('Session check result:', { 
          userData,
          userError 
        });
  
        // If we have user data, set it as profile
        if (userData?.user) {
          console.log('Setting user profile:', {
            id: userData.user.id,
            email: userData.user.email,
            role: userData.user.role
          });
          
          // Only call setProfile if it's available
          if (setProfile !== defaultSetProfile) {
            setProfile(userData.user);
          } else {
            console.warn('Unable to set profile: context not ready');
          }
        } else {
          console.log('No valid user data found');
          if (setProfile !== defaultSetProfile) {
            setProfile(null);
          } else {
            console.warn('Unable to clear profile: context not ready');
          }
        }
      } catch (error) {
        console.error('Session check error:', error);
        if (setProfile !== defaultSetProfile) {
          setProfile(null);
        } else {
          console.warn('Unable to clear profile: context not ready');
        }
      } finally {
        console.log('checkSession finished.');
        setLoading(false);
      }
    }
    
    checkSession();
  }, [setProfile]);

  // Handle authentication expiration
  useEffect(() => {
    const handleAuthExpired = (event) => {
      console.log('Authentication expired, logging out...');
      
      // Only call logout if it's available
      if (logout !== defaultLogout) {
        logout();
      } else {
        console.warn('Unable to logout: context not ready');
        // Fallback logout - redirect to login
        window.location.href = '/login';
      }
      
      // Show notification with custom message if provided
      const message = event.detail?.message || 'Your session has expired. Please log in again.';
      setNotification({
        type: 'warning',
        message,
        show: true
      });

      // Auto-hide notification after 5 seconds
      setTimeout(() => {
        setNotification(null);
      }, 5000);
    };

    window.addEventListener('auth_expired', handleAuthExpired);
    
    return () => {
      window.removeEventListener('auth_expired', handleAuthExpired);
    };
  }, [logout, defaultLogout]);

  if (loading) {
    return <div>Loading...</div>;
  }

  const router = createBrowserRouter([
    {
      path: '/',
      element: <LoginPage />,
    },
    {
      path: '/login',
      element: <LoginPage />,
    },
    {
      path: '/forgot-password',
      element: <ForgotPassword />,
    },
    {
      path: '/reset-password',
      element: <ResetPassword />,
    },
    {
      path: '/complete-registration',
      element: <SignUp />,
    },
    {
      path: '/superadmin-dashboard',
      element: (
        <ProtectedRoute allowedRoles={['superadmin']}>
          <NavBar />
          <SuperAdminDashboard />
        </ProtectedRoute>
      ),
    },
    {
      path: '/company-dashboard',
      element: (
        <ProtectedRoute allowedRoles={['bedrijfsadmin', 'user']}>
          <NavBar />
          <CompanyDashboard />
        </ProtectedRoute>
      ),
    },
    {
      path: '/create-profile',
      element: <CreateProfile />,
    },
    {
      path: '/create-user',
      element: (
        <ProtectedRoute allowedRoles={['superadmin', 'bedrijfsadmin']}>
          <NavBar />
          <CreateUser />
        </ProtectedRoute>
      ),
    },
    {
      path: '/create-company',
      element: (
        <ProtectedRoute allowedRoles={['superadmin']}>
          <NavBar />
          <CreateCompany />
        </ProtectedRoute>
      ),
    },
    {
      path: '/create-player',
      element: (
        <ProtectedRoute allowedRoles={['superadmin', 'bedrijfsadmin']}>
          <NavBar />
          <CreatePlayer />
        </ProtectedRoute>
      ),
    },
    {
      path: '/settings',
      element: (
        <ProtectedRoute allowedRoles={['superadmin', 'bedrijfsadmin', 'user']}>
          <NavBar />
          <Settings />
        </ProtectedRoute>
      ),
    },
    {
      path: '/users',
      element: (
        <ProtectedRoute allowedRoles={['superadmin', 'bedrijfsadmin']}>
          <NavBar />
          <UserManagement />
        </ProtectedRoute>
      ),
    },
    {
      path: '/performance',
      element: (
        <ProtectedRoute allowedRoles={['superadmin']}>
          <NavBar />
          <PerformanceTab />
        </ProtectedRoute>
      ),
    },
    { path: '*', element: <h1>404 - Pagina niet gevonden</h1> }
  ], {
    future: {
      v7_relativeSplatPath: true
    }
  });

  return (
    <div className="app-container">
      {/* Notification component */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}
      
      {/* Rest of your app content */}
      <RouterProvider router={router} />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider theme={createTheme()}>
      <CssBaseline />
      <AuthProvider>
        <UserProvider>
          <AppContent />
        </UserProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
