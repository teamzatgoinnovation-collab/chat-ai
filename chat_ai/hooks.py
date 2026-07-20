"""Frappe hooks for Chat AI — ERPNext AI Platform."""

app_name = "chat_ai"
app_title = "Chat AI"
app_publisher = "ZatGo Innovation"
app_description = "Marketplace-ready AI platform for ERPNext"
app_email = "engineering@example.com"
app_license = "mit"
app_version = "0.1.0"

required_apps = ["erpnext"]

after_install = "chat_ai.install.after_install"
after_migrate = "chat_ai.install.after_migrate"

app_include_js = [
	"/assets/chat_ai/js/chat_ai_vue.js",
	"/assets/chat_ai/js/chat_ai_sidebar_app.js",
]
app_include_css = ["/assets/chat_ai/css/chat_ai_sidebar.css"]

doc_events = {
	"*": {
		"on_update": "chat_ai.erpnext.events.document_events.on_update",
		"after_insert": "chat_ai.erpnext.events.document_events.after_insert",
		"on_submit": "chat_ai.erpnext.events.document_events.on_submit",
		"on_cancel": "chat_ai.erpnext.events.document_events.on_cancel",
	}
}

scheduler_events = {
	"hourly": [
		"chat_ai.erpnext.events.scheduler_events.hourly",
	],
	"daily": [
		"chat_ai.erpnext.events.scheduler_events.daily",
	],
}

fixtures = [
	{
		"dt": "Role",
		"filters": [["name", "in", ["Chat AI User", "Chat AI Manager"]]],
	},
]

# Extensibility hooks consumed by chat_ai.plugin.loader
# chat_ai_plugins = []
# chat_ai_skills = []
# chat_ai_tools = []
# chat_ai_providers = []
