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
    const WIDTH_KEY = "sc_note_width_v1";

    /* Chat ID = last path segment, e.g. /chat/abc123 → "abc123" */
    const chatId =
      location.pathname.replace(/^\/chat\//, "").replace(/\/$/, "") ||
      "default";

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

    /* ── Activity log strip ── */
    #sc-np-log-strip {
      flex-shrink: 0;
      background: rgba(0,0,0,0.28);
      border-bottom: 1px solid rgba(108,99,255,0.14);
      padding: 0;
      display: flex; flex-direction: column;
      max-height: 0; overflow: hidden;
      transition: max-height 0.25s cubic-bezier(0.4,0,0.2,1);
    }
    #sc-np-log-strip.has-entries { max-height: 148px; }
    #sc-np-log-strip-inner {
      display: flex; flex-direction: column; gap: 0;
      overflow-y: auto; max-height: 118px;
      padding: 5px 10px 4px;
    }
    #sc-np-log-strip-inner::-webkit-scrollbar { width: 3px; }
    #sc-np-log-strip-inner::-webkit-scrollbar-thumb { background: rgba(108,99,255,0.25); border-radius: 2px; }
    .log-entry {
      font-size: 10.5px; color: #64748b; line-height: 1.45;
      padding: 2px 0; border-bottom: 1px solid rgba(108,99,255,0.05);
      display: flex; align-items: baseline; gap: 5px; white-space: pre-wrap; word-break: break-word;
    }
    .log-entry:last-child { border-bottom: none; }
    .log-ts { font-size: 9px; color: #334155; flex-shrink: 0; font-variant-numeric: tabular-nums; }
    .log-msg { flex: 1; }
    .log-copy-btn {
      flex-shrink: 0; font-size: 9px; color: #334155; cursor: pointer;
      background: none; border: none; padding: 1px 3px; border-radius: 3px;
      transition: color 0.12s; font-family: inherit;
    }
    .log-copy-btn:hover { color: #a78bfa; }
    #sc-np-log-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 3px 10px; border-top: 1px solid rgba(108,99,255,0.08);
      flex-shrink: 0;
    }
    #sc-np-log-bar-label { font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #334155; }
    #sc-np-log-clear-btn {
      font-size: 9px; color: #334155; cursor: pointer;
      background: none; border: none; padding: 1px 4px; font-family: inherit;
      transition: color 0.12s;
    }
    #sc-np-log-clear-btn:hover { color: #f87171; }

    /* ── Insert / export buttons ── */
    .ql-copy-btn {
      display: inline-flex; align-items: center; gap: 3px;
      padding: 2px 7px; border-radius: 5px; border: 1px solid rgba(108,99,255,0.22);
      background: transparent; color: #475569; font-size: 9.5px;
      font-weight: 700; font-family: inherit; cursor: pointer; letter-spacing: 0.03em;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
    }
    .ql-copy-btn:hover { background: rgba(108,99,255,0.1); border-color: rgba(108,99,255,0.4); color: #a78bfa; }
    .ql-copy-btn.inserted { color: #22c55e; border-color: rgba(34,197,94,0.35); }

    /* ── Body ── */
    #sc-np-body {
      flex: 1;
      overflow: hidden;
      position: relative;
    }

    /* ── Quest Log panel ── */
    #sc-np-quests-panel {
      position: absolute; inset: 0; overflow-y: auto;
      padding: 12px; box-sizing: border-box;
      display: flex; flex-direction: column; gap: 10px;
    }
    #sc-np-quests-panel.sc-np-hidden { display: none; }
    #sc-np-quests-panel::-webkit-scrollbar { width: 5px; }
    #sc-np-quests-panel::-webkit-scrollbar-track { background: transparent; }
    #sc-np-quests-panel::-webkit-scrollbar-thumb { background: rgba(108,99,255,0.3); border-radius: 3px; }

    /* Quest section headers */
    .ql-section-header { display: flex; align-items: center; justify-content: space-between; }
    .ql-section-label { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #475569; }
    .ql-add-btn {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 2px 9px; border-radius: 5px; border: 1px solid rgba(108,99,255,0.3);
      background: rgba(108,99,255,0.1); color: #a78bfa; font-size: 10px;
      font-weight: 700; font-family: inherit; cursor: pointer; letter-spacing: 0.03em;
      transition: background 0.12s, border-color 0.12s;
    }
    .ql-add-btn:hover { background: rgba(108,99,255,0.2); border-color: rgba(108,99,255,0.5); }

    /* Quest item card */
    .ql-item {
      background: rgba(255,255,255,0.03); border: 1px solid rgba(108,99,255,0.16);
      border-radius: 8px; padding: 10px 12px;
      display: flex; flex-direction: column; gap: 6px;
      transition: border-color 0.15s, opacity 0.15s;
      position: relative;
    }
    .ql-item.ql-done { opacity: 0.45; border-color: rgba(34,197,94,0.2); }
    .ql-item.ql-failed { opacity: 0.35; border-color: rgba(239,68,68,0.2); }
    .ql-item-top { display: flex; align-items: flex-start; gap: 8px; }
    .ql-status-btn {
      flex-shrink: 0; width: 18px; height: 18px; border-radius: 50%;
      border: 2px solid rgba(108,99,255,0.4); background: transparent;
      cursor: pointer; padding: 0; margin-top: 2px;
      transition: background 0.15s, border-color 0.15s;
      display: flex; align-items: center; justify-content: center;
    }
    .ql-status-btn:hover { border-color: rgba(108,99,255,0.75); background: rgba(108,99,255,0.12); }
    .ql-item.ql-done .ql-status-btn { background: rgba(34,197,94,0.25); border-color: #22c55e; }
    .ql-item.ql-failed .ql-status-btn { background: rgba(239,68,68,0.2); border-color: #ef4444; }
    .ql-status-icon { width: 8px; height: 8px; pointer-events: none; }
    .ql-title-wrap { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .ql-title-input {
      width: 100%; box-sizing: border-box; background: transparent;
      border: none; outline: none; color: #e2e8f0; font-size: 12.5px;
      font-weight: 600; font-family: inherit; caret-color: #a78bfa;
      padding: 0; line-height: 1.4;
    }
    .ql-item.ql-done .ql-title-input { text-decoration: line-through; color: #64748b; }
    .ql-item.ql-failed .ql-title-input { text-decoration: line-through; color: #64748b; }
    .ql-title-input::placeholder { color: #334155; }
    .ql-notes-input {
      width: 100%; box-sizing: border-box; background: transparent;
      border: none; outline: none; resize: none; color: #94a3b8;
      font-size: 11.5px; font-family: inherit; line-height: 1.5;
      caret-color: #a78bfa; padding: 0; overflow: hidden; min-height: 0;
    }
    .ql-notes-input::placeholder { color: #334155; }
    .ql-update-row {
      display: flex; gap: 5px; align-items: center;
      border-top: 1px solid rgba(108,99,255,0.07); padding-top: 5px; margin-top: 2px;
    }
    .ql-update-input {
      flex: 1; min-width: 0; background: transparent; border: none; outline: none;
      color: #94a3b8; font-size: 11px; font-family: inherit; font-style: italic;
      caret-color: #a78bfa;
    }
    .ql-update-input::placeholder { color: #2a3447; }
    .ql-update-btn {
      flex-shrink: 0; font-size: 9.5px; font-weight: 700; font-family: inherit;
      padding: 2px 7px; border-radius: 4px; cursor: pointer;
      background: rgba(108,99,255,0.1); border: 1px solid rgba(108,99,255,0.28); color: #a78bfa;
      transition: background 0.12s, border-color 0.12s;
    }
    .ql-update-btn:hover { background: rgba(108,99,255,0.2); border-color: rgba(108,99,255,0.5); }
    .ql-update-latest {
      font-size: 10.5px; font-style: italic; color: #475569;
      padding: 1px 0 3px; border-top: 1px solid rgba(108,99,255,0.07); margin-top: 2px;
      white-space: pre-wrap; word-break: break-word;
    }
    .ql-item-bottom { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
    .ql-state-btns { display: flex; gap: 4px; }
    .ql-state-chip {
      font-size: 9.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
      padding: 2px 7px; border-radius: 100px; border: 1px solid transparent;
      cursor: pointer; font-family: inherit; background: transparent;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
    }
    .ql-state-chip.active-chip { pointer-events: none; }
    .ql-state-active  { color: #a78bfa; border-color: rgba(108,99,255,0.35); }
    .ql-state-active.active-chip  { background: rgba(108,99,255,0.2); }
    .ql-state-active:not(.active-chip):hover  { background: rgba(108,99,255,0.1); }
    .ql-state-done    { color: #22c55e; border-color: rgba(34,197,94,0.3); }
    .ql-state-done.active-chip    { background: rgba(34,197,94,0.15); }
    .ql-state-done:not(.active-chip):hover    { background: rgba(34,197,94,0.08); }
    .ql-state-failed  { color: #f87171; border-color: rgba(239,68,68,0.3); }
    .ql-state-failed.active-chip  { background: rgba(239,68,68,0.12); }
    .ql-state-failed:not(.active-chip):hover  { background: rgba(239,68,68,0.07); }
    .ql-delete-btn {
      background: none; border: none; padding: 3px 5px; cursor: pointer;
      color: #334155; border-radius: 4px; transition: color 0.12s, background 0.12s;
      display: flex; align-items: center;
    }
    .ql-delete-btn:hover { color: #f87171; background: rgba(239,68,68,0.08); }
    .ql-empty-state { text-align: center; color: #334155; font-size: 12px; padding: 16px 0; }

    /* ── Dice roller (inside quests tab) ── */
    #sc-np-dice-section { display: flex; flex-direction: column; gap: 8px; }
    .dice-faces-row { display: flex; flex-wrap: wrap; gap: 5px; }
    .dice-face-btn {
      flex: 1; min-width: 36px; padding: 6px 4px; border-radius: 7px;
      border: 1px solid rgba(108,99,255,0.3); background: rgba(108,99,255,0.07);
      color: #a78bfa; font-size: 11px; font-weight: 700; font-family: inherit;
      cursor: pointer; text-align: center; white-space: nowrap;
      transition: background 0.12s, border-color 0.12s, transform 0.07s;
    }
    .dice-face-btn:hover { background: rgba(108,99,255,0.18); border-color: rgba(108,99,255,0.55); }
    .dice-face-btn:active { transform: scale(0.91); }
    .dice-face-btn.active { background: rgba(108,99,255,0.28); border-color: #6c63ff; color: #e0d8ff; }
    .dice-controls-row { display: flex; align-items: center; gap: 7px; }
    .dice-count-input {
      width: 44px; text-align: center; background: rgba(0,0,0,0.3);
      border: 1px solid rgba(108,99,255,0.2); border-radius: 5px;
      color: #e2e8f0; font-size: 12.5px; font-weight: 600; font-family: inherit;
      padding: 5px 6px; outline: none; transition: border-color 0.12s;
    }
    .dice-count-input:focus { border-color: rgba(108,99,255,0.5); }
    .dice-count-label { font-size: 11px; color: #475569; }
    .dice-context-input {
      width: 100%; box-sizing: border-box; background: rgba(0,0,0,0.2);
      border: 1px solid rgba(108,99,255,0.15); border-radius: 5px;
      color: #94a3b8; font-size: 11px; font-family: inherit; font-style: italic;
      padding: 5px 8px; outline: none; transition: border-color 0.12s;
      caret-color: #a78bfa;
    }
    .dice-context-input::placeholder { color: #2a3447; }
    .dice-context-input:focus { border-color: rgba(108,99,255,0.4); color: #e2e8f0; font-style: normal; }
    /* ── Dice Modifier List ── */
    .dmod-header { display: flex; align-items: center; gap: 6px; margin: 2px 0 5px; }
    .dmod-header-label { font-size: 11px; color: #475569; flex: 1; }
    .dmod-include-label { display: flex; align-items: center; gap: 3px; font-size: 11px; color: #475569; cursor: pointer; user-select: none; }
    .dmod-include-label input { accent-color: #6c63ff; cursor: pointer; margin: 0; }
    .dmod-total-pill {
      font-size: 11px; font-weight: 700; padding: 1px 8px; border-radius: 100px;
      background: rgba(108,99,255,0.1); border: 1px solid rgba(108,99,255,0.2); color: #64748b;
    }
    .dmod-total-pill.positive { background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.3); color: #22c55e; }
    .dmod-total-pill.negative { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.28); color: #f87171; }
    .dmod-list { display: flex; flex-direction: column; gap: 5px; }
    .dmod-item {
      display: flex; flex-direction: column; gap: 3px;
      background: rgba(255,255,255,0.025); border: 1px solid rgba(108,99,255,0.13);
      border-radius: 6px; padding: 6px 8px; transition: border-color 0.12s;
    }
    .dmod-item:focus-within { border-color: rgba(108,99,255,0.35); }
    .dmod-top { display: flex; align-items: center; gap: 6px; }
    .dmod-name-input {
      flex: 1; background: transparent; border: none; outline: none;
      color: #e2e8f0; font-size: 12px; font-family: inherit; caret-color: #a78bfa; min-width: 0;
    }
    .dmod-name-input::placeholder { color: #334155; }
    .dmod-val-input {
      width: 46px; flex-shrink: 0; text-align: center; background: rgba(0,0,0,0.3);
      border: 1px solid rgba(108,99,255,0.2); border-radius: 5px;
      color: #a78bfa; font-size: 12px; font-weight: 700; font-family: inherit;
      padding: 3px 4px; outline: none; transition: border-color 0.12s; caret-color: #a78bfa;
    }
    .dmod-val-input:focus { border-color: rgba(108,99,255,0.5); }
    .dmod-delete-btn {
      background: none; border: none; padding: 2px 3px; cursor: pointer; flex-shrink: 0;
      color: #293548; border-radius: 3px; transition: color 0.12s; display: flex; align-items: center;
    }
    .dmod-delete-btn:hover { color: #f87171; }
    .dmod-notes-input {
      width: 100%; box-sizing: border-box; background: transparent;
      border: none; border-top: 1px solid rgba(108,99,255,0.07); outline: none;
      color: #64748b; font-size: 11px; font-family: inherit; font-style: italic;
      padding: 3px 0 1px; caret-color: #a78bfa;
    }
    .dmod-notes-input::placeholder { color: #2a3447; }
    .dmod-empty { font-size: 10.5px; color: #334155; font-style: italic; padding: 2px 0; }
    .dice-result-modifier { font-size: 11px; color: #64748b; text-align: center; }
    .dice-roll-btn {
      flex: 1; padding: 7px 10px; border-radius: 7px;
      border: 1px solid rgba(108,99,255,0.4); background: rgba(108,99,255,0.15);
      color: #a78bfa; font-size: 12px; font-weight: 700; font-family: inherit;
      cursor: pointer; transition: background 0.12s, border-color 0.12s, transform 0.08s;
      display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    .dice-roll-btn:hover { background: rgba(108,99,255,0.25); border-color: rgba(108,99,255,0.6); }
    .dice-roll-btn:active { transform: scale(0.96); }
    .dice-roll-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    #sc-np-dice-result {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      min-height: 56px; padding: 8px 0 4px;
    }
    .dice-result-total {
      font-size: 38px; font-weight: 800; line-height: 1;
      color: #a78bfa; font-variant-numeric: tabular-nums;
      transition: color 0.25s;
    }
    .dice-result-total.nat20 { color: #4ade80; text-shadow: 0 0 18px rgba(74,222,128,0.5); }
    .dice-result-total.nat1  { color: #f87171; text-shadow: 0 0 18px rgba(248,113,113,0.4); }
    .dice-result-total.rolling { animation: dice-spin 0.5s cubic-bezier(0.22,1,0.36,1); }
    @keyframes dice-spin {
      0%   { transform: scale(0.55) rotate(-18deg); opacity: 0; }
      60%  { transform: scale(1.18) rotate(6deg);   opacity: 1; }
      100% { transform: scale(1)    rotate(0deg);   opacity: 1; }
    }
    .dice-result-breakdown { font-size: 11px; color: #475569; text-align: center; }
    .dice-result-nat { font-size: 11px; font-weight: 700; }
    .dice-result-nat.nat20 { color: #4ade80; }
    .dice-result-nat.nat1  { color: #f87171; }
    .dice-history { display: flex; flex-wrap: wrap; gap: 4px; min-height: 22px; }
    .dice-history-chip {
      font-size: 10.5px; font-weight: 600; padding: 2px 8px; border-radius: 100px;
      background: rgba(108,99,255,0.1); border: 1px solid rgba(108,99,255,0.2);
      color: #64748b;
    }
    .dice-history-chip.nat20 { background: rgba(74,222,128,0.08); border-color: rgba(74,222,128,0.25); color: #4ade80; }
    .dice-history-chip.nat1  { background: rgba(248,113,113,0.08); border-color: rgba(248,113,113,0.2); color: #f87171; }

    /* ── Add form ── */
    .af-form {
      display: flex; flex-direction: column; gap: 6px;
      padding: 8px 10px 10px; margin-bottom: 8px;
      background: rgba(108,99,255,0.04); border: 1px solid rgba(108,99,255,0.18);
      border-radius: 7px;
    }
    .af-row { display: flex; gap: 5px; align-items: center; }
    .af-input {
      flex: 1; min-width: 0; background: rgba(0,0,0,0.25);
      border: 1px solid rgba(108,99,255,0.18); border-radius: 5px;
      color: #e2e8f0; font-size: 12px; font-family: inherit;
      padding: 5px 8px; outline: none; transition: border-color 0.12s; caret-color: #a78bfa;
    }
    .af-input:focus { border-color: rgba(108,99,255,0.45); }
    .af-input::placeholder { color: #2e3a4d; }
    .af-textarea {
      width: 100%; box-sizing: border-box; resize: none;
      background: rgba(0,0,0,0.25); border: 1px solid rgba(108,99,255,0.18);
      border-radius: 5px; color: #94a3b8; font-size: 11.5px; font-family: inherit;
      padding: 5px 8px; outline: none; transition: border-color 0.12s;
      caret-color: #a78bfa; overflow: hidden; min-height: 0;
    }
    .af-textarea:focus { border-color: rgba(108,99,255,0.4); }
    .af-textarea::placeholder { color: #2e3a4d; }
    .af-select {
      flex: 1; min-width: 0; background: rgba(0,0,0,0.25);
      border: 1px solid rgba(108,99,255,0.18); border-radius: 5px;
      color: #e2e8f0; font-size: 11.5px; font-family: inherit;
      padding: 5px 7px; outline: none; transition: border-color 0.12s;
      appearance: none; -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236c63ff' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 7px center;
      padding-right: 22px; cursor: pointer;
    }
    .af-select:focus { border-color: rgba(108,99,255,0.45); }
    .af-select option { background: #1a1730; color: #e2e8f0; }
    .af-number {
      width: 52px; flex-shrink: 0; text-align: center;
      background: rgba(0,0,0,0.25); border: 1px solid rgba(108,99,255,0.18);
      border-radius: 5px; color: #a78bfa; font-size: 12px; font-weight: 700;
      font-family: inherit; padding: 5px 4px; outline: none;
      transition: border-color 0.12s; caret-color: #a78bfa;
    }
    .af-number:focus { border-color: rgba(108,99,255,0.45); }
    .af-submit {
      flex-shrink: 0; padding: 5px 12px; border-radius: 5px;
      background: rgba(108,99,255,0.15); border: 1px solid rgba(108,99,255,0.35);
      color: #a78bfa; font-size: 11px; font-weight: 700; font-family: inherit;
      cursor: pointer; transition: background 0.12s, border-color 0.12s;
    }
    .af-submit:hover { background: rgba(108,99,255,0.25); border-color: rgba(108,99,255,0.6); }

    /* ── Item display / edit toggle ── */
    .item-disp-name {
      flex: 1; min-width: 0; font-size: 12.5px; font-weight: 600; color: #e2e8f0;
      line-height: 1.4; word-break: break-word;
    }
    .item-disp-note {
      font-size: 11.5px; color: #94a3b8; font-style: italic;
      line-height: 1.4; word-break: break-word; margin-top: 2px;
    }
    .item-edit-view { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 0; }
    .item-toggle-btn {
      flex-shrink: 0; background: none; border: 1px solid rgba(108,99,255,0.18);
      border-radius: 4px; padding: 2px 7px; cursor: pointer;
      font-size: 10.5px; font-family: inherit;
      transition: color 0.12s, border-color 0.12s, background 0.12s;
    }
    .item-toggle-btn.edit { color: #475569; }
    .item-toggle-btn.edit:hover { color: #a78bfa; border-color: rgba(108,99,255,0.4); }
    .item-toggle-btn.save { color: #22c55e; border-color: rgba(34,197,94,0.3); background: rgba(34,197,94,0.07); }
    .item-toggle-btn.save:hover { background: rgba(34,197,94,0.15); border-color: rgba(34,197,94,0.5); }

    /* ── Collapsible quest sections ── */
    .ql-collapsible-hdr { cursor: pointer; user-select: none; }
    .ql-section-body.ql-collapsed { display: none; }
    .ql-chevron { display: flex; align-items: center; transition: transform 0.18s; color: #334155; flex-shrink: 0; }
    .ql-chevron.collapsed { transform: rotate(-90deg); }

    /* ── Resource counters ── */
    .res-item {
      display: flex; flex-direction: column; gap: 4px;
      padding: 5px 0; border-bottom: 1px solid rgba(108,99,255,0.07);
    }
    .res-item:last-child { border-bottom: none; }
    .res-item-top { display: flex; align-items: center; gap: 8px; width: 100%; }
    .res-name-input {
      flex: 1; background: transparent; border: none; outline: none;
      color: #e2e8f0; font-size: 12px; font-family: inherit; caret-color: #a78bfa; min-width: 0;
    }
    .res-name-input::placeholder { color: #334155; }
    .res-value {
      min-width: 38px; text-align: right; font-size: 14px; font-weight: 800;
      color: #a78bfa; font-variant-numeric: tabular-nums; flex-shrink: 0;
    }
    .res-delete-btn {
      background: none; border: none; padding: 2px 3px; cursor: pointer;
      color: #293548; border-radius: 3px; flex-shrink: 0;
      transition: color 0.12s; display: flex; align-items: center;
    }
    .res-delete-btn:hover { color: #f87171; }
    .res-note-input {
      width: 100%; box-sizing: border-box; background: transparent;
      border: none; border-top: 1px solid rgba(108,99,255,0.07); outline: none;
      color: #64748b; font-size: 11px; font-family: inherit; font-style: italic;
      padding: 3px 0 1px; caret-color: #a78bfa;
    }
    .res-note-input::placeholder { color: #2a3447; }
    /* bulk adjust panel */
    .res-adjust-panel {
      display: flex; flex-direction: column; gap: 6px;
      border-top: 1px solid rgba(108,99,255,0.12); padding-top: 8px; margin-top: 2px;
    }
    .res-adjust-row { display: flex; align-items: center; gap: 6px; }
    .res-select {
      flex: 1; min-width: 0; background: rgba(0,0,0,0.3);
      border: 1px solid rgba(108,99,255,0.2); border-radius: 5px;
      color: #e2e8f0; font-size: 11.5px; font-family: inherit;
      padding: 5px 7px; outline: none; transition: border-color 0.12s;
      appearance: none; -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236c63ff' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 7px center;
      padding-right: 22px; cursor: pointer;
    }
    .res-select:focus { border-color: rgba(108,99,255,0.5); }
    .res-select option { background: #1a1730; color: #e2e8f0; }
    .res-amount-input {
      width: 52px; flex-shrink: 0; text-align: center;
      background: rgba(0,0,0,0.3); border: 1px solid rgba(108,99,255,0.2); border-radius: 5px;
      color: #e2e8f0; font-size: 12.5px; font-weight: 700; font-family: inherit;
      padding: 5px 4px; outline: none; transition: border-color 0.12s; caret-color: #a78bfa;
    }
    .res-amount-input:focus { border-color: rgba(108,99,255,0.5); }
    .res-op-btn {
      padding: 5px 11px; border-radius: 5px; font-size: 12px; font-weight: 700;
      font-family: inherit; cursor: pointer; border: 1px solid transparent;
      transition: background 0.12s, border-color 0.12s; flex-shrink: 0;
    }
    .res-op-add { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.3); color: #22c55e; }
    .res-op-add:hover { background: rgba(34,197,94,0.22); border-color: rgba(34,197,94,0.5); }
    .res-op-sub { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.28); color: #f87171; }
    .res-op-sub:hover { background: rgba(239,68,68,0.2); border-color: rgba(239,68,68,0.45); }
    .res-op-set { background: rgba(108,99,255,0.1); border-color: rgba(108,99,255,0.28); color: #a78bfa; }
    .res-op-set:hover { background: rgba(108,99,255,0.2); border-color: rgba(108,99,255,0.5); }
    .res-feedback { font-size: 10.5px; color: #22c55e; height: 14px; opacity: 0; transition: opacity 0.3s; }
    .res-feedback.visible { opacity: 1; }

    /* ── NPC Tracker ── */
    .npc-item {
      display: flex; align-items: flex-start; gap: 7px; flex-direction: column;
      background: rgba(255,255,255,0.025); border: 1px solid rgba(108,99,255,0.13);
      border-radius: 6px; padding: 7px 10px; transition: border-color 0.12s;
    }
    .npc-item:focus-within { border-color: rgba(108,99,255,0.35); }
    .npc-top { display: flex; align-items: center; gap: 6px; width: 100%; }
    .npc-disp-btn {
      flex-shrink: 0; padding: 2px 7px; border-radius: 100px; border: 1px solid transparent;
      font-size: 9.5px; font-weight: 700; cursor: pointer; font-family: inherit;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
    }
    .npc-disp-friendly { background: rgba(34,197,94,0.12);  border-color: rgba(34,197,94,0.3);  color: #22c55e; }
    .npc-disp-neutral  { background: rgba(100,116,139,0.1); border-color: rgba(100,116,139,0.25);color: #94a3b8; }
    .npc-disp-hostile  { background: rgba(239,68,68,0.1);   border-color: rgba(239,68,68,0.28);  color: #f87171; }
    .npc-name-input {
      flex: 1; background: transparent; border: none; outline: none;
      color: #e2e8f0; font-size: 12.5px; font-weight: 600; font-family: inherit;
      caret-color: #a78bfa; min-width: 0;
    }
    .npc-name-input::placeholder { color: #334155; }
    .npc-note-input {
      width: 100%; background: transparent; border: none; outline: none;
      color: #64748b; font-size: 11.5px; font-family: inherit; caret-color: #a78bfa;
    }
    .npc-note-input::placeholder { color: #2a3447; }
    .npc-delete-btn {
      background: none; border: none; padding: 2px 3px; cursor: pointer; flex-shrink: 0;
      color: #293548; border-radius: 3px; transition: color 0.12s; display: flex; align-items: center;
    }
    .npc-delete-btn:hover { color: #f87171; }

    /* ── Ability Uses ── */
    .abl-item {
      display: flex; align-items: center; gap: 6px;
      background: rgba(255,255,255,0.025); border: 1px solid rgba(108,99,255,0.13);
      border-radius: 6px; padding: 5px 8px; transition: border-color 0.12s;
    }
    .abl-item:focus-within { border-color: rgba(108,99,255,0.35); }
    .abl-name-input {
      flex: 1; background: transparent; border: none; outline: none;
      color: #e2e8f0; font-size: 12px; font-family: inherit; caret-color: #a78bfa; min-width: 0;
    }
    .abl-name-input::placeholder { color: #334155; }
    .abl-use-btn {
      width: 22px; height: 22px; border-radius: 4px;
      border: 1px solid rgba(108,99,255,0.28); background: rgba(108,99,255,0.07);
      color: #a78bfa; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.12s, border-color 0.12s;
    }
    .abl-use-btn:hover { background: rgba(108,99,255,0.2); border-color: rgba(108,99,255,0.5); }
    .abl-cur { font-size: 13px; font-weight: 700; color: #a78bfa; min-width: 18px; text-align: center; }
    .abl-sep { font-size: 11px; color: #334155; }
    .abl-max-input {
      width: 28px; text-align: center; background: rgba(0,0,0,0.2);
      border: 1px solid rgba(108,99,255,0.15); border-radius: 3px;
      color: #64748b; font-size: 11px; font-family: inherit; padding: 1px 2px; outline: none;
    }
    .abl-reset-btn {
      font-size: 9px; font-weight: 700; color: #475569;
      background: none; border: 1px solid rgba(108,99,255,0.15); border-radius: 4px;
      padding: 2px 5px; cursor: pointer; font-family: inherit; flex-shrink: 0;
      transition: color 0.12s, border-color 0.12s;
    }
    .abl-reset-btn:hover { color: #a78bfa; border-color: rgba(108,99,255,0.4); }
    .abl-delete-btn {
      background: none; border: none; padding: 2px 3px; cursor: pointer; flex-shrink: 0;
      color: #293548; border-radius: 3px; transition: color 0.12s; display: flex; align-items: center;
    }
    .abl-delete-btn:hover { color: #f87171; }
    .abl-notes-input {
      width: 100%; box-sizing: border-box; background: transparent;
      border: none; border-top: 1px solid rgba(108,99,255,0.07); outline: none; resize: none;
      color: #64748b; font-size: 11px; font-family: inherit; line-height: 1.4;
      caret-color: #a78bfa; overflow: hidden; min-height: 0; padding: 4px 0 2px;
    }
    .abl-notes-input::placeholder { color: #2a3447; }

    /* ── Party Tracker ── */
    .party-item {
      display: flex; align-items: center; gap: 7px;
      background: rgba(255,255,255,0.025); border: 1px solid rgba(108,99,255,0.13);
      border-radius: 6px; padding: 6px 10px; transition: border-color 0.12s;
    }
    .party-item:focus-within { border-color: rgba(108,99,255,0.35); }
    .party-status-btn {
      flex-shrink: 0; padding: 2px 8px; border-radius: 100px; border: 1px solid transparent;
      font-size: 9.5px; font-weight: 700; cursor: pointer; font-family: inherit; min-width: 54px;
      text-align: center; transition: background 0.12s, border-color 0.12s, color 0.12s;
    }
    .party-status-active { background: rgba(34,197,94,0.12);  border-color: rgba(34,197,94,0.3);  color: #22c55e; }
    .party-status-downed { background: rgba(251,191,36,0.1);  border-color: rgba(251,191,36,0.3);  color: #fbbf24; }
    .party-status-dead   { background: rgba(239,68,68,0.1);   border-color: rgba(239,68,68,0.28);  color: #f87171; }
    .party-status-absent { background: rgba(100,116,139,0.1); border-color: rgba(100,116,139,0.25);color: #64748b; }
    .party-name-input {
      flex: 1; background: transparent; border: none; outline: none;
      color: #e2e8f0; font-size: 12.5px; font-weight: 600; font-family: inherit;
      caret-color: #a78bfa; min-width: 0;
    }
    .party-name-input::placeholder { color: #334155; }
    .party-delete-btn {
      background: none; border: none; padding: 2px 3px; cursor: pointer; flex-shrink: 0;
      color: #293548; border-radius: 3px; transition: color 0.12s; display: flex; align-items: center;
    }
    .party-delete-btn:hover { color: #f87171; }

    /* ── Rumours Board ── */
    .rumour-item {
      display: flex; align-items: flex-start; gap: 8px;
      padding: 6px 0; border-bottom: 1px solid rgba(108,99,255,0.07);
    }
    .rumour-item:last-child { border-bottom: none; padding-bottom: 0; }
    .rumour-check {
      flex-shrink: 0; width: 16px; height: 16px; margin-top: 2px;
      border: 1.5px solid rgba(108,99,255,0.35); border-radius: 3px;
      background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: background 0.12s, border-color 0.12s;
    }
    .rumour-check:hover { border-color: rgba(108,99,255,0.65); background: rgba(108,99,255,0.08); }
    .rumour-item.rumour-done .rumour-check { background: rgba(34,197,94,0.2); border-color: #22c55e; }
    .rumour-text-input {
      flex: 1; background: transparent; border: none; outline: none; resize: none;
      color: #e2e8f0; font-size: 12px; font-family: inherit; line-height: 1.4;
      caret-color: #a78bfa; overflow: hidden; min-height: 0;
    }
    .rumour-item.rumour-done .rumour-text-input { color: #475569; text-decoration: line-through; }
    .rumour-text-input::placeholder { color: #334155; }
    .rumour-delete-btn {
      background: none; border: none; padding: 2px 3px; cursor: pointer; flex-shrink: 0;
      color: #293548; border-radius: 3px; transition: color 0.12s; display: flex; align-items: center; margin-top: 1px;
    }
    .rumour-delete-btn:hover { color: #f87171; }

    /* ── Page shrink ── */
    body {
      transition: width 0.26s cubic-bezier(0.4,0,0.2,1);
    }
    html.sc-np-open body {
      transform: translateX(0);
      width: calc(100vw - var(--sc-np-w, ${DEFAULT_W}px));
      max-width: calc(100vw - var(--sc-np-w, ${DEFAULT_W}px));
      overflow-x: hidden;
    }

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
    .sc-persona-pill { display:inline-flex; align-items:center; justify-content:center; min-width:36px; padding:3px 9px; border-radius:16px; font-size:11.5px; font-weight:600; cursor:pointer; border:1.5px solid rgba(108,99,255,0.3); background:transparent; color:#64748b; transition:background 0.15s,border-color 0.15s,color 0.15s; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:82px; }
    .sc-persona-pill:hover { border-color:rgba(108,99,255,0.6); color:#cbd5e1; background:rgba(108,99,255,0.12); }
    .sc-persona-pill.active { background:rgba(108,99,255,0.22); border-color:#6c63ff; color:#a78bfa; }
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

    /* ── Last Log ── */
    .rp-log-model { font-size: 11px; font-weight: 600; color: #a78bfa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .rp-log-sep { height: 1px; background: rgba(108,99,255,0.1); margin: 2px 0; }
    .rp-log-grid { display: flex; flex-direction: column; gap: 3px; }
    .rp-log-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 1px 0; }
    .rp-log-key { font-size: 11px; color: #475569; }
    .rp-log-val { font-size: 11.5px; font-weight: 600; color: #94a3b8; font-variant-numeric: tabular-nums; }
    .rp-log-subrow .rp-log-key { padding-left: 10px; color: #334155; font-size: 10.5px; }
    .rp-log-subrow .rp-log-val { font-size: 10.5px; color: #475569; }
    .rp-log-total .rp-log-key, .rp-log-total .rp-log-val { color: #cbd5e1; font-size: 12px; }
    .rp-log-text-block { display: flex; flex-direction: column; gap: 4px; }
    .rp-log-text-cap { font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
    .rp-log-text-cap.prompt { color: rgba(167,139,250,0.55); }
    .rp-log-text-cap.thinking { color: rgba(251,191,36,0.55); }
    .rp-log-text-cap.output { color: rgba(34,197,94,0.55); }
    .rp-log-text-body { font-size: 11.5px; line-height: 1.55; color: #64748b; white-space: pre-wrap; word-break: break-word; max-height: 110px; overflow-y: auto; padding: 7px 9px; border-radius: 5px; }
    .rp-log-text-body.prompt { background: rgba(108,99,255,0.06); border: 1px solid rgba(108,99,255,0.15); }
    .rp-log-text-body.thinking { background: rgba(251,191,36,0.04); border: 1px solid rgba(251,191,36,0.15); color: #78716c; font-style: italic; }
    .rp-log-text-body.output { background: rgba(34,197,94,0.05); border: 1px solid rgba(34,197,94,0.14); color: #94a3b8; }
    .rp-log-text-body::-webkit-scrollbar { width: 4px; }
    .rp-log-text-body::-webkit-scrollbar-track { background: transparent; }
    .rp-log-text-body::-webkit-scrollbar-thumb { background: rgba(108,99,255,0.25); border-radius: 2px; }

    /* ── Formatter reference panel ── */
    #sc-np-fmt-panel {
      position: absolute; inset: 0; overflow-y: auto;
      padding: 14px; box-sizing: border-box;
      display: none; flex-direction: column; gap: 10px;
    }
    #sc-np-fmt-panel.visible { display: flex; }
    #sc-np-fmt-panel::-webkit-scrollbar { width: 5px; }
    #sc-np-fmt-panel::-webkit-scrollbar-track { background: transparent; }
    #sc-np-fmt-panel::-webkit-scrollbar-thumb { background: rgba(108,99,255,0.3); border-radius: 3px; }
    .fmt-master-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .fmt-master-badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 100px; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; }
    .fmt-master-badge.on { background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); }
    .fmt-master-badge.off { background: rgba(100,116,139,0.1); color: #64748b; border: 1px solid rgba(100,116,139,0.2); }
    .fmt-meta-row { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; font-size: 11px; color: #475569; }
    .fmt-meta-chip { background: rgba(108,99,255,0.1); border: 1px solid rgba(108,99,255,0.2); border-radius: 5px; padding: 2px 7px; font-size: 10.5px; color: #a78bfa; font-family: ui-monospace, monospace; font-weight: 600; }
    .fmt-row { display: flex; align-items: flex-start; gap: 8px; padding: 7px 0; border-bottom: 1px solid rgba(108,99,255,0.07); transition: opacity 0.15s; }
    .fmt-row:last-child { border-bottom: none; }
    .fmt-row.off { opacity: 0.32; }
    .fmt-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }
    .fmt-dot.on { background: #22c55e; box-shadow: 0 0 5px rgba(34,197,94,0.45); }
    .fmt-dot.off { background: #334155; }
    .fmt-row-body { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
    .fmt-row-name { font-size: 11.5px; color: #cbd5e1; font-weight: 500; line-height: 1.3; }
    .fmt-example { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
    .fmt-ex-before, .fmt-ex-after { font-size: 10px; padding: 1px 6px; border-radius: 3px; font-family: ui-monospace, monospace; white-space: pre; line-height: 1.6; }
    .fmt-ex-before { background: rgba(239,68,68,0.08); color: #f87171; border: 1px solid rgba(239,68,68,0.18); }
    .fmt-ex-after { background: rgba(34,197,94,0.08); color: #4ade80; border: 1px solid rgba(34,197,94,0.18); }
    .fmt-ex-arrow { color: #334155; font-size: 10px; flex-shrink: 0; line-height: 1.6; }
    .fmt-disabled-notice { background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.2); border-radius: 7px; padding: 9px 12px; font-size: 11px; color: #f87171; text-align: center; }
    `;
    document.head.appendChild(style);

    /* ── DOM ── */
    const drawer = document.createElement("div");
    drawer.id = "sc-np";
    drawer.innerHTML = `
      <div id="sc-np-header">
        <div id="sc-np-tabstrip">
          <button class="sc-np-tab-pill active" data-tab="quests">Quest Log</button>
          <button class="sc-np-tab-pill" data-tab="rp">RP Tools</button>
          <button class="sc-np-tab-pill" data-tab="fmt">Formatter</button>
        </div>
        <button id="sc-np-btn-close" title="Close (Esc)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div id="sc-np-log-strip">
        <div id="sc-np-log-strip-inner"></div>
        <div id="sc-np-log-bar">
          <span id="sc-np-log-bar-label">Activity Log</span>
          <button id="sc-np-log-clear-btn">Clear</button>
        </div>
      </div>
      <div id="sc-np-body">
        <div id="sc-np-quests-panel">
          <!-- Export All -->
          <div style="display:flex;justify-content:flex-end;">
            <button id="sc-np-export-all" class="ql-copy-btn">⎘ Insert All</button>
          </div>
          <!-- Quest Log -->
          <div class="ql-section-header">
            <span class="ql-section-label">Quests</span>
            <button id="sc-np-quest-copy" class="ql-copy-btn">⎘ Insert</button>
          </div>
          <div id="sc-np-quest-list"></div>
          <!-- Dice Roller -->
          <div class="ql-section-header" style="margin-top:4px;">
            <span class="ql-section-label">Dice Roller</span>
            <button id="sc-np-dice-copy" class="ql-copy-btn">⎘ Insert Last</button>
          </div>
          <div class="rp-card" id="sc-np-dice-section">
            <div class="dice-faces-row">
              <button class="dice-face-btn active" data-faces="4">d4</button>
              <button class="dice-face-btn" data-faces="6">d6</button>
              <button class="dice-face-btn" data-faces="8">d8</button>
              <button class="dice-face-btn" data-faces="10">d10</button>
              <button class="dice-face-btn" data-faces="12">d12</button>
              <button class="dice-face-btn active" data-faces="20">d20</button>
              <button class="dice-face-btn" data-faces="100">d100</button>
            </div>
            <div class="dice-controls-row">
              <span class="dice-count-label">Roll</span>
              <input id="sc-np-dice-count" type="number" class="dice-count-input" value="1" min="1" max="20" data-ai-rewriter-ignore="1" />
              <span class="dice-count-label" id="sc-np-dice-label">× d20</span>
              <button id="sc-np-dice-roll" class="dice-roll-btn">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="4"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="16" cy="16" r="1.2" fill="currentColor"/><circle cx="16" cy="8" r="1.2" fill="currentColor"/><circle cx="8" cy="16" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>
                Roll
              </button>
            </div>
            <input id="sc-np-dice-context" type="text" class="dice-context-input" maxlength="80" placeholder="Context… e.g. attempting to pick the lock" data-ai-rewriter-ignore="1" />
            <div class="dmod-header">
              <span class="dmod-header-label">Modifiers</span>
              <span id="sc-np-dmod-total" class="dmod-total-pill">0</span>
            </div>
            <div id="sc-np-dmod-list" class="dmod-list"></div>
            <div id="sc-np-dice-result">
              <div class="dice-result-total" id="sc-np-dice-total">—</div>
              <div class="dice-result-breakdown" id="sc-np-dice-breakdown"></div>
              <div class="dice-result-nat" id="sc-np-dice-nat"></div>
              <div class="dice-result-modifier" id="sc-np-dice-mod-display"></div>
            </div>
            <div class="dice-history" id="sc-np-dice-history"></div>
          </div>
          <!-- Resource Counters -->
          <div class="ql-section-header ql-collapsible-hdr" data-section="sc-np-res-body">
            <span class="ql-section-label">Resources</span>
            <div style="display:flex;gap:5px;align-items:center;">
              <button id="sc-np-res-copy" class="ql-copy-btn">⎘ Insert</button>
              <span class="ql-chevron"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
            </div>
          </div>
          <div id="sc-np-res-body" class="ql-section-body">
            <div class="rp-card" style="padding:8px 10px;gap:6px;">
              <div id="sc-np-res-list"></div>
              <div class="res-adjust-panel" id="sc-np-res-adjust">
                <div class="res-adjust-row">
                  <select id="sc-np-res-select" class="res-select" data-ai-rewriter-ignore="1"><option value="">Select resource…</option></select>
                  <input id="sc-np-res-amount" type="number" class="res-amount-input" value="1" min="0" data-ai-rewriter-ignore="1" placeholder="Amt" />
                </div>
                <div class="res-adjust-row">
                  <button id="sc-np-res-op-add" class="res-op-btn res-op-add">+ Add</button>
                  <button id="sc-np-res-op-sub" class="res-op-btn res-op-sub">− Use</button>
                  <button id="sc-np-res-op-set" class="res-op-btn res-op-set">= Set</button>
                  <span class="res-feedback" id="sc-np-res-fb"></span>
                </div>
              </div>
            </div>
          </div>
          <!-- Ability Uses -->
          <div class="ql-section-header ql-collapsible-hdr" data-section="sc-np-abl-body">
            <span class="ql-section-label">Abilities</span>
            <div style="display:flex;gap:5px;align-items:center;">
              <button id="sc-np-abl-copy" class="ql-copy-btn">⎘ Insert</button>
              <span class="ql-chevron"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
            </div>
          </div>
          <div id="sc-np-abl-body" class="ql-section-body">
            <div class="rp-card" style="padding:8px 10px;gap:5px;"><div id="sc-np-abl-list"></div></div>
          </div>
          <!-- Party Tracker -->
          <div class="ql-section-header ql-collapsible-hdr" data-section="sc-np-party-body">
            <span class="ql-section-label">Party</span>
            <div style="display:flex;gap:5px;align-items:center;">
              <button id="sc-np-party-copy" class="ql-copy-btn">⎘ Insert</button>
              <span class="ql-chevron"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
            </div>
          </div>
          <div id="sc-np-party-body" class="ql-section-body">
            <div class="rp-card" style="padding:8px 10px;gap:5px;"><div id="sc-np-party-list"></div></div>
          </div>
          <!-- NPC Tracker -->
          <div class="ql-section-header ql-collapsible-hdr" data-section="sc-np-npc-body">
            <span class="ql-section-label">NPCs</span>
            <div style="display:flex;gap:5px;align-items:center;">
              <button id="sc-np-npc-copy" class="ql-copy-btn">⎘ Insert</button>
              <span class="ql-chevron"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
            </div>
          </div>
          <div id="sc-np-npc-body" class="ql-section-body">
            <div class="rp-card" style="padding:8px 10px;gap:5px;"><div id="sc-np-npc-list"></div></div>
          </div>
          <!-- Rumours Board -->
          <div class="ql-section-header ql-collapsible-hdr" data-section="sc-np-rumour-body">
            <span class="ql-section-label">Rumours</span>
            <div style="display:flex;gap:5px;align-items:center;">
              <button id="sc-np-rumour-copy" class="ql-copy-btn">⎘ Insert</button>
              <button id="sc-np-rumour-add" class="ql-add-btn">+ Add</button>
              <span class="ql-chevron"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
            </div>
          </div>
          <div id="sc-np-rumour-body" class="ql-section-body">
            <div class="rp-card" style="padding:8px 10px;gap:5px;"><div id="sc-np-rumour-list"></div></div>
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
          <div class="rp-card" style="padding-bottom:10px;">
            <div class="rp-hint" style="margin-bottom:8px;">Tap a slot to activate it — tap again to deactivate. Active persona is injected before every rewrite.</div>
            <!-- Persona slot pills -->
            <div id="sc-rp-persona-pills" style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px;"></div>
            <!-- Active persona editor -->
            <div id="sc-rp-persona-editor" style="display:none;">
              <div style="margin-bottom:6px;">
                <div class="rp-hint" style="margin-bottom:4px;">Slot label</div>
                <input type="text" id="sc-rp-persona-label" class="rp-input" placeholder="e.g. Aria" data-ai-rewriter-ignore="1" />
              </div>
              <div style="margin-bottom:6px;">
                <div class="rp-hint" style="margin-bottom:4px;">Persona name &mdash; replaces <code style="background:rgba(108,99,255,0.15);padding:1px 5px;border-radius:3px;font-size:10.5px;color:#a78bfa;">{{user}}</code></div>
                <input type="text" id="sc-rp-persona-name" class="rp-input" placeholder="Your persona name…" data-ai-rewriter-ignore="1" />
              </div>
              <div>
                <div class="rp-hint" style="margin-bottom:4px;">Injected before every rewrite prompt</div>
                <textarea id="sc-rp-persona-prepend" class="rp-input rp-textarea" placeholder="e.g. You are writing a collaborative story. The human character is named {{user}}. Stay in character." data-ai-rewriter-ignore="1"></textarea>
              </div>
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
          <div class="rp-section-label">Last Log</div>
          <div class="rp-card">
            <div class="rp-empty-state" id="sc-rp-log-empty">No log yet.</div>
            <div id="sc-rp-log-info" style="display:none; flex-direction:column; gap:8px;">
              <div class="rp-log-model" id="sc-rp-log-model" title=""></div>
              <div class="rp-log-sep"></div>
              <div class="rp-log-grid">
                <div class="rp-log-row">
                  <span class="rp-log-key">Prompt tokens</span>
                  <span class="rp-log-val" id="sc-rp-log-prompt-tok">—</span>
                </div>
                <div class="rp-log-row rp-log-subrow" id="sc-rp-log-cached-row" style="display:none;">
                  <span class="rp-log-key">↳ cached</span>
                  <span class="rp-log-val" id="sc-rp-log-cached-tok">—</span>
                </div>
                <div class="rp-log-row">
                  <span class="rp-log-key">Output tokens</span>
                  <span class="rp-log-val" id="sc-rp-log-completion-tok">—</span>
                </div>
                <div class="rp-log-row rp-log-subrow" id="sc-rp-log-thinking-row" style="display:none;">
                  <span class="rp-log-key">↳ thinking</span>
                  <span class="rp-log-val" id="sc-rp-log-thinking-tok">—</span>
                </div>
                <div class="rp-log-sep"></div>
                <div class="rp-log-row rp-log-total">
                  <span class="rp-log-key">Total</span>
                  <span class="rp-log-val" id="sc-rp-log-total-tok">—</span>
                </div>
                <div class="rp-log-row" id="sc-rp-log-cost-row" style="display:none;">
                  <span class="rp-log-key">Cost</span>
                  <span class="rp-log-val" id="sc-rp-log-cost">—</span>
                </div>
                <div class="rp-log-row">
                  <span class="rp-log-key">Time</span>
                  <span class="rp-log-val" id="sc-rp-log-elapsed">—</span>
                </div>
              </div>
              <div class="rp-log-sep"></div>
              <div class="rp-log-text-block">
                <span class="rp-log-text-cap prompt">Prompt</span>
                <div class="rp-log-text-body prompt" id="sc-rp-log-prompt-text"></div>
              </div>
              <div class="rp-log-text-block" id="sc-rp-log-thinking-block" style="display:none;">
                <span class="rp-log-text-cap thinking">Thinking</span>
                <div class="rp-log-text-body thinking" id="sc-rp-log-thinking-text"></div>
              </div>
              <div class="rp-log-text-block">
                <span class="rp-log-text-cap output">Output</span>
                <div class="rp-log-text-body output" id="sc-rp-log-output-text"></div>
              </div>
            </div>
          </div>
        </div>
        <div id="sc-np-fmt-panel"></div>
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
    const questsPanel = document.getElementById("sc-np-quests-panel");
    const questListEl = document.getElementById("sc-np-quest-list");
    const diceCountInput = document.getElementById("sc-np-dice-count");
    const diceLabelEl = document.getElementById("sc-np-dice-label");
    const diceRollBtn = document.getElementById("sc-np-dice-roll");
    const diceContextInput = document.getElementById("sc-np-dice-context");
    const diceModDisplayEl = document.getElementById("sc-np-dice-mod-display");
    const dmodListEl = document.getElementById("sc-np-dmod-list");
    const dmodTotalEl = document.getElementById("sc-np-dmod-total");
    const DICE_MOD_KEY = "sc_dice_mod_v1_" + chatId;
    let diceModifiers = [];

    function newDiceMod() {
      return {
        id: Date.now() + Math.random(),
        name: "",
        value: 0,
        notes: "",
        enabled: true,
      };
    }
    function saveDiceMods() {
      chrome.storage.local.set({ [DICE_MOD_KEY]: diceModifiers });
    }
    function computeDiceMod() {
      return diceModifiers.reduce(
        (s, m) => (m.enabled !== false ? s + (m.value || 0) : s),
        0,
      );
    }
    function renderDiceMods() {
      dmodListEl.innerHTML = "";
      if (!diceModifiers.length) {
        const e = document.createElement("div");
        e.className = "dmod-empty";
        e.textContent =
          "No modifiers yet \u2014 add status effects, items, bonuses\u2026";
        dmodListEl.appendChild(e);
      } else {
        diceModifiers.forEach((m, idx) => {
          const item = document.createElement("div");
          item.className = "dmod-item";
          if (m.enabled === false) item.style.opacity = "0.45";
          const top = document.createElement("div");
          top.className = "dmod-top";
          // Per-modifier include checkbox
          const inclChk = document.createElement("input");
          inclChk.type = "checkbox";
          inclChk.checked = m.enabled !== false;
          inclChk.title = "Include in roll total";
          inclChk.style.cssText =
            "accent-color:#6c63ff;cursor:pointer;flex-shrink:0;margin:0;";
          inclChk.setAttribute("data-ai-rewriter-ignore", "1");
          inclChk.addEventListener("change", () => {
            m.enabled = inclChk.checked;
            item.style.opacity = m.enabled ? "" : "0.45";
            saveDiceMods();
            // refresh total pill without full re-render
            const t = computeDiceMod();
            const sg = t > 0 ? "+" : "";
            dmodTotalEl.textContent = sg + t;
            dmodTotalEl.className =
              "dmod-total-pill" +
              (t > 0 ? " positive" : t < 0 ? " negative" : "");
          });
          // Name: display / edit
          const nameSpan = document.createElement("span");
          nameSpan.className = "item-disp-name";
          nameSpan.textContent = m.name || "(unnamed)";
          nameSpan.style.flex = "1";
          const nameEditIn = document.createElement("input");
          nameEditIn.type = "text";
          nameEditIn.className = "af-input";
          nameEditIn.style.flex = "1";
          nameEditIn.style.display = "none";
          nameEditIn.value = m.name;
          nameEditIn.placeholder = "Name\u2026 e.g. Poisoned";
          nameEditIn.maxLength = 50;
          nameEditIn.setAttribute("data-ai-rewriter-ignore", "1");
          nameEditIn.addEventListener("input", () => {
            m.name = nameEditIn.value;
            saveDiceMods();
          });
          // Value: display / edit
          const valSign = m.value > 0 ? "+" : "";
          const valSpan = document.createElement("span");
          valSpan.style.cssText = `font-weight:700;min-width:28px;text-align:center;color:${m.value > 0 ? "#4ade80" : m.value < 0 ? "#f87171" : "#94a3b8"};`;
          valSpan.textContent = valSign + m.value;
          const valEditIn = document.createElement("input");
          valEditIn.type = "number";
          valEditIn.className = "af-number";
          valEditIn.style.width = "52px";
          valEditIn.style.display = "none";
          valEditIn.value = m.value;
          valEditIn.min = "-99";
          valEditIn.max = "99";
          valEditIn.setAttribute("data-ai-rewriter-ignore", "1");
          valEditIn.addEventListener("input", () => {
            m.value = parseInt(valEditIn.value, 10) || 0;
            saveDiceMods();
          });
          // Toggle
          const toggleBtn = document.createElement("button");
          toggleBtn.className = "item-toggle-btn edit";
          toggleBtn.textContent = "✎";
          let isEditing = false;
          const delBtn = document.createElement("button");
          delBtn.className = "dmod-delete-btn";
          delBtn.title = "Remove";
          delBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
          delBtn.addEventListener("click", () => {
            const sign = m.value > 0 ? "+" : "";
            addLog(
              `[Modifier removed: ${m.name || "(unnamed)"} ${sign}${m.value}${m.notes ? " \u2014 " + m.notes : ""}]`,
            );
            diceModifiers.splice(idx, 1);
            saveDiceMods();
            renderDiceMods();
          });
          top.append(
            inclChk,
            nameSpan,
            nameEditIn,
            valSpan,
            valEditIn,
            toggleBtn,
            delBtn,
          );
          // Notes: display / edit
          const notesSpan = document.createElement("div");
          notesSpan.style.cssText =
            "color:#64748b;font-size:11.5px;font-family:inherit;padding:2px 0;";
          notesSpan.textContent = m.notes;
          notesSpan.style.display = m.notes ? "" : "none";
          const notesEditIn = document.createElement("input");
          notesEditIn.type = "text";
          notesEditIn.className = "af-input";
          notesEditIn.style.display = "none";
          notesEditIn.value = m.notes;
          notesEditIn.placeholder =
            "Notes\u2026 status effect, item bonus\u2026";
          notesEditIn.maxLength = 80;
          notesEditIn.setAttribute("data-ai-rewriter-ignore", "1");
          notesEditIn.addEventListener("input", () => {
            m.notes = notesEditIn.value;
            saveDiceMods();
          });
          toggleBtn.addEventListener("click", () => {
            isEditing = !isEditing;
            if (isEditing) {
              nameSpan.style.display = "none";
              nameEditIn.style.display = "";
              valSpan.style.display = "none";
              valEditIn.style.display = "";
              notesSpan.style.display = "none";
              notesEditIn.style.display = "";
              toggleBtn.className = "item-toggle-btn save";
              toggleBtn.textContent = "✓ Save";
              nameEditIn.value = m.name;
              valEditIn.value = m.value;
              notesEditIn.value = m.notes;
              nameEditIn.focus();
            } else {
              nameEditIn.style.display = "none";
              valEditIn.style.display = "none";
              notesEditIn.style.display = "none";
              toggleBtn.className = "item-toggle-btn edit";
              toggleBtn.textContent = "✎";
              nameSpan.style.display = "";
              nameSpan.textContent = m.name || "(unnamed)";
              const s = m.value > 0 ? "+" : "";
              valSpan.textContent = s + m.value;
              valSpan.style.color =
                m.value > 0 ? "#4ade80" : m.value < 0 ? "#f87171" : "#94a3b8";
              valSpan.style.display = "";
              notesSpan.textContent = m.notes;
              notesSpan.style.display = m.notes ? "" : "none";
              renderDiceMods(); // refresh total pill
            }
          });
          item.append(top, notesSpan, notesEditIn);
          dmodListEl.appendChild(item);
        });
      }
      const total = computeDiceMod();
      const sign = total > 0 ? "+" : "";
      dmodTotalEl.textContent = sign + total;
      dmodTotalEl.className =
        "dmod-total-pill" +
        (total > 0 ? " positive" : total < 0 ? " negative" : "");
    }
    function loadDiceMods() {
      chrome.storage.local.get(DICE_MOD_KEY, (d) => {
        const saved = d[DICE_MOD_KEY];
        if (Array.isArray(saved)) {
          diceModifiers = saved;
        } else if (saved && typeof saved.mod === "number" && saved.mod !== 0) {
          // Migrate old single-mod format
          diceModifiers = [
            {
              id: Date.now(),
              name: saved.note || "Modifier",
              value: saved.mod,
              notes: "",
            },
          ];
          saveDiceMods();
        }
        renderDiceMods();
      });
    }
    // Dice Mod add form (inserted before dmodListEl)
    (function () {
      const form = document.createElement("div");
      form.className = "af-form";
      const nameIn = document.createElement("input");
      nameIn.type = "text";
      nameIn.className = "af-input";
      nameIn.placeholder = "e.g. Poisoned, DEX bonus, Sword\u2026";
      nameIn.maxLength = 50;
      nameIn.setAttribute("data-ai-rewriter-ignore", "1");
      const valIn = document.createElement("input");
      valIn.type = "number";
      valIn.className = "af-number";
      valIn.value = "0";
      valIn.min = "-99";
      valIn.max = "99";
      valIn.style.width = "60px";
      valIn.setAttribute("data-ai-rewriter-ignore", "1");
      const notesIn = document.createElement("input");
      notesIn.type = "text";
      notesIn.className = "af-input";
      notesIn.placeholder = "Notes\u2026 status effect, lasts until rest";
      notesIn.maxLength = 80;
      notesIn.setAttribute("data-ai-rewriter-ignore", "1");
      const submitBtn = document.createElement("button");
      submitBtn.className = "af-submit";
      submitBtn.textContent = "+ Add Modifier";
      const row1 = document.createElement("div");
      row1.className = "af-row";
      row1.append(nameIn, valIn, submitBtn);
      form.append(row1, notesIn);
      dmodListEl.parentNode.insertBefore(form, dmodListEl);
      const doAdd = () => {
        const name = nameIn.value.trim();
        const value = parseInt(valIn.value, 10) || 0;
        const notes = notesIn.value.trim();
        const mod = newDiceMod();
        mod.name = name;
        mod.value = value;
        mod.notes = notes;
        diceModifiers.push(mod);
        saveDiceMods();
        renderDiceMods();
        const sign = value > 0 ? "+" : "";
        const notesPart = notes ? ` \u2014 ${notes}` : "";
        addLog(
          `[Modifier added: ${name || "(unnamed)"} ${sign}${value}${notesPart}]`,
        );
        nameIn.value = "";
        valIn.value = "0";
        notesIn.value = "";
        nameIn.focus();
      };
      submitBtn.addEventListener("click", doAdd);
      nameIn.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          doAdd();
        }
      });
    })();
    const diceTotalEl = document.getElementById("sc-np-dice-total");
    const diceBreakdownEl = document.getElementById("sc-np-dice-breakdown");
    const diceNatEl = document.getElementById("sc-np-dice-nat");
    const diceHistoryEl = document.getElementById("sc-np-dice-history");
    const rpPanel = document.getElementById("sc-np-rp-panel");
    const fmtPanel = document.getElementById("sc-np-fmt-panel");
    const rpPersonaPillsEl = document.getElementById("sc-rp-persona-pills");
    const rpPersonaEditorEl = document.getElementById("sc-rp-persona-editor");
    const rpPersonaLabelInput = document.getElementById("sc-rp-persona-label");
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
    const rpLogEmptyEl = document.getElementById("sc-rp-log-empty");
    const rpLogInfo = document.getElementById("sc-rp-log-info");
    const rpLogModelEl = document.getElementById("sc-rp-log-model");
    const rpLogPromptTokEl = document.getElementById("sc-rp-log-prompt-tok");
    const rpLogCachedRow = document.getElementById("sc-rp-log-cached-row");
    const rpLogCachedTokEl = document.getElementById("sc-rp-log-cached-tok");
    const rpLogCompletionTokEl = document.getElementById(
      "sc-rp-log-completion-tok",
    );
    const rpLogThinkingRow = document.getElementById("sc-rp-log-thinking-row");
    const rpLogThinkingTokEl = document.getElementById(
      "sc-rp-log-thinking-tok",
    );
    const rpLogTotalTokEl = document.getElementById("sc-rp-log-total-tok");
    const rpLogCostRow = document.getElementById("sc-rp-log-cost-row");
    const rpLogCostEl = document.getElementById("sc-rp-log-cost");
    const rpLogElapsedEl = document.getElementById("sc-rp-log-elapsed");
    const rpLogPromptTextEl = document.getElementById("sc-rp-log-prompt-text");
    const rpLogThinkingBlock = document.getElementById(
      "sc-rp-log-thinking-block",
    );
    const rpLogThinkingTextEl = document.getElementById(
      "sc-rp-log-thinking-text",
    );
    const rpLogOutputTextEl = document.getElementById("sc-rp-log-output-text");

    /* ── State ── */
    let isOpen = false;
    let activeTab = "quests";
    let rpSaveTimer = null;
    let rpAutosaveTimer = null;
    const MAX_SNIPPETS = 5;
    let rpSnippets = Array.from({ length: MAX_SNIPPETS }, () => ({
      label: "",
      text: "",
    }));
    let snipEditMode = false;

    /* Storage keys */
    const QUEST_KEY = "sc_quests_v1_" + chatId;

    /* ── CSS variable init ── */
    document.documentElement.style.setProperty("--sc-np-w", DRAWER_W + "px");

    /* ════════════════ QUEST LOG ════════════════ */
    const QUEST_STATES = ["active", "done", "failed"];
    let quests = [];
    let questSaveTimer = null;

    function newQuest() {
      return {
        id: Date.now() + Math.random(),
        title: "",
        notes: "",
        state: "active",
        update: "",
      };
    }

    function saveQuests() {
      chrome.storage.local.set({ [QUEST_KEY]: quests });
    }
    function scheduleQuestSave() {
      clearTimeout(questSaveTimer);
      questSaveTimer = setTimeout(saveQuests, 500);
    }

    function autoResizeTextarea(el) {
      el.style.height = "0";
      el.style.height = el.scrollHeight + "px";
    }

    function renderQuests() {
      questListEl.innerHTML = "";
      if (!quests.length) {
        const empty = document.createElement("div");
        empty.className = "ql-empty-state";
        empty.textContent = "No quests yet.";
        questListEl.appendChild(empty);
        return;
      }
      quests.forEach((q, idx) => {
        const card = document.createElement("div");
        card.className =
          "ql-item" +
          (q.state === "done"
            ? " ql-done"
            : q.state === "failed"
              ? " ql-failed"
              : "");
        card.dataset.id = q.id;

        // Status circle button (always interactive)
        const statusBtn = document.createElement("button");
        statusBtn.className = "ql-status-btn";
        statusBtn.title = "Cycle status";
        const checkIcon = `<svg class="ql-status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        const xIcon = `<svg class="ql-status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        statusBtn.innerHTML =
          q.state === "done" ? checkIcon : q.state === "failed" ? xIcon : "";
        statusBtn.addEventListener("click", () => {
          const cur = QUEST_STATES.indexOf(q.state);
          q.state = QUEST_STATES[(cur + 1) % QUEST_STATES.length];
          addLog(`[Quest "${q.title || "(untitled)"}" \u2192 ${q.state}]`);
          scheduleQuestSave();
          renderQuests();
        });

        // Display view
        const nameSpan = document.createElement("div");
        nameSpan.className = "item-disp-name";
        nameSpan.textContent = q.title || "(untitled)";
        if (q.state !== "active") {
          nameSpan.style.textDecoration = "line-through";
          nameSpan.style.color = "#64748b";
        }
        const notesSpan = document.createElement("div");
        notesSpan.className = "item-disp-note";
        notesSpan.textContent = q.notes;
        notesSpan.style.display = q.notes ? "" : "none";
        const dispView = document.createElement("div");
        dispView.style.cssText =
          "flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;";
        dispView.append(nameSpan, notesSpan);

        // Edit view (hidden by default)
        const titleEditIn = document.createElement("input");
        titleEditIn.type = "text";
        titleEditIn.className = "af-input";
        titleEditIn.value = q.title;
        titleEditIn.placeholder = "Quest title\u2026";
        titleEditIn.maxLength = 80;
        titleEditIn.setAttribute("data-ai-rewriter-ignore", "1");
        titleEditIn.addEventListener("input", () => {
          q.title = titleEditIn.value;
          scheduleQuestSave();
        });
        const notesEditIn = document.createElement("textarea");
        notesEditIn.className = "af-textarea";
        notesEditIn.value = q.notes;
        notesEditIn.placeholder = "Notes\u2026";
        notesEditIn.rows = 1;
        notesEditIn.setAttribute("data-ai-rewriter-ignore", "1");
        notesEditIn.addEventListener("input", () => {
          q.notes = notesEditIn.value;
          autoResizeTextarea(notesEditIn);
          scheduleQuestSave();
        });
        const editView = document.createElement("div");
        editView.className = "item-edit-view";
        editView.style.display = "none";
        editView.append(titleEditIn, notesEditIn);

        const titleWrap = document.createElement("div");
        titleWrap.className = "ql-title-wrap";
        titleWrap.append(dispView, editView);

        const top = document.createElement("div");
        top.className = "ql-item-top";
        top.append(statusBtn, titleWrap);

        // State chips (always interactive)
        const stateRow = document.createElement("div");
        stateRow.className = "ql-state-btns";
        QUEST_STATES.forEach((st) => {
          const chip = document.createElement("button");
          chip.className =
            `ql-state-chip ql-state-${st}` +
            (q.state === st ? " active-chip" : "");
          chip.textContent = st.charAt(0).toUpperCase() + st.slice(1);
          chip.addEventListener("click", () => {
            q.state = st;
            addLog(`[Quest "${q.title || "(untitled)"}" \u2192 ${st}]`);
            scheduleQuestSave();
            renderQuests();
          });
          stateRow.appendChild(chip);
        });

        // Edit/save toggle
        const toggleBtn = document.createElement("button");
        toggleBtn.className = "item-toggle-btn edit";
        toggleBtn.textContent = "✎";
        let isEditing = false;
        toggleBtn.addEventListener("click", () => {
          isEditing = !isEditing;
          if (isEditing) {
            dispView.style.display = "none";
            editView.style.display = "";
            toggleBtn.className = "item-toggle-btn save";
            toggleBtn.textContent = "\u2713 Save";
            titleEditIn.value = q.title;
            notesEditIn.value = q.notes;
            setTimeout(() => autoResizeTextarea(notesEditIn), 0);
            titleEditIn.focus();
          } else {
            editView.style.display = "none";
            dispView.style.display = "";
            toggleBtn.className = "item-toggle-btn edit";
            toggleBtn.textContent = "\u270e";
            nameSpan.textContent = q.title || "(untitled)";
            const active = q.state === "active";
            nameSpan.style.textDecoration = active ? "" : "line-through";
            nameSpan.style.color = active ? "" : "#64748b";
            notesSpan.textContent = q.notes;
            notesSpan.style.display = q.notes ? "" : "none";
          }
        });

        const delBtn = document.createElement("button");
        delBtn.className = "ql-delete-btn";
        delBtn.title = "Delete quest";
        delBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`;
        delBtn.addEventListener("click", () => {
          addLog(`[Quest removed: ${q.title || "(untitled)"}]`);
          quests.splice(idx, 1);
          saveQuests();
          renderQuests();
        });

        const bottom = document.createElement("div");
        bottom.className = "ql-item-bottom";
        bottom.append(stateRow, toggleBtn, delBtn);
        card.append(top, bottom);

        // Update row (always interactive)
        const updateRow = document.createElement("div");
        updateRow.className = "ql-update-row";
        const updateIn = document.createElement("input");
        updateIn.type = "text";
        updateIn.className = "ql-update-input";
        updateIn.placeholder =
          "Post an update\u2026 e.g. found a lead at the tavern";
        updateIn.maxLength = 120;
        updateIn.setAttribute("data-ai-rewriter-ignore", "1");
        const updateBtn = document.createElement("button");
        updateBtn.className = "ql-update-btn";
        updateBtn.textContent = "Log";
        updateBtn.addEventListener("click", () => {
          const txt = updateIn.value.trim();
          if (!txt) return;
          q.update = txt;
          scheduleQuestSave();
          addLog(`[Quest "${q.title || "(untitled)"}": ${txt}]`);
          updateIn.value = "";
          latestEl.textContent = txt;
          latestEl.style.display = "";
        });
        updateIn.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            updateBtn.click();
          }
        });
        updateRow.append(updateIn, updateBtn);
        card.appendChild(updateRow);

        const latestEl = document.createElement("div");
        latestEl.className = "ql-update-latest";
        latestEl.style.display = q.update ? "" : "none";
        latestEl.textContent = q.update || "";
        card.appendChild(latestEl);

        questListEl.appendChild(card);
      });
    }

    // Quest add form (inserted before list)
    (function () {
      const form = document.createElement("div");
      form.className = "af-form";
      const titleIn = document.createElement("input");
      titleIn.type = "text";
      titleIn.className = "af-input";
      titleIn.placeholder = "Quest title\u2026";
      titleIn.maxLength = 80;
      titleIn.setAttribute("data-ai-rewriter-ignore", "1");
      const notesIn = document.createElement("textarea");
      notesIn.className = "af-textarea";
      notesIn.rows = 1;
      notesIn.placeholder = "Notes (optional)\u2026";
      notesIn.setAttribute("data-ai-rewriter-ignore", "1");
      const submitBtn = document.createElement("button");
      submitBtn.className = "af-submit";
      submitBtn.textContent = "+ Add Quest";
      const row = document.createElement("div");
      row.className = "af-row";
      row.append(titleIn, submitBtn);
      form.append(row, notesIn);
      questListEl.parentNode.insertBefore(form, questListEl);
      const doAdd = () => {
        const title = titleIn.value.trim();
        const notes = notesIn.value.trim();
        const q = newQuest();
        q.title = title;
        q.notes = notes;
        quests.unshift(q);
        saveQuests();
        renderQuests();
        const notesPart = notes ? ` \u2014 ${notes}` : "";
        addLog(`[Quest added: ${title || "(untitled)"}${notesPart}]`);
        titleIn.value = "";
        notesIn.value = "";
        autoResizeTextarea(notesIn);
        titleIn.focus();
      };
      submitBtn.addEventListener("click", doAdd);
      titleIn.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          doAdd();
        }
      });
      notesIn.addEventListener("input", () => autoResizeTextarea(notesIn));
    })();

    function loadQuests() {
      chrome.storage.local.get(QUEST_KEY, (data) => {
        quests = Array.isArray(data[QUEST_KEY]) ? data[QUEST_KEY] : [];
        renderQuests();
      });
    }

    /* ════════════════ DICE ROLLER ════════════════ */
    let selectedFaces = new Set([20]);
    let diceHistory = [];
    const MAX_HIST = 8;

    // Allow multiple dice faces selected at once
    document.querySelectorAll(".dice-face-btn").forEach((btn) => {
      // default: only d20 starts active
      const f = parseInt(btn.dataset.faces, 10);
      if (f !== 20) btn.classList.remove("active");
      btn.addEventListener("click", () => {
        btn.classList.toggle("active");
        if (btn.classList.contains("active")) {
          selectedFaces.add(f);
        } else {
          selectedFaces.delete(f);
          if (!selectedFaces.size) {
            selectedFaces.add(f);
            btn.classList.add("active");
          }
        }
        updateDiceLabel();
      });
    });

    function updateDiceLabel() {
      const sorted = [...selectedFaces].sort((a, b) => a - b);
      const count = Math.min(
        20,
        Math.max(1, parseInt(diceCountInput.value, 10) || 1),
      );
      const n = sorted.length === 1 ? count + "×" : count + "×(";
      const faces = sorted.map((f) => "d" + f).join("+");
      diceLabelEl.textContent = n + faces + (sorted.length > 1 ? ")" : "");
    }

    diceCountInput.addEventListener("input", updateDiceLabel);

    diceRollBtn.addEventListener("click", () => {
      const count = Math.min(
        20,
        Math.max(1, parseInt(diceCountInput.value, 10) || 1),
      );
      const faceArr = [...selectedFaces].sort((a, b) => a - b);

      const allRolls = [];
      const perDie = {};
      faceArr.forEach((f) => {
        perDie[f] = [];
        for (let i = 0; i < count; i++) {
          const r = Math.floor(Math.random() * f) + 1;
          perDie[f].push(r);
          allRolls.push(r);
        }
      });

      const rawTotal = allRolls.reduce((a, b) => a + b, 0);
      const mod = computeDiceMod();
      const total = rawTotal + mod;

      // Breakdown text
      let breakdown = "";
      if (allRolls.length > 1) {
        if (faceArr.length === 1) {
          breakdown = "[" + perDie[faceArr[0]].join(", ") + "]";
        } else {
          breakdown = faceArr
            .map((f) => "d" + f + ": [" + perDie[f].join(",") + "]")
            .join("  ");
        }
      }

      // Nat 20/1 detection — only for single d20
      let natMsg = "";
      let natClass = "";
      if (faceArr.length === 1 && faceArr[0] === 20 && count === 1) {
        if (allRolls[0] === 20) {
          natMsg = "Natural 20!";
          natClass = "nat20";
        } else if (allRolls[0] === 1) {
          natMsg = "Critical Fail!";
          natClass = "nat1";
        }
      }

      // Animate
      diceTotalEl.classList.remove("rolling", "nat20", "nat1");
      void diceTotalEl.offsetWidth; // reflow
      diceTotalEl.classList.add("rolling");
      if (natClass) diceTotalEl.classList.add(natClass);
      diceTotalEl.textContent = total;
      diceBreakdownEl.textContent = breakdown;
      diceNatEl.textContent = natMsg;
      diceNatEl.className =
        "dice-result-nat" + (natClass ? " " + natClass : "");
      if (mod !== 0) {
        const sign = mod > 0 ? "+" : "";
        const parts = diceModifiers
          .filter((mx) => mx.value !== 0)
          .map((mx) =>
            `${mx.value > 0 ? "+" : ""}${mx.value} ${mx.name || "?"}`.trim(),
          )
          .join(", ");
        diceModDisplayEl.textContent = `${sign}${mod} mod${rawTotal !== total ? " (" + rawTotal + " raw)" : ""}${parts ? " \u2014 " + parts : ""}`;
      } else {
        diceModDisplayEl.textContent = "";
      }

      // History chip
      const label = faceArr.map((f) => count + "d" + f).join("+");
      const modSuffix = mod !== 0 ? (mod > 0 ? "+" + mod : String(mod)) : "";
      const chipLabel = modSuffix ? `${label}${modSuffix}` : label;
      diceHistory.unshift({ label: chipLabel, total, natClass });
      if (diceHistory.length > MAX_HIST) diceHistory.pop();
      diceHistoryEl.innerHTML = "";
      diceHistory.forEach((h) => {
        const chip = document.createElement("span");
        chip.className =
          "dice-history-chip" + (h.natClass ? " " + h.natClass : "");
        chip.textContent = h.label + ": " + h.total;
        diceHistoryEl.appendChild(chip);
      });

      // Log the roll
      const ctx = diceContextInput.value.trim();
      let modPart = "";
      if (mod !== 0) {
        const modSign = mod > 0 ? "+" : "";
        const modItems = diceModifiers
          .filter((mx) => mx.value !== 0)
          .map(
            (mx) => `${mx.value > 0 ? "+" : ""}${mx.value} ${mx.name || "?"}`,
          )
          .join(", ");
        modPart = ` (${modSign}${mod}${modItems ? ": " + modItems : ""})`;
      }
      const logLine = ctx
        ? natMsg
          ? `[${ctx} \u2014 Roll ${chipLabel}: ${total}${modPart} \u2014 ${natMsg}]`
          : breakdown
            ? `[${ctx} \u2014 Roll ${chipLabel}: ${total}${modPart} ${breakdown}]`
            : `[${ctx} \u2014 Roll ${chipLabel}: ${total}${modPart}]`
        : natMsg
          ? `[Roll ${chipLabel}: ${total}${modPart} \u2014 ${natMsg}]`
          : breakdown
            ? `[Roll ${chipLabel}: ${total}${modPart} ${breakdown}]`
            : `[Roll ${chipLabel}: ${total}${modPart}]`;
      addLog(logLine);
    });

    updateDiceLabel();

    /* ════════════════ COLLAPSIBLE SECTIONS ════════════════ */
    drawer.querySelectorAll(".ql-collapsible-hdr").forEach((hdr) => {
      hdr.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        const body = document.getElementById(hdr.dataset.section);
        const chevron = hdr.querySelector(".ql-chevron");
        const collapsed = body.classList.toggle("ql-collapsed");
        chevron.classList.toggle("collapsed", collapsed);
      });
    });

    /* ════════════════ RESOURCE COUNTERS ════════════════ */
    const RES_KEY = "sc_res_v1_" + chatId;
    let resources = [];
    let resSaveTimer = null;
    const resListEl = document.getElementById("sc-np-res-list");

    function newRes() {
      return { id: Date.now() + Math.random(), name: "", value: 0, notes: "" };
    }
    function saveRes() {
      chrome.storage.local.set({ [RES_KEY]: resources });
    }
    function scheduleResSave() {
      clearTimeout(resSaveTimer);
      resSaveTimer = setTimeout(saveRes, 500);
    }

    const resSelectEl = document.getElementById("sc-np-res-select");
    const resAmountEl = document.getElementById("sc-np-res-amount");
    const resAdjustPanel = document.getElementById("sc-np-res-adjust");
    const resFbEl = document.getElementById("sc-np-res-fb");
    let resFbTimer = null;

    function showResFeedback(msg) {
      resFbEl.textContent = msg;
      resFbEl.classList.add("visible");
      clearTimeout(resFbTimer);
      resFbTimer = setTimeout(() => resFbEl.classList.remove("visible"), 1600);
    }

    function rebuildResSelect(keepId) {
      const prev = keepId ?? resSelectEl.value;
      resSelectEl.innerHTML = "<option value=''>Select resource\u2026</option>";
      resources.forEach((r) => {
        const opt = document.createElement("option");
        opt.value = r.id;
        opt.textContent =
          (r.name.trim() || "(unnamed)") + "  \u2014  " + r.value;
        resSelectEl.appendChild(opt);
      });
      if (prev) resSelectEl.value = prev;
      resAdjustPanel.style.display = resources.length ? "" : "none";
    }

    function renderRes() {
      resListEl.innerHTML = "";
      if (!resources.length) {
        const e = document.createElement("div");
        e.className = "ql-empty-state";
        e.style.padding = "6px 0";
        e.textContent = "No resources yet.";
        resListEl.appendChild(e);
        rebuildResSelect();
        return;
      }
      resources.forEach((r, idx) => {
        const row = document.createElement("div");
        row.className = "res-item";
        row.dataset.resId = r.id;

        // Top row: display name / edit input + value (always) + toggle + delete
        const topRow = document.createElement("div");
        topRow.className = "res-item-top";

        const nameSpan = document.createElement("span");
        nameSpan.className = "item-disp-name";
        nameSpan.textContent = r.name || "(unnamed)";

        const nameEditIn = document.createElement("input");
        nameEditIn.type = "text";
        nameEditIn.className = "af-input";
        nameEditIn.value = r.name;
        nameEditIn.placeholder = "Resource name\u2026";
        nameEditIn.maxLength = 40;
        nameEditIn.style.display = "none";
        nameEditIn.setAttribute("data-ai-rewriter-ignore", "1");
        nameEditIn.addEventListener("input", () => {
          r.name = nameEditIn.value;
          scheduleResSave();
          rebuildResSelect(r.id);
        });

        const valEl = document.createElement("span");
        valEl.className = "res-value";
        valEl.textContent = r.value;
        row._valEl = valEl;

        const toggleBtn = document.createElement("button");
        toggleBtn.className = "item-toggle-btn edit";
        toggleBtn.textContent = "\u270e";
        let isEditing = false;

        const delBtn = document.createElement("button");
        delBtn.className = "res-delete-btn";
        delBtn.title = "Remove";
        delBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        delBtn.addEventListener("click", () => {
          addLog(`[Resource removed: ${r.name || "(unnamed)"}]`);
          resources.splice(idx, 1);
          saveRes();
          renderRes();
        });

        topRow.append(nameSpan, nameEditIn, valEl, toggleBtn, delBtn);

        // Notes below: display span / edit input
        const notesSpan = document.createElement("div");
        notesSpan.className = "item-disp-note";
        notesSpan.textContent = r.notes;
        notesSpan.style.display = r.notes ? "" : "none";

        const notesEditIn = document.createElement("input");
        notesEditIn.type = "text";
        notesEditIn.className = "af-input";
        notesEditIn.value = r.notes || "";
        notesEditIn.style.display = "none";
        notesEditIn.placeholder = "Notes\u2026 e.g. used for healing, max 100";
        notesEditIn.maxLength = 80;
        notesEditIn.setAttribute("data-ai-rewriter-ignore", "1");
        notesEditIn.addEventListener("input", () => {
          r.notes = notesEditIn.value;
          scheduleResSave();
        });

        toggleBtn.addEventListener("click", () => {
          isEditing = !isEditing;
          if (isEditing) {
            nameSpan.style.display = "none";
            nameEditIn.style.display = "";
            notesSpan.style.display = "none";
            notesEditIn.style.display = "";
            toggleBtn.className = "item-toggle-btn save";
            toggleBtn.textContent = "\u2713 Save";
            nameEditIn.value = r.name;
            notesEditIn.value = r.notes || "";
            nameEditIn.focus();
          } else {
            nameEditIn.style.display = "none";
            nameSpan.style.display = "";
            notesEditIn.style.display = "none";
            toggleBtn.className = "item-toggle-btn edit";
            toggleBtn.textContent = "\u270e";
            nameSpan.textContent = r.name || "(unnamed)";
            notesSpan.textContent = r.notes;
            notesSpan.style.display = r.notes ? "" : "none";
          }
        });

        row.append(topRow, notesSpan, notesEditIn);
        resListEl.appendChild(row);
      });
      rebuildResSelect();
    }

    // Resource add form (inserted before list)
    (function () {
      const form = document.createElement("div");
      form.className = "af-form";
      const nameIn = document.createElement("input");
      nameIn.type = "text";
      nameIn.className = "af-input";
      nameIn.placeholder = "Resource name\u2026";
      nameIn.maxLength = 40;
      nameIn.setAttribute("data-ai-rewriter-ignore", "1");
      const valIn = document.createElement("input");
      valIn.type = "number";
      valIn.className = "af-number";
      valIn.value = "0";
      valIn.min = "0";
      valIn.setAttribute("data-ai-rewriter-ignore", "1");
      const notesIn = document.createElement("input");
      notesIn.type = "text";
      notesIn.className = "af-input";
      notesIn.placeholder = "Notes (optional)\u2026";
      notesIn.maxLength = 80;
      notesIn.setAttribute("data-ai-rewriter-ignore", "1");
      const submitBtn = document.createElement("button");
      submitBtn.className = "af-submit";
      submitBtn.textContent = "+ Add Resource";
      const row1 = document.createElement("div");
      row1.className = "af-row";
      row1.append(nameIn, valIn, submitBtn);
      form.append(row1, notesIn);
      resListEl.parentNode.insertBefore(form, resListEl);
      const doAdd = () => {
        const name = nameIn.value.trim();
        const value = parseInt(valIn.value, 10) || 0;
        const notes = notesIn.value.trim();
        const r = newRes();
        r.name = name;
        r.value = value;
        r.notes = notes;
        resources.push(r);
        saveRes();
        renderRes();
        const notesPart = notes ? ` \u2014 ${notes}` : "";
        addLog(
          `[Resource added: ${name || "(unnamed)"}${notesPart} (value: ${value})]`,
        );
        nameIn.value = "";
        valIn.value = "0";
        notesIn.value = "";
        nameIn.focus();
      };
      submitBtn.addEventListener("click", doAdd);
      nameIn.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          doAdd();
        }
      });
    })();

    function applyResOp(op) {
      const id = resSelectEl.value;
      if (!id) {
        showResFeedback("Pick a resource first.");
        return;
      }
      const amount = Math.max(0, parseInt(resAmountEl.value, 10) || 0);
      const r = resources.find((x) => String(x.id) === id);
      if (!r) return;
      const before = r.value;
      if (op === "add") r.value += amount;
      else if (op === "sub") r.value = Math.max(0, r.value - amount);
      else if (op === "set") r.value = amount;
      // Update the value display in the list without full re-render
      const row = resListEl.querySelector(`[data-res-id="${id}"]`);
      if (row && row._valEl) row._valEl.textContent = r.value;
      rebuildResSelect(id);
      saveRes();
      const notePart = r.notes ? ` (${r.notes})` : "";
      let logMsg;
      if (op === "add") {
        logMsg = `[${r.name || "Resource"}: gained ${amount}, ${before} \u2192 ${r.value} total${notePart}]`;
      } else if (op === "sub") {
        logMsg = `[${r.name || "Resource"}: used ${amount}, ${before} \u2192 ${r.value} left${notePart}]`;
      } else {
        logMsg = `[${r.name || "Resource"}: set to ${r.value}${notePart}]`;
      }
      showResFeedback(
        op === "set"
          ? `= ${r.value}`
          : `${op === "add" ? "+" : "-"}${amount} \u2192 ${r.value}`,
      );
      addLog(logMsg);
    }

    document
      .getElementById("sc-np-res-op-add")
      .addEventListener("click", () => applyResOp("add"));
    document
      .getElementById("sc-np-res-op-sub")
      .addEventListener("click", () => applyResOp("sub"));
    document
      .getElementById("sc-np-res-op-set")
      .addEventListener("click", () => applyResOp("set"));

    function loadRes() {
      chrome.storage.local.get(RES_KEY, (d) => {
        resources = Array.isArray(d[RES_KEY]) ? d[RES_KEY] : [];
        renderRes();
      });
    }

    /* ════════════════ ABILITY USES ════════════════ */
    const ABL_KEY = "sc_abl_v1_" + chatId;
    let abilities = [];
    let ablSaveTimer = null;
    const ablListEl = document.getElementById("sc-np-abl-list");

    function newAbl() {
      return {
        id: Date.now() + Math.random(),
        name: "",
        notes: "",
        current: 3,
        max: 3,
      };
    }
    function saveAbl() {
      chrome.storage.local.set({ [ABL_KEY]: abilities });
    }
    function scheduleAblSave() {
      clearTimeout(ablSaveTimer);
      ablSaveTimer = setTimeout(saveAbl, 500);
    }

    function renderAbl() {
      ablListEl.innerHTML = "";
      if (!abilities.length) {
        const e = document.createElement("div");
        e.className = "ql-empty-state";
        e.style.padding = "6px 0";
        e.textContent = "No abilities yet.";
        ablListEl.appendChild(e);
        return;
      }
      abilities.forEach((a, idx) => {
        const wrapper = document.createElement("div");
        wrapper.style.cssText =
          "display:flex;flex-direction:column;gap:4px;padding:5px 0;border-bottom:1px solid rgba(108,99,255,0.07);";
        if (idx === abilities.length - 1) wrapper.style.borderBottom = "none";

        // Top row: name (display/edit) + cur/max + RST + toggle + delete
        const topRow = document.createElement("div");
        topRow.className = "abl-item";

        const nameSpan = document.createElement("span");
        nameSpan.className = "item-disp-name";
        nameSpan.style.fontSize = "12px";
        nameSpan.textContent = a.name || "(unnamed)";

        const nameEditIn = document.createElement("input");
        nameEditIn.type = "text";
        nameEditIn.className = "af-input";
        nameEditIn.value = a.name;
        nameEditIn.placeholder = "Ability name\u2026";
        nameEditIn.maxLength = 40;
        nameEditIn.style.display = "none";
        nameEditIn.setAttribute("data-ai-rewriter-ignore", "1");
        nameEditIn.addEventListener("input", () => {
          a.name = nameEditIn.value;
          scheduleAblSave();
        });

        const curEl = document.createElement("span");
        curEl.className = "abl-cur";
        curEl.textContent = a.current;
        curEl.style.opacity = a.current === 0 ? "0.35" : "1";

        const sep = document.createElement("span");
        sep.className = "abl-sep";
        sep.textContent = "/";

        // Max: static display by default, editable only in edit mode
        const maxSpan = document.createElement("span");
        maxSpan.className = "abl-sep";
        maxSpan.textContent = a.max;

        const maxEditIn = document.createElement("input");
        maxEditIn.type = "number";
        maxEditIn.className = "abl-max-input";
        maxEditIn.value = a.max;
        maxEditIn.min = 1;
        maxEditIn.max = 99;
        maxEditIn.style.display = "none";
        maxEditIn.setAttribute("data-ai-rewriter-ignore", "1");
        maxEditIn.addEventListener("input", () => {
          a.max = Math.max(1, parseInt(maxEditIn.value, 10) || 1);
          scheduleAblSave();
        });

        const resetBtn = document.createElement("button");
        resetBtn.className = "abl-reset-btn";
        resetBtn.textContent = "RST";
        resetBtn.addEventListener("click", () => {
          a.current = a.max;
          saveAbl();
          const notesPart = a.notes ? ` (${a.notes})` : "";
          addLog(
            `[${a.name || "Ability"} restored \u2014 ${a.current}/${a.max}${notesPart}]`,
          );
          renderAbl();
        });

        const toggleBtn = document.createElement("button");
        toggleBtn.className = "item-toggle-btn edit";
        toggleBtn.textContent = "\u270e";
        let isEditing = false;

        const delBtn = document.createElement("button");
        delBtn.className = "abl-delete-btn";
        delBtn.title = "Remove";
        delBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        delBtn.addEventListener("click", () => {
          const notesPart = a.notes ? ` (${a.notes})` : "";
          addLog(`[Ability removed: ${a.name || "(unnamed)"}${notesPart}]`);
          abilities.splice(idx, 1);
          saveAbl();
          renderAbl();
        });

        topRow.append(
          nameSpan,
          nameEditIn,
          curEl,
          sep,
          maxSpan,
          maxEditIn,
          resetBtn,
          toggleBtn,
          delBtn,
        );

        // Notes: display span / edit textarea
        const notesSpan = document.createElement("div");
        notesSpan.className = "item-disp-note";
        notesSpan.textContent = a.notes;
        notesSpan.style.display = a.notes ? "" : "none";

        const notesEditIn = document.createElement("textarea");
        notesEditIn.className = "af-textarea";
        notesEditIn.value = a.notes || "";
        notesEditIn.placeholder =
          "Describe this ability, its effect, duration\u2026";
        notesEditIn.rows = 1;
        notesEditIn.style.display = "none";
        notesEditIn.setAttribute("data-ai-rewriter-ignore", "1");
        notesEditIn.addEventListener("input", () => {
          a.notes = notesEditIn.value;
          autoResizeTextarea(notesEditIn);
          scheduleAblSave();
        });

        toggleBtn.addEventListener("click", () => {
          isEditing = !isEditing;
          if (isEditing) {
            nameSpan.style.display = "none";
            nameEditIn.style.display = "";
            maxSpan.style.display = "none";
            maxEditIn.style.display = "";
            notesSpan.style.display = "none";
            notesEditIn.style.display = "";
            toggleBtn.className = "item-toggle-btn save";
            toggleBtn.textContent = "\u2713 Save";
            nameEditIn.value = a.name;
            maxEditIn.value = a.max;
            notesEditIn.value = a.notes || "";
            setTimeout(() => autoResizeTextarea(notesEditIn), 0);
            nameEditIn.focus();
          } else {
            nameEditIn.style.display = "none";
            nameSpan.style.display = "";
            maxEditIn.style.display = "none";
            maxSpan.style.display = "";
            notesEditIn.style.display = "none";
            toggleBtn.className = "item-toggle-btn edit";
            toggleBtn.textContent = "\u270e";
            nameSpan.textContent = a.name || "(unnamed)";
            maxSpan.textContent = a.max;
            notesSpan.textContent = a.notes;
            notesSpan.style.display = a.notes ? "" : "none";
          }
        });

        // Use buttons row (always visible)
        const useRow = document.createElement("div");
        useRow.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;";
        const useCount = Math.min(a.max, 10);
        for (let i = 0; i < useCount; i++) {
          const btn = document.createElement("button");
          btn.style.cssText =
            "flex:1;min-width:28px;padding:4px 0;border-radius:5px;font-size:10px;font-weight:700;font-family:inherit;cursor:pointer;border:1px solid;transition:background 0.12s,opacity 0.12s;";
          const used = i >= a.current;
          btn.style.background = used
            ? "rgba(108,99,255,0.04)"
            : "rgba(108,99,255,0.15)";
          btn.style.borderColor = used
            ? "rgba(108,99,255,0.1)"
            : "rgba(108,99,255,0.4)";
          btn.style.color = used ? "#334155" : "#a78bfa";
          btn.style.opacity = used ? "0.4" : "1";
          btn.textContent = "Use";
          btn.disabled = a.current === 0;
          btn.addEventListener("click", () => {
            if (a.current <= 0) return;
            a.current--;
            curEl.textContent = a.current;
            curEl.style.opacity = a.current === 0 ? "0.35" : "1";
            saveAbl();
            const notesPart = a.notes ? ` \u2014 ${a.notes}` : "";
            addLog(
              `[${a.name || "Ability"} used \u2014 ${a.current}/${a.max} remaining${notesPart}]`,
            );
            renderAbl();
          });
          useRow.appendChild(btn);
        }
        if (a.max > 10) {
          const more = document.createElement("span");
          more.style.cssText =
            "font-size:9.5px;color:#334155;align-self:center;padding:0 4px;";
          more.textContent = `+${a.max - 10} more`;
          useRow.appendChild(more);
        }

        wrapper.append(topRow, notesSpan, notesEditIn, useRow);
        ablListEl.appendChild(wrapper);
      });
    }

    // Ability add form (inserted before list)
    (function () {
      const form = document.createElement("div");
      form.className = "af-form";
      const nameIn = document.createElement("input");
      nameIn.type = "text";
      nameIn.className = "af-input";
      nameIn.placeholder = "Ability name\u2026";
      nameIn.maxLength = 40;
      nameIn.setAttribute("data-ai-rewriter-ignore", "1");
      const maxIn = document.createElement("input");
      maxIn.type = "number";
      maxIn.className = "af-number";
      maxIn.value = "3";
      maxIn.min = "1";
      maxIn.max = "99";
      maxIn.setAttribute("data-ai-rewriter-ignore", "1");
      const notesIn = document.createElement("textarea");
      notesIn.className = "af-textarea";
      notesIn.rows = 1;
      notesIn.placeholder = "Description, effect, duration (optional)\u2026";
      notesIn.setAttribute("data-ai-rewriter-ignore", "1");
      const submitBtn = document.createElement("button");
      submitBtn.className = "af-submit";
      submitBtn.textContent = "+ Add Ability";
      const row = document.createElement("div");
      row.className = "af-row";
      row.append(nameIn, maxIn, submitBtn);
      form.append(row, notesIn);
      ablListEl.parentNode.insertBefore(form, ablListEl);
      const doAdd = () => {
        const name = nameIn.value.trim();
        const max = Math.max(1, parseInt(maxIn.value, 10) || 3);
        const notes = notesIn.value.trim();
        const abl = newAbl();
        abl.name = name;
        abl.max = max;
        abl.current = max;
        abl.notes = notes;
        abilities.push(abl);
        saveAbl();
        renderAbl();
        const notesPart = notes ? ` \u2014 ${notes}` : "";
        addLog(
          `[Ability added: ${name || "(unnamed)"}${notesPart} (${max}/${max} uses)]`,
        );
        nameIn.value = "";
        maxIn.value = "3";
        notesIn.value = "";
        autoResizeTextarea(notesIn);
        nameIn.focus();
      };
      submitBtn.addEventListener("click", doAdd);
      nameIn.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          doAdd();
        }
      });
      notesIn.addEventListener("input", () => autoResizeTextarea(notesIn));
    })();

    function loadAbl() {
      chrome.storage.local.get(ABL_KEY, (d) => {
        abilities = Array.isArray(d[ABL_KEY]) ? d[ABL_KEY] : [];
        renderAbl();
      });
    }

    /* ════════════════ PARTY TRACKER ════════════════ */
    const PARTY_KEY = "sc_party_v1_" + chatId;
    const PARTY_STATUSES = ["active", "downed", "dead", "absent"];
    let party = [];
    let partySaveTimer = null;
    const partyListEl = document.getElementById("sc-np-party-list");

    function newPartyMember() {
      return { id: Date.now() + Math.random(), name: "", status: "active" };
    }
    function saveParty() {
      chrome.storage.local.set({ [PARTY_KEY]: party });
    }
    function schedulePartySave() {
      clearTimeout(partySaveTimer);
      partySaveTimer = setTimeout(saveParty, 500);
    }

    function renderParty() {
      partyListEl.innerHTML = "";
      if (!party.length) {
        const e = document.createElement("div");
        e.className = "ql-empty-state";
        e.style.padding = "6px 0";
        e.textContent = "No party members yet.";
        partyListEl.appendChild(e);
        return;
      }
      party.forEach((m, idx) => {
        const row = document.createElement("div");
        row.className = "party-item";
        const statusBtn = document.createElement("button");
        statusBtn.className = "party-status-btn party-status-" + m.status;
        statusBtn.textContent =
          m.status.charAt(0).toUpperCase() + m.status.slice(1);
        statusBtn.title = "Click to cycle status";
        statusBtn.addEventListener("click", () => {
          const cur = PARTY_STATUSES.indexOf(m.status);
          m.status = PARTY_STATUSES[(cur + 1) % PARTY_STATUSES.length];
          statusBtn.className = "party-status-btn party-status-" + m.status;
          statusBtn.textContent =
            m.status.charAt(0).toUpperCase() + m.status.slice(1);
          saveParty();
          addLog(`[Party: ${m.name || "(unnamed)"} → ${m.status}]`);
        });
        const nameSpan = document.createElement("span");
        nameSpan.className = "item-disp-name";
        nameSpan.textContent = m.name || "(unnamed)";
        const nameEditIn = document.createElement("input");
        nameEditIn.type = "text";
        nameEditIn.className = "af-input";
        nameEditIn.value = m.name;
        nameEditIn.placeholder = "Name\u2026";
        nameEditIn.maxLength = 40;
        nameEditIn.style.display = "none";
        nameEditIn.setAttribute("data-ai-rewriter-ignore", "1");
        nameEditIn.addEventListener("input", () => {
          m.name = nameEditIn.value;
          schedulePartySave();
        });
        const toggleBtn = document.createElement("button");
        toggleBtn.className = "item-toggle-btn edit";
        toggleBtn.textContent = "✎";
        let isEditing = false;
        toggleBtn.addEventListener("click", () => {
          isEditing = !isEditing;
          if (isEditing) {
            nameSpan.style.display = "none";
            nameEditIn.style.display = "";
            toggleBtn.className = "item-toggle-btn save";
            toggleBtn.textContent = "✓ Save";
            nameEditIn.value = m.name;
            nameEditIn.focus();
          } else {
            nameEditIn.style.display = "none";
            nameSpan.style.display = "";
            toggleBtn.className = "item-toggle-btn edit";
            toggleBtn.textContent = "✎";
            nameSpan.textContent = m.name || "(unnamed)";
          }
        });
        const delBtn = document.createElement("button");
        delBtn.className = "party-delete-btn";
        delBtn.title = "Remove";
        delBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        delBtn.addEventListener("click", () => {
          addLog(`[Party: ${m.name || "(unnamed)"} removed]`);
          party.splice(idx, 1);
          saveParty();
          renderParty();
        });
        row.append(statusBtn, nameSpan, nameEditIn, toggleBtn, delBtn);
        partyListEl.appendChild(row);
      });
    }

    // Party add form
    (function () {
      const form = document.createElement("div");
      form.className = "af-form";
      const nameIn = document.createElement("input");
      nameIn.type = "text";
      nameIn.className = "af-input";
      nameIn.placeholder = "Member name\u2026";
      nameIn.maxLength = 40;
      nameIn.setAttribute("data-ai-rewriter-ignore", "1");
      const statusSel = document.createElement("select");
      statusSel.className = "af-select";
      statusSel.style.maxWidth = "90px";
      statusSel.setAttribute("data-ai-rewriter-ignore", "1");
      PARTY_STATUSES.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s.charAt(0).toUpperCase() + s.slice(1);
        statusSel.appendChild(opt);
      });
      const submitBtn = document.createElement("button");
      submitBtn.className = "af-submit";
      submitBtn.textContent = "+ Add";
      const row = document.createElement("div");
      row.className = "af-row";
      row.append(nameIn, statusSel, submitBtn);
      form.appendChild(row);
      partyListEl.parentNode.insertBefore(form, partyListEl);
      const doAdd = () => {
        const name = nameIn.value.trim();
        const status = statusSel.value || "active";
        const member = newPartyMember();
        member.name = name;
        member.status = status;
        party.push(member);
        saveParty();
        renderParty();
        addLog(`[Party: ${name || "(unnamed)"} joined — ${status}]`);
        nameIn.value = "";
        statusSel.value = "active";
        nameIn.focus();
      };
      submitBtn.addEventListener("click", doAdd);
      nameIn.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          doAdd();
        }
      });
    })();

    function loadParty() {
      chrome.storage.local.get(PARTY_KEY, (d) => {
        party = Array.isArray(d[PARTY_KEY]) ? d[PARTY_KEY] : [];
        renderParty();
      });
    }

    /* ════════════════ NPC TRACKER ════════════════ */
    const NPC_KEY = "sc_npc_v1_" + chatId;
    const NPC_DISPS = ["friendly", "neutral", "hostile"];
    const DISP_LABELS = {
      friendly: "Friendly",
      neutral: "Neutral",
      hostile: "Hostile",
    };
    let npcs = [];
    let npcSaveTimer = null;
    const npcListEl = document.getElementById("sc-np-npc-list");

    function newNpc() {
      return {
        id: Date.now() + Math.random(),
        name: "",
        note: "",
        disp: "neutral",
      };
    }
    function saveNpcs() {
      chrome.storage.local.set({ [NPC_KEY]: npcs });
    }
    function scheduleNpcSave() {
      clearTimeout(npcSaveTimer);
      npcSaveTimer = setTimeout(saveNpcs, 500);
    }

    function renderNpcs() {
      npcListEl.innerHTML = "";
      if (!npcs.length) {
        const e = document.createElement("div");
        e.className = "ql-empty-state";
        e.style.padding = "6px 0";
        e.textContent = "No NPCs yet.";
        npcListEl.appendChild(e);
        return;
      }
      npcs.forEach((n, idx) => {
        const card = document.createElement("div");
        card.className = "npc-item";
        const top = document.createElement("div");
        top.className = "npc-top";
        const dispBtn = document.createElement("button");
        dispBtn.className = "npc-disp-btn npc-disp-" + n.disp;
        dispBtn.textContent = DISP_LABELS[n.disp];
        dispBtn.title = "Click to cycle disposition";
        dispBtn.addEventListener("click", () => {
          const cur = NPC_DISPS.indexOf(n.disp);
          n.disp = NPC_DISPS[(cur + 1) % NPC_DISPS.length];
          dispBtn.className = "npc-disp-btn npc-disp-" + n.disp;
          dispBtn.textContent = DISP_LABELS[n.disp];
          addLog(`[NPC ${n.name || "(unnamed)"} \u2192 ${n.disp}]`);
          saveNpcs();
        });
        // Name: display / edit
        const nameSpan = document.createElement("span");
        nameSpan.className = "item-disp-name";
        nameSpan.textContent = n.name || "(unnamed)";
        const nameEditIn = document.createElement("input");
        nameEditIn.type = "text";
        nameEditIn.className = "af-input";
        nameEditIn.value = n.name;
        nameEditIn.placeholder = "NPC name\u2026";
        nameEditIn.maxLength = 40;
        nameEditIn.style.display = "none";
        nameEditIn.setAttribute("data-ai-rewriter-ignore", "1");
        nameEditIn.addEventListener("input", () => {
          n.name = nameEditIn.value;
          scheduleNpcSave();
        });
        const toggleBtn = document.createElement("button");
        toggleBtn.className = "item-toggle-btn edit";
        toggleBtn.textContent = "✎";
        let isEditing = false;
        const delBtn = document.createElement("button");
        delBtn.className = "npc-delete-btn";
        delBtn.title = "Remove";
        delBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        delBtn.addEventListener("click", () => {
          addLog(`[NPC removed: ${n.name || "(unnamed)"}]`);
          npcs.splice(idx, 1);
          saveNpcs();
          renderNpcs();
        });
        top.append(dispBtn, nameSpan, nameEditIn, toggleBtn, delBtn);
        // Note: display / edit
        const noteSpan = document.createElement("div");
        noteSpan.style.cssText =
          "color:#64748b;font-size:11.5px;font-family:inherit;padding:2px 0;";
        noteSpan.textContent = n.note;
        noteSpan.style.display = n.note ? "" : "none";
        const noteEditIn = document.createElement("input");
        noteEditIn.type = "text";
        noteEditIn.className = "af-input";
        noteEditIn.value = n.note;
        noteEditIn.placeholder = "Short note\u2026";
        noteEditIn.maxLength = 80;
        noteEditIn.style.display = "none";
        noteEditIn.setAttribute("data-ai-rewriter-ignore", "1");
        noteEditIn.addEventListener("input", () => {
          n.note = noteEditIn.value;
          scheduleNpcSave();
        });
        toggleBtn.addEventListener("click", () => {
          isEditing = !isEditing;
          if (isEditing) {
            nameSpan.style.display = "none";
            nameEditIn.style.display = "";
            noteSpan.style.display = "none";
            noteEditIn.style.display = "";
            toggleBtn.className = "item-toggle-btn save";
            toggleBtn.textContent = "✓ Save";
            nameEditIn.value = n.name;
            noteEditIn.value = n.note;
            nameEditIn.focus();
          } else {
            nameEditIn.style.display = "none";
            noteEditIn.style.display = "none";
            toggleBtn.className = "item-toggle-btn edit";
            toggleBtn.textContent = "✎";
            nameSpan.style.display = "";
            nameSpan.textContent = n.name || "(unnamed)";
            noteSpan.textContent = n.note;
            noteSpan.style.display = n.note ? "" : "none";
          }
        });
        card.append(top, noteSpan, noteEditIn);
        npcListEl.appendChild(card);
      });
    }

    // NPC add form
    (function () {
      const form = document.createElement("div");
      form.className = "af-form";
      const nameIn = document.createElement("input");
      nameIn.type = "text";
      nameIn.className = "af-input";
      nameIn.placeholder = "NPC name\u2026";
      nameIn.maxLength = 40;
      nameIn.setAttribute("data-ai-rewriter-ignore", "1");
      const noteIn = document.createElement("input");
      noteIn.type = "text";
      noteIn.className = "af-input";
      noteIn.placeholder = "Note (optional)\u2026";
      noteIn.maxLength = 80;
      noteIn.setAttribute("data-ai-rewriter-ignore", "1");
      const dispSel = document.createElement("select");
      dispSel.className = "af-select";
      dispSel.style.maxWidth = "90px";
      dispSel.setAttribute("data-ai-rewriter-ignore", "1");
      NPC_DISPS.forEach((d) => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = DISP_LABELS[d];
        dispSel.appendChild(opt);
      });
      dispSel.value = "neutral";
      const submitBtn = document.createElement("button");
      submitBtn.className = "af-submit";
      submitBtn.textContent = "+ Add NPC";
      const row1 = document.createElement("div");
      row1.className = "af-row";
      row1.append(nameIn, dispSel, submitBtn);
      form.append(row1, noteIn);
      npcListEl.parentNode.insertBefore(form, npcListEl);
      const doAdd = () => {
        const name = nameIn.value.trim();
        const note = noteIn.value.trim();
        const disp = dispSel.value || "neutral";
        const npc = newNpc();
        npc.name = name;
        npc.note = note;
        npc.disp = disp;
        npcs.push(npc);
        saveNpcs();
        renderNpcs();
        const notePart = note ? ` \u2014 ${note}` : "";
        addLog(`[NPC met: ${name || "(unnamed)"} (${disp})${notePart}]`);
        nameIn.value = "";
        noteIn.value = "";
        dispSel.value = "neutral";
        nameIn.focus();
      };
      submitBtn.addEventListener("click", doAdd);
      nameIn.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          doAdd();
        }
      });
    })();

    function loadNpcs() {
      chrome.storage.local.get(NPC_KEY, (d) => {
        npcs = Array.isArray(d[NPC_KEY]) ? d[NPC_KEY] : [];
        renderNpcs();
      });
    }

    /* ════════════════ RUMOURS BOARD ════════════════ */
    const RUMOUR_KEY = "sc_rumour_v1_" + chatId;
    let rumours = [];
    let rumourSaveTimer = null;
    const rumourListEl = document.getElementById("sc-np-rumour-list");
    const rumourAddBtn = document.getElementById("sc-np-rumour-add");

    function newRumour() {
      return { id: Date.now() + Math.random(), text: "", done: false };
    }
    function saveRumours() {
      chrome.storage.local.set({ [RUMOUR_KEY]: rumours });
    }
    function scheduleRumourSave() {
      clearTimeout(rumourSaveTimer);
      rumourSaveTimer = setTimeout(saveRumours, 500);
    }

    function renderRumours() {
      rumourListEl.innerHTML = "";
      if (!rumours.length) {
        const e = document.createElement("div");
        e.className = "ql-empty-state";
        e.style.padding = "6px 0";
        e.textContent = "No rumours yet.";
        rumourListEl.appendChild(e);
        return;
      }
      rumours.forEach((r, idx) => {
        const row = document.createElement("div");
        row.className = "rumour-item" + (r.done ? " rumour-done" : "");
        const check = document.createElement("div");
        check.className = "rumour-check";
        check.title = "Mark as followed up";
        if (r.done)
          check.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        check.addEventListener("click", () => {
          r.done = !r.done;
          addLog(
            `[Rumour ${r.done ? "followed up" : "reopened"}: "${(r.text || "(empty)").slice(0, 40)}"]`,
          );
          saveRumours();
          renderRumours();
        });
        const textIn = document.createElement("textarea");
        textIn.className = "rumour-text-input";
        textIn.value = r.text;
        textIn.placeholder = "Rumour or lead\u2026";
        textIn.rows = 1;
        textIn.setAttribute("data-ai-rewriter-ignore", "1");
        textIn.addEventListener("input", () => {
          r.text = textIn.value;
          autoResizeTextarea(textIn);
          scheduleRumourSave();
        });
        setTimeout(() => autoResizeTextarea(textIn), 0);
        const delBtn = document.createElement("button");
        delBtn.className = "rumour-delete-btn";
        delBtn.title = "Remove";
        delBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        delBtn.addEventListener("click", () => {
          addLog(`[Rumour removed: "${(r.text || "(empty)").slice(0, 40)}"]`);
          rumours.splice(idx, 1);
          saveRumours();
          renderRumours();
        });
        row.append(check, textIn, delBtn);
        rumourListEl.appendChild(row);
      });
    }

    rumourAddBtn.addEventListener("click", () => {
      const rumour = newRumour();
      rumours.push(rumour);
      saveRumours();
      renderRumours();
      const inputs = rumourListEl.querySelectorAll(".rumour-text-input");
      if (inputs.length) {
        const lastInput = inputs[inputs.length - 1];
        lastInput.focus();
        const logOnBlur = () => {
          lastInput.removeEventListener("blur", logOnBlur);
          if (rumour.text.trim())
            addLog(`[Rumour added: "${rumour.text.slice(0, 60)}"]`);
        };
        lastInput.addEventListener("blur", logOnBlur);
      }
    });

    function loadRumours() {
      chrome.storage.local.get(RUMOUR_KEY, (d) => {
        rumours = Array.isArray(d[RUMOUR_KEY]) ? d[RUMOUR_KEY] : [];
        renderRumours();
      });
    }

    /* ── Open / close ── */
    function setOpen(val) {
      isOpen = val;
      drawer.classList.toggle("sc-np-open", val);
      document.documentElement.classList.toggle("sc-np-open", val);
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen) setOpen(false);
    });

    const btnClose = document.getElementById("sc-np-btn-close");
    tab.addEventListener("click", () => setOpen(!isOpen));
    btnClose.addEventListener("click", () => setOpen(false));

    /* ── Tab switching ── */
    function setTab(t) {
      activeTab = t;
      document.querySelectorAll(".sc-np-tab-pill").forEach((p) => {
        p.classList.toggle("active", p.dataset.tab === t);
      });
      questsPanel.classList.toggle("sc-np-hidden", t !== "quests");
      rpPanel.classList.toggle("visible", t === "rp");
      fmtPanel.classList.toggle("visible", t === "fmt");
      if (t === "fmt") loadFormatterPanel();
    }

    document.querySelectorAll(".sc-np-tab-pill").forEach((btn) => {
      btn.addEventListener("click", () => setTab(btn.dataset.tab));
    });

    /* ── Persona save/load ── */
    let drawerPersonas = Array.from({ length: 5 }, () => ({
      label: "",
      name: "",
      prepend: "",
    }));
    let drawerActiveIdx = -1;

    function buildDrawerPersonaPills() {
      rpPersonaPillsEl.innerHTML = "";
      drawerPersonas.forEach((p, idx) => {
        const btn = document.createElement("button");
        btn.className =
          "sc-persona-pill" + (idx === drawerActiveIdx ? " active" : "");
        btn.dataset.idx = idx;
        const label = (p.label || "").trim() || String(idx + 1);
        btn.textContent =
          label.length > 9 ? label.slice(0, 8) + "\u2026" : label;
        btn.addEventListener("click", () => {
          drawerActiveIdx = drawerActiveIdx === idx ? -1 : idx;
          chrome.storage.sync.set({ rpActivePersonaIndex: drawerActiveIdx });
          buildDrawerPersonaPills();
          showDrawerPersonaEditor();
          triggerPersonaAutosave();
        });
        rpPersonaPillsEl.appendChild(btn);
      });
    }

    function showDrawerPersonaEditor() {
      if (drawerActiveIdx < 0) {
        rpPersonaEditorEl.style.display = "none";
      } else {
        rpPersonaEditorEl.style.display = "";
        const p = drawerPersonas[drawerActiveIdx];
        rpPersonaLabelInput.value = p.label || "";
        rpPersonaNameInput.value = p.name || "";
        rpPersonaPrependTa.value = p.prepend || "";
      }
    }

    function savePersona() {
      if (drawerActiveIdx >= 0) {
        drawerPersonas[drawerActiveIdx] = {
          label: rpPersonaLabelInput.value,
          name: rpPersonaNameInput.value,
          prepend: rpPersonaPrependTa.value,
        };
        // Refresh pill label live
        buildDrawerPersonaPills();
      }
      chrome.storage.sync.set({
        rpPersonas: drawerPersonas,
        rpActivePersonaIndex: drawerActiveIdx,
      });
      rpAutosaveEl.classList.add("visible");
      clearTimeout(rpAutosaveTimer);
      rpAutosaveTimer = setTimeout(
        () => rpAutosaveEl.classList.remove("visible"),
        1800,
      );
    }

    function triggerPersonaAutosave() {
      savePersona();
    }

    function schedulePersonaSave() {
      clearTimeout(rpSaveTimer);
      rpSaveTimer = setTimeout(savePersona, 600);
    }

    rpPersonaLabelInput.addEventListener("input", schedulePersonaSave);
    rpPersonaNameInput.addEventListener("input", schedulePersonaSave);
    rpPersonaPrependTa.addEventListener("input", schedulePersonaSave);

    chrome.storage.sync.get(
      [
        "rpPersonas",
        "rpActivePersonaIndex",
        "rpPersonaEnabled",
        "rpPersonaName",
        "rpPersonaPrepend",
      ],
      (data) => {
        if (Array.isArray(data.rpPersonas) && data.rpPersonas.length > 0) {
          drawerPersonas = data.rpPersonas.slice(0, 5);
          while (drawerPersonas.length < 5)
            drawerPersonas.push({ label: "", name: "", prepend: "" });
          drawerActiveIdx =
            typeof data.rpActivePersonaIndex === "number"
              ? data.rpActivePersonaIndex
              : -1;
        } else if (data.rpPersonaName || data.rpPersonaPrepend) {
          // Migrate old single-persona storage
          drawerPersonas[0] = {
            label: data.rpPersonaName || "Persona 1",
            name: data.rpPersonaName || "",
            prepend: data.rpPersonaPrepend || "",
          };
          drawerActiveIdx = data.rpPersonaEnabled === true ? 0 : -1;
        }
        buildDrawerPersonaPills();
        showDrawerPersonaEditor();
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

    function showLogState(detail) {
      rpLogEmptyEl.style.display = "none";
      rpLogInfo.style.display = "flex";
      const modelFull = detail.model || "unknown";
      rpLogModelEl.textContent = modelFull.split("/").pop();
      rpLogModelEl.title = modelFull;
      const u = detail.usage;
      if (u) {
        rpLogPromptTokEl.textContent =
          u.prompt_tokens != null ? u.prompt_tokens.toLocaleString() : "—";
        rpLogCompletionTokEl.textContent =
          u.completion_tokens != null
            ? u.completion_tokens.toLocaleString()
            : "—";
        rpLogTotalTokEl.textContent =
          u.total_tokens != null ? u.total_tokens.toLocaleString() : "—";
        const reasoning = u.completion_tokens_details?.reasoning_tokens;
        rpLogThinkingRow.style.display = reasoning ? "" : "none";
        if (reasoning)
          rpLogThinkingTokEl.textContent = reasoning.toLocaleString();
        const cached = u.prompt_tokens_details?.cached_tokens;
        rpLogCachedRow.style.display = cached ? "" : "none";
        if (cached) rpLogCachedTokEl.textContent = cached.toLocaleString();
        const cost = u.cost;
        rpLogCostRow.style.display = cost != null ? "" : "none";
        if (cost != null)
          rpLogCostEl.textContent = cost === 0 ? "Free" : `$${cost.toFixed(6)}`;
      } else {
        rpLogPromptTokEl.textContent = "—";
        rpLogCompletionTokEl.textContent = "—";
        rpLogTotalTokEl.textContent = "—";
        rpLogThinkingRow.style.display = "none";
        rpLogCachedRow.style.display = "none";
        rpLogCostRow.style.display = "none";
      }
      rpLogElapsedEl.textContent =
        detail.elapsed != null ? `${detail.elapsed}s` : "—";
      rpLogPromptTextEl.textContent = detail.promptText || "—";
      if (detail.reasoning) {
        rpLogThinkingBlock.style.display = "";
        rpLogThinkingTextEl.textContent = detail.reasoning;
      } else {
        rpLogThinkingBlock.style.display = "none";
      }
      rpLogOutputTextEl.textContent = detail.after || "—";
    }

    document.addEventListener("sc-rp-rewrite-done", (e) => {
      showRewriteState(e.detail);
      showLogState(e.detail);
    });
    document.addEventListener("sc-rp-undo-done", () => clearRewriteState());

    rpUndoBtn.addEventListener("click", () => {
      rpUndoBtn.disabled = true;
      document.dispatchEvent(new CustomEvent("sc-rp-undo"));
    });

    /* Load last rewrite state (persists across page loads) */
    chrome.storage.local.get("sc_last_rewrite", (data) => {
      if (data.sc_last_rewrite) {
        showRewriteState(data.sc_last_rewrite);
        showLogState(data.sc_last_rewrite);
      }
    });

    /* ── Global Style Rules ── */
    let rpGsSaveTimer = null;
    let rpGsAutosaveTimer = null;

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
      rpGlobalStyleTa.value = data.rpGlobalStyle || "";
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

    /* ── Formatter reference panel ── */
    const FMT_KEYS_TO_WATCH = [
      "formatterEnabled",
      "formatterKeyword",
      "fmtShortcut",
      "autoFormatAfterRewrite",
      "fmtStripAsterisks",
      "fmtNormaliseQuotes",
      "fmtNormaliseApostrophes",
      "fmtNormaliseEllipsis",
      "fmtCollapseSpaces",
      "fmtCapitaliseI",
      "fmtCapitaliseQuotes",
      "fmtTrimLines",
      "fmtNormaliseNewlines",
      "fmtCapitaliseSentences",
      "fmtUnwrapBrackets",
      "fmtExtraDelimiters",
      "fmtRepairAsterisks",
      "fmtActionPunctuation",
      "fmtOocBrackets",
      "fmtEmDash",
      "fmtNoSpaceBeforePunct",
      "fmtSpaceAfterPunct",
    ];

    const FMT_GROUPS = [
      {
        label: "NORMALISATION",
        rows: [
          {
            key: "fmtStripAsterisks",
            name: "Strip asterisks before re-wrapping",
            b: "*she waves*",
            a: "she waves",
          },
          {
            key: "fmtNormaliseQuotes",
            name: "Curly \u201C\u201D \u2192 straight quotes",
            b: "\u201Coh wow\u201D",
            a: '"oh wow"',
          },
          {
            key: "fmtNormaliseApostrophes",
            name: "Curly \u2018\u2019 \u2192 straight apostrophe",
            b: "it\u2019s fine",
            a: "it's fine",
          },
          {
            key: "fmtNormaliseEllipsis",
            name: "Normalise dot runs \u2192 \u2026",
            b: "wait..",
            a: "wait\u2026",
            b2: "wait....",
            a2: "wait\u2026",
          },
          {
            key: "fmtCollapseSpaces",
            name: "Collapse multiple spaces",
            b: "hello   world",
            a: "hello world",
          },
          {
            key: "fmtCapitaliseI",
            name: "Capitalise pronoun i \u2192 I",
            b: "i think i do",
            a: "I think I do",
          },
          {
            key: "fmtCapitaliseQuotes",
            name: "Capitalise dialogue opening letter",
            b: '"oh wow"',
            a: '"Oh wow"',
          },
          {
            key: "fmtEmDash",
            name: "Em-dash -- \u2192 \u2014",
            b: "wait -- then",
            a: "wait \u2014 then",
          },
          {
            key: "fmtNoSpaceBeforePunct",
            name: "Remove space before punctuation",
            b: "hello , she said .",
            a: "hello, she said.",
          },
          {
            key: "fmtSpaceAfterPunct",
            name: "Ensure space after punctuation",
            b: "hello.she",
            a: "hello. She",
          },
        ],
      },
      {
        label: "STRUCTURE",
        rows: [
          {
            key: "fmtTrimLines",
            name: "Trim paragraph whitespace",
            b: "  hello  ",
            a: "hello",
          },
          {
            key: "fmtNormaliseNewlines",
            name: "Normalise paragraph spacing",
            hint: "3+ consecutive blank lines collapsed to one blank line",
          },
          {
            key: "fmtCapitaliseSentences",
            name: "Capitalise sentences",
            b: "hello. world",
            a: "Hello. World",
          },
        ],
      },
      {
        label: "WRAPPING",
        rows: [
          {
            key: "fmtUnwrapBrackets",
            name: "Leave [ ] square brackets unwrapped",
            b: "[aside] walk",
            a: "[aside] *walk.*",
          },
        ],
      },
      {
        label: "ROLEPLAY",
        rows: [
          {
            key: "fmtRepairAsterisks",
            name: "Repair unclosed * action marker",
            b: "*she waves",
            a: "*she waves*",
          },
          {
            key: "fmtActionPunctuation",
            name: "Action punctuation enforcer",
            b: "*she waves*",
            a: "*she waves.*",
          },
          {
            key: "fmtOocBrackets",
            name: "OOC (( )) \u2192 single parentheses",
            b: "((ooc note))",
            a: "(ooc note)",
          },
        ],
      },
    ];

    function escH(s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    function renderFormatterPanel(d) {
      fmtPanel.innerHTML = "";
      const enabled = d.formatterEnabled !== false;
      const keyword = d.formatterKeyword || "//format";
      const shortcut = "Ctrl+" + (d.fmtShortcut || "m").toUpperCase();
      const autoFmt = d.autoFormatAfterRewrite !== false;

      // ── Header card ──
      const hCard = document.createElement("div");
      hCard.className = "rp-card";
      hCard.style.cssText = "padding:10px 14px;gap:8px;";
      hCard.innerHTML = `
        <div class="fmt-master-row">
          <span style="font-size:12px;font-weight:600;color:#cbd5e1;">Auto-formatter</span>
          <span class="fmt-master-badge ${enabled ? "on" : "off"}">${enabled ? "ENABLED" : "DISABLED"}</span>
        </div>
        <div class="fmt-meta-row">
          <span>keyword</span><span class="fmt-meta-chip">${escH(keyword)}</span>
          <span style="margin-left:4px;">shortcut</span><span class="fmt-meta-chip">${escH(shortcut)}</span>
          <span style="margin-left:4px;">auto after rewrite</span>
          <span class="fmt-master-badge ${autoFmt ? "on" : "off"}" style="font-size:9.5px;">${autoFmt ? "ON" : "OFF"}</span>
        </div>
        <div style="font-size:10px;color:#334155;font-style:italic;margin-top:2px;">
          Text outside quotes &amp; [brackets] is wrapped in
          <span style="color:#6c63ff;font-family:ui-monospace,monospace;">*asterisks*</span> automatically.
        </div>`;
      fmtPanel.appendChild(hCard);

      if (!enabled) {
        const notice = document.createElement("div");
        notice.className = "fmt-disabled-notice";
        notice.textContent =
          "Formatter is disabled — settings below are stored but inactive.";
        fmtPanel.appendChild(notice);
      }

      // ── Setting groups ──
      FMT_GROUPS.forEach(({ label, rows }) => {
        const sec = document.createElement("div");
        sec.className = "rp-section-label";
        sec.textContent = label;
        fmtPanel.appendChild(sec);

        const card = document.createElement("div");
        card.className = "rp-card";
        card.style.padding = "4px 14px";

        rows.forEach(({ key, name, b, a, b2, a2, hint }) => {
          const on = d[key] !== false;
          const row = document.createElement("div");
          row.className = "fmt-row" + (on ? "" : " off");

          const dot = document.createElement("span");
          dot.className = "fmt-dot " + (on ? "on" : "off");

          const body = document.createElement("div");
          body.className = "fmt-row-body";

          const nameEl = document.createElement("span");
          nameEl.className = "fmt-row-name";
          nameEl.textContent = name;
          body.appendChild(nameEl);

          if (hint) {
            const hintEl = document.createElement("span");
            hintEl.className = "rp-hint";
            hintEl.style.fontSize = "10px";
            hintEl.textContent = hint;
            body.appendChild(hintEl);
          } else if (b !== undefined) {
            const exEl = document.createElement("div");
            exEl.className = "fmt-example";
            const addPair = (before, after) => {
              const bEl = document.createElement("span");
              bEl.className = "fmt-ex-before";
              bEl.textContent = before;
              const arr = document.createElement("span");
              arr.className = "fmt-ex-arrow";
              arr.textContent = "\u2192";
              const aEl = document.createElement("span");
              aEl.className = "fmt-ex-after";
              aEl.textContent = after;
              exEl.append(bEl, arr, aEl);
            };
            addPair(b, a);
            if (b2 !== undefined) {
              const sep = document.createElement("span");
              sep.className = "fmt-ex-arrow";
              sep.style.margin = "0 3px";
              sep.textContent = "\u00b7";
              exEl.appendChild(sep);
              addPair(b2, a2);
            }
            body.appendChild(exEl);
          }

          row.append(dot, body);
          card.appendChild(row);
        });

        // Extra delimiters row — appended to Wrapping card if set
        if (label === "WRAPPING") {
          const extras = (d.fmtExtraDelimiters || "").trim();
          if (extras) {
            const sep = document.createElement("div");
            sep.style.cssText =
              "height:1px;background:rgba(108,99,255,0.07);margin:2px 0;";
            card.appendChild(sep);
            const eRow = document.createElement("div");
            eRow.className = "fmt-row";
            const eDot = document.createElement("span");
            eDot.className = "fmt-dot on";
            const eBody = document.createElement("div");
            eBody.className = "fmt-row-body";
            const eName = document.createElement("span");
            eName.className = "fmt-row-name";
            eName.textContent = "Extra unwrapped delimiter pairs";
            const eEx = document.createElement("div");
            eEx.className = "fmt-example";
            const eChip = document.createElement("span");
            eChip.className = "fmt-ex-before";
            eChip.style.cssText =
              "color:#a78bfa;background:rgba(108,99,255,0.1);border-color:rgba(108,99,255,0.25);";
            eChip.textContent = extras;
            eEx.appendChild(eChip);
            eBody.append(eName, eEx);
            eRow.append(eDot, eBody);
            card.appendChild(eRow);
          }
        }

        fmtPanel.appendChild(card);
      });
    }

    function loadFormatterPanel() {
      chrome.storage.sync.get(FMT_KEYS_TO_WATCH, renderFormatterPanel);
    }

    // Live-reload when settings change while Formatter tab is active
    chrome.storage.onChanged.addListener((changes) => {
      if (activeTab === "fmt" && FMT_KEYS_TO_WATCH.some((k) => k in changes)) {
        loadFormatterPanel();
      }
    });

    /* ════════════════ ACTIVITY LOG ════════════════ */
    const logStripEl = document.getElementById("sc-np-log-strip");
    const logInnerEl = document.getElementById("sc-np-log-strip-inner");
    const logClearBtn = document.getElementById("sc-np-log-clear-btn");
    const MAX_LOG = 10;
    let activityLog = [];

    function fmtTs() {
      return new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    function flashCopyBtnLabel(btn, label) {
      btn.classList.add("inserted");
      const orig = btn.textContent;
      btn.textContent = "\u2714 Inserted";
      setTimeout(() => {
        btn.classList.remove("inserted");
        btn.textContent = orig;
      }, 1400);
    }

    function addLog(msg) {
      const ts = fmtTs();
      activityLog.unshift({ ts, msg });
      if (activityLog.length > MAX_LOG) activityLog.pop();
      renderLog();
      document.dispatchEvent(
        new CustomEvent("sc-rp-inject", {
          detail: { text: "\n" + msg, silent: true },
        }),
      );
    }

    function renderLog() {
      logInnerEl.innerHTML = "";
      logStripEl.classList.toggle("has-entries", activityLog.length > 0);
      activityLog.forEach(({ ts, msg }) => {
        const row = document.createElement("div");
        row.className = "log-entry";
        const tsEl = document.createElement("span");
        tsEl.className = "log-ts";
        tsEl.textContent = ts;
        const msgEl = document.createElement("span");
        msgEl.className = "log-msg";
        msgEl.textContent = msg;
        const cpBtn = document.createElement("button");
        cpBtn.className = "log-copy-btn";
        cpBtn.textContent = "\u2398";
        cpBtn.title = "Insert into chat";
        cpBtn.addEventListener("click", () => {
          document.dispatchEvent(
            new CustomEvent("sc-rp-inject", {
              detail: { text: "\n" + msg, silent: true },
            }),
          );
          cpBtn.textContent = "\u2714";
          setTimeout(() => {
            cpBtn.textContent = "\u2398";
          }, 1000);
        });
        row.append(tsEl, msgEl, cpBtn);
        logInnerEl.appendChild(row);
      });
    }

    logClearBtn.addEventListener("click", () => {
      activityLog = [];
      renderLog();
    });

    /* ════════════════ EXPORT FUNCTIONS ════════════════ */
    function exportQuests() {
      if (!quests.length) return "[Quests: none]";
      const parts = quests.map((q) => {
        const st =
          q.state === "done"
            ? "\u2713"
            : q.state === "failed"
              ? "\u2717"
              : "\u25cb";
        const upd = q.update ? ` > ${q.update}` : "";
        return `${st} ${q.title || "(untitled)"}${q.notes ? " \u2014 " + q.notes : ""}${upd}`;
      });
      return `[Quests: ${parts.join(" | ")}]`;
    }

    function exportResources() {
      if (!resources.length) return "[Resources: none]";
      const parts = resources.map((r) => {
        const note = r.notes ? ` (${r.notes})` : "";
        return `${r.name || "(unnamed)"} ${r.value}${note}`;
      });
      return `[Resources: ${parts.join(" | ")}]`;
    }

    function exportAbilities() {
      if (!abilities.length) return "[Abilities: none]";
      const parts = abilities.map((a) => {
        const note = a.notes ? ` (${a.notes})` : "";
        return `${a.name || "(unnamed)"} ${a.current}/${a.max}${note}`;
      });
      return `[Abilities: ${parts.join(" | ")}]`;
    }

    function exportParty() {
      if (!party.length) return "[Party: none]";
      const parts = party.map(
        (m) => `${m.name || "(unnamed)"} \u2014 ${m.status}`,
      );
      return `[Party: ${parts.join(" | ")}]`;
    }

    function exportNpcs() {
      if (!npcs.length) return "[NPCs: none]";
      const parts = npcs.map(
        (n) =>
          `${n.name || "(unnamed)"} [${n.disp}]${n.note ? " \u2014 " + n.note : ""}`,
      );
      return `[NPCs: ${parts.join(" | ")}]`;
    }

    function exportRumours() {
      if (!rumours.length) return "[Rumours: none]";
      const parts = rumours.map(
        (r) => `${r.done ? "\u2713" : "\u25cb"} ${r.text || "(empty)"}`,
      );
      return `[Rumours: ${parts.join(" | ")}]`;
    }

    function exportDiceLast() {
      if (!activityLog.length) return "[Dice: no roll yet]";
      const diceEntry = activityLog.find((e) => e.msg.startsWith("[Roll"));
      return diceEntry ? diceEntry.msg : "[Dice: no roll yet]";
    }

    function exportAll() {
      return [
        exportQuests(),
        exportResources(),
        exportAbilities(),
        exportParty(),
        exportNpcs(),
        exportRumours(),
      ].join("\n");
    }

    function bindCopyBtn(id, exportFn) {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener("click", () => {
        const text = exportFn();
        document.dispatchEvent(
          new CustomEvent("sc-rp-inject", {
            detail: { text: "\n" + text, silent: true },
          }),
        );
        flashCopyBtnLabel(btn, btn.textContent);
      });
    }

    bindCopyBtn("sc-np-export-all", exportAll);
    bindCopyBtn("sc-np-quest-copy", exportQuests);
    bindCopyBtn("sc-np-res-copy", exportResources);
    bindCopyBtn("sc-np-abl-copy", exportAbilities);
    bindCopyBtn("sc-np-party-copy", exportParty);
    bindCopyBtn("sc-np-npc-copy", exportNpcs);
    bindCopyBtn("sc-np-rumour-copy", exportRumours);

    // Dice insert — inserts last roll into chat
    document.getElementById("sc-np-dice-copy").addEventListener("click", () => {
      const btn = document.getElementById("sc-np-dice-copy");
      const text = exportDiceLast();
      document.dispatchEvent(
        new CustomEvent("sc-rp-inject", {
          detail: { text: "\n" + text, silent: true },
        }),
      );
      flashCopyBtnLabel(btn, btn.textContent);
    });

    /* ── Boot ── */
    // Erase any legacy notes storage for this chat
    chrome.storage.local.remove(["sc_note_v1_" + chatId]);
    loadDiceMods();
    loadQuests();
    loadRes();
    loadAbl();
    loadParty();
    loadNpcs();
    loadRumours();
    setOpen(true);
  }
})();
