/**
 * Chat AI — Vue 3 Desk slide-out sidebar
 */
frappe.provide("chat_ai.sidebar");

const CAI_MODES = [
	"Normal Chat",
	"ERP Assistant",
	"Document Assistant",
	"Analytics Assistant",
	"Developer Assistant",
	"Admin Assistant",
];

chat_ai.sidebar = {
	app: null,
	root: null,

	async init() {
		if (window.chat_ai_sidebar_ready) return;
		window.chat_ai_sidebar_ready = true;

		if (!document.getElementById("cai-root")) {
			const root = document.createElement("div");
			root.id = "cai-root";
			document.body.appendChild(root);
		}
		this.root = document.getElementById("cai-root");
		this.app = await chat_ai.vue.mount(this.root, chat_ai.sidebar.AppOptions);

		document.addEventListener("keydown", (e) => {
			if (e.key === "Escape" && this._vm && this._vm.open) {
				this._vm.toggle(false);
			}
			if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "j") {
				e.preventDefault();
				if (this._vm) this._vm.toggle();
			}
		});
	},
};

chat_ai.sidebar.AppOptions = {
	name: "ChatAISidebar",
	data() {
		return {
			open: localStorage.getItem("chat_ai_open") === "1",
			session: null,
			mode: "ERP Assistant",
			modes: CAI_MODES,
			messages: [],
			input: "",
			progress: "",
			busy: false,
			commands: [],
			paletteOpen: false,
			pending: null,
		};
	},
	computed: {
		paletteItems() {
			if (!this.input.startsWith("/")) return [];
			const q = this.input.slice(1).toLowerCase();
			return (this.commands || []).filter(
				(c) =>
					!q ||
					(c.name || "").toLowerCase().startsWith(q) ||
					(c.label || "").toLowerCase().includes(q)
			);
		},
	},
	watch: {
		input() {
			this.paletteOpen = this.input.startsWith("/") && this.paletteItems.length > 0;
		},
	},
	mounted() {
		chat_ai.sidebar._vm = this;
		this.bindRealtime();
		this.loadCommands();
		if (this.open && !this.session) this.newSession();
	},
	methods: {
		esc(s) {
			return frappe.utils.escape_html(String(s ?? ""));
		},
		formatText(s) {
			return this.esc(s).replace(/\n/g, "<br>");
		},
		toggle(force) {
			this.open = typeof force === "boolean" ? force : !this.open;
			localStorage.setItem("chat_ai_open", this.open ? "1" : "0");
			if (this.open && !this.session) this.newSession();
			if (this.open) {
				this.$nextTick(() => {
					const el = this.$refs.input;
					if (el) el.focus();
				});
			}
		},
		clientContext() {
			const route = frappe.get_route ? frappe.get_route() : [];
			const ctx = { route: { path: route }, recent: [], workspace: {} };
			if (route[0] === "Form" && route[1] && route[2]) {
				ctx.form = { doctype: route[1], name: route[2] };
			}
			if (frappe.boot && frappe.boot.user && frappe.boot.user.recent) {
				ctx.recent = frappe.boot.user.recent.slice(0, 10);
			}
			return ctx;
		},
		async loadCommands() {
			try {
				const r = await frappe.call("chat_ai.api.chat.list_commands");
				if (r.message && r.message.ok) this.commands = r.message.data || [];
			} catch (e) {
				this.commands = [];
			}
		},
		async newSession() {
			const r = await frappe.call("chat_ai.api.chat.new_session");
			if (r.message && r.message.ok) {
				this.session = r.message.data.name;
				this.messages = [];
				this.progress = "";
				this.pending = null;
				await this.setMode(this.mode);
			}
		},
		async setMode(mode) {
			this.mode = mode;
			if (!this.session) return;
			await frappe.call("chat_ai.api.chat.set_mode", {
				session: this.session,
				assistant_mode: mode,
			});
		},
		pickCommand(cmd) {
			this.input = `/${cmd.name} `;
			this.paletteOpen = false;
			if (cmd.name === "help") this.showHelp();
			this.$nextTick(() => {
				if (this.$refs.input) this.$refs.input.focus();
			});
		},
		showHelp() {
			const lines = this.commands.map(
				(c) => `/${c.name} — ${c.description || c.label || ""}`
			);
			this.pushMessage("assistant", {
				text: lines.join("\n") || "No commands available.",
			});
		},
		pushMessage(role, payload) {
			this.messages.push({
				id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
				role,
				text: payload.text || "",
				blocks: (payload.content_json && payload.content_json.blocks) || [],
				needs_confirmation: !!(payload.content_json && payload.content_json.needs_confirmation),
			});
			this.$nextTick(() => {
				const box = this.$refs.messages;
				if (box) box.scrollTop = box.scrollHeight;
			});
		},
		openLink(dt, nm) {
			frappe.set_route("Form", dt, nm);
		},
		async confirmPending(yes) {
			if (!yes) {
				this.pending = null;
				this.pushMessage("assistant", { text: "Cancelled." });
				return;
			}
			if (!this.pending) return;
			await this.sendRaw("", {
				confirmed: 1,
				pending_tool: this.pending.tool,
				pending_args: this.pending.args,
			});
			this.pending = null;
		},
		onKeydown(e) {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				this.send();
			}
		},
		async send() {
			let text = (this.input || "").trim();
			if (!text || this.busy) return;
			let command = null;
			if (text.startsWith("/")) {
				const parts = text.slice(1).split(/\s+/);
				command = parts.shift();
				text = parts.join(" ");
				if (command === "help") {
					this.showHelp();
					this.input = "";
					this.paletteOpen = false;
					return;
				}
			}
			const display = command ? `/${command} ${text}`.trim() : text;
			this.input = "";
			this.paletteOpen = false;
			this.pushMessage("user", { text: display });
			await this.sendRaw(text, { command });
		},
		async sendRaw(message, extra = {}) {
			if (!this.session) await this.newSession();
			this.busy = true;
			this.progress = "Working…";
			try {
				const r = await frappe.call({
					method: "chat_ai.api.chat.send",
					args: {
						session: this.session,
						message,
						client_context: JSON.stringify(this.clientContext()),
						command: extra.command || null,
						confirmed: extra.confirmed || 0,
						pending_tool: extra.pending_tool || null,
						pending_args: extra.pending_args
							? JSON.stringify(extra.pending_args)
							: null,
					},
				});
				const payload = r.message || {};
				if (!payload.ok) {
					this.pushMessage("assistant", { text: payload.error || "Error" });
					return;
				}
				const data = payload.data || {};
				if (data.needs_confirmation) {
					this.pending = { tool: data.pending_tool, args: data.pending_args };
				}
				this.pushMessage("assistant", {
					text: data.content || "",
					content_json: data.content_json || {
						blocks: [],
						needs_confirmation: data.needs_confirmation,
					},
				});
			} catch (e) {
				this.pushMessage("assistant", { text: e.message || "Request failed" });
			} finally {
				this.busy = false;
				this.progress = "";
			}
		},
		bindRealtime() {
			if (!frappe.realtime || !frappe.realtime.on) return;
			frappe.realtime.on("chat_ai:progress", (data) => {
				if (!data) return;
				this.progress = data.label || data.stage || "";
				if (data.stage === "done") {
					setTimeout(() => {
						if (this.progress === (data.label || data.stage)) this.progress = "";
					}, 800);
				}
			});
			frappe.realtime.on("chat_ai:stream", (data) => {
				if (data && data.done) this.progress = "";
			});
		},
	},
	template: `
<div class="cai-shell">
  <button
    type="button"
    class="cai-launcher"
    title="Chat AI (Ctrl+Shift+J)"
    aria-label="Open Chat AI"
    @click="toggle()"
  >
    <span class="cai-launcher-mark">AI</span>
  </button>

  <aside class="cai-panel" :class="{ 'cai-panel--open': open }" :aria-hidden="open ? 'false' : 'true'">
    <header class="cai-header">
      <div class="cai-brand">
        <span class="cai-brand-mark">AI</span>
        <div class="cai-brand-text">
          <strong>Chat AI</strong>
          <span class="cai-brand-sub">ERP assistant</span>
        </div>
      </div>
      <select class="cai-mode" :value="mode" @change="setMode($event.target.value)" title="Assistant mode">
        <option v-for="m in modes" :key="m" :value="m">{{ m }}</option>
      </select>
      <button type="button" class="cai-icon-btn" title="New chat" @click="newSession">New</button>
      <button type="button" class="cai-icon-btn" title="Close" @click="toggle(false)">×</button>
    </header>

    <div class="cai-messages" ref="messages">
      <div v-if="!messages.length" class="cai-empty">
        <p class="cai-empty-title">Ask anything about your ERP</p>
        <p class="cai-empty-hint">Try a question, or type <code>/</code> for commands.</p>
      </div>

      <div
        v-for="msg in messages"
        :key="msg.id"
        class="cai-msg"
        :class="'cai-msg--' + msg.role"
      >
        <div class="cai-bubble">
          <div class="cai-bubble-text" v-html="formatText(msg.text)"></div>

          <template v-for="(b, bi) in msg.blocks" :key="bi">
            <table v-if="b.type === 'table' && b.data" class="cai-table">
              <thead>
                <tr>
                  <th v-for="(h, hi) in (b.data.headers || [])" :key="hi">{{ h }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, ri) in (b.data.rows || [])" :key="ri">
                  <td v-for="(cell, ci) in row" :key="ci">{{ cell }}</td>
                </tr>
              </tbody>
            </table>
            <div v-if="b.type === 'links' && Array.isArray(b.data)" class="cai-links">
              <button
                v-for="(l, li) in b.data"
                :key="li"
                type="button"
                class="cai-link"
                @click="openLink(l.doctype, l.name)"
              >{{ l.doctype }}: {{ l.name }}</button>
            </div>
          </template>

          <div v-if="msg.needs_confirmation" class="cai-confirm">
            <button type="button" class="cai-btn cai-btn--primary" @click="confirmPending(true)">Confirm</button>
            <button type="button" class="cai-btn" @click="confirmPending(false)">Cancel</button>
          </div>
        </div>
      </div>
    </div>

    <div class="cai-progress" :class="{ 'cai-progress--active': progress || busy }">
      <span v-if="progress || busy" class="cai-progress-dot"></span>
      {{ progress || (busy ? 'Working…' : '') }}
    </div>

    <footer class="cai-composer">
      <div v-show="paletteOpen" class="cai-palette">
        <button
          v-for="c in paletteItems"
          :key="c.name"
          type="button"
          class="cai-palette-item"
          @click="pickCommand(c)"
        >
          <strong>/{{ c.name }}</strong>
          <span>{{ c.description || c.label || '' }}</span>
        </button>
      </div>
      <textarea
        ref="input"
        class="cai-input"
        v-model="input"
        rows="2"
        placeholder="Message or /command…"
        @keydown="onKeydown"
      ></textarea>
      <button
        type="button"
        class="cai-btn cai-btn--primary cai-send"
        :disabled="busy || !(input || '').trim()"
        @click="send"
      >Send</button>
    </footer>
  </aside>
</div>
`,
};

$(document).ready(function () {
	if (frappe.session && frappe.session.user && frappe.session.user !== "Guest") {
		chat_ai.sidebar.init();
	}
});
