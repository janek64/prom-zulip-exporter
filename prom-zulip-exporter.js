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

/*
  Zulip data variables. Variables storing the fetch results, making
  it possible to generate multiple metrics from one API call.
*/
let subscriptions;
let topicsByStream;

/**
 * Fetches the necessary data from the API and stores it in the data
 * variables.
 */
const fetchZulipData = async () => {
  try {
    // Get all subscribed topics
    subscriptions = await zulipClient.streams.subscriptions.retrieve();
    // For each stream, get all topics
    topicsByStream = {};
    for (stream of subscriptions.subscriptions) {
      const topics = await zulipClient.streams.topics.retrieve(
          {stream_id: stream.stream_id},
      );
      // Store the topics by the stream name and ID
      topicsByStream[stream.stream_id + `_'${stream.name}'`] = topics.topics;
    }
  } catch (error) {
    throw new Error('Failed to fetch from Zulip: ' + error.message);
  }
};

/*
  Metric configurations
*/
// Disable the unused variables rule for this section
/* eslint-disable no-unused-vars */

// Zulip stream number gauge metric
const streamNumberGauge = new promClient.Gauge({
  name: 'zulip_streams_total',
  help: 'Total number of streams in Zulip',
  collect() {
    this.set(subscriptions.subscriptions.length);
  },
});

// Zulip topic gauge labeled by stream
const topicNumberGauge = new promClient.Gauge({
  name: 'zulip_topics_total',
  help: 'Total number of topics by stream in Zulip',
  labelNames: ['stream'],
  collect() {
    for (const stream in topicsByStream) {
      // Avoid prototype properties
      if (topicsByStream.hasOwnProperty(stream)) {
        this.set({stream: stream}, topicsByStream[stream].length);
      }
    }
  },
});

/* eslint-enable no-unused-vars */

// Initialize the metrics route
app.get('/metrics', async (req, res) => {
  try {
    // Call the fetch function - prevents to fetch too often
    await fetchZulipData();
    // Trigger the collect() methods and return the metrics
    res.send(await promClient.register.metrics());
  } catch (error) {
    console.log(error.message);
    res.status(500).end(error.message);
  }
});

// Start the server on the specified port
app.listen(port, () => {
  console.log(`Zulip exporter available under http://127.0.0.1:${port}/metrics`);
});
