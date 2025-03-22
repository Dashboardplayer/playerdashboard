import React, { useState, useEffect } from 'react';
import { authAPI } from '../../hooks/apiClient';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import ReCAPTCHA from 'react-google-recaptcha';
import { validatePassword } from '../../utils/passwordValidation';

// Material UI imports
import {
  Box,
  Container,
  Typography,
  TextField,
  FormControlLabel,
  Checkbox,
  Button,
  Link,
  Paper,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment
} from '@mui/material';
import { LockOutlined, Visibility, VisibilityOff } from '@mui/icons-material';

// Constants
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes (changed from 15)

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
      if (storedLockoutUntil) {
        const lockoutTime = parseInt(storedLockoutUntil);
        const now = Date.now();
        if (lockoutTime > now) {
          setLockoutUntil(lockoutTime);
          // Update warning message with remaining time
          const remainingMinutes = Math.ceil((lockoutTime - now) / 1000 / 60);
          setError(`Te veel inlogpogingen. Wacht nog ${remainingMinutes} ${remainingMinutes === 1 ? 'minuut' : 'minuten'} voordat je het opnieuw kunt proberen.`);
        } else {
          // Clear lockout if time has expired
          localStorage.removeItem('loginLockoutUntil');
          localStorage.removeItem('loginAttempts');
          setLockoutUntil(null);
          setLoginAttempts(0);
          setError('');
        }
      }

      const storedAttempts = localStorage.getItem('loginAttempts');
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

    // Update remaining time every minute
    const interval = setInterval(checkLockoutStatus, 60000);

    return () => clearInterval(interval);
  }, []);

  const handleEmailChange = (e) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    setIsValidEmail(emailRegex.test(newEmail));
  };

  const incrementLoginAttempts = () => {
    const newAttempts = loginAttempts + 1;
    setLoginAttempts(newAttempts);
    localStorage.setItem('loginAttempts', newAttempts);

    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      const lockoutTime = Date.now() + LOCKOUT_DURATION;
      setLockoutUntil(lockoutTime);
      localStorage.setItem('loginLockoutUntil', lockoutTime);
      const remainingMinutes = Math.ceil(LOCKOUT_DURATION / 1000 / 60);
      setError(`Te veel inlogpogingen. Wacht nog ${remainingMinutes} ${remainingMinutes === 1 ? 'minuut' : 'minuten'} voordat je het opnieuw kunt proberen.`);
    } else if (newAttempts >= 3) {
      setWarning(`Waarschuwing: nog ${MAX_LOGIN_ATTEMPTS - newAttempts} login ${MAX_LOGIN_ATTEMPTS - newAttempts === 1 ? 'poging' : 'pogingen'} over voordat je account tijdelijk wordt geblokkeerd.`);
    }
  };

  const resetLoginAttempts = () => {
    setLoginAttempts(0);
    setLockoutUntil(null);
    localStorage.removeItem('loginAttempts');
    localStorage.removeItem('loginLockoutUntil');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setWarning(null);

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
      const { data, error: signInError, warningStatus } = await authAPI.login({
        email: email.trim(),
        password,
        recaptchaToken: recaptchaValue
      });

      // Set warning if present
      if (warningStatus) {
        if (warningStatus.type === 'error') {
          setError(warningStatus.message);
        } else {
          setWarning(warningStatus.message);
        }
      }

      if (signInError) {
        console.error('Login error:', signInError);
        incrementLoginAttempts();
        setError('Ongeldige inloggegevens');
        if (recaptchaRef.current) {
          recaptchaRef.current.reset();
        }
        setRecaptchaValue(null);
        setLoading(false);
        return;
      }

      if (!data || !data.user) {
        incrementLoginAttempts();
        setError('Geen gebruiker gevonden.');
        setLoading(false);
        return;
      }

      console.log('User authenticated successfully:', data.user);
      
      // Reset login attempts on successful login
      resetLoginAttempts();
      
      // The user object contains all necessary information
      const userProfile = {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        company_id: data.user.company_id
      };
      
      // Save profile to context and navigate
      setProfile(userProfile);
      
      if (userProfile.role === 'superadmin') {
        navigate('/superadmin-dashboard');
      } else {
        navigate('/company-dashboard');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Er is een onverwachte fout opgetreden.');
      incrementLoginAttempts();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Paper elevation={3} sx={{ p: 4, mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <LockOutlined sx={{ fontSize: 40, mb: 2, color: 'primary.main' }} />
          <Typography component="h1" variant="h5" sx={{ mb: 3 }}>
            Inloggen
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2, width: '100%' }}>
              {error}
            </Alert>
          )}

          {warning && !error && (
            <Alert severity="warning" sx={{ mb: 2, width: '100%' }}>
              {warning}
            </Alert>
          )}

          <Box component="form" onSubmit={handleLogin} sx={{ width: '100%' }}>
            <TextField
              fullWidth
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
            />
            
            <TextField
              fullWidth
              margin="normal"
              label="Wachtwoord"
              placeholder="Voer wachtwoord in"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading || (lockoutUntil && lockoutUntil > Date.now())}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {loginAttempts >= 3 && (
              <Box sx={{ mt: 2, mb: 2 }}>
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
              sx={{ mt: 3, mb: 2, py: 1.5 }}
              disabled={loading || (lockoutUntil && lockoutUntil > Date.now()) || (loginAttempts >= 3 && !recaptchaValue)}
            >
              {loading ? <CircularProgress size={24} /> : 'Inloggen'}
            </Button>
            
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Link
                component="button"
                variant="body2"
                onClick={() => navigate('/forgot-password')}
                disabled={loading}
              >
                Wachtwoord vergeten?
              </Link>
            </Box>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}

export default LoginPage;
