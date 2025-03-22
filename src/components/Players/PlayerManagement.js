import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Chip,
  IconButton,
  Button,
  Collapse,
  Pagination,
  Paper,
  Divider,
  Tooltip,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  DevicesOther as DeviceIcon,
  Business as BusinessIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Camera as ScreenshotIcon,
  SystemUpdate as UpdateIcon,
  Circle as CircleIcon,
  AccessTime as AccessTimeIcon,
  CalendarToday as CalendarTodayIcon,
  Link as LinkIcon,
  Clear,
  ArrowUpward,
  ArrowDownward,
} from '@mui/icons-material';
import { playerAPI, companyAPI } from '../../hooks/apiClient';

const ITEMS_PER_PAGE = 12;

// PlayerCard component moved outside
const PlayerCard = ({ 
  player, 
  company, 
  editingUrl, 
  setEditingUrl, 
  handleUrlUpdate, 
  handleDetailsClick,
  onDelete 
}) => {
  const [tempUrl, setTempUrl] = useState(player.current_url || '');
  const isEditing = editingUrl[player._id];

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="h6" component="div" sx={{ display: 'flex', alignItems: 'center' }}>
            <DeviceIcon sx={{ mr: 1 }} />
            {player.device_id}
          </Typography>
          <Chip
            label={player.is_online ? 'Online' : 'Offline'}
            color={player.is_online ? 'success' : 'error'}
            size="small"
          />
        </Box>

        {company && (
          <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <BusinessIcon sx={{ mr: 1, fontSize: 'small' }} />
            {company.company_name}
          </Typography>
        )}

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            URL:
          </Typography>
          {isEditing ? (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                size="small"
                fullWidth
                value={tempUrl}
                onChange={(e) => setTempUrl(e.target.value)}
                placeholder="Enter URL"
              />
              <IconButton 
                size="small" 
                color="primary"
                onClick={() => handleUrlUpdate(player._id, tempUrl)}
              >
                <SaveIcon />
              </IconButton>
              <IconButton 
                size="small" 
                onClick={() => {
                  setEditingUrl({ ...editingUrl, [player._id]: false });
                  setTempUrl(player.current_url || '');
                }}
              >
                <CancelIcon />
              </IconButton>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                {player.current_url || 'Not set'}
              </Typography>
              <IconButton 
                size="small"
                onClick={() => setEditingUrl({ ...editingUrl, [player._id]: true })}
              >
                <EditIcon />
              </IconButton>
            </Box>
          )}
        </Box>

        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
          <Button 
            size="small" 
            variant="outlined"
            onClick={() => handleDetailsClick(player)}
          >
            Details
          </Button>
          <IconButton 
            size="small" 
            color="error"
            onClick={() => onDelete(player)}
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
};

