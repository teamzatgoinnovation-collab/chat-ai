# Deployment

- Store LLM keys only in **Chat AI Settings** Password fields (or site_config overrides if you choose).
- Enable audit logs and set conversation retention days.
- Configure token unit prices for cost estimates (estimates only — not vendor billing sync).
- Default prompt bundle is **v4** (set in Chat AI Settings if you need v1–v3).
- For vector search, enable the toggle and optionally reindex via document events (knowledge platform — expand in v0.3).
- **MCP / REST / Integrations are off by default.** Enablement order:
  1. Create rows in **AI REST Tool**, **AI MCP Server**, and/or **AI Integration Connector**
  2. For MCP: open the server form → **Discover Tools**
  3. Turn on `enable_rest_tools` / `enable_mcp_tools` / `enable_integrations` in Chat AI Settings
  4. `bench --site erp.zatgo.online clear-cache` and hard-refresh Desk
- After Desk JS/CSS changes on frappe_docker: `bash deploy/sync_frontend_assets.sh` then clear-cache.
