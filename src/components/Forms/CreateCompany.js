import React, { useState } from 'react';
import { companyAPI } from '../../hooks/apiClient.js';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  Paper,
  Alert,
  Snackbar
} from '@mui/material';

function CreateCompany() {
  const [companyName, setCompanyName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [companyNameError, setCompanyNameError] = useState('');
  const [companyIdError, setCompanyIdError] = useState('');
  const [contactEmailError, setContactEmailError] = useState('');
  const [contactPhoneError, setContactPhoneError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const navigate = useNavigate();

  const validateForm = () => {
    let isValid = true;
    
    // Company name validation
    if (!companyName) {
      setCompanyNameError('Bedrijfsnaam is verplicht');
      isValid = false;
    } else if (companyName.length < 2) {
      setCompanyNameError('Bedrijfsnaam moet minimaal 2 karakters bevatten');
      isValid = false;
    } else {
      setCompanyNameError('');
    }

    // Company ID validation
    if (!companyId) {
      setCompanyIdError('Bedrijfs ID is verplicht');
      isValid = false;
    } else if (!/^[a-zA-Z0-9-_]+$/.test(companyId)) {
      setCompanyIdError('Bedrijfs ID mag alleen letters, cijfers, - en _ bevatten');
      isValid = false;
    } else {
      setCompanyIdError('');
    }

    // Contact email validation
    if (!contactEmail) {
      setContactEmailError('Contact email is verplicht');
      isValid = false;
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(contactEmail)) {
      setContactEmailError('Ongeldig email adres');
      isValid = false;
    } else {
      setContactEmailError('');
    }

    // Contact phone validation (optional)
    if (contactPhone && !/^[0-9+\-\s()]*$/.test(contactPhone)) {
      setContactPhoneError('Ongeldig telefoonnummer');
      isValid = false;
    } else {
      setContactPhoneError('');
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
      // Check if company with this ID already exists - now done server-side
      
      // Insert new company via API
      const { error: insertError } = await companyAPI.create({
        company_id: companyId,
        company_name: companyName,
        contact_email: contactEmail,
        contact_phone: contactPhone
      });

      if (insertError) {
        console.error('API error:', insertError);
        setError(`Fout bij het aanmaken van het bedrijf: ${insertError}`);
        return;
      }

      // Success
      setSuccess(true);
      
      // Reset form
      setCompanyName('');
      setCompanyId('');
      setContactEmail('');
      setContactPhone('');
      
      // Redirect after 2 seconds
      setTimeout(() => {
        navigate('/superadmin-dashboard');
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
          Nieuw Bedrijf Aanmaken
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        <form onSubmit={handleSubmit}>
          <TextField
            label="Bedrijfsnaam"
            fullWidth
            margin="normal"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
            error={Boolean(companyNameError)}
            helperText={companyNameError}
            sx={{ mb: 2 }}
          />
          
          <TextField
            label="Bedrijfs ID"
            fullWidth
            margin="normal"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            required
            error={Boolean(companyIdError)}
            helperText={companyIdError || "Unieke identifier voor dit bedrijf"}
            sx={{ mb: 2 }}
          />
          
          <TextField
            label="Contact Email"
            fullWidth
            margin="normal"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            required
            error={Boolean(contactEmailError)}
            helperText={contactEmailError}
            sx={{ mb: 2 }}
          />
          
          <TextField
            label="Contact Telefoon"
            fullWidth
            margin="normal"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            error={Boolean(contactPhoneError)}
            helperText={contactPhoneError}
            sx={{ mb: 3 }}
          />
          
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
              Bedrijf Aanmaken
            </Button>
          </Box>
        </form>
      </Paper>
      
      <Snackbar
        open={success}
        autoHideDuration={2000}
        onClose={() => setSuccess(false)}
        message="Bedrijf succesvol aangemaakt!"
      />
    </Box>
  );
}

export default CreateCompany;
