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
- **Prompt bundle v3** (default): concise ERP consultant behavior, intelligent defaults, plan-before-change
- **Tiered confirmation:** low-risk single creates (e.g. Task) skip confirm; medium/high always confirm
- **Plan approval:** multi-step mutations show numbered plan + OK/Cancel before tools run
- **Confirmation tokens:** server-side cache tokens; client cannot forge `confirmed=1` alone
- Agent loop limits in Chat AI Settings
- Approval Engine for workflow actions

## Intelligent defaults

`erpnext/context/defaults.py` resolves Company, Branch, Warehouse, Currency, Fiscal Year:
user default → single record on site → omit.

Injected into context as `intelligent_defaults` + `assumptions`, merged into tool args via `core/tool_enrichment.py` (never overrides explicit values).

## Decision flow (v3)

1. Planner returns `is_simple_question`, `needs_plan_approval`, `risk_level`, `implementation_plan`
2. Simple questions → direct LLM answer (no tools)
3. Plan required → show plan + token; resume on OK
4. Tool loop with enriched args and risk-tier confirmation