// PlayerDetailsDialog component moved outside
const PlayerDetailsDialog = ({ 
  open, 
  onClose, 
  player, 
  company, 
  onUrlUpdate, 
  onCommand, 
  setError 
}) => {
  const [localUrl, setLocalUrl] = useState(player?.current_url || '');
  const [isEditingUrl, setIsEditingUrl] = useState(false);

  useEffect(() => {
    setLocalUrl(player?.current_url || '');
  }, [player]);

  const handleUrlSave = async () => {
    try {
      await onUrlUpdate(player.id, localUrl);
      setIsEditingUrl(false);
    } catch (err) {
      setError('Failed to update URL');
    }
  };

  if (!player) return null;

  const InfoItem = ({ label, value, icon, chip }) => (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'flex-start',
      p: 1.5,
      '&:not(:last-child)': {
        borderBottom: 1,
        borderColor: 'divider'
      }
    }}>
      {icon && (
        <Box sx={{ mr: 2, color: 'text.secondary', pt: 0.25 }}>
          {icon}
        </Box>
      )}
      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
          {label}
        </Typography>
        {chip ? (
          <Box sx={{ mt: 0.5 }}>
            {value}
          </Box>
        ) : (
          <Typography variant="body1" sx={{ wordBreak: 'break-all' }}>
            {value || 'Not set'}
          </Typography>
        )}
      </Box>
    </Box>
  );

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{ 
        borderBottom: 1, 
        borderColor: 'divider',
        bgcolor: 'background.paper',
        position: 'sticky',
        top: 0,
        zIndex: 1
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <DeviceIcon sx={{ mr: 2 }} />
          <Typography variant="h6">
            Player Details
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <Grid container spacing={0}>
          {/* Basic Information */}
          <Grid item xs={12} md={6}>
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ px: 1.5, mb: 2 }}>
                Basic Information
              </Typography>
              <Paper variant="outlined" sx={{ bgcolor: 'background.paper' }}>
                <InfoItem 
                  label="Device ID"
                  value={player.device_id}
                  icon={<DeviceIcon fontSize="small" />}
                />
                <InfoItem 
                  label="Status"
                  value={
                    <Chip
                      label={player.is_online ? 'Online' : 'Offline'}
                      color={player.is_online ? 'success' : 'error'}
                      size="small"
                      sx={{ minWidth: 80 }}
                    />
                  }
                  icon={<CircleIcon fontSize="small" />}
                  chip
                />
                <InfoItem 
                  label="Company"
                  value={company ? company.company_name : 'Not assigned'}
                  icon={<BusinessIcon fontSize="small" />}
                />
                <InfoItem 
                  label="Last Seen"
                  value={player.last_seen ? new Date(player.last_seen).toLocaleString() : 'Never'}
                  icon={<AccessTimeIcon fontSize="small" />}
                />
                <InfoItem 
                  label="Created At"
                  value={new Date(player.createdAt).toLocaleString()}
                  icon={<CalendarTodayIcon fontSize="small" />}
                />
              </Paper>
            </Box>
          </Grid>

          {/* URL Management */}
          <Grid item xs={12} md={6} sx={{ borderLeft: { md: 1 }, borderColor: 'divider' }}>
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ px: 1.5, mb: 2 }}>
                URL Management
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.paper' }}>
                {isEditingUrl ? (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      value={localUrl}
                      onChange={(e) => setLocalUrl(e.target.value)}
                      placeholder="Enter URL"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LinkIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                    <IconButton 
                      color="primary"
                      onClick={handleUrlSave}
                      sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}
                    >
                      <SaveIcon />
                    </IconButton>
                    <IconButton 
                      onClick={() => {
                        setIsEditingUrl(false);
                        setLocalUrl(player.current_url || '');
                      }}
                    >
                      <CancelIcon />
                    </IconButton>
                  </Box>
                ) : (
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                      Current URL
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinkIcon color="action" sx={{ fontSize: '1.2rem' }} />
                      <Typography 
                        variant="body1" 
                        sx={{ 
                          flex: 1,
                          wordBreak: 'break-all',
                          fontFamily: 'monospace'
                        }}
                      >
                        {player.current_url || 'Not set'}
                      </Typography>
                      <IconButton 
                        size="small"
                        onClick={() => setIsEditingUrl(true)}
                        sx={{ ml: 1 }}
                      >
                        <EditIcon />
                      </IconButton>
                    </Box>
                  </Box>
                )}
              </Paper>
            </Box>
          </Grid>

          {/* Device Management */}
          <Grid item xs={12}>
            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="h6" gutterBottom sx={{ px: 1.5, mb: 2 }}>
                Device Management
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.paper' }}>
                <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={() => onCommand(player._id, 'RESTART')}
                  >
                    Restart Device
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<ScreenshotIcon />}
                    onClick={() => onCommand(player._id, 'SCREENSHOT')}
                  >
                    Take Screenshot
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<UpdateIcon />}
                    onClick={() => onCommand(player._id, 'UPDATE_APK')}
                  >
                    Update APK
                  </Button>
                </Stack>
              </Paper>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ 
        borderTop: 1, 
        borderColor: 'divider',
        p: 2,
        bgcolor: 'background.paper',
        position: 'sticky',
        bottom: 0,
        zIndex: 1
      }}>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Add BulkEditDialog component before PlayerManagement function
