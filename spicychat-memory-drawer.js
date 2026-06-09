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

    /* ── Inventory panel (inside quests tab) ── */
    #sc-np-inv-list { display: flex; flex-direction: column; gap: 5px; }
    .inv-item {
      display: flex; align-items: center; gap: 7px;
      background: rgba(255,255,255,0.025); border: 1px solid rgba(108,99,255,0.13);
      border-radius: 6px; padding: 6px 10px;
      transition: border-color 0.12s;
    }
    .inv-item:focus-within { border-color: rgba(108,99,255,0.35); }
    .inv-qty-input {
      width: 38px; flex-shrink: 0; background: rgba(0,0,0,0.25);
      border: 1px solid rgba(108,99,255,0.2); border-radius: 4px;
      color: #a78bfa; font-size: 12px; font-weight: 700; font-family: inherit;
      text-align: center; padding: 2px 4px; outline: none;
      transition: border-color 0.12s; caret-color: #a78bfa;
    }
    .inv-qty-input:focus { border-color: rgba(108,99,255,0.5); }
    .inv-name-input {
      flex: 1; background: transparent; border: none; outline: none;
      color: #e2e8f0; font-size: 12.5px; font-family: inherit;
      caret-color: #a78bfa; min-width: 0;
    }
    .inv-name-input::placeholder { color: #334155; }
    .inv-notes-input {
      flex: 1; background: transparent; border: none; outline: none;
      color: #64748b; font-size: 11px; font-family: inherit;
      caret-color: #a78bfa; min-width: 0; max-width: 80px;
    }
    .inv-notes-input::placeholder { color: #2a3447; }
    .inv-delete-btn {
      background: none; border: none; padding: 2px 4px; cursor: pointer;
      color: #293548; border-radius: 3px; flex-shrink: 0;
      transition: color 0.12s; display: flex; align-items: center;
    }
    .inv-delete-btn:hover { color: #f87171; }
    #sc-np-inv-save {
      display: flex; align-items: center; gap: 6px;
      font-size: 10.5px; color: #22c55e;
      opacity: 0; transition: opacity 0.3s; height: 14px; margin-top: 2px;
    }
    #sc-np-inv-save.visible { opacity: 1; }

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
        <div id="sc-np-quests-panel">
          <!-- Quest Log -->
          <div class="ql-section-header">
            <span class="ql-section-label">Quests</span>
            <button id="sc-np-quest-add" class="ql-add-btn">+ Add Quest</button>
          </div>
          <div id="sc-np-quest-list"></div>
          <!-- Inventory -->
          <div class="ql-section-header" style="margin-top:4px;">
            <span class="ql-section-label">Inventory</span>
            <button id="sc-np-inv-add" class="ql-add-btn">+ Add Item</button>
          </div>
          <div class="rp-card" style="padding:8px 10px;gap:6px;">
            <div id="sc-np-inv-list"></div>
            <div id="sc-np-inv-save">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Saved
            </div>
          </div>
          <!-- Dice Roller -->
          <div class="ql-section-header" style="margin-top:4px;">
            <span class="ql-section-label">Dice Roller</span>
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
            <div id="sc-np-dice-result">
              <div class="dice-result-total" id="sc-np-dice-total">—</div>
              <div class="dice-result-breakdown" id="sc-np-dice-breakdown"></div>
              <div class="dice-result-nat" id="sc-np-dice-nat"></div>
            </div>
            <div class="dice-history" id="sc-np-dice-history"></div>
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
    const questAddBtn = document.getElementById("sc-np-quest-add");
    const invListEl = document.getElementById("sc-np-inv-list");
    const invAddBtn = document.getElementById("sc-np-inv-add");
    const invSaveEl = document.getElementById("sc-np-inv-save");
    const diceCountInput = document.getElementById("sc-np-dice-count");
    const diceLabelEl = document.getElementById("sc-np-dice-label");
    const diceRollBtn = document.getElementById("sc-np-dice-roll");
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
    const INV_KEY = "sc_inv_v1_" + chatId;

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
        empty.textContent = "No quests yet — tap + Add Quest to begin.";
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

        // Status circle button
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
          scheduleQuestSave();
          renderQuests();
        });

        // Title row
        const titleWrap = document.createElement("div");
        titleWrap.className = "ql-title-wrap";
        const titleInput = document.createElement("input");
        titleInput.type = "text";
        titleInput.className = "ql-title-input";
        titleInput.placeholder = "Quest name…";
        titleInput.value = q.title;
        titleInput.maxLength = 80;
        titleInput.setAttribute("data-ai-rewriter-ignore", "1");
        titleInput.addEventListener("input", () => {
          q.title = titleInput.value;
          scheduleQuestSave();
        });

        const notesInput = document.createElement("textarea");
        notesInput.className = "ql-notes-input";
        notesInput.placeholder = "Notes (optional)…";
        notesInput.value = q.notes;
        notesInput.rows = 1;
        notesInput.setAttribute("data-ai-rewriter-ignore", "1");
        notesInput.addEventListener("input", () => {
          q.notes = notesInput.value;
          autoResizeTextarea(notesInput);
          scheduleQuestSave();
        });
        setTimeout(() => autoResizeTextarea(notesInput), 0);
        titleWrap.append(titleInput, notesInput);

        const top = document.createElement("div");
        top.className = "ql-item-top";
        top.append(statusBtn, titleWrap);

        // Bottom row: state chips + delete
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
            scheduleQuestSave();
            renderQuests();
          });
          stateRow.appendChild(chip);
        });

        const delBtn = document.createElement("button");
        delBtn.className = "ql-delete-btn";
        delBtn.title = "Delete quest";
        delBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`;
        delBtn.addEventListener("click", () => {
          quests.splice(idx, 1);
          saveQuests();
          renderQuests();
        });

        const bottom = document.createElement("div");
        bottom.className = "ql-item-bottom";
        bottom.append(stateRow, delBtn);

        card.append(top, bottom);
        questListEl.appendChild(card);
      });
    }

    questAddBtn.addEventListener("click", () => {
      quests.unshift(newQuest());
      saveQuests();
      renderQuests();
      // Focus the new title input
      const first = questListEl.querySelector(".ql-title-input");
      if (first) first.focus();
    });

    function loadQuests() {
      chrome.storage.local.get(QUEST_KEY, (data) => {
        quests = Array.isArray(data[QUEST_KEY]) ? data[QUEST_KEY] : [];
        renderQuests();
      });
    }

    /* ════════════════ INVENTORY ════════════════ */
    let inventory = [];
    let invSaveTimer = null;

    function newInvItem() {
      return { id: Date.now() + Math.random(), qty: "1", name: "", notes: "" };
    }

    function saveInv() {
      chrome.storage.local.set({ [INV_KEY]: inventory });
      invSaveEl.classList.add("visible");
      clearTimeout(invSaveTimer);
      invSaveTimer = setTimeout(
        () => invSaveEl.classList.remove("visible"),
        1800,
      );
    }
    function scheduleInvSave() {
      clearTimeout(invSaveTimer);
      invSaveTimer = setTimeout(saveInv, 500);
    }

    function renderInv() {
      invListEl.innerHTML = "";
      if (!inventory.length) {
        const empty = document.createElement("div");
        empty.className = "ql-empty-state";
        empty.style.padding = "6px 0";
        empty.textContent = "Empty — tap + Add Item.";
        invListEl.appendChild(empty);
        return;
      }
      inventory.forEach((item, idx) => {
        const row = document.createElement("div");
        row.className = "inv-item";

        const qtyInput = document.createElement("input");
        qtyInput.type = "text";
        qtyInput.className = "inv-qty-input";
        qtyInput.value = item.qty;
        qtyInput.placeholder = "1";
        qtyInput.maxLength = 6;
        qtyInput.title = "Quantity";
        qtyInput.setAttribute("data-ai-rewriter-ignore", "1");
        qtyInput.addEventListener("input", () => {
          item.qty = qtyInput.value;
          scheduleInvSave();
        });

        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.className = "inv-name-input";
        nameInput.value = item.name;
        nameInput.placeholder = "Item name…";
        nameInput.maxLength = 60;
        nameInput.setAttribute("data-ai-rewriter-ignore", "1");
        nameInput.addEventListener("input", () => {
          item.name = nameInput.value;
          scheduleInvSave();
        });

        const notesInput = document.createElement("input");
        notesInput.type = "text";
        notesInput.className = "inv-notes-input";
        notesInput.value = item.notes;
        notesInput.placeholder = "note…";
        notesInput.maxLength = 40;
        notesInput.setAttribute("data-ai-rewriter-ignore", "1");
        notesInput.addEventListener("input", () => {
          item.notes = notesInput.value;
          scheduleInvSave();
        });

        const delBtn = document.createElement("button");
        delBtn.className = "inv-delete-btn";
        delBtn.title = "Remove item";
        delBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        delBtn.addEventListener("click", () => {
          inventory.splice(idx, 1);
          saveInv();
          renderInv();
        });

        row.append(qtyInput, nameInput, notesInput, delBtn);
        invListEl.appendChild(row);
      });
    }

    invAddBtn.addEventListener("click", () => {
      inventory.push(newInvItem());
      saveInv();
      renderInv();
      const inputs = invListEl.querySelectorAll(".inv-name-input");
      if (inputs.length) inputs[inputs.length - 1].focus();
    });

    function loadInv() {
      chrome.storage.local.get(INV_KEY, (data) => {
        inventory = Array.isArray(data[INV_KEY]) ? data[INV_KEY] : [];
        renderInv();
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

      const total = allRolls.reduce((a, b) => a + b, 0);

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

      // History chip
      const label = faceArr.map((f) => count + "d" + f).join("+");
      const chipClass = "dice-history-chip" + (natClass ? " " + natClass : "");
      diceHistory.unshift({ label, total, natClass });
      if (diceHistory.length > MAX_HIST) diceHistory.pop();
      diceHistoryEl.innerHTML = "";
      diceHistory.forEach((h) => {
        const chip = document.createElement("span");
        chip.className =
          "dice-history-chip" + (h.natClass ? " " + h.natClass : "");
        chip.textContent = h.label + ": " + h.total;
        diceHistoryEl.appendChild(chip);
      });
    });

    updateDiceLabel();

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

    /* ── Boot ── */
    // Erase any legacy notes storage for this chat
    chrome.storage.local.remove(["sc_note_v1_" + chatId]);
    loadQuests();
    loadInv();
    setOpen(true);
  }
})();
