"""Planner — produce structured plan from user intent + context."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

from chat_ai.core.providers.base import LLMMessage, LLMProvider, LLMResult


@dataclass
class Plan:
	intent: str = ""
	slots: dict[str, Any] = field(default_factory=dict)
	needs_clarification: bool = False
	clarification_question: str = ""
	candidate_skills: list[str] = field(default_factory=list)
	raw_content: str = ""
	tokens_in: int = 0
	tokens_out: int = 0
	model: str = ""


PLAN_SCHEMA_HINT = """
Respond with JSON only:
{
  "intent": "short intent label",
  "slots": {},
  "needs_clarification": false,
  "clarification_question": "",
  "candidate_skills": ["core"]
}
Never invent ERPNext document names or IDs. If required slots are missing, set needs_clarification true.
"""


def plan(
	provider: LLMProvider,
	*,
	user_message: str,
	system_prompt: str,
	context: dict | None = None,
	history: list[dict] | None = None,
	available_skills: list[str] | None = None,
) -> Plan:
	messages: list[LLMMessage] = [
		LLMMessage(role="system", content=system_prompt + "\n\n" + PLAN_SCHEMA_HINT),
	]
	if context:
		messages.append(
			LLMMessage(
				role="system",
				content="Context stack (JSON):\n" + json.dumps(context, default=str)[:8000],
			)
		)
	if available_skills:
		messages.append(
			LLMMessage(
				role="system",
				content="Available skills: " + ", ".join(available_skills),
			)
		)
	for h in history or []:
		messages.append(LLMMessage(role=h.get("role") or "user", content=h.get("content") or ""))
	messages.append(LLMMessage(role="user", content=user_message))

	use_json = provider.capabilities.json_output
	result: LLMResult = provider.chat(messages, response_format="json" if use_json else None)
	parsed = _parse_plan(result.content, available_skills or ["core"])
	parsed.raw_content = result.content or ""
	parsed.tokens_in = result.tokens_in
	parsed.tokens_out = result.tokens_out
	parsed.model = result.model
	return parsed


def _parse_plan(content: str, skills: list[str]) -> Plan:
	data = {}
	text = (content or "").strip()
	try:
		data = json.loads(text)
	except json.JSONDecodeError:
		m = re.search(r"\\{[\\s\\S]*\\}", text)
		if m:
			try:
				data = json.loads(m.group(0))
			except json.JSONDecodeError:
				data = {}
	if not data:
		# Heuristic fallback
		return Plan(
			intent="general",
			needs_clarification=False,
			candidate_skills=skills[:3] or ["core"],
			raw_content=text,
		)
	cands = data.get("candidate_skills") or ["core"]
	if isinstance(cands, str):
		cands = [cands]
	cands = [c for c in cands if c in skills] or (["core"] if "core" in skills else skills[:1])
	return Plan(
		intent=str(data.get("intent") or "general"),
		slots=data.get("slots") or {},
		needs_clarification=bool(data.get("needs_clarification")),
		clarification_question=str(data.get("clarification_question") or ""),
		candidate_skills=cands,
	)
