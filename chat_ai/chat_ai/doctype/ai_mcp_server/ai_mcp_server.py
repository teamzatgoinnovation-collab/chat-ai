# Copyright (c) 2026, ZatGo Innovation and contributors
# License: MIT

import frappe
from frappe.model.document import Document


class AIMCPServer(Document):
	@frappe.whitelist()
	def discover_tools(self):
		"""Refresh discovered_tools from the MCP endpoint."""
		frappe.only_for(("System Manager", "Chat AI Manager"))
		from chat_ai.core.tool_sources.mcp import refresh_discovered_tools

		tools = refresh_discovered_tools(self.name)
		return {"count": len(tools), "tools": tools}
