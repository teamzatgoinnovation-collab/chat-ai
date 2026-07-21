# Streaming protocol

## Channels

| Channel | Payload |
|---------|---------|
| `chat_ai:event` | `{session, type, ts, data}` — preferred |
| `chat_ai:stream` | `{session, chunk, done}` — v0.2 Desk |
| `chat_ai:progress` | `{session, stage, label, detail, tool}` |

## Event types

`thinking` · `planning` · `tool_started` · `tool_progress` · `tool_finished` · `artifact_created` · `assistant_message` · `done` · `error`

Subscribe via Socket.IO / Frappe realtime as the logged-in user. Docs endpoint: `chat_ai.api.platform.chat_events_subscribe`.
