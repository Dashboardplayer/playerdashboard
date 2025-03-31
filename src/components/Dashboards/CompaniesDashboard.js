// CompaniesDashboard.js
import React, { useState } from 'react';
import { useCompanies, usePlayers } from '../../hooks/useApi';
import { Box, Typography, Card, CardContent, FormControl, InputLabel, Select, MenuItem } from '@mui/material';

function CompaniesDashboard() {
  const [selectedCompany, setSelectedCompany] = useState('');
  const { data: companies = [] } = useCompanies();
  const { data: players = [], isLoading: isLoadingPlayers } = usePlayers();

  const handleCompanyChange = (event) => {
    const compId = event.target.value;
    setSelectedCompany(compId);
  };

  // Filter players for selected company
  const companyPlayers = players.filter(player => player.company_id === selectedCompany);

  return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>Bedrijven Overzicht</Typography>
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel id="company-select-label">Selecteer Bedrijf</InputLabel>
          <Select
            labelId="company-select-label"
            value={selectedCompany}
            label="Selecteer Bedrijf"
            onChange={handleCompanyChange}
          >
            {companies.map((company) => (
              <MenuItem key={company.id} value={company.company_id}>
                {company.company_name} ({company.company_id})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {selectedCompany && (
          <>
            <Typography variant="h6">Players gekoppeld aan dit bedrijf:</Typography>
            {isLoadingPlayers ? (
              <Typography>Loading players...</Typography>
            ) : companyPlayers.length > 0 ? (
              companyPlayers.map((player) => (
                <Card key={player.id} sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="h6">{player.device_id}</Typography>
                    <Typography variant="body2">Huidige URL: {player.current_url}</Typography>
                    <Typography variant="body2">
                      Online: {player.is_online ? 'Ja' : 'Nee'}
                    </Typography>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Typography variant="body2">Geen spelers gevonden voor dit bedrijf.</Typography>
            )}
          </>
        )}
      </Box>
  );
}

export default CompaniesDashboard;
