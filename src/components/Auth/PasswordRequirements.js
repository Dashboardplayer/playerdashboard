import React from 'react';
import { Box, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { PASSWORD_RULES } from '../../utils/passwordValidation';

const PasswordRequirements = ({ password }) => {
  // Check each requirement
  const requirements = [
    {
      met: password.length >= PASSWORD_RULES.minLength,
      text: `${PASSWORD_RULES.minLength} karakters`,
      warning: `${PASSWORD_RULES.minLength} karakters`
    },
    {
      met: (password.match(/[A-Z]/g) || []).length >= PASSWORD_RULES.minUppercase,
      text: 'Hoofdletter',
      warning: 'een hoofdletter'
    },
    {
      met: (password.match(/[a-z]/g) || []).length >= PASSWORD_RULES.minLowercase,
      text: 'Kleine letter',
      warning: 'een kleine letter'
    },
    {
      met: (password.match(/[0-9]/g) || []).length >= PASSWORD_RULES.minNumbers,
      text: 'Cijfer',
      warning: 'een cijfer'
    },
    {
      met: (password.match(/[!@#$%^&*()_+\-=[\]{};:,.<>?]/g) || []).length >= PASSWORD_RULES.minSpecialChars,
      text: 'Speciaal teken',
      warning: 'een speciaal teken'
    }
  ];

  const allRequirementsMet = requirements.every(req => req.met);

  return (
    <Box sx={{ mt: 1.5, mb: 2 }}>
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          mb: 1,
          color: 'text.secondary',
          fontWeight: 500
        }}
      >
        Wachtwoord moet voldoen aan:
      </Typography>
      <Box sx={{ 
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1
      }}>
        {requirements.map((req, index) => (
          <Box
            key={index}
            sx={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: req.met ? '#edf7ed' : '#f5f5f5',
              borderRadius: 1,
              px: 1,
              py: 0.5,
              gap: 0.5,
              transition: 'all 0.2s ease-in-out'
            }}
          >
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: req.met ? '#4caf50' : 'transparent',
                transition: 'all 0.2s ease-in-out'
              }}
            >
              {req.met && (
                <CheckIcon 
                  sx={{ 
                    fontSize: 12,
                    color: 'white'
                  }} 
                />
              )}
            </Box>
            <Typography
              variant="body2"
              sx={{
                fontSize: '0.8125rem',
                color: req.met ? '#1e4620' : 'text.secondary',
                transition: 'color 0.2s ease-in-out'
              }}
            >
              {req.text}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export const getPasswordErrors = (password) => {
  const missingRequirements = [];
  
  if (password.length < PASSWORD_RULES.minLength) {
    missingRequirements.push(`${PASSWORD_RULES.minLength} karakters`);
  }
  if ((password.match(/[A-Z]/g) || []).length < PASSWORD_RULES.minUppercase) {
    missingRequirements.push('een hoofdletter');
  }
  if ((password.match(/[a-z]/g) || []).length < PASSWORD_RULES.minLowercase) {
    missingRequirements.push('een kleine letter');
  }
  if ((password.match(/[0-9]/g) || []).length < PASSWORD_RULES.minNumbers) {
    missingRequirements.push('een cijfer');
  }
  if ((password.match(/[!@#$%^&*()_+\-=[\]{};:,.<>?]/g) || []).length < PASSWORD_RULES.minSpecialChars) {
    missingRequirements.push('een speciaal teken');
  }

  if (missingRequirements.length === 0) {
    return null;
  }

  if (missingRequirements.length === 1) {
    return `Je wachtwoord mist ${missingRequirements[0]}.`;
  }

  const lastRequirement = missingRequirements.pop();
  return `Je wachtwoord mist ${missingRequirements.join(', ')} en ${lastRequirement}.`;
};

export default PasswordRequirements; 