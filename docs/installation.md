# Installation

Chat AI is a self-contained Frappe app. **No `bench build` / Node** — Desk UI is static Vue under `public/`.

```bash
bench get-app https://github.com/teamzatgoinnovation-collab/chat-ai.git
bench --site <site> install-app chat_ai
# install hooks: roles, Module Def, Desktop Icon, asset copy, cache clear
bench --site <site> migrate   # safe to re-run after git pull
```

Then open Desk → **AI Admin** (or floating **AI** / Ctrl+Shift+J) → **Chat AI Settings** → set Provider + API Key.

### After every `git pull` on the bench

```bash
cd apps/chat_ai && git pull && cd ../..
bench --site <site> migrate
```

### frappe_docker only (frontend asset 404)

Frontend has no `apps/` mount. One command from the app repo (or host):

```bash
# from apps/chat_ai on the Docker host
bash deploy/sync_frontend_assets.sh
# or override container names:
# BACKEND_CONTAINER=erpnext-backend-1 FRONTEND_CONTAINER=erpnext-frontend-1 bash deploy/sync_frontend_assets.sh
```

Confirm:

```bash
curl -I https://<site>/assets/chat_ai/js/chat_ai_sidebar_app.js
```

Hard-refresh Desk (Ctrl+Shift+R).

### What install/migrate auto-does

- Creates roles **Chat AI User** / **Chat AI Manager** and assigns both to Administrator
- Ensures Module Def + Desktop Icon (**AI Admin**)
- Copies `public/` → `sites/chat_ai_assets` + backend `assets/chat_ai`
- Sanitizes bad provider configs (OpenRouter key / Custom→localhost)
- Clears site cache

### Manual (unavoidable)

| Step | Why |
|------|-----|
| Provider API key in Settings | Secrets never ship in git |
| `sync_frontend_assets.sh` on frappe_docker | Compose volume layout |
| Hard-refresh browser | Desk asset cache |
