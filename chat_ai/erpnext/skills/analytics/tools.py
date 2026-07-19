import frappe
from chat_ai.core.tool_router.spec import CATEGORY_READ, ToolSpec

def get_tools():
	return [
		ToolSpec(name="dashboard_summary", description="Count open docs for common types", category=CATEGORY_READ, skill="analytics",
			parameters={"type":"object","properties":{}},
			handler=_summary),
	]

def _summary():
	out = {}
	for dt in ("Task", "Issue", "Sales Invoice", "Project", "Lead"):
		if frappe.db.exists("DocType", dt) and frappe.has_permission(dt, "read"):
			out[dt] = frappe.db.count(dt)
	return out
