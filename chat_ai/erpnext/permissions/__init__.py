"""Permission helpers — always use Frappe APIs as session user."""

from __future__ import annotations

import frappe


def can_read(doctype: str, name: str | None = None) -> bool:
	if name:
		return bool(frappe.has_permission(doctype, "read", doc=name))
	return bool(frappe.has_permission(doctype, "read"))


def can_write(doctype: str, name: str | None = None) -> bool:
	if name:
		return bool(frappe.has_permission(doctype, "write", doc=name))
	return bool(frappe.has_permission(doctype, "write"))


def can_create(doctype: str) -> bool:
	return bool(frappe.has_permission(doctype, "create"))


def can_submit(doctype: str, name: str | None = None) -> bool:
	if name:
		return bool(frappe.has_permission(doctype, "submit", doc=name))
	return bool(frappe.has_permission(doctype, "submit"))


def require(doctype: str, ptype: str = "read", name: str | None = None):
	ok = frappe.has_permission(doctype, ptype, doc=name) if name else frappe.has_permission(doctype, ptype)
	if not ok:
		raise PermissionError(f"Not permitted to {ptype} {doctype}" + (f" {name}" if name else ""))


def filter_readable(doctype: str, names: list[str]) -> list[str]:
	return [n for n in names if can_read(doctype, n)]
