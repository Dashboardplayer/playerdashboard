import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Container, 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Alert, 
  CircularProgress,
  IconButton,
  InputAdornment
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { validatePassword } from '../../utils/passwordValidation';
import PasswordRequirements from './PasswordRequirements';

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [token, setToken] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState(true);
  const [passwordErrors, setPasswordErrors] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Extract token from URL params on component mount
  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (!tokenFromUrl) {
      setTokenValid(false);
      setIsError(true);
      setStatusMessage('Geen resettoken gevonden. Probeer opnieuw een wachtwoord reset aan te vragen.');
    } else {
      setToken(tokenFromUrl);
      // Verify token format
      if (!/^[a-f0-9]{40}$/.test(tokenFromUrl)) {
        setTokenValid(false);
        setIsError(true);
        setStatusMessage('Ongeldig resettoken formaat. Gebruik de link uit je e-mail.');
        return;
      }
      console.log('Reset token from URL:', tokenFromUrl);
    }
  }, [searchParams]);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setStatusMessage('');
    setIsError(false);
    setPasswordErrors([]);

    // Validate passwords match
    if (password !== confirmPassword) {
      setIsError(true);
      setStatusMessage('Wachtwoorden komen niet overeen.');
      setIsLoading(false);
      return;
    }

    // Validate password strength
    const { isValid, errors } = validatePassword(password);
    if (!isValid) {
      setIsError(true);
      setPasswordErrors(errors);
      setIsLoading(false);
      return;
    }

    try {
      console.log('Attempting to reset password with token:', token);
      
      const response = await fetch('http://localhost:5001/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          token: token,
          password: password 
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Password reset error:', data);
        setIsError(true);
        if (data.error === 'Invalid or expired reset token') {
          setStatusMessage('De resetlink is verlopen of ongeldig. Vraag een nieuwe aan.');
        } else {
          setStatusMessage(`Er ging iets mis: ${data.error || 'Onbekende fout'}`);
        }
      } else {
        console.log('Password reset success:', data);
        setIsError(false);
        setStatusMessage('Je wachtwoord is succesvol aangepast. Je wordt doorgestuurd naar de inlogpagina.');
        
        // Store the new auth token if provided
        if (data.token) {
          localStorage.setItem('authToken', data.token);
        }
        
        // Redirect to login page after a short delay
        setTimeout(() => {
          navigate('/');
        }, 3000);
      }
    } catch (err) {
      console.error('Password reset fetch error:', err);
      setIsError(true);
      setStatusMessage('Er is een netwerkfout opgetreden. Controleer je internetverbinding.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePassword = () => {
    setShowPassword(!showPassword);
  };

  const handleToggleConfirmPassword = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  return (
    <Container maxWidth="xs" sx={{ mt: 8 }}>
      <Box
        sx={{
          p: 3,
          boxShadow: 3,
          borderRadius: 2,
          textAlign: 'center'
        }}
      >
        <Typography variant="h5" gutterBottom>
          Wachtwoord Resetten
        </Typography>
        
        {!tokenValid ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {statusMessage}
          </Alert>
        ) : (
          <Box component="form" onSubmit={handleResetPassword} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              margin="normal"
              label="Nieuw Wachtwoord"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordErrors([]);
              }}
              required
              disabled={isLoading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={handleTogglePassword}
                      edge="end"
                      disabled={isLoading}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              margin="normal"
              label="Bevestig Wachtwoord"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={handleToggleConfirmPassword}
                      edge="end"
                      disabled={isLoading}
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <PasswordRequirements password={password} />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              sx={{ mt: 2 }}
              disabled={isLoading}
            >
              {isLoading ? <CircularProgress size={24} /> : 'Reset Wachtwoord'}
            </Button>
          </Box>
        )}
        
        {statusMessage && !tokenValid === false && (
          <Alert severity={isError ? 'error' : 'success'} sx={{ mt: 2 }}>
            {statusMessage}
          </Alert>
        )}
      </Box>
    </Container>
  );
}

export default ResetPassword;