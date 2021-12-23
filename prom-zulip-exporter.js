// Load necessary environment variables
require('dotenv').config();
const port = process.env.PORT || 9304;
const zulipUsername = process.env.ZULIP_USER_EMAIL;
const zulipAPIKey = process.env.ZULIP_API_KEY;
const zulipURL = process.env.ZULIP_URL;

// Load the express module and initialize an app
const express = require('express');
const app = express();

// Load the prom-client module
const promClient = require('prom-client');

// Load the zulip-js module and set its configuration
const zulip = require('zulip-js');
const zulipConfig = {
  username: zulipUsername,
  apiKey: zulipAPIKey,
  realm: zulipURL,
};
let zulipClient;

(async () => {
  zulipClient = await zulip(zulipConfig);
})();


// Initialize the metrics route
app.get('/metrics', (req, res) => {
  res.send('Zulip Exporter Metrics');
});

// Start the server on the specified port
app.listen(port, () => {
  console.log(`Zulip exporter available under http://127.0.0.1:${port}/metrics`);
});
