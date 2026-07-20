/**
 * Chat AI — Vue 3 Desk slide-out (languages + voice)
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

const CAI_UI = {
	en: {
		sub: "ERP assistant",
		emptyTitle: "Ask anything about your ERP",
		emptyHint: "Try a question, type / for commands, or use the mic.",
		placeholder: "Message or /command…",
		send: "Send",
		newChat: "New",
		listening: "Listening…",
		working: "Working…",
		speak: "Speak",
		stop: "Stop",
		mic: "Voice input",
		micOff: "Enable Voice Input in Chat AI Settings",
		confirm: "Confirm",
		cancel: "Cancel",
		voiceUnsupported: "Voice input is not supported in this browser.",
	},
	ar: {
		sub: "مساعد تخطيط الموارد",
		emptyTitle: "اسأل عن أي شيء في النظام",
		emptyHint: "اكتب سؤالاً أو / للأوامر أو استخدم الميكروفون.",
		placeholder: "رسالة أو /أمر…",
		send: "إرسال",
		newChat: "جديد",
		listening: "جاري الاستماع…",
		working: "جاري العمل…",
		speak: "تشغيل",
		stop: "إيقاف",
		mic: "إدخال صوتي",
		micOff: "فعّل الإدخال الصوتي من إعدادات Chat AI",
		confirm: "تأكيد",
		cancel: "إلغاء",
		voiceUnsupported: "الإدخال الصوتي غير مدعوم في هذا المتصفح.",
	},
	ml: {
		sub: "ERP സഹായി",
		emptyTitle: "ERP-യെക്കുറിച്ച് എന്തും ചോദിക്കൂ",
		emptyHint: "ചോദ്യം ടൈപ്പ് ചെയ്യുക, / കമാൻഡ്, അല്ലെങ്കിൽ മൈക്ക് ഉപയോഗിക്കുക.",
		placeholder: "സന്ദേശം അല്ലെങ്കിൽ /കമാൻഡ്…",
		send: "അയയ്ക്കുക",
		newChat: "പുതിയത്",
		listening: "കേൾക്കുന്നു…",
		working: "പ്രവർത്തിക്കുന്നു…",
		speak: "കേൾക്കുക",
		stop: "നിർത്തുക",
		mic: "വോയ്സ് ഇൻപുട്ട്",
		micOff: "Chat AI Settings-ൽ Voice Input ഓണാക്കുക",
		confirm: "സ്ഥിരീകരിക്കുക",
		cancel: "റദ്ദാക്കുക",
		voiceUnsupported: "ഈ ബ്രൗസറിൽ വോയ്സ് ഇൻപുട്ട് ലഭ്യമല്ല.",
	},
};

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
		const savedLang = localStorage.getItem("chat_ai_lang") || "en";
		return {
			open: localStorage.getItem("chat_ai_open") === "1",
			session: null,
			mode: "ERP Assistant",
			modes: CAI_MODES,
			language: savedLang,
			languages: [
				{ code: "en", label: "English", native: "English", bcp47: "en-US", dir: "ltr" },
				{ code: "ar", label: "Arabic", native: "العربية", bcp47: "ar-SA", dir: "rtl" },
				{ code: "ml", label: "Malayalam", native: "മലയാളം", bcp47: "ml-IN", dir: "ltr" },
			],
			messages: [],
			input: "",
			progress: "",
			busy: false,
			listening: false,
			speakingId: null,
			commands: [],
			paletteOpen: false,
			pending: null,
			enableVoiceIn: true,
			enableVoiceOut: true,
			autoSpeak: false,
			recognition: null,
		};
	},
	computed: {
		ui() {
			return CAI_UI[this.language] || CAI_UI.en;
		},
		dir() {
			const meta = this.languages.find((l) => l.code === this.language);
			return (meta && meta.dir) || "ltr";
		},
		bcp47() {
			const meta = this.languages.find((l) => l.code === this.language);
			return (meta && meta.bcp47) || "en-US";
		},
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
		voiceAvailable() {
			return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
		},
		ttsAvailable() {
			return !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
		},
	},
	watch: {
		input() {
			this.paletteOpen = this.input.startsWith("/") && this.paletteItems.length > 0;
		},
	},
	async mounted() {
		chat_ai.sidebar._vm = this;
		this.bindRealtime();
		this.bindLayout();
		this.updateLayoutOffset();
		await this.loadLocale();
		this.loadCommands();
		if (this.open && !this.session) this.newSession();
	},
	beforeUnmount() {
		this.unbindLayout();
		this.stopListening();
		this.stopSpeaking();
	},
	methods: {
		esc(s) {
			return frappe.utils.escape_html(String(s ?? ""));
		},
		formatText(s) {
			return this.esc(s).replace(/\n/g, "<br>");
		},
		/** Keep panel below navbar + form page-head so Save/Submit stay clickable. */
		updateLayoutOffset() {
			const shell = this.$el;
			if (!shell) return;
			let top = 0;
			const nav = document.querySelector(".navbar");
			if (nav) {
				const r = nav.getBoundingClientRect();
				top = Math.max(top, r.bottom);
			}
			const head = document.querySelector(".page-head");
			if (head) {
				const r = head.getBoundingClientRect();
				/* sticky page-head while near the top of the viewport */
				if (r.height > 0 && r.top < 160 && r.bottom > top) {
					top = Math.max(top, r.bottom);
				}
			}
			if (!top) {
				top = 48 + 52;
			}
			shell.style.setProperty("--cai-top", `${Math.ceil(top + 4)}px`);
		},
		bindLayout() {
			this._onLayout = () => this.updateLayoutOffset();
			window.addEventListener("resize", this._onLayout);
			window.addEventListener("scroll", this._onLayout, true);
			if (frappe.router && frappe.router.on) {
				frappe.router.on("change", this._onLayout);
			} else if (frappe.after_ajax) {
				/* fallback: remeasure after route paints */
			}
			$(document).on("page-change.chat_ai_layout form-load.chat_ai_layout", this._onLayout);
			this._layoutTimer = setInterval(() => this.updateLayoutOffset(), 1500);
		},
		unbindLayout() {
			if (this._onLayout) {
				window.removeEventListener("resize", this._onLayout);
				window.removeEventListener("scroll", this._onLayout, true);
				$(document).off(".chat_ai_layout");
			}
			if (this._layoutTimer) clearInterval(this._layoutTimer);
		},
		async loadLocale() {
			try {
				const r = await frappe.call({
					method: "chat_ai.api.chat.get_ui_locale",
					freeze: false,
					error: () => {
						/* keep defaults if method not yet loaded on worker */
					},
				});
				if (!(r && r.message && r.message.ok)) return;
				const d = r.message.data || {};
				if (d.languages && d.languages.length) this.languages = d.languages;
				if (d.language) this.language = d.language;
				this.enableVoiceIn = !!d.enable_voice_input;
				this.enableVoiceOut = !!d.enable_voice_output;
				this.autoSpeak = !!d.auto_speak_replies;
				localStorage.setItem("chat_ai_lang", this.language);
			} catch (e) {
				/* keep defaults */
			}
		},
		toggle(force) {
			this.open = typeof force === "boolean" ? force : !this.open;
			localStorage.setItem("chat_ai_open", this.open ? "1" : "0");
			this.$nextTick(() => this.updateLayoutOffset());
			if (this.open && !this.session) this.newSession();
			if (this.open) {
				this.$nextTick(() => {
					const el = this.$refs.input;
					if (el) el.focus();
				});
			} else {
				this.stopListening();
			}
		},
		clientContext() {
			const route = frappe.get_route ? frappe.get_route() : [];
			const ctx = {
				route: { path: route },
				recent: [],
				workspace: {},
				language: this.language,
			};
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
			const r = await frappe.call("chat_ai.api.chat.new_session", {
				language: this.language,
				assistant_mode: this.mode,
			});
			if (r.message && r.message.ok) {
				this.session = r.message.data.name;
				this.messages = [];
				this.progress = "";
				this.pending = null;
				this.stopSpeaking();
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
		async setLanguage(code) {
			this.language = code;
			localStorage.setItem("chat_ai_lang", code);
			if (!this.session) return;
			await frappe.call("chat_ai.api.chat.set_language", {
				session: this.session,
				language: code,
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
			const msg = {
				id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
				role,
				text: payload.text || "",
				blocks: (payload.content_json && payload.content_json.blocks) || [],
				needs_confirmation: !!(payload.content_json && payload.content_json.needs_confirmation),
			};
			this.messages.push(msg);
			this.$nextTick(() => {
				const box = this.$refs.messages;
				if (box) box.scrollTop = box.scrollHeight;
			});
			if (role === "assistant" && this.autoSpeak && this.enableVoiceOut && msg.text) {
				this.speak(msg);
			}
			return msg;
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
		toggleMic() {
			if (this.listening) this.stopListening();
			else this.startListening();
		},
		startListening() {
			if (!this.enableVoiceIn) return;
			const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
			if (!SR) {
				frappe.show_alert({ message: this.ui.voiceUnsupported, indicator: "orange" });
				return;
			}
			this.stopSpeaking();
			const rec = new SR();
			rec.lang = this.bcp47;
			rec.interimResults = true;
			rec.continuous = false;
			rec.onresult = (ev) => {
				let finalText = "";
				let interim = "";
				for (let i = ev.resultIndex; i < ev.results.length; i++) {
					const t = ev.results[i][0].transcript;
					if (ev.results[i].isFinal) finalText += t;
					else interim += t;
				}
				if (finalText) {
					this.input = ((this.input || "") + " " + finalText).trim();
				} else if (interim) {
					this.progress = interim;
				}
			};
			rec.onerror = () => {
				this.listening = false;
				this.progress = "";
			};
			rec.onend = () => {
				this.listening = false;
				if (this.progress && this.progress !== this.ui.listening) this.progress = "";
			};
			this.recognition = rec;
			this.listening = true;
			this.progress = this.ui.listening;
			rec.start();
		},
		stopListening() {
			try {
				if (this.recognition) this.recognition.stop();
			} catch (e) {
				/* ignore */
			}
			this.recognition = null;
			this.listening = false;
			if (this.progress === this.ui.listening) this.progress = "";
		},
		speak(msg) {
			if (!this.enableVoiceOut || !this.ttsAvailable || !msg || !msg.text) return;
			this.stopSpeaking();
			const u = new SpeechSynthesisUtterance(msg.text.replace(/[#*_`]/g, " "));
			u.lang = this.bcp47;
			const voices = window.speechSynthesis.getVoices() || [];
			const match = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(this.language));
			if (match) u.voice = match;
			u.onend = () => {
				if (this.speakingId === msg.id) this.speakingId = null;
			};
			this.speakingId = msg.id;
			window.speechSynthesis.speak(u);
		},
		stopSpeaking() {
			if (this.ttsAvailable) window.speechSynthesis.cancel();
			this.speakingId = null;
		},
		async send() {
			let text = (this.input || "").trim();
			if (!text || this.busy) return;
			this.stopListening();
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
			this.progress = this.ui.working;
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
    :class="{ 'cai-launcher--hidden': open }"
    title="Chat AI (Ctrl+Shift+J)"
    aria-label="Open Chat AI"
    @click="toggle()"
  >
    <span class="cai-launcher-mark">AI</span>
  </button>

  <aside
    class="cai-panel"
    :class="{ 'cai-panel--open': open, 'cai-panel--rtl': dir === 'rtl' }"
    :dir="dir"
    :aria-hidden="open ? 'false' : 'true'"
  >
    <header class="cai-header">
      <div class="cai-brand">
        <span class="cai-brand-mark">AI</span>
        <div class="cai-brand-text">
          <strong>Chat AI</strong>
          <span class="cai-brand-sub">{{ ui.sub }}</span>
        </div>
      </div>
      <select class="cai-mode" :value="language" @change="setLanguage($event.target.value)" title="Language">
        <option v-for="l in languages" :key="l.code" :value="l.code">{{ l.native }}</option>
      </select>
      <select class="cai-mode" :value="mode" @change="setMode($event.target.value)" title="Assistant mode">
        <option v-for="m in modes" :key="m" :value="m">{{ m }}</option>
      </select>
      <button type="button" class="cai-icon-btn" :title="ui.newChat" @click="newSession">{{ ui.newChat }}</button>
      <button type="button" class="cai-icon-btn" title="Close" @click="toggle(false)">×</button>
    </header>

    <div class="cai-messages" ref="messages">
      <div v-if="!messages.length" class="cai-empty">
        <p class="cai-empty-title">{{ ui.emptyTitle }}</p>
        <p class="cai-empty-hint">{{ ui.emptyHint }}</p>
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
            <button type="button" class="cai-btn cai-btn--primary" @click="confirmPending(true)">{{ ui.confirm }}</button>
            <button type="button" class="cai-btn" @click="confirmPending(false)">{{ ui.cancel }}</button>
          </div>

          <div v-if="msg.role === 'assistant' && enableVoiceOut && ttsAvailable && msg.text" class="cai-voice-actions">
            <button
              type="button"
              class="cai-icon-btn"
              @click="speakingId === msg.id ? stopSpeaking() : speak(msg)"
            >{{ speakingId === msg.id ? ui.stop : ui.speak }}</button>
          </div>
        </div>
      </div>
    </div>

    <div class="cai-progress" :class="{ 'cai-progress--active': progress || busy || listening }">
      <span v-if="progress || busy || listening" class="cai-progress-dot"></span>
      {{ progress || (busy ? ui.working : '') }}
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
        :placeholder="ui.placeholder"
        @keydown="onKeydown"
      ></textarea>
      <div class="cai-composer-actions">
        <button
          v-if="voiceAvailable"
          type="button"
          class="cai-icon-btn cai-mic"
          :class="{ 'cai-mic--on': listening, 'cai-mic--off': !enableVoiceIn }"
          :disabled="!enableVoiceIn || busy"
          :title="enableVoiceIn ? ui.mic : ui.micOff"
          @click="toggleMic"
        >{{ listening ? '■' : '🎤' }}</button>
        <button
          type="button"
          class="cai-btn cai-btn--primary cai-send"
          :disabled="busy || !(input || '').trim()"
          @click="send"
        >{{ ui.send }}</button>
      </div>
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
