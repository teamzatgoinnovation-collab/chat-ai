MANIFEST = {
	"name": "sample_plugin",
	"version": "0.1.0",
	"description": "Minimal Chat AI plugin example",
	"required_chat_ai_version": "0.2.5",
	"provides_tools": True,
	"provides_prompts": True,
	"provides_status_sections": True,
}


def get_manifest():
	return MANIFEST
