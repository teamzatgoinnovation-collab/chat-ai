# Chat AI Platform Architecture (v0.2.5)

Chat AI is the ERPNext AI **hub**: Desk / Flutter / Electron / Web clients talk to one Chat API; domain apps ship `chat_ai_plugin/` packages.

## Layers

| Layer | Role |
|-------|------|
| `api/chat.py` | Stable Desk contract (`send`, sessions, history) |
| `api/platform.py` | Multi-client aliases + artifacts / plugins / connectors |
| Orchestrator | Planner → tools → response + artifacts + events |
| Plugin loader | Hooks + auto-discover `chat_ai_plugin/` |
| Tool pipeline | Resolve → permission → execute → retry → format |
| Artifact store | Durable `AI Artifact` rows |
| Event stream | `chat_ai:event` (+ legacy `chat_ai:stream` / `progress`) |

## Company Status Brief

Intent phrases (e.g. “what is my company status”) force Analytics mode and prefer `company_status_brief` (AR/AP, cash, low stock, CRM, projects). Thin `dashboard_summary` remains available.

## Version

`chat_ai` **0.2.5** — additive over 0.2.0. See `plugin_sdk.md`, `artifact_sdk.md`, `streaming_protocol.md`, `api_reference.md`, `extension_guide.md`.
