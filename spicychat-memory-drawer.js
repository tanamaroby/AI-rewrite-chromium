(function () {
  "use strict";

  /* Only run on SpicyChat chat pages */
  if (!/^\/chat\//.test(location.pathname)) return;

  chrome.storage.sync.get("spicychatNotesEnabled", (syncData) => {
    if (syncData.spicychatNotesEnabled === false) return;
    chrome.storage.local.get("sc_note_width_v1", (localData) => {
      init(localData["sc_note_width_v1"]);
    });
  });

  function init(savedWidth) {
    /* ── Constants ── */
    const MIN_W = 260;
    const MAX_W = 780;
    const DEFAULT_W = 360;
    const SAVE_DEBOUNCE = 800;
    const NOTE_PREFIX = "sc_note_v1_";
    const WIDTH_KEY = "sc_note_width_v1";

    /* Chat ID = last path segment, e.g. /chat/abc123 → "abc123" */
    const chatId =
      location.pathname.replace(/^\/chat\//, "").replace(/\/$/, "") ||
      "default";
    const storageKey = NOTE_PREFIX + chatId;

    /* Restore saved width */
    let DRAWER_W =
      typeof savedWidth === "number" && !isNaN(savedWidth)
        ? Math.min(MAX_W, Math.max(MIN_W, savedWidth))
        : DEFAULT_W;

    /* ── CSS ── */
    const style = document.createElement("style");
    style.textContent = `
    /* ── Drawer panel ── */
    #sc-np {
      position: fixed;
      top: 56px; right: 0;
      width: var(--sc-np-w, ${DEFAULT_W}px);
      height: calc(100dvh - 56px);
      background: #0f0e1a;
      border-left: 1px solid rgba(108, 99, 255, 0.28);
      box-shadow: -6px 0 32px rgba(0,0,0,0.55);
      z-index: 9000;
      display: flex;
      flex-direction: column;
      transform: translateX(100%);
      transition: transform 0.26s cubic-bezier(0.4,0,0.2,1);
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #sc-np.sc-np-open {
      transform: none;
      pointer-events: all;
    }

    /* ── Tab button ── */
    #sc-np-tab {
      position: fixed;
      top: 72px;
      right: 0;
      width: 28px; height: 56px;
      background: #1c1834;
      color: #a78bfa;
      border: 1px solid rgba(108,99,255,0.4);
      border-right: none;
      border-radius: 8px 0 0 8px;
      cursor: pointer;
      z-index: 8999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: right 0.26s cubic-bezier(0.4,0,0.2,1), background 0.15s;
    }
    #sc-np-tab:hover { background: #271f4a; }
    body.sc-np-open #sc-np-tab { right: var(--sc-np-w, ${DEFAULT_W}px); }

    /* ── Resize handle (fixed, above everything) ── */
    #sc-np-resize {
      position: fixed;
      top: 56px;
      right: var(--sc-np-w, ${DEFAULT_W}px);
      width: 10px;
      height: calc(100dvh - 56px);
      cursor: ew-resize;
      z-index: 9001;
      background: transparent;
      display: none;
    }
    body.sc-np-open #sc-np-resize { display: block; }
    #sc-np-resize::after {
      content: '';
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 4px; height: 48px;
      border-left: 2px dotted rgba(108,99,255,0.45);
      border-right: 2px dotted rgba(108,99,255,0.45);
      opacity: 0;
      transition: opacity 0.15s;
      pointer-events: none;
    }
    #sc-np-resize:hover::after,
    #sc-np-resize.sc-np-resizing::after { opacity: 1; }
    #sc-np-resize:hover,
    #sc-np-resize.sc-np-resizing { background: rgba(108,99,255,0.12); }

    /* ── Header ── */
    #sc-np-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 12px 8px;
      border-bottom: 1px solid rgba(108,99,255,0.18);
      flex-shrink: 0;
    }
    #sc-np-title {
      flex: 1;
      font-size: 12px;
      font-weight: 600;
      color: #a78bfa;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #sc-np-header button {
      background: none;
      border: none;
      cursor: pointer;
      color: #64748b;
      padding: 4px 5px;
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.12s, color 0.12s;
      flex-shrink: 0;
    }
    #sc-np-header button:hover { background: rgba(255,255,255,0.07); color: #e2e8f0; }
    #sc-np-header button.active { color: #a78bfa; background: rgba(108,99,255,0.15); }

    /* ── Status bar ── */
    #sc-np-status {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 12px;
      font-size: 10.5px;
      color: #475569;
      border-bottom: 1px solid rgba(108,99,255,0.1);
      flex-shrink: 0;
      gap: 8px;
    }
    #sc-np-status-left { display: flex; align-items: center; gap: 8px; }
    #sc-np-autosave {
      display: flex; align-items: center; gap: 4px;
      opacity: 0;
      transition: opacity 0.3s;
    }
    #sc-np-autosave.visible { opacity: 1; }
    #sc-np-autosave svg { color: #22c55e; }

    /* ── Body ── */
    #sc-np-body {
      flex: 1;
      overflow: hidden;
      position: relative;
    }
    #sc-np-textarea {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      background: transparent;
      border: none;
      outline: none;
      resize: none;
      color: #e2e8f0;
      font-size: 13.5px;
      line-height: 1.65;
      font-family: "JetBrains Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace;
      padding: 14px 16px;
      box-sizing: border-box;
      caret-color: #a78bfa;
    }
    #sc-np-textarea::selection { background: rgba(108,99,255,0.35); }
    #sc-np-textarea::placeholder { color: #334155; }
    #sc-np-preview {
      position: absolute;
      inset: 0;
      overflow-y: auto;
      padding: 14px 16px;
      box-sizing: border-box;
      color: #cbd5e1;
      font-size: 13.5px;
      line-height: 1.7;
      display: none;
    }
    #sc-np-preview.visible { display: block; }
    #sc-np-preview h1,#sc-np-preview h2,#sc-np-preview h3 { color: #a78bfa; margin: 0.9em 0 0.4em; font-weight: 600; }
    #sc-np-preview h1 { font-size: 1.3em; }
    #sc-np-preview h2 { font-size: 1.15em; }
    #sc-np-preview h3 { font-size: 1em; }
    #sc-np-preview strong { color: #e2e8f0; }
    #sc-np-preview em { color: #c4b5fd; font-style: italic; }
    #sc-np-preview code { background: rgba(108,99,255,0.18); border-radius: 3px; padding: 1px 5px; font-size: 0.9em; font-family: ui-monospace, monospace; color: #a78bfa; }
    #sc-np-preview pre { background: rgba(0,0,0,0.35); border-radius: 6px; padding: 10px 14px; overflow-x: auto; border: 1px solid rgba(108,99,255,0.2); }
    #sc-np-preview pre code { background: none; padding: 0; }
    #sc-np-preview blockquote { border-left: 3px solid rgba(108,99,255,0.5); margin: 0; padding-left: 12px; color: #94a3b8; }
    #sc-np-preview ul,#sc-np-preview ol { padding-left: 20px; }
    #sc-np-preview li { margin: 2px 0; }
    #sc-np-preview a { color: #818cf8; text-decoration: underline; }
    #sc-np-preview hr { border: none; border-top: 1px solid rgba(108,99,255,0.2); margin: 12px 0; }
    #sc-np-preview p { margin: 0.5em 0; }

    /* ── Scrollbar ── */
    #sc-np-textarea::-webkit-scrollbar,
    #sc-np-preview::-webkit-scrollbar { width: 5px; }
    #sc-np-textarea::-webkit-scrollbar-track,
    #sc-np-preview::-webkit-scrollbar-track { background: transparent; }
    #sc-np-textarea::-webkit-scrollbar-thumb,
    #sc-np-preview::-webkit-scrollbar-thumb { background: rgba(108,99,255,0.3); border-radius: 3px; }

    /* ── Clear confirm overlay ── */
    #sc-np-clear-confirm {
      display: none;
      position: absolute;
      inset: 0;
      background: rgba(15,12,30,0.92);
      backdrop-filter: blur(4px);
      z-index: 10;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      color: #cbd5e1;
      font-size: 13px;
      text-align: center;
      padding: 24px;
      box-sizing: border-box;
    }
    #sc-np-clear-confirm.visible { display: flex; }
    #sc-np-clear-confirm p { margin: 0; color: #94a3b8; font-size: 12px; }
    .sc-np-confirm-btns { display: flex; gap: 10px; }
    .sc-np-confirm-btns button { padding: 7px 18px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-family: inherit; font-weight: 500; }
    #sc-np-confirm-yes { background: #ef4444; color: #fff; }
    #sc-np-confirm-yes:hover { background: #dc2626; }
    #sc-np-confirm-no { background: rgba(108,99,255,0.2); color: #a78bfa; border: 1px solid rgba(108,99,255,0.3); }
    #sc-np-confirm-no:hover { background: rgba(108,99,255,0.3); }
    `;
    document.head.appendChild(style);

    /* ── DOM ── */
    const drawer = document.createElement("div");
    drawer.id = "sc-np";
    drawer.innerHTML = `
      <div id="sc-np-header">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
          <line x1="10" y1="9" x2="8" y2="9"/>
        </svg>
        <span id="sc-np-title">Notes</span>
        <button id="sc-np-btn-preview" title="Toggle Markdown preview (Ctrl+P)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button id="sc-np-btn-export" title="Export note as .txt">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <button id="sc-np-btn-clear" title="Clear note">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
        <button id="sc-np-btn-close" title="Close (Esc)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div id="sc-np-status">
        <div id="sc-np-status-left">
          <span id="sc-np-wc">0 words</span>
          <span id="sc-np-cc">0 chars</span>
        </div>
        <div id="sc-np-autosave">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Saved</span>
        </div>
        <span id="sc-np-lastmod"></span>
      </div>
      <div id="sc-np-body">
        <textarea id="sc-np-textarea" data-ai-rewriter-ignore="1" placeholder="Start typing your notes for this chat\u2026&#10;&#10;Supports Markdown \u2014 click \ud83d\udc41\ufe0f to preview. Ctrl+S to save now."></textarea>
        <div id="sc-np-preview"></div>
        <div id="sc-np-clear-confirm">
          <strong>Clear this note?</strong>
          <p>This will permanently delete the note for this chat.</p>
          <div class="sc-np-confirm-btns">
            <button id="sc-np-confirm-yes">Clear</button>
            <button id="sc-np-confirm-no">Cancel</button>
          </div>
        </div>
      </div>
    `;

    const tab = document.createElement("button");
    tab.id = "sc-np-tab";
    tab.setAttribute("aria-label", "Toggle notes drawer");
    tab.title = "Notes";
    tab.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;

    const resizeHandle = document.createElement("div");
    resizeHandle.id = "sc-np-resize";
    resizeHandle.title = "Drag to resize";

    document.body.appendChild(drawer);
    document.body.appendChild(tab);
    document.body.appendChild(resizeHandle);

    /* ── Element refs ── */
    const textarea = document.getElementById("sc-np-textarea");
    const preview = document.getElementById("sc-np-preview");
    const wcEl = document.getElementById("sc-np-wc");
    const ccEl = document.getElementById("sc-np-cc");
    const autosaveEl = document.getElementById("sc-np-autosave");
    const lastmodEl = document.getElementById("sc-np-lastmod");
    const clearConfirm = document.getElementById("sc-np-clear-confirm");
    const btnPreview = document.getElementById("sc-np-btn-preview");
    const btnExport = document.getElementById("sc-np-btn-export");
    const btnClear = document.getElementById("sc-np-btn-clear");
    const btnClose = document.getElementById("sc-np-btn-close");
    const confirmYes = document.getElementById("sc-np-confirm-yes");
    const confirmNo = document.getElementById("sc-np-confirm-no");

    /* ── State ── */
    let isOpen = false;
    let previewMode = false;
    let saveTimer = null;
    let autosaveTimer = null;

    /* ── CSS variable init ── */
    document.documentElement.style.setProperty("--sc-np-w", DRAWER_W + "px");

    /* ── Load saved note ── */
    function loadNote() {
      chrome.storage.local.get(storageKey, (data) => {
        const parsed = data[storageKey];
        if (parsed) {
          textarea.value = parsed.text || "";
          if (parsed.lastmod) updateLastmod(parsed.lastmod);
        }
        updateStats();
      });
    }

    /* ── Save ── */
    function saveNote() {
      const text = textarea.value;
      const lastmod = Date.now();
      chrome.storage.local.set({ [storageKey]: { text, lastmod } });
      updateLastmod(lastmod);
      showAutosave();
    }

    function scheduleSave() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveNote, SAVE_DEBOUNCE);
    }

    function showAutosave() {
      autosaveEl.classList.add("visible");
      clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(
        () => autosaveEl.classList.remove("visible"),
        1800,
      );
    }

    /* ── Stats ── */
    function updateStats() {
      const text = textarea.value;
      const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
      wcEl.textContent = words + (words === 1 ? " word" : " words");
      ccEl.textContent = text.length + (text.length === 1 ? " char" : " chars");
    }

    function updateLastmod(ts) {
      const d = new Date(ts);
      lastmodEl.textContent =
        "Saved " +
        d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    /* ── Lightweight Markdown renderer ── */
    function renderMarkdown(md) {
      const html = md
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(
          /```([\s\S]*?)```/g,
          (_, c) => "<pre><code>" + c.trim() + "</code></pre>",
        )
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/^### (.+)$/gm, "<h3>$1</h3>")
        .replace(/^## (.+)$/gm, "<h2>$1</h2>")
        .replace(/^# (.+)$/gm, "<h1>$1</h1>")
        .replace(/^---+$/gm, "<hr>")
        .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
        .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/__(.+?)__/g, "<strong>$1</strong>")
        .replace(/_(.+?)_/g, "<em>$1</em>")
        .replace(/^\s*[-*+] (.+)$/gm, "<li>$1</li>")
        .replace(/(<li>.*<\/li>)\n(?!<li>)/g, "<ul>$1</ul>")
        .replace(/^\s*\d+\. (.+)$/gm, "<li>$1</li>")
        .replace(
          /\[([^\]]+)\]\(([^)]+)\)/g,
          '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
        )
        .replace(/\n{2,}/g, "</p><p>")
        .replace(/\n/g, "<br>");
      return "<p>" + html + "</p>";
    }

    /* ── Preview toggle ── */
    function setPreview(on) {
      previewMode = on;
      btnPreview.classList.toggle("active", on);
      if (on) {
        preview.innerHTML = renderMarkdown(textarea.value);
        preview.classList.add("visible");
        textarea.style.display = "none";
      } else {
        preview.classList.remove("visible");
        textarea.style.display = "";
        textarea.focus();
      }
    }

    /* ── Open / close ── */
    function setOpen(val) {
      isOpen = val;
      drawer.classList.toggle("sc-np-open", val);
      document.body.classList.toggle("sc-np-open", val);
      if (val) textarea.focus();
    }

    /* ── Textarea events ── */
    textarea.addEventListener("input", () => {
      updateStats();
      if (previewMode) preview.innerHTML = renderMarkdown(textarea.value);
      scheduleSave();
    });

    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const s = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value =
          textarea.value.slice(0, s) + "  " + textarea.value.slice(end);
        textarea.selectionStart = textarea.selectionEnd = s + 2;
        scheduleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        setPreview(!previewMode);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        clearTimeout(saveTimer);
        saveNote();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        isOpen &&
        clearConfirm.classList.contains("visible")
      ) {
        clearConfirm.classList.remove("visible");
      } else if (e.key === "Escape" && isOpen) {
        setOpen(false);
      }
    });

    /* ── Button events ── */
    tab.addEventListener("click", () => setOpen(!isOpen));
    btnClose.addEventListener("click", () => setOpen(false));
    btnPreview.addEventListener("click", () => setPreview(!previewMode));

    btnExport.addEventListener("click", () => {
      const blob = new Blob([textarea.value], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "notes-" + chatId + ".txt";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    btnClear.addEventListener("click", () =>
      clearConfirm.classList.add("visible"),
    );
    confirmNo.addEventListener("click", () =>
      clearConfirm.classList.remove("visible"),
    );
    confirmYes.addEventListener("click", () => {
      textarea.value = "";
      chrome.storage.local.remove(storageKey);
      updateStats();
      lastmodEl.textContent = "";
      clearConfirm.classList.remove("visible");
      if (previewMode) setPreview(false);
    });

    /* ── Drag-to-resize ── */
    let resizing = false;
    let resizeStartX = 0;
    let resizeStartW = 0;

    resizeHandle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      resizing = true;
      resizeStartX = e.clientX;
      resizeStartW = DRAWER_W;
      resizeHandle.classList.add("sc-np-resizing");
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
    });

    document.addEventListener("mousemove", (e) => {
      if (!resizing) return;
      const delta = resizeStartX - e.clientX;
      const newW = Math.min(MAX_W, Math.max(MIN_W, resizeStartW + delta));
      DRAWER_W = newW;
      document.documentElement.style.setProperty("--sc-np-w", newW + "px");
    });

    document.addEventListener("mouseup", () => {
      if (!resizing) return;
      resizing = false;
      resizeHandle.classList.remove("sc-np-resizing");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      chrome.storage.local.set({ [WIDTH_KEY]: DRAWER_W });
    });

    /* ── Boot ── */
    loadNote();
    setOpen(true);
  }
})();
