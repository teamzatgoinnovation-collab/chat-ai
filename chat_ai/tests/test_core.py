"""Unit tests for chat_ai core (no Frappe required for these)."""

from __future__ import annotations

import unittest

from chat_ai.core.agent_limits import AgentLimits
from chat_ai.core.providers.capabilities import Capabilities, negotiate
from chat_ai.core.tool_router import ToolRouter
from chat_ai.core.tool_router.spec import CATEGORY_READ, CATEGORY_WRITE, ConfirmationPolicy, ToolSpec


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
	def test_write_requires_confirm(self):
		policy = ConfirmationPolicy(require_confirmation_for_writes=True)
		tool = ToolSpec(name="create_task", description="x", category=CATEGORY_WRITE)
		self.assertTrue(policy.needs_confirmation(tool, {}))

	def test_read_no_confirm(self):
		policy = ConfirmationPolicy()
		tool = ToolSpec(name="get_tasks", description="x", category=CATEGORY_READ)
		self.assertFalse(policy.needs_confirmation(tool, {}))


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


class TestAgentLimits(unittest.TestCase):
	def test_from_settings(self):
		lim = AgentLimits.from_settings({"max_tool_calls": "5"})
		self.assertEqual(lim.max_tool_calls, 5)


if __name__ == "__main__":
	unittest.main()
