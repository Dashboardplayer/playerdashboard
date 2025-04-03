# How to Check Player Count in MongoDB

Since the server seems to be using authentication for its API endpoints, here are several methods to check how many players are registered:

## Method 1: Check via browser console
1. Open the SuperAdmin Dashboard in a web browser
2. Open browser DevTools (F12 or right-click and select "Inspect")
3. Go to the "Console" tab
4. Run this command:
```javascript
fetch('/api/players')
  .then(response => response.json())
  .then(data => {
    console.log('Total players:', data.length);
    console.log('First player example:', data[0]);
  })
  .catch(error => console.error('Error fetching players:', error));
```

## Method 2: Check via Admin Dashboard
1. Log in to the SuperAdmin Dashboard
2. Navigate to the Players tab
3. Count the number of players displayed or look for a counter/stats section

## Method 3: Check database directly with MongoDB Compass
If you have access to the MongoDB connection string:
1. Install MongoDB Compass (https://www.mongodb.com/products/compass)
2. Connect to your database using the connection string
3. Navigate to the players collection 
4. Look at the document count

## Method 4: Check via Node.js script
Create a file named `check_players.js` with this content:
```javascript
const https = require('https');

const options = {
  hostname: 'player-dashboard.onrender.com',
  path: '/api/players',
  method: 'GET',
  headers: {
    // Add authorization header if needed
    // 'Authorization': 'Bearer YOUR_TOKEN_HERE'
  }
};

const req = https.request(options, res => {
  console.log(`Status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', chunk => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('Player count:', parsed.length);
      if (parsed.length > 0) {
        console.log('First player:', parsed[0]);
      }
    } catch (e) {
      console.error('Could not parse response:', data);
    }
  });
});

req.on('error', error => {
  console.error('Error:', error);
});

req.end();
```

Then run it with Node.js:
```
node check_players.js
``` 