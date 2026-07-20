"""Unit tests for chat_ai core (no Frappe required for these)."""

from __future__ import annotations

import unittest

from chat_ai.core.agent_limits import AgentLimits
from chat_ai.core.planner import Plan, _parse_plan
from chat_ai.core.providers.capabilities import Capabilities, negotiate
from chat_ai.core.response import plan_approval
from chat_ai.core.tool_router import ToolRouter
from chat_ai.core.tool_router.spec import CATEGORY_READ, CATEGORY_WRITE, ConfirmationPolicy, ToolSpec
from chat_ai.core.approval import is_plan_approval_text
from chat_ai.core.tool_enrichment import enrich_tool_args


class TestCapabilities(unittest.TestCase):
	def test_negotiate_ok(self):
		caps = Capabilities(chat=True, tool_calling=True, streaming=True)
		r = negotiate(caps, "chat", "tool_calling")
		self.assertTrue(r.ok)
		self.assertEqual(r.missing, [])

	def test_negotiate_missing(self):
		caps = Capabilities(chat=True)
		r = negotiate(caps, "streaming")
		self.assertFalse(r.ok)
		self.assertIn("streaming", r.missing)


class TestConfirmation(unittest.TestCase):
	def test_write_requires_confirm_medium(self):
		policy = ConfirmationPolicy(require_confirmation_for_writes=True)
		tool = ToolSpec(name="create_sales_order", description="x", category=CATEGORY_WRITE)
		self.assertTrue(policy.needs_confirmation(tool, {}, risk_level="medium"))

	def test_low_risk_task_skips_confirm(self):
		policy = ConfirmationPolicy(require_confirmation_for_writes=True)
		tool = ToolSpec(name="create_task", description="x", category=CATEGORY_WRITE)
		self.assertFalse(policy.needs_confirmation(tool, {}, risk_level="low"))

	def test_high_risk_always_confirms(self):
		policy = ConfirmationPolicy(require_confirmation_for_writes=True)
		tool = ToolSpec(name="create_task", description="x", category=CATEGORY_WRITE)
		self.assertTrue(policy.needs_confirmation(tool, {}, risk_level="high"))

	def test_read_no_confirm(self):
		policy = ConfirmationPolicy()
		tool = ToolSpec(name="get_tasks", description="x", category=CATEGORY_READ)
		self.assertFalse(policy.needs_confirmation(tool, {}))

	def test_bulk_names_confirm(self):
		policy = ConfirmationPolicy()
		tool = ToolSpec(name="update_document", description="x", category=CATEGORY_WRITE)
		self.assertTrue(policy.needs_confirmation(tool, {"names": ["A", "B"]}, risk_level="low"))


class TestToolRouter(unittest.TestCase):
	def test_unknown_tool(self):
		router = ToolRouter([])
		r = router.run("nope", {})
		self.assertFalse(r.ok)

	def test_category_blocked(self):
		policy = ConfirmationPolicy(allowed_categories={CATEGORY_READ})
		tool = ToolSpec(
			name="create_x",
			description="x",
			category=CATEGORY_WRITE,
			handler=lambda: {"ok": True},
		)
		router = ToolRouter([tool], policy=policy)
		r = router.run("create_x", {})
		self.assertFalse(r.ok)
		self.assertFalse(r.permission_ok)

	def test_confirm_gate(self):
		tool = ToolSpec(
			name="create_x",
			description="x",
			category=CATEGORY_WRITE,
			confirmation_required=True,
			handler=lambda: {"ok": True},
		)
		router = ToolRouter([tool])
		r = router.run("create_x", {})
		self.assertTrue(r.needs_confirmation)
		r2 = router.run("create_x", {}, confirmed=True)
		self.assertTrue(r2.ok)


class TestEnrichment(unittest.TestCase):
	def test_enrich_does_not_override(self):
		tool = ToolSpec(name="create_document", description="x", category=CATEGORY_WRITE)
		ctx = {"intelligent_defaults": {"company": "Acme", "warehouse": "Stores - A"}}
		args = enrich_tool_args(tool, {"values": {"company": "Other"}}, ctx)
		self.assertEqual(args["values"]["company"], "Other")

	def test_enrich_fills_missing(self):
		tool = ToolSpec(name="create_document", description="x", category=CATEGORY_WRITE)
		ctx = {"intelligent_defaults": {"company": "Acme", "warehouse": "Stores - A"}}
		args = enrich_tool_args(tool, {"values": {"title": "Test"}}, ctx)
		self.assertEqual(args["values"]["company"], "Acme")
		self.assertEqual(args["values"]["warehouse"], "Stores - A")


class TestPlanner(unittest.TestCase):
	def test_parse_plan_extended_fields(self):
		raw = """{
			"intent": "create project",
			"is_simple_question": false,
			"risk_level": "high",
			"assumptions": ["Using Company: Acme"],
			"implementation_plan": ["Create Project", "Add tasks"],
			"needs_plan_approval": true,
			"needs_clarification": false,
			"candidate_skills": ["projects", "core"]
		}"""
		plan = _parse_plan(raw, ["projects", "core"], {"assumptions": []})
		self.assertTrue(plan.needs_plan_approval)
		self.assertEqual(plan.risk_level, "high")
		self.assertEqual(len(plan.implementation_plan), 2)


class TestPlanApprovalResponse(unittest.TestCase):
	def test_plan_approval_shape(self):
		resp = plan_approval("Proceed?", ["Step 1", "Step 2"], ["Using Company: X"], token="abc")
		cj = resp.to_content_json()
		self.assertTrue(cj["needs_plan_approval"])
		self.assertEqual(cj["pending_plan"], ["Step 1", "Step 2"])
		self.assertEqual(cj["confirmation_token"], "abc")


class TestPlanApprovalText(unittest.TestCase):
	def test_ok_variants(self):
		self.assertTrue(is_plan_approval_text("OK"))
		self.assertTrue(is_plan_approval_text("yes"))
		self.assertFalse(is_plan_approval_text("maybe"))


class TestAgentLimits(unittest.TestCase):
	def test_from_settings(self):
		lim = AgentLimits.from_settings({"max_tool_calls": "5"})
		self.assertEqual(lim.max_tool_calls, 5)


class TestI18n(unittest.TestCase):
	def test_normalize_arabic(self):
		from chat_ai.core.i18n import get_language, normalize_language

		self.assertEqual(normalize_language("ar"), "ar")
		self.assertEqual(normalize_language("Arabic"), "ar")
		self.assertEqual(get_language("ar")["dir"], "rtl")

	def test_malayalam_prompt(self):
		from chat_ai.core.i18n import language_prompt

		self.assertIn("Malayalam", language_prompt("ml"))


if __name__ == "__main__":
	unittest.main()
