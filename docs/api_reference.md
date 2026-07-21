# API reference (platform aliases)

All methods are Frappe whitelisted; wrap `ok`/`fail` envelopes like `chat_ai.api.chat`.

| Method | Wraps / purpose |
|--------|-----------------|
| `chat_ai.api.platform.chat_message` | `chat.send` |
| `chat_ai.api.platform.chat_session_new` | `new_session` |
| `chat_ai.api.platform.chat_session_list` | `list_sessions` |
| `chat_ai.api.platform.chat_session_rename` | `rename` |
| `chat_ai.api.platform.chat_session_archive` | `archive` |
| `chat_ai.api.platform.chat_history` | `history` |
| `chat_ai.api.platform.chat_artifacts` | list session artifacts |
| `chat_ai.api.platform.get_artifact` | get one artifact |
| `chat_ai.api.platform.chat_events_subscribe` | protocol docs |
| `chat_ai.api.platform.chat_tools_list` | ToolSpec metadata |
| `chat_ai.api.platform.chat_plugins_list` | plugin registry |
| `chat_ai.api.platform.chat_connectors_list` | REST/MCP/Integration |
| `chat_ai.api.platform.chat_connectors_test` | health test |
| `chat_ai.api.platform.cancel_turn` | cancel in-flight tools |
| `chat_ai.api.chat.cancel` | same cancel helper |

`send` accepts optional `execution_mode=background` when Settings `enable_background_turns` is on.
