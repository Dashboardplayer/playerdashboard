import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Stack,
  IconButton,
  Tooltip,
  Card,
  CardContent
} from '@mui/material';
import { 
  Security as SecurityIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Info as InfoIcon,
  QrCode2 as QrCodeIcon,
  Shield as ShieldIcon
} from '@mui/icons-material';
import { useUser } from '../../contexts/UserContext';
import { authAPI } from '../../hooks/apiClient';

function TwoFactorAuth() {
  const { profile } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [twoFAStatus, setTwoFAStatus] = useState({ enabled: false, pendingSetup: false });

  useEffect(() => {
    fetchTwoFAStatus();
  }, []);

  const fetchTwoFAStatus = async () => {
    try {
      const response = await authAPI.get2FAStatus();
      if (response.error) {
        setError(response.error);
      } else if (response.data) {
        setTwoFAStatus({
          enabled: response.data.enabled,
          pendingSetup: response.data.pendingSetup
        });
      }
    } catch (err) {
      console.error('Error fetching 2FA status:', err);
      setError('Error fetching 2FA status');
    }
  };

  const handleSetup2FA = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    setQrCode(''); // Reset QR code first

    try {
      const response = await authAPI.generate2FASecret();
      console.log('2FA setup response:', response);

      if (response.error) {
        setError(response.error);
        return;
      }

      if (!response.data?.qrCode) {
        console.error('Invalid response from server:', response);
        setError('QR code niet ontvangen van de server');
        return;
      }

      setQrCode(response.data.qrCode);
      setSetupDialogOpen(true);
      await fetchTwoFAStatus();
    } catch (err) {
      console.error('Error setting up 2FA:', err);
      setError('Error bij het instellen van 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySetup = async () => {
    if (!verificationCode.trim()) {
      setError('Voer een verificatiecode in');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await authAPI.verify2FASetup(verificationCode);
      if (response.error) {
        setError(response.error);
      } else {
        setSuccess('2FA is succesvol ingeschakeld');
        setSetupDialogOpen(false);
        setVerificationCode('');
        await fetchTwoFAStatus();
      }
    } catch (err) {
      setError('Error verifying 2FA setup');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!verificationCode.trim()) {
      setError('Voer een verificatiecode in');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await authAPI.disable2FA(verificationCode);
      if (response.error) {
        setError(response.error);
      } else {
        setSuccess('2FA is succesvol uitgeschakeld');
        setDisableDialogOpen(false);
        setVerificationCode('');
        await fetchTwoFAStatus();
      }
    } catch (err) {
      setError('Error disabling 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerificationCodeChange = (e) => {
    // Only allow numbers and limit to 6 digits
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setVerificationCode(value);
  };

  return (
    <Card elevation={0} sx={{ mt: 3 }}>
      <CardContent>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <SecurityIcon color="primary" />
            <Typography variant="h6">
              Twee-factor authenticatie (2FA)
            </Typography>
            <Tooltip title="Twee-factor authenticatie voegt een extra beveiligingslaag toe aan uw account door naast uw wachtwoord ook een tijdelijke code te vereisen bij het inloggen.">
              <IconButton size="small">
                <InfoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          <Divider />

          {error && (
            <Alert 
              severity="error" 
              sx={{ mt: 2 }}
              action={
                <IconButton
                  aria-label="close"
                  color="inherit"
                  size="small"
                  onClick={() => setError('')}
                >
                  <CloseIcon fontSize="inherit" />
                </IconButton>
              }
            >
              {error}
            </Alert>
          )}

          {success && (
            <Alert 
              severity="success" 
              sx={{ mt: 2 }}
              action={
                <IconButton
                  aria-label="close"
                  color="inherit"
                  size="small"
                  onClick={() => setSuccess('')}
                >
                  <CloseIcon fontSize="inherit" />
                </IconButton>
              }
            >
              {success}
            </Alert>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" gutterBottom>
                Status
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {twoFAStatus.enabled ? (
                  <>
                    <CheckIcon color="success" fontSize="small" />
                    2FA is ingeschakeld
                  </>
                ) : (
                  <>
                    <CloseIcon color="error" fontSize="small" />
                    2FA is uitgeschakeld
                  </>
                )}
              </Typography>
            </Box>
            <Box>
              {twoFAStatus.enabled ? (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => setDisableDialogOpen(true)}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <ShieldIcon />}
                >
                  Uitschakelen
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSetup2FA}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <ShieldIcon />}
                >
                  Inschakelen
                </Button>
              )}
            </Box>
          </Box>
        </Stack>
      </CardContent>

      {/* Setup Dialog */}
      <Dialog 
        open={setupDialogOpen} 
        onClose={() => !loading && setSetupDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <QrCodeIcon color="primary" />
            <Typography variant="h6">2FA Instellen</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Download de Google Authenticator app op uw telefoon om 2FA in te stellen.
            </Alert>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                1. Scan de QR-code
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Open de Google Authenticator app en scan onderstaande QR-code
              </Typography>
              {qrCode ? (
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  mt: 2,
                  p: 3,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  width: '100%',
                  maxWidth: '250px',
                  mx: 'auto'
                }}>
                  <img 
                    src={qrCode} 
                    alt="2FA QR Code" 
                    style={{ 
                      width: '100%',
                      height: 'auto',
                      display: 'block'
                    }} 
                  />
                </Box>
              ) : (
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  mt: 2,
                  p: 3,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  height: '250px'
                }}>
                  <CircularProgress />
                </Box>
              )}
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                2. Voer de verificatiecode in
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Voer de 6-cijferige code in die wordt weergegeven in de app
              </Typography>
              <TextField
                fullWidth
                label="Verificatiecode"
                value={verificationCode}
                onChange={handleVerificationCodeChange}
                margin="normal"
                inputProps={{ 
                  maxLength: 6,
                  inputMode: 'numeric',
                  pattern: '[0-9]*'
                }}
                error={!!error}
                helperText={error || ''}
                disabled={loading}
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            onClick={() => setSetupDialogOpen(false)}
            disabled={loading}
          >
            Annuleren
          </Button>
          <Button
            onClick={handleVerifySetup}
            variant="contained"
            disabled={verificationCode.length !== 6 || loading}
            startIcon={loading ? <CircularProgress size={20} /> : <CheckIcon />}
          >
            Verifiëren en Inschakelen
          </Button>
        </DialogActions>
      </Dialog>

      {/* Disable Dialog */}
      <Dialog 
        open={disableDialogOpen} 
        onClose={() => !loading && setDisableDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShieldIcon color="error" />
            <Typography variant="h6">2FA Uitschakelen</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <Alert severity="warning">
              Het uitschakelen van 2FA vermindert de beveiliging van uw account. Weet u zeker dat u door wilt gaan?
            </Alert>
            
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Voer uw huidige 2FA-code in
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Open de Google Authenticator app en voer de huidige 6-cijferige code in
              </Typography>
              <TextField
                fullWidth
                label="Verificatiecode"
                value={verificationCode}
                onChange={handleVerificationCodeChange}
                margin="normal"
                inputProps={{ 
                  maxLength: 6,
                  inputMode: 'numeric',
                  pattern: '[0-9]*'
                }}
                error={!!error}
                helperText={error || ''}
                disabled={loading}
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            onClick={() => setDisableDialogOpen(false)}
            disabled={loading}
          >
            Annuleren
          </Button>
          <Button
            onClick={handleDisable2FA}
            variant="contained"
            color="error"
            disabled={verificationCode.length !== 6 || loading}
            startIcon={loading ? <CircularProgress size={20} /> : <CloseIcon />}
          >
            2FA Uitschakelen
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

export default TwoFactorAuth; 