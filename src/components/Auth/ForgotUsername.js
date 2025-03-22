// ForgotUsername.js
import React, { useState } from 'react';
import { mongoClient } from '../../hooks/mongoClient.js';
import { Container, Box, Typography, TextField, Button } from '@mui/material';

function ForgotUsername() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState('');

  const handleRetrieveUsername = async (e) => {
    e.preventDefault();
    setResult('');

    // We gaan er hier van uit dat 'profiles' een kolom 'email' heeft
    // en een kolom 'username' die we willen terugvinden.
    const { data, error } = await mongoClient
      .from('profiles')
      .select('username')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      setResult(`Er ging iets mis: ${error.message}`);
    } else if (!data) {
      setResult('Geen account gevonden met dit e-mailadres.');
    } else {
      setResult(`Jouw gebruikersnaam is: ${data.username}`);
      // In een echte app zou je deze misschien mailen, in plaats van tonen.
    }
  };

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
          Gebruikersnaam Vergeten
        </Typography>
        <Box component="form" onSubmit={handleRetrieveUsername} sx={{ mt: 2 }}>
          <TextField
            fullWidth
            margin="normal"
            label="Email"
            placeholder="Vul je e-mailadres in"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            sx={{ mt: 2 }}
          >
            Haal Gebruikersnaam op
          </Button>
        </Box>
        {result && (
          <Typography variant="body2" sx={{ mt: 2 }}>
            {result}
          </Typography>
        )}
      </Box>
    </Container>
  );
}

export default ForgotUsername;
