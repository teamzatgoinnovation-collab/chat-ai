# Plugin SDK

## Convention

```text
<app>/chat_ai_plugin/
  manifest.py      # MANIFEST or get_manifest()
  tools.py         # get_tools() → list[ToolSpec]
  skills/          # optional skill.yaml trees
  prompts/         # *.md fragments
  permissions.py   # optional register_rules(PermissionEngine)
  knowledge.py     # optional get_providers()
  events.py        # optional get_handlers()
  status.py        # optional get_sections() for company status
```

## Loader order

1. `chat_ai_plugins` hooks  
2. Auto-scan installed apps for `chat_ai_plugin`  
3. Settings `enable_plugin_discovery` / `enabled_plugins`  
4. Registry DocType **AI Plugin Registry** refreshed on migrate + every turn  

## Manifest

```python
MANIFEST = {
  "name": "my_plugin",
  "version": "0.1.0",
  "required_chat_ai_version": "0.2.5",
}
```

See `examples/sample_plugin/`.
