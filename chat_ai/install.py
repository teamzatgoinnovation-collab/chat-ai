"""Install / migrate hooks for chat_ai — maximize self-heal, minimize manual ops."""

from __future__ import annotations

import os
import shutil

import frappe


def after_install():
	_bootstrap()


def after_migrate():
	_bootstrap()


def has_app_permission():
	"""Shown on Apps screen for System Manager / Chat AI Manager."""
	return bool(
		frappe.db.exists("Module Def", "Chat AI")
		and (
			"System Manager" in frappe.get_roles()
			or "Chat AI Manager" in frappe.get_roles()
			or "Chat AI User" in frappe.get_roles()
		)
	)


def _bootstrap():
	_ensure_module_map()
	_ensure_module_def()
	_ensure_roles()
	_ensure_admin_roles()
	_ensure_settings()
	_sanitize_provider_settings()
	_ensure_desk_entry()
	_sync_public_assets()
	_load_plugins()
	try:
		frappe.clear_cache()
	except Exception:
		frappe.log_error(title="chat_ai clear_cache")


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


def _ensure_module_def():
	if frappe.db.exists("Module Def", "Chat AI"):
		doc = frappe.get_doc("Module Def", "Chat AI")
		if doc.app_name != "chat_ai":
			doc.app_name = "chat_ai"
			doc.save(ignore_permissions=True)
		return
	frappe.get_doc(
		{
			"doctype": "Module Def",
			"module_name": "Chat AI",
			"app_name": "chat_ai",
		}
	).insert(ignore_permissions=True)


def _ensure_roles():
	for role in ("Chat AI User", "Chat AI Manager"):
		if not frappe.db.exists("Role", role):
			doc = frappe.get_doc({"doctype": "Role", "role_name": role, "desk_access": 1})
			doc.insert(ignore_permissions=True)


def _ensure_admin_roles():
	"""Give Administrator both Chat AI roles so Desk works without manual assignment."""
	if not frappe.db.exists("User", "Administrator"):
		return
	user = frappe.get_doc("User", "Administrator")
	existing = {r.role for r in user.roles}
	changed = False
	for role in ("Chat AI User", "Chat AI Manager"):
		if role not in existing:
			user.append("roles", {"role": role})
			changed = True
	if changed:
		user.save(ignore_permissions=True)


def _ensure_settings():
	if not frappe.db.exists("DocType", "Chat AI Settings"):
		return
	try:
		doc = frappe.get_single("Chat AI Settings")
		# Touch defaults if brand-new empty single
		if not doc.provider:
			doc.provider = "OpenAI"
		if not doc.default_model:
			doc.default_model = "gpt-4o"
		if not getattr(doc, "default_language", None):
			doc.default_language = "en"
		if not getattr(doc, "prompt_bundle_version", None):
			doc.prompt_bundle_version = "v3"
		# Check fields migrate as 0; turn voice on once unless already bootstrapped
		if not frappe.db.get_global("chat_ai_voice_bootstrapped"):
			doc.enable_voice_input = 1
			doc.enable_voice_output = 1
			frappe.db.set_global("chat_ai_voice_bootstrapped", "1")
		doc.save(ignore_permissions=True)
	except Exception:
		frappe.log_error(title="chat_ai ensure settings")


def _sanitize_provider_settings():
	"""Fix common misconfigs left from older installs / Custom→localhost."""
	if not frappe.db.exists("DocType", "Chat AI Settings"):
		return
	try:
		doc = frappe.get_single("Chat AI Settings")
		key = ""
		try:
			key = doc.get_password("api_key") or ""
		except Exception:
			key = ""
		endpoint = (doc.api_endpoint or "").strip()
		provider = doc.provider or ""
		changed = False

		if key.startswith("sk-or-") and provider != "OpenRouter":
			doc.provider = "OpenRouter"
			changed = True
			provider = "OpenRouter"

		if provider == "OpenRouter":
			if not endpoint or "127.0.0.1" in endpoint or "localhost" in endpoint:
				doc.api_endpoint = ""
				changed = True
			if not (doc.default_model or "").strip():
				doc.default_model = "openrouter/auto"
				changed = True

		if provider == "Custom OpenAI-compatible" and (
			not endpoint or "127.0.0.1" in endpoint or "localhost" in endpoint
		):
			# Avoid silent Connection refused to local dummy port
			doc.api_endpoint = ""
			if key.startswith("sk-or-"):
				doc.provider = "OpenRouter"
				doc.default_model = doc.default_model or "openrouter/auto"
			changed = True

		if changed:
			doc.save(ignore_permissions=True)
	except Exception:
		frappe.log_error(title="chat_ai sanitize provider")


