// CreateProfile.js
import React, { useState, useEffect } from 'react';
import { mongoClient } from '../../hooks/mongoClient.js';
import { useNavigate } from 'react-router-dom';
import { Box, Button, TextField, Typography } from '@mui/material';

function CreateProfile() {
  const [role, setRole] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [isCompanyPreAssigned, setIsCompanyPreAssigned] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function getUserProfile() {
      const { data: userData, error: userError } = await mongoClient.auth.getUser();
      if (userError) {
        console.error('Error getting user:', userError);
        return;
      }
      const user = userData?.user;
      if (!user) return;

      // Probeer een bestaand profiel op te halen
      const { data: existingProfile } = await mongoClient
        .from('profiles')
        .select('company_id, role')
        .eq('id', user.id)
        .maybeSingle();
      
      if (existingProfile && existingProfile.company_id) {
        setCompanyId(existingProfile.company_id);
        setIsCompanyPreAssigned(true);
      }
      if (existingProfile && existingProfile.role) {
        setRole(existingProfile.role);
      }
    }
    getUserProfile();
  }, []);

  const handleProfileCreation = async (e) => {
    e.preventDefault();

    const { data: userData, error: userError } = await mongoClient.auth.getUser();
    if (userError) {
      alert('Error retrieving user: ' + userError.message);
      return;
    }
    const user = userData?.user;
    if (!user) {
      alert('Geen ingelogde gebruiker gevonden.');
      return;
    }

    const { error } = await mongoClient
      .from('profiles')
      .insert([{ id: user.id, role, company_id: companyId }]);
    
    if (error) {
      alert('Fout bij het aanmaken van het profiel: ' + error.message);
    } else {
      alert('Profiel succesvol aangemaakt!');
      navigate('/superadmin-dashboard');
    }
  };

  return (
    <Box sx={{ maxWidth: '400px', margin: 'auto', p: 3 }}>
      <Typography variant="h5" gutterBottom>Maak je profiel aan</Typography>
      <form onSubmit={handleProfileCreation}>
        <TextField
          label="Rol"
          fullWidth
          margin="normal"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="bijv. bedrijfsadmin"
          required={!isCompanyPreAssigned}
          InputProps={{
            readOnly: isCompanyPreAssigned,
          }}
        />
        <TextField
          label="Bedrijfs ID"
          fullWidth
          margin="normal"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          required={!isCompanyPreAssigned}
          placeholder="Bijv. bedrijfsnaam of ID"
          InputProps={{
            readOnly: isCompanyPreAssigned,
          }}
        />
        <Button variant="contained" type="submit" sx={{ mt: 2 }}>
          Maak profiel aan
        </Button>
      </form>
    </Box>
  );
}

export default CreateProfile;
