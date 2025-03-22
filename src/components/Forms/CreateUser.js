import React, { useState, useEffect, useCallback } from 'react';
import { companyAPI, authAPI, userAPI } from '../../hooks/apiClient.js';
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

function CreateUser() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [companies, setCompanies] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [emailError, setEmailError] = useState('');
  
  const navigate = useNavigate();
  const { profile } = useUser();

  // Create a fetchCompanies function with useCallback to avoid recreating on each render
  const fetchCompanies = useCallback(async () => {
    try {
      // Use the API client instead of mongoClient
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
  }, [profile, setCompanies, setCompanyId, setError]);

  // Fetch companies and listen for updates
  useEffect(() => {
    // Initial fetch
    fetchCompanies();
  }, [fetchCompanies]);

  // Restrict role options based on user's role
  const getRoleOptions = () => {
    if (profile?.role === 'superadmin') {
      return [
        { value: 'superadmin', label: 'Superadmin' },
        { value: 'bedrijfsadmin', label: 'Bedrijfsadmin' },
        { value: 'user', label: 'User' }
      ];
    } else if (profile?.role === 'bedrijfsadmin') {
      return [
        { value: 'bedrijfsadmin', label: 'Bedrijfsadmin' },
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
    setError('');

    if (!validateForm()) {
      return;
    }

    try {
      // If user is bedrijfsadmin, check the number of users in their company
      if (profile?.role === 'bedrijfsadmin') {
        // Ensure company ID matches the admin's company
        if (companyId !== profile.company_id) {
          setError('U kunt alleen gebruikers aanmaken voor uw eigen bedrijf.');
          return;
        }

        const { data: users } = await userAPI.getAll(profile.company_id);
        if (users && users.length >= 5) {
          setError('U kunt maximaal 5 gebruikers aanmaken voor uw bedrijf.');
          return;
        }

        // Ensure role is valid for bedrijfsadmin (can create users and bedrijfsadmins)
        if (role === 'superadmin') {
          setError('U heeft niet de rechten om een superadmin aan te maken.');
          return;
        }
      }

      // Create user via API using registerInvitation
      const { data, error: authError } = await authAPI.registerInvitation({
        email,
        role,
        company_id: profile?.role === 'bedrijfsadmin' ? profile.company_id : companyId,
        sender_role: profile?.role,
        sender_company_id: profile?.company_id
      });

      if (authError) {
        setError(`Fout bij registratie: ${authError}`);
        return;
      }

      if (!data) {
        setError('Geen uitnodiging verzonden. Probeer het opnieuw.');
        return;
      }

      // Success
      setSuccess(true);
      
      // Reset form
      setEmail('');
      setRole('');
      if (profile?.role === 'superadmin') {
        setCompanyId('');
      }
      
      // Redirect after 2 seconds
      setTimeout(() => {
        if (profile?.role === 'superadmin') {
          navigate('/superadmin-dashboard');
        } else {
          navigate('/company-dashboard');
        }
      }, 2000);
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Er is een onverwachte fout opgetreden.');
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <Box sx={{ maxWidth: '600px', margin: 'auto', p: 3, mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
          Nieuwe Gebruiker Aanmaken
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
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
            sx={{ mb: 2 }}
          />
          
          <FormControl fullWidth margin="normal" sx={{ mb: 3 }}>
            <InputLabel id="role-select-label">Rol</InputLabel>
            <Select
              labelId="role-select-label"
              value={role}
              label="Rol"
              onChange={(e) => setRole(e.target.value)}
              required
            >
              {getRoleOptions().map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {role !== 'superadmin' && (
            <FormControl fullWidth margin="normal" sx={{ mb: 3 }}>
              <InputLabel id="company-select-label">Bedrijf</InputLabel>
              <Select
                labelId="company-select-label"
                value={companyId}
                label="Bedrijf"
                onChange={(e) => setCompanyId(e.target.value)}
                required
                disabled={profile?.role !== 'superadmin' && Boolean(profile?.company_id)}
              >
                {companies.map((company) => (
                  <MenuItem key={company.company_id} value={company.company_id}>
                    {company.company_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
            <Button 
              variant="outlined" 
              onClick={handleBack}
            >
              Terug
            </Button>
            <Button 
              variant="contained" 
              type="submit"
              color="primary"
            >
              Gebruiker Aanmaken
            </Button>
          </Box>
        </form>
      </Paper>
      
      <Snackbar
        open={success}
        autoHideDuration={2000}
        onClose={() => setSuccess(false)}
        message="Gebruiker succesvol aangemaakt!"
      />
    </Box>
  );
}

export default CreateUser;
