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
  const [companyStats, setCompanyStats] = useState({
    totalPlayers: 0,
    activePlayers: 0,
    totalUsers: 0
  });
  const [error, setError] = useState('');

  const fetchCompanyData = useCallback(async () => {
    if (!user?.company_id) return;

    try {
      setError(''); // Clear any existing errors

      // Fetch company name
      const { data: companies, error: companyError } = await companyAPI.getAll();
      
      if (companyError) {
        console.error('Error fetching company:', companyError);
        throw new Error('Failed to fetch company information');
      }

      if (companies) {
        const company = companies.find(c => c.company_id === user.company_id);
        setCompanyName(company?.company_name || 'Unknown Company');
      }

      // Fetch players for this company
      const { data: players, error: playersError } = await playerAPI.getAll(user.company_id);
      
      if (playersError) {
        console.error('Error fetching players:', playersError);
        throw new Error('Failed to fetch players data');
      }

      // Fetch users for this company
      const { data: users, error: usersError } = await userAPI.getAll(user.company_id);
      
      if (usersError) {
        console.error('Error fetching users:', usersError);
        throw new Error('Failed to fetch users data');
      }

      // Calculate statistics
      const activePlayers = players?.filter(player => player.is_online) || [];
      
      setCompanyStats({
        totalPlayers: players?.length || 0,
        activePlayers: activePlayers.length,
        totalUsers: users?.length || 0
      });

    } catch (err) {
      console.error('Error in fetchCompanyData:', err);
      setError(err.message || 'Failed to load company data');
      // Set default values in case of error
      setCompanyStats({
        totalPlayers: 0,
        activePlayers: 0,
        totalUsers: 0
      });
    }
  }, [user]);

  useEffect(() => {
    fetchCompanyData();
  }, [fetchCompanyData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchCompanyData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  if (userLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (userError || !user) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {userError || 'Please log in to access the dashboard'}
        </Alert>
      </Box>
    );
  }

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

  const roleColors = getRoleColor(user.role);

  // Filter function to only show company's own data
  const filterByCompany = (data) => {
    return data.filter(item => item.company_id === user.company_id);
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
              Welcome to {companyName}
            </Typography>
            <Stack direction="row" spacing={3} alignItems="center">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Person sx={{ color: 'text.secondary', fontSize: 20 }} />
                <Typography variant="body2" color="text.secondary">
                  {user.email}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <VpnKey sx={{ color: 'text.secondary', fontSize: 20 }} />
                <Chip
                  label={user.role}
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
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' }
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
          {user.role === 'bedrijfsadmin' && (
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
        hideDeleteButtons={user.role !== 'bedrijfsadmin'}
        isCompanyDashboard={true}
        hideHeader={true}
      />
    </Box>
  );
}

export default CompanyDashboard;
