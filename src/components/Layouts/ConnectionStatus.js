import React, { useState, useEffect } from 'react';
import { Box, Chip } from '@mui/material';
import { CheckCircle, Error } from '@mui/icons-material';

// Component to display connection status to backend and MongoDB
function ConnectionStatus() {
  const [backendStatus, setBackendStatus] = useState('checking');
  
  // Check connection on component mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Try to reach the backend
        const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/companies`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          // Set a short timeout to quickly determine connection status
          signal: AbortSignal.timeout(2000)
        });
        
        if (response.ok) {
          setBackendStatus('connected');
        } else {
          setBackendStatus('error');
        }
      } catch (error) {
        console.log('Backend connection error:', error);
        setBackendStatus('offline');
      }
    };
    
    // Check connection immediately and then every 30 seconds
    checkConnection();
    const intervalId = setInterval(checkConnection, 30000);
    
    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, []);
  
  // Helper function to get status chip props
  const getStatusChip = () => {
    switch (backendStatus) {
      case 'connected':
        return {
          label: 'Online',
          color: 'success',
          icon: <CheckCircle style={{ fontSize: 16 }} />,
          tooltip: 'Connected to backend server'
        };
      case 'checking':
        return {
          label: 'Checking...',
          color: 'default',
          icon: null,
          tooltip: 'Checking connection status'
        };
      case 'error':
        return {
          label: 'Error',
          color: 'warning',
          icon: <Error style={{ fontSize: 16 }} />,
          tooltip: 'Connected but with errors'
        };
      case 'offline':
      default:
        return {
          label: 'Offline',
          color: 'error',
          icon: <Error style={{ fontSize: 16 }} />,
          tooltip: 'Working offline - data will sync when connection is restored'
        };
    }
  };
  
  const chipProps = getStatusChip();
  
  return (
    <Box sx={{ 
      position: 'fixed', 
      bottom: 16, 
      right: 16, 
      zIndex: 1000 
    }}>
      <Chip
        size="small"
        icon={chipProps.icon}
        label={chipProps.label}
        color={chipProps.color}
        title={chipProps.tooltip}
      />
    </Box>
  );
}

export default ConnectionStatus;