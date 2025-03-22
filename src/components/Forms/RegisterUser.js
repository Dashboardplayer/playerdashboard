import React, { useState, useEffect, useCallback } from 'react';
import { companyAPI, authAPI } from '../../hooks/apiClient.js';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar
} from '@mui/material';
import { useUser } from '../../contexts/UserContext.js';

function RegisterUser() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [companies, setCompanies] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { profile } = useUser();

  // Create a fetchCompanies function with useCallback to avoid recreating on each render
  const fetchCompanies = useCallback(async () => {
    try {
      const { data, error: fetchError } = await companyAPI.getAll();
      
      if (fetchError) {
        console.error('Error fetching companies:', fetchError);
        setError('Fout bij het ophalen van bedrijven.');
        return;
      }
      
      if (data) {
        // If user is not superadmin, filter to only show their company
        if (profile && profile.role !== 'superadmin' && profile.company_id) {
          setCompanies(data.filter(company => company.company_id === profile.company_id));
          setCompanyId(profile.company_id); // Auto-select their company
        } else {
          setCompanies(data);
        }
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Er is een onverwachte fout opgetreden.');
    }
  }, [profile]);

  // Fetch companies on mount
  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // Restrict role options based on user's role
  const getRoleOptions = () => {
    if (profile?.role === 'superadmin') {
      return [
        { value: 'bedrijfsadmin', label: 'Bedrijfsadmin' },
        { value: 'user', label: 'User' }
      ];
    } else if (profile?.role === 'bedrijfsadmin') {
      return [
        { value: 'user', label: 'User' }
      ];
    } else {
      return [
        { value: 'user', label: 'User' }
      ];
    }
  };

  const validateForm = () => {
    let isValid = true;
    
    // Email validation
    if (!email) {
      setEmailError('Email is verplicht');
      isValid = false;
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)) {
      setEmailError('Ongeldig email adres');
      isValid = false;
    } else {
      setEmailError('');
    }

    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!validateForm()) {
      setLoading(false);
      return;
    }

    try {
      // Include sender's role and company ID in the request
      const response = await authAPI.registerInvitation({
        email,
        role,
        company_id: companyId || profile.company_id, // Use profile's company_id for bedrijfsadmin
        sender_role: profile.role,
        sender_company_id: profile.company_id
      });

      if (response.error) {
        setError(response.error);
      } else {
        setSuccess(true);
        // Reset form
        setEmail('');
        setRole('');
        setCompanyId('');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError('Er is een fout opgetreden bij het versturen van de uitnodiging.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <Box sx={{ maxWidth: '600px', margin: 'auto', p: 3, mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
          Gebruiker Registreren
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Snackbar
          open={success}
          autoHideDuration={2000}
          onClose={() => setSuccess(false)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert severity="success">
            Uitnodiging succesvol verzonden!
          </Alert>
        </Snackbar>
        
        <form onSubmit={handleSubmit}>
          <TextField
            label="Email"
            fullWidth
            margin="normal"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            error={Boolean(emailError)}
            helperText={emailError}
          />

          <FormControl fullWidth margin="normal" required>
            <InputLabel>Rol</InputLabel>
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              label="Rol"
            >
              {getRoleOptions().map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {profile?.role === 'superadmin' && (
            <FormControl fullWidth margin="normal" required={role !== 'superadmin'}>
              <InputLabel>Bedrijf</InputLabel>
              <Select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                label="Bedrijf"
                disabled={role === 'superadmin'}
              >
                {companies.map(company => (
                  <MenuItem key={company.company_id} value={company.company_id}>
                    {company.company_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={handleBack}
            >
              Terug
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
            >
              Uitnodiging Versturen
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
}

export default RegisterUser; 