# AI Admin

Workspace **AI Admin** (System Manager / Chat AI Manager):

| Area | Source |
|------|--------|
| Sessions | AI Chat Session |
| Token usage | AI Usage Daily + message token fields |
| Tool usage | AI Tool Log |
| Provider health | AI Provider Health Log + `chat_ai.api.admin.ping_provider` |
| Errors | Failed tool logs via `chat_ai.api.admin.list_errors` |
| Cost estimates | Settings unit prices × tokens |
| Latency | Message / tool `latency_ms`, usage averages |

Dashboard summary: `chat_ai.api.admin.get_dashboard_summary`.
