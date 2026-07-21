# Chat AI — ERPNext AI Platform

**v0.2.0 — Intelligent Assistant Platform.** Generic, installable Frappe/ERPNext v16 AI platform. Self-contained git package — **no Node/`bench build`**.

```bash
bench get-app https://github.com/teamzatgoinnovation-collab/chat-ai.git
bench --site <site> install-app chat_ai
bench --site <site> migrate
```

Install/migrate auto-creates roles, Desktop Icon (**AI Admin**), asset copies, and clears cache.  
Only manual step: **Chat AI Settings** → Provider + API Key.

### v0.2 highlights

- Prompt bundle **v4** (planning, memory-aware context, tighter tool selection)
- Smarter planner with `candidate_tools` shortlist
- Desk session rail, markdown/artifacts, streaming bubble + Stop
- REST / MCP / Integration connectors (off by default — enable in Settings after configuring DocTypes)

frappe_docker frontend assets: `bash deploy/sync_frontend_assets.sh`

See [docs/installation.md](docs/installation.md).
