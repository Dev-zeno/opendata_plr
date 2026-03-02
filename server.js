const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// API Routes
app.use('/api/proxy', (req, res) => require('./api/proxy')(req, res));
app.use('/api/proxy-reading-room', (req, res) => require('./api/proxy-reading-room')(req, res));
app.use('/api/seat-map-proxy', (req, res) => require('./api/seat-map-proxy')(req, res));

// Serve static files
app.use(express.static(__dirname));

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Local server running at http://localhost:${port}`);
});
