import React, { useMemo, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material';
import {
  BatteryChargingFull as BatteryIcon,
  FilterList as FilterIcon,
  Memory as MemoryIcon,
  Search as SearchIcon,
  Storage as StorageIcon,
  Timeline as TimelineIcon,
  Warning as WarningIcon,
  Wifi as WifiIcon
} from '@mui/icons-material';
import { companyAPI, healthAPI } from '../../hooks/apiClient';

const ITEMS_PER_PAGE = 24;

const formatDateTime = (value) => {
  if (!value) return 'Nog nooit';
  return new Date(value).toLocaleString('nl-NL', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
};

const clampPercent = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, number));
};

const getCompanyName = (companies, companyId) => {
  if (!companyId) return 'Geen bedrijf';
  const company = companies.find((item) => item.company_id === companyId || item._id === companyId);
  return company?.company_name || company?.name || 'Onbekend bedrijf';
};

const getHealthStatus = (health) => {
  const issues = [];

  if (Number(health.cpu_usage) > 80) issues.push('Hoge CPU');
  if (Number(health.memory_usage) > 80) issues.push('Hoog geheugen');
  if (Number(health.storage_usage) > 90) issues.push('Opslag bijna vol');
  if (
    health.battery_level !== null &&
    health.battery_level !== undefined &&
    Number(health.battery_level) < 20 &&
    !health.battery_charging
  ) {
    issues.push('Lage batterij');
  }

  return {
    status: issues.length > 0 ? 'warning' : 'healthy',
    issues
  };
};

