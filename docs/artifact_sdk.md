# Artifact SDK

Durable artifacts are stored as **AI Artifact** linked to session/message.

## Types

markdown, text, json, table, chart, code, report, plan, checklist, kanban, timeline, mermaid, sql, csv, file, image_ref, links

## Builder

`chat_ai.core.artifacts.ArtifactBuilder.from_tool_results` / `from_content_blocks` / `from_status_brief`.

## API

- `chat_ai.api.platform.chat_artifacts(session)`  
- `chat_ai.api.platform.get_artifact(name)`  

Desk sidebar: Artifacts panel (▣). Settings: `enable_artifact_store`.