def _ensure_desk_entry():
	"""Ensure Module Def, Workspace Sidebar app field, and Desktop Icon for AI Admin."""
	try:
		# Workspace Sidebar created from workspace sync — pin app name
		if frappe.db.exists("Workspace Sidebar", "AI Admin"):
			sb = frappe.get_doc("Workspace Sidebar", "AI Admin")
			if sb.app != "chat_ai":
				sb.app = "chat_ai"
				sb.save(ignore_permissions=True)

		# Desktop Icon → Workspace Sidebar AI Admin
		label = "AI Admin"
		existing = frappe.db.get_value("Desktop Icon", {"label": label}, "name")
		if existing:
			icon = frappe.get_doc("Desktop Icon", existing)
			dirty = False
			if icon.app != "chat_ai":
				icon.app = "chat_ai"
				dirty = True
			if icon.link_type != "Workspace Sidebar":
				icon.link_type = "Workspace Sidebar"
				dirty = True
			if icon.link_to != "AI Admin":
				icon.link_to = "AI Admin"
				dirty = True
			if icon.hidden:
				icon.hidden = 0
				dirty = True
			if dirty:
				icon.save(ignore_permissions=True)
		else:
			frappe.get_doc(
				{
					"doctype": "Desktop Icon",
					"label": label,
					"app": "chat_ai",
					"icon_type": "link",
					"link_type": "Workspace Sidebar",
					"link_to": "AI Admin",
					"icon": "solid-color",
					"standard": 1,
					"hidden": 0,
				}
			).insert(ignore_permissions=True)
	except Exception:
		frappe.log_error(title="chat_ai desk entry")


def _load_plugins():
	try:
		from chat_ai.plugin.loader import load_all

		load_all()
	except Exception:
		frappe.log_error(title="chat_ai plugin load")


def _sync_public_assets():
	"""Copy sidebar JS/CSS into bench assets paths.

	Writes:
	- sites/chat_ai_assets/ (shared sites volume — durable)
	- assets/chat_ai/ when writable (backend local assets)

	On frappe_docker, also run deploy/sync_frontend_assets.sh (or the one-liner
	in docs) so the frontend container nginx can serve /assets/chat_ai/*.
	"""
	try:
		src = frappe.get_app_path("chat_ai", "public")
		if not os.path.isdir(src):
			return
		sites = frappe.utils.get_site_path("..")
		durable = os.path.abspath(os.path.join(sites, "chat_ai_assets"))
		_copy_tree(src, durable)
		bench_assets = os.path.abspath(os.path.join(sites, "..", "assets", "chat_ai"))
		_copy_tree(src, bench_assets)
		# Prefer real files under sites/assets/chat_ai when sites/assets is a real dir
		sites_assets = os.path.abspath(os.path.join(sites, "assets"))
		if os.path.isdir(sites_assets) and not os.path.islink(sites_assets):
			_copy_tree(src, os.path.join(sites_assets, "chat_ai"))
	except Exception:
		frappe.log_error(title="chat_ai asset sync")


def _copy_tree(src: str, dest: str) -> None:
	os.makedirs(dest, exist_ok=True)
	for name in ("js", "css", "images"):
		s = os.path.join(src, name)
		d = os.path.join(dest, name)
		if not os.path.isdir(s):
			continue
		shutil.copytree(s, d, dirs_exist_ok=True)
