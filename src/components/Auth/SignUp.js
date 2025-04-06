// SignUp.js
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  InputAdornment
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { authAPI } from '../../hooks/apiClient.js';
import { validatePassword } from '../../utils/passwordValidation';
import PasswordRequirements, { getPasswordErrors } from './PasswordRequirements';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
const REGISTRATION_TOKEN_KEY = 'registration_token';

function SignUp() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [role, setRole] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // First check URL for token
    const tokenFromUrl = searchParams.get('token');
    console.log('🔍 Token from URL:', tokenFromUrl);
    
    // Then check localStorage as fallback
    const savedToken = localStorage.getItem(REGISTRATION_TOKEN_KEY);
    
    if (tokenFromUrl) {
      console.log('✅ Found token in URL, saving and fetching user info...');
      // Save token to localStorage before removing from URL
      localStorage.setItem(REGISTRATION_TOKEN_KEY, tokenFromUrl);
      setToken(tokenFromUrl);
      fetchUserInfo(tokenFromUrl);
      
      // Remove token from URL after storing it
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('token');
      navigate({ search: newSearchParams.toString() }, { replace: true });
    } else if (savedToken) {
      console.log('✅ Found token in localStorage, fetching user info...');
      setToken(savedToken);
      fetchUserInfo(savedToken);
    } else {
      console.log('❌ No token found in URL or localStorage');
      setError('Geen registratietoken gevonden. Gebruik de link uit je uitnodigingsmail.');
      setLoading(false);
    }
  }, [searchParams, navigate]);

  const fetchUserInfo = async (token) => {
    try {
      setLoading(true);
      const url = `${API_URL}/auth/verify-token?token=${token}`;
      console.log('🔍 Making request to:', url);
      
      const response = await fetch(url);
      console.log('📥 Response status:', response.status);
      console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
      
      const data = await response.json();
      console.log('📥 Response data:', data);
      
      if (data.error) {
        console.error('❌ Server returned error:', data.error);
        setError('Ongeldige of verlopen registratielink. Vraag een nieuwe aan.');
        localStorage.removeItem(REGISTRATION_TOKEN_KEY);
        return;
      }

      console.log('✅ Setting user info with data:', data);
      setEmail(data.email || '');
      setRole(data.role || '');
      setCompanyName(data.company_name || '');
      
      // Verify the state was set
      console.log('✅ State after setting:', {
        email: data.email,
        role: data.role,
        companyName: data.company_name
      });
    } catch (err) {
      console.error('❌ Detailed error:', {
        message: err.message,
        stack: err.stack,
        error: err
      });
      setError('Er is een fout opgetreden bij het ophalen van je gegevens.');
      localStorage.removeItem(REGISTRATION_TOKEN_KEY);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');

    // Get token from state or localStorage
    const registrationToken = token || localStorage.getItem(REGISTRATION_TOKEN_KEY);

    if (!registrationToken) {
      setError('Geen registratietoken gevonden. Gebruik de link uit je uitnodigingsmail.');
      return;
    }

    // Validate password
    const { isValid } = validatePassword(password);
    if (!isValid) {
      const passwordError = getPasswordErrors(password);
      setError(passwordError);
      return;
    }

    try {
      const { data, error: signUpError } = await authAPI.completeRegistration({
        token: registrationToken,
        email,
        password
      });

      if (signUpError) {
        setError(`Fout bij registratie: ${signUpError}`);
        return;
      }

      if (!data) {
        setError('Registratie mislukt. Probeer het opnieuw.');
        return;
      }

      // Clear registration token after successful registration
      localStorage.removeItem(REGISTRATION_TOKEN_KEY);
      
      // Instead of redirecting to login, check if we have auth data and go directly to dashboard
      if (data.token && data.user) {
        // Redirect to the appropriate dashboard based on user role
        if (data.user.role === 'superadmin') {
          navigate('/superadmin-dashboard');
        } else {
          navigate('/company-dashboard');
        }
      } else {
        // If for some reason we don't have user data, fall back to login
        navigate('/login');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Er is een onverwachte fout opgetreden.');
    }
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
        <Typography>Laden...</Typography>
      </Container>
    );
  }

  // Check both state and localStorage for token
  const hasToken = token || localStorage.getItem(REGISTRATION_TOKEN_KEY);
  
  if (!hasToken) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Alert severity="error">
          {error || 'Geen registratietoken gevonden. Gebruik de link uit je uitnodigingsmail.'}
        </Alert>
      </Container>
    );
  }

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
          Account Aanmaken
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Box component="form" onSubmit={handleSignUp} sx={{ mt: 2 }}>
          <TextField
            fullWidth
            margin="normal"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextField
            fullWidth
            margin="normal"
            label="Wachtwoord"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            required
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={handleTogglePasswordVisibility}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          
          <PasswordRequirements password={password} />
          
          {role && (
            <FormControl fullWidth margin="normal" disabled>
              <InputLabel>Rol</InputLabel>
              <Select value={role} label="Rol">
                <MenuItem value={role}>{role}</MenuItem>
              </Select>
            </FormControl>
          )}

          {companyName && (
            <FormControl fullWidth margin="normal" disabled>
              <InputLabel>Bedrijf</InputLabel>
              <Select value={companyName} label="Bedrijf">
                <MenuItem value={companyName}>{companyName}</MenuItem>
              </Select>
            </FormControl>
          )}

          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
          >
            Registreren
          </Button>
        </Box>
      </Box>
    </Container>
  );
}

export default SignUp;
