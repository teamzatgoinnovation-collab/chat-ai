# Installation

```bash
bench get-app https://github.com/teamzatgoinnovation-collab/chat-ai.git
# confirm chat_ai appears in sites/apps.txt (bench get-app normally adds it)
bench --site <site> install-app chat_ai
bench --site <site> migrate
bench --site <site> clear-cache
bench build --app chat_ai
```

If Desk returns Internal Server Error or DocTypes fail with `Module Chat AI not found`, ensure `sites/apps.txt` lists `chat_ai`, then:

```bash
bench --site <site> clear-cache
bench --site <site> migrate
```

1. Open **Chat AI Settings** and set Provider, API Key, Model.
2. Assign roles **Chat AI User** / **Chat AI Manager**.
3. Hard-refresh Desk — floating **AI** launcher (bottom-right) or **Ctrl+Shift+J** opens the Vue slide-out.
4. Managers: open workspace **AI Admin** for sessions, usage, tool logs, provider health.

### frappe_docker: floating AI button 404

Frontend often cannot see `apps/chat_ai`. After install/migrate, sync assets into the frontend container:

```bash
docker exec frappe_docker-backend-1 bash -lc \
  'cp -a apps/chat_ai/chat_ai/public/. sites/chat_ai_assets/'
docker exec frappe_docker-frontend-1 bash -lc \
  'mkdir -p assets/chat_ai && cp -a sites/chat_ai_assets/. assets/chat_ai/'
# confirm Vue bundle + sidebar
curl -I https://<site>/assets/chat_ai/js/vendor/vue.global.prod.js
curl -I https://<site>/assets/chat_ai/js/chat_ai_sidebar_app.js
```

Then hard-refresh Desk (Ctrl+Shift+R).
