"""Realtime progress / stream helpers."""

from __future__ import annotations

import frappe

STAGE_LABELS = {
	"searching": "Searching...",
	"reading_erp": "Reading ERP...",
	"running_workflow": "Running Workflow...",
	"generating_report": "Generating Report...",
	"creating_document": "Creating Document...",
	"planning": "Planning...",
	"routing": "Routing...",
	"done": "Done",
	"working": "Working...",
}


def publish_progress(session: str, stage: str, detail: str = "", tool: str = ""):
	label = STAGE_LABELS.get(stage, STAGE_LABELS["working"])
	frappe.publish_realtime(
		"chat_ai:progress",
		{"session": session, "stage": stage, "label": label, "detail": detail, "tool": tool},
		user=frappe.session.user,
	)


def publish_stream(session: str, chunk: str, done: bool = False):
	frappe.publish_realtime(
		"chat_ai:stream",
		{"session": session, "chunk": chunk, "done": done},
		user=frappe.session.user,
	)


def publish_notify(title: str, message: str, user: str | None = None):
	frappe.publish_realtime(
		"chat_ai:notify",
		{"title": title, "message": message},
		user=user or frappe.session.user,
	)
