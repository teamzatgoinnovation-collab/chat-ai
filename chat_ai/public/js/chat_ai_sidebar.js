/**
 * Chat AI Desk slide-out sidebar
 */
frappe.provide("chat_ai");

chat_ai.sidebar = {
  session: null,
  commands: [],
  pending: null,
  open: false,

  init() {
    if (window.chat_ai_sidebar_ready) return;
    window.chat_ai_sidebar_ready = true;
    this.inject();
    this.bindRealtime();
    if (localStorage.getItem("chat_ai_open") === "1") this.toggle(true);
  },

  inject() {
    if (document.getElementById("chat-ai-panel")) return;
    const launcher = document.createElement("button");
    launcher.id = "chat-ai-launcher";
    launcher.title = "Chat AI";
    launcher.textContent = "AI";
    launcher.onclick = () => this.toggle();
    document.body.appendChild(launcher);

    const panel = document.createElement("div");
    panel.id = "chat-ai-panel";
    panel.innerHTML = `
      <div class="chat-ai-header">
        <strong style="flex:1">Chat AI</strong>
        <select id="chat-ai-mode" title="Assistant mode">
          <option>Normal Chat</option>
          <option selected>ERP Assistant</option>
          <option>Document Assistant</option>
          <option>Analytics Assistant</option>
          <option>Developer Assistant</option>
          <option>Admin Assistant</option>
        </select>
        <button class="btn btn-xs" id="chat-ai-new">New</button>
        <button class="btn btn-xs" id="chat-ai-close">×</button>
      </div>
      <div class="chat-ai-body" id="chat-ai-messages"></div>
      <div class="chat-ai-progress" id="chat-ai-progress"></div>
      <div class="chat-ai-composer">
        <div class="chat-ai-palette" id="chat-ai-palette"></div>
        <textarea id="chat-ai-input" placeholder="Message or /command..."></textarea>
        <button class="btn btn-primary btn-sm" id="chat-ai-send">Send</button>
      </div>
    `;
    document.body.appendChild(panel);

    document.getElementById("chat-ai-close").onclick = () => this.toggle(false);
    document.getElementById("chat-ai-send").onclick = () => this.send();
    document.getElementById("chat-ai-new").onclick = () => this.newSession();
    document.getElementById("chat-ai-mode").onchange = (e) => this.setMode(e.target.value);
    const input = document.getElementById("chat-ai-input");
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.send();
      }
    });
    input.addEventListener("input", () => this.onInput());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.open) this.toggle(false);
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        this.toggle();
      }
    });
    this.loadCommands();
  },

  toggle(force) {
    this.open = typeof force === "boolean" ? force : !this.open;
    const panel = document.getElementById("chat-ai-panel");
    if (panel) panel.classList.toggle("open", this.open);
    localStorage.setItem("chat_ai_open", this.open ? "1" : "0");
    if (this.open && !this.session) this.newSession();
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

  async newSession() {
    const r = await frappe.call("chat_ai.api.chat.new_session");
    if (r.message && r.message.ok) {
      this.session = r.message.data.name;
      document.getElementById("chat-ai-messages").innerHTML = "";
      this.setProgress("");
    }
  },

  async setMode(mode) {
    if (!this.session) return;
    await frappe.call("chat_ai.api.chat.set_mode", { session: this.session, assistant_mode: mode });
  },

  async loadCommands() {
    try {
      const r = await frappe.call("chat_ai.api.chat.list_commands");
      if (r.message && r.message.ok) this.commands = r.message.data || [];
    } catch (e) {
      this.commands = [];
    }
  },

  onInput() {
    const val = document.getElementById("chat-ai-input").value || "";
    const palette = document.getElementById("chat-ai-palette");
    if (!val.startsWith("/")) {
      palette.classList.remove("open");
      return;
    }
    const q = val.slice(1).toLowerCase();
    const items = this.commands.filter((c) => !q || c.name.startsWith(q) || (c.label || "").toLowerCase().includes(q));
    palette.innerHTML = items
      .map(
        (c) =>
          `<div class="item" data-cmd="${c.name}"><strong>/${c.name}</strong> — ${c.description || c.label || ""}</div>`
      )
      .join("");
    palette.classList.toggle("open", items.length > 0);
    palette.querySelectorAll(".item").forEach((el) => {
      el.onclick = () => {
        document.getElementById("chat-ai-input").value = `/${el.dataset.cmd} `;
        palette.classList.remove("open");
        if (el.dataset.cmd === "help") this.showHelp();
      };
    });
  },

  showHelp() {
    const lines = this.commands.map((c) => `/${c.name} — ${c.description || c.label || ""}`);
    this.appendMessage("assistant", lines.join("\n") || "No commands available.");
  },

  setProgress(text) {
    const el = document.getElementById("chat-ai-progress");
    if (el) el.textContent = text || "";
  },

  appendMessage(role, content, contentJson) {
    const box = document.getElementById("chat-ai-messages");
    const div = document.createElement("div");
    div.className = `chat-ai-msg ${role}`;
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    if (role === "assistant" && contentJson && contentJson.blocks) {
      bubble.innerHTML = this.renderBlocks(content, contentJson);
    } else {
      bubble.innerHTML = frappe.utils.escape_html(content || "").replace(/\n/g, "<br>");
    }
    div.appendChild(bubble);
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  },

  renderBlocks(markdown, cj) {
    let html = `<div>${frappe.utils.escape_html(markdown || "").replace(/\n/g, "<br>")}</div>`;
    (cj.blocks || []).forEach((b) => {
      if (b.type === "table" && b.data) {
        const headers = b.data.headers || [];
        const rows = b.data.rows || [];
        html += `<table class="chat-ai-table"><thead><tr>${headers
          .map((h) => `<th>${frappe.utils.escape_html(String(h))}</th>`)
          .join("")}</tr></thead><tbody>`;
        rows.forEach((row) => {
          html += `<tr>${row.map((c) => `<td>${frappe.utils.escape_html(String(c ?? ""))}</td>`).join("")}</tr>`;
        });
        html += `</tbody></table>`;
      }
      if (b.type === "links" && Array.isArray(b.data)) {
        html += `<div>${b.data
          .map(
            (l) =>
              `<span class="chat-ai-link" data-dt="${l.doctype}" data-nm="${l.name}">${frappe.utils.escape_html(
                l.doctype + ": " + l.name
              )}</span>`
          )
          .join("")}</div>`;
      }
    });
    if (cj.needs_confirmation) {
      html += `<div style="margin-top:8px"><button class="btn btn-xs btn-primary chat-ai-confirm">Confirm</button>
        <button class="btn btn-xs chat-ai-cancel">Cancel</button></div>`;
    }
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    wrap.querySelectorAll(".chat-ai-link").forEach((el) => {
      el.onclick = () => frappe.set_route("Form", el.dataset.dt, el.dataset.nm);
    });
    const confirmBtn = wrap.querySelector(".chat-ai-confirm");
    if (confirmBtn) {
      confirmBtn.onclick = () => this.confirmPending(true);
      wrap.querySelector(".chat-ai-cancel").onclick = () => this.confirmPending(false);
    }
    return wrap.innerHTML;
  },

  async confirmPending(yes) {
    if (!yes) {
      this.pending = null;
      this.appendMessage("assistant", "Cancelled.");
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

  async send() {
    const input = document.getElementById("chat-ai-input");
    let text = (input.value || "").trim();
    if (!text) return;
    let command = null;
    if (text.startsWith("/")) {
      const parts = text.slice(1).split(/\s+/);
      command = parts.shift();
      text = parts.join(" ");
      if (command === "help") {
        this.showHelp();
        input.value = "";
        return;
      }
    }
    input.value = "";
    document.getElementById("chat-ai-palette").classList.remove("open");
    this.appendMessage("user", command ? `/${command} ${text}` : text);
    await this.sendRaw(text, { command });
  },

  async sendRaw(message, extra = {}) {
    if (!this.session) await this.newSession();
    this.setProgress("Working...");
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
          pending_args: extra.pending_args ? JSON.stringify(extra.pending_args) : null,
        },
      });
      const payload = r.message || {};
      if (!payload.ok) {
        this.appendMessage("assistant", payload.error || "Error");
        this.setProgress("");
        return;
      }
      const data = payload.data || {};
      if (data.needs_confirmation) {
        this.pending = { tool: data.pending_tool, args: data.pending_args };
      }
      this.appendMessage("assistant", data.content || "", data.content_json);
      this.setProgress("");
    } catch (e) {
      this.appendMessage("assistant", e.message || "Request failed");
      this.setProgress("");
    }
  },

  bindRealtime() {
    if (!frappe.realtime || !frappe.realtime.on) return;
    frappe.realtime.on("chat_ai:progress", (data) => {
      if (!data) return;
      this.setProgress(data.label || data.stage || "");
      if (data.stage === "done") setTimeout(() => this.setProgress(""), 800);
    });
    frappe.realtime.on("chat_ai:stream", (data) => {
      // Streaming chunks can be appended in a future enhancement
      if (data && data.done) this.setProgress("");
    });
  },
};

$(document).ready(function () {
  if (frappe.session && frappe.session.user && frappe.session.user !== "Guest") {
    chat_ai.sidebar.init();
  }
});
