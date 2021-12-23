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

**Note:** The bot will only be able to provide metrics about channel he has subscribed. To add a stream to the metrics, add the bot to the stream.

### Environment Variables
The following variables are available for the application:
| Variable           | Default Value | Description                                     |
| ------------------ | ------------- | ----------------------------------------------- |
| `PORT`             | 9304          | Port to expose the metrics on                   |
| `ZULIP_USER_EMAIL` | _none_        | Email of the Zulip bot                          |
| `ZULIP_API_KEY`    | _none_        | API key of Zulip bot                            |
| `ZULIP_URL`        | _none_        | URL of the Zulip instance to fetch metrics from |


## Available metrics
The following metrics are provided by the exporter:
| Name                     | Type        | Description                      |
| ------------------------ | ----------- | -------------------------------- |
| `zulip_streams_total`      | Gauge       | Total number of streams in Zulip |