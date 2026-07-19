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
3. Hard-refresh Desk — use the floating **AI** button for the slide-out chat.
4. Managers: open workspace **AI Admin** for sessions, usage, tool logs, provider health.
