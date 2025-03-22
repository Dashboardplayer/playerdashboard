import React, { useState } from 'react';
import { createSuperAdminProfile } from '../../utils/createSuperAdmin.js';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  CircularProgress
} from '@mui/material';

function SuperAdminSetup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSetup = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const result = await createSuperAdminProfile(email, password);
      
      if (result.success) {
        setSuccess(result.message);
        // Wait 2 seconds before redirecting to login page
        setTimeout(() => {
          navigate('/');
        }, 2000);
      } else {
        setError(`Setup failed: ${result.error}`);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Er is een onverwachte fout opgetreden.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: '500px', mx: 'auto', mt: 8, p: 2 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h5" component="h1" gutterBottom align="center">
          Superadmin Account Setup
        </Typography>
        
        <Typography variant="body1" paragraph>
          Dit hulpprogramma maakt een superadmin-profiel aan voor een bestaand account of wijzigt een bestaand
          profiel naar de superadmin-rol.
        </Typography>
        
        <Typography variant="body2" color="text.secondary" paragraph>
          Gebruik dit als je problemen hebt met toegang tot het systeem of als er geen superadmin-profiel bestaat.
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ my: 2 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ my: 2 }}>
            {success}
          </Alert>
        )}
        
        <Box component="form" onSubmit={handleSetup} sx={{ mt: 3 }}>
          <TextField
            fullWidth
            margin="normal"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            disabled={loading}
          />
          
          <TextField
            fullWidth
            margin="normal"
            label="Wachtwoord"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
          
          <Button
            type="submit"
            variant="contained"
            fullWidth
            sx={{ mt: 3, mb: 2, py: 1.5 }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Superadmin instellen'}
          </Button>
          
          <Button
            variant="outlined"
            fullWidth
            sx={{ py: 1.5 }}
            onClick={() => navigate('/')}
            disabled={loading}
          >
            Terug naar login
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

export default SuperAdminSetup;