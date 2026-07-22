"""Resolve ERPNext intelligent defaults (company, warehouse, etc.)."""

from __future__ import annotations

import frappe

# Shown in chat only when meaningful — not routine company defaults.
_SILENT_ASSUMPTION_LABELS = frozenset({"currency", "fiscal year", "branch", "warehouse"})


def resolve_intelligent_defaults(context: dict | None = None) -> dict:
	"""Return { values: {...}, assumptions: [...] }.

	Currency / Fiscal Year / Branch / Warehouse are applied as values but not
	surfaced as 'Using …' lines in the chat reply.
	"""
	context = context or {}
	values: dict = {}
	assumptions: list[str] = []

	company = _resolve_company(context)
	if company:
		values["company"] = company
		# Only mention Company when it is a clear single default (not every turn noise)
		# Callers that need a spoken company line (e.g. status brief) can read values.

	branch = _resolve_branch(company)
	if branch:
		values["branch"] = branch

	warehouse = _resolve_warehouse(company)
	if warehouse:
		values["warehouse"] = warehouse

	if company:
		currency = frappe.db.get_value("Company", company, "default_currency")
		if currency:
			values["currency"] = currency

		fy = _resolve_fiscal_year(company)
		if fy:
			values["fiscal_year"] = fy

	return {"values": values, "assumptions": assumptions}


def filter_user_visible_assumptions(assumptions: list[str] | None) -> list[str]:
	"""Drop routine default lines (Currency, Fiscal Year, etc.) from chat text."""
	out = []
	for a in assumptions or []:
		s = str(a or "").strip()
		if not s:
			continue
		low = s.lower()
		if low.startswith("using currency:") or " (company default)" in low:
			continue
		if low.startswith("using fiscal year:") or " (active)." in low and "fiscal" in low:
			continue
		if any(low.startswith(f"using {label}:") for label in _SILENT_ASSUMPTION_LABELS):
			continue
		out.append(s)
	return out


def _assumption(label: str, value: str, reason: str = "") -> str:
	if reason:
		return f"Using {label}: {value} ({reason})."
	return f"Using {label}: {value}."


def _resolve_company(context: dict) -> str | None:
	ctx_company = (context.get("current_company") or {}).get("company")
	if ctx_company:
		return ctx_company
	user_default = frappe.defaults.get_user_default("Company")
	if user_default:
		return user_default
	companies = frappe.get_all("Company", filters={"disabled": 0}, pluck="name", limit=2)
	if len(companies) == 1:
		return companies[0]
	return None


def _resolve_branch(company: str | None) -> str | None:
	if not company or not frappe.db.exists("DocType", "Branch"):
		return None
	user_default = frappe.defaults.get_user_default("Branch")
	if user_default:
		return user_default
	branches = frappe.get_all("Branch", pluck="name", limit=2)
	if len(branches) == 1:
		return branches[0]
	return None


def _resolve_warehouse(company: str | None) -> str | None:
	if not company or not frappe.db.exists("DocType", "Warehouse"):
		return None
	user_default = frappe.defaults.get_user_default("Warehouse")
	if user_default:
		return user_default
	# Company default warehouse
	if frappe.db.has_column("Company", "default_warehouse"):
		wh = frappe.db.get_value("Company", company, "default_warehouse")
		if wh:
			return wh
	warehouses = frappe.get_all(
		"Warehouse",
		filters={"company": company, "is_group": 0, "disabled": 0},
		pluck="name",
		limit=2,
	)
	if len(warehouses) == 1:
		return warehouses[0]
	return None


def _resolve_fiscal_year(company: str | None) -> str | None:
	if not company or not frappe.db.exists("DocType", "Fiscal Year"):
		return None
	try:
		from erpnext.accounts.utils import get_fiscal_year

		fy = get_fiscal_year(frappe.utils.today(), company=company)
		if fy and fy[0]:
			return fy[0]
	except Exception:
		pass
	rows = frappe.get_all("Fiscal Year", filters={"disabled": 0}, pluck="name", limit=1)
	return rows[0] if rows else None
