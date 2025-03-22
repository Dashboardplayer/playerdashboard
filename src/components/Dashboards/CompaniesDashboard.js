// CompaniesDashboard.js
import React, { useEffect, useState } from 'react';
import { mongoClient } from '../../hooks/mongoClient.js';
import { Box, Typography, Card, CardContent, FormControl, InputLabel, Select, MenuItem } from '@mui/material';

function CompaniesDashboard() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    const { data, error } = await mongoClient.from('companies').select('*').execute();
    if (error) {
      console.error('Error fetching companies:', error);
    } else {
      setCompanies(data);
    }
  };

  const fetchPlayersForCompany = async (companyId) => {
    const { data, error } = await mongoClient.from('players').select('*').eq('company_id', companyId).execute();
    if (error) {
      console.error('Error fetching players for company:', error);
    } else {
      setPlayers(data);
    }
  };

  const handleCompanyChange = (event) => {
    const compId = event.target.value;
    setSelectedCompany(compId);
    fetchPlayersForCompany(compId);
  };

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
            {players.length > 0 ? (
              players.map((player) => (
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
