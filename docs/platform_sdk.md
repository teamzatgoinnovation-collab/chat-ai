# Platform SDK

External apps extend Chat AI without forking core.

## Hook

```python
# other_app/hooks.py
chat_ai_plugins = [
    "other_app.ai.plugin.setup",
]
```

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
