"""Desktop module registration."""

from frappe import _


def get_data():
	return [
		{
			"module_name": "Chat AI",
			"type": "module",
			"label": _("Chat AI"),
		}
	]
