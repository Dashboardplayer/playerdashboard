import React, { useState, useEffect } from 'react';
import { Button, ButtonGroup, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel, Select, MenuItem, CircularProgress, Box } from '@mui/material';
import { firebaseService } from '../../services/firebaseService';

const PlayerControls = ({ playerId, onCommandSent, onError }) => {
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [updateDialog, setUpdateDialog] = useState(false);
    const [updateUrl, setUpdateUrl] = useState('');
    const [updateType, setUpdateType] = useState('app'); // 'app' or 'system'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [commandStatus, setCommandStatus] = useState(null);

    useEffect(() => {
        // Subscribe to command acknowledgments
        const handleAcknowledgment = (acknowledgment) => {
            if (acknowledgment.commandId === commandStatus?.id) {
                setCommandStatus(prev => ({
                    ...prev,
                    status: acknowledgment.status,
                    error: acknowledgment.error,
                    timestamp: acknowledgment.timestamp
                }));

                if (acknowledgment.status === 'success') {
                    setSuccess('Command executed successfully');
                    setUpdateDialog(false);
                } else if (acknowledgment.status === 'error') {
                    setError(`Command failed: ${acknowledgment.error}`);
                }
            }
        };

        firebaseService.onCommandAcknowledgment(handleAcknowledgment);

        return () => {
            // Cleanup subscription if needed
        };
    }, [commandStatus?.id]);

    const handleCommand = async (command) => {
        try {
            switch (command) {
                case 'reboot':
                    await firebaseService.sendCommand(playerId, {
                        type: 'reboot',
                        payload: {}
                    });
                    setSnackbar({
                        open: true,
                        message: 'Reboot command sent successfully',
                        severity: 'success'
                    });
                    break;
                case 'screenshot':
                    await firebaseService.sendCommand(playerId, {
                        type: 'screenshot',
                        payload: {}
                    });
                    setSnackbar({
                        open: true,
                        message: 'Screenshot request sent successfully',
                        severity: 'success'
                    });
                    break;
                case 'update':
                    setUpdateDialog(true);
                    break;
            }
            if (onCommandSent) onCommandSent(command);
        } catch (error) {
            console.error('Error sending command:', error);
            setSnackbar({
                open: true,
                message: 'Failed to send command',
                severity: 'error'
            });
            if (onError) onError(error);
        }
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
            const commandType = updateType === 'app' ? 'update' : 'systemUpdate';
            const commandId = await firebaseService.sendCommand(playerId, {
                type: commandType,
                payload: { url: updateUrl }
            });

            setCommandStatus({
                id: commandId,
                type: commandType,
                status: 'pending',
                timestamp: new Date()
            });
        } catch (err) {
            setError(`Failed to send update command: ${err.message}`);
            setLoading(false);
        }
    };

    const handleCloseSnackbar = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    return (
        <>
            <ButtonGroup variant="contained" aria-label="player controls">
                <Button
                    onClick={() => handleCommand('reboot')}
                    color="warning"
                >
                    Reboot
                </Button>
                <Button
                    onClick={() => handleCommand('screenshot')}
                    color="primary"
                >
                    Screenshot
                </Button>
                <Button
                    onClick={() => handleCommand('update')}
                    color="secondary"
                >
                    Update
                </Button>
            </ButtonGroup>

            <Dialog open={updateDialog} onClose={() => setUpdateDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Update Player</DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2 }}>
                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Update Type</InputLabel>
                            <Select
                                value={updateType}
                                onChange={(e) => setUpdateType(e.target.value)}
                                label="Update Type"
                            >
                                <MenuItem value="app">App Update</MenuItem>
                                <MenuItem value="system">System Update</MenuItem>
                            </Select>
                        </FormControl>
                        <TextField
                            autoFocus
                            margin="dense"
                            label="Update URL"
                            type="url"
                            fullWidth
                            value={updateUrl}
                            onChange={(e) => setUpdateUrl(e.target.value)}
                            helperText={updateType === 'system' ? 
                                "URL to the directory containing update files (rockadb folder, update.zip, update.sh, rockadb)" :
                                "URL to the APK file"}
                            disabled={loading}
                        />

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
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setUpdateDialog(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleUpdateSubmit}
                        variant="contained"
                        disabled={loading || !updateUrl}
                    >
                        {loading ? <CircularProgress size={24} /> : 'Update'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={handleCloseSnackbar}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </>
    );
};

export default PlayerControls; 