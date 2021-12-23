// Load the express module and initialize an app
const express = require('express');
const app = express();
const port = 9304;

// Load the prom-client module
const promclient = require('prom-client');

// Initialize the metrics route
app.get('/metrics', (req, res) => {
  res.send('Zulip Exporter Metrics');
});

// Start the server on the specified port
app.listen(port, () => {
  console.log(`Zulip exporter available under 127.0.0.1:${port}/metrics`);
});
