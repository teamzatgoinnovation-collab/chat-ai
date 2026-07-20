"""Main chat orchestration — Planner → Skill Router → Tool Router → Response Builder."""

from __future__ import annotations

import json
import time
from pathlib import Path

import frappe
from frappe.utils import now_datetime

from chat_ai.core.agent_limits import AgentLimits
from chat_ai.core.memory import ConversationMemory
from chat_ai.core.planner import plan as run_planner
from chat_ai.core.providers.base import LLMMessage
from chat_ai.core.providers.registry import ProviderRegistry
from chat_ai.core.response import AssistantResponse, build_from_tool_results, clarification, confirmation
from chat_ai.core.skills import clear_skills, discover, list_skills
from chat_ai.core.tool_router import ToolRouter
from chat_ai.core.tool_router.spec import ConfirmationPolicy, ToolSpec
from chat_ai.erpnext.context import build_context_stack
from chat_ai.erpnext.events.realtime_events import publish_progress, publish_stream
from chat_ai.erpnext.settings import get_settings_dict


def _skills_root() -> str:
	return str(Path(__file__).resolve().parent / "skills")


def load_skills():
	clear_skills()
	return discover(
		[_skills_root()],
		doctype_exists=lambda d: bool(frappe.db.exists("DocType", d)),
		app_installed=lambda a: a in frappe.get_installed_apps(),
	)


def get_prompt_text(settings: dict, skill_prompts: list[str] | None = None) -> str:
	from chat_ai.core.i18n import language_prompt

	version = settings.get("prompt_bundle_version") or "v1"
	base = Path(__file__).resolve().parents[1] / "core" / "prompts" / version / "assistant.md"
	if not base.exists():
		base = Path(__file__).resolve().parents[1] / "core" / "prompts" / "v1" / "assistant.md"
	text = base.read_text() if base.exists() else "You are an ERPNext AI Assistant."
	mode = settings.get("_assistant_mode") or settings.get("default_assistant_mode") or "ERP Assistant"
	text += f"\n\nActive assistant mode: {mode}."
	lang = settings.get("_language") or settings.get("default_language") or "en"
	text += "\n\n" + language_prompt(lang)
	for p in skill_prompts or []:
		if p:
			text += "\n\n" + p
	return text


def collect_tools(skill_names: list[str] | None = None) -> list[ToolSpec]:
	skills = list_skills()
	if not skills:
		load_skills()
		skills = list_skills()
	wanted = set(skill_names or [s.name for s in skills])
	# Always include core
	wanted.add("core")
	tools: list[ToolSpec] = []
	for s in skills:
		if s.name not in wanted:
			continue
		tools.extend(s.tools or [])
	try:
		from chat_ai.plugin.api import get_registered_tools

		tools.extend(get_registered_tools())
	except Exception:
		pass
	# dedupe by name
	by_name = {t.name: t for t in tools}
	return list(by_name.values())


