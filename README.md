# Prometheus Zulip Exporter
### 2021 Janek Berg
A prometheus exporter for the Zulip chat application.

## Usage
### Create a Zulip bot
This exporter requires a bot in Zulip which will serve as the access point for fetching metrics from Zulip. It can be created by following these steps:
1. In Zulip, open "Personal settings" (available under the gear at the top right)
2. Navigate to "Bots" -> "Add a new bot"
3. Choose the Bot type "Generic bot" and choose a name for bot and email.
4. Click "Create bot". The new bot will now be available under "Active Bots".
5. User the provided bot email and API Key for the bot as environment variables of the exporter.

**Note:** The bot will only be able to provide metrics about streams he has subscribed to. To add a stream to the metrics, add the bot to the stream.

### Environment Variables
The following variables are available for the application:
| Variable                 | Default Value    | Description                                         |
| ------------------------ | ---------------- | --------------------------------------------------- |
| `PORT`                   | 9304             | Port to expose the metrics on                       |
| `ZULIP_USER_EMAIL`       | _none_           | Email of the Zulip bot                              |
| `ZULIP_API_KEY`          | _none_           | API key of Zulip bot                                |
| `ZULIP_URL`              | _none_           | URL of the Zulip instance to fetch metrics from     |
| `ACTIVATE_USER_PRESENCE` | "false" (string) | Activcates the `zulip_users_presences_total` metric |
| `IGNORE_SELF_SIGNED_SSL` | "false" (string) | Ignore self-signed SSL certificates. **WARNING:** This globally disables any SSL certificate checks for this application. Only use this if you are working in an isolated network and know what you are doing! |


## Available metrics
The following metrics are provided by the exporter:
| Name                           | Type      | Labels     |  Description                                                                           |
| ------------------------------ | ----------| ---------- | -------------------------------------------------------------------------------------- |
| `zulip_streams_total`          | Gauge     | _none_     | Total number of streams in Zulip                                                       |
| `zulip_topics_total `          | Gauge     | `stream`   | Total number of topics in Zulip, labeled by stream                                     |
| `zulip_users_total `           | Gauge     | `role`     | Total number of users in Zulip, labeled by role                                        |
| `zulip_users_presences_total ` | Gauge     | `status`   | Total number of users presences in Zulip, labeled by status (active, idle, offline)    |
| `zulip_messages_total `        | Counter   | `stream`, `topic`   | Total number messages in Zulip, labeled by stream and topic. **Note:** Can only count messages since the last exporter restart because the bot is required to count new messages with his read/unread history (Zulip doesn't offer any other possibilities). Using `rate` for visualization is highly suggested.  |
| `zulip_server_info `    | Gauge     | `version`, `feature_level`, `realm_uri`, `realm_name`, `push_notitifications_enabled`, `email_auth_enabled`, `external_authentications` | Metadata information about the Zulip server (pseudo-metric) |
| `zulip_customization_linkifiers_total `    | Gauge     | _none_   | Total number of linkifiers in Zulip            |
| `zulip_customization_emojis_total `        | Gauge     | _none_   | Total number of custom emojis in Zulip         |
| `zulip_customization_profilefields_total ` | Gauge     | _none_   | Total number of custom profile fields in Zulip |

**Note on `zulip_users_presences_total`:** The Zulip API only offers the ability to check the presence for a single user. Therefore, the exporter needs to query the the Zulip API for each activated non-bot account. On larger Zulip instances, this could cause a significant delay for responses of the **/metrics** endpoint and should be tested for a potential usage. For this reason, the metric will return 0 on default and can only be activated with the associated environment variable.