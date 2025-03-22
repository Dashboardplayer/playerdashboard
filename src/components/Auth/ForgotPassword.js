// ForgotPassword.js
import React, { useState } from 'react';
import { Container, Box, Typography, TextField, Button, Alert, Paper, Link, useTheme, useMediaQuery } from '@mui/material';
import { useNavigate } from 'react-router-dom';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: '#f4f4f4',
        pt: { xs: 2, sm: 4 },
        px: { xs: 2, sm: 0 }
      }}
    >
      {/* Logo Container */}
      <Box sx={{ mb: { xs: 3, sm: 4 } }}>
        <img 
          src="/logo192.png" 
          alt="Display Beheer Logo" 
          style={{ 
            height: isMobile ? '32px' : '40px',
            width: 'auto'
          }} 
        />
      </Box>

      {/* Main Card */}
      <Paper
        elevation={3}
        sx={{
          width: '100%',
          maxWidth: '480px',
          borderRadius: 2,
          p: { xs: 3, sm: 4 },
          backgroundColor: 'white'
        }}
      >
        <Typography
          variant="h4"
          component="h1"
          sx={{
            mb: 2,
            color: '#1e3a5f',
            fontWeight: 500,
            fontSize: { xs: '1.75rem', sm: '2.125rem' }
          }}
        >
          Forgot your password
        </Typography>

        <Typography
          variant="body1"
          sx={{
            mb: { xs: 3, sm: 4 },
            color: '#475569',
            fontSize: { xs: '0.875rem', sm: '1rem' }
          }}
        >
          Please enter the email address you'd like your password reset information sent to
        </Typography>

        <Box component="form" onSubmit={handleResetPassword} sx={{ width: '100%' }}>
          <Typography
            variant="subtitle1"
            sx={{
              mb: 1,
              color: '#475569',
              fontWeight: 500,
              fontSize: { xs: '0.875rem', sm: '1rem' }
            }}
          >
            Enter email address
          </Typography>
          
          <TextField
            fullWidth
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={isError}
            sx={{
              mb: 3,
              '& .MuiOutlinedInput-root': {
                borderRadius: 1,
                height: { xs: '48px', sm: '56px' },
                '&.Mui-focused fieldset': {
                  borderColor: '#1a73e8',
                },
              },
              '& .MuiOutlinedInput-input': {
                fontSize: { xs: '0.875rem', sm: '1rem' },
                padding: { xs: '12px 16px', sm: '16px 20px' }
              }
            }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={isLoading}
            sx={{
              py: { xs: 1.25, sm: 1.5 },
              mb: 2,
              backgroundColor: '#1e3a5f',
              borderRadius: 1,
              textTransform: 'none',
              fontSize: { xs: '0.875rem', sm: '1rem' },
              '&:hover': {
                backgroundColor: '#15293f',
              },
            }}
          >
            Request reset link
          </Button>

          {/* Back to Login Link */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <Link
              component="button"
              onClick={() => navigate('/')}
              sx={{
                color: '#1a73e8',
                textDecoration: 'none',
                fontSize: { xs: '0.875rem', sm: '1rem' },
                py: { xs: 0.5, sm: 0.75 },
                '&:hover': {
                  textDecoration: 'underline',
                },
              }}
            >
              Back To Login
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
      </Paper>
    </Box>
  );
}

export default ForgotPassword;
