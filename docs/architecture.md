# Architecture

`chat_ai` is an **ERPNext AI platform**, not a closed chatbot.

## Package boundaries

```
chat_ai/
  core/       # backend-agnostic: planner, providers, tool_router, skills loader, prompts
  erpnext/    # Frappe/ERPNext only: permissions, metadata, workflows, search, skills, events
  desk/       # (assets under public/) slide-out sidebar
  api/        # whitelisted methods
  plugin/     # Platform SDK
  chat_ai/    # DocTypes + AI Admin workspace
```

**Rule:** `core/` must not import Frappe DocTypes. `erpnext/` and Desk assets may.

## Request pipeline

User → Planner → Skill Router → Tool Router → ERP (or REST/MCP/Plugin/Python) → Response Builder

## Capabilities

LLM providers implement Chat, Embedding, Tool Calling, Streaming, Vision, Reasoning, JSON Output.
Features enable/disable from discovered capabilities.

## Safety

- Tool categories: Read / Write / Admin
- Confirmation policy for submit/cancel/delete/workflow/financial
- Agent loop limits in Chat AI Settings
- Approval Engine for workflow actions
