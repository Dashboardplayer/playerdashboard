import React, { useState, useEffect, useCallback } from 'react';
import SuperAdminDashboard from './SuperAdminDashboard';
import { useUser } from '../../contexts/UserContext';
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  Chip,
  Grid,
  Button,
  IconButton,
  Tooltip,
  Stack,
  Alert
} from '@mui/material';
import {
  Person,
  VpnKey,
  Devices,
  Refresh,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { companyAPI, playerAPI, userAPI } from '../../hooks/apiClient';

function CompanyDashboard() {
  const { profile: user, loading: userLoading, error: userError } = useUser();
  const [companyName, setCompanyName] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [companyStats, setCompanyStats] = useState({
    totalPlayers: 0,
    activePlayers: 0,
    totalUsers: 0
  });
  const [error, setError] = useState('');
  const [loadRetries, setLoadRetries] = useState(0);
  const maxRetries = 3;

  // Attempt to get company_id from localStorage as fallback
  const getCompanyId = useCallback(() => {
    if (user?.company_id) return user.company_id;
    
    // Fallback to localStorage if user context isn't ready yet
    const fallbackCompanyId = localStorage.getItem('company_id');
    if (fallbackCompanyId) return fallbackCompanyId;
    
    return null;
  }, [user]);

  const fetchCompanyData = useCallback(async () => {
    const companyId = getCompanyId();
    if (!companyId) {
      if (loadRetries < maxRetries) {
        // Retry after a delay if company_id is not available yet
        setTimeout(() => {
          setLoadRetries(prev => prev + 1);
        }, 500);
        return;
      } else {
        setError('Could not determine company ID. Please try logging in again.');
        setLoading(false);
        return;
      }
    }

    try {
      setLoading(true);
      setError(''); // Clear any existing errors

      // First try to get company name from localStorage cache
      const cachedCompanyName = localStorage.getItem('company_name');
      if (cachedCompanyName) {
        setCompanyName(cachedCompanyName);
      }

      // Fetch company name
      try {
        const { data: companies, error: companyError } = await companyAPI.getAll();
        
        if (companyError) {
          console.error('Error fetching company:', companyError);
          // Don't throw here, try to continue with other data
        } else if (companies) {
          const company = companies.find(c => c.company_id === companyId || c._id === companyId);
          if (company?.company_name) {
            setCompanyName(company.company_name);
            // Cache for future use
            localStorage.setItem('company_name', company.company_name);
          }
        }
      } catch (companyError) {
        console.error('Exception fetching company:', companyError);
        // Continue with other data
      }

      // Parallel fetch for better performance
      const playersPromise = playerAPI.getAll(companyId);
      const usersPromise = userAPI.getAll(companyId);
      
      const [playersResult, usersResult] = await Promise.all([
        playersPromise.catch(err => ({ error: err.message })),
        usersPromise.catch(err => ({ error: err.message }))
      ]);
      
      // Process players data
      if (playersResult.error) {
        console.error('Error fetching players:', playersResult.error);
      } else {
        const players = playersResult.data || [];
        const activePlayers = players.filter(player => player.is_online) || [];
        
        setCompanyStats(prev => ({
          ...prev,
          totalPlayers: players.length,
          activePlayers: activePlayers.length
        }));
      }
      
      // Process users data
      if (usersResult.error) {
        console.error('Error fetching users:', usersResult.error);
      } else {
        const users = usersResult.data || [];
        
        setCompanyStats(prev => ({
          ...prev,
          totalUsers: users.length
        }));
      }

    } catch (err) {
      console.error('Error in fetchCompanyData:', err);
      setError(err.message || 'Failed to load company data');
    } finally {
      setLoading(false);
    }
  }, [getCompanyId, loadRetries, maxRetries]);

  useEffect(() => {
    // Try to load immediately
    fetchCompanyData();
    
    // Set up event listeners for real-time updates
    const handleEntityUpdate = () => {
      fetchCompanyData();
    };
    
    window.addEventListener('company_update', handleEntityUpdate);
    window.addEventListener('player_update', handleEntityUpdate);
    window.addEventListener('user_update', handleEntityUpdate);
    
    return () => {
      window.removeEventListener('company_update', handleEntityUpdate);
      window.removeEventListener('player_update', handleEntityUpdate);
      window.removeEventListener('user_update', handleEntityUpdate);
    };
  }, [fetchCompanyData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchCompanyData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Show loading state when user context is loading
  if (userLoading || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">
            Loading dashboard...
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (userError || error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="error" 
          action={
            <Button color="inherit" size="small" onClick={handleRefresh}>
              Retry
            </Button>
          }
        >
          {userError || error || 'An error occurred while loading the dashboard'}
        </Alert>
      </Box>
    );
  }

  // Check for user data - first from context, then from localStorage
  const userData = user || JSON.parse(localStorage.getItem('user') || 'null');
  
  if (!userData) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          Please log in to access the dashboard
        </Alert>
      </Box>
    );
  }

  // Use user from context, or try to get from localStorage as fallback
  const currentUser = userData;
  
  const getRoleColor = (role) => {
    switch (role) {
      case 'superadmin':
        return { color: '#d32f2f', bg: '#ffebee' };
      case 'bedrijfsadmin':
        return { color: '#ed6c02', bg: '#fff3e0' };
      default:
        return { color: '#2e7d32', bg: '#e8f5e9' };
    }
  };

  const roleColors = getRoleColor(currentUser.role || localStorage.getItem('user_role') || 'user');

  // Filter function to only show company's own data
  const filterByCompany = (data) => {
    const companyId = getCompanyId();
    return data.filter(item => item.company_id === companyId);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Welcome Header */}
      <Paper 
        elevation={2} 
        sx={{ 
          p: 3,
          mb: 4,
          background: 'linear-gradient(135deg, #fff 0%, #f8f9fa 100%)',
          borderRadius: 2,
          borderLeft: '4px solid #1976d2'
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          mb: 3
        }}>
          <Box>
            <Typography variant="h5" gutterBottom sx={{ color: 'primary.main' }}>
              Welcome to {companyName || 'Your Dashboard'}
            </Typography>
            <Stack direction="row" spacing={3} alignItems="center">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Person sx={{ color: 'text.secondary', fontSize: 20 }} />
                <Typography variant="body2" color="text.secondary">
                  {currentUser.email || 'User'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <VpnKey sx={{ color: 'text.secondary', fontSize: 20 }} />
                <Chip
                  label={currentUser.role || localStorage.getItem('user_role') || 'User'}
                  size="small"
                  sx={{
                    bgcolor: roleColors.bg,
                    color: roleColors.color,
                    height: '24px'
                  }}
                />
              </Box>
            </Stack>
          </Box>
          
          <Stack direction="row" spacing={1}>
            <Tooltip title="Settings">
              <IconButton
                color="primary"
                component={Link}
                to="/settings"
                size="large"
              >
                <SettingsIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh Dashboard">
              <IconButton
                onClick={handleRefresh}
                sx={{
                  animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                  '@keyframes spin': {
                    '0%': {
                      transform: 'rotate(0deg)'
                    },
                    '100%': {
                      transform: 'rotate(360deg)'
                    }
                  }
                }}
              >
                <Refresh />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        <Stack direction="row" spacing={2} alignItems="center">
          <Button
            variant="contained"
            component={Link}
            to="/create-player"
            startIcon={<Devices />}
            sx={{ 
              bgcolor: 'primary.main',
              '&:hover': { bgcolor: 'primary.dark' }
            }}
          >
            New Player
          </Button>
          {currentUser.role === 'bedrijfsadmin' && (
            <Button
              variant="contained"
              component={Link}
              to="/create-user"
              startIcon={<Person />}
              sx={{ 
                bgcolor: 'warning.main',
                '&:hover': { bgcolor: 'warning.dark' }
              }}
            >
              New User
            </Button>
          )}
        </Stack>
      </Paper>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Paper
            elevation={2}
            sx={{
              p: 3,
              bgcolor: '#e3f2fd',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: 2
            }}
          >
            <Box>
              <Typography variant="h4" component="div" color="primary">
                {companyStats.totalPlayers}
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Total Players
              </Typography>
            </Box>
            <Devices sx={{ fontSize: 40, color: 'primary.main', opacity: 0.7 }} />
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Paper
            elevation={2}
            sx={{
              p: 3,
              bgcolor: '#e8f5e9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: 2
            }}
          >
            <Box>
              <Typography variant="h4" component="div" color="success.main">
                {companyStats.activePlayers}
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Active Players
              </Typography>
            </Box>
            <Devices sx={{ fontSize: 40, color: 'success.main', opacity: 0.7 }} />
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Paper
            elevation={2}
            sx={{
              p: 3,
              bgcolor: '#fff3e0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: 2
            }}
          >
            <Box>
              <Typography variant="h4" component="div" color="warning.main">
                {companyStats.totalUsers}
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Total Users
              </Typography>
            </Box>
            <Person sx={{ fontSize: 40, color: 'warning.main', opacity: 0.7 }} />
          </Paper>
        </Grid>
      </Grid>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Main Dashboard Content */}
      <SuperAdminDashboard 
        filterData={filterByCompany}
        hideDeleteButtons={currentUser.role !== 'bedrijfsadmin'}
        isCompanyDashboard={true}
        hideHeader={true}
      />
    </Box>
  );
}

export default CompanyDashboard;