const BulkEditDialog = ({ 
  open, 
  onClose, 
  players, 
  companies,
  onBulkUrlUpdate,
  onBulkCommand,
  setError,
  setSuccess 
}) => {
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [editedUrls, setEditedUrls] = useState({});
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    companyId: 'all',
    status: 'all',
    lastSeen: 'all'
  });
  const ROWS_PER_PAGE = 10;

  useEffect(() => {
    // Reset state when dialog opens
    if (open) {
      setSelectedPlayers([]);
      setEditedUrls({});
      setPage(1);
      setSearchQuery('');
      setFilters({
        companyId: 'all',
        status: 'all',
        lastSeen: 'all'
      });
    }
  }, [open]);

  // Filter players based on search query and filters
  const filteredPlayers = useMemo(() => {
    return players.filter(player => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        player.device_id.toLowerCase().includes(searchLower) ||
        (player.current_url || '').toLowerCase().includes(searchLower) ||
        companies.find(c => c.company_id === player.company_id)?.company_name.toLowerCase().includes(searchLower);
      
      if (!matchesSearch) return false;

      // Company filter
      if (filters.companyId !== 'all') {
        if (filters.companyId === 'none') {
          if (player.company_id) return false;
        } else if (player.company_id !== filters.companyId) {
          return false;
        }
      }

      // Status filter
      if (filters.status !== 'all') {
        if (filters.status === 'online' && !player.is_online) return false;
        if (filters.status === 'offline' && player.is_online) return false;
      }

      // Last seen filter
      if (filters.lastSeen !== 'all') {
        if (!player.last_seen) return false;
        
        const now = new Date();
        const lastSeen = new Date(player.last_seen);
        const hoursDiff = (now - lastSeen) / (1000 * 60 * 60);
        
        switch (filters.lastSeen) {
          case '1h':
            if (hoursDiff > 1) return false;
            break;
          case '24h':
            if (hoursDiff > 24) return false;
            break;
          case '7d':
            if (hoursDiff > 24 * 7) return false;
            break;
          case '30d':
            if (hoursDiff > 24 * 30) return false;
            break;
          default:
            break;
        }
      }

      return true;
    });
  }, [players, companies, searchQuery, filters]);

  // Get current page players
  const currentPlayers = useMemo(() => {
    const startIndex = (page - 1) * ROWS_PER_PAGE;
    return filteredPlayers.slice(startIndex, startIndex + ROWS_PER_PAGE);
  }, [filteredPlayers, page]);

  const pageCount = Math.ceil(filteredPlayers.length / ROWS_PER_PAGE);

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelectedPlayers(players.map(player => player._id));
    } else {
      setSelectedPlayers([]);
    }
  };

  const handleSelectPlayer = (playerId) => {
    setSelectedPlayers(prev => {
      if (prev.includes(playerId)) {
        return prev.filter(id => id !== playerId);
      } else {
        return [...prev, playerId];
      }
    });
  };

  const handleUrlChange = (playerId, newUrl) => {
    setEditedUrls(prev => ({
      ...prev,
      [playerId]: newUrl
    }));
  };

  const handleSaveAll = async () => {
    if (Object.keys(editedUrls).length === 0) {
      setError('No URLs have been modified');
      return;
    }

    setLoading(true);
    try {
      // Only update URLs that have been modified
      await Promise.all(
        Object.entries(editedUrls).map(([playerId, url]) =>
          playerAPI.update(playerId, { current_url: url })
        )
      );
      
      setSuccess('All URLs updated successfully');
      setEditedUrls({});
      onClose(); // Close dialog after successful save
    } catch (err) {
      setError('Failed to update URLs: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkCommand = async (command) => {
    if (selectedPlayers.length === 0) {
      setError('Please select players first');
      return;
    }

    setLoading(true);
    try {
      await onBulkCommand(selectedPlayers, command);
      setSuccess(`${command} command sent to selected players`);
    } catch (err) {
      setError(`Failed to send ${command} command: ` + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: {
          height: '90vh',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Bulk Edit Players</Typography>
          <Typography variant="subtitle2">
            Selected: {selectedPlayers.length} of {players.length}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 3 }}>
        {/* Search and Filters Section */}
        <Paper sx={{ p: 2 }}>
          <Grid container spacing={2}>
            {/* Search Field - Full Width */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search players by device ID, URL, or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchQuery('')}>
                        <Clear />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>

            {/* Filters Row */}
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Company</InputLabel>
                <Select
                  value={filters.companyId}
                  label="Company"
                  onChange={(e) => setFilters({ ...filters, companyId: e.target.value })}
                >
                  <MenuItem value="all">All Companies</MenuItem>
                  <MenuItem value="none">No Company</MenuItem>
                  <Divider />
                  {companies.map((company) => (
                    <MenuItem key={company.company_id} value={company.company_id}>
                      {company.company_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  label="Status"
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="online">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircleIcon sx={{ color: 'success.main', fontSize: 12 }} />
                      Online
                    </Box>
                  </MenuItem>
                  <MenuItem value="offline">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircleIcon sx={{ color: 'error.main', fontSize: 12 }} />
                      Offline
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Last Seen</InputLabel>
                <Select
                  value={filters.lastSeen}
                  label="Last Seen"
                  onChange={(e) => setFilters({ ...filters, lastSeen: e.target.value })}
                >
                  <MenuItem value="all">All Time</MenuItem>
                  <MenuItem value="1h">Last Hour</MenuItem>
                  <MenuItem value="24h">Last 24 Hours</MenuItem>
                  <MenuItem value="7d">Last 7 Days</MenuItem>
                  <MenuItem value="30d">Last 30 Days</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  fullWidth
                  size="small"
                  variant="outlined"
                  onClick={() => setFilters({
                    companyId: 'all',
                    status: 'all',
                    lastSeen: 'all'
                  })}
                  startIcon={<Clear />}
                >
                  Clear Filters
                </Button>
              </Box>
            </Grid>
          </Grid>

          {/* Filter Summary and Actions */}
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {filteredPlayers.length} players found
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => handleBulkCommand('RESTART')}
                disabled={loading || selectedPlayers.length === 0}
              >
                Restart Selected
              </Button>
              <Button
                variant="outlined"
                startIcon={<UpdateIcon />}
                onClick={() => handleBulkCommand('UPDATE_APK')}
                disabled={loading || selectedPlayers.length === 0}
              >
                Update APK
              </Button>
            </Box>
          </Box>
        </Paper>

        {/* Players Table */}
        <TableContainer component={Paper} sx={{ flex: 1 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedPlayers.length > 0 && selectedPlayers.length < filteredPlayers.length}
                    checked={filteredPlayers.length > 0 && selectedPlayers.length === filteredPlayers.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>Device ID</TableCell>
                <TableCell>Company</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Seen</TableCell>
                <TableCell>URL</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {currentPlayers.map((player) => {
                const company = companies.find(c => c.company_id === player.company_id);
                const hasUrlChanged = editedUrls[player._id] !== undefined;
                return (
                  <TableRow key={player._id}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedPlayers.includes(player._id)}
                        onChange={() => handleSelectPlayer(player._id)}
                      />
                    </TableCell>
                    <TableCell>{player.device_id}</TableCell>
                    <TableCell>{company?.company_name || 'No Company'}</TableCell>
                    <TableCell>
                      <Chip
                        label={player.is_online ? 'Online' : 'Offline'}
                        color={player.is_online ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {player.last_seen ? new Date(player.last_seen).toLocaleString() : 'Never'}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <TextField
                          size="small"
                          fullWidth
                          value={editedUrls[player._id] !== undefined ? editedUrls[player._id] : player.current_url || ''}
                          onChange={(e) => handleUrlChange(player._id, e.target.value)}
                          placeholder="Enter URL"
                          disabled={loading}
                          sx={{
                            backgroundColor: hasUrlChanged ? 'action.hover' : 'transparent',
                          }}
                        />
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 2 }}>
          <Pagination
            count={pageCount}
            page={page}
            onChange={(e, newPage) => setPage(newPage)}
            color="primary"
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ 
        borderTop: 1, 
        borderColor: 'divider',
        p: 2,
        bgcolor: 'background.paper',
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <Button 
            variant="contained" 
            color="primary"
            onClick={handleSaveAll}
            disabled={loading || Object.keys(editedUrls).length === 0}
          >
            Save All Changes
          </Button>
          <Button onClick={onClose} disabled={loading}>Close</Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

function PlayerManagement() {
  // State for players and companies
  const [players, setPlayers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // State for filtering and search
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    companyId: 'all',
    onlineStatus: 'all',
    urlStatus: 'all',
    lastSeen: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);

  // State for sorting and pagination
  const [sortBy, setSortBy] = useState('deviceId');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);

  // State for company grouping
  const [expandedCompanies, setExpandedCompanies] = useState({});

  // State for URL editing
  const [editingUrl, setEditingUrl] = useState({});
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // State for delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState(null);

  // State for bulk edit dialog
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);

  // Fetch players and companies
  const fetchData = async () => {
    setLoading(true);
    try {
      const [playersRes, companiesRes] = await Promise.all([
        playerAPI.getAll(),
        companyAPI.getAll()
      ]);

      if (playersRes.error) throw new Error(playersRes.error);
      if (companiesRes.error) throw new Error(companiesRes.error);

      setPlayers(playersRes.data || []);
      setCompanies(companiesRes.data || []);

      // Initialize expanded state for all companies
      const expandedState = {};
      companiesRes.data?.forEach(company => {
        expandedState[company.company_id] = true;
      });
      setExpandedCompanies(expandedState);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Add effect to refresh data periodically
  useEffect(() => {
    // Initial fetch
    fetchData();

    // Set up periodic refresh every 30 seconds
    const refreshInterval = setInterval(fetchData, 30000);

    // Cleanup on unmount
    return () => clearInterval(refreshInterval);
  }, []); // Empty dependency array means this runs once on mount

  // Filter and sort players
  const filteredAndSortedPlayers = useMemo(() => {
    let result = [...players];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(player =>
        player.device_id.toLowerCase().includes(query) ||
        player.current_url?.toLowerCase().includes(query) ||
        companies.find(c => c.company_id === player.company_id)?.company_name.toLowerCase().includes(query)
      );
    }

    // Apply company filter
    if (filters.companyId !== 'all') {
      if (filters.companyId === 'none') {
        result = result.filter(player => !player.company_id);
      } else {
        result = result.filter(player => player.company_id === filters.companyId);
      }
    }

    // Apply online status filter
    if (filters.onlineStatus !== 'all') {
      result = result.filter(player =>
        filters.onlineStatus === 'online' ? player.is_online : !player.is_online
      );
    }

    // Apply URL status filter
    if (filters.urlStatus !== 'all') {
      result = result.filter(player =>
        filters.urlStatus === 'with_url' 
          ? player.current_url && player.current_url.trim() !== ''
          : !player.current_url || player.current_url.trim() === ''
      );
    }

    // Apply last seen filter
    if (filters.lastSeen !== 'all') {
      const now = new Date();
      const getTimeLimit = () => {
        switch (filters.lastSeen) {
          case '1h':
            return 60 * 60 * 1000; // 1 hour in milliseconds
          case '24h':
            return 24 * 60 * 60 * 1000; // 24 hours in milliseconds
          case '7d':
            return 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
          case '30d':
            return 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
          default:
            return 0;
        }
      };
      
      const timeLimit = getTimeLimit();
      result = result.filter(player => {
        if (!player.last_seen) return false;
        const lastSeenDate = new Date(player.last_seen);
        return (now - lastSeenDate) <= timeLimit;
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      let compareResult = 0;
      switch (sortBy) {
        case 'deviceId':
          compareResult = a.device_id.localeCompare(b.device_id);
          break;
        case 'company':
          const companyA = companies.find(c => c.company_id === a.company_id)?.company_name || '';
          const companyB = companies.find(c => c.company_id === b.company_id)?.company_name || '';
          compareResult = companyA.localeCompare(companyB);
          break;
        case 'status':
          compareResult = (a.is_online === b.is_online) ? 0 : a.is_online ? -1 : 1;
          break;
        case 'lastSeen':
          const dateA = a.last_seen ? new Date(a.last_seen) : new Date(0);
          const dateB = b.last_seen ? new Date(b.last_seen) : new Date(0);
          compareResult = dateB - dateA; // Most recent first
          break;
        default:
          compareResult = 0;
      }
      return sortOrder === 'asc' ? compareResult : -compareResult;
    });

    return result;
  }, [players, searchQuery, filters, sortBy, sortOrder, companies]);

  // Group players by company
  const groupedPlayers = useMemo(() => {
    const groups = {
      noCompany: {
        players: filteredAndSortedPlayers.filter(p => !p.company_id),
      }
    };

    companies.forEach(company => {
      groups[company.company_id] = {
        company,
        players: filteredAndSortedPlayers.filter(p => p.company_id === company.company_id),
      };
    });

    return groups;
  }, [filteredAndSortedPlayers, companies]);

  // Handle company expansion toggle
  const toggleCompanyExpansion = (companyId) => {
    setExpandedCompanies(prev => ({
      ...prev,
      [companyId]: !prev[companyId]
    }));
  };

  const handleUrlUpdate = async (playerId, newUrl) => {
    try {
      const { error } = await playerAPI.update(playerId, { current_url: newUrl });
      if (error) throw new Error(error);
      
      // Update local state
      setPlayers(players.map(p => 
        p._id === playerId ? { ...p, current_url: newUrl } : p
      ));
      setEditingUrl({ ...editingUrl, [playerId]: false });
      setSuccess('URL successfully updated');
    } catch (err) {
      setError('Failed to update URL: ' + err.message);
    }
  };

  const handleDeleteClick = (player) => {
    if (!player || !player._id) {
      console.error('Invalid player object:', player);
      setError('Cannot delete player - invalid player data');
      return;
    }

    console.log('Attempting to delete player:', player);
    console.log('Player ID:', player._id);
    console.log('Full player object:', JSON.stringify(player, null, 2));
    
    setPlayerToDelete(player);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!playerToDelete) {
      console.error('No player selected for deletion');
      return;
    }

    console.log('Starting player deletion process...');
    console.log('Player to delete:', {
      id: playerToDelete._id,
      device_id: playerToDelete.device_id,
      company_id: playerToDelete.company_id
    });

    if (!playerToDelete._id) {
      setError('Invalid player ID - cannot delete player');
      console.error('Player object is missing _id:', playerToDelete);
      return;
    }

    try {
      // Proceed with deletion
      console.log('Attempting to delete player from database...');
      const { error } = await playerAPI.delete(playerToDelete._id);
      if (error) throw new Error(error);
      
      // Fetch fresh data from the server
      await fetchData();
      
      setSuccess('Player successfully deleted');
      setDeleteDialogOpen(false);
      setPlayerToDelete(null);
    } catch (err) {
      console.error('Failed to delete player:', err);
      setError(`Failed to delete player: ${err.message}`);
      setDeleteDialogOpen(false);
      setPlayerToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setPlayerToDelete(null);
  };

  const handleDetailsClick = (player) => {
    setSelectedPlayer(player);
    setDetailsDialogOpen(true);
  };

  const handleBulkUrlUpdate = async (playerIds, newUrl) => {
    try {
      // Update URLs for all selected players
      await Promise.all(
        playerIds.map(playerId =>
          playerAPI.update(playerId, { current_url: newUrl })
        )
      );
      
      // Refresh data
      await fetchData();
      setSuccess('URLs updated successfully');
    } catch (err) {
      setError('Failed to update URLs: ' + err.message);
      throw err;
    }
  };

  const handleBulkCommand = async (playerIds, command) => {
    try {
      // Send command to all selected players
      await Promise.all(
        playerIds.map(playerId =>
          playerAPI.createCommand(playerId, {
            type: command,
            payload: {}
          })
        )
      );
      
      setSuccess(`${command} command sent to selected players`);
    } catch (err) {
      setError(`Failed to send ${command} command: ` + err.message);
      throw err;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header with search and filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          {/* Search and Quick Filters Row */}
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Zoek op device ID, URL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchQuery('')}>
                      <Clear />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Grid>

          <Grid item xs={12} md={8}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'flex-end' }}>
              <Button
                variant={showFilters ? "contained" : "outlined"}
                startIcon={<FilterIcon />}
                onClick={() => setShowFilters(!showFilters)}
                color={showFilters ? "primary" : "inherit"}
              >
                {`Filters ${Object.values(filters).some(val => val !== 'all') ? '(Actief)' : ''}`}
              </Button>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Sorteer op</InputLabel>
                  <Select
                    value={sortBy}
                    label="Sorteer op"
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <MenuItem value="deviceId">Device ID</MenuItem>
                    <MenuItem value="company">Bedrijf</MenuItem>
                    <MenuItem value="status">Status</MenuItem>
                    <MenuItem value="lastSeen">Laatst gezien</MenuItem>
                  </Select>
                </FormControl>

                <Tooltip title={sortOrder === 'asc' ? "Oplopend" : "Aflopend"}>
                  <IconButton 
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    color="primary"
                  >
                    {sortOrder === 'asc' ? <ArrowUpward /> : <ArrowDownward />}
                  </IconButton>
                </Tooltip>
              </Box>

              <Tooltip title="Ververs">
                <IconButton onClick={fetchData} color="primary">
                  <RefreshIcon />
                </IconButton>
              </Tooltip>

              <Button
                variant="contained"
                color="primary"
                onClick={() => setBulkEditDialogOpen(true)}
                startIcon={<EditIcon />}
              >
                Bulk Bewerken
              </Button>
            </Box>
          </Grid>

          {/* Advanced Filters Section */}
          <Grid item xs={12}>
            <Collapse in={showFilters}>
              <Paper sx={{ p: 2, mt: 2, bgcolor: 'background.default' }}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" sx={{ mb: 2 }}>
                      Geavanceerde Filters
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Bedrijf</InputLabel>
                      <Select
                        value={filters.companyId}
                        label="Bedrijf"
                        onChange={(e) => setFilters({ ...filters, companyId: e.target.value })}
                      >
                        <MenuItem value="all">Alle Bedrijven</MenuItem>
                        <MenuItem value="none">Geen Bedrijf</MenuItem>
                        <Divider />
                        {companies.map(company => (
                          <MenuItem key={company.company_id} value={company.company_id}>
                            {company.company_name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={filters.onlineStatus}
                        label="Status"
                        onChange={(e) => setFilters({ ...filters, onlineStatus: e.target.value })}
                      >
                        <MenuItem value="all">Alle Statussen</MenuItem>
                        <MenuItem value="online">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CircleIcon sx={{ color: 'success.main', fontSize: 12 }} />
                            Online
                          </Box>
                        </MenuItem>
                        <MenuItem value="offline">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CircleIcon sx={{ color: 'error.main', fontSize: 12 }} />
                            Offline
                          </Box>
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>URL Status</InputLabel>
                      <Select
                        value={filters.urlStatus || 'all'}
                        label="URL Status"
                        onChange={(e) => setFilters({ ...filters, urlStatus: e.target.value })}
                      >
                        <MenuItem value="all">Alle URLs</MenuItem>
                        <MenuItem value="with_url">Met URL</MenuItem>
                        <MenuItem value="without_url">Zonder URL</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Laatst Gezien</InputLabel>
                      <Select
                        value={filters.lastSeen || 'all'}
                        label="Laatst Gezien"
                        onChange={(e) => setFilters({ ...filters, lastSeen: e.target.value })}
                      >
                        <MenuItem value="all">Alle Tijden</MenuItem>
                        <MenuItem value="1h">Laatste uur</MenuItem>
                        <MenuItem value="24h">Laatste 24 uur</MenuItem>
                        <MenuItem value="7d">Laatste week</MenuItem>
                        <MenuItem value="30d">Laatste maand</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
                    <Button
                      size="small"
                      onClick={() => setFilters({
                        companyId: 'all',
                        onlineStatus: 'all',
                        urlStatus: 'all',
                        lastSeen: 'all'
                      })}
                      startIcon={<Clear />}
                    >
                      Wis Filters
                    </Button>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
                        {filteredAndSortedPlayers.length} resultaten gevonden
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
            </Collapse>
          </Grid>
        </Grid>
      </Paper>

      {/* Players grouped by company */}
      {loading ? (
        <Typography>Loading...</Typography>
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : success ? (
        <Typography color="success.main" sx={{ mb: 2 }}>{success}</Typography>
      ) : null}

      <Box>
        {/* Unassigned players */}
        {groupedPlayers.noCompany.players.length > 0 && (
          <Paper sx={{ mb: 3, p: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 2,
              }}
            >
              <Typography variant="h6">
                Unassigned Players ({groupedPlayers.noCompany.players.length})
              </Typography>
              <IconButton
                onClick={() => toggleCompanyExpansion('noCompany')}
                sx={{ transform: expandedCompanies['noCompany'] ? 'rotate(180deg)' : 'none' }}
              >
                <ExpandMoreIcon />
              </IconButton>
            </Box>

            <Collapse in={expandedCompanies['noCompany']}>
              <Grid container spacing={2}>
                {groupedPlayers.noCompany.players.map(player => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={player.device_id || player.id}>
                    <PlayerCard 
                      player={player}
                      company={companies.find(c => c.company_id === player.company_id)}
                      editingUrl={editingUrl}
                      setEditingUrl={setEditingUrl}
                      handleUrlUpdate={handleUrlUpdate}
                      handleDetailsClick={handleDetailsClick}
                      onDelete={handleDeleteClick}
                    />
                  </Grid>
                ))}
              </Grid>
            </Collapse>
          </Paper>
        )}

        {/* Company groups */}
        {companies.map(company => {
          const groupPlayers = groupedPlayers[company.company_id]?.players || [];
          if (groupPlayers.length === 0) return null;

          return (
            <Paper key={company.company_id} sx={{ mb: 3, p: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                }}
              >
                <Typography variant="h6">
                  {company.company_name} ({groupPlayers.length})
                </Typography>
                <IconButton
                  onClick={() => toggleCompanyExpansion(company.company_id)}
                  sx={{
                    transform: expandedCompanies[company.company_id] ? 'rotate(180deg)' : 'none',
                  }}
                >
                  <ExpandMoreIcon />
                </IconButton>
              </Box>

              <Collapse in={expandedCompanies[company.company_id]}>
                <Grid container spacing={2}>
                  {groupPlayers.map(player => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={player.device_id || player.id}>
                      <PlayerCard 
                        player={player}
                        company={company}
                        editingUrl={editingUrl}
                        setEditingUrl={setEditingUrl}
                        handleUrlUpdate={handleUrlUpdate}
                        handleDetailsClick={handleDetailsClick}
                        onDelete={handleDeleteClick}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Collapse>
            </Paper>
          );
        })}
      </Box>

      {/* Details Dialog */}
      <PlayerDetailsDialog 
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        player={selectedPlayer}
        company={selectedPlayer ? companies.find(c => c.company_id === selectedPlayer.company_id) : null}
        onUrlUpdate={handleUrlUpdate}
        onCommand={handleUrlUpdate}
        setError={setError}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
      >
        <DialogTitle>Delete Player</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete player "{playerToDelete?.device_id}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add BulkEditDialog */}
      <BulkEditDialog
        open={bulkEditDialogOpen}
        onClose={() => setBulkEditDialogOpen(false)}
        players={filteredAndSortedPlayers}
        companies={companies}
        onBulkUrlUpdate={handleBulkUrlUpdate}
        onBulkCommand={handleBulkCommand}
        setError={setError}
        setSuccess={setSuccess}
      />
    </Box>
  );
}

export default PlayerManagement; 