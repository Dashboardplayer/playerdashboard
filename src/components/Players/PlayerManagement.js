import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { browserAuth } from '../../utils/browserUtils';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Alert,
  CircularProgress,
  Paper,
  Chip,
  Tooltip,
  Grid,
  InputAdornment,
  Divider,
  Collapse,
  DialogActions,
  Pagination,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess,
  DevicesOther,
  Business as BusinessIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Clear,
  Upload as UploadIcon,
  ArrowUpward,
  ArrowDownward,
  Close as CloseIcon,
  History as HistoryIcon,
  Link as LinkIcon,
  Devices as DeviceIcon,
  PowerSettingsNew as PowerSettingsNewIcon,
  CameraAlt as CameraAltIcon,
  FileDownload as FileDownloadIcon,
  SystemUpdate as SystemUpdateIcon,
  Navigation as NavigationIcon,
  Settings as SettingsIcon,
  Person as PersonIcon,
  ArrowForward as ArrowForwardIcon,
  Circle as CircleIcon,
  Update as UpdateIcon,
} from '@mui/icons-material';
import { playerAPI, companyAPI, scheduleAPI } from '../../hooks/apiClient';
import { useUser } from '../../contexts/UserContext';

const isHttpUrl = (value) => /^https?:\/\//i.test(value || '');

const debugLog = (...args) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(...args);
  }
};

const getScreenshotSrc = (imageData) => {
  if (!imageData) return '';
  if (imageData.startsWith('data:') || isHttpUrl(imageData)) return imageData;
  return `data:image/jpeg;base64,${imageData}`;
};

const getScreenshotFilename = (player) => {
  const deviceId = player?.device_id || 'player';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `screenshot-${deviceId}-${timestamp}.jpg`;
};

const getCloudinaryAttachmentUrl = (url, filename) => {
  if (!url.includes('/upload/')) return url;
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return url.replace('/upload/', `/upload/fl_attachment:${safeFilename}/`);
};

const downloadScreenshotImage = async (imageData, player) => {
  const src = getScreenshotSrc(imageData);
  const filename = getScreenshotFilename(player);

  if (!src) return;

  if (isHttpUrl(src)) {
    try {
      const response = await fetch(src);
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      return;
    } catch (error) {
      window.open(getCloudinaryAttachmentUrl(src, filename), '_blank', 'noopener,noreferrer');
      return;
    }
  }

  const link = document.createElement('a');
  link.href = src;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const formatDateTime = (value) => {
  if (!value) return 'Nog nooit';
  return new Date(value).toLocaleString('nl-NL', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
};

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
  const [showSuccess, setShowSuccess] = useState(false);
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
            Huidige URL
          </Typography>
          {showSuccess && (
            <Alert severity="success" sx={{ mb: 1 }}>
              URL opgeslagen. De player navigeert zo snel mogelijk.
            </Alert>
          )}
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
                placeholder="https://voorbeeld.nl"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'background.paper'
                  }
                }}
              />
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Tooltip title="URL opslaan">
                  <span>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => {
                        handleUrlUpdate(player._id, tempUrl);
                        setShowSuccess(true);
                        setTimeout(() => setShowSuccess(false), 3000);
                      }}
                    >
                      <SaveIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Annuleren">
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
                {player.current_url || 'Geen URL ingesteld'}
              </Typography>
              <Tooltip title="URL bewerken">
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
            <Tooltip title="Player verwijderen">
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

