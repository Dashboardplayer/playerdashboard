import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Chip,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Alert,
  Snackbar
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { playerAPI, companyAPI } from '../../hooks/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { useUser } from '../../contexts/UserContext';

const PlayerDetails = ({ open, onClose, player, companies, onUpdate, setError, setSuccess }) => {
  const [editedPlayer, setEditedPlayer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { profile } = useUser();
  const isSuperAdmin = profile?.role === 'superadmin';
  const { user } = useAuth();

  useEffect(() => {
    if (player) {
      setEditedPlayer({ ...player });
    }
  }, [player]);

  const handleChange = (field) => (event) => {
    if (field === 'device_id' && !isSuperAdmin) {
      return;
    }
    
    setEditedPlayer(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleSave = async () => {
    if (!editedPlayer) return;

    setLoading(true);
    try {
      const updates = { ...editedPlayer };
      if (!isSuperAdmin) {
        delete updates.device_id;
        delete updates.company_id;
      } else {
        // If company_id is empty string, set it to empty (unassigned)
        if (updates.company_id === '') {
          updates.company_id = '';
        }
      }

      // Check if URL was changed
      const urlChanged = player.current_url !== editedPlayer.current_url;
      // Check if device_id was changed
      const deviceIdChanged = player.device_id !== editedPlayer.device_id;

      // If device_id was changed, send setPlayerId command FIRST (using OLD device_id)
      if (deviceIdChanged && isSuperAdmin && player.device_id && editedPlayer.device_id) {
        try {
          console.log(`🔄 Sending setPlayerId command: ${player.device_id} -> ${editedPlayer.device_id}`);
          const commandResult = await playerAPI.sendCommand(player.device_id, {
            type: 'setPlayerId',
            payload: { playerId: editedPlayer.device_id }
          });
          console.log('✅ Command result:', commandResult);
          if (commandResult.error) {
            console.error('❌ Command error:', commandResult.error);
            throw new Error(commandResult.error);
          }
          setSuccess('Command sent to device. Updating database...');
        } catch (cmdErr) {
          console.error('❌ Failed to send setPlayerId command:', cmdErr);
          setError(`Failed to send command: ${cmdErr.message}. Will update database anyway.`);
          // Continue with database update even if command fails
        }
      }

      await playerAPI.update(editedPlayer._id, updates);
      
      // If URL was changed, send navigate command to player
      if (urlChanged && editedPlayer.current_url && editedPlayer.device_id) {
        try {
          await playerAPI.sendCommand(editedPlayer.device_id, {
            type: 'navigate',
            payload: { url: editedPlayer.current_url }
          });
          console.log(`Navigate command sent to player ${editedPlayer.device_id} for URL: ${editedPlayer.current_url}`);
        } catch (cmdError) {
          console.warn('Failed to send navigate command:', cmdError);
          // Don't throw - URL was still saved, player can get it on next heartbeat
        }
      }
      
      onUpdate(editedPlayer);
      setSuccess('Player updated successfully');
      setShowSuccess(true);
      onClose();
    } catch (err) {
      setError('Failed to update player: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!editedPlayer) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Player Details</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={3} sx={{ mt: 1 }}>
          {isSuperAdmin && (
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Device ID"
                value={editedPlayer.device_id || ''}
                onChange={handleChange('device_id')}
                disabled={!isSuperAdmin}
              />
            </Grid>
          )}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Current URL"
              value={editedPlayer.current_url || ''}
              onChange={handleChange('current_url')}
              disabled={loading}
            />
          </Grid>
          {isSuperAdmin && (
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Company</InputLabel>
                <Select
                  value={editedPlayer.company_id || ''}
                  onChange={handleChange('company_id')}
                  label="Company"
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
            </Grid>
          )}
          <Grid item xs={12} md={6}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>Status</Typography>
              <Chip
                label={editedPlayer.is_online ? 'Online' : 'Offline'}
                color={editedPlayer.is_online ? 'success' : 'error'}
                size="small"
              />
            </Box>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>Last Seen</Typography>
            <Typography variant="body2">
              {editedPlayer.last_seen ? new Date(editedPlayer.last_seen).toLocaleString() : 'Never'}
            </Typography>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          color="primary"
          disabled={loading}
        >
          Save Changes
        </Button>
      </DialogActions>
      <Snackbar
        open={showSuccess}
        autoHideDuration={6000}
        onClose={() => setShowSuccess(false)}
      >
        <Alert onClose={() => setShowSuccess(false)} severity="success">
          Player updated successfully
        </Alert>
      </Snackbar>
    </Dialog>
  );
};

export default PlayerDetails; 