const HealthCard = ({ health, companies }) => {
  const player = health.player_id || {};
  const healthStatus = getHealthStatus(health);

  return (
    <Card
      sx={{
        height: '100%',
        borderLeft: 4,
        borderColor: healthStatus.status === 'warning' ? 'warning.main' : 'success.main'
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap>
              {player.device_id || 'Onbekende player'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {getCompanyName(companies, player.company_id)}
            </Typography>
          </Box>
          <Chip
            size="small"
            label={healthStatus.status === 'warning' ? 'Let op' : 'Goed'}
            color={healthStatus.status === 'warning' ? 'warning' : 'success'}
          />
        </Box>

        {healthStatus.issues.length > 0 && (
          <Alert severity="warning" sx={{ mb: 1, py: 0.5 }}>
            {healthStatus.issues.join(', ')}
          </Alert>
        )}

        <Box sx={{ mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
            <MemoryIcon fontSize="small" color="primary" />
            <Typography variant="caption" sx={{ flex: 1 }}>
              Geheugen
            </Typography>
            <Typography variant="caption">{clampPercent(health.memory_usage)}%</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={clampPercent(health.memory_usage)}
            color={Number(health.memory_usage) > 80 ? 'error' : 'primary'}
            sx={{ height: 5, borderRadius: 1 }}
          />
        </Box>

        <Box sx={{ mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
            <StorageIcon fontSize="small" color="primary" />
            <Typography variant="caption" sx={{ flex: 1 }}>
              Opslag
            </Typography>
            <Typography variant="caption">{clampPercent(health.storage_usage)}%</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={clampPercent(health.storage_usage)}
            color={Number(health.storage_usage) > 90 ? 'error' : 'primary'}
            sx={{ height: 5, borderRadius: 1 }}
          />
        </Box>

        <Grid container spacing={1} sx={{ mt: 1 }}>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <BatteryIcon sx={{ fontSize: 15 }} />
              {health.battery_level !== null && health.battery_level !== undefined ? `${health.battery_level}%` : 'N.v.t.'}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <WifiIcon sx={{ fontSize: 15 }} />
              {health.network_type || 'Onbekend'}
            </Typography>
          </Grid>
        </Grid>

        <Box sx={{ mt: 1.5, pt: 1, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary" display="block">
            Laatste health: {formatDateTime(health.createdAt)}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            App: {health.app_version || 'Onbekend'} | Android: {health.android_version || 'Onbekend'}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

const OfflineCard = ({ player, companies }) => (
  <Card sx={{ height: '100%', borderLeft: 4, borderColor: 'error.main' }}>
    <CardContent>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" color="error" noWrap>
            {player.device_id || 'Onbekende player'}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap display="block">
            {getCompanyName(companies, player.company_id)}
          </Typography>
        </Box>
        <Chip size="small" label="Offline" color="error" />
      </Box>
      <Typography variant="caption" color="text.secondary" display="block">
        Laatst gezien: {formatDateTime(player.last_seen)}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" noWrap>
        URL: {player.current_url || 'Geen URL ingesteld'}
      </Typography>
    </CardContent>
  </Card>
);

const HealthMonitoring = () => {
  const [healthSummary, setHealthSummary] = useState([]);
  const [offlinePlayers, setOfflinePlayers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [page, setPage] = useState(1);
  const [currentTab, setCurrentTab] = useState(0);

  useEffect(() => {
    const fetchCompanies = async () => {
      const result = await companyAPI.getAll();
      if (!result.error && result.data) {
        setCompanies(result.data);
      }
    };

    fetchCompanies();
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchHealthData = async () => {
      setLoading(true);
      setError('');

      try {
        const [summaryResult, offlineResult] = await Promise.all([
          healthAPI.getSummary(),
          healthAPI.getOffline()
        ]);

        if (!mounted) return;

        if (summaryResult.error || offlineResult.error) {
          throw new Error(summaryResult.error || offlineResult.error);
        }

        setHealthSummary(summaryResult.data || []);
        setOfflinePlayers(offlineResult.data || []);
      } catch (err) {
        if (mounted) {
          setError('Health data ophalen mislukt: ' + err.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchHealthData();
    const interval = setInterval(fetchHealthData, 60000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const onlineHealthData = useMemo(() => {
    return healthSummary.filter((health) => health.player_id?.is_online);
  }, [healthSummary]);

  const filteredOnlineData = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return onlineHealthData.filter((health) => {
      const player = health.player_id || {};
      const matchesSearch = !query || (player.device_id || '').toLowerCase().includes(query);
      const matchesCompany = selectedCompany === 'all' || player.company_id === selectedCompany;
      return matchesSearch && matchesCompany;
    });
  }, [onlineHealthData, searchQuery, selectedCompany]);

  const filteredOfflineData = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return offlinePlayers.filter((player) => {
      const matchesSearch = !query || (player.device_id || '').toLowerCase().includes(query);
      const matchesCompany = selectedCompany === 'all' || player.company_id === selectedCompany;
      return matchesSearch && matchesCompany;
    });
  }, [offlinePlayers, searchQuery, selectedCompany]);

  const activeData = currentTab === 0 ? filteredOnlineData : filteredOfflineData;
  const totalPages = Math.max(1, Math.ceil(activeData.length / ITEMS_PER_PAGE));
  const paginatedData = activeData.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const warningCount = filteredOnlineData.filter((health) => getHealthStatus(health).status === 'warning').length;

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
    setPage(1);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TimelineIcon />
          Health monitoring
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip label={`${filteredOnlineData.length} online met health`} color="success" />
          <Chip label={`${warningCount} waarschuwingen`} color={warningCount > 0 ? 'warning' : 'default'} icon={<WarningIcon />} />
          <Chip label={`${filteredOfflineData.length} offline`} color={filteredOfflineData.length > 0 ? 'error' : 'default'} />
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Zoek op device ID..."
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setPage(1);
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Bedrijf</InputLabel>
              <Select
                value={selectedCompany}
                label="Bedrijf"
                onChange={(event) => {
                  setSelectedCompany(event.target.value);
                  setPage(1);
                }}
                startAdornment={<FilterIcon sx={{ mr: 1 }} />}
              >
                <MenuItem value="all">Alle bedrijven</MenuItem>
                {companies.map((company) => (
                  <MenuItem key={company.company_id || company._id} value={company.company_id || company._id}>
                    {company.company_name || company.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      <Tabs value={currentTab} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab label={`Online (${filteredOnlineData.length})`} />
        <Tab label={`Offline (${filteredOfflineData.length})`} />
      </Tabs>

      {loading && healthSummary.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {paginatedData.length === 0 ? (
            <Paper sx={{ p: 5, textAlign: 'center' }}>
              <Typography variant="h6">Geen health data gevonden</Typography>
              <Typography variant="body2" color="text.secondary">
                Pas je filters aan of wacht tot players nieuwe health data opsturen.
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {currentTab === 0
                ? paginatedData.map((health) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={health._id}>
                      <HealthCard health={health} companies={companies} />
                    </Grid>
                  ))
                : paginatedData.map((player) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={player._id}>
                      <OfflineCard player={player} companies={companies} />
                    </Grid>
                  ))}
            </Grid>
          )}

          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(event, value) => setPage(value)}
                color="primary"
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default HealthMonitoring;
