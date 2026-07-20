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
		emptyHint: "Click 🎤, speak in the selected language, click mic again to stop, then Send.",
		placeholder: "Message or /command…",
		send: "Send",
		newChat: "New",
		working: "Working…",
		speak: "Speak",
		stop: "Stop",
		mic: "Voice input — click to talk, click again to stop",
		micOff: "Enable Voice Input in Chat AI Settings",
		listening: "Listening… speak clearly, then click mic to stop",
		livePrefix: "Hearing",
		confirm: "Confirm",
		cancel: "Cancel",
		voiceUnsupported: "Voice input is not supported in this browser. Use Chrome or Edge.",
		voiceError: "Could not hear clearly — try again closer to the mic.",
		voiceDenied: "Microphone permission denied. Allow mic access for this site.",
	},
	ar: {
		sub: "مساعد تخطيط الموارد",
		emptyTitle: "اسأل عن أي شيء في النظام",
		emptyHint: "اكتب سؤالاً أو / للأوامر أو استخدم الميكروفون.",
		placeholder: "رسالة أو /أمر…",
		send: "إرسال",
		newChat: "جديد",
		listening: "جاري الاستماع… تحدث بوضوح ثم اضغط الميكروفون للإيقاف",
		working: "جاري العمل…",
		speak: "تشغيل",
		stop: "إيقاف",
		mic: "إدخال صوتي — اضغط للتحدث ثم مجدداً للإيقاف",
		micOff: "فعّل الإدخال الصوتي من إعدادات Chat AI",
		livePrefix: "يُسمع",
		confirm: "تأكيد",
		cancel: "إلغاء",
		voiceUnsupported: "الإدخال الصوتي غير مدعوم. استخدم Chrome أو Edge.",
		voiceError: "لم يُسمع بوضوح — حاول مجدداً أقرب للميكروفون.",
		voiceDenied: "تم رفض إذن الميكروفون. اسمح بالوصول لهذا الموقع.",
	},
	ml: {
		sub: "ERP സഹായി",
		emptyTitle: "ERP-യെക്കുറിച്ച് എന്തും ചോദിക്കൂ",
		emptyHint: "ചോദ്യം ടൈപ്പ് ചെയ്യുക, / കമാൻഡ്, അല്ലെങ്കിൽ മൈക്ക് ഉപയോഗിക്കുക.",
		placeholder: "സന്ദേശം അല്ലെങ്കിൽ /കമാൻഡ്…",
		send: "അയയ്ക്കുക",
		newChat: "പുതിയത്",
		listening: "കേൾക്കുന്നു… വ്യക്തമായി സംസാരിച്ച് മൈക്ക് അമർത്തി നിർത്തുക",
		working: "പ്രവർത്തിക്കുന്നു…",
		speak: "കേൾക്കുക",
		stop: "നിർത്തുക",
		mic: "വോയ്സ് — ക്ലിക്ക് ചെയ്ത് സംസാരിക്കുക, വീണ്ടും അമർത്തി നിർത്തുക",
		micOff: "Chat AI Settings-ൽ Voice Input ഓണാക്കുക",
		livePrefix: "കേൾക്കുന്നു",
		confirm: "സ്ഥിരീകരിക്കുക",
		cancel: "റദ്ദാക്കുക",
		voiceUnsupported: "വോയ്സ് ലഭ്യമല്ല. Chrome അല്ലെങ്കിൽ Edge ഉപയോഗിക്കുക.",
		voiceError: "വ്യക്തമായി കേട്ടില്ല — മൈക്കിനോട് അടുത്ത് വീണ്ടും ശ്രമിക്കുക.",
		voiceDenied: "മൈക്ക് അനുമതി നിഷേധിച്ചു. ഈ സൈറ്റിന് അനുവദിക്കുക.",
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
			liveTranscript: "",
			voicesReady: false,
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
		sttLang() {
			/* Prefer browser locale for English; fixed locales for ar/ml. */
			if (this.language === "en") {
				const nav = (navigator.language || "").toLowerCase();
				if (nav.startsWith("en")) return navigator.language;
				return "en-US";
			}
			if (this.language === "ar") return "ar-SA";
			if (this.language === "ml") return "ml-IN";
			return this.bcp47;
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
		language() {
			if (this.listening) {
				this.stopListening();
				this.$nextTick(() => this.startListening());
			}
		},
	},
	async mounted() {
		chat_ai.sidebar._vm = this;
		this.bindRealtime();
		this.bindLayout();
		this.warmVoices();
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
		warmVoices() {
			if (!window.speechSynthesis) return;
			const mark = () => {
				this.voicesReady = true;
			};
			window.speechSynthesis.getVoices();
			window.speechSynthesis.onvoiceschanged = mark;
			mark();
		},
		joinVoiceParts(...parts) {
			return parts
				.map((p) => (p || "").trim())
				.filter(Boolean)
				.join(" ")
				.replace(/\s+/g, " ")
				.trim();
		},
		pickBestAlternative(result) {
			let best = result[0];
			let bestScore = typeof best.confidence === "number" ? best.confidence : 0;
			for (let i = 1; i < result.length; i++) {
				const c = typeof result[i].confidence === "number" ? result[i].confidence : 0;
				if (c > bestScore) {
					best = result[i];
					bestScore = c;
				}
			}
			return { transcript: (best.transcript || "").trim(), confidence: bestScore };
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
			if (!this.enableVoiceIn) {
				frappe.show_alert({ message: this.ui.micOff, indicator: "orange" });
				return;
			}
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
			this._keepListening = true;
			this._voiceBase = (this.input || "").trim();
			this._voiceFinal = "";
			this.liveTranscript = "";
			this.listening = true;
			this.progress = this.ui.listening;
			this._bindRecognition(SR);
		},
		_bindRecognition(SR) {
			if (!this._keepListening) return;
			try {
				if (this.recognition) {
					this.recognition.onend = null;
					this.recognition.onerror = null;
					this.recognition.onresult = null;
					this.recognition.stop();
				}
			} catch (e) {
				/* ignore */
			}
			const rec = new SR();
			rec.lang = this.sttLang;
			rec.continuous = true;
			rec.interimResults = true;
			rec.maxAlternatives = 3;
			rec.onresult = (ev) => {
				let interim = "";
				for (let i = ev.resultIndex; i < ev.results.length; i++) {
					const picked = this.pickBestAlternative(ev.results[i]);
					if (!picked.transcript) continue;
					if (ev.results[i].isFinal) {
						if (picked.confidence > 0 && picked.confidence < 0.35) continue;
						this._voiceFinal = this.joinVoiceParts(this._voiceFinal, picked.transcript);
					} else {
						interim = this.joinVoiceParts(interim, picked.transcript);
					}
				}
				this.input = this.joinVoiceParts(this._voiceBase, this._voiceFinal, interim);
				this.liveTranscript = interim;
				this.progress = interim
					? `${this.ui.livePrefix}: ${interim}`
					: this.ui.listening;
			};
			rec.onerror = (ev) => {
				const err = (ev && ev.error) || "";
				if (err === "not-allowed" || err === "service-not-allowed") {
					this._keepListening = false;
					frappe.show_alert({ message: this.ui.voiceDenied, indicator: "red" });
					this.listening = false;
					this.progress = "";
					this.liveTranscript = "";
					return;
				}
				if (err === "no-speech" || err === "aborted") {
					return;
				}
				if (err === "audio-capture" || err === "network") {
					this._keepListening = false;
					frappe.show_alert({ message: this.ui.voiceError, indicator: "orange" });
					this.listening = false;
					this.progress = "";
					this.liveTranscript = "";
				}
			};
			rec.onend = () => {
				this.recognition = null;
				if (!this._keepListening) {
					this.listening = false;
					this.liveTranscript = "";
					if (
						this.progress === this.ui.listening ||
						(this.progress || "").startsWith(this.ui.livePrefix)
					) {
						this.progress = "";
					}
					return;
				}
				clearTimeout(this._restartTimer);
				this._restartTimer = setTimeout(() => {
					if (this._keepListening) this._bindRecognition(SR);
				}, 180);
			};
			this.recognition = rec;
			try {
				rec.start();
			} catch (e) {
				clearTimeout(this._restartTimer);
				this._restartTimer = setTimeout(() => {
					if (this._keepListening) this._bindRecognition(SR);
				}, 250);
			}
		},
		stopListening() {
			this._keepListening = false;
			clearTimeout(this._restartTimer);
			try {
				if (this.recognition) {
					this.recognition.onend = null;
					this.recognition.stop();
				}
			} catch (e) {
				/* ignore */
			}
			this.recognition = null;
			this.listening = false;
			this.liveTranscript = "";
			this.input = this.joinVoiceParts(this._voiceBase, this._voiceFinal);
			this._voiceBase = this.input;
			this._voiceFinal = "";
			if (
				this.progress === this.ui.listening ||
				(this.progress || "").startsWith(this.ui.livePrefix)
			) {
				this.progress = "";
			}
		},
		pickTtsVoice(lang) {
			const voices = window.speechSynthesis.getVoices() || [];
			if (!voices.length) return null;
			const code = (lang || "en-US").toLowerCase();
			const prefix = code.split("-")[0];
			const score = (v) => {
				const vl = (v.lang || "").toLowerCase();
				let s = 0;
				if (vl === code) s += 40;
				else if (vl.startsWith(prefix + "-") || vl === prefix) s += 25;
				else if (vl.startsWith(prefix)) s += 10;
				else return -1;
				if (v.localService) s += 8;
				if (/neural|premium|enhanced|natural/i.test(v.name || "")) s += 5;
				return s;
			};
			let best = null;
			let bestScore = -1;
			for (const v of voices) {
				const s = score(v);
				if (s > bestScore) {
					best = v;
					bestScore = s;
				}
			}
			return best;
		},
		cleanForSpeech(text) {
			return String(text || "")
				.replace(/```[\s\S]*?```/g, " ")
				.replace(/`[^`]+`/g, " ")
				.replace(/[#*_>~]/g, " ")
				.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
				.replace(/https?:\/\/\S+/g, " ")
				.replace(/\s+/g, " ")
				.trim();
		},
		speak(msg) {
			if (!this.enableVoiceOut || !this.ttsAvailable || !msg || !msg.text) return;
			this.stopSpeaking();
			const plain = this.cleanForSpeech(msg.text);
			if (!plain) return;
			const u = new SpeechSynthesisUtterance(plain);
			u.lang = this.bcp47;
			const match = this.pickTtsVoice(this.bcp47);
			if (match) {
				u.voice = match;
				u.lang = match.lang || this.bcp47;
			}
			u.rate = this.language === "ar" || this.language === "ml" ? 0.9 : 1;
			u.pitch = 1;
			u.onend = () => {
				if (this.speakingId === msg.id) this.speakingId = null;
			};
			u.onerror = () => {
				if (this.speakingId === msg.id) this.speakingId = null;
			};
			this.speakingId = msg.id;
			window.speechSynthesis.speak(u);
		},
		stopSpeaking() {
			try {
				if (window.speechSynthesis) window.speechSynthesis.cancel();
			} catch (e) {
				/* ignore */
			}
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

    <div
      class="cai-progress"
      :class="{ 'cai-progress--active': progress || busy || listening, 'cai-progress--listening': listening }"
    >
      <span v-if="progress || busy || listening" class="cai-progress-dot"></span>
      <span class="cai-progress-text">{{ progress || (busy ? ui.working : '') }}</span>
    </div>

    <footer class="cai-composer" :class="{ 'cai-composer--listening': listening }">
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