// ScheduleDialog component
const ScheduleDialog = ({ open, onClose, schedule, onSave, loading }) => {
    const [type, setType] = useState(schedule?.type || 'content');
    const [name, setName] = useState(schedule?.name || '');
    const [scheduledUrl, setScheduledUrl] = useState(schedule?.scheduled_url || '');
    const [screenOn, setScreenOn] = useState(schedule?.screen_on ?? true);
    const [startTime, setStartTime] = useState(schedule?.start_time || '');
    const [endTime, setEndTime] = useState(schedule?.end_time || '');
    const [daysOfWeek, setDaysOfWeek] = useState(schedule?.days_of_week || [0, 1, 2, 3, 4, 5, 6]);

    const handleSubmit = () => {
        const scheduleData = {
            type,
            name,
            scheduled_url: type === 'content' ? scheduledUrl : null,
            screen_on: type === 'screen' ? screenOn : true,
            start_time: startTime,
            end_time: endTime,
            days_of_week: daysOfWeek
        };

        onSave(scheduleData);
    };

    const handleDayToggle = (day) => {
        if (daysOfWeek.includes(day)) {
            setDaysOfWeek(daysOfWeek.filter(d => d !== day));
        } else {
            setDaysOfWeek([...daysOfWeek, day]);
        }
    };

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                {schedule ? 'Edit Schedule' : 'Add Schedule'}
            </DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                    <TextField
                        label="Schedule Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        fullWidth
                    />

                    <TextField
                        select
                        label="Schedule Type"
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        fullWidth
                    >
                        <MenuItem value="content">Content Schedule</MenuItem>
                        <MenuItem value="screen">Screen On/Off</MenuItem>
                    </TextField>

                    {type === 'content' && (
                        <TextField
                            label="Scheduled URL"
                            value={scheduledUrl}
                            onChange={(e) => setScheduledUrl(e.target.value)}
                            fullWidth
                            placeholder="https://example.com"
                        />
                    )}

                    {type === 'screen' && (
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={screenOn}
                                    onChange={(e) => setScreenOn(e.target.checked)}
                                />
                            }
                            label="Screen On"
                        />
                    )}

                    <Box>
                        <Typography variant="body2" gutterBottom>Time Range (optional)</Typography>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <TextField
                                type="time"
                                label="Start"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                inputProps={{ step: 300 }}
                            />
                            <Typography>-</Typography>
                            <TextField
                                type="time"
                                label="End"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                inputProps={{ step: 300 }}
                            />
                        </Box>
                    </Box>

                    <Box>
                        <Typography variant="body2" gutterBottom>Days of Week</Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {dayNames.map((day, index) => (
                                <Chip
                                    key={index}
                                    label={day}
                                    onClick={() => handleDayToggle(index)}
                                    color={daysOfWeek.includes(index) ? 'primary' : 'default'}
                                    clickable
                                />
                            ))}
                        </Box>
                    </Box>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={loading}>Cancel</Button>
                <Button onClick={handleSubmit} variant="contained" disabled={loading}>
                    {schedule ? 'Update' : 'Create'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

// PlayerDetailsDialog component moved outside
const PlayerDetailsDialog = ({ open, onClose, player, onUpdate, companies }) => {
    debugLog('📋 PlayerDetailsDialog received companies:', companies);

    const [currentUrl, setCurrentUrl] = useState(player?.current_url || '');
    const [deviceId, setDeviceId] = useState(player?.device_id || '');
    const [selectedCompany, setSelectedCompany] = useState(player?.company_id || '');
    const [companyDirty, setCompanyDirty] = useState(false);
    const [apkUrl, setApkUrl] = useState('');
    const [schedules, setSchedules] = useState([]);
    const [showScheduleDialog, setShowScheduleDialog] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState(null);

    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [commandStatus, setCommandStatus] = useState(null);
    const [auditLogs, setAuditLogs] = useState([]);
    const [showAuditLogs, setShowAuditLogs] = useState(false);
    const [updateUrl, setUpdateUrl] = useState('');
    const [, setIsEditingDeviceId] = useState(false);
    const [deviceIdError, setDeviceIdError] = useState('');
    const [screenshot, setScreenshot] = useState(null);
    const [showScreenshot, setShowScreenshot] = useState(false);
    const lastPlayerIdRef = useRef(null);
    const lastCompanySaveRef = useRef(null);
    const { profile } = useUser();
    const isSuperAdmin = profile?.role === 'superadmin';

    useEffect(() => {
        // Log player object when it changes to help identify ID format issues
        if (player) {
            debugLog('Current player object:', {
                _id: player._id,
                id: player.id,
                device_id: player.device_id
            });
        }
    }, [player]);

    useEffect(() => {
        if (!player) return;

        if (lastPlayerIdRef.current !== player._id) {
            lastPlayerIdRef.current = player._id;
            setSelectedCompany(player.company_id || '');
            setCompanyDirty(false);
        }
    }, [player]);

    useEffect(() => {
        if (!player || companyDirty) return;

        setSelectedCompany(player.company_id || '');
    }, [companyDirty, player?.company_id, player]);

    const fetchAuditLogs = useCallback(async () => {
        if (!player?._id) return;

        try {
            const { data, error } = await playerAPI.getAuditLogs(player._id);
            if (!error && data) {
                setAuditLogs(data);
            }
        } catch (error) {
            console.error('Error fetching audit logs:', error);
        }
    }, [player?._id]);

    // Listen for WebSocket updates to update selectedCompany
    useEffect(() => {
        const handleWebSocketMessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'player_updated' && message.data?._id === player?._id) {
                    debugLog('📋 PlayerDetailsDialog received player_updated:', message.data);
                    if (companyDirty) {
                        debugLog('📋 Skipping selectedCompany update while local company edit is dirty');
                        return;
                    }

                    const recentSavedCompany = lastCompanySaveRef.current;
                    if (
                        recentSavedCompany
                        && recentSavedCompany.playerId === player?._id
                        && Date.now() - recentSavedCompany.savedAt < 15000
                        && message.data.company_id !== recentSavedCompany.companyId
                    ) {
                        debugLog('📋 Ignoring stale company_id from player_updated shortly after save:', message.data.company_id);
                        return;
                    }

                    // Only update if the new company_id is different from current
                    if (message.data.company_id !== undefined && message.data.company_id !== selectedCompany) {
                        debugLog('📋 Updating selectedCompany from', selectedCompany, 'to', message.data.company_id);
                        setSelectedCompany(message.data.company_id);
                    } else {
                        debugLog('📋 Skipping selectedCompany update - same value or undefined');
                    }
                }
            } catch (error) {
                console.error('Error parsing WebSocket message in PlayerDetailsDialog:', error);
            }
        };

        if (window.ws) {
            window.ws.addEventListener('message', handleWebSocketMessage);
        }

        return () => {
            if (window.ws) {
                window.ws.removeEventListener('message', handleWebSocketMessage);
            }
        };
    }, [companyDirty, player, selectedCompany]);

    const handleCompanyUpdate = async () => {
        if (!player) return;

        debugLog('🔄 handleCompanyUpdate called:', {
            playerId: player._id,
            currentCompany: player.company_id,
            newCompany: selectedCompany
        });

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const companyId = selectedCompany || '';
            const updateData = {
                company_id: companyId
            };

            debugLog('📤 Sending update request:', updateData);
            const response = await playerAPI.update(player._id, updateData);
            debugLog('✅ Update response:', response);
            if (response.error) throw new Error(response.error);

            setSuccess('Bedrijf opgeslagen');
            setSelectedCompany(companyId);
            lastCompanySaveRef.current = {
                playerId: player._id,
                companyId,
                savedAt: Date.now()
            };
            setCompanyDirty(false);

            if (onUpdate) {
                onUpdate();
            }
        } catch (err) {
            console.error('❌ Company update error:', err);
            setError(`Bedrijf opslaan mislukt: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDeviceIdUpdate = async () => {
        debugLog('🔄 handleDeviceIdUpdate called with deviceId:', deviceId, 'current player.device_id:', player?.device_id);

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
            // Store the OLD device_id before updating
            const oldDeviceId = player.device_id;
            debugLog('🔄 Old device_id:', oldDeviceId, 'New device_id:', deviceId);

            // Send command to device FIRST (using OLD device_id so the device receives it)
            debugLog(`🚀 Sending setPlayerId command to ${oldDeviceId} with new ID: ${deviceId}`);
            const commandResult = await playerAPI.sendCommand(oldDeviceId, {
                type: 'setPlayerId',
                payload: { playerId: deviceId }
            });
            debugLog('✅ Command result:', commandResult);
            if (commandResult.error) {
                console.error('❌ Command error:', commandResult.error);
                throw new Error(commandResult.error);
            }
            setSuccess('Command sent to device. Updating database...');

            // Then update the database. If the company was changed in this dialog,
            // persist it together with the new device ID so the player keeps the chosen company.
            const updateData = { device_id: deviceId };
            if (isSuperAdmin && selectedCompany !== (player.company_id || '')) {
                updateData.company_id = selectedCompany || '';
            }

            const { error } = await playerAPI.update(player._id, updateData);
            if (error) throw new Error(error);

            setSuccess(updateData.company_id !== undefined
                ? 'Player ID en bedrijf opgeslagen. De app neemt dit over bij de volgende heartbeat.'
                : 'Device ID updated successfully. Device will restart with new ID.');
            setIsEditingDeviceId(false);
            setDeviceIdError('');
            setCompanyDirty(false);

            // Call onUpdate to refresh the parent component
            if (onUpdate) {
                onUpdate();
            }
        } catch (err) {
            console.error('❌ Error in handleDeviceIdUpdate:', err);
            setError(`Failed to update device ID: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const fetchSchedules = useCallback(async () => {
        if (!player?._id) return;
        const { data, error } = await scheduleAPI.getByPlayer(player._id);
        if (error) {
            console.error('Failed to fetch schedules:', error);
        } else {
            setSchedules(data || []);
        }
    }, [player?._id]);

    // Reset currentUrl and deviceId when dialog opens with a new player
    useEffect(() => {
        if (open && player) {
            setCurrentUrl(player.current_url || '');
            setDeviceId(player.device_id || '');
            fetchSchedules();
        }
    }, [fetchSchedules, open, player]);

    // Fetch audit logs when dialog opens
    useEffect(() => {
        if (open && player?._id) {
            fetchAuditLogs();
        }
    }, [fetchAuditLogs, open, player?._id]);

    const handleCreateSchedule = async (scheduleData) => {
        setLoading(true);
        try {
            const { error } = await scheduleAPI.create({
                ...scheduleData,
                player_id: player._id
            });
            if (error) {
                setError('Failed to create schedule: ' + error);
            } else {
                setSuccess('Schedule created successfully');
                setShowScheduleDialog(false);
                fetchSchedules();
            }
        } catch (err) {
            setError('Failed to create schedule: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateSchedule = async (scheduleId, scheduleData) => {
        setLoading(true);
        try {
            const { error } = await scheduleAPI.update(scheduleId, scheduleData);
            if (error) {
                setError('Failed to update schedule: ' + error);
            } else {
                setSuccess('Schedule updated successfully');
                setShowScheduleDialog(false);
                setEditingSchedule(null);
                fetchSchedules();
            }
        } catch (err) {
            setError('Failed to update schedule: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSchedule = async (scheduleId) => {
        if (!window.confirm('Are you sure you want to delete this schedule?')) return;
        
        setLoading(true);
        try {
            const { error } = await scheduleAPI.delete(scheduleId);
            if (error) {
                setError('Failed to delete schedule: ' + error);
            } else {
                setSuccess('Schedule deleted successfully');
                fetchSchedules();
            }
        } catch (err) {
            setError('Failed to delete schedule: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCommand = async (commandType, payload = {}, overrideDeviceId = null) => {
        debugLog('🚀 handleCommand called with:', { commandType, payload, overrideDeviceId });

        setLoading(true);
        setError('');
        setSuccess('');
        setCommandStatus(null);

        try {
            // Check if player exists and has a device_id
            if (!player) {
                console.error('Player object is missing');
                setError('Player information is missing');
                setLoading(false);
                return;
            }

            // Log the entire player object for debugging
            debugLog('Current player object:', player);

            // Use override device_id if provided, otherwise use player.device_id
            const deviceId = overrideDeviceId || player.device_id;
            debugLog('🔍 Debug: overrideDeviceId =', overrideDeviceId, 'player.device_id =', player.device_id, 'final deviceId =', deviceId);
            
            if (!deviceId) {
                console.error('No device_id found on player object:', player);
                setError('Player device_id is missing. Cannot send command.');
                setLoading(false);
                return;
            }

            debugLog(`Sending command ${commandType} to player with device_id: ${deviceId}`);

            const commandId = await playerAPI.sendCommand(deviceId, {
                type: commandType,
                payload
            });

            setCommandStatus({
                id: commandId,
                type: commandType,
                status: 'pending',
                timestamp: new Date()
            });

            setSuccess('Command sent successfully');

            // Call onUpdate to refresh the parent component
            if (onUpdate) {
                onUpdate();
            }

            // For URL updates, close the dialog after sending
            if (commandType === 'updateUrl') {
                setTimeout(() => {
                    onClose();
                }, 500);
            }

            // For screenshot command, poll for the screenshot
            if (commandType === 'screenshot') {
                setSuccess('Screenshot command sent. Waiting for device to capture...');
                pollForScreenshot(deviceId, new Date());
            }
        } catch (err) {
            setError(`Failed to send command: ${err.message}`);
            setLoading(false);
        } finally {
            // Reset loading state after a short delay
            setTimeout(() => {
                setLoading(false);
            }, 1000);
        }
    };

    const pollForScreenshot = async (deviceId, requestedAt) => {
        const maxAttempts = 60; // Try for 30 seconds (2 attempts per second)
        let attempts = 0;
        const requestedAtTime = requestedAt?.getTime?.() || 0;
        const screenshotClockSkewToleranceMs = 30000;

        const tryFetchScreenshot = async () => {
            attempts++;
            debugLog(`📸 Polling for screenshot... Attempt ${attempts}/${maxAttempts}`);

            try {
                const result = await playerAPI.getScreenshot(deviceId);

                if (result.data && result.data.screenshot && result.data.screenshot.image_data) {
                    const screenshotTime = result.data.screenshot.timestamp
                        ? new Date(result.data.screenshot.timestamp).getTime()
                        : 0;

                    if (
                        requestedAtTime
                        && screenshotTime
                        && screenshotTime < requestedAtTime - screenshotClockSkewToleranceMs
                    ) {
                        debugLog('Screenshot is older than the current request, retrying...');
                        throw new Error('Screenshot is still the previous capture');
                    }

                    debugLog('✅ Screenshot received!');
                    setScreenshot(result.data.screenshot.image_data);
                    setShowScreenshot(true);
                    setSuccess('Screenshot captured successfully!');
                    return true;
                }
            } catch (error) {
                debugLog('Screenshot not yet available, retrying...');
            }

            if (attempts < maxAttempts) {
                setTimeout(tryFetchScreenshot, 500); // Retry after 500ms
            } else {
                setError('Screenshot capture timed out. The device may be offline or the screenshot was not captured.');
            }

            return false;
        };

        // Start polling after 2 seconds (give device time to capture)
        setTimeout(tryFetchScreenshot, 2000);
    };

    const handleUpdateSubmit = async () => {
        if (!updateUrl) {
            setError('Please enter an update URL');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');
        setCommandStatus(null);

        try {
            // Check if player exists and has an ID
            if (!player) {
                console.error('Player object is missing');
                setError('Player information is missing');
                setLoading(false);
                return;
            }

            // Log the entire player object for debugging
            debugLog('Current player object for update:', player);

            // Use device_id for command sending
            const deviceId = player.device_id;
            if (!deviceId) {
                console.error('No device_id found on player object:', player);
                setError('Player device_id is missing. Cannot send command.');
                setLoading(false);
                return;
            }

            debugLog(`Sending update command to player with device_id: ${deviceId}`);

            const commandId = await playerAPI.sendCommand(deviceId, {
                type: 'update',
                payload: { url: updateUrl }
            });

            setCommandStatus({
                id: commandId,
                type: 'update',
                status: 'pending',
                timestamp: new Date()
            });
        } catch (err) {
            setError(`Failed to send update command: ${err.message}`);
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Player details
                <IconButton onClick={onClose} edge="end">
                    <CloseIcon />
                </IconButton>
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
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            handleDeviceIdUpdate();
                                        }
                                    }}
                                    error={Boolean(deviceIdError)}
                                    helperText={deviceIdError || "Unieke identifier voor deze player"}
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

                    {/* Company Section - SuperAdmin only */}
                    {isSuperAdmin && (
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle1" gutterBottom>
                                Bedrijf
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Bedrijf</InputLabel>
                                    <Select
                                        value={selectedCompany}
                                        onChange={(e) => {
                                            setSelectedCompany(e.target.value);
                                            setCompanyDirty(true);
                                        }}
                                        label="Bedrijf"
                                        disabled={loading}
                                    >
                                        <MenuItem value="">Unassigned</MenuItem>
                                        {companies.map((company) => (
                                            <MenuItem key={company.company_id} value={company.company_id}>
                                                {company.company_name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <IconButton
                                    color="primary"
                                    onClick={handleCompanyUpdate}
                                    disabled={loading || selectedCompany === (player?.company_id || '')}
                                >
                                    <SaveIcon />
                                </IconButton>
                            </Box>
                        </Box>
                    )}

                    <Typography variant="h6" gutterBottom>
                        Device beheer
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <Button
                            variant="contained"
                            color="warning"
                            onClick={() => handleCommand('restart')}
                            disabled={loading}
                        >
                            Herstart player
                        </Button>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={() => handleCommand('screenshot')}
                            disabled={loading}
                        >
                            Screenshot maken
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={() => handleCommand('setPlayerInfoVisibility', { hidden: 'true' })}
                            disabled={loading}
                        >
                            Player ID verbergen
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={() => handleCommand('setPlayerInfoVisibility', { hidden: 'false' })}
                            disabled={loading}
                        >
                            Player ID tonen
                        </Button>
                    </Box>

                    <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                        App update
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
                        <TextField
                            size="small"
                            placeholder="APK download URL"
                            value={apkUrl}
                            onChange={(e) => setApkUrl(e.target.value)}
                            disabled={loading}
                            sx={{ flexGrow: 1 }}
                        />
                        <Button
                            variant="contained"
                            color="secondary"
                            onClick={() => handleCommand('update', { url: apkUrl })}
                            disabled={loading || !apkUrl}
                        >
                            APK updaten
                        </Button>
                    </Box>

                    <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                        Systeem update
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <Button
                            variant="contained"
                            color="info"
                            onClick={() => handleCommand('updateSystem')}
                            disabled={loading}
                        >
                            Systeemupdates controleren
                        </Button>
                    </Box>

                    <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                        Planning
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => {
                                setEditingSchedule(null);
                                setShowScheduleDialog(true);
                            }}
                            disabled={loading}
                        >
                            Planning toevoegen
                        </Button>
                    </Box>

                    {schedules.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                            {schedules.map((schedule) => (
                                <Box
                                    key={schedule._id}
                                    sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        p: 1,
                                        border: '1px solid #e0e0e0',
                                        borderRadius: 1,
                                        mb: 1
                                    }}
                                >
                                    <Box>
                                        <Typography variant="body2">
                                            {schedule.name || `${schedule.type} schedule`}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {schedule.type === 'content' ? `URL: ${schedule.scheduled_url}` : `Screen: ${schedule.screen_on ? 'ON' : 'OFF'}`}
                                        </Typography>
                                        {schedule.start_time && schedule.end_time && (
                                            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                                ({schedule.start_time} - {schedule.end_time})
                                            </Typography>
                                        )}
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                                        <IconButton
                                            size="small"
                                            onClick={() => {
                                                setEditingSchedule(schedule);
                                                setShowScheduleDialog(true);
                                            }}
                                        >
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            onClick={() => handleDeleteSchedule(schedule._id)}
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                    )}

                    <Typography variant="h6" gutterBottom>
                        URL beheer
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <TextField
                            fullWidth
                            label="Huidige URL"
                            value={currentUrl}
                            onChange={(e) => setCurrentUrl(e.target.value)}
                            disabled={!isEditing}
                        />
                        <Button
                            variant="contained"
                            onClick={async () => {
                                if (isEditing) {
                                    setLoading(true);
                                    try {
                                        // Update URL in database
                                        const { error } = await playerAPI.update(player._id, { current_url: currentUrl });
                                        if (error) throw new Error(error);

                                        // Send navigate command directly
                                        if (player.device_id) {
                                            await playerAPI.sendCommand(player.device_id, {
                                                type: 'navigate',
                                                payload: { url: currentUrl }
                                            });
                                        }

                                        setSuccess('URL updated successfully');
                                        fetchAuditLogs(); // Refresh audit logs
                                        if (onUpdate) onUpdate();
                                    } catch (err) {
                                        setError('Failed to update URL: ' + err.message);
                                    } finally {
                                        setLoading(false);
                                    }
                                }
                                setIsEditing(!isEditing);
                            }}
                            disabled={loading}
                        >
                            {isEditing ? 'Opslaan' : 'Bewerken'}
                        </Button>
                    </Box>
                    <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                        Bestand tonen
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <input
                            type="file"
                            id="file-upload"
                            style={{ display: 'none' }}
                            accept=".pdf,.ppt,.pptx,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
                            onChange={async (e) => {
                                const file = e.target.files[0];
                                if (!file) return;

                                setLoading(true);
                                setError('');
                                try {
                                    const formData = new FormData();
                                    formData.append('file', file);

                                    // Get token using browserAuth like apiClient does
                                    const user = browserAuth.getUser();
                                    const token = user?.token;

                                    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
                                    const response = await fetch(`${API_URL}/players/upload`, {
                                        method: 'POST',
                                        headers: {
                                            'Authorization': `Bearer ${token}`
                                        },
                                        body: formData
                                    });

                                    const result = await response.json();

                                    if (!response.ok) {
                                        throw new Error(result.error || 'Upload failed');
                                    }

                                    // Generate Google Docs Viewer URL
                                    const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(result.url)}&embedded=true`;

                                    // Send navigate command with viewer URL
                                    if (player.device_id) {
                                        await playerAPI.sendCommand(player.device_id, {
                                            type: 'navigate',
                                            payload: { url: viewerUrl }
                                        });
                                    }

                                    setSuccess(`Bestand geupload: ${result.originalName}`);
                                    fetchAuditLogs();
                                    if (onUpdate) onUpdate();
                                } catch (err) {
                                    setError('Bestand uploaden mislukt: ' + err.message);
                                } finally {
                                    setLoading(false);
                                    e.target.value = ''; // Reset file input
                                }
                            }}
                        />
                        <Button
                            variant="outlined"
                            component="label"
                            htmlFor="file-upload"
                            disabled={loading}
                            startIcon={<UploadIcon />}
                        >
                            {loading ? 'Uploaden...' : 'Bestand uploaden'}
                        </Button>
                        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                            PDF, PowerPoint, Word en afbeeldingen (max. 20MB)
                        </Typography>
                    </Box>

                    {success && success.includes('URL') && (
                        <Alert severity="success" sx={{ mb: 2 }}>
                            URL opgeslagen. De player navigeert zo snel mogelijk naar de nieuwe URL.
                        </Alert>
                    )}

                    <Typography variant="h6" gutterBottom>
                        Update beheer
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <TextField
                            fullWidth
                            label="Update URL"
                            value={updateUrl}
                            onChange={(e) => setUpdateUrl(e.target.value)}
                            placeholder="https://voorbeeld.nl/app.apk"
                            disabled={loading}
                        />
                        <Button
                            variant="contained"
                            onClick={handleUpdateSubmit}
                            disabled={loading || !updateUrl}
                        >
                            Updaten
                        </Button>
                    </Box>

                    <Box sx={{ mt: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <HistoryIcon fontSize="small" />
                                Recente wijzigingen
                            </Typography>
                            <Button
                                size="small"
                                onClick={() => setShowAuditLogs(!showAuditLogs)}
                                startIcon={showAuditLogs ? <ExpandLess /> : <ExpandMoreIcon />}
                            >
                                {showAuditLogs ? 'Verbergen' : 'Tonen'}
                            </Button>
                        </Box>

                        {showAuditLogs && (
                            <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                                {auditLogs.length === 0 ? (
                                    <Box sx={{ textAlign: 'center', py: 4 }}>
                                        <HistoryIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                                        <Typography color="text.secondary">
                                            Geen recente wijzigingen
                                        </Typography>
                                    </Box>
                                ) : (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        {auditLogs.map((log) => {
                                            const isUrlChange = log.action === 'url_changed';
                                            const isDeviceIdChange = log.action === 'device_id_changed';
                                            const isCompanyChange = log.action === 'company_changed';
                                            const isCommand = log.action.startsWith('command_');

                                            let icon;
                                            let color;
                                            let label;

                                            if (isUrlChange) {
                                                icon = <LinkIcon />;
                                                color = 'primary';
                                                label = 'URL gewijzigd';
                                            } else if (isDeviceIdChange) {
                                                icon = <DeviceIcon />;
                                                color = 'secondary';
                                                label = 'Device ID gewijzigd';
                                            } else if (isCompanyChange) {
                                                icon = <BusinessIcon />;
                                                color = 'info';
                                                label = 'Bedrijf gewijzigd';
                                            } else if (isCommand) {
                                                const commandType = log.action.replace('command_', '');
                                                if (commandType === 'reboot' || commandType === 'restart' || commandType === 'restartDevice') {
                                                    icon = <PowerSettingsNewIcon />;
                                                    color = 'warning';
                                                    label = 'Player herstart';
                                                } else if (commandType === 'screenshot') {
                                                    icon = <CameraAltIcon />;
                                                    color = 'info';
                                                    label = 'Screenshot';
                                                } else if (commandType === 'update') {
                                                    icon = <SystemUpdateIcon />;
                                                    color = 'success';
                                                    label = 'App update';
                                                } else if (commandType === 'navigate') {
                                                    icon = <NavigationIcon />;
                                                    color = 'primary';
                                                    label = 'Navigeren';
                                                } else {
                                                    icon = <SettingsIcon />;
                                                    color = 'default';
                                                    label = `Commando: ${commandType}`;
                                                }
                                            } else {
                                                icon = <EditIcon />;
                                                color = 'default';
                                                label = log.action.charAt(0).toUpperCase() + log.action.slice(1);
                                            }

                                            return (
                                                <Paper
                                                    key={log._id}
                                                    elevation={1}
                                                    sx={{
                                                        p: 2,
                                                        borderLeft: 4,
                                                        borderColor: `${color}.main`,
                                                        '&:hover': {
                                                            elevation: 2
                                                        }
                                                    }}
                                                >
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <Box sx={{ color: `${color}.main` }}>
                                                                {icon}
                                                            </Box>
                                                            <Typography variant="subtitle2" fontWeight="medium" color={color}>
                                                                {label}
                                                            </Typography>
                                                        </Box>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {new Date(log.createdAt).toLocaleString()}
                                                        </Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                                                        <PersonIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                                        <Typography variant="caption" color="text.secondary">
                                                            {log.user_id?.email || 'Unknown'}
                                                        </Typography>
                                                    </Box>
                                                    {isCommand && log.new_value && (
                                                        <Box sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                                                            <Typography variant="caption" sx={{ fontWeight: 'medium' }}>
                                                                Commando: {log.new_value.command_type}
                                                            </Typography>
                                                            {log.new_value.payload && Object.keys(log.new_value.payload).length > 0 && (
                                                                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                                                                    Payload: {JSON.stringify(log.new_value.payload)}
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    )}
                                                    {log.old_value && log.new_value && !isCommand && (
                                                        <Box sx={{ mt: 1 }}>
                                                            <Typography variant="caption" sx={{ fontWeight: 'medium', mb: 0.5, display: 'block' }}>
                                                                {isUrlChange ? 'URL' : isDeviceIdChange ? 'Device ID' : isCompanyChange ? 'Company' : 'Value'}:
                                                            </Typography>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                                                <Typography
                                                                    variant="caption"
                                                                    sx={{
                                                                        bgcolor: 'error.light',
                                                                        color: 'error.dark',
                                                                        px: 1,
                                                                        py: 0.5,
                                                                        borderRadius: 0.5,
                                                                        fontFamily: 'monospace',
                                                                        maxWidth: '100%',
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis'
                                                                    }}
                                                                >
                                                                    {isCompanyChange
                                                                        ? (companies?.find(c => c._id === log.old_value.company_id)?.company_name || log.old_value.company_id)
                                                                        : (log.old_value.current_url || log.old_value.device_id || JSON.stringify(log.old_value))}
                                                                </Typography>
                                                                <ArrowForwardIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                                                <Typography
                                                                    variant="caption"
                                                                    sx={{
                                                                        bgcolor: 'success.light',
                                                                        color: 'success.dark',
                                                                        px: 1,
                                                                        py: 0.5,
                                                                        borderRadius: 0.5,
                                                                        fontFamily: 'monospace',
                                                                        maxWidth: '100%',
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis'
                                                                    }}
                                                                >
                                                                    {isCompanyChange
                                                                        ? (companies?.find(c => c._id === log.new_value.company_id)?.company_name || log.new_value.company_id)
                                                                        : (log.new_value.current_url || log.new_value.device_id || JSON.stringify(log.new_value))}
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                    )}
                                                </Paper>
                                            );
                                        })}
                                    </Box>
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
                                {commandStatus.status === 'pending' && 'Commando wordt verstuurd...'}
                                {commandStatus.status === 'success' && 'Commando uitgevoerd'}
                                {commandStatus.status === 'error' && `Commando mislukt: ${commandStatus.error}`}
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
                                    src={getScreenshotSrc(screenshot)}
                                    alt="Player screenshot"
                                    style={{ maxWidth: '100%', height: 'auto' }}
                                />
                                <Button
                                    variant="contained"
                                    color="primary"
                                    startIcon={<FileDownloadIcon />}
                                    onClick={() => downloadScreenshotImage(screenshot, player)}
                                >
                                    Screenshot downloaden
                                </Button>
                            </Box>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Schedule Dialog */}
                <ScheduleDialog
                    open={showScheduleDialog}
                    onClose={() => {
                        setShowScheduleDialog(false);
                        setEditingSchedule(null);
                    }}
                    schedule={editingSchedule}
                    onSave={async (scheduleData) => {
                        if (editingSchedule) {
                            await handleUpdateSchedule(editingSchedule._id, scheduleData);
                        } else {
                            await handleCreateSchedule(scheduleData);
                        }
                    }}
                    loading={loading}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={loading}>Sluiten</Button>
            </DialogActions>
        </Dialog>
    );
};

// BulkEditDialog component before PlayerManagement function
const BulkEditDialog = ({ 
  open, 
  onClose, 
  players, 
  companies,
  setError,
  setSuccess 
}) => {
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [editedUrls, setEditedUrls] = useState({});
  const [editedDeviceIds, setEditedDeviceIds] = useState({});
  const [editedCompanies, setEditedCompanies] = useState({});
  const [bulkUrl, setBulkUrl] = useState('');
  const [bulkCompanyId, setBulkCompanyId] = useState('');
  const [bulkApkUrl, setBulkApkUrl] = useState('');
  const [lastBulkResult, setLastBulkResult] = useState(null);
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
    setPage(1);
  }, [searchQuery, filters.companyId, filters.status, filters.lastSeen]);

  const getHoursSinceLastSeen = useCallback((player) => {
    if (!player?.last_seen) return Infinity;
    const lastSeen = new Date(player.last_seen);
    if (Number.isNaN(lastSeen.getTime())) return Infinity;
    return (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60);
  }, []);

  const isInactivePlayer = useCallback((player) => {
    return !player?.is_online && getHoursSinceLastSeen(player) > 24 * 7;
  }, [getHoursSinceLastSeen]);

  useEffect(() => {
    // Reset state when dialog opens
    if (open) {
      setSelectedPlayers([]);
      setEditedUrls({});
      setEditedDeviceIds({});
      setEditedCompanies({});
      setBulkUrl('');
      setBulkCompanyId('');
      setBulkApkUrl('');
      setLastBulkResult(null);
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
        (player.device_id || '').toLowerCase().includes(searchLower) ||
        (player.current_url || '').toLowerCase().includes(searchLower) ||
        (companies.find(c => c.company_id === player.company_id)?.company_name || '').toLowerCase().includes(searchLower);
      
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
        if (filters.status === 'inactive' && !isInactivePlayer(player)) return false;
      }

      // Last seen filter
      if (filters.lastSeen !== 'all') {
        if (filters.lastSeen !== 'never' && !player.last_seen) return false;
        
        const hoursDiff = getHoursSinceLastSeen(player);
        
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
          case 'older_24h':
            if (hoursDiff <= 24) return false;
            break;
          case 'older_7d':
            if (hoursDiff <= 24 * 7) return false;
            break;
          case 'never':
            if (player.last_seen) return false;
            break;
          default:
            break;
        }
      }

      return true;
    });
  }, [players, companies, searchQuery, filters, getHoursSinceLastSeen, isInactivePlayer]);

  useEffect(() => {
    const filteredIds = new Set(filteredPlayers.map(player => player._id));
    setSelectedPlayers(prev => prev.filter(playerId => filteredIds.has(playerId)));
  }, [filteredPlayers]);

  // Get current page players
  const currentPlayers = useMemo(() => {
    const startIndex = (page - 1) * ROWS_PER_PAGE;
    return filteredPlayers.slice(startIndex, startIndex + ROWS_PER_PAGE);
  }, [filteredPlayers, page]);

  const pageCount = Math.max(1, Math.ceil(filteredPlayers.length / ROWS_PER_PAGE));
  const currentPageIds = currentPlayers.map(player => player._id);
  const currentPageSelectedCount = currentPageIds.filter(playerId => selectedPlayers.includes(playerId)).length;
  const selectedPlayerObjects = selectedPlayers
    .map(playerId => players.find(player => player._id === playerId))
    .filter(Boolean);
  const selectedOnlineCount = selectedPlayerObjects.filter(player => player.is_online).length;
  const selectedInactiveCount = selectedPlayerObjects.filter(isInactivePlayer).length;
  const hasBulkChanges = (
    Object.keys(editedUrls).length > 0 ||
    Object.keys(editedDeviceIds).length > 0 ||
    Object.keys(editedCompanies).length > 0
  );

  const handleSelectAll = (event) => {
    const checked = event.target.checked;
    setSelectedPlayers(prev => {
      if (checked) {
        return Array.from(new Set([...prev, ...currentPageIds]));
      }
      return prev.filter(playerId => !currentPageIds.includes(playerId));
    });
  };

  const handleSelectAllFiltered = () => {
    if (filteredPlayers.length > 10) {
      const confirmed = window.confirm(
        `Je selecteert alle ${filteredPlayers.length} gefilterde players. Controleer of de filters kloppen voordat je doorgaat.`
      );
      if (!confirmed) return;
    }
    setSelectedPlayers(filteredPlayers.map(player => player._id));
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

  const handleCompanyChange = (playerId, newCompanyId) => {
    setEditedCompanies(prev => ({
      ...prev,
      [playerId]: newCompanyId
    }));
  };

  const applyBulkUrlToSelection = () => {
    const url = bulkUrl.trim();
    if (selectedPlayers.length === 0) {
      setError('Selecteer eerst minimaal een player');
      return;
    }
    if (!isHttpUrl(url)) {
      setError('Vul een geldige URL in die begint met http:// of https://');
      return;
    }

    setEditedUrls(prev => {
      const next = { ...prev };
      selectedPlayers.forEach(playerId => {
        next[playerId] = url;
      });
      return next;
    });
    setLastBulkResult({
      severity: 'info',
      message: `URL klaargezet voor ${selectedPlayers.length} geselecteerde players. Controleer de tabel en sla daarna op.`
    });
  };

  const applyBulkCompanyToSelection = () => {
    if (!isSuperAdmin) return;
    if (selectedPlayers.length === 0) {
      setError('Selecteer eerst minimaal een player');
      return;
    }
    if (!bulkCompanyId) {
      setError('Kies eerst een bedrijf voor deze bulkactie');
      return;
    }

    setEditedCompanies(prev => {
      const next = { ...prev };
      selectedPlayers.forEach(playerId => {
        next[playerId] = bulkCompanyId === '__none__' ? '' : bulkCompanyId;
      });
      return next;
    });
    setLastBulkResult({
      severity: 'info',
      message: `Bedrijf klaargezet voor ${selectedPlayers.length} geselecteerde players. Controleer de tabel en sla daarna op.`
    });
  };

  const handleSaveAll = async () => {
    if (Object.keys(editedUrls).length === 0 && Object.keys(editedDeviceIds).length === 0 && Object.keys(editedCompanies).length === 0) {
      setError('Er zijn geen wijzigingen om op te slaan');
      return;
    }

    const invalidUrls = Object.values(editedUrls).filter(url => url && !isHttpUrl(url));
    if (invalidUrls.length > 0) {
      setError('Een of meer URL-wijzigingen zijn ongeldig. Gebruik http:// of https://');
      return;
    }

    const changedPlayerCount = new Set([
      ...Object.keys(editedUrls),
      ...Object.keys(editedDeviceIds),
      ...Object.keys(editedCompanies)
    ]).size;
    const confirmationText = [
      `Je gaat wijzigingen opslaan voor ${changedPlayerCount} players.`,
      `${Object.keys(editedUrls).length} URL-wijzigingen`,
      `${Object.keys(editedCompanies).length} bedrijfswijzigingen`,
      `${Object.keys(editedDeviceIds).length} device ID-wijzigingen`,
      '',
      changedPlayerCount > 5 ? 'Dit is een grote bulkactie. Weet je zeker dat je wilt doorgaan?' : 'Doorgaan?'
    ].join('\n');

    if (!window.confirm(confirmationText)) return;

    setLoading(true);
    try {
      // Update URLs that have been modified
      await Promise.all(
        Object.entries(editedUrls).map(async ([playerId, url]) => {
          const response = await playerAPI.update(playerId, { current_url: url });
          if (response?.error) throw new Error(`URL update mislukt voor ${playerId}: ${response.error}`);
          return response;
        })
      );

      // Send navigate commands for URL changes
      const urlCommandResults = await Promise.allSettled(
        Object.entries(editedUrls).map(([playerId, url]) => {
          const player = players.find(p => p._id === playerId);
          if (player && player.device_id) {
            return playerAPI.sendCommand(player.device_id, {
              type: 'navigate',
              payload: { url: url }
            });
          } else {
            console.warn(`Player or device_id not found for ${playerId}, skipping command`);
            return Promise.resolve();
          }
        })
      );

      const urlSuccessCount = urlCommandResults.filter(r => r.status === 'fulfilled' && !r.value?.error).length;
      debugLog(`URL commands: ${urlSuccessCount} players notified`);

      // Update device IDs that have been modified (only for superadmin)
      if (isSuperAdmin && Object.keys(editedDeviceIds).length > 0) {
        await Promise.all(
          Object.entries(editedDeviceIds).map(async ([playerId, deviceId]) => {
            const player = players.find(p => p._id === playerId);
            const oldDeviceId = player?.device_id;

            debugLog(`🔄 Updating device ID for player ${playerId}: ${oldDeviceId} -> ${deviceId}`);

            // Send setPlayerId command with OLD device_id first
            if (oldDeviceId) {
              try {
                debugLog(`🚀 Sending setPlayerId command to ${oldDeviceId}`);
                await playerAPI.sendCommand(oldDeviceId, {
                  type: 'setPlayerId',
                  payload: { playerId: deviceId }
                });
                debugLog(`✅ setPlayerId command sent successfully to ${oldDeviceId}`);
              } catch (cmdErr) {
                console.error(`❌ Failed to send setPlayerId command to ${oldDeviceId}:`, cmdErr);
              }
            }

            // Then update the database
            const { error } = await playerAPI.update(playerId, { device_id: deviceId });
            if (error) throw new Error(error);
          })
        );
      }

      // Update companies that have been modified (only for superadmin)
      if (isSuperAdmin && Object.keys(editedCompanies).length > 0) {
        debugLog('🔄 Updating companies for players:', editedCompanies);
        const companyUpdateResults = await Promise.all(
          Object.entries(editedCompanies).map(async ([playerId, companyId]) => {
            debugLog(`📤 Updating company for player ${playerId} to ${companyId}`);
            const response = await playerAPI.update(playerId, { company_id: companyId });
            if (response?.error) throw new Error(`Bedrijf update mislukt voor ${playerId}: ${response.error}`);
            debugLog(`✅ Company update response for ${playerId}:`, response);
            return response;
          })
        );
        debugLog('✅ All company updates completed:', companyUpdateResults);
      }

      setSuccess(`Wijzigingen opgeslagen. ${urlSuccessCount} players hebben direct een URL-commando gekregen.`);
      setEditedUrls({});
      setEditedDeviceIds({});
      setEditedCompanies({});
      onClose(); // Close dialog after successful save
    } catch (err) {
      setError('Wijzigingen opslaan mislukt: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkCommand = async (playerIds, command, payload = {}) => {
    if (playerIds.length === 0) {
      setError('Selecteer eerst minimaal een player');
      return;
    }

    // For update command, require APK URL
    if (command === 'update' && !payload.url) {
      setError('Vul eerst een APK URL in');
      return;
    }

    const labels = {
      restart: 'herstarten',
      update: 'APK updaten',
      updateSystem: 'systeemupdate uitvoeren',
      setPlayerInfoVisibility: payload.hidden === 'true' ? 'Player ID verbergen' : 'Player ID tonen'
    };
    const confirmWord = {
      restart: 'HERSTART',
      update: 'UPDATE',
      updateSystem: 'SYSTEEMUPDATE',
      setPlayerInfoVisibility: payload.hidden === 'true' ? 'VERBERG' : 'TOON'
    }[command];
    const previewPlayers = playerIds
      .map(playerId => players.find(player => player._id === playerId))
      .filter(Boolean)
      .slice(0, 8)
      .map(player => `${player.device_id || 'Geen device ID'} (${player.company_id || 'geen bedrijf'})`)
      .join('\n');
    const typed = window.prompt(
      [
        `Je gaat ${labels[command] || command} voor ${playerIds.length} geselecteerde players.`,
        '',
        previewPlayers,
        playerIds.length > 8 ? `+${playerIds.length - 8} meer` : '',
        '',
        'Typ exact dit woord om te bevestigen:',
        confirmWord
      ].filter(Boolean).join('\n')
    );
    if ((typed || '').trim().toUpperCase() !== confirmWord) {
      setError('Bulkactie geannuleerd of bevestiging klopte niet.');
      return;
    }

    setLoading(true);
    try {
      debugLog(`Sending ${command} command to ${playerIds.length} players with payload:`, payload);
      
      // Filter out invalid player IDs with detailed logging
      const invalidPlayerIds = [];
      const validPlayerIds = playerIds.filter(id => {
        const isValid = id && /^[0-9a-fA-F]{24}$/.test(id);
        if (!isValid) {
          console.warn(`Invalid player ID format: ${id}`);
          invalidPlayerIds.push(id);
        }
        return isValid;
      });
      
      if (validPlayerIds.length === 0) {
        console.error('No valid player IDs found in selection:', playerIds);
        setError('Geen geldige players gevonden in de selectie.');
        setLoading(false);
        return;
      }
      
      if (validPlayerIds.length < playerIds.length) {
        console.warn(`Filtered out ${playerIds.length - validPlayerIds.length} invalid player IDs:`, invalidPlayerIds);
      }
      
      // Send commands using device_id instead of playerId
      const commandResults = await Promise.allSettled(
        validPlayerIds.map(playerId => {
          const player = players.find(p => p._id === playerId);
          if (player && player.device_id) {
            return playerAPI.sendCommand(player.device_id, {
              type: command,
              payload: Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, String(value)]))
            });
          } else {
            return Promise.resolve({ error: 'Player of device ID niet gevonden' });
          }
        })
      );
      
      const successCount = commandResults.filter(r => r.status === 'fulfilled' && !r.value?.error).length;
      const failures = commandResults.filter(r => r.status === 'rejected' || r.value?.error);
      const failCount = failures.length;
      
      debugLog(`Bulk command: ${successCount} players notified, ${failCount} failed`);
      const message = `${labels[command] || command} commando verstuurd naar ${successCount} van ${validPlayerIds.length} players`;
      if (failCount > 0) {
        const firstError = failures[0]?.reason?.message || failures[0]?.value?.error || 'Onbekende fout';
        setLastBulkResult({ severity: 'warning', message: `${message}. ${failCount} mislukt. Eerste fout: ${firstError}` });
        setError(`${message}. ${failCount} mislukt.`);
      } else {
        setLastBulkResult({ severity: 'success', message });
        setSuccess(message);
      }
    } catch (err) {
      setError(`${command} commando versturen mislukt: ${err.message}`);
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
          <Typography variant="h6">Players bulk bewerken</Typography>
          <Typography variant="subtitle2">
            Geselecteerd: {selectedPlayers.length} van {filteredPlayers.length}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1.5 }}>
        {lastBulkResult && (
          <Alert severity={lastBulkResult.severity}>
            {lastBulkResult.message}
          </Alert>
        )}
        {/* Search and Filters Section */}
        <Paper sx={{ p: 1.5 }}>
          <Grid container spacing={1.5} alignItems="center">
            {/* Search Field - Full Width */}
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                size="small"
                placeholder="Zoek device, URL of bedrijf..."
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
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Bedrijf</InputLabel>
                <Select
                  value={filters.companyId}
                  label="Bedrijf"
                  onChange={(e) => setFilters({ ...filters, companyId: e.target.value })}
                >
                  <MenuItem value="all">Alle bedrijven</MenuItem>
                  <MenuItem value="none">Geen bedrijf</MenuItem>
                  <Divider />
                  {companies.map((company) => (
                    <MenuItem key={company.company_id} value={company.company_id}>
                      {company.company_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  label="Status"
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                >
                  <MenuItem value="all">Alle statussen</MenuItem>
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
                  <MenuItem value="inactive">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircleIcon sx={{ color: 'warning.main', fontSize: 12 }} />
                      Inactief, 7+ dagen offline
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Laatst gezien</InputLabel>
                <Select
                  value={filters.lastSeen}
                  label="Laatst gezien"
                  onChange={(e) => setFilters({ ...filters, lastSeen: e.target.value })}
                >
                  <MenuItem value="all">Alle tijden</MenuItem>
                  <MenuItem value="1h">Laatste uur</MenuItem>
                  <MenuItem value="24h">Laatste 24 uur</MenuItem>
                  <MenuItem value="7d">Laatste 7 dagen</MenuItem>
                  <MenuItem value="30d">Laatste 30 dagen</MenuItem>
                  <MenuItem value="older_24h">Niet gezien 24+ uur</MenuItem>
                  <MenuItem value="older_7d">Niet gezien 7+ dagen</MenuItem>
                  <MenuItem value="never">Nooit gezien</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setFilters({
                    companyId: 'all',
                    status: 'all',
                    lastSeen: 'all'
                  })}
                  startIcon={<Clear />}
                >
                  Filters wissen
                </Button>
              </Box>
            </Grid>
          </Grid>

          {/* Filter Summary and Actions */}
          <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                {filteredPlayers.length} players gevonden. {selectedPlayers.length} geselecteerd ({selectedOnlineCount} online, {selectedPlayers.length - selectedOnlineCount} offline, {selectedInactiveCount} inactief).
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 0.75, flexWrap: 'wrap' }}>
                <Button size="small" variant="outlined" onClick={() => handleSelectAll({ target: { checked: true } })} disabled={loading || currentPlayers.length === 0}>
                  Selecteer pagina ({currentPlayers.length})
                </Button>
                <Button size="small" variant="outlined" onClick={handleSelectAllFiltered} disabled={loading || filteredPlayers.length === 0}>
                  Selecteer alle gefilterde ({filteredPlayers.length})
                </Button>
                <Button size="small" onClick={() => setSelectedPlayers([])} disabled={loading || selectedPlayers.length === 0}>
                  Selectie wissen
                </Button>
              </Box>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<RefreshIcon />}
                onClick={() => handleBulkCommand(selectedPlayers, 'restart')}
                disabled={loading || selectedPlayers.length === 0}
              >
                Herstarten
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => handleBulkCommand(selectedPlayers, 'setPlayerInfoVisibility', { hidden: 'true' })}
                disabled={loading || selectedPlayers.length === 0}
              >
                Player ID verbergen
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => handleBulkCommand(selectedPlayers, 'setPlayerInfoVisibility', { hidden: 'false' })}
                disabled={loading || selectedPlayers.length === 0}
              >
                Player ID tonen
              </Button>
              <TextField
                size="small"
                placeholder="APK URL"
                value={bulkApkUrl}
                onChange={(e) => setBulkApkUrl(e.target.value)}
                disabled={loading}
                sx={{ width: 250 }}
              />
              <Button
                variant="outlined"
                size="small"
                startIcon={<UpdateIcon />}
                onClick={() => handleBulkCommand(selectedPlayers, 'update', { url: bulkApkUrl })}
                disabled={loading || selectedPlayers.length === 0 || !bulkApkUrl}
              >
                Update APK
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<SystemUpdateIcon />}
                onClick={() => handleBulkCommand(selectedPlayers, 'updateSystem')}
                disabled={loading || selectedPlayers.length === 0}
              >
                Systeemupdate
              </Button>
            </Box>
          </Box>

          <Divider sx={{ my: 1.25 }} />

          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={12} md={5}>
              <TextField
                fullWidth
                size="small"
                label="URL voor geselecteerde players"
                placeholder="https://voorbeeld.nl"
                value={bulkUrl}
                onChange={(e) => setBulkUrl(e.target.value)}
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <Button fullWidth size="small" variant="outlined" onClick={applyBulkUrlToSelection} disabled={loading || selectedPlayers.length === 0}>
                URL klaarzetten
              </Button>
            </Grid>
            {isSuperAdmin && (
              <>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Bedrijf voor selectie</InputLabel>
                    <Select
                      value={bulkCompanyId}
                      label="Bedrijf voor selectie"
                      onChange={(e) => setBulkCompanyId(e.target.value)}
                      disabled={loading}
                    >
                      <MenuItem value="__none__">Geen bedrijf</MenuItem>
                      {companies.map((company) => (
                        <MenuItem key={company.company_id} value={company.company_id}>
                          {company.company_name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <Button fullWidth size="small" variant="outlined" onClick={applyBulkCompanyToSelection} disabled={loading || selectedPlayers.length === 0}>
                    Bedrijf klaarzetten
                  </Button>
                </Grid>
              </>
            )}
            {hasBulkChanges && (
              <Grid item xs={12}>
                <Alert severity="info">
                  Er staan wijzigingen klaar voor {new Set([...Object.keys(editedUrls), ...Object.keys(editedDeviceIds), ...Object.keys(editedCompanies)]).size} players. Controleer de tabel en gebruik daarna "Wijzigingen opslaan".
                </Alert>
              </Grid>
            )}
          </Grid>
        </Paper>

        {/* Players Table */}
        <TableContainer component={Paper} sx={{ flex: 1 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={currentPageSelectedCount > 0 && currentPageSelectedCount < currentPlayers.length}
                    checked={currentPlayers.length > 0 && currentPageSelectedCount === currentPlayers.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>Device ID</TableCell>
                <TableCell>Bedrijf</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Laatst gezien</TableCell>
                <TableCell>URL</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {currentPlayers.map((player) => {
                const company = companies.find(c => c.company_id === player.company_id);
                const hasUrlChanged = editedUrls[player._id] !== undefined;
                const hasDeviceIdChanged = editedDeviceIds[player._id] !== undefined;
                const hasCompanyChanged = editedCompanies[player._id] !== undefined;
                const inactive = isInactivePlayer(player);
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
                          placeholder="Device ID"
                          disabled={loading}
                          sx={{
                            backgroundColor: hasDeviceIdChanged ? 'action.hover' : 'transparent',
                          }}
                        />
                      ) : (
                        <Typography variant="body2">{player.device_id || 'Geen device ID'}</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {isSuperAdmin ? (
                        <FormControl fullWidth size="small">
                          <InputLabel>Bedrijf</InputLabel>
                          <Select
                            value={editedCompanies[player._id] !== undefined ? editedCompanies[player._id] : player.company_id || ''}
                            onChange={(e) => handleCompanyChange(player._id, e.target.value)}
                            label="Bedrijf"
                            disabled={loading}
                            sx={{
                              backgroundColor: editedCompanies[player._id] !== undefined ? 'action.hover' : 'transparent',
                            }}
                          >
                            <MenuItem value="">Geen bedrijf</MenuItem>
                            {companies.map((company) => (
                              <MenuItem key={company.company_id} value={company.company_id}>
                                {company.company_name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      ) : (
                        <Typography variant="body2">{company?.company_name || 'Geen bedrijf'}</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Chip
                        label={player.is_online ? 'Online' : inactive ? 'Inactief' : 'Offline'}
                        color={player.is_online ? 'success' : inactive ? 'warning' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 260 }}>
                      {formatDateTime(player.last_seen)}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <TextField
                          size="small"
                          fullWidth
                          value={editedUrls[player._id] !== undefined ? editedUrls[player._id] : player.current_url || ''}
                          onChange={(e) => handleUrlChange(player._id, e.target.value)}
                          placeholder="https://voorbeeld.nl"
                          disabled={loading}
                          sx={{
                            backgroundColor: hasUrlChanged ? 'action.hover' : 'transparent',
                          }}
                        />
                        {(hasUrlChanged || hasCompanyChanged || hasDeviceIdChanged) && (
                          <Chip
                            size="small"
                            color="primary"
                            variant="outlined"
                            label={[
                              hasUrlChanged ? 'URL' : null,
                              hasCompanyChanged ? 'Bedrijf' : null,
                              hasDeviceIdChanged ? 'Device ID' : null
                            ].filter(Boolean).join(', ')}
                          />
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
              {currentPlayers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    Geen players gevonden met deze filters.
                  </TableCell>
                </TableRow>
              )}
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
            disabled={loading || !hasBulkChanges}
          >
            Wijzigingen opslaan
          </Button>
          <Button onClick={onClose} disabled={loading}>Sluiten</Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

function PlayerManagement({ companies: externalCompanies, compactSummary = false }) {
  debugLog('🏢 PlayerManagement received externalCompanies:', externalCompanies);

  // State for players and companies
  const [players, setPlayers] = useState([]);
  const [companies, setCompanies] = useState(externalCompanies || []);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  // State for company grouping
  const [expandedCompanies, setExpandedCompanies] = useState({});

  // State for URL editing
  const [editingUrl, setEditingUrl] = useState({});
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // State for delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [deleteInProgress, setDeleteInProgress] = useState(false);

  // State for bulk edit dialog
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);

  // Update companies state when externalCompanies prop changes
  useEffect(() => {
    if (externalCompanies && externalCompanies.length > 0) {
      setCompanies(externalCompanies);
    }
  }, [externalCompanies]);

  // Define refreshData function with useCallback
  const refreshData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError('');
    try {
      // Only fetch companies if not provided externally
      const promises = [playerAPI.getAll()];
      if (!externalCompanies) {
        promises.push(companyAPI.getAll());
      }

      const results = await Promise.all(promises);
      const [playersRes, companiesRes] = results;

      if (playersRes.error) throw new Error(playersRes.error);
      if (companiesRes?.error) throw new Error(companiesRes.error);

      setPlayers(playersRes.data || []);
      const sourceCompanies = externalCompanies || companiesRes?.data || [];
      const shouldExpandByDefault = sourceCompanies.length <= 2 && (playersRes.data || []).length <= 24;

      if (!externalCompanies && companiesRes) {
        setCompanies(sourceCompanies);

        // Initialize expanded state for all companies
        setExpandedCompanies(prev => {
          const expandedState = {};
          sourceCompanies.forEach(company => {
            expandedState[company.company_id] = prev[company.company_id] ?? shouldExpandByDefault;
          });
          expandedState.noCompany = prev.noCompany ?? shouldExpandByDefault;
          return expandedState;
        });
      } else if (sourceCompanies) {
        // Initialize expanded state from external companies
        setExpandedCompanies(prev => {
          const expandedState = {};
          sourceCompanies.forEach(company => {
            expandedState[company.company_id] = prev[company.company_id] ?? shouldExpandByDefault;
          });
          expandedState.noCompany = prev.noCompany ?? shouldExpandByDefault;
          return expandedState;
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      if (silent) setIsRefreshing(false);
    }
  }, [externalCompanies]);

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
            refreshData({ silent: true });
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

  const playerSummary = useMemo(() => {
    const online = players.filter(player => player.is_online).length;
    return {
      total: players.length,
      online,
      offline: players.length - online,
      visible: filteredAndSortedPlayers.length
    };
  }, [players, filteredAndSortedPlayers]);

  // Handle company expansion toggle
  const toggleCompanyExpansion = (companyId) => {
    setExpandedCompanies(prev => ({
      ...prev,
      [companyId]: !prev[companyId]
    }));
  };

  // Update handleUrlUpdate to send navigate command to player
  const handleUrlUpdate = async (playerId, newUrl) => {
    try {
      // 1. Update URL in database
      const { error } = await playerAPI.update(playerId, { current_url: newUrl });
      if (error) throw new Error(error);

      // 2. Get the player object to retrieve device_id
      const player = players.find(p => p._id === playerId);
      if (!player || !player.device_id) {
        console.warn('Player or device_id not found, skipping command');
      } else {
        // 3. Send navigate command to player using device_id
        try {
          await playerAPI.sendCommand(player.device_id, {
            type: 'navigate',
            payload: { url: newUrl }
          });
          debugLog(`Navigate command sent to player ${player.device_id} for URL: ${newUrl}`);
        } catch (cmdError) {
          console.warn('Failed to send navigate command:', cmdError);
          // Don't throw - URL was still saved, player can get it on next heartbeat
        }
      }

      // 4. Update local state immediately
      setPlayers(prevPlayers => prevPlayers.map(player =>
        player._id === playerId ? { ...player, current_url: newUrl } : player
      ));

      setEditingUrl({ ...editingUrl, [playerId]: false });
      setSuccess('URL updated and player notified successfully');
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

    debugLog('Attempting to delete player: [MASKED]');
    debugLog('Player ID: [MASKED]');
    debugLog('Full player object:', '[SENSITIVE_DATA_MASKED]');
    
    setPlayerToDelete(player);
    setDeleteConfirmationText('');
    setDeleteDialogOpen(true);
  };

  // Update handleDeleteConfirm to properly handle WebSocket updates
  const handleDeleteConfirm = async () => {
    if (!playerToDelete) {
      console.error('No player selected for deletion');
      return;
    }

    if (deleteConfirmationText.trim().toLowerCase() !== 'verwijderen') {
      setError('Typ VERWIJDEREN om deze player definitief te verwijderen.');
      return;
    }

    setDeleteInProgress(true);
    try {
      const { data, error } = await playerAPI.delete(playerToDelete._id);
      if (error) throw new Error(error);
      
      // Update local state immediately
      setPlayers(prevPlayers => prevPlayers.filter(p => p._id !== playerToDelete._id));
      setSuccess(
        data?.deviceNotified
          ? 'Player verwijderd uit de database en de draaiende player is ontkoppeld.'
          : 'Player verwijderd uit de database. De player was niet live verbonden, dus lokaal ontkoppelen kon niet direct.'
      );
      
      setDeleteDialogOpen(false);
      setPlayerToDelete(null);
      setDeleteConfirmationText('');
    } catch (err) {
      console.error('Failed to delete player:', err);
      setError(`Player verwijderen mislukt: ${err.message}`);
    } finally {
      setDeleteInProgress(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setPlayerToDelete(null);
    setDeleteConfirmationText('');
  };

  const handleDetailsClick = (player) => {
    setSelectedPlayer(player);
    setDetailsDialogOpen(true);
  };

  return (
    <Box sx={{ width: '100%' }}>
      {!compactSummary && (
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6} md={3}>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">Totaal</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{playerSummary.total}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} md={3}>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">Online</Typography>
            <Typography variant="h5" color="success.main" sx={{ fontWeight: 700 }}>{playerSummary.online}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} md={3}>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">Offline</Typography>
            <Typography variant="h5" color="error.main" sx={{ fontWeight: 700 }}>{playerSummary.offline}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} md={3}>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">Zichtbaar</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{playerSummary.visible}</Typography>
          </Paper>
        </Grid>
      </Grid>
      )}

      {/* Header with search and filters */}
      <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          {/* Search and Quick Filters Row */}
          <Grid item xs={12} md={5}>
            <TextField
              fullWidth
              placeholder="Zoek players..."
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

          <Grid item xs={12} md={7}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: { xs: 'flex-start', md: 'flex-end' }, flexWrap: 'wrap' }}>
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
                  onClick={() => refreshData({ silent: true })} 
                  color="primary"
                  size="small"
                  disabled={isRefreshing}
                  sx={{
                    animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                    '@keyframes spin': {
                      '0%': { transform: 'rotate(0deg)' },
                      '100%': { transform: 'rotate(360deg)' }
                    }
                  }}
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
                Bulk bewerken
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
      {loading && players.length === 0 ? (
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
          <Paper key={company.company_id} elevation={0} sx={{ mb: 1.5, width: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
            <Box 
              sx={{ 
                p: 1.5, 
                borderBottom: expandedCompanies[company.company_id] ? 1 : 0, 
                borderColor: 'divider', 
                bgcolor: 'background.paper',
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: 'action.hover'
                }
              }}
              onClick={() => toggleCompanyExpansion(company.company_id)}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <BusinessIcon sx={{ mr: 1, fontSize: 20, color: 'text.secondary' }} />
                    <Typography variant="subtitle1" component="span" sx={{ fontWeight: 700 }}>
                      {company.company_name}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip 
                      size="small"
                      label={`${groupPlayers.length} players`}
                      variant="outlined"
                    />
                    <Chip 
                      size="small"
                      label={`${groupPlayers.filter(p => p.is_online).length} online`}
                      color="success"
                      variant="outlined"
                    />
                    <Chip 
                      size="small"
                      label={`${groupPlayers.filter(p => !p.is_online).length} offline`}
                      color="error"
                      variant="outlined"
                    />
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, alignSelf: { xs: 'stretch', sm: 'center' }, justifyContent: 'flex-end' }}>
                  <Button
                    size="small"
                    startIcon={<RefreshIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      const playerIds = groupPlayers.map(p => p._id);
                      
                      // Validation and send commands directly
                      if (playerIds.length === 0) {
                        setError('Geen players gevonden');
                        return;
                      }
                      
                      setLoading(true);
                      debugLog(`Sending restart command to ${playerIds.length} players in ${company.company_name}`);
                      
                      // Filter valid IDs
                      const validPlayerIds = playerIds.filter(id => id && /^[0-9a-fA-F]{24}$/.test(id));
                      
                      if (validPlayerIds.length === 0) {
                        setError('Geen geldige players gevonden');
                        setLoading(false);
                        return;
                      }
                      
                      Promise.all(
                        validPlayerIds.map(playerId => {
                          return playerAPI.sendCommand(playerId, {
                            type: 'restart',
                            payload: {}
                          });
                        })
                      )
                      .then(() => {
                        setSuccess(`Herstartcommando verstuurd naar ${validPlayerIds.length} players`);
                        setLoading(false);
                      })
                      .catch(err => {
                        setError(`Herstartcommando versturen mislukt: ${err.message}`);
                        setLoading(false);
                      });
                    }}
                  >
                    Alles herstarten
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCompanyExpansion(company.company_id);
                    }}
                    endIcon={<ExpandMoreIcon />}
                    sx={{ 
                      '& .MuiButton-endIcon': {
                        transform: expandedCompanies[company.company_id] ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s'
                      }
                    }}
                  >
                    {expandedCompanies[company.company_id] ? 'Verberg' : 'Toon'}
                  </Button>
                </Box>
              </Box>
            </Box>

            <Collapse in={expandedCompanies[company.company_id]}>
              <Box sx={{ p: 2, bgcolor: '#fafbfc' }}>
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
        <Paper elevation={0} sx={{ mb: 1.5, width: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
          <Box 
            sx={{ 
              p: 1.5, 
              borderBottom: expandedCompanies.noCompany ? 1 : 0, 
              borderColor: 'divider', 
              bgcolor: 'background.paper',
              cursor: 'pointer',
              '&:hover': {
                bgcolor: 'action.hover'
              }
            }}
            onClick={() => toggleCompanyExpansion('noCompany')}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <DevicesOther sx={{ mr: 1, fontSize: 20, color: 'text.secondary' }} />
                  <Typography variant="subtitle1" component="span" sx={{ fontWeight: 700 }}>
                    Zonder bedrijf
                  </Typography>
                </Box>
                <Chip 
                  label={`${groupedPlayers.noCompany.players.length} players`}
                  size="small"
                  variant="outlined"
                />
              </Box>
              <Button
                size="small"
                variant="text"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCompanyExpansion('noCompany');
                }}
                endIcon={<ExpandMoreIcon />}
                sx={{ 
                  alignSelf: { xs: 'flex-end', sm: 'center' },
                  '& .MuiButton-endIcon': {
                    transform: expandedCompanies.noCompany ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s'
                  }
                }}
              >
                {expandedCompanies.noCompany ? 'Verberg' : 'Toon'}
              </Button>
            </Box>
          </Box>

          <Collapse in={expandedCompanies['noCompany']}>
            <Box sx={{ p: 2, bgcolor: '#fafbfc' }}>
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
            Geen players gevonden
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
        onUpdate={refreshData}
        companies={companies}
      />

      <Dialog
        open={deleteDialogOpen}
        onClose={deleteInProgress ? undefined : handleDeleteCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Player definitief verwijderen</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Deze actie verwijdert de player uit de database, inclusief gekoppelde commando's, health data en audit logs. Als de player online is, krijgt hij ook een ontkoppelcommando.
          </Alert>
          <Typography sx={{ mb: 2 }}>
            Player: <strong>{playerToDelete?.device_id}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Typ <strong>VERWIJDEREN</strong> om te bevestigen.
          </Typography>
          <TextField
            fullWidth
            autoFocus
            value={deleteConfirmationText}
            onChange={(event) => setDeleteConfirmationText(event.target.value)}
            placeholder="VERWIJDEREN"
            disabled={deleteInProgress}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleteInProgress}>Annuleren</Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleteInProgress || deleteConfirmationText.trim().toLowerCase() !== 'verwijderen'}
          >
            {deleteInProgress ? 'Verwijderen...' : 'Definitief verwijderen'}
          </Button>
        </DialogActions>
      </Dialog>

      <BulkEditDialog
        open={bulkEditDialogOpen}
        onClose={() => setBulkEditDialogOpen(false)}
        players={filteredAndSortedPlayers}
        companies={companies}
        setError={setError}
        setSuccess={setSuccess}
      />
    </Box>
  );
}

export default PlayerManagement;

