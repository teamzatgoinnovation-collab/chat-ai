# Platform SDK

> Prefer the v0.2.5 docs: [plugin_sdk.md](plugin_sdk.md), [platform_architecture.md](platform_architecture.md).

External apps extend Chat AI without forking core.

## Hook

```python
# other_app/hooks.py
chat_ai_plugins = [
    "other_app.ai.plugin.setup",
]
```

## Folder auto-discovery (v0.2.5)

Ship `<app>/chat_ai_plugin/` with `manifest.py` + optional `tools.py`. See [extension_guide.md](extension_guide.md).

## Registrar

```python
from chat_ai.plugin.api import (
    register_tools,
    register_skill,
    register_context,
    register_prompt,
    register_events,
    register_commands,
    register_ui_actions,
    register_sidebar_widgets,
)

def setup():
    register_commands([{"name": "trip", "label": "Trips", "description": "Delivery trips"}])
    # register_skill("other_app.ai.skills.delivery")
    # register_tools([... ToolSpec ...])
```

## Skill package layout

```
my_skill/
  skill.yaml          # name, label, required_doctypes
  tools.py            # get_tools() -> list[ToolSpec]
  prompt.md
  examples.md
  tools/*.tool.yaml   # optional manifests
```

Point Chat AI at extra roots via `register_skill_path("/path/to/skills")` or ship under an app and register on setup.

## DocType connectors (v0.2)

Without writing a plugin, managers can expose tools via Desk:

1. **AI REST Tool** — OpenAPI-style HTTP tools (`url_template`, method, auth, JSON schema)
2. **AI MCP Server** — MCP `tools/list` + `tools/call` over http/sse (stdio stores discovered tools only)
3. **AI Integration Connector** — GitHub, Slack, Custom HTTP (other services stub until later)

Gate with Chat AI Settings: `enable_plugin_tools`, `enable_rest_tools`, `enable_mcp_tools`, `enable_integrations`.
ToolSpecs use `source` in `{python,erp,plugin,rest,mcp}` and appear in **AI Tool Log**.

