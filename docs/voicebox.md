# Voicebox speech engine

Chat AI speaks through **[Voicebox](https://github.com/jamiepine/voicebox)** by default.

```bash
git clone https://github.com/jamiepine/voicebox.git
cd voicebox
# follow upstream README: just setup && just dev
# API listens on http://127.0.0.1:17493
```

## Chat AI Settings

| Field | Purpose |
|-------|---------|
| **TTS Engine** | `Voicebox` (default) or `Browser TTS` |
| **Voicebox URL** | API base, default `http://127.0.0.1:17493` |
| **Voicebox Profile** | Optional profile name/id |
| **Voicebox Model Engine** | Optional (`kokoro`, `qwen`, …) |
| **Proxy Voicebox via ERP Server** | Off = browser → Voicebox; On = Desk → ERP → Voicebox |

Flow: `POST /speak` → poll `GET /history/{id}` → play `GET /audio/{id}`.

## CORS (browser → local Voicebox)

If Desk is on `https://erp.zatgo.online` and Voicebox is on your laptop, allow the Desk origin:

```bash
export VOICEBOX_CORS_ORIGINS=https://erp.zatgo.online
```

Or enable **Proxy Voicebox via ERP Server** and run Voicebox where the ERP backend can reach it (same host / Docker network).

## Health

```bash
bench --site erp.zatgo.online execute chat_ai.api.voice.health
```
