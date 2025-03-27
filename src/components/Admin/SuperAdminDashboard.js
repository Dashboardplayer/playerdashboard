import React, { useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import UsersTab from './UsersTab';
import CompaniesTab from './CompaniesTab';
import PlayersTab from './PlayersTab';
import PerformanceTab from './PerformanceTab';

const SuperAdminDashboard = () => {
  const [currentTab, setCurrentTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  return (
    <Box>
      <Tabs value={currentTab} onChange={handleTabChange}>
        <Tab label="Users" />
        <Tab label="Companies" />
        <Tab label="Players" />
        <Tab label="Performance" />
      </Tabs>

      <Box mt={3}>
        {currentTab === 0 && <UsersTab />}
        {currentTab === 1 && <CompaniesTab />}
        {currentTab === 2 && <PlayersTab />}
        {currentTab === 3 && <PerformanceTab />}
      </Box>
    </Box>
  );
};

export default SuperAdminDashboard; 