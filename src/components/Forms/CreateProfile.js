// CreateProfile.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, useCreateProfile, useUpdateProfile } from '../../hooks/useApi';
import { Box, Button, TextField, Typography } from '@mui/material';

function CreateProfile() {
  const [role, setRole] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [isCompanyPreAssigned, setIsCompanyPreAssigned] = useState(false);
  const navigate = useNavigate();
  
  const { data: user } = useUser();
  const createProfileMutation = useCreateProfile();
  const updateProfileMutation = useUpdateProfile();

  useEffect(() => {
    if (user?.profile?.company_id) {
      setCompanyId(user.profile.company_id);
      setIsCompanyPreAssigned(true);
    }
    if (user?.profile?.role) {
      setRole(user.profile.role);
    }
  }, [user]);

  const handleProfileCreation = async (e) => {
    e.preventDefault();

    if (!user) {
      alert('Geen ingelogde gebruiker gevonden.');
      return;
    }

    const profileData = { 
      id: user.id, 
      role, 
      company_id: companyId 
    };

    try {
      if (user.profile) {
        await updateProfileMutation.mutateAsync(profileData);
      } else {
        await createProfileMutation.mutateAsync(profileData);
      }
      alert('Profiel succesvol ' + (user.profile ? 'bijgewerkt!' : 'aangemaakt!'));
      navigate('/superadmin-dashboard');
    } catch (error) {
      alert('Fout bij het ' + (user.profile ? 'bijwerken' : 'aanmaken') + ' van het profiel: ' + error.message);
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
        <Button 
          variant="contained" 
          type="submit" 
          sx={{ mt: 2 }}
          disabled={createProfileMutation.isPending || updateProfileMutation.isPending}
        >
          {user?.profile ? 'Werk profiel bij' : 'Maak profiel aan'}
        </Button>
      </form>
    </Box>
  );
}

export default CreateProfile;
