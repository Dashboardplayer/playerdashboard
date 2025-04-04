import React, { useState, useEffect, useCallback } from 'react';
import { companyAPI, playerAPI } from '../../hooks/apiClient.js';
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
  Snackbar,
  FormHelperText
} from '@mui/material';
import { useUser } from '../../contexts/UserContext.js';

function CreatePlayer() {
  const [deviceId, setDeviceId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [companies, setCompanies] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [deviceIdError, setDeviceIdError] = useState('');
  const [companyIdError, setCompanyIdError] = useState('');
  
  const navigate = useNavigate();
  const { profile } = useUser();

  const fetchCompanies = useCallback(async () => {
    try {
      // Use the new API client instead of mongoClient
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

  // Load companies from the API
  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const validateForm = () => {
    let isValid = true;
    
    // Device ID validation
    if (!deviceId) {
      setDeviceIdError('Device ID is verplicht');
      isValid = false;
    } else if (!/^[a-zA-Z0-9-_]+$/.test(deviceId)) {
      setDeviceIdError('Device ID mag alleen letters, cijfers, - en _ bevatten');
      isValid = false;
    } else {
      setDeviceIdError('');
    }

    // Company ID validation
    if (!companyId) {
      setCompanyIdError('Bedrijf is verplicht');
      isValid = false;
    } else {
      setCompanyIdError('');
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
      console.log('Submitting player creation form:', {
        device_id: deviceId,
        company_id: companyId
      });

      // Create new player using API
      const { data, error: createError } = await playerAPI.create({
        device_id: deviceId,
        company_id: companyId,
        current_url: '', // default empty
        is_online: false,
      });

      if (createError) {
        console.error('Player creation failed:', createError);
        setError(`Fout bij het aanmaken van de player: ${createError}`);
        return;
      }

      console.log('Player created successfully:', data);
      
      // Show success message
      setSuccess(true);
      
      // Reset form
      setDeviceId('');
      
      // Emit WebSocket event to notify other clients
      if (window.ws && window.ws.readyState === WebSocket.OPEN) {
        window.ws.send(JSON.stringify({
          type: 'player_created',
          data: data
        }));
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
      console.error('Unexpected error during player creation:', err);
      setError('Er is een onverwachte fout opgetreden. Probeer het later opnieuw.');
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <Box sx={{ maxWidth: '600px', margin: 'auto', p: 3, mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
          Nieuwe Player Toevoegen
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        <form onSubmit={handleSubmit}>
          <TextField
            label="Device ID"
            fullWidth
            margin="normal"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            required
            error={Boolean(deviceIdError)}
            helperText={deviceIdError || "Unieke identifier voor deze player"}
            sx={{ mb: 3 }}
          />
          
          <FormControl fullWidth margin="normal" sx={{ mb: 3 }} error={Boolean(companyIdError)}>
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
            {companyIdError && (
              <FormHelperText>{companyIdError}</FormHelperText>
            )}
          </FormControl>
          
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
              Player Toevoegen
            </Button>
          </Box>
        </form>
      </Paper>
      
      <Snackbar
        open={success}
        autoHideDuration={2000}
        onClose={() => setSuccess(false)}
        message="Player succesvol toegevoegd!"
      />
    </Box>
  );
}

export default CreatePlayer;