def run_turn(
	*,
	session_name: str,
	user_message: str,
	client_context: dict | None = None,
	command: str | None = None,
	confirmed: bool = False,
	pending_tool: str | None = None,
	pending_args: dict | None = None,
) -> dict:
	settings = get_settings_dict()
	session = frappe.get_doc("AI Chat Session", session_name)
	if session.user != frappe.session.user and "System Manager" not in frappe.get_roles():
		frappe.throw("Not permitted", frappe.PermissionError)

	from chat_ai.core.i18n import normalize_language

	settings["_assistant_mode"] = session.assistant_mode
	settings["_language"] = normalize_language(
		getattr(session, "language", None) or settings.get("default_language") or "en"
	)
	limits = AgentLimits.from_settings(settings)
	policy = ConfirmationPolicy.from_settings(settings)

	# Load memory
	memory = _load_memory(session_name)
	context = build_context_stack(client_context, memory.entities)
	load_skills()
	available = [s.name for s in list_skills()]

	# Command hint
	msg = user_message
	if command:
		msg = f"/{command} {user_message}".strip()
		# bias skill from command
		cmd_skill = {
			"task": "projects",
			"project": "projects",
			"customer": "crm",
			"invoice": "accounts",
			"stock": "inventory",
		}.get(command)
		if cmd_skill and cmd_skill in available:
			candidate_override = [cmd_skill, "core"]
		else:
			candidate_override = None
	else:
		candidate_override = None

	publish_progress(session_name, "planning")

	# Confirmation resume path
	if confirmed and pending_tool:
		tools = collect_tools(available)
		router = ToolRouter(tools, policy=policy, limits=limits, progress=lambda s, d="": publish_progress(session_name, s, d))
		result = router.run(pending_tool, pending_args or {}, confirmed=True)
		_log_tool(session_name, pending_tool, pending_args or {}, result)
		resp = build_from_tool_results([{"ok": result.ok, "tool": pending_tool, "data": result.data, "error": result.error}])
		return _persist(session, memory, user_message, resp, settings, tokens=(0, 0))

	provider = ProviderRegistry.get_active(settings)
	neg = ProviderRegistry.requires(provider, "chat")
	if not neg.ok:
		resp = AssistantResponse(markdown="Configured LLM provider cannot chat. Check Chat AI Settings.")
		return _persist(session, memory, user_message, resp, settings, tokens=(0, 0), error=True)

	skill_prompts = []
	history = memory.window(int(settings.get("max_history_length") or 40))
	plan = run_planner(
		provider,
		user_message=msg,
		system_prompt=get_prompt_text(settings),
		context=context,
		history=history,
		available_skills=available,
	)

	if plan.needs_clarification:
		resp = clarification(plan.clarification_question or "Could you provide more details?")
		return _persist(session, memory, user_message, resp, settings, tokens=(plan.tokens_in, plan.tokens_out), model=plan.model)

	candidates = candidate_override or plan.candidate_skills or ["core"]
	skills = [s for s in list_skills() if s.name in candidates]
	for s in skills:
		if s.prompt:
			skill_prompts.append(s.prompt)

	publish_progress(session_name, "routing")
	tools = collect_tools(candidates)
	router = ToolRouter(tools, policy=policy, limits=limits, progress=lambda s, d="": publish_progress(session_name, s, d))

	# If tool calling disabled or unsupported — respond with plan intent only / search
	if not settings.get("enable_tool_calling", 1) or not provider.capabilities.tool_calling:
		# Try a single search if query-like
		if "search" in router.tools:
			sr = router.run("search", {"query": user_message}, confirmed=True)
			resp = build_from_tool_results([{"ok": sr.ok, "tool": "search", "data": sr.data, "error": sr.error}])
		else:
			resp = AssistantResponse(markdown=plan.raw_content or f"Intent: {plan.intent}")
		return _persist(session, memory, user_message, resp, settings, tokens=(plan.tokens_in, plan.tokens_out), model=plan.model)

	openai_tools = router.list_openai_tools()
	messages = [
		LLMMessage(role="system", content=get_prompt_text(settings, skill_prompts)),
		LLMMessage(role="system", content="Context:\n" + json.dumps(context, default=str)[:6000]),
	]
	for h in history[-10:]:
		messages.append(LLMMessage(role=h["role"], content=h["content"]))
	messages.append(LLMMessage(role="user", content=msg))

	tool_results = []
	total_in, total_out = plan.tokens_in, plan.tokens_out
	rounds = 0
	while rounds < limits.max_tool_rounds:
		rounds += 1
		result = provider.chat(messages, tools=openai_tools or None)
		total_in += result.tokens_in
		total_out += result.tokens_out
		if settings.get("enable_streaming", 1) and result.content:
			publish_stream(session_name, result.content, done=False)

		if not result.tool_calls:
			resp = AssistantResponse(markdown=result.content or "Done.")
			publish_progress(session_name, "done")
			publish_stream(session_name, "", done=True)
			return _persist(session, memory, user_message, resp, settings, tokens=(total_in, total_out), model=result.model)

		messages.append(
			LLMMessage(role="assistant", content=result.content or "", tool_calls=result.tool_calls)
		)
		for tc in result.tool_calls:
			fn = (tc.get("function") or {})
			name = fn.get("name") or tc.get("name")
			raw_args = fn.get("arguments") or "{}"
			try:
				args = json.loads(raw_args) if isinstance(raw_args, str) else (raw_args or {})
			except json.JSONDecodeError:
				args = {}
			tr = router.run(name, args, confirmed=False)
			_log_tool(session_name, name, args, tr)
			if tr.needs_confirmation:
				resp = confirmation(tr.confirmation_message, name, args)
				publish_progress(session_name, "done")
				return _persist(session, memory, user_message, resp, settings, tokens=(total_in, total_out), model=result.model)
			tool_results.append({"ok": tr.ok, "tool": name, "data": tr.data, "error": tr.error})
			if tr.ok:
				memory.update_entities_from_tool(name, tr.data)
			messages.append(
				LLMMessage(
					role="tool",
					content=json.dumps({"ok": tr.ok, "data": tr.data, "error": tr.error}, default=str)[:8000],
					tool_call_id=tc.get("id"),
					name=name,
				)
			)

	# After loop — build from last tool results
	resp = build_from_tool_results(tool_results, preface="Here is what I found:")
	publish_progress(session_name, "done")
	publish_stream(session_name, resp.markdown, done=True)
	return _persist(session, memory, user_message, resp, settings, tokens=(total_in, total_out))


def _load_memory(session_name: str) -> ConversationMemory:
	mem = ConversationMemory()
	msgs = frappe.get_all(
		"AI Chat Message",
		filters={"session": session_name},
		fields=["role", "content"],
		order_by="creation asc",
		limit_page_length=100,
	)
	for m in msgs:
		mem.add(m.role, m.content or "")
	row = frappe.db.get_value("AI Chat Memory", {"session": session_name}, ["name", "entities_json"], as_dict=True)
	if row and row.entities_json:
		try:
			mem.entities = json.loads(row.entities_json)
		except Exception:
			pass
	return mem


