(function () {
  "use strict";

  /* Only run on SpicyChat chat pages */
  if (!/^\/chat\//.test(location.pathname)) return;
  /* PC only — skip on touch/mobile devices */
  if ("ontouchstart" in window || navigator.maxTouchPoints > 1) return;

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
      top: 0; right: 0;
      width: var(--sc-np-w, ${DEFAULT_W}px);
      height: 100dvh;
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
    html.sc-np-open #sc-np-tab { right: var(--sc-np-w, ${DEFAULT_W}px); }

    /* ── Resize handle (fixed, above everything) ── */
    #sc-np-resize {
      position: fixed;
      top: 0;
      right: var(--sc-np-w, ${DEFAULT_W}px);
      width: 10px;
      height: 100dvh;
      cursor: ew-resize;
      z-index: 9001;
      background: transparent;
      display: none;
    }
    html.sc-np-open #sc-np-resize { display: block; }
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

    /* ── Page shrink ── */
    /* transform: translateX(0) (non-none) makes body the containing block   */
    /* for position:fixed children, so they shrink with body's width.         */
    body {
      transition: width 0.26s cubic-bezier(0.4,0,0.2,1);
    }
    html.sc-np-open body {
      transform: translateX(0);
      width: calc(100vw - var(--sc-np-w, ${DEFAULT_W}px));
      max-width: calc(100vw - var(--sc-np-w, ${DEFAULT_W}px));
      overflow-x: hidden;
    }

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

    /* ── Notes panel ── */
    #sc-np-notes-panel { position: absolute; inset: 0; }
    #sc-np-notes-panel.sc-np-hidden { display: none; }

    /* ── Tab strip ── */
    #sc-np-tabstrip { display: flex; gap: 3px; flex: 1; align-items: center; }
    #sc-np-notes-btns { display: flex; align-items: center; gap: 0; }
    #sc-np-tabstrip .sc-np-tab-pill {
      padding: 3px 10px; border-radius: 100px; border: 1px solid transparent;
      background: none; color: #64748b; font-size: 10.5px; font-weight: 600;
      cursor: pointer; letter-spacing: 0.04em; text-transform: uppercase;
      transition: background 0.12s, color 0.12s, border-color 0.12s;
      white-space: nowrap; font-family: inherit; line-height: 1;
    }
    #sc-np-tabstrip .sc-np-tab-pill:hover { color: #a78bfa; background: rgba(108,99,255,0.1); }
    #sc-np-tabstrip .sc-np-tab-pill.active {
      background: rgba(108,99,255,0.2); border-color: rgba(108,99,255,0.4); color: #a78bfa;
    }

    /* ── RP Tools panel ── */
    #sc-np-rp-panel {
      position: absolute; inset: 0; overflow-y: auto;
      padding: 14px; box-sizing: border-box;
      display: none; flex-direction: column; gap: 12px;
    }
    #sc-np-rp-panel.visible { display: flex; }
    #sc-np-rp-panel::-webkit-scrollbar { width: 5px; }
    #sc-np-rp-panel::-webkit-scrollbar-track { background: transparent; }
    #sc-np-rp-panel::-webkit-scrollbar-thumb { background: rgba(108,99,255,0.3); border-radius: 3px; }
    .rp-section-label { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #475569; }
    .rp-card {
      background: rgba(255,255,255,0.03); border: 1px solid rgba(108,99,255,0.18);
      border-radius: 8px; padding: 12px 14px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .rp-toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .rp-toggle-label { font-size: 12px; font-weight: 600; color: #cbd5e1; }
    .rp-input {
      width: 100%; box-sizing: border-box;
      background: rgba(0,0,0,0.3); border: 1px solid rgba(108,99,255,0.2);
      border-radius: 6px; color: #e2e8f0; font-size: 12.5px; font-family: inherit;
      padding: 7px 10px; outline: none; transition: border-color 0.15s;
    }
    .rp-input:focus { border-color: rgba(108,99,255,0.55); }
    .rp-input::placeholder { color: #334155; }
    .rp-textarea { resize: vertical; min-height: 78px; line-height: 1.5; caret-color: #a78bfa; }
    .rp-hint { font-size: 11px; color: #475569; }
    .rp-autosave {
      display: flex; align-items: center; gap: 4px;
      font-size: 10.5px; color: #22c55e;
      opacity: 0; transition: opacity 0.3s; height: 14px;
    }
    .rp-autosave.visible { opacity: 1; }
    .rp-toggle { position: relative; width: 32px; height: 18px; flex-shrink: 0; cursor: pointer; }
    .rp-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
    .rp-toggle-track {
      position: absolute; inset: 0;
      background: rgba(255,255,255,0.08); border-radius: 100px;
      border: 1px solid rgba(108,99,255,0.25);
      transition: background 0.2s, border-color 0.2s;
    }
    .rp-toggle-track::after {
      content: ''; position: absolute; top: 2px; left: 2px;
      width: 12px; height: 12px; background: #64748b; border-radius: 50%;
      transition: transform 0.2s, background 0.2s;
    }
    .rp-toggle input:checked ~ .rp-toggle-track { background: rgba(108,99,255,0.35); border-color: rgba(108,99,255,0.6); }
    .rp-toggle input:checked ~ .rp-toggle-track::after { transform: translateX(14px); background: #a78bfa; }
    .rp-rewrite-meta { font-size: 11px; color: #64748b; display: flex; align-items: center; justify-content: space-between; }
    .rp-rewrite-label { font-weight: 600; color: #a78bfa; }
    .rp-diff-block { display: flex; flex-direction: column; gap: 6px; }
    .rp-diff-before, .rp-diff-after { border-radius: 6px; padding: 8px 10px; font-size: 12px; line-height: 1.5; color: #cbd5e1; }
    .rp-diff-before { background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.18); }
    .rp-diff-after  { background: rgba(34,197,94,0.07);  border: 1px solid rgba(34,197,94,0.18); }
    .rp-diff-cap { font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; display: block; margin-bottom: 3px; }
    .rp-diff-before .rp-diff-cap { color: rgba(239,68,68,0.55); }
    .rp-diff-after  .rp-diff-cap { color: rgba(34,197,94,0.55); }
    .rp-diff-text { color: #94a3b8; font-size: 12px; word-break: break-word; }
    .rp-empty-state { text-align: center; color: #334155; font-size: 12px; padding: 16px 0; }
    #sc-rp-undo-btn {
      display: flex; align-items: center; justify-content: center; gap: 7px;
      width: 100%; padding: 9px; border-radius: 7px;
      border: 1px solid rgba(108,99,255,0.35);
      background: rgba(108,99,255,0.12);
      color: #a78bfa; font-size: 13px; font-weight: 600;
      font-family: inherit; cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    #sc-rp-undo-btn:hover { background: rgba(108,99,255,0.22); border-color: rgba(108,99,255,0.55); }
    #sc-rp-undo-btn:disabled { opacity: 0.35; cursor: not-allowed; }

    /* ── Input counter ── */
    .rp-counter-stats { font-size: 12.5px; color: #334155; font-weight: 500; transition: color 0.2s; }
    .rp-counter-stats.active { color: #a78bfa; }

    /* ── Snippets ── */
    .rp-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0; }
    .rp-section-header .rp-section-label { margin-bottom: 0; }
    .rp-micro-btn { font-size: 10px; font-weight: 700; letter-spacing: 0.04em; color: #64748b; background: none; border: 1px solid rgba(108,99,255,0.22); border-radius: 5px; padding: 2px 8px; cursor: pointer; font-family: inherit; transition: color 0.12s, border-color 0.12s, background 0.12s; }
    .rp-micro-btn:hover { color: #a78bfa; border-color: rgba(108,99,255,0.45); }
    .rp-micro-btn.active { color: #a78bfa; border-color: rgba(108,99,255,0.5); background: rgba(108,99,255,0.1); }
    .rp-snip-chips { display: flex; flex-wrap: wrap; gap: 6px; min-height: 20px; }
    .rp-snip-chip { padding: 5px 12px; border-radius: 100px; border: 1px solid rgba(108,99,255,0.3); background: rgba(108,99,255,0.1); color: #c4b5fd; font-size: 11.5px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background 0.12s, border-color 0.12s, transform 0.08s; white-space: nowrap; }
    .rp-snip-chip:hover { background: rgba(108,99,255,0.22); border-color: rgba(108,99,255,0.55); }
    .rp-snip-chip:active { transform: scale(0.94); }
    .rp-snip-row { display: flex; flex-direction: column; gap: 5px; padding-bottom: 10px; border-bottom: 1px solid rgba(108,99,255,0.08); margin-bottom: 10px; }
    .rp-snip-row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .rp-snip-row-num { font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #334155; }

    /* ── One-shot + shared action button ── */
    .rp-action-btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; border-radius: 6px; border: 1px solid rgba(108,99,255,0.3); background: rgba(108,99,255,0.12); color: #a78bfa; font-size: 12px; font-weight: 600; font-family: inherit; cursor: pointer; transition: background 0.12s, border-color 0.12s; flex-shrink: 0; }
    .rp-action-btn:hover:not(:disabled) { background: rgba(108,99,255,0.22); border-color: rgba(108,99,255,0.5); }
    .rp-action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .rp-status-ok { color: #22c55e !important; }
    .rp-status-err { color: #f87171 !important; }
    `;
    document.head.appendChild(style);

    /* ── DOM ── */
    const drawer = document.createElement("div");
    drawer.id = "sc-np";
    drawer.innerHTML = `
      <div id="sc-np-header">
        <div id="sc-np-tabstrip">
          <button class="sc-np-tab-pill active" data-tab="notes">Notes</button>
          <button class="sc-np-tab-pill" data-tab="rp">RP Tools</button>
        </div>
        <div id="sc-np-notes-btns">
          <button id="sc-np-btn-preview" title="Toggle Markdown preview (Ctrl+P)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button id="sc-np-btn-export" title="Export note as .txt">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          <button id="sc-np-btn-clear" title="Clear note">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
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
        <div id="sc-np-notes-panel">
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
        <div id="sc-np-rp-panel">
          <div class="rp-section-label">Focused Input</div>
          <div class="rp-card" style="padding:10px 14px;">
            <span id="sc-rp-ic-stats" class="rp-counter-stats">No input focused</span>
          </div>
          <div class="rp-section-header">
            <div class="rp-section-label">Quick Snippets</div>
            <button id="sc-rp-snip-edit-btn" class="rp-micro-btn">Edit</button>
          </div>
          <div class="rp-card" id="sc-rp-snip-chips-card">
            <div id="sc-rp-snip-chips" class="rp-snip-chips"></div>
          </div>
          <div class="rp-card" id="sc-rp-snip-edit-card" style="display:none;">
            <div id="sc-rp-snip-rows"></div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
              <button id="sc-rp-snip-save-btn" class="rp-action-btn">Save</button>
              <div class="rp-autosave" id="sc-rp-snip-saved">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Saved
              </div>
            </div>
          </div>
          <div class="rp-section-label">One-Shot Rewrite</div>
          <div class="rp-card">
            <div class="rp-hint" style="margin-bottom:6px;">Custom prompt — runs on the focused chat input. Persona prepend applies if enabled.</div>
            <textarea id="sc-rp-oneshot-prompt" class="rp-input rp-textarea" style="min-height:60px;" placeholder="e.g. Make this more poetic and melancholy." data-ai-rewriter-ignore="1"></textarea>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <button id="sc-rp-oneshot-run" class="rp-action-btn">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Run
              </button>
              <span id="sc-rp-oneshot-status" class="rp-hint"></span>
            </div>
          </div>
          <div class="rp-section-label">Global Style Rules</div>
          <div class="rp-card">
            <div class="rp-hint" style="margin-bottom:6px;">Applied to <em>every</em> rewrite on SpicyChat — defines your universal writing style and constraints.</div>
            <textarea id="sc-rp-global-style" class="rp-input rp-textarea" style="min-height:88px;" data-ai-rewriter-ignore="1" placeholder="e.g. Rewrite text for clarity, flow, and word choice—simple and natural, not poetic. Speech distortions apply only to spoken dialogue (in quotes). Don&#39;t add plot, characters, events, paragraphs, or sentences. Max 3 sentences per paragraph."></textarea>
            <div class="rp-autosave" id="sc-rp-gs-autosave">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Saved
            </div>
          </div>
          <div class="rp-section-label">Persona</div>
          <div class="rp-card">
            <div class="rp-toggle-row">
              <span class="rp-toggle-label">Enable persona prepend</span>
              <label class="rp-toggle">
                <input type="checkbox" id="sc-rp-persona-enabled" />
                <span class="rp-toggle-track"></span>
              </label>
            </div>
            <div>
              <div class="rp-hint" style="margin-bottom:6px;">Your name &mdash; replaces <code style="background:rgba(108,99,255,0.15);padding:1px 5px;border-radius:3px;font-size:10.5px;color:#a78bfa;">{{user}}</code> in the prepend</div>
              <input type="text" id="sc-rp-persona-name" class="rp-input" placeholder="Your persona name…" data-ai-rewriter-ignore="1" />
            </div>
            <div>
              <div class="rp-hint" style="margin-bottom:6px;">Injected before every rewrite prompt on SpicyChat</div>
              <textarea id="sc-rp-persona-prepend" class="rp-input rp-textarea" placeholder="e.g. You are writing a collaborative story. The human character is named {{user}}. Stay in character." data-ai-rewriter-ignore="1"></textarea>
            </div>
            <div class="rp-autosave" id="sc-rp-autosave">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Saved
            </div>
          </div>
          <div class="rp-section-label">Last Rewrite</div>
          <div class="rp-card">
            <div class="rp-empty-state" id="sc-rp-empty">No rewrite recorded yet.</div>
            <div id="sc-rp-rewrite-info" style="display:none; flex-direction:column; gap:8px;">
              <div class="rp-rewrite-meta">
                <span class="rp-rewrite-label" id="sc-rp-rewrite-label"></span>
                <span id="sc-rp-rewrite-ts"></span>
              </div>
              <div class="rp-diff-block">
                <div class="rp-diff-before">
                  <span class="rp-diff-cap">Before</span>
                  <div class="rp-diff-text" id="sc-rp-before-text"></div>
                </div>
                <div class="rp-diff-after">
                  <span class="rp-diff-cap">After</span>
                  <div class="rp-diff-text" id="sc-rp-after-text"></div>
                </div>
              </div>
              <button id="sc-rp-undo-btn" disabled>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>
                Undo Rewrite
              </button>
            </div>
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

    document.documentElement.appendChild(drawer);
    document.documentElement.appendChild(tab);
    document.documentElement.appendChild(resizeHandle);

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
    const notesPanel = document.getElementById("sc-np-notes-panel");
    const rpPanel = document.getElementById("sc-np-rp-panel");
    const statusBar = document.getElementById("sc-np-status");
    const notesBtns = document.getElementById("sc-np-notes-btns");
    const rpPersonaEnabledCb = document.getElementById("sc-rp-persona-enabled");
    const rpPersonaNameInput = document.getElementById("sc-rp-persona-name");
    const rpPersonaPrependTa = document.getElementById("sc-rp-persona-prepend");
    const rpAutosaveEl = document.getElementById("sc-rp-autosave");
    const rpEmptyEl = document.getElementById("sc-rp-empty");
    const rpRewriteInfo = document.getElementById("sc-rp-rewrite-info");
    const rpRewriteLabelEl = document.getElementById("sc-rp-rewrite-label");
    const rpRewriteTsEl = document.getElementById("sc-rp-rewrite-ts");
    const rpBeforeTextEl = document.getElementById("sc-rp-before-text");
    const rpAfterTextEl = document.getElementById("sc-rp-after-text");
    const rpUndoBtn = document.getElementById("sc-rp-undo-btn");
    const rpIcStats = document.getElementById("sc-rp-ic-stats");
    const snipChipsCard = document.getElementById("sc-rp-snip-chips-card");
    const snipEditCard = document.getElementById("sc-rp-snip-edit-card");
    const snipChipsEl = document.getElementById("sc-rp-snip-chips");
    const snipRowsEl = document.getElementById("sc-rp-snip-rows");
    const snipEditBtn = document.getElementById("sc-rp-snip-edit-btn");
    const snipSaveBtn = document.getElementById("sc-rp-snip-save-btn");
    const snipSavedEl = document.getElementById("sc-rp-snip-saved");
    const oneshotPromptTa = document.getElementById("sc-rp-oneshot-prompt");
    const oneshotRunBtn = document.getElementById("sc-rp-oneshot-run");
    const oneshotStatusEl = document.getElementById("sc-rp-oneshot-status");
    const rpGlobalStyleTa = document.getElementById("sc-rp-global-style");
    const rpGsAutosaveEl = document.getElementById("sc-rp-gs-autosave");

    /* ── State ── */
    let isOpen = false;
    let previewMode = false;
    let saveTimer = null;
    let autosaveTimer = null;
    let activeTab = "notes";
    let rpSaveTimer = null;
    let rpAutosaveTimer = null;
    const MAX_SNIPPETS = 5;
    let rpSnippets = Array.from({ length: MAX_SNIPPETS }, () => ({
      label: "",
      text: "",
    }));
    let snipEditMode = false;

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
      document.documentElement.classList.toggle("sc-np-open", val);
      if (val && activeTab === "notes") textarea.focus();
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

    /* ── Tab switching ── */
    function setTab(tab) {
      activeTab = tab;
      document.querySelectorAll(".sc-np-tab-pill").forEach((p) => {
        p.classList.toggle("active", p.dataset.tab === tab);
      });
      notesPanel.classList.toggle("sc-np-hidden", tab !== "notes");
      rpPanel.classList.toggle("visible", tab === "rp");
      statusBar.style.display = tab === "notes" ? "" : "none";
      notesBtns.style.display = tab === "notes" ? "" : "none";
      if (previewMode && tab !== "notes") setPreview(false);
      if (tab !== "notes" && clearConfirm.classList.contains("visible")) {
        clearConfirm.classList.remove("visible");
      }
      if (tab === "notes" && isOpen) textarea.focus();
    }

    document.querySelectorAll(".sc-np-tab-pill").forEach((btn) => {
      btn.addEventListener("click", () => setTab(btn.dataset.tab));
    });

    /* ── Persona save/load ── */
    function savePersona() {
      chrome.storage.sync.set({
        rpPersonaEnabled: rpPersonaEnabledCb.checked,
        rpPersonaName: rpPersonaNameInput.value,
        rpPersonaPrepend: rpPersonaPrependTa.value,
      });
      rpAutosaveEl.classList.add("visible");
      clearTimeout(rpAutosaveTimer);
      rpAutosaveTimer = setTimeout(
        () => rpAutosaveEl.classList.remove("visible"),
        1800,
      );
    }

    function schedulePersonaSave() {
      clearTimeout(rpSaveTimer);
      rpSaveTimer = setTimeout(savePersona, 600);
    }

    rpPersonaEnabledCb.addEventListener("change", savePersona);
    rpPersonaNameInput.addEventListener("input", schedulePersonaSave);
    rpPersonaPrependTa.addEventListener("input", schedulePersonaSave);

    chrome.storage.sync.get(
      ["rpPersonaEnabled", "rpPersonaName", "rpPersonaPrepend"],
      (data) => {
        rpPersonaEnabledCb.checked = data.rpPersonaEnabled === true;
        rpPersonaNameInput.value = data.rpPersonaName || "";
        rpPersonaPrependTa.value = data.rpPersonaPrepend || "";
      },
    );

    /* ── Undo state display ── */
    function showRewriteState(detail) {
      rpEmptyEl.style.display = "none";
      rpRewriteInfo.style.display = "flex";
      rpRewriteLabelEl.textContent = detail.label || "Rewrite";
      rpRewriteTsEl.textContent = new Date(detail.ts).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const cap = 220;
      rpBeforeTextEl.textContent =
        detail.before.length > cap
          ? detail.before.slice(0, cap) + "\u2026"
          : detail.before;
      rpAfterTextEl.textContent =
        detail.after.length > cap
          ? detail.after.slice(0, cap) + "\u2026"
          : detail.after;
      rpUndoBtn.disabled = false;
    }

    function clearRewriteState() {
      rpEmptyEl.style.display = "";
      rpRewriteInfo.style.display = "none";
    }

    document.addEventListener("sc-rp-rewrite-done", (e) =>
      showRewriteState(e.detail),
    );
    document.addEventListener("sc-rp-undo-done", () => clearRewriteState());

    rpUndoBtn.addEventListener("click", () => {
      rpUndoBtn.disabled = true;
      document.dispatchEvent(new CustomEvent("sc-rp-undo"));
    });

    /* Load last rewrite state (persists across page loads) */
    chrome.storage.local.get("sc_last_rewrite", (data) => {
      if (data.sc_last_rewrite) showRewriteState(data.sc_last_rewrite);
    });

    /* ── Global Style Rules ── */
    let rpGsSaveTimer = null;
    let rpGsAutosaveTimer = null;

    const DEFAULT_GLOBAL_STYLE =
      "Rewrite text for clarity, flow, and word choice\u2014simple and natural, not poetic. " +
      "Speech distortions apply only to spoken dialogue (in quotes). " +
      "Don't add plot, characters, events, paragraphs, or sentences. " +
      "Max 3 sentences per paragraph.";

    function saveGlobalStyle() {
      chrome.storage.sync.set({ rpGlobalStyle: rpGlobalStyleTa.value });
      rpGsAutosaveEl.classList.add("visible");
      clearTimeout(rpGsAutosaveTimer);
      rpGsAutosaveTimer = setTimeout(
        () => rpGsAutosaveEl.classList.remove("visible"),
        1800,
      );
    }

    rpGlobalStyleTa.addEventListener("input", () => {
      clearTimeout(rpGsSaveTimer);
      rpGsSaveTimer = setTimeout(saveGlobalStyle, 600);
    });

    chrome.storage.sync.get("rpGlobalStyle", (data) => {
      rpGlobalStyleTa.value =
        data.rpGlobalStyle !== undefined
          ? data.rpGlobalStyle
          : DEFAULT_GLOBAL_STYLE;
    });

    /* ── Input counter ── */
    document.addEventListener("sc-rp-input-stats", (e) => {
      const { chars, words } = e.detail;
      rpIcStats.textContent = `${chars.toLocaleString()} chars \u00b7 ${words.toLocaleString()} words`;
      rpIcStats.classList.add("active");
    });

    document.addEventListener("sc-rp-input-blur", () => {
      rpIcStats.textContent = "No input focused";
      rpIcStats.classList.remove("active");
    });

    /* ── Snippets ── */
    function renderSnippetChips() {
      snipChipsEl.innerHTML = "";
      const hasSome = rpSnippets.some((s) => s.label.trim() || s.text.trim());
      if (!hasSome) {
        const empty = document.createElement("span");
        empty.className = "rp-empty-state";
        empty.style.padding = "8px 0";
        empty.textContent = "No snippets \u2014 click Edit to add.";
        snipChipsEl.appendChild(empty);
        return;
      }
      rpSnippets.forEach((s, i) => {
        if (!s.label.trim() && !s.text.trim()) return;
        const btn = document.createElement("button");
        btn.className = "rp-snip-chip";
        btn.textContent = s.label.trim() || `Snippet ${i + 1}`;
        btn.title = s.text.slice(0, 120);
        btn.addEventListener("click", () => {
          document.dispatchEvent(
            new CustomEvent("sc-rp-inject", { detail: { text: s.text } }),
          );
        });
        snipChipsEl.appendChild(btn);
      });
    }

    function buildSnippetEditor() {
      snipRowsEl.innerHTML = "";
      rpSnippets.forEach((s, i) => {
        const row = document.createElement("div");
        row.className = "rp-snip-row";
        const num = document.createElement("span");
        num.className = "rp-snip-row-num";
        num.textContent = `Snippet ${i + 1}`;
        const labelIn = document.createElement("input");
        labelIn.type = "text";
        labelIn.className = "rp-input rp-snip-label-input";
        labelIn.placeholder = "Label (e.g. Scene intro)";
        labelIn.value = s.label;
        labelIn.maxLength = 30;
        labelIn.setAttribute("data-ai-rewriter-ignore", "1");
        const textTa = document.createElement("textarea");
        textTa.className = "rp-input rp-textarea rp-snip-text-input";
        textTa.placeholder = "Text to insert\u2026";
        textTa.style.minHeight = "52px";
        textTa.setAttribute("data-ai-rewriter-ignore", "1");
        textTa.value = s.text;
        row.appendChild(num);
        row.appendChild(labelIn);
        row.appendChild(textTa);
        snipRowsEl.appendChild(row);
      });
    }

    function readSnippetsFromEditor() {
      snipRowsEl.querySelectorAll(".rp-snip-row").forEach((row, i) => {
        rpSnippets[i] = {
          label: row.querySelector(".rp-snip-label-input").value,
          text: row.querySelector(".rp-snip-text-input").value,
        };
      });
    }

    function setSnipEditMode(on) {
      snipEditMode = on;
      snipEditBtn.textContent = on ? "Done" : "Edit";
      snipEditBtn.classList.toggle("active", on);
      snipChipsCard.style.display = on ? "none" : "";
      snipEditCard.style.display = on ? "" : "none";
      if (on) buildSnippetEditor();
      else renderSnippetChips();
    }

    snipEditBtn.addEventListener("click", () => {
      if (snipEditMode) {
        readSnippetsFromEditor();
        chrome.storage.sync.set({ rpSnippets });
        setSnipEditMode(false);
      } else {
        setSnipEditMode(true);
      }
    });

    snipSaveBtn.addEventListener("click", () => {
      readSnippetsFromEditor();
      chrome.storage.sync.set({ rpSnippets });
      renderSnippetChips();
      snipSavedEl.classList.add("visible");
      clearTimeout(snipSaveBtn._t);
      snipSaveBtn._t = setTimeout(
        () => snipSavedEl.classList.remove("visible"),
        1800,
      );
    });

    chrome.storage.sync.get("rpSnippets", (data) => {
      if (Array.isArray(data.rpSnippets)) {
        data.rpSnippets.forEach((s, i) => {
          if (i < MAX_SNIPPETS)
            rpSnippets[i] = { label: s.label || "", text: s.text || "" };
        });
      }
      renderSnippetChips();
    });

    /* ── One-shot ── */
    oneshotRunBtn.addEventListener("click", () => {
      const prompt = oneshotPromptTa.value.trim();
      if (!prompt) {
        oneshotStatusEl.textContent = "Enter a prompt first.";
        oneshotStatusEl.className = "rp-hint rp-status-err";
        return;
      }
      oneshotRunBtn.disabled = true;
      oneshotStatusEl.textContent = "Running\u2026";
      oneshotStatusEl.className = "rp-hint";
      document.dispatchEvent(
        new CustomEvent("sc-rp-run-oneshot", { detail: { prompt } }),
      );
    });

    document.addEventListener("sc-rp-oneshot-result", (e) => {
      oneshotRunBtn.disabled = false;
      if (e.detail.error) {
        oneshotStatusEl.textContent = e.detail.error;
        oneshotStatusEl.className = "rp-hint rp-status-err";
      } else {
        oneshotStatusEl.textContent = `\u2713 Done \u00b7 ${e.detail.model} \u00b7 ${e.detail.elapsed}s`;
        oneshotStatusEl.className = "rp-hint rp-status-ok";
      }
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
