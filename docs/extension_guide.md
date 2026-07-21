# Extension guide

1. Copy `examples/sample_plugin/chat_ai_plugin` into your app package.  
2. Set `MANIFEST.name` / version.  
3. Implement `tools.py` and optional `status.py` for company-status sections.  
4. Install app on the bench; migrate Chat AI; clear cache.  
5. Confirm **AI Plugin Registry** lists your plugin; toggle via Settings `enabled_plugins` if needed.  
6. For connectors: set lifecycle **Enabled**, use Test Connection, hourly health updates fields.  

Knowledge providers: implement `knowledge.py` → `get_providers()` returning objects with `.search(query, ctx)`. Vector backends arrive in v0.3.
