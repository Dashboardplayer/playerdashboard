import React, { useState, useEffect } from 'react';
import { authAPI } from '../../hooks/apiClient';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import ReCAPTCHA from 'react-google-recaptcha';
import { browserAuth } from '../../utils/browserUtils';
import { secureLog } from '../../utils/secureLogger';

// Material UI imports
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Link,
  Paper,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { LockOutlined, Visibility, VisibilityOff } from '@mui/icons-material';

// Constants
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes
const PROGRESSIVE_DELAYS = [0, 0, 0, 30000, 60000]; // Progressive delays in milliseconds

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState(null);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(null);
  const [recaptchaValue, setRecaptchaValue] = useState(null);
  const [isValidEmail, setIsValidEmail] = useState(true);
  const [show2FADialog, setShow2FADialog] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [tempToken, setTempToken] = useState(null);
  const [delayTimeRemaining, setDelayTimeRemaining] = useState(0);

  const navigate = useNavigate();
  const { profile, setProfile } = useUser();
  const recaptchaRef = React.createRef();

  // Email validation regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  // Redirect if already logged in
  useEffect(() => {
    if (profile) {
      if (profile.role === 'superadmin') {
        navigate('/superadmin-dashboard');
      } else {
        navigate('/company-dashboard');
      }
    }
  }, [profile, navigate]);

  // Check if user is locked out and update remaining time
  useEffect(() => {
    const checkLockoutStatus = () => {
      const storedLockoutUntil = localStorage.getItem('loginLockoutUntil');
      const storedLastAttempt = localStorage.getItem('lastLoginAttempt');
      const storedAttempts = localStorage.getItem('loginAttempts');
      
      const now = Date.now();
      
      // Check lockout status
      if (storedLockoutUntil) {
        const lockoutTime = parseInt(storedLockoutUntil);
        if (lockoutTime > now) {
          setLockoutUntil(lockoutTime);
          const remainingMinutes = Math.ceil((lockoutTime - now) / 1000 / 60);
          setError(`Te veel inlogpogingen. Wacht nog ${remainingMinutes} ${remainingMinutes === 1 ? 'minuut' : 'minuten'} voordat je het opnieuw kunt proberen.`);
        } else {
          // Clear lockout if time has expired
          localStorage.removeItem('loginLockoutUntil');
          localStorage.removeItem('loginAttempts');
          localStorage.removeItem('lastLoginAttempt');
          setLockoutUntil(null);
          setLoginAttempts(0);
          setDelayTimeRemaining(0);
          setError('');
        }
      }

      // Check progressive delay
      if (storedLastAttempt && storedAttempts) {
        const lastAttempt = parseInt(storedLastAttempt);
        const attempts = parseInt(storedAttempts);
        const delay = PROGRESSIVE_DELAYS[attempts - 1] || 0;
        
        if (delay > 0) {
          const timeRemaining = (lastAttempt + delay) - now;
          if (timeRemaining > 0) {
            setDelayTimeRemaining(timeRemaining);
            setError(`Wacht nog ${Math.ceil(timeRemaining / 1000)} seconden voor je volgende poging.`);
            return;
          }
        }
      }

      // Update attempts counter
      if (storedAttempts) {
        const attempts = parseInt(storedAttempts);
        setLoginAttempts(attempts);
        
        // Show warning when approaching limit
        if (attempts >= 3 && attempts < MAX_LOGIN_ATTEMPTS) {
          setWarning(`Waarschuwing: nog ${MAX_LOGIN_ATTEMPTS - attempts} login ${MAX_LOGIN_ATTEMPTS - attempts === 1 ? 'poging' : 'pogingen'} over voordat je account tijdelijk wordt geblokkeerd.`);
        }
      }
    };

    // Check immediately
    checkLockoutStatus();

    // Update remaining time every second
    const interval = setInterval(checkLockoutStatus, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleEmailChange = (e) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    setIsValidEmail(emailRegex.test(newEmail));
  };

  const incrementLoginAttempts = () => {
    const now = Date.now();
    const newAttempts = loginAttempts + 1;
    
    setLoginAttempts(newAttempts);
    
    localStorage.setItem('loginAttempts', newAttempts);
    localStorage.setItem('lastLoginAttempt', now);

    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      const lockoutTime = now + LOCKOUT_DURATION;
      setLockoutUntil(lockoutTime);
      localStorage.setItem('loginLockoutUntil', lockoutTime);
      const remainingMinutes = Math.ceil(LOCKOUT_DURATION / 1000 / 60);
      setError(`Te veel inlogpogingen. Wacht nog ${remainingMinutes} ${remainingMinutes === 1 ? 'minuut' : 'minuten'} voordat je het opnieuw kunt proberen.`);
    } else {
      const delay = PROGRESSIVE_DELAYS[newAttempts - 1] || 0;
      if (delay > 0) {
        setDelayTimeRemaining(delay);
        setError(`Wacht nog ${Math.ceil(delay / 1000)} seconden voor je volgende poging.`);
      }
      
      if (newAttempts >= 3) {
        setWarning(`Waarschuwing: nog ${MAX_LOGIN_ATTEMPTS - newAttempts} login ${MAX_LOGIN_ATTEMPTS - newAttempts === 1 ? 'poging' : 'pogingen'} over voordat je account tijdelijk wordt geblokkeerd.`);
      }
    }
  };

  const resetLoginAttempts = () => {
    setLoginAttempts(0);
    setLockoutUntil(null);
    localStorage.removeItem('loginAttempts');
    localStorage.removeItem('loginLockoutUntil');
    localStorage.removeItem('lastLoginAttempt');
  };

  const handleFailedLogin = () => {
    incrementLoginAttempts();
    if (recaptchaRef.current) {
      recaptchaRef.current.reset();
      setRecaptchaValue(null);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setWarning(null);

    // Check if we need to wait
    if (delayTimeRemaining > 0) {
      setError(`Wacht nog ${Math.ceil(delayTimeRemaining / 1000)} seconden voor je volgende poging.`);
      return;
    }

    // Validate inputs
    if (!email || !password) {
      setError('Vul alle velden in');
      return;
    }

    if (!isValidEmail) {
      setError('Ongeldig e-mailadres');
      return;
    }

    // Check if locked out
    if (lockoutUntil && lockoutUntil > Date.now()) {
      const remainingTime = Math.ceil((lockoutUntil - Date.now()) / 1000 / 60);
      setError(`Te veel inlogpogingen. Probeer het over ${remainingTime} minuten opnieuw.`);
      return;
    }

    // Require CAPTCHA after 3 attempts
    if (loginAttempts >= 3 && !recaptchaValue) {
      setError('Vul de CAPTCHA in');
      return;
    }

    setLoading(true);

    try {
      // Sign in with API client
      const { data, error: signInError } = await authAPI.login({
        email: email.trim(),
        password,
        recaptchaToken: recaptchaValue
      });

      if (signInError) {
        console.error('Login error:', signInError);
        handleFailedLogin();
        setError('Ongeldige inloggegevens');
        setLoading(false);
        return;
      }

      if (!data) {
        handleFailedLogin();
        setError('Er is een fout opgetreden bij het inloggen.');
        setLoading(false);
        return;
      }

      // Handle 2FA requirement
      if (data.requires2FA) {
        secureLog.info('2FA required, proceeding with verification');
        setTempToken(data.tempToken);
        setShow2FADialog(true);
        setLoading(false);
        return;
      }

      // Normal login success
      secureLog.info('User authenticated', { 
        id: data.user.id,
        role: data.user.role
      });
      
      // Reset login attempts on successful login
      resetLoginAttempts();
      
      // Save profile to context and navigate
      setProfile(data.user);
      
      if (data.user.role === 'superadmin') {
        navigate('/superadmin-dashboard');
      } else {
        navigate('/company-dashboard');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Er is een onverwachte fout opgetreden.');
      handleFailedLogin();
    } finally {
      setLoading(false);
    }
  };

  const handle2FAVerification = async () => {
    try {
      setLoading(true);
      setError('');

      if (!tempToken) {
        console.error('No tempToken available for 2FA verification');
        setError('Sessie verlopen, log opnieuw in');
        setShow2FADialog(false);
        return;
      }

      // Clean up the verification code (remove spaces and non-numeric characters)
      const cleanCode = verificationCode.replace(/\D/g, '');

      // Validate the code format
      if (cleanCode.length !== 6) {
        setError('De verificatiecode moet 6 cijfers bevatten');
        setLoading(false);
        return;
      }

      const { data, error: verifyError } = await authAPI.verify2FALogin({
        token: cleanCode,
        tempToken: tempToken
      });

      if (verifyError) {
        console.error('2FA verification failed:', verifyError);
        setError('Ongeldige verificatiecode');
        return;
      }

      if (!data || !data.user || !data.token || !data.refreshToken) {
        console.error('Invalid 2FA verification response:', data);
        setError('Er is een fout opgetreden bij de verificatie');
        return;
      }

      // Reset login attempts on successful login
      resetLoginAttempts();
      
      // Close the 2FA dialog
      setShow2FADialog(false);
      
      // Save profile to context and navigate
      secureLog.info('2FA verification successful', {
        id: data.user.id,
        role: data.user.role
      });
      
      // Store auth data using browserAuth utility
      browserAuth.setAuth(data.token, data.refreshToken, data.user);
      
      setProfile(data.user);
      
      if (data.user.role === 'superadmin') {
        navigate('/superadmin-dashboard');
      } else {
        navigate('/company-dashboard');
      }
    } catch (err) {
      console.error('2FA verification error:', err);
      setError('Er is een fout opgetreden bij de verificatie');
    } finally {
      setLoading(false);
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
          <Typography
            variant="subtitle1"
            sx={{
              color: '#4a5568',
              textAlign: 'center',
              maxWidth: '400px'
            }}
          >
            Beheer al je players vanaf één centrale locatie
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
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            width: '100%' 
          }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                mb: 3
              }}
            >
              <LockOutlined sx={{ 
                fontSize: 24,
                mr: 1,
                color: 'primary.main',
              }} />
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 600,
                  color: 'text.primary'
                }}
              >
                Inloggen op je account
              </Typography>
            </Box>

            {error && (
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
                {error}
              </Alert>
            )}

            {warning && !error && (
              <Alert 
                severity="warning" 
                sx={{ 
                  mb: 2, 
                  width: '100%',
                  '& .MuiAlert-message': {
                    fontSize: '0.875rem'
                  }
                }}
              >
                {warning}
              </Alert>
            )}

            <Box 
              component="form" 
              onSubmit={handleLogin} 
              sx={{ 
                width: '100%',
                '& .MuiTextField-root': {
                  mb: 2
                }
              }}
            >
              <TextField
                fullWidth
                size="small"
                margin="normal"
                label="Email"
                placeholder="Voer email in"
                type="email"
                value={email}
                onChange={handleEmailChange}
                error={!isValidEmail && email !== ''}
                helperText={!isValidEmail && email !== '' ? 'Ongeldig e-mailadres' : ''}
                required
                autoFocus
                disabled={loading || (lockoutUntil && lockoutUntil > Date.now())}
                InputProps={{
                  sx: {
                    borderRadius: 1,
                    backgroundColor: 'background.paper'
                  }
                }}
              />
              
              <TextField
                fullWidth
                size="small"
                margin="normal"
                label="Wachtwoord"
                placeholder="Voer wachtwoord in"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading || (lockoutUntil && lockoutUntil > Date.now())}
                InputProps={{
                  sx: {
                    borderRadius: 1,
                    backgroundColor: 'background.paper'
                  },
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
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

              {loginAttempts >= 3 && (
                <Box sx={{ 
                  mt: 2, 
                  mb: 2,
                  display: 'flex',
                  justifyContent: 'center'
                }}>
                  <ReCAPTCHA
                    ref={recaptchaRef}
                    sitekey={process.env.REACT_APP_RECAPTCHA_SITE_KEY}
                    onChange={(value) => setRecaptchaValue(value)}
                  />
                </Box>
              )}
              
              <Button
                type="submit"
                variant="contained"
                fullWidth
                sx={{ 
                  mt: 2, 
                  mb: 2, 
                  py: 1,
                  borderRadius: 1,
                  textTransform: 'none',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  boxShadow: 2,
                  '&:hover': {
                    boxShadow: 4
                  }
                }}
                disabled={loading || (lockoutUntil && lockoutUntil > Date.now()) || (loginAttempts >= 3 && !recaptchaValue)}
              >
                {loading ? <CircularProgress size={20} /> : 'Inloggen'}
              </Button>
              
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center'
              }}>
                <Link
                  component="button"
                  variant="body2"
                  onClick={() => navigate('/forgot-password')}
                  disabled={loading}
                  sx={{
                    color: 'primary.main',
                    textDecoration: 'none',
                    fontSize: '0.875rem',
                    '&:hover': {
                      textDecoration: 'underline'
                    }
                  }}
                >
                  Wachtwoord vergeten?
                </Link>
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* 2FA Verification Dialog */}
        <Dialog 
          open={show2FADialog} 
          onClose={() => setShow2FADialog(false)}
          PaperProps={{
            sx: {
              borderRadius: 2,
              p: 1,
              width: '100%',
              maxWidth: 400
            }
          }}
        >
          <DialogTitle sx={{ 
            textAlign: 'center',
            fontWeight: 600,
            fontSize: '1.25rem',
            pt: 2
          }}>
            Twee-factor authenticatie
          </DialogTitle>
          <DialogContent>
            <Typography sx={{ 
              mb: 2,
              color: 'text.secondary',
              textAlign: 'center',
              fontSize: '0.9rem'
            }}>
              Voer de verificatiecode in van je authenticator app.
            </Typography>
            <TextField
              autoFocus
              margin="dense"
              label="Verificatiecode"
              type="text"
              fullWidth
              size="small"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              error={!!error}
              helperText={error}
              InputProps={{
                sx: {
                  borderRadius: 1
                }
              }}
            />
          </DialogContent>
          <DialogActions sx={{ 
            justifyContent: 'center',
            p: 2
          }}>
            <Button 
              onClick={() => setShow2FADialog(false)}
              sx={{
                textTransform: 'none',
                color: 'text.secondary'
              }}
            >
              Annuleren
            </Button>
            <Button 
              onClick={handle2FAVerification}
              disabled={!verificationCode || loading}
              variant="contained"
              sx={{
                textTransform: 'none',
                borderRadius: 1,
                px: 3,
                py: 0.75
              }}
            >
              {loading ? <CircularProgress size={20} /> : 'Verifiëren'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
}

export default LoginPage;
