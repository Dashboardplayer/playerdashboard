import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  DialogTitle,
  CardHeader,
  Avatar,
  Stack,
  Divider,
  CircularProgress,
  Tooltip,
  LinearProgress
} from '@mui/material';
import {
  Refresh,
  Devices,
  Person,
  Delete,
  Search,
  Business,
  SignalWifiOff,
  Add
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import PlayerManagement from '../Players/PlayerManagement';
import { secureLog } from '../../utils/secureLogger';
import { browserAuth } from '../../utils/browserUtils';

function SuperAdminDashboard({ filterData, hideDeleteButtons, isCompanyDashboard, hideHeader }) {
  const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
  const VISIBILITY_REFRESH_STALE_MS = 2 * 60 * 1000;
  const [currentTab, setCurrentTab] = useState(0);
  const [users, setUsers] = useState([]);
  const [userCompanies, setUserCompanies] = useState({});
  const [companyOptions, setCompanyOptions] = useState([]);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [data, setData] = useState({
    players: [],
    companies: [],
    users: []
  });
  const lastFetchRef = useRef(0);
  const refreshTimerRef = useRef(null);

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

  const fetchDashboardData = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError('');

      // Check if user is authenticated first
      const user = browserAuth.getUser();
      if (!user || !user.token) {
        throw new Error('Authentication required. Please log in again.');
      }

      // Fetch all data in parallel using API clients
      const [playersResult, playerStatsResult, companiesResult, usersResult] = await Promise.all([
        playerAPI.getAll(),
        playerAPI.getStats(),
        companyAPI.getAll(),
        userAPI.getAll()
      ]);

      // Check for errors
      if (playersResult.error) throw new Error(`Failed to fetch players: ${playersResult.error}`);
      if (playerStatsResult.error) throw new Error(`Failed to fetch player stats: ${playerStatsResult.error}`);
      if (companiesResult.error) throw new Error(`Failed to fetch companies: ${companiesResult.error}`);
      if (usersResult.error) throw new Error(`Failed to fetch users: ${usersResult.error}`);

      const filteredUsers = filterData ? filterData(usersResult.data || []) : (usersResult.data || []);

      // Update state with all data
      setData({
        players: playersResult.data || [],
        playerStats: playerStatsResult.data || null,
        companies: companiesResult.data || [],
        users: filteredUsers
      });

      // Update individual states
      setUsers(filteredUsers);

      // Update company options
      if (companiesResult.data) {
        const formattedCompanies = companiesResult.data.map(company => ({
          company_id: company.company_id || company.id || company._id,
          company_name: company.company_name || company.name
        }));
        setCompanyOptions(formattedCompanies);
      }

      const userCompObj = {};
      filteredUsers.forEach((user) => {
        userCompObj[user.id || user._id] = user.company_id || '';
      });
      setUserCompanies(userCompObj);
      lastFetchRef.current = Date.now();
      setLastUpdated(new Date());

    } catch (err) {
      secureLog.error('Dashboard data fetch error', { error: err.message });
      
      // Check if this is an authentication error
      if (err.message.includes('Authentication required') || err.message.includes('No authentication')) {
        // Redirect to login if this is an authentication error
        window.location.href = '/login';
        return;
      }
      
      setError(err.message || 'Er is een onverwachte fout opgetreden.');
    } finally {
      setLoading(false);
      if (silent) setIsRefreshing(false);
    }
  }, [filterData]);

  const scheduleDashboardRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = setTimeout(() => {
      fetchDashboardData({ silent: true });
    }, 1200);
  }, [fetchDashboardData]);

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // WebSocket handler for real-time updates
  useEffect(() => {
    const handleWebSocketMessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        secureLog.debug('WebSocket message received', {
          type: message?.type,
          hasData: !!message?.data
        });

        // Get message type safely and convert to lowercase for comparison
        const messageType = message?.type?.toLowerCase();

        // Update local state based on WebSocket messages
        switch (messageType) { // Use the lowercased, safe type
          case 'player_created':
            setData(prevData => ({
              ...prevData,
              players: [...prevData.players, message.data]
            }));
            break;
          case 'player_updated':
            // Ensure data and _id or id exist before proceeding
            const playerId = message.data?._id || message.data?.id;
            if (playerId) {
              setData(prevData => ({
                ...prevData,
                players: prevData.players.map(player => 
                  (player._id === playerId || player.id === playerId) ? { ...player, ...message.data } : player
                )
              }));
            } else {
              secureLog.warn('Received player_updated message with missing data or id', {
                type: message.type,
                hasData: !!message.data
              });
            }
            break;
          case 'player_deleted':
            if (message.data && message.data.id) {
              setData(prevData => ({
                ...prevData,
                players: prevData.players.filter(player => player._id !== message.data.id)
              }));
            } else {
              secureLog.warn('Received player_deleted message with missing data or id', {
                type: message.type,
                hasData: !!message.data
              });
            }
            break;
          case 'company_created':
          case 'company_updated':
          case 'company_deleted':
            scheduleDashboardRefresh();
            break;
          case 'user_created':
          case 'user_updated':
          case 'user_deleted':
            scheduleDashboardRefresh();
            break;
          default:
            secureLog.debug('Received unknown WebSocket message type', { type: message.type });
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
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [scheduleDashboardRefresh]);

  const handleRefresh = async () => {
    await fetchDashboardData({ silent: true });
    setSuccess('Dashboard vernieuwd.');
  };

  // Function to update user's company
  const updateUserCompany = async (userId, companyId) => {
    try {
      // Update user's company using userAPI
      const { error: updateError } = await userAPI.update(userId, { 
        company_id: companyId 
      });
      
      if (updateError) {
        secureLog.error('User company update error', { userId, error: updateError });
        setError(`Bedrijf bijwerken mislukt: ${updateError.message || updateError}`);
        return;
      }
      
      setSuccess('Gebruiker bijgewerkt.');
      fetchDashboardData();
    } catch (err) {
      secureLog.error('User company update error', { userId, error: err.message });
      setError('Er is een onverwachte fout opgetreden bij het bijwerken van de gebruiker.');
    }
  };

  useEffect(() => {
    // Set up polling interval with a longer duration
    const pollingInterval = setInterval(() => {
      // Only fetch if the tab is visible and the component is mounted
      if (document.visibilityState === 'visible') {
        fetchDashboardData({ silent: true });
      }
    }, REFRESH_INTERVAL_MS);

    // Add visibility change listener
    const handleVisibilityChange = () => {
      const stale = Date.now() - lastFetchRef.current > VISIBILITY_REFRESH_STALE_MS;
      if (document.visibilityState === 'visible' && stale) {
        fetchDashboardData({ silent: true });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(pollingInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchDashboardData, REFRESH_INTERVAL_MS, VISIBILITY_REFRESH_STALE_MS]);

  const dashboardStats = useMemo(() => {
    const totalPlayers = data.playerStats?.totalPlayers ?? data.players.length;
    const onlinePlayers = data.playerStats?.activePlayers ?? data.players.filter(player => player.is_online).length;
    const offlinePlayers = data.playerStats?.offlinePlayers ?? Math.max(totalPlayers - onlinePlayers, 0);

    return [
      { label: 'Players', value: totalPlayers, icon: Devices, color: 'primary.main' },
      { label: 'Online', value: onlinePlayers, icon: Devices, color: 'success.main' },
      { label: 'Offline', value: offlinePlayers, icon: SignalWifiOff, color: 'error.main' },
      { label: 'Bedrijven', value: companyOptions.length, icon: Business, color: 'text.primary' },
      { label: 'Gebruikers', value: data.users.length, icon: Person, color: 'text.primary' }
    ];
  }, [data.playerStats, data.players, data.users.length, companyOptions.length]);

  const getRoleLabel = useCallback((role) => {
    switch (role) {
      case 'superadmin':
        return 'Superadmin';
      case 'bedrijfsadmin':
        return 'Bedrijfsadmin';
      default:
        return 'Gebruiker';
    }
  }, []);

  const getCompanyName = useCallback((companyId) => {
    if (!companyId) return 'Geen bedrijf';
    return companyOptions.find(company => company.company_id === companyId)?.company_name || 'Onbekend bedrijf';
  }, [companyOptions]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return users.filter(user => {
      const email = user.email || '';
      const role = getRoleLabel(user.role);
      const companyName = getCompanyName(user.company_id);
      const matchesSearch = !normalizedSearch || [email, role, companyName]
        .some(value => value.toLowerCase().includes(normalizedSearch));
      const matchesCompany = !selectedCompanyFilter || user.company_id === selectedCompanyFilter;

      return matchesSearch && matchesCompany;
    });
  }, [users, searchTerm, selectedCompanyFilter, getRoleLabel, getCompanyName]);

  const handleDelete = async () => {
    try {
      if (!itemToDelete) {
        secureLog.warn('No item to delete');
        return;
      }

      if (deleteConfirmation !== 'VERWIJDEREN') {
        setError('Typ VERWIJDEREN om de gebruiker definitief te verwijderen.');
        return;
      }

      secureLog.info('Starting user deletion process');

      // Don't allow deleting the last superadmin
      const superadmins = users.filter(u => u.role === 'superadmin');
      if (superadmins.length === 1 && itemToDelete.role === 'superadmin') {
        secureLog.warn('Attempted to delete last superadmin');
        setError('De laatste superadmin kan niet verwijderd worden.');
        handleCloseDeleteDialog();
        return;
      }

      // Ensure we have a valid user ID
      const userId = itemToDelete.id || itemToDelete._id;
      
      if (!userId) {
        secureLog.error('No valid user ID found');
        setError('Geen geldige gebruiker gevonden.');
        handleCloseDeleteDialog();
        return;
      }

      secureLog.info('Deleting user', { userId });
      const { error } = await userAPI.delete(userId);
      
      if (error) {
        secureLog.error('Error deleting user:', error);
        setError(`Gebruiker verwijderen mislukt: ${error}`);
        handleCloseDeleteDialog();
        return;
      }

      secureLog.info('User deleted successfully');
      setUsers(prevUsers => prevUsers.filter(u => (u.id || u._id) !== userId));
      setData(prevData => ({
        ...prevData,
        users: prevData.users.filter(u => (u.id || u._id) !== userId)
      }));
      
      setSuccess('Gebruiker verwijderd.');
      handleCloseDeleteDialog();
      await fetchDashboardData();
    } catch (err) {
      secureLog.error('Deletion process error', { error: err.message });
      setError('Er is een onverwachte fout opgetreden.');
    }
  };

  const openDeleteDialog = (item) => {
    setItemToDelete(item);
    setDeleteConfirmation('');
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setItemToDelete(null);
    setDeleteConfirmation('');
  };

  return (
    <Box sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 }, bgcolor: '#f6f8fb', minHeight: '100vh' }}>
      {!hideHeader && (
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
            gap: 2,
            flexDirection: { xs: 'column', md: 'row' },
            mb: 2
          }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
                {isCompanyDashboard ? 'Bedrijfsdashboard' : 'Superadmin dashboard'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Rustige live-status. Automatisch verversen elke 5 minuten.
                {lastUpdated ? ` Laatst bijgewerkt: ${lastUpdated.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}` : ''}
              </Typography>
            </Box>
            
            <Stack direction="row" spacing={1} sx={{ alignSelf: { xs: 'stretch', md: 'center' }, justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                component={Link}
                to="/create-player"
                startIcon={<Add />}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Player
              </Button>
              <Button
                variant="outlined"
                component={Link}
                to="/create-user"
                startIcon={<Person />}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Gebruiker
              </Button>
              <Tooltip title="Dashboard vernieuwen">
                <IconButton
                  onClick={handleRefresh}
                  color="primary"
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
      )}

      {/* Stats Overview */}
      {!isCompanyDashboard && (
        <Paper
          elevation={0}
          sx={{
            mb: 3,
            p: 1.5,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper'
          }}
        >
          <Grid container spacing={1}>
            {dashboardStats.map(({ label, value, icon: Icon, color }) => (
              <Grid item xs={6} sm={4} md={2.4} key={label}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1, py: 1 }}>
                  <Icon sx={{ color, fontSize: 22, opacity: 0.9 }} />
                  <Box>
                    <Typography variant="h6" sx={{ lineHeight: 1.1, fontWeight: 700 }}>
                      {value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {label}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Paper>
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

      {/* Initial Loading State */}
      {loading && data.players.length === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <Stack spacing={2} alignItems="center">
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Dashboard laden...
            </Typography>
          </Stack>
        </Box>
      )}

      {/* Main Content */}
      {(!loading || data.players.length > 0) && (
      <Paper elevation={0} sx={{ mb: 4, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
        {isRefreshing && <LinearProgress sx={{ height: 2 }} />}
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
              label="Gebruikers" 
              sx={{ minHeight: 48 }}
            />
          </Tabs>
        </Box>

        <Box 
          sx={{ 
            p: { xs: 2, md: 3 },
            minHeight: '60vh',
            position: 'relative'
          }}
        >
          {/* Players Tab */}
          <Box
            role="tabpanel"
            hidden={currentTab !== 0}
            sx={{ display: currentTab !== 0 ? 'none' : 'block' }}
          >
            {currentTab === 0 && (
              <>
                <PlayerManagement companies={companyOptions} compactSummary />
              </>
            )}
          </Box>

          {/* Users Tab */}
          <Box
            role="tabpanel"
            hidden={currentTab !== 1}
            sx={{ display: currentTab !== 1 ? 'none' : 'block' }}
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
                    Gebruikersbeheer
                    <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                      ({filteredUsers.length} van {users.length})
                    </Typography>
                  </Typography>
                  
                  <Stack 
                    direction={{ xs: 'column', sm: 'row' }} 
                    spacing={2} 
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                  >
                    <TextField
                      size="small"
                      placeholder="Zoek op e-mail, rol of bedrijf..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      sx={{ width: { xs: '100%', sm: 250 } }}
                      InputProps={{
                        startAdornment: <Search sx={{ color: 'text.secondary', mr: 1 }} />
                      }}
                    />
                    
                    <FormControl size="small" sx={{ width: { xs: '100%', sm: 200 } }}>
                      <InputLabel>Filter op bedrijf</InputLabel>
                      <Select
                        value={selectedCompanyFilter}
                        onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                        label="Filter op bedrijf"
                      >
                        <MenuItem value="">Alle bedrijven</MenuItem>
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
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
                    <Stack spacing={2} alignItems="center">
                      <CircularProgress />
                      <Typography variant="body2" color="text.secondary">
                        Gebruikers laden...
                      </Typography>
                    </Stack>
                  </Box>
                ) : users.length === 0 ? (
                  <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="h6" color="text.secondary">
                      Geen gebruikers gevonden
                    </Typography>
                  </Paper>
                ) : filteredUsers.length === 0 ? (
                  <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="h6" color="text.secondary">
                      Geen gebruikers gevonden voor deze zoekopdracht
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Pas je zoekterm of bedrijfsfilter aan.
                    </Typography>
                  </Paper>
                ) : (
                  <Grid container spacing={2}>
                    {filteredUsers.map((user) => {
                      const userId = user.id || user._id;
                      const selectedCompany = userCompanies[userId] ?? user.company_id ?? '';
                      const companyChanged = selectedCompany !== (user.company_id || '');

                      return (
                        <Grid item xs={12} sm={6} md={4} lg={3} key={user.id || user._id}>
                          <Card sx={{ height: '100%' }}>
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
                                    onClick={() => openDeleteDialog(user)}
                                  >
                                    <Delete />
                                  </IconButton>
                                )
                              }
                              title={user.email}
                              subheader={
                                <Chip
                                  label={getRoleLabel(user.role)}
                                  color={user.role === 'superadmin' ? 'error' : user.role === 'bedrijfsadmin' ? 'warning' : 'success'}
                                  size="small"
                                  sx={{ mt: 1 }}
                                />
                              }
                            />
                            <Divider />
                            <CardContent>
                              <FormControl fullWidth size="small">
                                <InputLabel>Bedrijf</InputLabel>
                                <Select
                                  value={selectedCompany}
                                  onChange={(e) => {
                                    setUserCompanies({ ...userCompanies, [userId]: e.target.value });
                                  }}
                                  label="Bedrijf"
                                  disabled={user.role === 'superadmin'}
                                >
                                  <MenuItem value="">Geen bedrijf</MenuItem>
                                  {companyOptions.map((company) => (
                                    <MenuItem key={company.company_id} value={company.company_id}>
                                      {company.company_name}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                              {user.role !== 'superadmin' && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  disabled={!companyChanged}
                                  onClick={() => updateUserCompany(userId, selectedCompany)}
                                  sx={{ mt: 2 }}
                                  fullWidth
                                >
                                  Bedrijf opslaan
                                </Button>
                              )}
                            </CardContent>
                          </Card>
                        </Grid>
                      );
                    })}
                  </Grid>
                )}
              </>
            )}
          </Box>
        </Box>
      </Paper>
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

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Gebruiker verwijderen
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Je verwijdert gebruiker {itemToDelete?.email}. Deze actie kan niet ongedaan gemaakt worden.
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Typ VERWIJDEREN om deze gebruiker definitief te verwijderen.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            value={deleteConfirmation}
            onChange={(event) => setDeleteConfirmation(event.target.value)}
            placeholder="VERWIJDEREN"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>
            Annuleren
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={deleteConfirmation !== 'VERWIJDEREN'}
          >
            Definitief verwijderen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SuperAdminDashboard;
