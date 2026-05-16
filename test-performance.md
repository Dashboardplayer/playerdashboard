# Performance Tab Testing Guide

## Manual Testing Steps

### 1. Start the server
```bash
npm start
```

### 2. Login as superadmin
- Go to http://localhost:3000
- Login with superadmin credentials
- Navigate to Admin > Performance tab

### 3. Verify data sources

#### WebSocket Connections
- Open browser DevTools > Network > WS
- Connect to WebSocket from another tab/device
- Verify "Total Connections" increases
- Verify "Authenticated Connections" increases after authentication

#### Memory Usage
- Check if memory values are reasonable (in MB)
- Heap Used should be < Heap Total
- Values should change over time

#### Rate Limits
- Make many requests to trigger rate limits:
```bash
# Test auth limiter (5 attempts per 5 min)
for i in {1..10}; do
  curl -X POST http://localhost:5001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done
```
- Check "Current Usage" increases
- Check "Remaining" decreases

#### System Information
- Verify uptime matches server start time
- Check Node version matches `node --version`
- Platform/arch should match your system

#### Database Status
- Status should be "Connected"
- Database name should match your MONGO_URI
- Active Users: login with different users, wait 5 min, check count
- Active Players: update player via API, wait 5 min, check count

#### API Performance
- Make API requests and check response times:
```bash
time curl http://localhost:5001/api/companies
```
- Average Response Time should reflect actual times
- Error Rate should be 0% for successful requests

### 4. Test with load

#### Generate API traffic
```bash
# Install apache bench
ab -n 100 -c 10 http://localhost:5001/api/companies
```

#### Check metrics
- API Performance: response times should increase
- Memory Usage: should increase during load
- Rate Limits: may show hits if limits exceeded

### 5. Test WebSocket connections

#### Connect multiple clients
```javascript
// In browser console
const ws1 = new WebSocket('ws://localhost:5001/api');
const ws2 = new WebSocket('ws://localhost:5001/api');
// Check Performance tab - Total Connections should be 2
```

#### Test authentication
```javascript
ws1.send(JSON.stringify({
  type: 'authenticate',
  token: 'YOUR_JWT_TOKEN',
  clientId: 'test-client',
  timestamp: Date.now()
}));
// Check Performance tab - Authenticated Connections should increase
```

### 6. Verify data accuracy

#### Compare with system tools
```bash
# Check memory
node -e "console.log(process.memoryUsage())"

# Check uptime
node -e "console.log(process.uptime())"

# Check MongoDB
mongosh --eval "db.serverStatus()"
```

#### Verify database counts
```bash
# Active users (last 5 min)
mongosh --eval "db.users.countDocuments({lastLogin: {\$gte: new Date(Date.now() - 5*60*1000)}})"

# Active players (last 5 min)
mongosh --eval "db.players.countDocuments({last_updated: {\$gte: new Date(Date.now() - 5*60*1000)}})"
```

### 7. Test alerts

#### Trigger memory alert
- Create memory leak (not recommended in production)
- Or artificially increase memory usage
- Check if alert appears

#### Trigger rate limit alert
- Exceed rate limits (see step 3)
- Check if alert appears in notifications

#### Trigger API response time alert
- Add delay to an endpoint temporarily
- Check if slow response alert appears

### 8. Test export
- Click "Export Data" button
- Verify JSON file downloads
- Check file contains all metrics
- Verify historical data is included

## Automated Testing

### Create test script
```javascript
// test-performance.js
const fetch = require('node-fetch');

async function testMonitoring() {
  const response = await fetch('http://localhost:5001/api/monitoring', {
    headers: {
      'Authorization': 'Bearer YOUR_JWT_TOKEN'
    }
  });
  
  const data = await response.json();
  
  console.log('Monitoring Data:', JSON.stringify(data, null, 2));
  
  // Verify data structure
  console.assert(data.system, 'Missing system data');
  console.assert(data.websocket, 'Missing websocket data');
  console.assert(data.rateLimits, 'Missing rate limits data');
  console.assert(data.apiResponse, 'Missing API response data');
  console.assert(data.database, 'Missing database data');
  
  // Verify data types
  console.assert(typeof data.system.uptime === 'number', 'Invalid uptime type');
  console.assert(Array.isArray(data.rateLimits), 'Rate limits should be array');
  console.assert(typeof data.apiResponse.avgTime === 'number', 'Invalid avgTime type');
  
  console.log('All tests passed!');
}

testMonitoring().catch(console.error);
```

Run with:
```bash
node test-performance.js
```

## Known Issues / Limitations

1. **Rate limit tracking**: Only tracks 429 errors, not all requests
2. **Active users/players**: Based on last 5 minutes, may not reflect real-time activity
3. **Memory**: Shows Node.js memory only, not system-wide memory
4. **CPU**: `process.cpuUsage()` shows user/system CPU time, not percentage
5. **WebSocket stats**: No historical data for individual connections

## Troubleshooting

### No data showing
- Check if you're logged in as superadmin
- Check browser console for errors
- Verify `/api/monitoring` endpoint returns data
- Check network tab for failed requests

### Incorrect data
- Verify server is running
- Check MongoDB connection
- Verify rate limit middleware is applied
- Check if `global.requestStats` is being populated

### Charts not updating
- Verify 30-second interval is working
- Check browser console for JavaScript errors
- Verify historical data state is updating
