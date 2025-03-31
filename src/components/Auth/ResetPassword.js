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
  InputAdornment,
  Paper
} from '@mui/material';
import { Visibility, VisibilityOff, LockOutlined } from '@mui/icons-material';
import { validatePassword } from '../../utils/passwordValidation';
import PasswordRequirements from './PasswordRequirements';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [token, setToken] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Extract token from URL params on component mount
  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (!tokenFromUrl) {
      setIsError(true);
      setStatusMessage('Geen resettoken gevonden. Probeer opnieuw een wachtwoord reset aan te vragen.');
    } else {
      setToken(tokenFromUrl);
      // Verify token format
      if (!/^[a-f0-9]{40}$/.test(tokenFromUrl)) {
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
      
      const response = await fetch(`${API_URL}/auth/reset-password`, {
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

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e8eb 100%)',
        p: { xs: 2, sm: 4 },
        pt: { xs: 4, sm: 8 }
      }}
    >
      <Container 
        maxWidth="sm"
        sx={{
          mt: { xs: 4, sm: 6, md: 8 },
          mb: 4
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            mb: 4
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 700,
              color: '#1a365d',
              mb: 1,
              textAlign: 'center'
            }}
          >
            DisplayBeheer.nl
          </Typography>
        </Box>

        <Paper
          elevation={3}
          sx={{
            p: { xs: 3, sm: 4 },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            borderRadius: 2,
            background: 'linear-gradient(to bottom, #ffffff, #f8f9fa)',
            width: '100%',
            maxWidth: '440px',
            mx: 'auto',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%'
            }}
          >
            <LockOutlined
              sx={{
                fontSize: 24,
                mb: 2,
                color: '#1a365d',
                p: 1.5,
                borderRadius: '50%',
                backgroundColor: 'rgba(26, 54, 93, 0.1)'
              }}
            />
            
            <Typography
              variant="h6"
              sx={{
                mb: 1,
                fontWeight: 600,
                color: '#1a365d'
              }}
            >
              Nieuw wachtwoord instellen
            </Typography>
            
            <Typography
              variant="body2"
              sx={{
                mb: 3,
                color: '#4a5568',
                textAlign: 'center',
                maxWidth: '400px'
              }}
            >
              Voer een nieuw wachtwoord in voor je account.
            </Typography>

            {passwordErrors.length > 0 && (
              <Alert
                severity="error"
                sx={{
                  mb: 2,
                  width: '100%',
                  '& .MuiAlert-message': {
                    fontSize: '0.875rem'
                  }
                }}
              >
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Je wachtwoord moet voldoen aan de volgende eisen:
                </Typography>
                <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                  {passwordErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </Alert>
            )}

            <Box
              component="form"
              onSubmit={handleResetPassword}
              sx={{
                width: '100%',
                mt: 1
              }}
            >
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Nieuw wachtwoord"
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={isError}
                disabled={isLoading}
                size="small"
                InputProps={{
                  sx: {
                    borderRadius: 1,
                    backgroundColor: 'background.paper'
                  },
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        size="small"
                        sx={{ color: 'text.secondary' }}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />

              <TextField
                margin="normal"
                required
                fullWidth
                name="confirmPassword"
                label="Bevestig wachtwoord"
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={isError}
                disabled={isLoading}
                size="small"
                InputProps={{
                  sx: {
                    borderRadius: 1,
                    backgroundColor: 'background.paper'
                  },
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        edge="end"
                        size="small"
                        sx={{ color: 'text.secondary' }}
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />

              <PasswordRequirements password={password} />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={isLoading}
                sx={{
                  mt: 3,
                  mb: 2,
                  py: 1,
                  borderRadius: 1,
                  textTransform: 'none',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  boxShadow: 2,
                  backgroundColor: '#1a365d',
                  '&:hover': {
                    backgroundColor: '#2c5282',
                    boxShadow: 4
                  }
                }}
              >
                {isLoading ? (
                  <CircularProgress size={20} />
                ) : (
                  'Wachtwoord wijzigen'
                )}
              </Button>

              {statusMessage && (
                <Alert 
                  severity={isError ? 'error' : 'success'} 
                  sx={{ 
                    mb: 3,
                    borderRadius: 1,
                    '& .MuiAlert-message': {
                      fontSize: { xs: '0.875rem', sm: '1rem' }
                    }
                  }}
                >
                  {statusMessage}
                </Alert>
              )}
            </Box>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

export default ResetPassword;