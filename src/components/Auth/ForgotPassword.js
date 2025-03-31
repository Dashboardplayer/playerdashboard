// ForgotPassword.js
import React, { useState } from 'react';
import { Container, Box, Typography, TextField, Button, Alert, Paper, Link, useTheme, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { LockOutlined } from '@mui/icons-material';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const theme = useTheme();

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setIsError(true);
      setStatusMessage('Voer een e-mailadres in');
      return;
    }

    setStatusMessage('');
    setIsError(false);
    setIsLoading(true);

    try {
      console.log('Requesting password reset for:', email);
      
      const response = await fetch('http://localhost:5001/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ email }),
        credentials: 'same-origin'
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Er ging iets mis bij het verwerken van je verzoek.');
      }

      // In development mode, log the reset token
      if (data.resetToken) {
        console.log('Development mode - Reset token:', data.resetToken);
      }

      setIsError(false);
      setStatusMessage('Er is een resetlink naar je e-mail verstuurd. Check je inbox!');
      
    } catch (err) {
      console.error('Password reset error:', err);
      setIsError(true);
      setStatusMessage(err.message || 'Er ging iets mis bij het verwerken van je verzoek.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e8eb 100%)',
        p: { xs: 2, sm: 4 },
        pt: { xs: 4, sm: 8 }
      }}
    >
      <Container 
        maxWidth="sm"
        sx={{
          mt: { xs: 4, sm: 6, md: 8 },
          mb: 4
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            mb: 4
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 700,
              color: '#1a365d',
              mb: 1,
              textAlign: 'center'
            }}
          >
            DisplayBeheer.nl
          </Typography>
        </Box>

        <Paper
          elevation={3}
          sx={{
            p: { xs: 3, sm: 4 },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            borderRadius: 2,
            background: 'linear-gradient(to bottom, #ffffff, #f8f9fa)',
            width: '100%',
            maxWidth: '440px',
            mx: 'auto',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%'
            }}
          >
            <LockOutlined
              sx={{
                fontSize: 24,
                mb: 2,
                color: '#1a365d',
                p: 1.5,
                borderRadius: '50%',
                backgroundColor: 'rgba(26, 54, 93, 0.1)'
              }}
            />
            
            <Typography
              variant="h6"
              sx={{
                mb: 1,
                fontWeight: 600,
                color: '#1a365d'
              }}
            >
              Wachtwoord vergeten
            </Typography>
            
            <Typography
              variant="body2"
              sx={{
                mb: 3,
                color: '#4a5568',
                textAlign: 'center',
                maxWidth: '400px'
              }}
            >
              Voer je e-mailadres in om een link te ontvangen waarmee je je wachtwoord kunt resetten.
            </Typography>

            <Box
              component="form"
              onSubmit={handleResetPassword}
              sx={{
                width: '100%',
                mt: 1
              }}
            >
              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label="Email"
                name="email"
                autoComplete="email"
                autoFocus
                size="small"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={isError}
                disabled={isLoading}
                InputProps={{
                  sx: {
                    borderRadius: 1,
                    backgroundColor: 'background.paper'
                  }
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={isLoading}
                sx={{
                  mt: 3,
                  mb: 2,
                  py: 1,
                  borderRadius: 1,
                  textTransform: 'none',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  boxShadow: 2,
                  backgroundColor: '#1a365d',
                  '&:hover': {
                    backgroundColor: '#2c5282',
                    boxShadow: 4
                  }
                }}
              >
                {isLoading ? (
                  <CircularProgress size={20} />
                ) : (
                  'Reset wachtwoord'
                )}
              </Button>

              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                <Link
                  component="button"
                  onClick={() => navigate('/')}
                  sx={{
                    color: '#1a365d',
                    textDecoration: 'none',
                    fontSize: '0.875rem',
                    py: { xs: 0.5, sm: 0.75 },
                    '&:hover': {
                      textDecoration: 'underline',
                    },
                  }}
                >
                  Terug naar inloggen
                </Link>
              </Box>

              {statusMessage && (
                <Alert 
                  severity={isError ? 'error' : 'success'} 
                  sx={{ 
                    mb: 3,
                    borderRadius: 1,
                    '& .MuiAlert-message': {
                      fontSize: { xs: '0.875rem', sm: '1rem' }
                    }
                  }}
                >
                  {statusMessage}
                </Alert>
              )}
            </Box>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

export default ForgotPassword;
