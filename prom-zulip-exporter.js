// Load necessary environment variables
require('dotenv').config();
const port = process.env.PORT || 9304;
const zulipUsername = process.env.ZULIP_USER_EMAIL;
const zulipAPIKey = process.env.ZULIP_API_KEY;
const zulipURL = process.env.ZULIP_URL;
const activateUserPresence = process.env.ACTIVATE_USER_PRESENCE;

// Ignore self-signed SSL certificates if configured
if (process.env.IGNORE_SELF_SIGNED_SSL === 'true') {
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;
}

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
let users;
let userPresences;
let unreadMessages;
let serverInformation;
let linkifiers;
let customEmojis;
let customProfileFields;

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


    // Get all users
    users = await zulipClient.users.retrieve();

    // For each user, get his presence
    userPresences = [];
    // Only get this metric if activated by the user (can take longer when
    // when the instance has many users)
    if (activateUserPresence === 'true') {
      const userPresenceHeaders = new Headers();
      userPresenceHeaders.set(
          'Authorization',
          'Basic ' + Buffer.from(zulipUsername + ':' + zulipAPIKey)
              .toString('base64'),
      );
      for (const user of users.members) {
        // Fetch the presence information (only possible for active human users)
        if (user.is_active && !user.is_bot) {
          const userPresenceResult = await fetch(
              `${zulipURL}/api/v1/users/${user.user_id}/presence`,
              {
                method: 'GET',
                headers: userPresenceHeaders,
              },
          );
          const userPresenceInformation = await userPresenceResult.json();
          if (userPresenceInformation.result !== 'success') {
            throw new Error('Reading user presence information not successful');
          }
          userPresences.push(userPresenceInformation);
        }
      }
    }

    // Get all unread messages and mark them as read
    unreadMessages = await zulipClient.messages.retrieve({
      anchor: 'first_unread',
      num_before: 0,
      num_after: 5000,
    });
    // Set all messages to 'read'
    const setReadHeaders = new Headers();
    setReadHeaders.set(
        'Authorization',
        'Basic ' + Buffer.from(zulipUsername + ':' + zulipAPIKey)
            .toString('base64'),
    );
    const setReadResults = await fetch(
        `${zulipURL}/api/v1/mark_all_as_read`,
        {
          method: 'POST',
          headers: setReadHeaders,
        },
    );
    const setReadJSON = await setReadResults.json();
    if (setReadJSON.result !== 'success') {
      throw new Error('Setting messages to read not successful');
    }


    // Fetch information about the Zulip server
    const serverInfoHeaders = new Headers();
    serverInfoHeaders.set(
        'Authorization',
        'Basic ' + Buffer.from(zulipUsername + ':' + zulipAPIKey)
            .toString('base64'),
    );
    const serverInfoResult = await fetch(
        `${zulipURL}/api/v1/server_settings`,
        {
          method: 'GET',
          headers: serverInfoHeaders,
        },
    );
    serverInformation = await serverInfoResult.json();
    if (serverInformation.result !== 'success') {
      throw new Error('Reading server information not successful');
    }


    // Fetch the linkifier information
    const linkifierHeaders = new Headers();
    linkifierHeaders.set(
        'Authorization',
        'Basic ' + Buffer.from(zulipUsername + ':' + zulipAPIKey)
            .toString('base64'),
    );
    const linkifierResult = await fetch(
        `${zulipURL}/api/v1/realm/linkifiers`,
        {
          method: 'GET',
          headers: linkifierHeaders,
        },
    );
    linkifiers = await linkifierResult.json();
    if (linkifiers.result !== 'success') {
      throw new Error('Reading linkifier information not successful');
    }


    // Fetch the custom emoji information
    const emojiHeaders = new Headers();
    emojiHeaders.set(
        'Authorization',
        'Basic ' + Buffer.from(zulipUsername + ':' + zulipAPIKey)
            .toString('base64'),
    );
    const emojiResult = await fetch(
        `${zulipURL}/api/v1/realm/emoji`,
        {
          method: 'GET',
          headers: emojiHeaders,
        },
    );
    customEmojis = await emojiResult.json();
    if (customEmojis.result !== 'success') {
      throw new Error('Reading emoji information not successful');
    }


    // Fetch the custom emoji information
    const profileFieldHeaders = new Headers();
    profileFieldHeaders.set(
        'Authorization',
        'Basic ' + Buffer.from(zulipUsername + ':' + zulipAPIKey)
            .toString('base64'),
    );
    const profileFieldResults = await fetch(
        `${zulipURL}/api/v1/realm/profile_fields`,
        {
          method: 'GET',
          headers: profileFieldHeaders,
        },
    );
    customProfileFields = await profileFieldResults.json();
    if (customProfileFields.result !== 'success') {
      throw new Error('Reading profile field information not successful');
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

// Zulip topic number gauge labeled by stream
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

// Zulip user number gauge labeled by role
const userNumberGauge = new promClient.Gauge({
  name: 'zulip_users_total',
  help: 'Total number of users by role in Zulip',
  labelNames: ['role'],
  collect() {
    // Count the users by their role
    let deactivatedUsers = 0;
    let botGenericUsers = 0;
    let botIncomingUsers = 0;
    let botOutgoingUsers = 0;
    let botEmbeddedUsers = 0;
    let billingAdminUsers = 0;
    let ownerUsers = 0;
    let adminUsers = 0;
    let moderatorUsers= 0;
    let memberUsers = 0;
    let guestUsers = 0;
    let undefinedUsers = 0;
    users.members.forEach((user) => {
      if (!user.is_active) deactivatedUsers++;
      else if (user.is_bot) {
        // Differentiate between the bot types
        switch (user.bot_type) {
          case 1:
            botGenericUsers++;
            break;
          case 2:
            botIncomingUsers++;
            break;
          case 3:
            botOutgoingUsers++;
            break;
          case 4:
            botEmbeddedUsers++;
        }
      } else if (user.is_billing_admin) billingAdminUsers++;
      else {
        switch (user.role) {
          case 100:
            ownerUsers++;
            break;
          case 200:
            adminUsers++;
            break;
          case 300:
            moderatorUsers++;
            break;
          case 400:
            memberUsers++;
            break;
          case 600:
            guestUsers++;
            break;
          default:
            undefinedUsers++;
        }
      }
      // Set the values for the metric
      this.set({role: 'deactivated'}, deactivatedUsers);
      this.set({role: 'bot-generic'}, botGenericUsers);
      this.set({role: 'bot-incoming-webhook'}, botIncomingUsers);
      this.set({role: 'bot-outgoing-webhook'}, botOutgoingUsers);
      this.set({role: 'bot-embedded'}, botEmbeddedUsers);
      this.set({role: 'billing-admin'}, billingAdminUsers);
      this.set({role: 'owner'}, ownerUsers);
      this.set({role: 'admin'}, adminUsers);
      this.set({role: 'moderator'}, moderatorUsers);
      this.set({role: 'member'}, memberUsers);
      this.set({role: 'guest'}, guestUsers);
      this.set({role: 'undefined'}, undefinedUsers);
    });
  },
});

// Zulip user presence number gauge labeled by status
const userPresenceNumberGauge = new promClient.Gauge({
  name: 'zulip_users_presences_total',
  help: 'Total number of users presences by status in Zulip',
  labelNames: ['status'],
  collect() {
    let activeUsers = 0;
    let idleUsers = 0;
    let offlineUsers = 0;
    // Reference timestamp
    // 3 minutes = 1ms * 1000 * 60 * 3 = 180000ms
    const referenceTimestamp = Date.now() - 180000;
    userPresences.forEach((userPresence) => {
      // If the timestamp is older than 3 minutes, the user is offline
      // Multiplication by 1000 to convert seconds to milliseconds
      if (
        referenceTimestamp <= userPresence.presence.aggregated.timestamp * 1000
      ) {
        // Check which kind of interaction was registered by Zulip
        if (userPresence.presence.aggregated.status === 'active') {
          activeUsers++;
        } else {
          idleUsers++;
        }
      } else {
        offlineUsers++;
      }
    });
    // Set the values for the metric
    this.set({status: 'active'}, activeUsers);
    this.set({status: 'idle'}, idleUsers);
    this.set({status: 'offline'}, offlineUsers);
  },
});

// Zulip message number counter
const messageNumberCounter = new promClient.Counter({
  name: 'zulip_messages_total',
  help: 'Total number of messages in Zulip',
  labelNames: ['stream', 'topic'],
  collect() {
    // Go trough all messages
    unreadMessages.messages.forEach((message) => {
      // Increase the counter with the stream label by 1
      this.inc(
          {
            stream: message.stream_id + `_'${message.display_recipient}'`,
            topic: message.stream_id + `_'${message.subject}'`,
          },
          1,
      );
    });
  },
});

// Zulip server information gauge
const serverInformationGauge = new promClient.Gauge({
  name: 'zulip_server_info',
  help: 'Metadata information about the Zulip server',
  labelNames: [
    'version',
    'feature_level',
    'realm_uri',
    'realm_name',
    'push_notitifications_enabled',
    'email_auth_enabled',
    'external_authentications',
  ],
  collect() {
    // Construct a string of external authentication methods
    const externalAuthentications =
      serverInformation.external_authentication_methods.map((auth) => {
        return auth.name;
      }).join(';');
    this.set({
      version: serverInformation.zulip_version,
      feature_level: serverInformation.zulip_feature_level,
      realm_uri: serverInformation.realm_uri,
      realm_name: serverInformation.realm_name,
      push_notitifications_enabled:
          serverInformation.push_notifications_enabled,
      email_auth_enabled: serverInformation.email_auth_enabled,
      external_authentications: externalAuthentications,
    }, 1);
  },
});

// Zulip linkifier number gauge
const linkifierNumberGauge = new promClient.Gauge({
  name: 'zulip_customization_linkifiers_total',
  help: 'Total number of linkifiers in Zulip',
  collect() {
    this.set(linkifiers.linkifiers.length);
  },
});

// Zulip custom emoji number gauge
const emojiNumberGauge = new promClient.Gauge({
  name: 'zulip_customization_emojis_total',
  help: 'Total number of custom emojis in Zulip',
  collect() {
    this.set(Object.keys(customEmojis.emoji).length);
  },
});

// Zulip custom profile fields number gauge
const profileFieldNumberGauge = new promClient.Gauge({
  name: 'zulip_customization_profilefields_total',
  help: 'Total number of custom profile fields in Zulip',
  collect() {
    this.set(customProfileFields.custom_fields.length);
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
