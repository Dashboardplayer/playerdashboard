import React, { useEffect, useState } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';

// Auth Pages
import LoginPage from './components/Auth/LoginPage.js';
import ForgotPassword from './components/Auth/ForgotPassword.js';
import ResetPassword from './components/Auth/ResetPassword.js';
import Settings from './components/Settings/Settings.js';
import SignUp from './components/Auth/SignUp.js';

// Dashboards
import SuperAdminDashboard from './components/Dashboards/SuperAdminDashboard.js';
import CompanyDashboard from './components/Dashboards/CompanyDashboard.js';
import CompaniesDashboard from './components/Dashboards/CompaniesDashboard.js';
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

// Layout component with NavBar
const Layout = () => {
  return (
    <>
      <NavBar />
      <Outlet />
    </>
  );
};

// Main App component
function AppContent() {
  const { setProfile, logout } = useUser();
  const [loading, setLoading] = useState(true);

  // Check for existing session on app load
  useEffect(() => {
    async function checkSession() {
      try {
        console.log('checkSession started...');
        const { data: userData, error: userError } = await authAPI.getCurrentUser();
        
        console.log('Session check result:', { 
          hasUser: !!userData?.user,
          error: userError 
        });
  
        // If we have user data, set it as profile
        if (userData?.user) {
          console.log('Setting user profile:', {
            id: userData.user.id,
            email: userData.user.email,
            role: userData.user.role
          });
          setProfile(userData.user);
        } else {
          console.log('No valid user data found');
          setProfile(null);
        }
      } catch (error) {
        console.error('Session check error:', error);
        setProfile(null);
      } finally {
        console.log('checkSession finished.');
        setLoading(false);
      }
    }
    
    checkSession();
  }, [setProfile]);

  // Handle authentication expiration
  useEffect(() => {
    const handleAuthExpired = () => {
      console.log('Authentication expired, logging out...');
      logout();
      // You might want to show a message to the user here
      alert('Your session has expired. Please log in again.');
    };

    window.addEventListener('auth_expired', handleAuthExpired);
    
    return () => {
      window.removeEventListener('auth_expired', handleAuthExpired);
    };
  }, [logout]);

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
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>
  );
}

function App() {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
}

export default App;
