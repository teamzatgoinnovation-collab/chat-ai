"""Example tools for sample_plugin."""

from chat_ai.core.tool_router.spec import CATEGORY_READ, ToolSpec


def get_tools():
	return [
		ToolSpec(
			name="sample_hello",
			description="Sample plugin hello tool",
			category=CATEGORY_READ,
			skill="custom",
			parameters={"type": "object", "properties": {"name": {"type": "string"}}},
			handler=_hello,
		)
	]


def _hello(name: str = "world", **_):
	return {"message": f"Hello, {name}!", "plugin": "sample_plugin"}
