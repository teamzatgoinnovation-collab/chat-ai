"""Tool router — category gate, confirmation, execute via source handlers."""

from __future__ import annotations

import time
from typing import Any, Callable

from chat_ai.core.agent_limits import AgentLimits
from chat_ai.core.tool_router.spec import (
	CATEGORY_READ,
	ConfirmationPolicy,
	ToolResult,
	ToolSpec,
)


class ToolRouter:
	def __init__(
		self,
		tools: list[ToolSpec],
		*,
		policy: ConfirmationPolicy | None = None,
		limits: AgentLimits | None = None,
		progress: Callable[[str, str], None] | None = None,
	):
		self.tools = {t.name: t for t in tools}
		self.policy = policy or ConfirmationPolicy()
		self.limits = limits or AgentLimits()
		self.progress = progress or (lambda stage, detail="": None)
		self._calls = 0

	def list_openai_tools(self) -> list[dict]:
		out = []
		for t in self.tools.values():
			if not self.policy.category_allowed(t.category):
				continue
			out.append(t.to_openai_tool())
			if len(out) >= self.limits.max_tools_per_request:
				break
		return out

	def get(self, name: str) -> ToolSpec | None:
		return self.tools.get(name)

	def run(self, name: str, args: dict | None = None, *, confirmed: bool = False) -> ToolResult:
		args = args or {}
		tool = self.tools.get(name)
		if not tool:
			return ToolResult(ok=False, error=f"Unknown tool: {name}")
		if not self.policy.category_allowed(tool.category):
			return ToolResult(
				ok=False,
				error=f"Tool category '{tool.category}' is not allowed",
				permission_ok=False,
			)
		if self._calls >= self.limits.max_tool_calls:
			return ToolResult(ok=False, error="Max tool calls exceeded")

		if self.policy.needs_confirmation(tool, args) and not confirmed:
			msg = _confirmation_message(tool, args)
			return ToolResult(ok=False, needs_confirmation=True, confirmation_message=msg, data=args)

		stage = _progress_stage(tool)
		self.progress(stage, tool.name)
		start = time.time()
		self._calls += 1
		try:
			if not tool.handler:
				return ToolResult(ok=False, error="Tool has no handler", latency_ms=_ms(start))
			data = _invoke(tool.handler, args)
			return ToolResult(ok=True, data=data, latency_ms=_ms(start))
		except PermissionError as exc:
			return ToolResult(ok=False, error=str(exc), permission_ok=False, latency_ms=_ms(start))
		except Exception as exc:
			return ToolResult(ok=False, error=str(exc), latency_ms=_ms(start))


def _ms(start: float) -> int:
	return int((time.time() - start) * 1000)


def _invoke(fn: Callable, args: dict):
	try:
		import inspect

		sig = inspect.signature(fn)
		params = sig.parameters
		if not params:
			return fn()
		if any(p.kind == p.VAR_KEYWORD for p in params.values()):
			return fn(**args)
		kwargs = {k: v for k, v in args.items() if k in params}
		# positional-only single "args" bag
		if len(params) == 1:
			name = next(iter(params))
			p = params[name]
			if p.kind in (p.POSITIONAL_ONLY, p.POSITIONAL_OR_KEYWORD) and name not in args:
				return fn(args)
		return fn(**kwargs)
	except TypeError:
		try:
			return fn(**args)
		except TypeError:
			return fn(args)
	except Exception:
		return fn(**args)


def _confirmation_message(tool: ToolSpec, args: dict) -> str:
	doctype = args.get("doctype") or (tool.supported_doctypes[0] if tool.supported_doctypes else "document")
	name = args.get("name") or args.get("title") or ""
	target = f"{doctype} {name}".strip()
	return f"This action will run `{tool.name}` on {target or 'the selected document'}. Continue?"


def _progress_stage(tool: ToolSpec) -> str:
	n = tool.name.lower()
	if "search" in n:
		return "searching"
	if any(x in n for x in ("approve", "reject", "workflow")):
		return "running_workflow"
	if any(x in n for x in ("report", "summary", "analytics")):
		return "generating_report"
	if tool.category == "write" and any(x in n for x in ("create", "insert")):
		return "creating_document"
	return "reading_erp"
