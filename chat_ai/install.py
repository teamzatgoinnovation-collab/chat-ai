"""Install / migrate hooks for chat_ai."""

from __future__ import annotations

import os
import shutil

import frappe


def after_install():
	_ensure_module_map()
	_ensure_roles()
	_ensure_settings()
	_sync_public_assets()
	_load_plugins()


def after_migrate():
	_ensure_module_map()
	_ensure_roles()
	_ensure_settings()
	_sync_public_assets()
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


def _sync_public_assets():
	"""Copy sidebar JS/CSS into bench assets paths.

	On frappe_docker the frontend container often has no apps/ mount, so a
	symlink from sites/assets → apps/... 404s. Keep a real copy under
	sites/chat_ai_assets (shared volume) and assets/chat_ai when writable.
	Frontend nginx may still need: cp -a sites/chat_ai_assets/. assets/chat_ai/
	"""
	try:
		src = frappe.get_app_path("chat_ai", "public")
		if not os.path.isdir(src):
			return
		sites = frappe.utils.get_site_path("..")
		# shared volume friendly copy (parent of site dir = sites/)
		durable = os.path.abspath(os.path.join(sites, "chat_ai_assets"))
		_copy_tree(src, durable)
		bench_assets = os.path.abspath(os.path.join(sites, "..", "assets", "chat_ai"))
		_copy_tree(src, bench_assets)
	except Exception:
		frappe.log_error(title="chat_ai asset sync")


def _copy_tree(src: str, dest: str) -> None:
	os.makedirs(dest, exist_ok=True)
	for name in ("js", "css"):
		s = os.path.join(src, name)
		d = os.path.join(dest, name)
		if not os.path.isdir(s):
			continue
		os.makedirs(d, exist_ok=True)
		for fname in os.listdir(s):
			sf = os.path.join(s, fname)
			df = os.path.join(d, fname)
			if os.path.isfile(sf):
				shutil.copy2(sf, df)
