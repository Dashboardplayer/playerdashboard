import React, { useEffect } from 'react';
import { Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';

function SuperAdminLayout({ children }) {
  const navigate = useNavigate();
  const { profile } = useUser();

  // Force redirect if not superadmin
  useEffect(() => {
    if (profile && profile.role !== 'superadmin') {
      // If user is not superadmin, push them to company dashboard
      navigate('/company-dashboard');
    }
  }, [profile, navigate]);

  return (
    <Box component="main" sx={{ flexGrow: 1, p: 0 }}>
      {children}
    </Box>
  );
}

export default SuperAdminLayout;
