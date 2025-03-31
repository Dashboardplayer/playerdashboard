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
  Legend
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Alert thresholds
const ALERT_THRESHOLDS = {
  memory: {
    heapUsed: 80, // 80% of total heap
    warning: 70   // 70% for warning
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
    rateLimits: [],
    memory: [],
    apiResponse: []
  });

  // Check for alerts
  const checkAlerts = (data) => {
    const newAlerts = [];
    
    // Memory alerts
    const heapUsage = (data.system.memory.heapUsed / data.system.memory.heapTotal) * 100;
    if (heapUsage > ALERT_THRESHOLDS.memory.heapUsed) {
      newAlerts.push({
        type: 'error',
        message: `High memory usage: ${heapUsage.toFixed(1)}%`
      });
    } else if (heapUsage > ALERT_THRESHOLDS.memory.warning) {
      newAlerts.push({
        type: 'warning',
        message: `Elevated memory usage: ${heapUsage.toFixed(1)}%`
      });
    }

    // WebSocket alerts
    const disconnectionRate = ((data.websocket.totalConnections - data.websocket.authenticatedConnections) / data.websocket.totalConnections) * 100;
    if (disconnectionRate > ALERT_THRESHOLDS.websocket.disconnectionRate) {
      newAlerts.push({
        type: 'error',
        message: `High WebSocket disconnection rate: ${disconnectionRate.toFixed(1)}%`
      });
    }

    // Rate limit alerts
    Object.entries(data.rateLimits).forEach(([type, limitData]) => {
      const usage = (limitData.current / limitData.max) * 100;
      if (usage > ALERT_THRESHOLDS.rateLimit.critical) {
        newAlerts.push({
          type: 'error',
          message: `Critical rate limit usage for ${type}: ${usage.toFixed(1)}%`
        });
      } else if (usage > ALERT_THRESHOLDS.rateLimit.warning) {
        newAlerts.push({
          type: 'warning',
          message: `High rate limit usage for ${type}: ${usage.toFixed(1)}%`
        });
      }
    });

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
      setSnackbarMessage(`${criticalAlerts.length} critical alert(s)!`);
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
        
        // Update historical data
        setHistoricalData(prev => {
          const now = new Date().toLocaleTimeString();
          return {
            websocket: [...prev.websocket, { time: now, ...data.websocket }].slice(-20),
            rateLimits: [...prev.rateLimits, { time: now, ...data.rateLimits }].slice(-20),
            memory: [...prev.memory, { 
              time: now, 
              heapUsed: parseInt(data.system.memory.heapUsed),
              heapTotal: parseInt(data.system.memory.heapTotal),
              rss: parseInt(data.system.memory.rss)
            }].slice(-20),
            apiResponse: [...prev.apiResponse, {
              time: now,
              avgTime: data.apiResponse?.avgTime || 0,
              errorRate: data.apiResponse?.errorRate || 0
            }].slice(-20)
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

    setSnackbarMessage('Performance data exported successfully');
    setSnackbarOpen(true);
  };

  // Chart options
  const chartOptions = {
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
        label: 'Total Connections',
        data: historicalData.websocket.map(d => d.totalConnections),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      },
      {
        label: 'Authenticated Connections',
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
        label: 'Heap Used (MB)',
        data: historicalData.memory.map(d => d.heapUsed),
        borderColor: 'rgb(255, 99, 132)',
        tension: 0.1
      },
      {
        label: 'Heap Total (MB)',
        data: historicalData.memory.map(d => d.heapTotal),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      },
      {
        label: 'RSS (MB)',
        data: historicalData.memory.map(d => d.rss),
        borderColor: 'rgb(153, 102, 255)',
        tension: 0.1
      }
    ]
  };

  // API Response Time chart data
  const apiChartData = {
    labels: historicalData.apiResponse.map(d => d.time),
    datasets: [
      {
        label: 'Average Response Time (ms)',
        data: historicalData.apiResponse.map(d => d.avgTime),
        borderColor: 'rgb(255, 159, 64)',
        tension: 0.1
      },
      {
        label: 'Error Rate (%)',
        data: historicalData.apiResponse.map(d => d.errorRate),
        borderColor: 'rgb(255, 99, 132)',
        tension: 0.1
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
          System Performance
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
            Export Data
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* WebSocket Stats */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                WebSocket Connections
              </Typography>
              <Box height={300}>
                <Line options={chartOptions} data={wsChartData} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Memory Usage */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Memory Usage
              </Typography>
              <Box height={300}>
                <Line options={chartOptions} data={memoryChartData} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Rate Limits */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Rate Limits
              </Typography>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Window</TableCell>
                      <TableCell>Limit</TableCell>
                      <TableCell>Current Usage</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {performanceData && Object.entries(performanceData.rateLimits).map(([type, data]) => (
                      <TableRow key={type}>
                        <TableCell>{type}</TableCell>
                        <TableCell>{data.windowMs / 1000}s</TableCell>
                        <TableCell>{data.max}</TableCell>
                        <TableCell>{data.current || 0}</TableCell>
                        <TableCell>
                          <Chip
                            label={data.current >= data.max * 0.8 ? 'High' : 'Normal'}
                            color={data.current >= data.max * 0.8 ? 'warning' : 'success'}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* System Info */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1">
                    Uptime: {Math.floor(performanceData?.system?.uptime / 3600)} hours {Math.floor((performanceData?.system?.uptime % 3600) / 60)} minutes
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1">
                    Last Updated: {new Date().toLocaleString()}
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
                API Performance
              </Typography>
              <Box height={300}>
                <Line options={chartOptions} data={apiChartData} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Alerts Dialog */}
      <Dialog open={alertsOpen} onClose={() => setAlertsOpen(false)}>
        <DialogTitle>System Alerts</DialogTitle>
        <DialogContent>
          {alerts.length === 0 ? (
            <Typography>No active alerts</Typography>
          ) : (
            alerts.map((alert, index) => (
              <Alert key={index} severity={alert.type} sx={{ mt: 1 }}>
                {alert.message}
              </Alert>
            ))
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAlertsOpen(false)}>Close</Button>
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