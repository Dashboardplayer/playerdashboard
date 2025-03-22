import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Divider,
  Alert,
  CircularProgress,
  FormHelperText,
  IconButton,
  InputAdornment
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useUser } from '../../contexts/UserContext';
import { authAPI } from '../../hooks/apiClient';
import { validatePassword } from '../../utils/passwordValidation';
import PasswordRequirements from '../Auth/PasswordRequirements';

function Settings() {
  const { profile, updateProfile } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState([]);

  const handleNewPasswordChange = (e) => {
    const password = e.target.value;
    setNewPassword(password);
    const { isValid, errors } = validatePassword(password);
    setPasswordErrors(errors);
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Validate passwords
    if (newPassword !== confirmPassword) {
      setError('Nieuwe wachtwoorden komen niet overeen');
      setLoading(false);
      return;
    }

    // Validate password strength
    const { isValid, errors } = validatePassword(newPassword);
    if (!isValid) {
      setError('Wachtwoord voldoet niet aan de vereisten');
      setPasswordErrors(errors);
      setLoading(false);
      return;
    }

    try {
      const { error: resetError } = await authAPI.updatePassword({
        currentPassword,
        newPassword
      });

      if (resetError) {
        setError(`Wachtwoord wijzigen mislukt: ${resetError}`);
      } else {
        setSuccess('Wachtwoord succesvol gewijzigd');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordErrors([]);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Er is een onverwachte fout opgetreden');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCurrentPassword = () => {
    setShowCurrentPassword(!showCurrentPassword);
  };

  const handleToggleNewPassword = () => {
    setShowNewPassword(!showNewPassword);
  };

  const handleToggleConfirmPassword = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  if (!profile) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>U moet ingelogd zijn om deze pagina te bekijken.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Instellingen
      </Typography>

      {/* Account Information */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Account Informatie
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Email"
              value={profile.email}
              disabled
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Rol"
              value={profile.role === 'superadmin' ? 'Super Admin' : 
                     profile.role === 'bedrijfsadmin' ? 'Bedrijfs Admin' : 
                     'Gebruiker'}
              disabled
              variant="outlined"
            />
          </Grid>
          {profile.company_id && (
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Bedrijfs ID"
                value={profile.company_id}
                disabled
                variant="outlined"
              />
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* Password Reset */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Wachtwoord Wijzigen
        </Typography>
        <form onSubmit={handlePasswordReset}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type={showCurrentPassword ? 'text' : 'password'}
                label="Huidig Wachtwoord"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                variant="outlined"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={handleToggleCurrentPassword}
                        edge="end"
                      >
                        {showCurrentPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type={showNewPassword ? 'text' : 'password'}
                label="Nieuw Wachtwoord"
                value={newPassword}
                onChange={handleNewPasswordChange}
                required
                variant="outlined"
                error={newPassword.length > 0 && passwordErrors.length > 0}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={handleToggleNewPassword}
                        edge="end"
                      >
                        {showNewPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              {newPassword && <PasswordRequirements password={newPassword} />}
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type={showConfirmPassword ? 'text' : 'password'}
                label="Bevestig Nieuw Wachtwoord"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                variant="outlined"
                error={confirmPassword && newPassword !== confirmPassword}
                helperText={confirmPassword && newPassword !== confirmPassword ? 
                  'Wachtwoorden komen niet overeen' : ''}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={handleToggleConfirmPassword}
                        edge="end"
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            {error && (
              <Grid item xs={12}>
                <Alert severity="error">{error}</Alert>
              </Grid>
            )}
            {success && (
              <Grid item xs={12}>
                <Alert severity="success">{success}</Alert>
              </Grid>
            )}
            <Grid item xs={12}>
              <Button
                type="submit"
                variant="contained"
                disabled={loading || passwordErrors.length > 0 || newPassword !== confirmPassword}
                sx={{ mt: 2 }}
              >
                {loading ? (
                  <CircularProgress size={24} />
                ) : (
                  'Wachtwoord Wijzigen'
                )}
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  );
}

export default Settings; 