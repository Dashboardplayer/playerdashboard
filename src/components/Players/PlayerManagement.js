import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  DevicesOther,
  Business as BusinessIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  SystemUpdate as UpdateIcon,
  Circle as CircleIcon,
  Clear,
  ArrowUpward,
  ArrowDownward,
  Close as CloseIcon,
} from '@mui/icons-material';
import { playerAPI, companyAPI } from '../../hooks/apiClient';
import { firebaseService } from '../../services/firebaseService';
import { useUser } from '../../contexts/UserContext';

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
  const { profile } = useUser();
  const isSuperAdmin = profile?.role === 'superadmin';

  return (
    <Card 
      sx={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: (theme) => theme.shadows[4],
        }
      }}
    >
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header Section */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          mb: 2,
          pb: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}>
          {/* Device ID and Company Info */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography 
              variant="h6" 
              component="div" 
              sx={{ 
                display: 'flex', 
                alignItems: 'center',
                fontWeight: 600,
                fontSize: '1.1rem'
              }}
            >
              <DevicesOther sx={{ mr: 1, color: 'primary.main' }} />
              {player.device_id}
            </Typography>
            {company && (
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  ml: 0.5
                }}
              >
                <BusinessIcon sx={{ mr: 1, fontSize: 'small' }} />
                {company.company_name}
              </Typography>
            )}
          </Box>

          {/* Status Information */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'flex-end',
            gap: 0.5
          }}>
            <Chip
              label={player.is_online ? 'Online' : 'Offline'}
              color={player.is_online ? 'success' : 'error'}
              size="small"
              sx={{ 
                fontWeight: 500,
                minWidth: '70px'
              }}
            />
            {!player.is_online && player.last_seen && (
              <Typography 
                variant="caption" 
                color="text.secondary"
                sx={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5
                }}
              >
                <span role="img" aria-label="clock" style={{ fontSize: '0.9em' }}>🕒</span>
                {new Date(player.last_seen).toLocaleString()}
              </Typography>
            )}
          </Box>
        </Box>

        {/* URL Section */}
        <Box sx={{ mb: 2, flex: 1 }}>
          <Typography 
            variant="body2" 
            color="text.secondary" 
            gutterBottom
            sx={{ 
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              mb: 1
            }}
          >
            <span role="img" aria-label="link" style={{ fontSize: '1.1em' }}>🔗</span>
            Current URL:
          </Typography>
          {editingUrl[player._id] ? (
            <Box sx={{ 
              display: 'flex', 
              gap: 1, 
              alignItems: 'center',
              backgroundColor: 'action.hover',
              borderRadius: 1,
              p: 1
            }}>
              <TextField
                size="small"
                fullWidth
                value={tempUrl}
                onChange={(e) => setTempUrl(e.target.value)}
                placeholder="Enter URL"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'background.paper'
                  }
                }}
              />
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Tooltip title="Save URL">
                  <span>
                    <IconButton 
                      size="small" 
                      color="primary"
                      onClick={() => handleUrlUpdate(player._id, tempUrl)}
                    >
                      <SaveIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Cancel">
                  <span>
                    <IconButton 
                      size="small"
                      onClick={() => {
                        setEditingUrl({ ...editingUrl, [player._id]: false });
                        setTempUrl(player.current_url || '');
                      }}
                    >
                      <CancelIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            </Box>
          ) : (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              minHeight: '40px'
            }}>
              <Typography 
                variant="body2" 
                noWrap 
                sx={{ 
                  flex: 1,
                  color: player.current_url ? 'text.primary' : 'text.disabled',
                  fontStyle: player.current_url ? 'normal' : 'italic'
                }}
              >
                {player.current_url || 'Not set'}
              </Typography>
              <Tooltip title="Edit URL">
                <span>
                  <IconButton 
                    size="small"
                    onClick={() => setEditingUrl({ ...editingUrl, [player._id]: true })}
                  >
                    <EditIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          )}
        </Box>

        {/* Actions Section */}
        <Box sx={{ 
          display: 'flex', 
          gap: 1,
          justifyContent: 'space-between',
          mt: 'auto',
          pt: 1,
          borderTop: '1px solid',
          borderColor: 'divider'
        }}>
          <Button 
            size="small" 
            variant="outlined"
            onClick={() => handleDetailsClick(player)}
            startIcon={<DevicesOther />}
            sx={{ flex: 1 }}
          >
            Details
          </Button>
          {isSuperAdmin && (
            <Tooltip title="Delete Player">
              <span>
                <IconButton 
                  size="small" 
                  color="error"
                  onClick={() => onDelete(player)}
                >
                  <DeleteIcon />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

// PlayerDetailsDialog component moved outside
const PlayerDetailsDialog = ({ open, onClose, player, onCommand, onUpdate }) => {
    const [currentUrl, setCurrentUrl] = useState(player?.currentUrl || '');
    const [deviceId, setDeviceId] = useState(player?.device_id || '');
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [commandStatus, setCommandStatus] = useState(null);
    const [commandHistory, setCommandHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [updateUrl, setUpdateUrl] = useState('');
    const [ablyInitialized, setAblyInitialized] = useState(false);
    const [isEditingDeviceId, setIsEditingDeviceId] = useState(false);
    const [deviceIdError, setDeviceIdError] = useState('');
    const [screenshot, setScreenshot] = useState(null);
    const [showScreenshot, setShowScreenshot] = useState(false);
    const { profile } = useUser();
    const isSuperAdmin = profile?.role === 'superadmin';

    useEffect(() => {
        // Initialize Ably service
        const initializeAbly = async () => {
            try {
                await firebaseService.initialize();
                setAblyInitialized(true);
            } catch (err) {
                console.error('Failed to initialize Ably:', err);
                setError('Failed to initialize real-time communication service');
            }
        };

        if (open) {
            initializeAbly();
        }

        return () => {
            if (ablyInitialized) {
                firebaseService.cleanup();
            }
        };
    }, [open]);

    useEffect(() => {
        if (!ablyInitialized || !commandStatus?.id) return;

        // Subscribe to command acknowledgments
        const handleAcknowledgment = (acknowledgment) => {
            if (acknowledgment.commandId === commandStatus.id) {
                setCommandStatus(prev => ({
                    ...prev,
                    status: acknowledgment.status,
                    error: acknowledgment.error,
                    timestamp: acknowledgment.timestamp,
                    data: acknowledgment.data
                }));

                // Add to command history
                setCommandHistory(prev => [{
                    id: acknowledgment.commandId,
                    type: commandStatus.type,
                    status: acknowledgment.status,
                    error: acknowledgment.error,
                    timestamp: acknowledgment.timestamp,
                    data: acknowledgment.data
                }, ...prev]);

                // Handle command-specific responses
                if (acknowledgment.status === 'success') {
                    switch (commandStatus.type) {
                        case 'screenshot':
                            if (acknowledgment.data?.screenshot) {
                                setScreenshot(acknowledgment.data.screenshot);
                                setShowScreenshot(true);
                            }
                            setSuccess('Screenshot captured successfully');
                            break;
                        case 'update':
                        case 'systemUpdate':
                            setSuccess(acknowledgment.data?.message || 'Update started successfully');
                            break;
                        default:
                            setSuccess('Command executed successfully');
                    }
                } else if (acknowledgment.status === 'error') {
                    setError(`Command failed: ${acknowledgment.error}`);
                }
            }
        };

        firebaseService.onCommandAcknowledgment(handleAcknowledgment);

        return () => {
            // Cleanup subscription if needed
        };
    }, [ablyInitialized, commandStatus?.id]);

    const handleDeviceIdUpdate = async () => {
        if (!deviceId) {
            setDeviceIdError('Device ID is required');
            return;
        }

        if (!/^[a-zA-Z0-9-_]+$/.test(deviceId)) {
            setDeviceIdError('Device ID can only contain letters, numbers, hyphens, and underscores');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const { error } = await playerAPI.update(player._id, { device_id: deviceId });
            if (error) throw new Error(error);
            
            setSuccess('Device ID updated successfully');
            setIsEditingDeviceId(false);
            setDeviceIdError('');
            
            // Call onUpdate to refresh the parent component
            if (onUpdate) {
                onUpdate();
            }
        } catch (err) {
            setError(`Failed to update device ID: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleCommand = async (commandType, payload = {}) => {
        if (!ablyInitialized) {
            setError('Real-time communication service not initialized');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');
        setCommandStatus(null);

        try {
            const commandId = await firebaseService.sendCommand(player.id, {
                type: commandType,
                payload
            });

            setCommandStatus({
                id: commandId,
                type: commandType,
                status: 'pending',
                timestamp: new Date()
            });

            if (onCommand) {
                onCommand(player.id, commandType);
            }

            // Call onUpdate to refresh the parent component
            if (onUpdate) {
                onUpdate();
            }
        } catch (err) {
            setError(`Failed to send command: ${err.message}`);
            setLoading(false);
        }
    };

    const handleUpdateSubmit = async () => {
        if (!ablyInitialized) {
            setError('Real-time communication service not initialized');
            return;
        }

        if (!updateUrl) {
            setError('Please enter an update URL');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');
        setCommandStatus(null);

        try {
            const commandId = await firebaseService.sendCommand(player.id, {
                type: 'update',
                payload: { url: updateUrl }
            });

            setCommandStatus({
                id: commandId,
                type: 'update',
                status: 'pending',
                timestamp: new Date()
            });

            if (onCommand) {
                onCommand(player.id, 'update');
            }
        } catch (err) {
            setError(`Failed to send update command: ${err.message}`);
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                Player Details
            </DialogTitle>
            <DialogContent>
                <Box sx={{ mt: 2 }}>
                    {/* Device ID Section */}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle1" gutterBottom>
                            Device ID
                        </Typography>
                        {isSuperAdmin ? (
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <TextField
                                    fullWidth
                                    value={deviceId}
                                    onChange={(e) => {
                                        setDeviceId(e.target.value);
                                        setDeviceIdError('');
                                    }}
                                    error={Boolean(deviceIdError)}
                                    helperText={deviceIdError || "Unique identifier for this player"}
                                    size="small"
                                />
                                <IconButton 
                                    color="primary"
                                    onClick={handleDeviceIdUpdate}
                                    disabled={loading}
                                >
                                    <SaveIcon />
                                </IconButton>
                                <IconButton 
                                    onClick={() => {
                                        setIsEditingDeviceId(false);
                                        setDeviceId(player.device_id);
                                        setDeviceIdError('');
                                    }}
                                >
                                    <CancelIcon />
                                </IconButton>
                            </Box>
                        ) : (
                            <Typography variant="body1">
                                {player?.device_id}
                            </Typography>
                        )}
                    </Box>

                    <Typography variant="h6" gutterBottom>
                        Device Management
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <Button
                            variant="contained"
                            color="warning"
                            onClick={() => handleCommand('reboot')}
                            disabled={loading}
                        >
                            Restart Device
                        </Button>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={() => handleCommand('screenshot')}
                            disabled={loading}
                        >
                            Take Screenshot
                        </Button>
                        <Button
                            variant="contained"
                            color="secondary"
                            onClick={() => handleCommand('update')}
                            disabled={loading}
                        >
                            Update APK
                        </Button>
                    </Box>

                    <Typography variant="h6" gutterBottom>
                        URL Management
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <TextField
                            fullWidth
                            label="Current URL"
                            value={currentUrl}
                            onChange={(e) => setCurrentUrl(e.target.value)}
                            disabled={!isEditing}
                        />
                        <Button
                            variant="contained"
                            onClick={() => {
                                if (isEditing) {
                                    handleCommand('updateUrl', { url: currentUrl });
                                }
                                setIsEditing(!isEditing);
                            }}
                            disabled={loading}
                        >
                            {isEditing ? 'Save' : 'Edit'}
                        </Button>
                    </Box>

                    <Typography variant="h6" gutterBottom>
                        Update Management
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <TextField
                            fullWidth
                            label="Update URL"
                            value={updateUrl}
                            onChange={(e) => setUpdateUrl(e.target.value)}
                            placeholder="Enter update URL"
                            disabled={loading}
                        />
                        <Button
                            variant="contained"
                            onClick={handleUpdateSubmit}
                            disabled={loading || !updateUrl}
                        >
                            Update
                        </Button>
                    </Box>

                    <Box sx={{ mt: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6">
                                Command History
                            </Typography>
                            <Button
                                size="small"
                                onClick={() => setShowHistory(!showHistory)}
                            >
                                {showHistory ? 'Hide History' : 'Show History'}
                            </Button>
                        </Box>
                        
                        {showHistory && (
                            <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                                {commandHistory.length === 0 ? (
                                    <Typography color="text.secondary" align="center">
                                        No command history available
                                    </Typography>
                                ) : (
                                    commandHistory.map((cmd) => (
                                        <Paper
                                            key={cmd.id}
                                            sx={{ 
                                                p: 1.5,
                                                mb: 1,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1
                                            }}
                                        >
                                            <Box sx={{ flex: 1 }}>
                                                <Typography variant="body2">
                                                    {cmd.type.charAt(0).toUpperCase() + cmd.type.slice(1)}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {new Date(cmd.timestamp).toLocaleString()}
                                                </Typography>
                                            </Box>
                                            <Chip
                                                label={cmd.status}
                                                color={
                                                    cmd.status === 'success' ? 'success' :
                                                    cmd.status === 'error' ? 'error' :
                                                    cmd.status === 'pending' ? 'warning' : 'default'
                                                }
                                                size="small"
                                            />
                                        </Paper>
                                    ))
                                )}
                            </Box>
                        )}
                    </Box>

                    {error && (
                        <Alert severity="error" sx={{ mt: 2 }}>
                            {error}
                        </Alert>
                    )}

                    {success && (
                        <Alert severity="success" sx={{ mt: 2 }}>
                            {success}
                        </Alert>
                    )}

                    {commandStatus && (
                        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CircularProgress size={20} />
                            <span>
                                {commandStatus.status === 'pending' && 'Sending command...'}
                                {commandStatus.status === 'success' && 'Command executed successfully'}
                                {commandStatus.status === 'error' && `Command failed: ${commandStatus.error}`}
                            </span>
                        </Box>
                    )}
                </Box>

                {/* Screenshot Dialog */}
                <Dialog
                    open={showScreenshot}
                    onClose={() => setShowScreenshot(false)}
                    maxWidth="md"
                    fullWidth
                >
                    <DialogTitle>
                        Screenshot
                        <IconButton
                            onClick={() => setShowScreenshot(false)}
                            sx={{ position: 'absolute', right: 8, top: 8 }}
                        >
                            <CloseIcon />
                        </IconButton>
                    </DialogTitle>
                    <DialogContent>
                        {screenshot && (
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                <img
                                    src={`data:image/jpeg;base64,${screenshot}`}
                                    alt="Device Screenshot"
                                    style={{ maxWidth: '100%', height: 'auto' }}
                                />
                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = `data:image/jpeg;base64,${screenshot}`;
                                        link.download = `screenshot-${player.device_id}-${new Date().toISOString()}.jpg`;
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                    }}
                                >
                                    Download Screenshot
                                </Button>
                            </Box>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Command History */}
                <Box sx={{ mt: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Command History
                    </Typography>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Type</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Time</TableCell>
                                    <TableCell>Details</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {commandHistory.map((cmd) => (
                                    <TableRow key={cmd.id}>
                                        <TableCell>{cmd.type}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={cmd.status}
                                                color={cmd.status === 'success' ? 'success' : 'error'}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {new Date(cmd.timestamp).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            {cmd.error || cmd.data?.message || '-'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            </DialogContent>
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
  const [editedDeviceIds, setEditedDeviceIds] = useState({});
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    companyId: 'all',
    status: 'all',
    lastSeen: 'all'
  });
  const ROWS_PER_PAGE = 10;
  const { profile } = useUser();
  const isSuperAdmin = profile?.role === 'superadmin';

  useEffect(() => {
    // Reset state when dialog opens
    if (open) {
      setSelectedPlayers([]);
      setEditedUrls({});
      setEditedDeviceIds({});
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

  const handleDeviceIdChange = (playerId, newDeviceId) => {
    setEditedDeviceIds(prev => ({
      ...prev,
      [playerId]: newDeviceId
    }));
  };

  const handleSaveAll = async () => {
    if (Object.keys(editedUrls).length === 0 && Object.keys(editedDeviceIds).length === 0) {
      setError('No changes have been made');
      return;
    }

    setLoading(true);
    try {
      // Update URLs that have been modified
      await Promise.all(
        Object.entries(editedUrls).map(([playerId, url]) =>
          playerAPI.update(playerId, { current_url: url })
        )
      );

      // Update device IDs that have been modified (only for superadmin)
      if (isSuperAdmin && Object.keys(editedDeviceIds).length > 0) {
        await Promise.all(
          Object.entries(editedDeviceIds).map(([playerId, deviceId]) =>
            playerAPI.update(playerId, { device_id: deviceId })
          )
        );
      }
      
      setSuccess('All changes saved successfully');
      setEditedUrls({});
      setEditedDeviceIds({});
      onClose(); // Close dialog after successful save
    } catch (err) {
      setError('Failed to save changes: ' + err.message);
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
      // Send command to all selected players using Ably
      await Promise.all(
        selectedPlayers.map(playerId =>
          firebaseService.sendCommand(playerId, {
            type: command.toLowerCase(),
            payload: {}
          })
        )
      );
      
      setSuccess(`${command} command sent to selected players`);
    } catch (err) {
      setError(`Failed to send ${command} command: ${err.message}`);
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
                onClick={() => handleBulkCommand('reboot')}
                disabled={loading || selectedPlayers.length === 0}
              >
                Restart Selected
              </Button>
              <Button
                variant="outlined"
                startIcon={<UpdateIcon />}
                onClick={() => handleBulkCommand('update')}
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
                const hasDeviceIdChanged = editedDeviceIds[player._id] !== undefined;
                return (
                  <TableRow key={player._id}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedPlayers.includes(player._id)}
                        onChange={() => handleSelectPlayer(player._id)}
                      />
                    </TableCell>
                    <TableCell>
                      {isSuperAdmin ? (
                        <TextField
                          size="small"
                          fullWidth
                          value={editedDeviceIds[player._id] !== undefined ? editedDeviceIds[player._id] : player.device_id || ''}
                          onChange={(e) => handleDeviceIdChange(player._id, e.target.value)}
                          placeholder="Enter Device ID"
                          disabled={loading}
                          sx={{
                            backgroundColor: hasDeviceIdChanged ? 'action.hover' : 'transparent',
                          }}
                        />
                      ) : (
                        <Typography variant="body2">{player.device_id || 'No Device ID'}</Typography>
                      )}
                    </TableCell>
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
            disabled={loading || (Object.keys(editedUrls).length === 0 && Object.keys(editedDeviceIds).length === 0)}
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

  // Define refreshData function with useCallback
  const refreshData = useCallback(async () => {
    setLoading(true);
    setError('');
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
  }, []);

  // Add useEffect for initial data fetch
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Add WebSocket handler for real-time updates
  useEffect(() => {
    const handleWebSocketMessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        // Handle ping messages
        if (message.type === 'ping') {
          window.ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        // Handle error messages
        if (message.type === 'error') {
          console.error('WebSocket error:', message.error);
          if (message.reconnect) {
            window.location.reload();
          }
          return;
        }
        
        // Update local state based on WebSocket messages
        switch (message.type) {
          case 'player_created':
            if (message.data) {
              setPlayers(prevPlayers => {
                // Check if player already exists
                const exists = prevPlayers.some(p => p._id === message.data._id);
                if (!exists) {
                  setSuccess('New player added');
                  return [...prevPlayers, message.data];
                }
                return prevPlayers;
              });
            }
            break;
          case 'player_updated':
            if (message.data && message.data._id) {
              setPlayers(prevPlayers => {
                const updatedPlayers = prevPlayers.map(player => 
                  player._id === message.data._id ? {...player, ...message.data} : player
                );
                setSuccess('Player updated');
                return updatedPlayers;
              });
            }
            break;
          case 'player_deleted':
            if (message.data && (message.data.id || message.data._id)) {
              const deletedId = message.data.id || message.data._id;
              setPlayers(prevPlayers => {
                const filteredPlayers = prevPlayers.filter(player => player._id !== deletedId);
                setSuccess('Player deleted');
                return filteredPlayers;
              });
            }
            break;
          case 'company_updated':
          case 'company_created':
          case 'company_deleted':
            refreshData();
            break;
          default:
            break;
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
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
  }, [refreshData]);

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

  // Update handleUrlUpdate to rely on WebSocket for updates
  const handleUrlUpdate = async (playerId, newUrl) => {
    try {
      const { error } = await playerAPI.update(playerId, { current_url: newUrl });
      if (error) throw new Error(error);
      
      // Update local state immediately
      setPlayers(prevPlayers => prevPlayers.map(player => 
        player._id === playerId ? { ...player, current_url: newUrl } : player
      ));
      
      setEditingUrl({ ...editingUrl, [playerId]: false });
      setSuccess('URL updated successfully');
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

    console.log('Attempting to delete player: [MASKED]');
    console.log('Player ID: [MASKED]');
    console.log('Full player object:', '[SENSITIVE_DATA_MASKED]');
    
    setPlayerToDelete(player);
    setDeleteDialogOpen(true);
  };

  // Update handleDeleteConfirm to properly handle WebSocket updates
  const handleDeleteConfirm = async () => {
    if (!playerToDelete) {
      console.error('No player selected for deletion');
      return;
    }

    try {
      const { error } = await playerAPI.delete(playerToDelete._id);
      if (error) throw new Error(error);
      
      // Update local state immediately
      setPlayers(prevPlayers => prevPlayers.filter(p => p._id !== playerToDelete._id));
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

  // Update handleBulkUrlUpdate to rely on WebSocket for updates
  const handleBulkUrlUpdate = async (playerIds, newUrl) => {
    try {
      await Promise.all(
        playerIds.map(playerId =>
          playerAPI.update(playerId, { current_url: newUrl })
        )
      );
      
      // Don't refresh data - the WebSocket will handle the update
      setSuccess('URL update request sent successfully');
    } catch (err) {
      setError('Failed to update URLs: ' + err.message);
      throw err;
    }
  };

  // Update handleBulkCommand to rely on WebSocket for updates
  const handleBulkCommand = async (playerIds, command) => {
    if (playerIds.length === 0) {
      setError('Please select players first');
      return;
    }

    setLoading(true);
    try {
      await Promise.all(
        playerIds.map(playerId =>
          firebaseService.sendCommand(playerId, {
            type: command.toLowerCase(),
            payload: {}
          })
        )
      );
      
      // Don't refresh data - the WebSocket will handle the update
      setSuccess(`${command} command sent to selected players`);
    } catch (err) {
      setError(`Failed to send ${command} command: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
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
              size="small"
            />
          </Grid>

          <Grid item xs={12} md={8}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'flex-end' }}>
              <Button
                variant={showFilters ? "contained" : "outlined"}
                startIcon={<FilterIcon />}
                onClick={() => setShowFilters(!showFilters)}
                color={showFilters ? "primary" : "inherit"}
                size="small"
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
                    size="small"
                  >
                    {sortOrder === 'asc' ? <ArrowUpward /> : <ArrowDownward />}
                  </IconButton>
                </Tooltip>
              </Box>

              <Tooltip title="Ververs">
                <IconButton 
                  onClick={refreshData} 
                  color="primary"
                  size="small"
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>

              <Button
                variant="contained"
                color="primary"
                onClick={() => setBulkEditDialogOpen(true)}
                startIcon={<EditIcon />}
                size="small"
              >
                Bulk Bewerken
              </Button>
            </Box>
          </Grid>

          {/* Advanced Filters Section */}
          <Grid item xs={12}>
            <Collapse in={showFilters}>
              <Box sx={{ mt: 2 }}>
                <Grid container spacing={2}>
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
                        <MenuItem value="online">Online</MenuItem>
                        <MenuItem value="offline">Offline</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>URL Status</InputLabel>
                      <Select
                        value={filters.urlStatus}
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
                        value={filters.lastSeen}
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
                </Grid>

                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                  <Typography variant="body2" color="text.secondary">
                    {filteredAndSortedPlayers.length} resultaten gevonden
                  </Typography>
                </Box>
              </Box>
            </Collapse>
          </Grid>
        </Grid>
      </Paper>

      {/* Status Messages */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      ) : success ? (
        <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>
      ) : null}

      {/* Company Groups */}
      {companies.map(company => {
        const groupPlayers = groupedPlayers[company.company_id]?.players || [];
        if (groupPlayers.length === 0) return null;

        return (
          <Paper key={company.company_id} sx={{ mb: 2, width: '100%' }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <BusinessIcon sx={{ mr: 1 }} />
                    <Typography variant="h6" component="span">
                      {company.company_name}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip 
                      size="small"
                      label={`${groupPlayers.filter(p => p.is_online).length} Online`}
                      color="success"
                    />
                    <Chip 
                      size="small"
                      label={`${groupPlayers.filter(p => !p.is_online).length} Offline`}
                      color="error"
                    />
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Button
                    size="small"
                    startIcon={<RefreshIcon />}
                    onClick={() => handleBulkCommand(groupPlayers.map(p => p._id), 'reboot')}
                  >
                    Restart All
                  </Button>
                  <IconButton
                    size="small"
                    onClick={() => toggleCompanyExpansion(company.company_id)}
                    sx={{ 
                      transform: expandedCompanies[company.company_id] ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.3s'
                    }}
                  >
                    <ExpandMoreIcon />
                  </IconButton>
                </Box>
              </Box>
            </Box>

            <Collapse in={expandedCompanies[company.company_id]}>
              <Box sx={{ p: 2 }}>
                <Grid container spacing={2}>
                  {groupPlayers.map(player => (
                    <Grid item xs={12} sm={6} md={4} xl={3} key={player._id}>
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
              </Box>
            </Collapse>
          </Paper>
        );
      })}

      {/* Unassigned Players */}
      {groupedPlayers.noCompany.players.length > 0 && (
        <Paper sx={{ mb: 2, width: '100%' }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <DevicesOther sx={{ mr: 1 }} />
                  <Typography variant="h6" component="span">
                    Unassigned Players
                  </Typography>
                </Box>
                <Chip 
                  label={groupedPlayers.noCompany.players.length}
                  size="small"
                  color="default"
                />
              </Box>
              <IconButton
                size="small"
                onClick={() => toggleCompanyExpansion('noCompany')}
                sx={{ 
                  transform: expandedCompanies['noCompany'] ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.3s'
                }}
              >
                <ExpandMoreIcon />
              </IconButton>
            </Box>
          </Box>

          <Collapse in={expandedCompanies['noCompany']}>
            <Box sx={{ p: 2 }}>
              <Grid container spacing={2}>
                {groupedPlayers.noCompany.players.map(player => (
                  <Grid item xs={12} sm={6} md={4} xl={3} key={player._id}>
                    <PlayerCard 
                      player={player}
                      editingUrl={editingUrl}
                      setEditingUrl={setEditingUrl}
                      handleUrlUpdate={handleUrlUpdate}
                      handleDetailsClick={handleDetailsClick}
                      onDelete={handleDeleteClick}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Collapse>
        </Paper>
      )}

      {/* Empty State */}
      {(!loading && filteredAndSortedPlayers.length === 0) && (
        <Paper sx={{ p: 4, textAlign: 'center', width: '100%' }}>
          <DevicesOther sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Geen Players Gevonden
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchQuery 
              ? 'Geen players gevonden met deze zoekcriteria. Pas de filters aan.'
              : 'Er zijn nog geen players in het systeem. Voeg players toe om te beginnen.'}
          </Typography>
        </Paper>
      )}

      {/* Dialogs */}
      <PlayerDetailsDialog 
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        player={selectedPlayer}
        onCommand={handleUrlUpdate}
        onUpdate={refreshData}
      />

      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
      >
        <DialogTitle>Delete Player</DialogTitle>
        <DialogContent>
          <Typography>
            Weet je zeker dat je player "{playerToDelete?.device_id}" wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Annuleren</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Verwijderen
          </Button>
        </DialogActions>
      </Dialog>

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