import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  useMediaQuery,
  useTheme,
  Tooltip,
  Avatar,
  Menu,
  MenuItem,
  Chip
} from '@mui/material';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { authAPI } from '../../hooks/apiClient';

// Icons
import {
  Menu as MenuIcon,
  Dashboard,
  Business,
  PersonAdd,
  Devices,
  Logout,
  Settings,
  Group,
  AdminPanelSettings,
  SupervisorAccount,
  Person,
  Add,
  Timeline,
  Folder,
  MonitorHeart
} from '@mui/icons-material';

function NavBar() {
  const { profile, setProfile } = useUser();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const [quickActionsAnchor, setQuickActionsAnchor] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleLogout = async () => {
    try {
      const { error } = await authAPI.logout();
      if (error) {
        console.error('Logout error:', error);
        alert('Er is een fout opgetreden bij het uitloggen.');
        return;
      }
      setProfile(null);
      navigate('/');
    } catch (err) {
      console.error('Unexpected logout error:', err);
      alert('Er is een onverwachte fout opgetreden.');
    }
  };

  const handleUserMenuOpen = (event) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const handleQuickActionClick = (event) => {
    setQuickActionsAnchor(event.currentTarget);
  };

  const handleQuickActionClose = () => {
    setQuickActionsAnchor(null);
  };

  const getNavigationItems = () => {
    const items = [
      {
        text: 'Dashboard',
        icon: <Dashboard />,
        path: profile?.role === 'superadmin' ? '/superadmin-dashboard' : '/company-dashboard'
      }
    ];

    // User Management for admins
    if (['superadmin', 'bedrijfsadmin'].includes(profile?.role)) {
      items.push({
        text: 'Gebruikers',
        icon: <Group />,
        path: '/users'
      });
    }

    // Group Management for admins
    if (['superadmin', 'bedrijfsadmin'].includes(profile?.role)) {
      items.push({
        text: 'Groepen',
        icon: <Folder />,
        path: '/groups'
      });
    }

    // Health Monitoring for admins
    if (['superadmin', 'bedrijfsadmin'].includes(profile?.role)) {
      items.push({
        text: 'Health monitor',
        icon: <MonitorHeart />,
        path: '/health'
      });
    }

    // Performance monitoring for superadmin only
    if (profile?.role === 'superadmin') {
      items.push({
        text: 'Performance',
        icon: <Timeline />,
        path: '/performance'
      });
    }

    // Settings for all users
    items.push({
      text: 'Instellingen',
      icon: <Settings />,
      path: '/settings'
    });

    return items;
  };

  const getQuickActions = () => {
    const actions = [
      {
        text: 'New Player',
        label: 'Nieuwe player',
        icon: <Devices />,
        path: '/create-player',
        roles: ['superadmin', 'bedrijfsadmin']
      },
      {
        text: 'New User',
        label: 'Nieuwe gebruiker',
        icon: <PersonAdd />,
        path: '/create-user',
        roles: ['superadmin', 'bedrijfsadmin']
      }
    ];

    if (profile?.role === 'superadmin') {
      actions.push({
        text: 'New Company',
        label: 'Nieuw bedrijf',
        icon: <Business />,
        path: '/create-company',
        roles: ['superadmin']
      });
    }

    return actions.filter(action => action.roles.includes(profile?.role));
  };

  const getRoleChipProps = () => {
    switch (profile?.role) {
      case 'superadmin':
        return {
          label: 'Superadmin',
          color: 'error',
          icon: <AdminPanelSettings sx={{ fontSize: 16 }} />
        };
      case 'bedrijfsadmin':
        return {
          label: 'Bedrijfsadmin',
          color: 'warning',
          icon: <SupervisorAccount sx={{ fontSize: 16 }} />
        };
      default:
        return {
          label: 'Gebruiker',
          color: 'success',
          icon: <Person sx={{ fontSize: 16 }} />
        };
    }
  };

  const navigationItems = getNavigationItems();
  const quickActions = getQuickActions();
  const roleChipProps = getRoleChipProps();

  return (
    <>
      <AppBar position="sticky" elevation={1} sx={{ bgcolor: 'background.paper' }}>
        <Toolbar>
          {isMobile && (
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => setDrawerOpen(true)}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          <Box
            component={Link}
            to={profile?.role === 'superadmin' ? '/superadmin-dashboard' : '/company-dashboard'}
            sx={{ 
              textDecoration: 'none',
              flexGrow: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <Box
              component="img"
              src={`${process.env.PUBLIC_URL}/displaybeheer-logo.png`}
              alt="DisplayBeheer"
              sx={{
                width: { xs: 160, sm: 210 },
                maxHeight: 44,
                objectFit: 'contain',
                objectPosition: 'left center'
              }}
            />
          </Box>

          {!isMobile && (
            <Box sx={{ mx: 2, display: 'flex', gap: 2 }}>
              {navigationItems.map((item) => (
                <Button
                  key={item.path}
                  component={Link}
                  to={item.path}
                  color="inherit"
                  startIcon={item.icon}
                  sx={{
                    color: location.pathname === item.path ? 'primary.main' : 'text.primary',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  {item.text}
                </Button>
              ))}
            </Box>
          )}

          {profile && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {quickActions.length > 0 && (
              <Tooltip title="Snel toevoegen">
                  <IconButton
                    color="primary"
                    onClick={handleQuickActionClick}
                    size="small"
                  >
                    <Add />
                  </IconButton>
                </Tooltip>
              )}

              <Chip
                icon={roleChipProps.icon}
                label={roleChipProps.label}
                color={roleChipProps.color}
                size="small"
                sx={{ height: 24 }}
              />

              <Tooltip title="Account">
                <IconButton
                  onClick={handleUserMenuOpen}
                  size="small"
                  sx={{ ml: 1 }}
                >
                  <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                    {profile.email[0].toUpperCase()}
                  </Avatar>
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      {/* Mobile Navigation Drawer */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Box sx={{ width: 250, pt: 2 }}>
          {profile && (
            <Box sx={{ px: 2, pb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Ingelogd als
              </Typography>
              <Typography variant="body2" noWrap>
                {profile.email}
              </Typography>
              <Chip
                icon={roleChipProps.icon}
                label={roleChipProps.label}
                color={roleChipProps.color}
                size="small"
                sx={{ mt: 1 }}
              />
            </Box>
          )}
          
          <Divider />
          
          <List>
            {navigationItems.map((item) => (
              <ListItemButton
                key={item.path}
                component={Link}
                to={item.path}
                selected={location.pathname === item.path}
                onClick={() => setDrawerOpen(false)}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            ))}
          </List>

          {quickActions.length > 0 && (
            <>
              <Divider />
              <List>
                <ListItem>
                  <Typography variant="overline" color="text.secondary">
                    Snel toevoegen
                  </Typography>
                </ListItem>
                {quickActions.map((action) => (
                  <ListItemButton
                    key={action.path}
                    component={Link}
                    to={action.path}
                    onClick={() => setDrawerOpen(false)}
                  >
                    <ListItemIcon>{action.icon}</ListItemIcon>
                    <ListItemText primary={action.label || action.text} />
                  </ListItemButton>
                ))}
              </List>
            </>
          )}
        </Box>
      </Drawer>

      {/* Quick Actions Menu */}
      <Menu
        anchorEl={quickActionsAnchor}
        open={Boolean(quickActionsAnchor)}
        onClose={handleQuickActionClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {quickActions.map((action) => (
          <MenuItem
            key={action.path}
            onClick={() => {
              navigate(action.path);
              handleQuickActionClose();
            }}
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              minWidth: 200
            }}
          >
            {action.icon}
            <Typography>{action.label || action.text}</Typography>
          </MenuItem>
        ))}
      </Menu>

      {/* User Menu */}
      <Menu
        anchorEl={userMenuAnchor}
        open={Boolean(userMenuAnchor)}
        onClose={handleUserMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem
          onClick={() => {
            navigate('/settings');
            handleUserMenuClose();
          }}
        >
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          <Typography>Instellingen</Typography>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            handleLogout();
            handleUserMenuClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <Logout fontSize="small" color="error" />
          </ListItemIcon>
          <Typography>Uitloggen</Typography>
        </MenuItem>
      </Menu>
    </>
  );
}

export default NavBar;
