import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  IconButton,
  Button,
  Collapse,
  InputAdornment,
  Divider,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear,
  ArrowUpward,
  ArrowDownward,
  Refresh as RefreshIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  VpnKey as RoleIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { userAPI, companyAPI } from '../../hooks/apiClient';
import { useUser } from '../../contexts/UserContext';

function UserManagement() {
  const { profile } = useUser();
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // State for filtering and search
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    companyId: 'all',
    role: 'all',
    status: 'all',
    createdDate: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);

  // State for sorting
  const [sortBy, setSortBy] = useState('email');
  const [sortOrder, setSortOrder] = useState('asc');

  // Fetch users and companies
  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, companiesRes] = await Promise.all([
        userAPI.getAll(),
        companyAPI.getAll()
      ]);

      if (usersRes.error) throw new Error(usersRes.error);
      if (companiesRes.error) throw new Error(companiesRes.error);

      setUsers(usersRes.data || []);
      setCompanies(companiesRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter and sort users
  const filteredAndSortedUsers = useMemo(() => {
    let result = [...users];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(user =>
        user.email.toLowerCase().includes(query) ||
        user.first_name?.toLowerCase().includes(query) ||
        user.last_name?.toLowerCase().includes(query) ||
        companies.find(c => c.company_id === user.company_id)?.company_name.toLowerCase().includes(query)
      );
    }

    // Apply company filter
    if (filters.companyId !== 'all') {
      if (filters.companyId === 'none') {
        result = result.filter(user => !user.company_id);
      } else {
        result = result.filter(user => user.company_id === filters.companyId);
      }
    }

    // Apply role filter
    if (filters.role !== 'all') {
      result = result.filter(user => user.role === filters.role);
    }

    // Apply status filter
    if (filters.status !== 'all') {
      result = result.filter(user => 
        filters.status === 'active' ? user.is_active : !user.is_active
      );
    }

    // Apply created date filter
    if (filters.createdDate !== 'all') {
      const now = new Date();
      const getTimeLimit = () => {
        switch (filters.createdDate) {
          case '24h':
            return 24 * 60 * 60 * 1000; // 24 hours in milliseconds
          case '7d':
            return 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
          case '30d':
            return 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
          case '90d':
            return 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds
          default:
            return 0;
        }
      };
      
      const timeLimit = getTimeLimit();
      result = result.filter(user => {
        if (!user.created_at) return false;
        const createdDate = new Date(user.created_at);
        return (now - createdDate) <= timeLimit;
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      let compareResult = 0;
      switch (sortBy) {
        case 'email':
          compareResult = a.email.localeCompare(b.email);
          break;
        case 'name':
          const nameA = `${a.first_name || ''} ${a.last_name || ''}`.trim();
          const nameB = `${b.first_name || ''} ${b.last_name || ''}`.trim();
          compareResult = nameA.localeCompare(nameB);
          break;
        case 'company':
          const companyA = companies.find(c => c.company_id === a.company_id)?.company_name || '';
          const companyB = companies.find(c => c.company_id === b.company_id)?.company_name || '';
          compareResult = companyA.localeCompare(companyB);
          break;
        case 'role':
          compareResult = a.role.localeCompare(b.role);
          break;
        case 'created':
          const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
          const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
          compareResult = dateB - dateA; // Most recent first
          break;
        default:
          compareResult = 0;
      }
      return sortOrder === 'asc' ? compareResult : -compareResult;
    });

    return result;
  }, [users, searchQuery, filters, sortBy, sortOrder, companies]);

  const getRoleColor = (role) => {
    switch (role) {
      case 'superadmin':
        return { color: '#d32f2f', bg: '#ffebee' };
      case 'bedrijfsadmin':
        return { color: '#ed6c02', bg: '#fff3e0' };
      default:
        return { color: '#2e7d32', bg: '#e8f5e9' };
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header with search and filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          {/* Search and Quick Filters Row */}
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Zoek op email, naam..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchQuery('')}>
                      <Clear />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Grid>

          <Grid item xs={12} md={8}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'flex-end' }}>
              <Button
                variant={showFilters ? "contained" : "outlined"}
                startIcon={<FilterIcon />}
                onClick={() => setShowFilters(!showFilters)}
                color={showFilters ? "primary" : "inherit"}
              >
                {`Filters ${Object.values(filters).some(val => val !== 'all') ? '(Actief)' : ''}`}
              </Button>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Sorteer op</InputLabel>
                  <Select
                    value={sortBy}
                    label="Sorteer op"
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <MenuItem value="email">Email</MenuItem>
                    <MenuItem value="name">Naam</MenuItem>
                    <MenuItem value="company">Bedrijf</MenuItem>
                    <MenuItem value="role">Rol</MenuItem>
                    <MenuItem value="created">Aangemaakt op</MenuItem>
                  </Select>
                </FormControl>

                <Tooltip title={sortOrder === 'asc' ? "Oplopend" : "Aflopend"}>
                  <IconButton 
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    color="primary"
                  >
                    {sortOrder === 'asc' ? <ArrowUpward /> : <ArrowDownward />}
                  </IconButton>
                </Tooltip>
              </Box>

              <Tooltip title="Ververs">
                <IconButton onClick={fetchData} color="primary">
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>

          {/* Advanced Filters Section */}
          <Grid item xs={12}>
            <Collapse in={showFilters}>
              <Paper sx={{ p: 2, mt: 2, bgcolor: 'background.default' }}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" sx={{ mb: 2 }}>
                      Geavanceerde Filters
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Bedrijf</InputLabel>
                      <Select
                        value={filters.companyId}
                        label="Bedrijf"
                        onChange={(e) => setFilters({ ...filters, companyId: e.target.value })}
                      >
                        <MenuItem value="all">Alle Bedrijven</MenuItem>
                        <MenuItem value="none">Geen Bedrijf</MenuItem>
                        <Divider />
                        {companies.map(company => (
                          <MenuItem key={company.company_id} value={company.company_id}>
                            {company.company_name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Rol</InputLabel>
                      <Select
                        value={filters.role}
                        label="Rol"
                        onChange={(e) => setFilters({ ...filters, role: e.target.value })}
                      >
                        <MenuItem value="all">Alle Rollen</MenuItem>
                        {profile?.role === 'superadmin' && (
                          <MenuItem value="superadmin">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <RoleIcon sx={{ color: getRoleColor('superadmin').color, fontSize: 16 }} />
                              Superadmin
                            </Box>
                          </MenuItem>
                        )}
                        <MenuItem value="bedrijfsadmin">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <RoleIcon sx={{ color: getRoleColor('bedrijfsadmin').color, fontSize: 16 }} />
                            Bedrijfsadmin
                          </Box>
                        </MenuItem>
                        <MenuItem value="user">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <RoleIcon sx={{ color: getRoleColor('user').color, fontSize: 16 }} />
                            User
                          </Box>
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={filters.status}
                        label="Status"
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                      >
                        <MenuItem value="all">Alle Statussen</MenuItem>
                        <MenuItem value="active">Actief</MenuItem>
                        <MenuItem value="inactive">Inactief</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Aangemaakt</InputLabel>
                      <Select
                        value={filters.createdDate}
                        label="Aangemaakt"
                        onChange={(e) => setFilters({ ...filters, createdDate: e.target.value })}
                      >
                        <MenuItem value="all">Alle Tijden</MenuItem>
                        <MenuItem value="24h">Laatste 24 uur</MenuItem>
                        <MenuItem value="7d">Laatste week</MenuItem>
                        <MenuItem value="30d">Laatste maand</MenuItem>
                        <MenuItem value="90d">Laatste 3 maanden</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
                    <Button
                      size="small"
                      onClick={() => setFilters({
                        companyId: 'all',
                        role: 'all',
                        status: 'all',
                        createdDate: 'all'
                      })}
                      startIcon={<Clear />}
                    >
                      Wis Filters
                    </Button>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
                        {filteredAndSortedUsers.length} resultaten gevonden
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
            </Collapse>
          </Grid>
        </Grid>
      </Paper>

      {/* Users List */}
      <Grid container spacing={2}>
        {filteredAndSortedUsers.map(user => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={user._id}>
            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PersonIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                  <Typography variant="subtitle2" noWrap>
                    {user.email}
                  </Typography>
                </Box>

                {(user.first_name || user.last_name) && (
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {`${user.first_name || ''} ${user.last_name || ''}`.trim()}
                  </Typography>
                )}

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BusinessIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {companies.find(c => c.company_id === user.company_id)?.company_name || 'Geen bedrijf'}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <RoleIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                  <Chip
                    label={user.role}
                    size="small"
                    sx={{
                      backgroundColor: getRoleColor(user.role).bg,
                      color: getRoleColor(user.role).color,
                      height: '24px',
                      '& .MuiChip-label': { px: 1 }
                    }}
                  />
                </Box>

                {user.created_at && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CalendarIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                    <Typography variant="body2" color="text.secondary">
                      {new Date(user.created_at).toLocaleDateString()}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Loading and Error States */}
      {loading && (
        <Typography>Laden...</Typography>
      )}
      {error && (
        <Typography color="error">{error}</Typography>
      )}
    </Box>
  );
}

export default UserManagement; 