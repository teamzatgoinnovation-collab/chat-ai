"""Auto-resolve Chat AI assistant mode from Desk context + message intent."""

from __future__ import annotations

from typing import Any

MODE_ERP = "ERP Assistant"
MODE_DOCUMENT = "Document Assistant"
MODE_ANALYTICS = "Analytics Assistant"
MODE_DEVELOPER = "Developer Assistant"
MODE_ADMIN = "Admin Assistant"

_VALID_MODES = frozenset(
	{
		MODE_ERP,
		MODE_DOCUMENT,
		MODE_ANALYTICS,
		MODE_DEVELOPER,
		MODE_ADMIN,
	}
)

_ANALYTICS_KW = (
	"report",
	"summary",
	"chart",
	"analytics",
	"dashboard",
	"kpi",
	"trend",
	"metrics",
	"statistics",
)
_DEVELOPER_KW = (
	"api",
	"doctype meta",
	"get_doctype_meta",
	"hook",
	"whitelist",
	"schema",
	"custom script",
	"client script",
	"server script",
	"frappe.call",
	"rest endpoint",
	"json schema",
)
_ADMIN_KW = (
	"permission",
	"user permission",
	"role profile",
	"role ",
	" roles",
	"workflow settings",
	"system settings",
	"naming series",
	"desktop icon",
	"module def",
)


def normalize_mode(mode: str | None) -> str:
	"""Map legacy / unknown modes to a known assistant mode."""
	m = (mode or "").strip()
	if m == "Normal Chat" or not m:
		return MODE_ERP
	if m in _VALID_MODES:
		return m
	return MODE_ERP


def resolve_assistant_mode(
	client_context: dict | None = None,
	user_message: str | None = None,
	session_mode: str | None = None,
) -> str:
	"""
	Decide assistant mode for this turn.

	Priority:
	1. Form / current document context → Document Assistant
	2. Analytics keywords (or List + analytics intent) → Analytics Assistant
	3. Developer keywords → Developer Assistant
	4. Admin/permissions keywords → Admin Assistant
	5. Else → ERP Assistant
	"""
	ctx = client_context or {}
	msg = (user_message or "").strip().lower()

	if _has_form_context(ctx):
		return MODE_DOCUMENT

	if _has_any(msg, _ANALYTICS_KW):
		return MODE_ANALYTICS
	if _is_list_route(ctx) and _has_any(msg, ("count", "total", "how many", "filter", "status")):
		return MODE_ANALYTICS

	if _has_any(msg, _DEVELOPER_KW):
		return MODE_DEVELOPER

	if _has_any(msg, _ADMIN_KW):
		return MODE_ADMIN

	_ = session_mode
	return MODE_ERP


def _has_form_context(ctx: dict[str, Any]) -> bool:
	form = ctx.get("form") or ctx.get("current_form") or {}
	if isinstance(form, dict) and (form.get("doctype") or form.get("name")):
		return True
	route = ctx.get("route") or {}
	path = route.get("path") if isinstance(route, dict) else route
	if isinstance(path, (list, tuple)) and len(path) >= 1:
		if str(path[0]).lower() == "form":
			return True
	if isinstance(path, str) and path.lower().startswith("form"):
		return True
	return False


def _is_list_route(ctx: dict[str, Any]) -> bool:
	route = ctx.get("route") or {}
	path = route.get("path") if isinstance(route, dict) else route
	if isinstance(path, (list, tuple)) and path:
		return str(path[0]).lower() == "list"
	ws = ctx.get("workspace") or {}
	return bool(isinstance(ws, dict) and ws.get("doctype") and not ws.get("name"))


def _has_any(text: str, keywords: tuple[str, ...]) -> bool:
	if not text:
		return False
	return any(k in text for k in keywords)
