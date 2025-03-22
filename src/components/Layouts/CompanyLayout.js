import React from 'react';
import { Box } from '@mui/material';

function CompanyLayout({ children }) {
  return (
    <Box component="main" sx={{ flexGrow: 1, p: 0 }}>
      {children}
    </Box>
  );
}

export default CompanyLayout;
