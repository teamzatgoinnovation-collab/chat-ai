"""Load chat_ai_plugins hooks and built-in commands."""

from __future__ import annotations

import frappe

from chat_ai.plugin.api import register_commands


def load_all():
	_register_builtin_commands()
	hooks = frappe.get_hooks("chat_ai_plugins") or []
	for path in hooks:
		try:
			fn = frappe.get_attr(path)
			fn()
		except Exception:
			frappe.log_error(title=f"chat_ai plugin {path}")

	# Legacy hooks
	for key, attr in (
		("chat_ai_skills", None),
		("chat_ai_tools", None),
		("chat_ai_providers", None),
	):
		for path in frappe.get_hooks(key) or []:
			try:
				fn = frappe.get_attr(path)
				if callable(fn):
					fn()
			except Exception:
				frappe.log_error(title=f"chat_ai legacy hook {path}")


def _register_builtin_commands():
	register_commands(
		[
			{"name": "task", "label": "Tasks", "description": "Find or create tasks", "skill": "projects", "required_doctypes": ["Task"]},
			{"name": "project", "label": "Projects", "description": "Projects", "skill": "projects", "required_doctypes": ["Project"]},
			{"name": "customer", "label": "Customers", "description": "Customers", "skill": "crm", "required_doctypes": ["Customer"]},
			{"name": "invoice", "label": "Invoices", "description": "Invoices", "skill": "accounts", "required_doctypes": ["Sales Invoice"]},
			{"name": "stock", "label": "Stock", "description": "Stock / items", "skill": "inventory", "required_doctypes": ["Item"]},
			{"name": "help", "label": "Help", "description": "Show commands", "run_on_select": True},
		]
	)
