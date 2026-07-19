"""Install / migrate hooks for chat_ai."""

import frappe


def after_install():
	_ensure_module_map()
	_ensure_roles()
	_ensure_settings()
	_load_plugins()


def after_migrate():
	_ensure_module_map()
	_ensure_roles()
	_ensure_settings()
	_load_plugins()


def _ensure_module_map():
	"""Invalidate cached app/module maps so Chat AI resolves after install."""
	try:
		frappe.cache.delete_value("app_modules")
		frappe.cache.delete_value("all_apps")
		try:
			frappe.client_cache.delete_value("installed_app_modules")
		except Exception:
			pass
		frappe.setup_module_map(include_all_apps=True)
	except Exception:
		frappe.log_error(title="chat_ai module map refresh")


def _ensure_roles():
	for role in ("Chat AI User", "Chat AI Manager"):
		if not frappe.db.exists("Role", role):
			doc = frappe.get_doc({"doctype": "Role", "role_name": role, "desk_access": 1})
			doc.insert(ignore_permissions=True)


def _ensure_settings():
	if not frappe.db.exists("DocType", "Chat AI Settings"):
		return
	try:
		frappe.get_single("Chat AI Settings")
	except Exception:
		pass


def _load_plugins():
	try:
		from chat_ai.plugin.loader import load_all

		load_all()
	except Exception:
		frappe.log_error(title="chat_ai plugin load")
