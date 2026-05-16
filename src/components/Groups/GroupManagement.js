import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Grid,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  InputAdornment,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Group as GroupIcon,
  Remove as RemoveIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { groupAPI, playerAPI } from '../../hooks/apiClient';

const GroupManagement = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#1976d2'
  });
  const [showPlayerDialog, setShowPlayerDialog] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [allPlayers, setAllPlayers] = useState([]);
  const [groupPlayers, setGroupPlayers] = useState([]);
  const [playerSearch, setPlayerSearch] = useState('');
  const [groupToDelete, setGroupToDelete] = useState(null);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const { data, error } = await groupAPI.getAll();
      if (error) {
        setError('Groepen ophalen mislukt: ' + error);
      } else {
        setGroups(data || []);
      }
    } catch (err) {
      setError('Groepen ophalen mislukt: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      setError('Groepsnaam is verplicht');
      return;
    }

    setLoading(true);
    try {
      const { error } = await groupAPI.create(formData);
      if (error) {
        setError('Groep aanmaken mislukt: ' + error);
      } else {
        setSuccess('Groep aangemaakt');
        setShowDialog(false);
        setFormData({ name: '', description: '', color: '#1976d2' });
        fetchGroups();
      }
    } catch (err) {
      setError('Groep aanmaken mislukt: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!formData.name.trim()) {
      setError('Groepsnaam is verplicht');
      return;
    }

    setLoading(true);
    try {
      const { error } = await groupAPI.update(editingGroup._id, formData);
      if (error) {
        setError('Groep opslaan mislukt: ' + error);
      } else {
        setSuccess('Groep opgeslagen');
        setShowDialog(false);
        setEditingGroup(null);
        setFormData({ name: '', description: '', color: '#1976d2' });
        fetchGroups();
      }
    } catch (err) {
      setError('Groep opslaan mislukt: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!groupToDelete) return;

    setLoading(true);
    try {
      const { error } = await groupAPI.delete(groupToDelete._id);
      if (error) {
        setError('Groep verwijderen mislukt: ' + error);
      } else {
        setSuccess('Groep verwijderd');
        setGroupToDelete(null);
        fetchGroups();
      }
    } catch (err) {
      setError('Groep verwijderen mislukt: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (group = null) => {
    if (group) {
      setEditingGroup(group);
      setFormData({
        name: group.name,
        description: group.description || '',
        color: group.color || '#1976d2'
      });
    } else {
      setEditingGroup(null);
      setFormData({ name: '', description: '', color: '#1976d2' });
    }
    setShowDialog(true);
  };

  const fetchAllPlayers = async () => {
    const { data, error } = await playerAPI.getAll();
    if (!error) {
      setAllPlayers(data || []);
    }
  };

  const fetchGroupPlayers = async (groupId) => {
    const { data, error } = await groupAPI.getPlayers(groupId);
    if (!error) {
      setGroupPlayers(data || []);
    }
  };

  const openPlayerDialog = async (group) => {
    setSelectedGroup(group);
    setPlayerSearch('');
    await fetchAllPlayers();
    await fetchGroupPlayers(group._id);
    setShowPlayerDialog(true);
  };

  const handleAddPlayer = async (playerId) => {
    if (!selectedGroup) return;
    setLoading(true);
    try {
      const { error } = await groupAPI.addPlayer(selectedGroup._id, playerId);
      if (error) {
        setError('Player toevoegen mislukt: ' + error);
      } else {
        setSuccess('Player toegevoegd aan groep');
        await fetchGroupPlayers(selectedGroup._id);
        fetchGroups();
      }
    } catch (err) {
      setError('Player toevoegen mislukt: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePlayer = async (playerId) => {
    if (!selectedGroup) return;
    setLoading(true);
    try {
      const { error } = await groupAPI.removePlayer(selectedGroup._id, playerId);
      if (error) {
        setError('Player verwijderen uit groep mislukt: ' + error);
      } else {
        setSuccess('Player verwijderd uit groep');
        await fetchGroupPlayers(selectedGroup._id);
        fetchGroups();
      }
    } catch (err) {
      setError('Player verwijderen uit groep mislukt: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const availablePlayers = allPlayers.filter(
    player => !groupPlayers.some(groupPlayer => groupPlayer._id === player._id)
  );

  const filteredAvailablePlayers = availablePlayers.filter((player) => {
    const query = playerSearch.trim().toLowerCase();
    if (!query) return true;
    return (
      (player.device_id || '').toLowerCase().includes(query) ||
      (player.current_url || '').toLowerCase().includes(query)
    );
  });

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <GroupIcon />
          Groepen
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => openDialog()}
          disabled={loading}
        >
          Groep toevoegen
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {loading && groups.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={2}>
          {groups.length === 0 && (
            <Grid item xs={12}>
              <Card sx={{ textAlign: 'center', py: 5 }}>
                <CardContent>
                  <GroupIcon sx={{ fontSize: 44, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="h6">Nog geen groepen</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Maak een groep aan om players logisch te bundelen.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          )}
          {groups.map((group) => (
            <Grid item xs={12} sm={6} md={4} key={group._id}>
              <Card
                sx={{
                  borderLeft: 4,
                  borderColor: group.color || '#1976d2',
                  '&:hover': { elevation: 2 }
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                      {group.name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Players beheren">
                        <IconButton size="small" onClick={() => openPlayerDialog(group)}>
                        <GroupIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Groep bewerken">
                        <IconButton size="small" onClick={() => openDialog(group)}>
                        <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Groep verwijderen">
                        <IconButton size="small" onClick={() => setGroupToDelete(group)}>
                        <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                  {group.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {group.description}
                    </Typography>
                  )}
                  <Chip
                    label={`${group.playerCount || 0} players`}
                    size="small"
                    sx={{ mt: 1 }}
                  />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={showDialog} onClose={() => setShowDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingGroup ? 'Groep bewerken' : 'Groep toevoegen'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Groepsnaam"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              autoFocus
            />
            <TextField
              label="Omschrijving"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
            <TextField
              label="Kleur"
              type="color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDialog(false)} disabled={loading}>
            Annuleren
          </Button>
          <Button onClick={editingGroup ? handleUpdate : handleCreate} variant="contained" disabled={loading}>
            {editingGroup ? 'Opslaan' : 'Aanmaken'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Player Assignment Dialog */}
      <Dialog open={showPlayerDialog} onClose={() => setShowPlayerDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Players beheren - {selectedGroup?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <Typography variant="h6" gutterBottom>
              Players in groep ({groupPlayers.length})
            </Typography>
            <List>
              {groupPlayers.map((player) => (
                <ListItem key={player._id}>
                  <ListItemText
                    primary={player.device_id}
                    secondary={player.current_url || 'Geen URL ingesteld'}
                  />
                  <ListItemSecondaryAction>
                    <IconButton onClick={() => handleRemovePlayer(player._id)} disabled={loading}>
                      <RemoveIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
              {groupPlayers.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                  Geen players in deze groep
                </Typography>
              )}
            </List>

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" gutterBottom>
              Beschikbare players
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="Zoek beschikbare players..."
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
              sx={{ mb: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
            />
            <List sx={{ maxHeight: 300, overflow: 'auto' }}>
              {filteredAvailablePlayers.map((player) => (
                <ListItem key={player._id}>
                  <ListItemText
                    primary={player.device_id}
                    secondary={player.current_url || 'Geen URL ingesteld'}
                  />
                  <ListItemSecondaryAction>
                    <IconButton onClick={() => handleAddPlayer(player._id)} disabled={loading}>
                      <AddIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
              {filteredAvailablePlayers.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                  Geen beschikbare players gevonden.
                </Typography>
              )}
            </List>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPlayerDialog(false)} disabled={loading}>
            Sluiten
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!groupToDelete} onClose={() => setGroupToDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Groep verwijderen</DialogTitle>
        <DialogContent>
          <Typography>
            Weet je zeker dat je groep "{groupToDelete?.name}" wilt verwijderen? De players blijven bestaan, maar worden uit deze groep gehaald.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGroupToDelete(null)} disabled={loading}>Annuleren</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={loading}>
            Verwijderen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GroupManagement;
