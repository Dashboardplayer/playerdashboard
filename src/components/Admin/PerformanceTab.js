import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Snackbar
} from '@mui/material';
import { Line } from 'react-chartjs-2';
import DownloadIcon from '@mui/icons-material/Download';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { browserAuth } from '../../utils/browserUtils';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

const formatUptime = (seconds = 0) => {
  const safeSeconds = Number(seconds) || 0;
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return `${hours}u ${minutes}m`;
};

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Alert thresholds
const ALERT_THRESHOLDS = {
  memory: {
    heapUsed: 95, // 95% of total heap (Node.js normally uses 80-95%)
    warning: 90   // 90% for warning
  },
  websocket: {
    disconnectionRate: 20, // 20% disconnection rate
    warning: 10           // 10% for warning
  },
  apiResponse: {
    critical: 1000,      // 1 second
    warning: 500         // 500ms
  },
  rateLimit: {
    critical: 90,        // 90% usage
    warning: 80         // 80% usage
  }
};

const PerformanceTab = () => {
  const [performanceData, setPerformanceData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [historicalData, setHistoricalData] = useState({
    websocket: [],
    memory: [],
    apiResponse: [],
    activeUsers: [],
    activePlayers: []
  });

  // Check for alerts
  const checkAlerts = (data) => {
    const newAlerts = [];
    
    // Memory alerts - show absolute values instead of percentage
    const heapUsage = (data.system.memory.heapUsed / data.system.memory.heapTotal) * 100;
    if (heapUsage > ALERT_THRESHOLDS.memory.heapUsed) {
      newAlerts.push({
        type: 'error',
        message: `High memory usage: ${data.system.memory.heapUsed}MB / ${data.system.memory.heapTotal}MB heap (RSS: ${data.system.memory.rss}MB)`
      });
    } else if (heapUsage > ALERT_THRESHOLDS.memory.warning) {
      newAlerts.push({
        type: 'warning',
        message: `Elevated memory usage: ${data.system.memory.heapUsed}MB / ${data.system.memory.heapTotal}MB heap (RSS: ${data.system.memory.rss}MB)`
      });
    }

    // WebSocket alerts
    const totalConnections = data.websocket.totalConnections || 0;
    const disconnectionRate = totalConnections > 0
      ? ((totalConnections - data.websocket.authenticatedConnections) / totalConnections) * 100
      : 0;
    if (disconnectionRate > ALERT_THRESHOLDS.websocket.disconnectionRate) {
      newAlerts.push({
        type: 'error',
        message: `High WebSocket disconnection rate: ${disconnectionRate.toFixed(1)}%`
      });
    }

    // API response time alerts
    if (data.apiResponse?.avgTime > ALERT_THRESHOLDS.apiResponse.critical) {
      newAlerts.push({
        type: 'error',
        message: `Slow API response time: ${data.apiResponse.avgTime}ms`
      });
    }

    setAlerts(newAlerts);
    
    // Show snackbar for new critical alerts
    const criticalAlerts = newAlerts.filter(alert => alert.type === 'error');
    if (criticalAlerts.length > 0) {
      setSnackbarMessage(`${criticalAlerts.length} kritieke melding(en)`);
      setSnackbarOpen(true);
    }
  };

  // Fetch performance data every 30 seconds
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get the JWT token using browserAuth
        const token = browserAuth.getToken();
        if (!token) {
          throw new Error('No authentication token found');
        }

        const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/monitoring`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Unauthorized access');
          }
          throw new Error('Failed to fetch monitoring data');
        }

        const data = await response.json();
        if (!data) {
          throw new Error('No data received from server');
        }

        setPerformanceData(data);
        checkAlerts(data);
        
        // Update historical data (prevent duplicates by checking last entry)
        setHistoricalData(prev => {
          const now = new Date().toLocaleTimeString();
          
          // Helper to add entry only if different from last
          const addIfDifferent = (arr, newEntry) => {
            const last = arr[arr.length - 1];
            if (!last || JSON.stringify(last) !== JSON.stringify(newEntry)) {
              return [...arr, newEntry].slice(-20);
            }
            return arr;
          };
          
          return {
            websocket: addIfDifferent(prev.websocket, { time: now, ...data.websocket }),
            memory: addIfDifferent(prev.memory, { 
              time: now, 
              heapUsed: data.system.memory.heapUsed,
              heapTotal: data.system.memory.heapTotal,
              rss: data.system.memory.rss,
              external: data.system.memory.external
            }),
            apiResponse: addIfDifferent(prev.apiResponse, {
              time: now,
              avgTime: data.apiResponse?.avgTime || 0,
              errorRate: data.apiResponse?.errorRate || 0,
              totalRequests: data.apiResponse?.totalRequests || 0
            }),
            activeUsers: addIfDifferent(prev.activeUsers, { time: now, count: data.activeUsers || 0 }),
            activePlayers: addIfDifferent(prev.activePlayers, { time: now, count: data.activePlayers || 0 })
          };
        });

        setError(null);
      } catch (err) {
        console.error('Error fetching performance data:', err);
        setError(err.message);
        setPerformanceData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Export performance data
  const exportData = () => {
    const dataToExport = {
      timestamp: new Date().toISOString(),
      currentMetrics: performanceData,
      historicalData
    };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-data-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setSnackbarMessage('Performance data geexporteerd');
    setSnackbarOpen(true);
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    animation: false,
    scales: {
      y: {
        beginAtZero: true,
        position: 'left'
      },
      y1: {
        beginAtZero: true,
        position: 'right',
        grid: {
          drawOnChartArea: false
        }
      }
    },
    plugins: {
      legend: {
        position: 'top'
      }
    }
  };

  const singleAxisChartOptions = {
    responsive: true,
    animation: false,
    scales: {
      y: {
        beginAtZero: true
      }
    },
    plugins: {
      legend: {
        position: 'top'
      }
    }
  };

  // WebSocket connections chart data
  const wsChartData = {
    labels: historicalData.websocket.map(d => d.time),
    datasets: [
      {
        label: 'Alle verbindingen',
        data: historicalData.websocket.map(d => d.totalConnections),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      },
      {
        label: 'Geauthenticeerd',
        data: historicalData.websocket.map(d => d.authenticatedConnections),
        borderColor: 'rgb(54, 162, 235)',
        tension: 0.1
      }
    ]
  };

  // Memory usage chart data
  const memoryChartData = {
    labels: historicalData.memory.map(d => d.time),
    datasets: [
      {
        label: 'Heap gebruikt (MB)',
        data: historicalData.memory.map(d => d.heapUsed),
        borderColor: 'rgb(255, 99, 132)',
        tension: 0.1
      },
      {
        label: 'Heap totaal (MB)',
        data: historicalData.memory.map(d => d.heapTotal),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      },
      {
        label: 'RSS (MB)',
        data: historicalData.memory.map(d => d.rss),
        borderColor: 'rgb(153, 102, 255)',
        tension: 0.1
      },
      {
        label: 'External (MB)',
        data: historicalData.memory.map(d => d.external),
        borderColor: 'rgb(255, 159, 64)',
        tension: 0.1
      }
    ]
  };

  // API Response Time chart data
  const apiChartData = {
    labels: historicalData.apiResponse.map(d => d.time),
    datasets: [
      {
        label: 'Gemiddelde responstijd (ms)',
        data: historicalData.apiResponse.map(d => d.avgTime),
        borderColor: 'rgb(255, 159, 64)',
        tension: 0.1,
        yAxisID: 'y'
      },
      {
        label: 'Foutpercentage (%)',
        data: historicalData.apiResponse.map(d => d.errorRate),
        borderColor: 'rgb(255, 99, 132)',
        tension: 0.1,
        yAxisID: 'y1'
      }
    ]
  };

  // Active Users/Players chart data
  const activeChartData = {
    labels: historicalData.activeUsers.map(d => d.time),
    datasets: [
      {
        label: 'Recente logins',
        data: historicalData.activeUsers.map(d => d.count),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        tension: 0.1,
        fill: true
      },
      {
        label: 'Actieve players',
        data: historicalData.activePlayers.map(d => d.count),
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.1)',
        tension: 0.1,
        fill: true
      }
    ]
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Systeem performance
        </Typography>
        <Box>
          <IconButton 
            color={alerts.length > 0 ? "error" : "default"}
            onClick={() => setAlertsOpen(true)}
          >
            <NotificationsIcon />
            {alerts.length > 0 && (
              <Chip
                label={alerts.length}
                color="error"
                size="small"
                sx={{ position: 'absolute', top: -8, right: -8 }}
              />
            )}
          </IconButton>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={exportData}
            sx={{ ml: 2 }}
          >
            Exporteren
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* WebSocket Stats */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                WebSocket verbindingen
              </Typography>
              <Box height={300}>
                <Line options={singleAxisChartOptions} data={wsChartData} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Memory Usage */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Geheugengebruik
              </Typography>
              <Box height={300}>
                <Line options={singleAxisChartOptions} data={memoryChartData} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Rate Limits Configuration */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Rate limit configuratie
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Dit toont de ingestelde limieten. Realtime verbruik per limiet wordt niet bijgehouden door de huidige middleware.
              </Typography>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Venster</TableCell>
                      <TableCell>Max requests</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {performanceData && Array.isArray(performanceData.rateLimits) && performanceData.rateLimits.map((data) => (
                      <TableRow key={data.type}>
                        <TableCell>{data.type}</TableCell>
                        <TableCell>{data.windowSeconds || (data.windowMs / 1000)}s</TableCell>
                        <TableCell>{data.max}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* System Info */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Systeeminformatie
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2">
                    Uptime: {formatUptime(performanceData?.system?.uptime)}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2">
                    Node: {performanceData?.system?.nodeVersion}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2">
                    Platform: {performanceData?.system?.platform} ({performanceData?.system?.arch})
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2">
                    Laatst bijgewerkt: {new Date(performanceData?.timestamp || Date.now()).toLocaleString('nl-NL')}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Database Info */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Database status
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2">
                    Status: {performanceData?.database?.readyState === 1 ? 'Verbonden' : 'Niet verbonden'}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2">
                    Database: {performanceData?.database?.name}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2">
                    Recente logins: {performanceData?.activeUsers || 0}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2">
                    Actieve players: {performanceData?.activePlayers || 0}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* API Response Times */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                API performance
              </Typography>
              <Box height={300}>
                <Line options={chartOptions} data={apiChartData} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Active Users/Players */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recente logins en actieve players
              </Typography>
              {historicalData.activeUsers.length > 0 ? (
                <Box height={300}>
                  <Line options={singleAxisChartOptions} data={activeChartData} />
                </Box>
              ) : (
                <Box height={300} display="flex" alignItems="center" justifyContent="center">
                  <Typography variant="body2" color="textSecondary">
                    Nog geen data. Wachten op eerste update...
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Alerts Dialog */}
      <Dialog open={alertsOpen} onClose={() => setAlertsOpen(false)}>
        <DialogTitle>Systeemmeldingen</DialogTitle>
        <DialogContent>
          {alerts.length === 0 ? (
            <Typography>Geen actieve meldingen</Typography>
          ) : (
            alerts.map((alert, index) => (
              <Alert key={index} severity={alert.type} sx={{ mt: 1 }}>
                {alert.message}
              </Alert>
            ))
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAlertsOpen(false)}>Sluiten</Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />
    </Box>
  );
};

export default PerformanceTab; 
