import React, { useEffect, useState, useCallback } from 'react';
import { userAPI, companyAPI, playerAPI } from '../../hooks/apiClient';
import {
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Paper,
  Chip,
  IconButton,
  Alert,
  Snackbar,
  Tab,
  Tabs,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CardHeader,
  Avatar,
  Stack,
  Divider,
  LinearProgress
} from '@mui/material';
import {
  Refresh,
  Devices,
  Person,
  Delete,
  Search
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import PlayerManagement from '../Players/PlayerManagement';
import { firebaseService } from '../../services/firebaseService';
import { secureLog } from '../../utils/secureLogger';

function SuperAdminDashboard({ filterData, hideDeleteButtons, isCompanyDashboard, hideHeader }) {
  const [currentTab, setCurrentTab] = useState(0);
  const [users, setUsers] = useState([]);
  const [newUrl, setNewUrl] = useState('');
  const [companies, setCompanies] = useState({});
  const [userCompanies, setUserCompanies] = useState({});
  const [companyOptions, setCompanyOptions] = useState([]);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState({
    players: [],
    companies: [],
    users: []
  });

  // Add scroll position management
  const handleTabChange = (event, newValue) => {
    // Store current scroll position
    const scrollPosition = window.scrollY;
    
    // Change tab
    setCurrentTab(newValue);
    
    // Restore scroll position after a brief delay to allow for component render
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollPosition);
    });
  };

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch all data in parallel using API clients
      const [playersResult, companiesResult, usersResult] = await Promise.all([
        playerAPI.getAll(),
        companyAPI.getAll(),
        userAPI.getAll()
      ]);

      // Check for errors
      if (playersResult.error) throw new Error(`Failed to fetch players: ${playersResult.error}`);
      if (companiesResult.error) throw new Error(`Failed to fetch companies: ${companiesResult.error}`);
      if (usersResult.error) throw new Error(`Failed to fetch users: ${usersResult.error}`);

      // Update state with all data
      setData({
        players: playersResult.data || [],
        companies: companiesResult.data || [],
        users: usersResult.data || []
      });

      // Update individual states
      setUsers(usersResult.data || []);
      setCompanies(companiesResult.data || []);

      // Update company options
      if (companiesResult.data) {
        const formattedCompanies = companiesResult.data.map(company => ({
          company_id: company.id || company.company_id,
          company_name: company.name || company.company_name
        }));
        setCompanyOptions(formattedCompanies);
      }

    } catch (err) {
      secureLog.error('Dashboard data fetch error', { error: err.message });
      setError(err.message || 'Er is een onverwachte fout opgetreden.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // WebSocket handler for real-time updates
  useEffect(() => {
    const handleWebSocketMessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        // Update local state based on WebSocket messages
        switch (message.type) {
          case 'player_created':
          case 'player_updated':
          case 'player_deleted':
            fetchDashboardData(); // Refresh all data as player changes might affect stats
            break;
          case 'company_created':
          case 'company_updated':
          case 'company_deleted':
            fetchDashboardData(); // Refresh all data as company changes affect multiple aspects
            break;
          case 'user_created':
          case 'user_updated':
          case 'user_deleted':
            fetchDashboardData(); // Refresh all data as user changes might affect stats
            break;
          default:
            break;
        }
      } catch (error) {
        secureLog.error('WebSocket message handling error', { error: error.message });
      }
    };

    // Subscribe to WebSocket events
    if (window.ws) {
      window.ws.addEventListener('message', handleWebSocketMessage);
    }

    return () => {
      if (window.ws) {
        window.ws.removeEventListener('message', handleWebSocketMessage);
      }
    };
  }, [fetchDashboardData]);

  const handleRefresh = () => {
    fetchDashboardData();
  };

  const fetchCompanyOptions = async () => {
    try {
      // Use companyAPI instead of mongoClient directly
      const { data, error } = await companyAPI.getAll();
      
      if (error) {
        secureLog.error('Error fetching companies:', error);
        setError('Fout bij het ophalen van bedrijven.');
        return;
      }
      
      if (data) {
        secureLog.info('Companies fetched successfully', { count: data.length });
        // Ensure we're setting the correct data structure
        const formattedData = data.map(company => ({
          company_id: company.id || company.company_id,
          company_name: company.name || company.company_name
        }));
        setCompanyOptions(formattedData);
      }
    } catch (err) {
      secureLog.error('Unexpected error:', err);
      setError('Er is een onverwachte fout opgetreden.');
    }
  };

  // Function to fetch users
  const fetchUsers = useCallback(async () => {
    try {
      // Clear any cached users to ensure fresh data
      localStorage.removeItem('cached_users');
      
      setLoading(true);
      secureLog.info('Fetching users...');
      
      // Use userService instead of mongoClient directly
      const { data, error } = await userAPI.getAll();
      
      if (error) {
        secureLog.error('Error fetching users:', error);
        setError('Fout bij het ophalen van gebruikers.');
        return;
      }
      
      if (data) {
        // Apply company filtering if provided
        let filteredData = filterData ? filterData(data) : data;
        
        // Apply company filter if selected
        if (selectedCompanyFilter) {
          filteredData = filteredData.filter(user => user.company_id === selectedCompanyFilter);
        }
        
        secureLog.info('Users data fetched successfully', {
          count: filteredData.length,
          roles: filteredData.map(u => u.role)
        });
        
        // Always update the state with new data
        setUsers(filteredData);
        
        // Create a map of user ID to company ID
        const userCompObj = {};
        filteredData.forEach((user) => {
          userCompObj[user.id || user._id] = user.company_id || '';
        });
        setUserCompanies(userCompObj);
      } else {
        secureLog.warn('No users data received');
        setUsers([]);
      }
    } catch (err) {
      secureLog.error('Unexpected error fetching users:', err);
      setError('Er is een onverwachte fout opgetreden bij het ophalen van gebruikers.');
    } finally {
      setLoading(false);
    }
  }, [filterData, selectedCompanyFilter]);

  // Force fetch users and companies when the component mounts or tab changes
  useEffect(() => {
    if (currentTab === 1) { // Users tab
      secureLog.info('Users tab activated, fetching data');
      fetchUsers();
      fetchCompanyOptions(); // Ensure we fetch companies when switching to users tab
    }
  }, [currentTab, fetchUsers]);

  // Function to update user's company
  const updateUserCompany = async (userId) => {
    try {
      if (!userCompanies[userId]) {
        setError('Selecteer een bedrijf om te koppelen aan deze gebruiker.');
        return;
      }
      
      // Update user's company using userAPI
      const { error: updateError } = await userAPI.update(userId, { 
        company_id: userCompanies[userId] 
      });
      
      if (updateError) {
        secureLog.error('User company update error', { userId, error: updateError });
        setError(`Fout bij het updaten van het bedrijf: ${updateError.message}`);
        return;
      }
      
      setSuccess('Gebruiker succesvol gekoppeld aan bedrijf!');
      fetchUsers();
    } catch (err) {
      secureLog.error('User company update error', { userId, error: err.message });
      setError('Er is een onverwachte fout opgetreden bij het updaten van de gebruiker.');
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchUsers();
    fetchCompanyOptions();

    // Set up polling interval with a longer duration
    const pollingInterval = setInterval(() => {
      // Only fetch if the tab is visible and the component is mounted
      if (document.visibilityState === 'visible') {
        if (currentTab === 0) {
          fetchDashboardData();
        } else {
          fetchUsers();
        }
      }
    }, 60000); // Poll every minute instead of 30 seconds

    // Add visibility change listener
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboardData();
        fetchUsers();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(pollingInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchDashboardData, fetchUsers, currentTab]);

  const handleDelete = async () => {
    try {
      if (!itemToDelete) {
        secureLog.warn('No item to delete');
        return;
      }

      secureLog.info('Starting deletion process', { type: deleteType });

      if (deleteType === 'user') {
        // Don't allow deleting the last superadmin
        const superadmins = users.filter(u => u.role === 'superadmin');
        if (superadmins.length === 1 && itemToDelete.role === 'superadmin') {
          secureLog.warn('Attempted to delete last superadmin');
          setError('Kan de laatste superadmin niet verwijderen.');
          handleCloseDeleteDialog();
          return;
        }

        // Ensure we have a valid user ID
        const userId = itemToDelete.id || itemToDelete._id;
        
        if (!userId) {
          secureLog.error('No valid user ID found');
          setError('Geen geldig gebruikers-ID gevonden.');
          handleCloseDeleteDialog();
          return;
        }

        secureLog.info('Deleting user', { userId });
        const { error } = await userAPI.delete(userId);
        
        if (error) {
          secureLog.error('Error deleting user:', error);
          setError(`Fout bij het verwijderen van de gebruiker: ${error}`);
          handleCloseDeleteDialog();
          return;
        }

        secureLog.info('User deleted successfully');
        // Remove user from local state
        setUsers(prevUsers => {
          const newUsers = prevUsers.filter(u => (u.id || u._id) !== userId);
          return newUsers;
        });
        
        setSuccess('Gebruiker succesvol verwijderd!');
        handleCloseDeleteDialog();
        
        // Force a refresh of the data
        await fetchUsers();
      } else if (deleteType === 'player') {
        const { error } = await playerAPI.delete(itemToDelete._id);
        
        if (error) {
          secureLog.error('Player deletion error', { error });
          setError('Fout bij het verwijderen van de player.');
          return;
        }

        // Remove player from local state
        setUsers(prevUsers => prevUsers.filter(p => p._id !== itemToDelete._id));
        setSuccess('Player succesvol verwijderd!');
        handleCloseDeleteDialog();
        await fetchDashboardData();
      }
    } catch (err) {
      secureLog.error('Deletion process error', { type: deleteType, error: err.message });
      setError('Er is een onverwachte fout opgetreden.');
    }
  };

  const openDeleteDialog = (item, type) => {
    setItemToDelete(item);
    setDeleteType(type);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setItemToDelete(null);
    setDeleteType('');
  };

  return (
    <Box sx={{ p: 3 }}>
      {!hideHeader && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            {isCompanyDashboard ? 'Company Dashboard' : 'SuperAdmin Dashboard'}
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              component={Link}
              to="/create-player"
              startIcon={<Devices />}
            >
              NEW PLAYER
            </Button>
            <Button
              variant="contained"
              component={Link}
              to="/create-user"
              startIcon={<Person />}
              color="warning"
            >
              NEW USER
            </Button>
            <IconButton onClick={handleRefresh}>
              <Refresh />
            </IconButton>
          </Stack>
        </Box>
      )}

      {/* Stats Overview */}
      {!isCompanyDashboard && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={4}>
            <Paper elevation={2} sx={{ p: 3, bgcolor: '#e3f2fd' }}>
              <Typography variant="h4" color="primary">
                {data.players.length}
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Total Players
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Paper elevation={2} sx={{ p: 3, bgcolor: '#fff3e0' }}>
              <Typography variant="h4" color="warning.main">
                {data.users.length}
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Total Users
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Paper elevation={2} sx={{ p: 3, bgcolor: '#e8f5e9' }}>
              <Typography variant="h4" color="success.main">
                {companyOptions.length}
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Total Companies
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Error Messages */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
          onClose={() => setError('')}
          variant="filled"
        >
          {error}
        </Alert>
      )}

      {/* Main Content */}
      <Paper sx={{ mb: 4 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 1 }}>
          <Tabs 
            value={currentTab} 
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{ minHeight: 48 }}
          >
            <Tab 
              icon={<Devices />} 
              label="Players" 
              sx={{ minHeight: 48 }}
            />
            <Tab 
              icon={<Person />} 
              label="Users" 
              sx={{ minHeight: 48 }}
            />
          </Tabs>
        </Box>

        <Box 
          sx={{ 
            p: 3,
            minHeight: '60vh',
            position: 'relative'
          }}
        >
          {/* Players Tab */}
          <Box
            role="tabpanel"
            hidden={currentTab !== 0}
            sx={{
              display: currentTab !== 0 ? 'none' : 'block',
              position: 'absolute',
              width: '100%',
              left: 0,
              top: 0
            }}
          >
            {currentTab === 0 && <PlayerManagement />}
          </Box>

          {/* Users Tab */}
          <Box
            role="tabpanel"
            hidden={currentTab !== 1}
            sx={{
              display: currentTab !== 1 ? 'none' : 'block',
              position: 'absolute',
              width: '100%',
              left: 0,
              top: 0
            }}
          >
            {currentTab === 1 && (
              <>
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 3
                }}>
                  <Typography variant="h6">
                    User Management
                  </Typography>
                  
                  <Stack direction="row" spacing={2}>
                    <TextField
                      size="small"
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      InputProps={{
                        startAdornment: <Search sx={{ color: 'text.secondary', mr: 1 }} />
                      }}
                    />
                    
                    <FormControl size="small">
                      <InputLabel>Filter by Company</InputLabel>
                      <Select
                        value={selectedCompanyFilter}
                        onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                        label="Filter by Company"
                      >
                        <MenuItem value="">All Companies</MenuItem>
                        {companyOptions.map((company) => (
                          <MenuItem key={company.company_id} value={company.company_id}>
                            {company.company_name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Stack>
                </Box>

                {loading ? (
                  <LinearProgress />
                ) : data.users.length === 0 ? (
                  <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="h6" color="text.secondary">
                      No users found
                    </Typography>
                  </Paper>
                ) : (
                  <Grid container spacing={3}>
                    {data.users
                      .filter(user => 
                        user.email.toLowerCase().includes(searchTerm.toLowerCase()) &&
                        (!selectedCompanyFilter || user.company_id === selectedCompanyFilter)
                      )
                      .map((user) => (
                        <Grid item xs={12} sm={6} md={4} key={user.id || user._id}>
                          <Card>
                            <CardHeader
                              avatar={
                                <Avatar>
                                  {user.email[0].toUpperCase()}
                                </Avatar>
                              }
                              action={
                                !hideDeleteButtons && (
                                  <IconButton
                                    color="error"
                                    onClick={() => openDeleteDialog(user, 'user')}
                                  >
                                    <Delete />
                                  </IconButton>
                                )
                              }
                              title={user.email}
                              subheader={
                                <Chip
                                  label={user.role}
                                  color={user.role === 'superadmin' ? 'error' : user.role === 'bedrijfsadmin' ? 'warning' : 'success'}
                                  size="small"
                                  sx={{ mt: 1 }}
                                />
                              }
                            />
                            <Divider />
                            <CardContent>
                              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                                <InputLabel>Company</InputLabel>
                                <Select
                                  value={userCompanies[user.id || user._id] || user.company_id || ''}
                                  onChange={(e) => {
                                    const userId = user.id || user._id;
                                    setUserCompanies({ ...userCompanies, [userId]: e.target.value });
                                  }}
                                  label="Company"
                                  disabled={user.role === 'superadmin'}
                                >
                                  <MenuItem value="">No Company</MenuItem>
                                  {companyOptions.map((company) => (
                                    <MenuItem key={company.company_id} value={company.company_id}>
                                      {company.company_name}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                              <Button
                                variant="contained"
                                onClick={() => updateUserCompany(user.id || user._id)}
                                fullWidth
                                disabled={user.role === 'superadmin'}
                              >
                                Update Company
                              </Button>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                  </Grid>
                )}
              </>
            )}
          </Box>
        </Box>
      </Paper>

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

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
      >
        <DialogTitle>
          {deleteType === 'user' ? 'Delete User' : 'Delete Player'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete {deleteType === 'user' ? `user ${itemToDelete?.email}` : `player ${itemToDelete?.device_id}`}?
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SuperAdminDashboard;
