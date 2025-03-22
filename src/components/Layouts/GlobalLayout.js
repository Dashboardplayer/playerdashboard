// GlobalLayout.js
import React from 'react';
import { useUser } from '../../contexts/UserContext';
import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import Navbar from './Navbar';

function GlobalLayout() {
  // Hier komt de globale navigatiebalk
  // We tonen de inhoud (Outlet) daaronder

  const { profile } = useUser(); // profile.role === 'superadmin' of 'bedrijfsadmin' of 'user'

  return (
    <Box>
      <Navbar role={profile?.role} />
      <Box sx={{ mt: 8 }}>
        <Outlet />
      </Box>
    </Box>
  );
}

export default GlobalLayout;