def _persist(session, memory, user_message, resp: AssistantResponse, settings, tokens=(0, 0), model="", error=False):
	start = time.time()
	# user message
	frappe.get_doc(
		{
			"doctype": "AI Chat Message",
			"session": session.name,
			"role": "user",
			"content": user_message,
		}
	).insert(ignore_permissions=True)

	cost = _cost(settings, tokens[0], tokens[1])
	assistant = frappe.get_doc(
		{
			"doctype": "AI Chat Message",
			"session": session.name,
			"role": "assistant",
			"content": resp.markdown,
			"content_json": frappe.as_json(resp.to_content_json()),
			"model": model,
			"provider": settings.get("provider"),
			"prompt_version": settings.get("prompt_bundle_version") or "v1",
			"tokens_in": tokens[0],
			"tokens_out": tokens[1],
			"latency_ms": int((time.time() - start) * 1000),
			"cost_estimate": cost,
			"error": "1" if error else "",
		}
	)
	assistant.insert(ignore_permissions=True)

	session.last_message_at = now_datetime()
	if not session.title or session.title == "New chat":
		session.title = (user_message or "Chat")[:60]
	session.save(ignore_permissions=True)

	_save_memory(session.name, memory)
	_record_usage(settings, tokens, cost, error=error, latency=assistant.latency_ms)

	return {
		"session": session.name,
		"message": assistant.name,
		"content": resp.markdown,
		"content_json": resp.to_content_json(),
		"needs_confirmation": resp.needs_confirmation,
		"confirmation_message": resp.confirmation_message,
		"pending_tool": resp.pending_tool,
		"pending_args": resp.pending_args,
	}


def _save_memory(session_name: str, memory: ConversationMemory):
	existing = frappe.db.get_value("AI Chat Memory", {"session": session_name}, "name")
	payload = {
		"entities_json": frappe.as_json(memory.entities),
		"user": frappe.session.user,
		"session": session_name,
	}
	if existing:
		doc = frappe.get_doc("AI Chat Memory", existing)
		doc.update(payload)
		doc.save(ignore_permissions=True)
	else:
		frappe.get_doc({"doctype": "AI Chat Memory", **payload}).insert(ignore_permissions=True)


def _log_tool(session_name, name, args, result):
	try:
		if not frappe.db.get_single_value("Chat AI Settings", "enable_audit_logs"):
			return
		tool = None
		# category unknown here — store args
		frappe.get_doc(
			{
				"doctype": "AI Tool Log",
				"session": session_name,
				"user": frappe.session.user,
				"tool_name": name,
				"source": "python",
				"args_json": frappe.as_json(args),
				"result_json": frappe.as_json({"data": result.data, "error": result.error}),
				"permission_ok": 1 if result.permission_ok else 0,
				"success": 1 if result.ok else 0,
				"error": result.error,
				"latency_ms": result.latency_ms,
			}
		).insert(ignore_permissions=True)
	except Exception:
		pass


def _cost(settings, tin, tout) -> float:
	pi = float(settings.get("token_price_input") or 0)
	po = float(settings.get("token_price_output") or 0)
	return (tin / 1_000_000.0) * pi + (tout / 1_000_000.0) * po


def _record_usage(settings, tokens, cost, error=False, latency=0):
	try:
		from frappe.utils import today

		user = frappe.session.user
		provider = settings.get("provider")
		model = settings.get("default_model")
		existing = frappe.db.get_value(
			"AI Usage Daily",
			{"usage_date": today(), "user": user, "provider": provider, "model": model},
			"name",
		)
		if existing:
			doc = frappe.get_doc("AI Usage Daily", existing)
			doc.tokens_in = (doc.tokens_in or 0) + tokens[0]
			doc.tokens_out = (doc.tokens_out or 0) + tokens[1]
			doc.cost_estimate = (doc.cost_estimate or 0) + cost
			doc.request_count = (doc.request_count or 0) + 1
			doc.error_count = (doc.error_count or 0) + (1 if error else 0)
			n = doc.request_count
			doc.avg_latency_ms = ((doc.avg_latency_ms or 0) * (n - 1) + latency) / n
			doc.save(ignore_permissions=True)
		else:
			frappe.get_doc(
				{
					"doctype": "AI Usage Daily",
					"usage_date": today(),
					"user": user,
					"provider": provider,
					"model": model,
					"tokens_in": tokens[0],
					"tokens_out": tokens[1],
					"cost_estimate": cost,
					"request_count": 1,
					"error_count": 1 if error else 0,
					"avg_latency_ms": latency,
				}
			).insert(ignore_permissions=True)
	except Exception:
		pass
