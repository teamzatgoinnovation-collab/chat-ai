"""Optional company-status section provider."""


def get_sections():
	return [status_section]


def status_section(company, context):
	return {
		"key": "sample",
		"title": "Sample plugin",
		"meta": {"company": company or "", "note": "Replace with domain metrics"},
		"table": {
			"headers": ["Metric", "Value"],
			"rows": [["Sample", "OK"]],
		},
	}
