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
  Alert,
  Snackbar
} from '@mui/material';
import {
  Person,
  VpnKey,
  Devices,
  Refresh,
  Settings as SettingsIcon,
  SignalWifiOff
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { companyAPI, playerAPI, userAPI } from '../../hooks/apiClient';

function CompanyDashboard() {
  const { profile: user, loading: userLoading, error: userError } = useUser();
  const [companyName, setCompanyName] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [companyStats, setCompanyStats] = useState({
    totalPlayers: 0,
    activePlayers: 0,
    offlinePlayers: 0,
    totalUsers: 0
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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

  const fetchCompanyData = useCallback(async ({ silent = false } = {}) => {
    const companyId = getCompanyId();
    if (!companyId) {
      if (loadRetries < maxRetries) {
        // Retry after a delay if company_id is not available yet
        setTimeout(() => {
          setLoadRetries(prev => prev + 1);
        }, 500);
        return;
      } else {
        setError('Bedrijf kon niet bepaald worden. Log opnieuw in en probeer het daarna nog een keer.');
        setLoading(false);
        return;
      }
    }

    try {
      if (!silent) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
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
      const playersPromise = playerAPI.getStats(companyId);
      const usersPromise = userAPI.getAll(companyId);
      
      const [playersResult, usersResult] = await Promise.all([
        playersPromise.catch(err => ({ error: err.message })),
        usersPromise.catch(err => ({ error: err.message }))
      ]);
      
      // Process players data
      if (playersResult.error) {
        console.error('Error fetching players:', playersResult.error);
      } else {
        const playerStats = playersResult.data || {};
        
        setCompanyStats(prev => ({
          ...prev,
          totalPlayers: playerStats.totalPlayers || 0,
          activePlayers: playerStats.activePlayers || 0,
          offlinePlayers: playerStats.offlinePlayers || 0
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

      setLastUpdated(new Date());

    } catch (err) {
      console.error('Error in fetchCompanyData:', err);
      setError(err.message || 'Bedrijfsgegevens laden mislukt.');
    } finally {
      setLoading(false);
      if (silent) setIsRefreshing(false);
    }
  }, [getCompanyId, loadRetries, maxRetries]);

  useEffect(() => {
    // Try to load immediately
    fetchCompanyData();
    
    // Set up event listeners for real-time updates
    const handleEntityUpdate = () => {
      fetchCompanyData({ silent: true });
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
    await fetchCompanyData({ silent: true });
    setSuccess('Dashboard vernieuwd.');
  };

  // Show loading state when user context is loading
  if (userLoading || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">
            Dashboard laden...
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
              Opnieuw proberen
            </Button>
          }
        >
          {userError || error || 'Er is een fout opgetreden bij het laden van het dashboard.'}
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
          Log in om het dashboard te openen.
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

  const getRoleLabel = (role) => {
    switch (role) {
      case 'superadmin':
        return 'Superadmin';
      case 'bedrijfsadmin':
        return 'Bedrijfsadmin';
      default:
        return 'Gebruiker';
    }
  };

  const roleColors = getRoleColor(currentUser.role || localStorage.getItem('user_role') || 'user');

  // Filter function to only show company's own data
  const filterByCompany = (data) => {
    const companyId = getCompanyId();
    return data.filter(item => item.company_id === companyId);
  };

  return (
    <Box sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 }, bgcolor: '#f6f8fb', minHeight: '100vh' }}>
      {/* Welcome Header */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: { xs: 2, md: 3 },
          mb: 3,
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: { xs: 'flex-start', md: 'center' },
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
          mb: 2
        }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
              {companyName || 'Bedrijfsdashboard'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
              Overzicht van je players en gebruikers.
              {lastUpdated ? ` Laatst bijgewerkt: ${lastUpdated.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}` : ''}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 3 }} alignItems={{ xs: 'flex-start', sm: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Person sx={{ color: 'text.secondary', fontSize: 20 }} />
                <Typography variant="body2" color="text.secondary">
                  {currentUser.email || 'Gebruiker'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <VpnKey sx={{ color: 'text.secondary', fontSize: 20 }} />
                <Chip
                  label={getRoleLabel(currentUser.role || localStorage.getItem('user_role') || 'user')}
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
          
          <Stack direction="row" spacing={1} sx={{ alignSelf: { xs: 'stretch', md: 'center' }, justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              component={Link}
              to="/create-player"
              startIcon={<Devices />}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Player
            </Button>
            {currentUser.role === 'bedrijfsadmin' && (
              <Button
                variant="outlined"
                component={Link}
                to="/create-user"
                startIcon={<Person />}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Gebruiker
              </Button>
            )}
            <Tooltip title="Instellingen">
              <IconButton
                color="primary"
                component={Link}
                to="/settings"
                size="large"
              >
                <SettingsIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Dashboard vernieuwen">
              <IconButton
                onClick={handleRefresh}
                disabled={isRefreshing}
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
      </Paper>

      {/* Statistics Cards */}
      <Paper elevation={0} sx={{ mb: 3, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
      <Grid container spacing={1}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 1,
              bgcolor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: 2
            }}
          >
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 700 }}>
                {companyStats.totalPlayers}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Players
              </Typography>
            </Box>
            <Devices sx={{ fontSize: 22, color: 'primary.main', opacity: 0.9 }} />
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 1,
              bgcolor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: 2
            }}
          >
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 700 }}>
                {companyStats.activePlayers}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Online
              </Typography>
            </Box>
            <Devices sx={{ fontSize: 22, color: 'success.main', opacity: 0.9 }} />
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 1,
              bgcolor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: 2
            }}
          >
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 700 }}>
                {companyStats.offlinePlayers}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Offline
              </Typography>
            </Box>
            <SignalWifiOff sx={{ fontSize: 22, color: 'error.main', opacity: 0.9 }} />
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 1,
              bgcolor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: 2
            }}
          >
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 700 }}>
                {companyStats.totalUsers}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Gebruikers
              </Typography>
            </Box>
            <Person sx={{ fontSize: 22, color: 'warning.main', opacity: 0.9 }} />
          </Paper>
        </Grid>
      </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Success Message */}
      <Snackbar
        open={Boolean(success)}
        autoHideDuration={3000}
        onClose={() => setSuccess('')}
      >
        <Alert severity="success" variant="filled">
          {success}
        </Alert>
      </Snackbar>

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
