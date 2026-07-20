# Chat AI — ERPNext AI Platform

Generic, installable Frappe/ERPNext v16 AI platform. Self-contained git package — **no Node/`bench build`**.

```bash
bench get-app https://github.com/teamzatgoinnovation-collab/chat-ai.git
bench --site <site> install-app chat_ai
bench --site <site> migrate
```

Install/migrate auto-creates roles, Desktop Icon (**AI Admin**), asset copies, and clears cache.  
Only manual step: **Chat AI Settings** → Provider + API Key.

frappe_docker frontend assets: `bash deploy/sync_frontend_assets.sh`

See [docs/installation.md](docs/installation.md).
