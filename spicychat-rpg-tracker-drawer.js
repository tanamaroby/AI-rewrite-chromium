(function () {
  "use strict";

  /* PC only — skip on touch/mobile devices */
  if ("ontouchstart" in window || navigator.maxTouchPoints > 1) return;

  const DRAWER_GLOBAL_KEYS = Object.freeze({
    enabled: "spicychatNotesEnabled",
    width: "sc_note_width_v1",
  });

  function getDrawerChatId(pathname) {
    return pathname.replace(/^\/chat\//, "").replace(/\/$/, "") || "default";
  }

  function createDrawerStorageKeys(chatId) {
    return {
      legacyNote: "sc_note_v1_" + chatId,
      rewriteCtx: "sc_rpctx_v1_" + chatId,
      quests: "sc_quests_v1_" + chatId,
      resources: "sc_res_v1_" + chatId,
      abilities: "sc_abl_v1_" + chatId,
      party: "sc_party_v1_" + chatId,
      npcs: "sc_npc_v1_" + chatId,
      rumours: "sc_rumour_v1_" + chatId,
      diceMod: "sc_dice_mod_v1_" + chatId,
    };
  }

  let currentTeardown = null;

  function maybeInit() {
    if (currentTeardown) {
      currentTeardown();
      currentTeardown = null;
    }
    /* Only run on SpicyChat chat pages */
    if (!/^\/chat\//.test(location.pathname)) return;

    chrome.storage.sync.get(DRAWER_GLOBAL_KEYS.enabled, (syncData) => {
      if (syncData[DRAWER_GLOBAL_KEYS.enabled] === false) return;
      chrome.storage.local.get(DRAWER_GLOBAL_KEYS.width, (localData) => {
        currentTeardown = init(localData[DRAWER_GLOBAL_KEYS.width]);
      });
    });
  }

  /* SPA navigation detection — watch for URL changes without a full page reload */
  let _lastHref = location.href;
  new MutationObserver(() => {
    if (location.href !== _lastHref) {
      _lastHref = location.href;
      maybeInit();
    }
  }).observe(document, { subtree: true, childList: true });

  maybeInit();

  function init(savedWidth) {
    /* ── Abort controller — cleans up all document listeners on teardown ── */
    const _ac = new AbortController();
    const _sig = { signal: _ac.signal };

    /* ── Constants ── */
    const MIN_W = 260;
    const MAX_W = 780;
    const DEFAULT_W = 360;
    const WIDTH_KEY = DRAWER_GLOBAL_KEYS.width;

    /* Chat ID = last path segment, e.g. /chat/abc123 → "abc123" */
    const chatId = getDrawerChatId(location.pathname);
    const STORAGE_KEYS = createDrawerStorageKeys(chatId);

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
    .ql-sheet-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      flex-wrap: wrap;
    }
    .ql-sheet-status {
      min-height: 12px;
      font-size: 9.5px;
      letter-spacing: 0.02em;
      color: #475569;
      margin-left: auto;
    }
    .ql-sheet-status.ok { color: #22c55e; }
    .ql-sheet-status.err { color: #f87171; }

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
      background:
        radial-gradient(circle at 14% 0%, rgba(255, 230, 186, 0.06), transparent 22%),
        linear-gradient(180deg, rgba(67, 45, 21, 0.08), transparent 25%);
    }
    #sc-np-quests-panel.sc-np-hidden { display: none; }
    #sc-np-quests-panel::-webkit-scrollbar { width: 5px; }
    #sc-np-quests-panel::-webkit-scrollbar-track { background: transparent; }
    #sc-np-quests-panel::-webkit-scrollbar-thumb { background: rgba(180,140,72,0.28); border-radius: 3px; }

    /* Quest section headers */
    .ql-section-header { display: flex; align-items: center; justify-content: space-between; }
    .ql-section-label { font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #d9c39c; font-family: Georgia, "Times New Roman", serif; text-shadow: 0 1px 0 rgba(0,0,0,0.26); }
    .ql-add-btn {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 9px; border-radius: 7px; border: 1px solid rgba(186,144,72,0.34);
      background: linear-gradient(180deg, rgba(119,82,35,0.9), rgba(68,44,20,0.94)); color: #f2e1bc; font-size: 10px;
      font-weight: 700; font-family: Georgia, "Times New Roman", serif; cursor: pointer; letter-spacing: 0.06em;
      transition: background 0.12s, border-color 0.12s;
    }
    .ql-add-btn:hover { background: linear-gradient(180deg, rgba(141,99,42,0.94), rgba(84,54,24,0.98)); border-color: rgba(232,188,107,0.54); }
    .ql-form {
      background:
        linear-gradient(180deg, rgba(66, 45, 22, 0.34), rgba(36, 24, 14, 0.42)),
        radial-gradient(circle at top, rgba(255, 223, 168, 0.08), transparent 36%);
      border: 1px solid rgba(169, 125, 60, 0.28);
      border-radius: 10px;
      box-shadow: inset 0 1px 0 rgba(255, 239, 205, 0.06);
    }
    .ql-form .af-input,
    .ql-form .af-textarea {
      background: rgba(21, 14, 10, 0.72);
      border: 1px solid rgba(186, 142, 72, 0.28);
      color: #f4ead3;
      font-family: Georgia, "Times New Roman", serif;
      caret-color: #efc773;
    }
    .ql-form .af-input:focus,
    .ql-form .af-textarea:focus {
      border-color: rgba(233, 187, 106, 0.52);
      box-shadow: 0 0 0 2px rgba(233, 187, 106, 0.08);
    }
    .ql-form .af-input::placeholder,
    .ql-form .af-textarea::placeholder {
      color: #8e795d;
    }
    .ql-form .af-submit {
      background: linear-gradient(180deg, rgba(138, 97, 42, 0.96), rgba(83, 55, 26, 0.98));
      border: 1px solid rgba(195, 151, 74, 0.38);
      color: #f7e8c8;
      font-family: Georgia, "Times New Roman", serif;
      letter-spacing: 0.04em;
    }
    .ql-form .af-submit:hover {
      background: linear-gradient(180deg, rgba(161, 114, 49, 0.98), rgba(100, 66, 30, 1));
      border-color: rgba(233, 187, 106, 0.56);
    }

    /* Quest item card */
    .ql-item {
      background:
        radial-gradient(circle at top, rgba(255, 228, 182, 0.08), transparent 42%),
        linear-gradient(180deg, rgba(121, 90, 48, 0.16), rgba(63, 42, 21, 0.1)),
        linear-gradient(180deg, rgba(232, 207, 165, 0.96), rgba(206, 176, 135, 0.94));
      border: 1px solid rgba(153,114,54,0.34);
      border-radius: 10px; padding: 11px 13px;
      display: flex; flex-direction: column; gap: 6px;
      transition: border-color 0.15s, opacity 0.15s, box-shadow 0.15s;
      position: relative;
      box-shadow: inset 0 1px 0 rgba(255,245,220,0.5), 0 8px 18px rgba(24,14,6,0.12);
    }
    .ql-item::before {
      content: "";
      position: absolute;
      inset: 5px;
      border-radius: 7px;
      border: 1px solid rgba(151, 111, 55, 0.12);
      pointer-events: none;
    }
    .ql-item.ql-done { opacity: 0.62; border-color: rgba(69,148,78,0.28); }
    .ql-item.ql-failed { opacity: 0.55; border-color: rgba(176,77,59,0.28); }
    .ql-item-top { display: flex; align-items: flex-start; gap: 8px; }
    .ql-item .item-disp-name {
      color: #1a1209;
      font-family: Georgia, "Times New Roman", serif;
      font-weight: 700;
      text-shadow: none;
    }
    .ql-item .item-disp-note {
      color: #4a6fbe;
      font-family: Georgia, "Times New Roman", serif;
      font-style: normal;
      line-height: 1.45;
      opacity: 1;
      text-shadow: none;
    }
    .ql-item.ql-done .item-disp-name { color: #4d4335; }
    .ql-item.ql-failed .item-disp-name { color: #563d31; }
    .ql-item.ql-done .item-disp-note,
    .ql-item.ql-failed .item-disp-note {
      color: #5b687f;
    }
    .ql-status-btn {
      flex-shrink: 0; width: 18px; height: 18px; border-radius: 50%;
      border: 2px solid rgba(163,120,61,0.46); background: rgba(115,78,36,0.08);
      cursor: pointer; padding: 0; margin-top: 2px;
      transition: background 0.15s, border-color 0.15s;
      display: flex; align-items: center; justify-content: center;
    }
    .ql-status-btn:hover { border-color: rgba(186,144,72,0.72); background: rgba(173,123,61,0.14); }
    .ql-item.ql-done .ql-status-btn { background: rgba(34,197,94,0.14); border-color: #4ca866; }
    .ql-item.ql-failed .ql-status-btn { background: rgba(239,68,68,0.12); border-color: #cf6e5b; }
    .ql-status-icon { width: 8px; height: 8px; pointer-events: none; }
    .ql-title-wrap { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .ql-title-input {
      width: 100%; box-sizing: border-box; background: transparent;
      border: none; outline: none; color: #1a1209; font-size: 12.5px;
      font-weight: 700; font-family: Georgia, "Times New Roman", serif; caret-color: #b87d2e;
      padding: 0; line-height: 1.4;
      text-shadow: none;
    }
    .ql-item.ql-done .ql-title-input { text-decoration: line-through; color: #4d4335; }
    .ql-item.ql-failed .ql-title-input { text-decoration: line-through; color: #563d31; }
    .ql-title-input::placeholder { color: #5f4a31; }
    .ql-notes-input {
      width: 100%; box-sizing: border-box; background: transparent;
      border: none; outline: none; resize: none; color: #2b2013;
      font-size: 11.5px; font-family: Georgia, "Times New Roman", serif; line-height: 1.55;
      caret-color: #b87d2e; padding: 0; overflow: hidden; min-height: 0;
    }
    .ql-notes-input::placeholder { color: #655139; }
    .ql-update-row {
      display: flex; gap: 5px; align-items: center;
      border-top: 1px solid rgba(153,114,54,0.14); padding-top: 5px; margin-top: 2px;
    }
    .ql-update-input {
      flex: 1; min-width: 0; background: transparent; border: none; outline: none;
      color: #2f2417; font-size: 11px; font-family: Georgia, "Times New Roman", serif; font-style: italic;
      caret-color: #b87d2e;
    }
    .ql-update-input::placeholder { color: #6d573c; }
    .ql-update-btn {
      flex-shrink: 0; font-size: 9.5px; font-weight: 700; font-family: inherit;
      padding: 2px 7px; border-radius: 4px; cursor: pointer;
      background: linear-gradient(180deg, rgba(124,86,38,0.9), rgba(76,50,24,0.94)); border: 1px solid rgba(176,132,64,0.3); color: #f4e4bf;
      transition: background 0.12s, border-color 0.12s;
    }
    .ql-update-btn:hover { background: linear-gradient(180deg, rgba(145,101,44,0.94), rgba(90,59,28,0.98)); border-color: rgba(232,188,107,0.5); }
    .ql-updates-list {
      display: flex; flex-direction: column; gap: 2px;
      padding-top: 3px; margin-top: 2px;
      border-top: 1px solid rgba(153,114,54,0.14);
    }
    .ql-updates-list:empty { display: none; }
    .ql-update-entry {
      display: flex; align-items: flex-start; gap: 4px;
      font-size: 10.5px; font-style: italic; color: #2f2418;
      white-space: pre-wrap; word-break: break-word;
    }
    .ql-update-entry:first-child { color: #24190f; }
    .ql-update-entry-text { flex: 1; min-width: 0; }
    .ql-update-entry-del {
      flex-shrink: 0; background: none; border: none; cursor: pointer;
      color: #55402a; font-size: 9px; line-height: 1.4; padding: 0 2px;
      transition: color 0.1s;
    }
    .ql-update-entry-del:hover { color: #f87171; }
    .ql-item-bottom { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
    .ql-state-btns { display: flex; gap: 4px; }
    .ql-state-chip {
      font-size: 9.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
      padding: 2px 7px; border-radius: 100px; border: 1px solid transparent;
      cursor: pointer; font-family: inherit; background: transparent;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
    }
    .ql-state-chip.active-chip { pointer-events: none; }
    .ql-state-active  { color: #9f6a2f; border-color: rgba(164,121,59,0.35); }
    .ql-state-active.active-chip  { background: rgba(172,122,59,0.22); }
    .ql-state-active:not(.active-chip):hover  { background: rgba(172,122,59,0.08); }
    .ql-state-done    { color: #16803d; border-color: rgba(22,128,61,0.34); }
    .ql-state-done.active-chip    { background: rgba(34,197,94,0.2); }
    .ql-state-done:not(.active-chip):hover    { background: rgba(34,197,94,0.08); }
    .ql-state-failed  { color: #b44738; border-color: rgba(180,71,56,0.34); }
    .ql-state-failed.active-chip  { background: rgba(239,68,68,0.16); }
    .ql-state-failed:not(.active-chip):hover  { background: rgba(239,68,68,0.07); }
    .ql-delete-btn {
      background: none; border: none; padding: 3px 5px; cursor: pointer;
      color: #3f2d1c; border-radius: 4px; transition: color 0.12s, background 0.12s;
      display: flex; align-items: center;
    }
    .ql-delete-btn:hover { color: #f87171; background: rgba(239,68,68,0.08); }
    .ql-insert-btn {
      background: none; border: none; padding: 3px 5px; cursor: pointer;
      color: #4c3313; border-radius: 4px; font-size: 11px; font-family: Georgia, "Times New Roman", serif;
      transition: color 0.12s, background 0.12s;
    }
    .ql-insert-btn:hover { color: #8a541a; background: rgba(176,132,64,0.12); }
    .ql-empty-state { text-align: center; color: #483522; font-size: 12px; padding: 16px 0; font-family: Georgia, "Times New Roman", serif; }

    /* ── Dice roller (inside quests tab) ── */
    #sc-np-dice-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px;
      box-sizing: border-box;
      height: auto;
      min-height: max-content;
      flex: 0 0 auto;
      border: 1px solid rgba(165, 121, 55, 0.38);
      border-radius: 12px;
      background:
        radial-gradient(circle at 12% 14%, rgba(255, 219, 144, 0.22), transparent 24%),
        radial-gradient(circle at 88% 16%, rgba(255, 182, 88, 0.14), transparent 22%),
        radial-gradient(circle at 50% 0%, rgba(255, 229, 179, 0.08), transparent 30%),
        radial-gradient(circle at 50% 100%, rgba(94, 52, 20, 0.2), transparent 48%),
        linear-gradient(180deg, rgba(111, 79, 39, 0.22), rgba(46, 28, 14, 0.18)),
        linear-gradient(180deg, #3b2817 0%, #271a10 42%, #1c130d 100%);
      box-shadow:
        inset 0 1px 0 rgba(255, 235, 194, 0.1),
        inset 0 0 0 1px rgba(255, 220, 156, 0.04),
        0 12px 28px rgba(0, 0, 0, 0.3);
      position: relative;
      overflow: visible;
      isolation: isolate;
    }
    #sc-np-dice-section::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        radial-gradient(circle at 18% 12%, rgba(255, 239, 202, 0.1), transparent 18%),
        radial-gradient(circle at 84% 18%, rgba(255, 199, 118, 0.08), transparent 18%),
        radial-gradient(circle at 50% 12%, rgba(255, 215, 137, 0.07), transparent 20%),
        linear-gradient(180deg, rgba(255, 243, 213, 0.03), transparent 24%),
        repeating-linear-gradient(115deg, rgba(255, 244, 214, 0.018) 0 2px, transparent 2px 8px);
      mix-blend-mode: screen;
      opacity: 0.82;
    }
    #sc-np-dice-section::after {
      content: "";
      position: absolute;
      inset: 6px;
      pointer-events: none;
      border-radius: 9px;
      border: 1px solid rgba(241, 203, 136, 0.1);
      background:
        radial-gradient(circle at 0 0, rgba(243, 201, 124, 0.28) 0 10px, transparent 10px),
        radial-gradient(circle at 100% 0, rgba(243, 201, 124, 0.28) 0 10px, transparent 10px),
        radial-gradient(circle at 0 100%, rgba(243, 201, 124, 0.28) 0 10px, transparent 10px),
        radial-gradient(circle at 100% 100%, rgba(243, 201, 124, 0.28) 0 10px, transparent 10px),
        linear-gradient(90deg, transparent 14px, rgba(243, 201, 124, 0.18) 14px 15px, transparent 15px calc(100% - 15px), rgba(243, 201, 124, 0.18) calc(100% - 15px) calc(100% - 14px), transparent calc(100% - 14px)),
        linear-gradient(180deg, transparent 14px, rgba(243, 201, 124, 0.18) 14px 15px, transparent 15px calc(100% - 15px), rgba(243, 201, 124, 0.18) calc(100% - 15px) calc(100% - 14px), transparent calc(100% - 14px));
      box-shadow: inset 0 0 22px rgba(255, 209, 124, 0.03);
      opacity: 0.45;
    }
    .dice-faces-row {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 6px;
      position: relative;
      z-index: 1;
    }
    .dice-faces-row::before {
      content: "✦  Dice of Fate  ✦";
      grid-column: 1 / -1;
      text-align: center;
      color: rgba(239, 216, 173, 0.74);
      font: 700 10px/1.1 Georgia, "Times New Roman", serif;
      letter-spacing: 0.24em;
      text-transform: uppercase;
      margin-bottom: 2px;
      text-shadow: 0 1px 0 rgba(0, 0, 0, 0.34);
    }
    .dice-face-btn {
      min-width: 0;
      padding: 7px 4px;
      border-radius: 9px;
      border: 1px solid rgba(195, 150, 74, 0.42);
      background:
        linear-gradient(180deg, rgba(142, 106, 56, 0.22), rgba(76, 49, 23, 0.08)),
        linear-gradient(180deg, rgba(100, 66, 28, 0.94), rgba(57, 36, 18, 0.96));
      color: #e7d4af;
      font-size: 11px;
      font-weight: 700;
      font-family: Georgia, "Times New Roman", serif;
      letter-spacing: 0.06em;
      cursor: pointer;
      text-align: center;
      white-space: nowrap;
      text-transform: uppercase;
      box-shadow: inset 0 1px 0 rgba(255, 235, 188, 0.13), 0 3px 10px rgba(34, 20, 7, 0.18);
      transition: background 0.12s, border-color 0.12s, transform 0.07s, color 0.12s, box-shadow 0.12s;
    }
    .dice-face-btn:hover {
      background:
        linear-gradient(180deg, rgba(182, 132, 67, 0.24), rgba(99, 62, 27, 0.1)),
        linear-gradient(180deg, rgba(116, 76, 33, 0.96), rgba(67, 43, 20, 0.98));
      border-color: rgba(236, 194, 112, 0.62);
      color: #fff1d0;
      box-shadow: inset 0 1px 0 rgba(255, 239, 206, 0.18), 0 0 0 1px rgba(232, 188, 107, 0.1), 0 6px 14px rgba(54, 31, 10, 0.24);
    }
    .dice-face-btn:active { transform: scale(0.94); }
    .dice-face-btn.active {
      background:
        radial-gradient(circle at top, rgba(255, 214, 134, 0.28), transparent 52%),
        linear-gradient(180deg, rgba(195, 140, 53, 1), rgba(131, 83, 27, 1));
      border-color: rgba(255, 225, 163, 0.82);
      color: #fff8e4;
      box-shadow: inset 0 1px 0 rgba(255, 244, 218, 0.28), 0 6px 18px rgba(140, 86, 24, 0.34), 0 0 18px rgba(255, 184, 76, 0.08);
    }
    .dice-controls-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 9px;
      border-radius: 10px;
      border: 1px solid rgba(176, 132, 64, 0.26);
      background:
        linear-gradient(180deg, rgba(255, 230, 181, 0.05), transparent 35%),
        rgba(33, 21, 11, 0.44);
      box-shadow: inset 0 1px 0 rgba(255, 232, 190, 0.04);
      position: relative;
      z-index: 1;
    }
    .dice-count-input {
      width: 48px;
      text-align: center;
      background: rgba(17, 11, 6, 0.62);
      border: 1px solid rgba(181, 142, 73, 0.26);
      border-radius: 7px;
      color: #f1e3c4;
      font-size: 12.5px;
      font-weight: 700;
      font-family: Georgia, "Times New Roman", serif;
      padding: 6px 6px;
      outline: none;
      transition: border-color 0.12s, box-shadow 0.12s, background 0.12s;
    }
    .dice-count-input:focus {
      border-color: rgba(242, 197, 116, 0.56);
      box-shadow: 0 0 0 2px rgba(232, 188, 107, 0.09);
      background: rgba(27, 17, 9, 0.76);
    }
    .dice-count-label {
      font-size: 11px;
      color: #d0b88f;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-family: Georgia, "Times New Roman", serif;
      text-shadow: 0 1px 0 rgba(0, 0, 0, 0.3);
    }
    .dice-context-input {
      width: 100%;
      box-sizing: border-box;
      background:
        linear-gradient(180deg, rgba(255, 235, 196, 0.06), transparent 30%),
        rgba(33, 21, 11, 0.52);
      border: 1px solid rgba(181, 142, 73, 0.22);
      border-radius: 8px;
      color: #ebdebf;
      font-size: 11px;
      font-family: Georgia, "Times New Roman", serif;
      font-style: italic;
      padding: 7px 9px;
      outline: none;
      transition: border-color 0.12s, background 0.12s, color 0.12s;
      caret-color: #f5deb2;
      position: relative;
      z-index: 1;
    }
    .dice-context-input::placeholder { color: #8f7957; }
    .dice-context-input:focus {
      border-color: rgba(242, 197, 116, 0.5);
      background:
        linear-gradient(180deg, rgba(255, 235, 196, 0.08), transparent 32%),
        rgba(42, 26, 13, 0.68);
      color: #fff0d2;
      font-style: normal;
    }
    .dice-targets-wrap {
      margin-top: 2px;
      padding: 10px;
      border: 1px solid rgba(181, 138, 69, 0.28);
      border-radius: 10px;
      background:
        radial-gradient(circle at top, rgba(255, 219, 149, 0.08), transparent 48%),
        linear-gradient(180deg, rgba(83, 57, 26, 0.46), rgba(34, 22, 12, 0.4)),
        rgba(17, 11, 7, 0.34);
      display: flex;
      flex-direction: column;
      gap: 8px;
      position: relative;
      z-index: 1;
      box-shadow: inset 0 1px 0 rgba(255, 232, 192, 0.04);
    }
    .dice-targets-wrap::before {
      content: "❦";
      position: absolute;
      top: -8px;
      left: 50%;
      transform: translateX(-50%);
      font: 700 14px/1 Georgia, "Times New Roman", serif;
      color: rgba(240, 208, 145, 0.54);
      text-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
      pointer-events: none;
    }
    .dice-targets-head { display: flex; align-items: center; gap: 6px; }
    .dice-targets-title {
      font-size: 11px;
      color: #f0e0bd;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      flex: 1;
      font-family: Georgia, "Times New Roman", serif;
    }
    .dice-targets-btn {
      border: 1px solid rgba(196, 152, 76, 0.38);
      background: linear-gradient(180deg, rgba(116, 79, 34, 0.92), rgba(66, 43, 20, 0.94));
      color: #f0debc;
      border-radius: 7px;
      font-size: 10.5px;
      font-weight: 700;
      font-family: Georgia, "Times New Roman", serif;
      letter-spacing: 0.04em;
      padding: 4px 9px;
      cursor: pointer;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
    }
    .dice-targets-btn:hover {
      background: linear-gradient(180deg, rgba(113, 77, 30, 0.9), rgba(66, 43, 20, 0.92));
      border-color: rgba(232, 188, 107, 0.54);
      color: #fff0cf;
    }
    .dice-targets-btn.clear {
      background: linear-gradient(180deg, rgba(69, 52, 38, 0.88), rgba(38, 28, 22, 0.92));
      color: #cfbe9c;
      border-color: rgba(132, 109, 82, 0.34);
    }
    .dice-targets-btn.clear:hover {
      color: #ffd2c1;
      border-color: rgba(196, 114, 94, 0.5);
      background: linear-gradient(180deg, rgba(75, 44, 37, 0.92), rgba(47, 26, 22, 0.95));
    }
    .dice-targets-empty {
      font-size: 11px;
      color: #8f7b59;
      text-align: center;
      padding: 8px 6px;
      border: 1px dashed rgba(195, 151, 77, 0.26);
      border-radius: 7px;
      background: rgba(30, 19, 10, 0.22);
      font-style: italic;
    }
    .dice-targets-list { display: flex; flex-direction: column; gap: 7px; }
    .dice-target-row {
      border: 1px solid rgba(189, 146, 73, 0.26);
      border-radius: 9px;
      background:
        linear-gradient(180deg, rgba(255, 231, 186, 0.03), transparent 26%),
        linear-gradient(180deg, rgba(43, 28, 14, 0.76), rgba(24, 16, 10, 0.84));
      padding: 7px 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      box-shadow: inset 0 1px 0 rgba(255, 230, 177, 0.03);
    }
    .dice-target-top { display: flex; align-items: center; gap: 5px; }
    .dice-target-input {
      flex: 1;
      min-width: 0;
      background: rgba(9, 6, 4, 0.44);
      border: 1px solid rgba(181, 142, 73, 0.16);
      border-radius: 6px;
      color: #f3e6c8;
      font-size: 11.5px;
      font-family: Georgia, "Times New Roman", serif;
      padding: 5px 8px;
      outline: none;
      transition: border-color 0.12s, background 0.12s;
      caret-color: #f5deb2;
    }
    .dice-target-input:focus {
      border-color: rgba(242, 197, 116, 0.42);
      background: rgba(21, 13, 8, 0.72);
    }
    .dice-target-input::placeholder { color: #635640; }
    .dice-target-type {
      width: 54px;
      background: rgba(11, 7, 4, 0.56);
      border: 1px solid rgba(181, 142, 73, 0.16);
      border-radius: 6px;
      color: #fff0cd;
      font-size: 10.5px;
      font-weight: 700;
      font-family: Georgia, "Times New Roman", serif;
      letter-spacing: 0.06em;
      padding: 5px 18px 5px 7px;
      outline: none;
      appearance: none;
      -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23e7c98d' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 6px center;
      cursor: pointer;
    }
    .dice-target-type:focus { border-color: rgba(242, 197, 116, 0.42); }
    .dice-target-value {
      width: 58px;
      text-align: center;
      background: rgba(11, 7, 4, 0.56);
      border: 1px solid rgba(181, 142, 73, 0.16);
      border-radius: 6px;
      color: #fff6de;
      font-size: 11.5px;
      font-weight: 700;
      font-family: Georgia, "Times New Roman", serif;
      padding: 5px 4px;
      outline: none;
      caret-color: #f5deb2;
    }
    .dice-target-value:focus { border-color: rgba(242, 197, 116, 0.42); }
    .dice-target-icon-btn {
      border: 1px solid rgba(181, 142, 73, 0.12);
      background: rgba(53, 39, 24, 0.45);
      color: #cfbb95;
      width: 24px;
      height: 24px;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 0.12s, color 0.12s, border-color 0.12s;
      flex-shrink: 0;
      font-family: Georgia, "Times New Roman", serif;
    }
    .dice-target-icon-btn:hover {
      background: rgba(111, 75, 31, 0.36);
      border-color: rgba(232, 188, 107, 0.24);
      color: #f0dfbc;
    }
    .dice-target-icon-btn.delete:hover {
      background: rgba(111, 41, 31, 0.34);
      border-color: rgba(211, 111, 91, 0.24);
      color: #ffc9bb;
    }
    .dice-target-notes {
      width: 100%;
      box-sizing: border-box;
      background: transparent;
      border: none;
      border-top: 1px solid rgba(181, 142, 73, 0.1);
      color: #d1bd9b;
      font-size: 11px;
      font-family: Georgia, "Times New Roman", serif;
      font-style: italic;
      padding: 6px 2px 1px;
      outline: none;
      caret-color: #f5deb2;
    }
    .dice-target-notes::placeholder { color: #65563f; }
    .dice-target-outcomes {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      min-height: 0;
      position: relative;
      z-index: 1;
    }
    .dice-target-chip {
      font-size: 10.5px;
      font-weight: 700;
      border: 1px solid rgba(170, 136, 83, 0.24);
      border-radius: 999px;
      padding: 3px 9px;
      background: linear-gradient(180deg, rgba(53, 37, 22, 0.74), rgba(27, 19, 12, 0.82));
      color: #ebddbb;
      white-space: nowrap;
      font-family: Georgia, "Times New Roman", serif;
      letter-spacing: 0.03em;
    }
    .dice-target-chip.pass {
      color: #a7efb4;
      border-color: rgba(117, 198, 120, 0.34);
      background: linear-gradient(180deg, rgba(34, 80, 35, 0.42), rgba(18, 41, 21, 0.56));
    }
    .dice-target-chip.fail {
      color: #ffb0a1;
      border-color: rgba(208, 101, 81, 0.36);
      background: linear-gradient(180deg, rgba(93, 32, 27, 0.4), rgba(47, 16, 13, 0.54));
    }
    /* ── Dice Modifier List ── */
    .dmod-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 4px 0 6px;
      padding: 8px 10px 6px;
      border-radius: 10px 10px 6px 6px;
      border: 1px solid rgba(184, 143, 73, 0.18);
      background:
        radial-gradient(circle at 50% 0%, rgba(255, 225, 163, 0.08), transparent 34%),
        linear-gradient(180deg, rgba(63, 42, 21, 0.48), rgba(28, 19, 11, 0.48));
      position: relative;
      z-index: 1;
    }
    .dmod-header-label { font-size: 11px; color: #d8c29c; flex: 1; font-family: Georgia, "Times New Roman", serif; letter-spacing: 0.06em; text-transform: uppercase; }
    .dmod-include-label { display: flex; align-items: center; gap: 3px; font-size: 11px; color: #cbb791; cursor: pointer; user-select: none; }
    .dmod-include-label input { accent-color: #c88c35; cursor: pointer; margin: 0; }
    .dmod-total-pill {
      font-size: 11px; font-weight: 700; padding: 1px 8px; border-radius: 100px;
      background: linear-gradient(180deg, rgba(70, 49, 23, 0.74), rgba(36, 24, 14, 0.84)); border: 1px solid rgba(181, 142, 73, 0.22); color: #d0bc97;
    }
    .dmod-total-pill.positive { background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.3); color: #22c55e; }
    .dmod-total-pill.negative { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.28); color: #f87171; }
    .dmod-list { display: flex; flex-direction: column; gap: 5px; }
    .dmod-item {
      display: flex; flex-direction: column; gap: 3px;
      background:
        linear-gradient(180deg, rgba(255, 229, 180, 0.03), transparent 24%),
        linear-gradient(180deg, rgba(56, 39, 20, 0.7), rgba(28, 19, 11, 0.84));
      border: 1px solid rgba(183, 141, 72, 0.2);
      border-radius: 8px; padding: 7px 9px; transition: border-color 0.12s, box-shadow 0.12s;
      box-shadow: inset 0 1px 0 rgba(255, 233, 191, 0.03);
    }
    .dmod-item:focus-within { border-color: rgba(230, 192, 112, 0.34); box-shadow: inset 0 1px 0 rgba(255, 233, 191, 0.06), 0 0 0 1px rgba(230, 192, 112, 0.06); }
    .dmod-top { display: flex; align-items: center; gap: 6px; }
    .dmod-name-input {
      flex: 1; background: transparent; border: none; outline: none;
      color: #f0e4ca; font-size: 12px; font-family: Georgia, "Times New Roman", serif; caret-color: #f0c26b; min-width: 0;
    }
    .dmod-name-input::placeholder { color: #6d5a42; }
    .dmod-val-input {
      width: 46px; flex-shrink: 0; text-align: center; background: rgba(19,13,8,0.66);
      border: 1px solid rgba(188,145,74,0.26); border-radius: 6px;
      color: #ffdba0; font-size: 12px; font-weight: 700; font-family: Georgia, "Times New Roman", serif;
      padding: 4px 4px; outline: none; transition: border-color 0.12s, box-shadow 0.12s; caret-color: #f0c26b;
    }
    .dmod-val-input:focus { border-color: rgba(230,192,112,0.46); box-shadow: 0 0 0 2px rgba(230,192,112,0.08); }
    .dmod-delete-btn {
      background: none; border: none; padding: 2px 3px; cursor: pointer; flex-shrink: 0;
      color: #7e694d; border-radius: 3px; transition: color 0.12s; display: flex; align-items: center;
    }
    .dmod-delete-btn:hover { color: #f87171; }
    .dmod-notes-input {
      width: 100%; box-sizing: border-box; background: transparent;
      border: none; border-top: 1px solid rgba(181,142,73,0.1); outline: none;
      color: #c8b38d; font-size: 11px; font-family: Georgia, "Times New Roman", serif; font-style: italic;
      padding: 4px 0 1px; caret-color: #f0c26b;
    }
    .dmod-notes-input::placeholder { color: #6b5941; }
    .dmod-empty { font-size: 10.5px; color: #937b59; font-style: italic; padding: 4px 2px; font-family: Georgia, "Times New Roman", serif; }
    .dmod-form {
      background:
        radial-gradient(circle at top, rgba(255, 228, 178, 0.08), transparent 38%),
        linear-gradient(180deg, rgba(67, 47, 24, 0.58), rgba(29, 20, 12, 0.68));
      border: 1px solid rgba(183, 141, 72, 0.22);
      border-radius: 10px;
      box-shadow: inset 0 1px 0 rgba(255, 232, 190, 0.05);
    }
    .dmod-form .af-input,
    .dmod-form .af-number {
      background: rgba(24, 16, 10, 0.66);
      border: 1px solid rgba(188, 145, 74, 0.24);
      border-radius: 7px;
      color: #f1e3c4;
      font-family: Georgia, "Times New Roman", serif;
      caret-color: #f0c26b;
    }
    .dmod-form .af-input::placeholder,
    .dmod-form .af-number::placeholder {
      color: #78664b;
    }
    .dmod-form .af-input:focus,
    .dmod-form .af-number:focus {
      border-color: rgba(232, 188, 107, 0.46);
      box-shadow: 0 0 0 2px rgba(232, 188, 107, 0.08);
    }
    .dmod-form .af-submit {
      background: linear-gradient(180deg, rgba(136, 96, 41, 0.96), rgba(84, 55, 25, 0.98));
      border: 1px solid rgba(194, 151, 74, 0.36);
      color: #f8e8c6;
      border-radius: 8px;
      font-family: Georgia, "Times New Roman", serif;
      letter-spacing: 0.04em;
    }
    .dmod-form .af-submit:hover {
      background: linear-gradient(180deg, rgba(160, 113, 49, 0.98), rgba(101, 66, 30, 1));
      border-color: rgba(232, 188, 107, 0.52);
    }
    .dice-result-modifier {
      font-size: 11px;
      color: #d4bf99;
      text-align: center;
      line-height: 1.45;
      font-family: Georgia, "Times New Roman", serif;
      position: relative;
      z-index: 1;
    }
    .dice-roll-btn {
      flex: 1;
      padding: 8px 11px;
      border-radius: 10px;
      border: 1px solid rgba(245, 206, 126, 0.62);
      background:
        radial-gradient(circle at 50% 0%, rgba(255, 224, 156, 0.34), transparent 44%),
        linear-gradient(180deg, rgba(184, 129, 45, 1), rgba(121, 76, 24, 1));
      color: #fff3d6;
      font-size: 12px;
      font-weight: 700;
      font-family: Georgia, "Times New Roman", serif;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      cursor: pointer;
      transition: filter 0.12s, border-color 0.12s, transform 0.08s, box-shadow 0.12s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      box-shadow: inset 0 1px 0 rgba(255, 241, 211, 0.32), 0 8px 16px rgba(44, 24, 7, 0.28), 0 0 20px rgba(255, 191, 87, 0.08);
      position: relative;
      z-index: 1;
      overflow: hidden;
    }
    .dice-roll-btn::before {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(120deg, transparent 18%, rgba(255, 241, 211, 0.22) 34%, transparent 52%);
      transform: translateX(-130%);
      transition: transform 0.34s ease;
      pointer-events: none;
    }
    .dice-roll-btn:hover {
      filter: brightness(1.05);
      border-color: rgba(248, 214, 144, 0.68);
      box-shadow: inset 0 1px 0 rgba(255, 239, 203, 0.34), 0 10px 18px rgba(44, 24, 7, 0.32), 0 0 24px rgba(255, 194, 92, 0.12);
    }
    .dice-roll-btn:hover::before { transform: translateX(130%); }
    .dice-roll-btn:active { transform: scale(0.97); }
    .dice-roll-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    #sc-np-dice-result {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      min-height: 72px;
      padding: 10px 8px 7px;
      border-radius: 11px;
      border: 1px solid rgba(190, 146, 74, 0.26);
      background:
        radial-gradient(circle at 50% 10%, rgba(255, 227, 164, 0.14), transparent 42%),
        radial-gradient(circle at 50% 0%, rgba(255, 188, 92, 0.08), transparent 30%),
        linear-gradient(180deg, rgba(58, 37, 18, 0.76), rgba(24, 16, 10, 0.88));
      box-shadow: inset 0 1px 0 rgba(255, 231, 173, 0.08), inset 0 -10px 24px rgba(0, 0, 0, 0.08);
      position: relative;
      z-index: 1;
      overflow: hidden;
    }
    #sc-np-dice-result::before,
    #sc-np-dice-result::after {
      content: "✦";
      position: absolute;
      top: 8px;
      font: 700 14px/1 Georgia, "Times New Roman", serif;
      color: rgba(243, 203, 131, 0.46);
      text-shadow: 0 0 8px rgba(255, 189, 81, 0.18);
      pointer-events: none;
    }
    #sc-np-dice-result::before { left: 10px; }
    #sc-np-dice-result::after { right: 10px; }
    .dice-result-total.rolling {
      animation: dice-spin 0.72s cubic-bezier(0.2, 0.95, 0.25, 1);
      text-shadow: 0 0 24px rgba(255, 196, 86, 0.3), 0 0 42px rgba(255, 154, 61, 0.16), 0 2px 14px rgba(0, 0, 0, 0.42);
    }
    .dice-result-total {
      font-size: 42px;
      font-weight: 800;
      line-height: 1;
      color: #fff0cb;
      font-variant-numeric: tabular-nums;
      font-family: Georgia, "Times New Roman", serif;
      text-shadow: 0 2px 14px rgba(0, 0, 0, 0.38), 0 0 18px rgba(255, 204, 111, 0.08);
      transition: color 0.25s, text-shadow 0.25s;
    }
    .dice-result-total.nat20 { color: #93ef9f; text-shadow: 0 0 22px rgba(74,222,128,0.5), 0 0 34px rgba(74,222,128,0.18); }
    .dice-result-total.nat1  { color: #ffb09f; text-shadow: 0 0 22px rgba(248,113,113,0.4), 0 0 34px rgba(248,113,113,0.14); }
    .dice-result-total.nat20,
    .dice-result-nat.nat20 {
      animation: crit-blaze 0.8s ease-out;
    }
    .dice-result-total.nat1,
    .dice-result-nat.nat1 {
      animation: fumble-burn 0.8s ease-out;
    }
    @keyframes dice-spin {
      0%   { transform: scale(0.42) rotate(-30deg); opacity: 0; filter: blur(1.4px); }
      35%  { transform: scale(1.26) rotate(10deg); opacity: 1; filter: blur(0); }
      62%  { transform: scale(0.92) rotate(-4deg); opacity: 1; }
      82%  { transform: scale(1.06) rotate(2deg); opacity: 1; }
      100% { transform: scale(1) rotate(0deg); opacity: 1; filter: blur(0); }
    }
    @keyframes crit-blaze {
      0% { transform: scale(0.88); filter: brightness(1); }
      30% { transform: scale(1.16); filter: brightness(1.35); }
      62% { transform: scale(1.04); filter: brightness(1.18); }
      100% { transform: scale(1); filter: brightness(1); }
    }
    @keyframes fumble-burn {
      0% { transform: scale(0.92); filter: brightness(1); }
      25% { transform: scale(1.12); filter: brightness(1.2); }
      55% { transform: scale(0.98); filter: brightness(1.08); }
      100% { transform: scale(1); filter: brightness(1); }
    }
    .dice-result-breakdown {
      font-size: 11px;
      color: #dcc59f;
      text-align: center;
      font-family: Georgia, "Times New Roman", serif;
      line-height: 1.4;
    }
    .dice-result-nat {
      font-size: 11px;
      font-weight: 700;
      font-family: Georgia, "Times New Roman", serif;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      text-shadow: 0 1px 7px rgba(0, 0, 0, 0.22);
    }
    .dice-result-nat.nat20 { color: #93ef9f; }
    .dice-result-nat.nat1  { color: #ffb09f; }
    .dice-history {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      min-height: 22px;
      position: relative;
      z-index: 1;
    }
    .dice-history-chip {
      font-size: 10.5px;
      font-weight: 700;
      padding: 3px 9px;
      border-radius: 999px;
      background:
        linear-gradient(180deg, rgba(255, 224, 166, 0.06), transparent 30%),
        linear-gradient(180deg, rgba(79, 56, 25, 0.8), rgba(39, 27, 16, 0.88));
      border: 1px solid rgba(187, 146, 75, 0.26);
      color: #e8d7b0;
      font-family: Georgia, "Times New Roman", serif;
      letter-spacing: 0.03em;
    }
    .dice-history-chip.nat20 {
      background: linear-gradient(180deg, rgba(34, 89, 41, 0.54), rgba(19, 45, 23, 0.64));
      border-color: rgba(74,222,128,0.25);
      color: #9cefaa;
    }
    .dice-history-chip.nat1  {
      background: linear-gradient(180deg, rgba(100, 39, 32, 0.48), rgba(52, 20, 17, 0.62));
      border-color: rgba(248,113,113,0.2);
      color: #ffb4a7;
    }

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
    .abl-rest-panel {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 9px;
      padding: 10px 11px 11px;
      border: 1px solid rgba(214, 170, 88, 0.34);
      border-radius: 9px;
      background:
        radial-gradient(circle at top left, rgba(250, 220, 144, 0.14), transparent 42%),
        linear-gradient(180deg, rgba(68, 46, 18, 0.48), rgba(23, 16, 8, 0.72));
      box-shadow: inset 0 1px 0 rgba(255, 231, 173, 0.08), 0 8px 18px rgba(0, 0, 0, 0.18);
    }
    .abl-rest-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .abl-rest-copy {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .abl-rest-title {
      color: #f7deb0;
      font: 700 12px/1.1 Georgia, "Times New Roman", serif;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      text-shadow: 0 1px 0 rgba(0, 0, 0, 0.35);
    }
    .abl-rest-hint {
      color: #cbb389;
      font-size: 10.5px;
      line-height: 1.35;
    }
    .abl-rest-btn {
      flex-shrink: 0;
      padding: 7px 14px;
      border-radius: 999px;
      border: 1px solid rgba(230, 192, 112, 0.54);
      background: linear-gradient(180deg, rgba(144, 104, 33, 0.95), rgba(94, 59, 17, 0.95));
      color: #fff4d7;
      font: 700 11px/1 Georgia, "Times New Roman", serif;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      cursor: pointer;
      box-shadow: inset 0 1px 0 rgba(255, 243, 205, 0.25), 0 4px 10px rgba(30, 18, 6, 0.28);
      transition: transform 0.08s, filter 0.12s, box-shadow 0.12s;
    }
    .abl-rest-btn:hover {
      filter: brightness(1.07);
      box-shadow: inset 0 1px 0 rgba(255, 243, 205, 0.28), 0 6px 14px rgba(30, 18, 6, 0.34);
    }
    .abl-rest-btn:active { transform: translateY(1px) scale(0.99); }
    .abl-rest-btn:disabled {
      cursor: not-allowed;
      filter: saturate(0.55) brightness(0.88);
      box-shadow: inset 0 1px 0 rgba(255, 243, 205, 0.12);
    }
    .abl-rest-notes {
      width: 100%;
      box-sizing: border-box;
      resize: none;
      min-height: 0;
      padding: 7px 9px;
      border-radius: 7px;
      border: 1px solid rgba(214, 170, 88, 0.22);
      background: rgba(25, 16, 7, 0.46);
      color: #e9ddc4;
      font: 11.5px/1.45 Georgia, "Times New Roman", serif;
      outline: none;
      caret-color: #f7deb0;
      transition: border-color 0.12s, background 0.12s;
    }
    .abl-rest-notes:focus {
      border-color: rgba(230, 192, 112, 0.52);
      background: rgba(36, 23, 10, 0.58);
    }
    .abl-rest-notes::placeholder { color: #a88f67; }

    /* ── Party Tracker ── */
    .party-item {
      display: flex; align-items: flex-start; gap: 7px; flex-direction: column;
      background: rgba(255,255,255,0.025); border: 1px solid rgba(108,99,255,0.13);
      border-radius: 6px; padding: 6px 10px; transition: border-color 0.12s;
    }
    .party-item:focus-within { border-color: rgba(108,99,255,0.35); }
    .party-top { display: flex; align-items: center; gap: 7px; width: 100%; }
    .party-status-pill {
      flex-shrink: 0; padding: 2px 8px; border-radius: 100px; border: 1px solid transparent;
      font-size: 9.5px; font-weight: 700; font-family: inherit; min-width: 54px;
      text-align: center; transition: background 0.12s, border-color 0.12s, color 0.12s;
    }
    .party-status-healthy { background: rgba(34,197,94,0.12);  border-color: rgba(34,197,94,0.3);  color: #22c55e; }
    .party-status-downed { background: rgba(251,191,36,0.1);  border-color: rgba(251,191,36,0.3);  color: #fbbf24; }
    .party-status-dead   { background: rgba(239,68,68,0.1);   border-color: rgba(239,68,68,0.28);  color: #f87171; }
    .party-status-absent { background: rgba(100,116,139,0.1); border-color: rgba(100,116,139,0.25);color: #64748b; }
    .party-status-custom { background: rgba(56,189,248,0.12); border-color: rgba(56,189,248,0.25); color: #38bdf8; }
    .party-name-input {
      flex: 1; background: transparent; border: none; outline: none;
      color: #e2e8f0; font-size: 12.5px; font-weight: 600; font-family: inherit;
      caret-color: #a78bfa; min-width: 0;
    }
    .party-name-input::placeholder { color: #334155; }
    .party-status-input {
      flex: 0 0 104px;
      min-width: 88px;
      max-width: 128px;
      background: rgba(15, 23, 42, 0.45);
      border: 1px solid rgba(108,99,255,0.24);
      border-radius: 5px;
      color: #cbd5e1;
      font: 11px/1.3 inherit;
      padding: 4px 6px;
      outline: none;
    }
    .party-status-input:focus {
      border-color: rgba(108,99,255,0.45);
      background: rgba(20, 27, 44, 0.6);
    }
    .party-note-input {
      width: 100%; box-sizing: border-box; background: transparent;
      border: none; border-top: 1px solid rgba(108,99,255,0.07); outline: none;
      color: #64748b; font-size: 11px; font-family: inherit; font-style: italic;
      padding: 3px 0 1px; caret-color: #a78bfa;
    }
    .party-note-input::placeholder { color: #2a3447; }
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
    .rp-parse-notice {
      font-size: 11px; color: #a78bfa; margin-top: 6px;
      opacity: 0; transition: opacity 0.3s; min-height: 14px;
    }
    .rp-parse-notice.visible { opacity: 1; }
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
    style.id = "sc-np-style";
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
          <div class="ql-sheet-actions">
            <button id="sc-np-quest-sheet-export" class="ql-copy-btn">Export RPG Sheet</button>
            <button id="sc-np-quest-sheet-import" class="ql-copy-btn">Import RPG Sheet</button>
            <button id="sc-np-export-all" class="ql-copy-btn">⎘ Insert All</button>
            <span id="sc-np-quest-sheet-status" class="ql-sheet-status" aria-live="polite"></span>
          </div>
          <input id="sc-np-quest-sheet-file" type="file" accept="application/json,.json" style="display:none" data-ai-rewriter-ignore="1" />
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
            <div class="dice-targets-wrap">
              <div class="dice-targets-head">
                <span class="dice-targets-title">Target Checks (DC/AC)</span>
                <button id="sc-np-dice-target-add" class="dice-targets-btn">+ Add</button>
                <button id="sc-np-dice-target-clear" class="dice-targets-btn clear">Clear</button>
              </div>
              <div id="sc-np-dice-target-list" class="dice-targets-list"></div>
            </div>
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
              <div class="dice-target-outcomes" id="sc-np-dice-target-outcomes"></div>
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
            <div class="rp-card" style="padding:8px 10px;gap:5px;">
              <div class="abl-rest-panel">
                <div class="abl-rest-top">
                  <div class="abl-rest-copy">
                    <span class="abl-rest-title">Rest</span>
                    <span class="abl-rest-hint">Restore every tracked ability and log the recovery.</span>
                  </div>
                  <button id="sc-np-abl-rest-btn" class="abl-rest-btn">Take Rest</button>
                </div>
                <textarea id="sc-np-abl-rest-notes" class="abl-rest-notes" rows="1" data-ai-rewriter-ignore="1" placeholder="Rest notes… campfire watch, prayer, tavern night, dawn march…"></textarea>
              </div>
              <div id="sc-np-abl-list"></div>
            </div>
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
          <div class="rp-section-label">Rewrites</div>
          <div class="rp-card" style="padding-bottom:10px;">
            <div class="rp-hint" style="margin-bottom:8px;">Five saved rewrite presets. Tap a slot to make it active — Ctrl+N (or Run) applies the active preset to the focused chat input. Persona &amp; Scene Context are injected automatically.</div>
            <div id="sc-rp-rewrite-pills" style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px;"></div>
            <div id="sc-rp-rewrite-editor" style="display:none;">
              <div style="margin-bottom:6px;">
                <div class="rp-hint" style="margin-bottom:4px;">Preset name</div>
                <input type="text" id="sc-rp-rewrite-name" class="rp-input" placeholder="e.g. Polish prose" data-ai-rewriter-ignore="1" />
              </div>
              <div style="margin-bottom:8px;">
                <div class="rp-hint" style="margin-bottom:4px;">Instruction sent to the AI</div>
                <textarea id="sc-rp-rewrite-prompt" class="rp-input rp-textarea" style="min-height:72px;" placeholder="e.g. Rewrite for clarity and natural flow without changing the meaning or adding new events." data-ai-rewriter-ignore="1"></textarea>
              </div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <button id="sc-rp-rewrite-run" class="rp-action-btn">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Run active
                </button>
                <span id="sc-rp-rewrite-status" class="rp-hint"></span>
              </div>
            </div>
            <div class="rp-autosave" id="sc-rp-rewrite-autosave">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Saved
            </div>
          </div>
          <div class="rp-section-label">Scene Context</div>
          <div class="rp-card">
            <div class="rp-hint" style="margin-bottom:8px;">Saved per chat. Woven into every rewrite to keep details consistent.</div>
            <div style="margin-bottom:6px;">
              <div class="rp-hint" style="margin-bottom:4px;">Previous scene &mdash; paste recent messages for context</div>
              <textarea id="sc-rp-ctx-prevscene" class="rp-input rp-textarea" style="min-height:120px;" placeholder="Paste the previous scene or recent messages here so the rewrite has immediate context to continue from…" data-ai-rewriter-ignore="1"></textarea>
              <div class="rp-parse-notice" id="sc-rp-ctx-parse-notice"></div>
            </div>
            <div style="margin-bottom:6px;">
              <div class="rp-hint" style="margin-bottom:4px;">Character background &amp; long-term events</div>
              <textarea id="sc-rp-ctx-context" class="rp-input rp-textarea" style="min-height:56px;" placeholder="e.g. {{user}} is a retired thief who owes a debt to the guild; they betrayed their old partner months ago" data-ai-rewriter-ignore="1"></textarea>
            </div>
            <div style="margin-bottom:6px;">
              <div class="rp-hint" style="margin-bottom:4px;">Location</div>
              <input type="text" id="sc-rp-ctx-location" class="rp-input" placeholder="e.g. A rain-soaked alley in the old quarter" data-ai-rewriter-ignore="1" />
            </div>
            <div style="margin-bottom:6px;">
              <div class="rp-hint" style="margin-bottom:4px;">Clothes / appearance</div>
              <input type="text" id="sc-rp-ctx-clothes" class="rp-input" placeholder="e.g. A torn leather jacket, soaked through" data-ai-rewriter-ignore="1" />
            </div>
            <div style="margin-bottom:6px;">
              <div class="rp-hint" style="margin-bottom:4px;">Status / condition</div>
              <input type="text" id="sc-rp-ctx-status" class="rp-input" placeholder="e.g. Exhausted, nursing a bruised rib" data-ai-rewriter-ignore="1" />
            </div>
            <div>
              <div class="rp-hint" style="margin-bottom:4px;">Dialogue style</div>
              <textarea id="sc-rp-ctx-dialogue" class="rp-input rp-textarea" style="min-height:56px;" placeholder="e.g. Clipped, sardonic, rarely uses contractions" data-ai-rewriter-ignore="1"></textarea>
            </div>
            <div class="rp-autosave" id="sc-rp-ctx-autosave">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Saved
            </div>
          </div>
          <div class="rp-section-label">Persona</div>
          <div class="rp-card" style="padding-bottom:10px;">
            <div class="rp-hint" style="margin-bottom:8px;">Tap a slot to activate it — tap again to deactivate. The active persona's name &amp; personality are injected into every rewrite.</div>
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
              <div style="margin-bottom:6px;">
                <div class="rp-hint" style="margin-bottom:4px;">{{user}} description &mdash; who they are</div>
                <textarea id="sc-rp-persona-description" class="rp-input rp-textarea" placeholder="e.g. {{user}} is a weathered ex-detective in their forties, now working as a private investigator." data-ai-rewriter-ignore="1"></textarea>
              </div>
              <div>
                <div class="rp-hint" style="margin-bottom:4px;">{{user}} personality &mdash; how they think, speak and behave</div>
                <textarea id="sc-rp-persona-personality" class="rp-input rp-textarea" placeholder="e.g. {{user}} is dry-witted and guarded, speaks in short clipped sentences, and rarely shows fear." data-ai-rewriter-ignore="1"></textarea>
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
    const questSheetExportBtn = document.getElementById(
      "sc-np-quest-sheet-export",
    );
    const questSheetImportBtn = document.getElementById(
      "sc-np-quest-sheet-import",
    );
    const questSheetFileInput = document.getElementById(
      "sc-np-quest-sheet-file",
    );
    const questSheetStatusEl = document.getElementById(
      "sc-np-quest-sheet-status",
    );
    const diceCountInput = document.getElementById("sc-np-dice-count");
    const diceLabelEl = document.getElementById("sc-np-dice-label");
    const diceRollBtn = document.getElementById("sc-np-dice-roll");
    const diceContextInput = document.getElementById("sc-np-dice-context");
    const diceModDisplayEl = document.getElementById("sc-np-dice-mod-display");
    const diceTargetListEl = document.getElementById("sc-np-dice-target-list");
    const diceTargetAddBtn = document.getElementById("sc-np-dice-target-add");
    const diceTargetClearBtn = document.getElementById(
      "sc-np-dice-target-clear",
    );
    const dmodListEl = document.getElementById("sc-np-dmod-list");
    const dmodTotalEl = document.getElementById("sc-np-dmod-total");
    const DICE_MOD_KEY = STORAGE_KEYS.diceMod;
    let diceModifiers = [];
    let diceTargets = [];

    function newDiceTarget(copyFrom) {
      return {
        id: Date.now() + Math.random(),
        name:
          copyFrom && typeof copyFrom.name === "string" ? copyFrom.name : "",
        kind:
          copyFrom && copyFrom.kind === "AC"
            ? "AC"
            : copyFrom && copyFrom.kind === "DC"
              ? "DC"
              : "DC",
        value:
          copyFrom && isFinite(parseInt(copyFrom.value, 10))
            ? Math.max(1, Math.min(99, parseInt(copyFrom.value, 10)))
            : 10,
        notes:
          copyFrom && typeof copyFrom.notes === "string" ? copyFrom.notes : "",
      };
    }

    function renderDiceTargets() {
      diceTargetListEl.innerHTML = "";
      if (!diceTargets.length) {
        const empty = document.createElement("div");
        empty.className = "dice-targets-empty";
        empty.textContent =
          "No targets yet. Add DC/AC checks and every roll will auto-evaluate.";
        diceTargetListEl.appendChild(empty);
        return;
      }

      diceTargets.forEach((t, idx) => {
        const row = document.createElement("div");
        row.className = "dice-target-row";

        const top = document.createElement("div");
        top.className = "dice-target-top";

        const nameIn = document.createElement("input");
        nameIn.type = "text";
        nameIn.className = "dice-target-input";
        nameIn.placeholder = "Target name… e.g. Old lock, Bandit captain";
        nameIn.maxLength = 50;
        nameIn.value = t.name;
        nameIn.setAttribute("data-ai-rewriter-ignore", "1");
        nameIn.addEventListener("input", () => {
          t.name = nameIn.value;
        });

        const typeSel = document.createElement("select");
        typeSel.className = "dice-target-type";
        typeSel.setAttribute("data-ai-rewriter-ignore", "1");
        typeSel.innerHTML =
          "<option value='DC'>DC</option><option value='AC'>AC</option>";
        typeSel.value = t.kind === "AC" ? "AC" : "DC";
        typeSel.addEventListener("change", () => {
          t.kind = typeSel.value === "AC" ? "AC" : "DC";
        });

        const valueIn = document.createElement("input");
        valueIn.type = "number";
        valueIn.className = "dice-target-value";
        valueIn.min = "1";
        valueIn.max = "99";
        valueIn.value = String(t.value);
        valueIn.setAttribute("data-ai-rewriter-ignore", "1");
        valueIn.addEventListener("input", () => {
          const parsed = parseInt(valueIn.value, 10);
          t.value = isFinite(parsed) ? Math.max(1, Math.min(99, parsed)) : 1;
        });

        const dupBtn = document.createElement("button");
        dupBtn.className = "dice-target-icon-btn";
        dupBtn.title = "Duplicate";
        dupBtn.innerHTML = "⎘";
        dupBtn.addEventListener("click", () => {
          diceTargets.splice(idx + 1, 0, newDiceTarget(t));
          renderDiceTargets();
        });

        const delBtn = document.createElement("button");
        delBtn.className = "dice-target-icon-btn delete";
        delBtn.title = "Remove";
        delBtn.innerHTML = "×";
        delBtn.addEventListener("click", () => {
          diceTargets.splice(idx, 1);
          renderDiceTargets();
        });

        top.append(nameIn, typeSel, valueIn, dupBtn, delBtn);

        const notesIn = document.createElement("input");
        notesIn.type = "text";
        notesIn.className = "dice-target-notes";
        notesIn.placeholder = "Optional notes… e.g. heavy rain, partial cover";
        notesIn.maxLength = 80;
        notesIn.value = t.notes;
        notesIn.setAttribute("data-ai-rewriter-ignore", "1");
        notesIn.addEventListener("input", () => {
          t.notes = notesIn.value;
        });

        row.append(top, notesIn);
        diceTargetListEl.appendChild(row);
      });
    }

    function evaluateDiceTargets(total) {
      return diceTargets.map((t) => {
        const targetValue = Math.max(
          1,
          Math.min(99, parseInt(t.value, 10) || 1),
        );
        const passed = total >= targetValue;
        return {
          kind: t.kind === "AC" ? "AC" : "DC",
          value: targetValue,
          name: t.name.trim(),
          notes: t.notes.trim(),
          passed,
          reason: `${total}${passed ? " >= " : " < "}${targetValue}`,
        };
      });
    }

    function renderDiceTargetOutcomes(checks) {
      diceTargetOutcomesEl.innerHTML = "";
      checks.forEach((c) => {
        const chip = document.createElement("span");
        chip.className = "dice-target-chip " + (c.passed ? "pass" : "fail");
        const label = c.name || "Target";
        chip.textContent = `${label} ${c.kind}: ${c.value} ${c.passed ? "PASS" : "FAIL"}`;
        if (c.notes) {
          chip.title = `${c.kind}: ${c.value} — ${c.reason} — ${c.notes}`;
        } else {
          chip.title = `${c.kind}: ${c.value} — ${c.reason}`;
        }
        diceTargetOutcomesEl.appendChild(chip);
      });
    }

    function buildDiceTargetLogPart(checks) {
      if (!checks.length) return "";
      const segs = checks.map((c) => {
        const label = c.name || "Target";
        const parts = [
          `${label} ${c.kind}: ${c.value}`,
          c.passed ? "PASS" : "FAIL",
          c.reason,
        ];
        if (c.notes) parts.push(c.notes);
        return parts.join(" — ");
      });
      return ` — Targets: ${segs.join(" | ")}`;
    }

    diceTargetAddBtn.addEventListener("click", () => {
      diceTargets.push(newDiceTarget());
      renderDiceTargets();
      const lastInput = diceTargetListEl.querySelector(
        ".dice-target-row:last-child .dice-target-input",
      );
      if (lastInput) lastInput.focus();
    });

    diceTargetClearBtn.addEventListener("click", () => {
      if (!diceTargets.length) return;
      diceTargets = [];
      renderDiceTargets();
      renderDiceTargetOutcomes([]);
    });

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
      form.className = "af-form dmod-form";
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
    const diceTargetOutcomesEl = document.getElementById(
      "sc-np-dice-target-outcomes",
    );
    const diceHistoryEl = document.getElementById("sc-np-dice-history");
    const rpPanel = document.getElementById("sc-np-rp-panel");
    const fmtPanel = document.getElementById("sc-np-fmt-panel");
    const rpPersonaPillsEl = document.getElementById("sc-rp-persona-pills");
    const rpPersonaEditorEl = document.getElementById("sc-rp-persona-editor");
    const rpPersonaLabelInput = document.getElementById("sc-rp-persona-label");
    const rpPersonaNameInput = document.getElementById("sc-rp-persona-name");
    const rpPersonaDescriptionTa = document.getElementById(
      "sc-rp-persona-description",
    );
    const rpPersonaPersonalityTa = document.getElementById(
      "sc-rp-persona-personality",
    );
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
    const rewritePillsEl = document.getElementById("sc-rp-rewrite-pills");
    const rewriteEditorEl = document.getElementById("sc-rp-rewrite-editor");
    const rewriteNameInput = document.getElementById("sc-rp-rewrite-name");
    const rewritePromptTa = document.getElementById("sc-rp-rewrite-prompt");
    const rewriteRunBtn = document.getElementById("sc-rp-rewrite-run");
    const rewriteStatusEl = document.getElementById("sc-rp-rewrite-status");
    const rewriteAutosaveEl = document.getElementById("sc-rp-rewrite-autosave");
    const ctxContextTa = document.getElementById("sc-rp-ctx-context");
    const ctxPrevSceneTa = document.getElementById("sc-rp-ctx-prevscene");
    const ctxLocationInput = document.getElementById("sc-rp-ctx-location");
    const ctxClothesInput = document.getElementById("sc-rp-ctx-clothes");
    const ctxStatusInput = document.getElementById("sc-rp-ctx-status");
    const ctxDialogueTa = document.getElementById("sc-rp-ctx-dialogue");
    const ctxAutosaveEl = document.getElementById("sc-rp-ctx-autosave");
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
    const REWRITE_CTX_KEY = STORAGE_KEYS.rewriteCtx;
    const QUEST_KEY = STORAGE_KEYS.quests;

    /* ── CSS variable init ── */
    document.documentElement.style.setProperty("--sc-np-w", DRAWER_W + "px");

    /* ════════════════ QUEST LOG ════════════════ */
    const QUEST_STATES = ["active", "done", "failed"];
    const RES_KEY = STORAGE_KEYS.resources;
    const ABL_KEY = STORAGE_KEYS.abilities;
    const PARTY_KEY = STORAGE_KEYS.party;
    const NPC_KEY = STORAGE_KEYS.npcs;
    const RUMOUR_KEY = STORAGE_KEYS.rumours;
    const DEFAULT_PARTY_STATUS = "Healthy";
    const PARTY_STATUS_PRESETS = ["Healthy", "Downed", "Dead", "Absent"];
    const NPC_DISPS = ["friendly", "neutral", "hostile"];

    let quests = [];
    let resources = [];
    let abilities = [];
    let party = [];
    let npcs = [];
    let rumours = [];
    let questSaveTimer = null;
    let questSheetStatusTimer = null;

    let resourcesSection = null;
    let abilitiesSection = null;
    let partySection = null;
    let npcsSection = null;
    let rumoursSection = null;

    function newQuest() {
      return {
        id: Date.now() + Math.random(),
        title: "",
        notes: "",
        state: "active",
        updates: [],
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

    function setQuestSheetStatus(msg, kind) {
      if (!questSheetStatusEl) return;
      clearTimeout(questSheetStatusTimer);
      questSheetStatusEl.textContent = msg || "";
      questSheetStatusEl.classList.remove("ok", "err");
      if (kind === "ok") questSheetStatusEl.classList.add("ok");
      if (kind === "err") questSheetStatusEl.classList.add("err");
      if (!msg) return;
      questSheetStatusTimer = setTimeout(() => {
        questSheetStatusEl.textContent = "";
        questSheetStatusEl.classList.remove("ok", "err");
      }, 3200);
    }

    function saveRes() {
      if (resourcesSection) {
        resourcesSection.save();
        return;
      }
      chrome.storage.local.set({ [RES_KEY]: resources });
    }

    function renderRes() {
      if (resourcesSection) resourcesSection.render();
    }

    function loadRes() {
      if (resourcesSection) {
        resourcesSection.load();
        return;
      }
      chrome.storage.local.get(RES_KEY, (d) => {
        resources = Array.isArray(d[RES_KEY]) ? d[RES_KEY] : [];
      });
    }

    function saveAbl() {
      if (abilitiesSection) {
        abilitiesSection.save();
        return;
      }
      chrome.storage.local.set({ [ABL_KEY]: abilities });
    }

    function renderAbl() {
      if (abilitiesSection) abilitiesSection.render();
    }

    function loadAbl() {
      if (abilitiesSection) {
        abilitiesSection.load();
        return;
      }
      chrome.storage.local.get(ABL_KEY, (d) => {
        abilities = Array.isArray(d[ABL_KEY]) ? d[ABL_KEY] : [];
      });
    }

    function saveParty() {
      if (partySection) {
        partySection.save();
        return;
      }
      chrome.storage.local.set({ [PARTY_KEY]: party });
    }

    function renderParty() {
      if (partySection) partySection.render();
    }

    function loadParty() {
      if (partySection) {
        partySection.load();
        return;
      }
      chrome.storage.local.get(PARTY_KEY, (d) => {
        const incoming = Array.isArray(d[PARTY_KEY]) ? d[PARTY_KEY] : [];
        party = incoming
          .map((member, idx) => normalizeImportedPartyMember(member, idx))
          .filter(Boolean);
      });
    }

    function saveNpcs() {
      if (npcsSection) {
        npcsSection.save();
        return;
      }
      chrome.storage.local.set({ [NPC_KEY]: npcs });
    }

    function renderNpcs() {
      if (npcsSection) npcsSection.render();
    }

    function loadNpcs() {
      if (npcsSection) {
        npcsSection.load();
        return;
      }
      chrome.storage.local.get(NPC_KEY, (d) => {
        npcs = Array.isArray(d[NPC_KEY]) ? d[NPC_KEY] : [];
      });
    }

    function saveRumours() {
      if (rumoursSection) {
        rumoursSection.save();
        return;
      }
      chrome.storage.local.set({ [RUMOUR_KEY]: rumours });
    }

    function renderRumours() {
      if (rumoursSection) rumoursSection.render();
    }

    function loadRumours() {
      if (rumoursSection) {
        rumoursSection.load();
        return;
      }
      chrome.storage.local.get(RUMOUR_KEY, (d) => {
        rumours = Array.isArray(d[RUMOUR_KEY]) ? d[RUMOUR_KEY] : [];
      });
    }

    function normalizeId(rawId, idx) {
      return typeof rawId === "number" && isFinite(rawId)
        ? rawId
        : Date.now() + idx + Math.random();
    }

    function normalizeImportedQuest(raw, idx) {
      if (!raw || typeof raw !== "object") return null;
      const title = typeof raw.title === "string" ? raw.title : "";
      const notes = typeof raw.notes === "string" ? raw.notes : "";
      const state = QUEST_STATES.includes(raw.state) ? raw.state : "active";
      const updates = Array.isArray(raw.updates)
        ? raw.updates.filter((u) => typeof u === "string")
        : [];
      return {
        id:
          typeof raw.id === "number" && isFinite(raw.id)
            ? raw.id
            : Date.now() + idx + Math.random(),
        title,
        notes,
        state,
        updates,
      };
    }

    function normalizeImportedResource(raw, idx) {
      if (!raw || typeof raw !== "object") return null;
      const name = typeof raw.name === "string" ? raw.name : "";
      const notes = typeof raw.notes === "string" ? raw.notes : "";
      const parsedValue = parseInt(raw.value, 10);
      const value = isFinite(parsedValue) ? parsedValue : 0;
      return {
        id: normalizeId(raw.id, idx),
        name,
        notes,
        value,
      };
    }

    function normalizeImportedAbility(raw, idx) {
      if (!raw || typeof raw !== "object") return null;
      const name = typeof raw.name === "string" ? raw.name : "";
      const notes = typeof raw.notes === "string" ? raw.notes : "";
      const parsedMax = parseInt(raw.max, 10);
      const max = Math.max(1, isFinite(parsedMax) ? parsedMax : 1);
      const parsedCurrent = parseInt(raw.current, 10);
      const current = Math.max(
        0,
        Math.min(max, isFinite(parsedCurrent) ? parsedCurrent : max),
      );
      return {
        id: normalizeId(raw.id, idx),
        name,
        notes,
        current,
        max,
      };
    }

    function normalizePartyStatus(status) {
      const trimmed = String(status || "").trim();
      if (!trimmed) return "Healthy";
      if (trimmed.toLowerCase() === "active") return "Healthy";
      return trimmed.slice(0, 40);
    }

    function partyStatusToneClass(status) {
      const normalized = normalizePartyStatus(status).toLowerCase();
      if (normalized === "healthy") return "healthy";
      if (normalized === "downed") return "downed";
      if (normalized === "dead") return "dead";
      if (normalized === "absent") return "absent";
      return "custom";
    }

    function normalizeImportedPartyMember(raw, idx) {
      if (!raw || typeof raw !== "object") return null;
      const name = typeof raw.name === "string" ? raw.name : "";
      const notes = typeof raw.notes === "string" ? raw.notes : "";
      const status = normalizePartyStatus(raw.status);
      return {
        id: normalizeId(raw.id, idx),
        name,
        notes,
        status,
      };
    }

    function normalizeImportedNpc(raw, idx) {
      if (!raw || typeof raw !== "object") return null;
      const name = typeof raw.name === "string" ? raw.name : "";
      const note = typeof raw.note === "string" ? raw.note : "";
      const disp = NPC_DISPS.includes(raw.disp) ? raw.disp : "neutral";
      return {
        id: normalizeId(raw.id, idx),
        name,
        note,
        disp,
      };
    }

    function normalizeImportedRumour(raw, idx) {
      if (!raw || typeof raw !== "object") return null;
      const text = typeof raw.text === "string" ? raw.text : "";
      return {
        id: normalizeId(raw.id, idx),
        text,
        done: raw.done === true,
      };
    }

    function normalizeImportedDiceModifier(raw, idx) {
      if (!raw || typeof raw !== "object") return null;
      const name = typeof raw.name === "string" ? raw.name : "";
      const notes = typeof raw.notes === "string" ? raw.notes : "";
      const parsedValue = parseInt(raw.value, 10);
      const value = isFinite(parsedValue) ? parsedValue : 0;
      return {
        id: normalizeId(raw.id, idx),
        name,
        notes,
        value,
        enabled: raw.enabled !== false,
      };
    }

    function normalizeImportedArray(source, key, normalizer, label) {
      if (!Array.isArray(source[key])) return [];
      const normalized = source[key].map((item, idx) => normalizer(item, idx));
      if (normalized.some((item) => !item)) {
        throw new Error(`RPG sheet has invalid ${label} entries.`);
      }
      return normalized;
    }

    function parseQuestSheetJson(text) {
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("Invalid JSON file.");
      }

      // Legacy quest-only sheet support.
      if (
        Array.isArray(parsed) ||
        (parsed &&
          typeof parsed === "object" &&
          Array.isArray(parsed.quests) &&
          !Array.isArray(parsed.resources))
      ) {
        const legacyQuests = Array.isArray(parsed) ? parsed : parsed.quests;
        const questsOnly = legacyQuests
          .map((q, idx) => normalizeImportedQuest(q, idx))
          .filter(Boolean);
        if (questsOnly.length !== legacyQuests.length) {
          throw new Error("Quest sheet has invalid quest entries.");
        }
        return { legacyQuestOnly: true, quests: questsOnly };
      }

      if (!parsed || typeof parsed !== "object") {
        throw new Error("RPG sheet must be a JSON object.");
      }

      return {
        legacyQuestOnly: false,
        quests: normalizeImportedArray(
          parsed,
          "quests",
          normalizeImportedQuest,
          "quest",
        ),
        resources: normalizeImportedArray(
          parsed,
          "resources",
          normalizeImportedResource,
          "resource",
        ),
        abilities: normalizeImportedArray(
          parsed,
          "abilities",
          normalizeImportedAbility,
          "ability",
        ),
        party: normalizeImportedArray(
          parsed,
          "party",
          normalizeImportedPartyMember,
          "party",
        ),
        npcs: normalizeImportedArray(
          parsed,
          "npcs",
          normalizeImportedNpc,
          "npc",
        ),
        rumours: normalizeImportedArray(
          parsed,
          "rumours",
          normalizeImportedRumour,
          "rumour",
        ),
        diceModifiers: normalizeImportedArray(
          parsed,
          "diceModifiers",
          normalizeImportedDiceModifier,
          "dice modifier",
        ),
      };
    }

    function getCleanQuests() {
      return quests.map((q, idx) =>
        normalizeImportedQuest(
          {
            id: q.id,
            title: q.title,
            notes: q.notes,
            state: q.state,
            updates: q.updates,
          },
          idx,
        ),
      );
    }

    function getCleanResources() {
      return resources.map((r, idx) =>
        normalizeImportedResource(
          {
            id: r.id,
            name: r.name,
            notes: r.notes,
            value: r.value,
          },
          idx,
        ),
      );
    }

    function getCleanAbilities() {
      return abilities.map((a, idx) =>
        normalizeImportedAbility(
          {
            id: a.id,
            name: a.name,
            notes: a.notes,
            current: a.current,
            max: a.max,
          },
          idx,
        ),
      );
    }

    function getCleanParty() {
      return party.map((m, idx) =>
        normalizeImportedPartyMember(
          {
            id: m.id,
            name: m.name,
            notes: m.notes,
            status: m.status,
          },
          idx,
        ),
      );
    }

    function getCleanNpcs() {
      return npcs.map((n, idx) =>
        normalizeImportedNpc(
          {
            id: n.id,
            name: n.name,
            note: n.note,
            disp: n.disp,
          },
          idx,
        ),
      );
    }

    function getCleanRumours() {
      return rumours.map((r, idx) =>
        normalizeImportedRumour(
          {
            id: r.id,
            text: r.text,
            done: r.done,
          },
          idx,
        ),
      );
    }

    function getCleanDiceModifiers() {
      return diceModifiers.map((m, idx) =>
        normalizeImportedDiceModifier(
          {
            id: m.id,
            name: m.name,
            notes: m.notes,
            value: m.value,
            enabled: m.enabled,
          },
          idx,
        ),
      );
    }

    function getQuestSheetPayload() {
      const cleanedQuests = getCleanQuests();
      const cleanedResources = getCleanResources();
      const cleanedAbilities = getCleanAbilities();
      const cleanedParty = getCleanParty();
      const cleanedNpcs = getCleanNpcs();
      const cleanedRumours = getCleanRumours();
      const cleanedDiceMods = getCleanDiceModifiers();
      return {
        type: "sc-rpg-sheet",
        version: 2,
        exportedAt: new Date().toISOString(),
        sourceChatId: chatId,
        sectionCounts: {
          quests: cleanedQuests.length,
          resources: cleanedResources.length,
          abilities: cleanedAbilities.length,
          party: cleanedParty.length,
          npcs: cleanedNpcs.length,
          rumours: cleanedRumours.length,
          diceModifiers: cleanedDiceMods.length,
        },
        quests: cleanedQuests,
        resources: cleanedResources,
        abilities: cleanedAbilities,
        party: cleanedParty,
        npcs: cleanedNpcs,
        rumours: cleanedRumours,
        diceModifiers: cleanedDiceMods,
      };
    }

    function buildQuestSheetFileName() {
      const date = new Date().toISOString().slice(0, 10);
      const safeChatId = String(chatId || "chat")
        .replace(/[^a-z0-9_-]+/gi, "-")
        .slice(0, 40);
      return `rpg-sheet-${safeChatId || "chat"}-${date}.json`;
    }

    function exportQuestSheetFile() {
      const payload = getQuestSheetPayload();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildQuestSheetFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setQuestSheetStatus("Exported full RPG sheet.", "ok");
    }

    async function importQuestSheetFile(file) {
      if (!file) return;
      const text = await file.text();
      const imported = parseQuestSheetJson(text);
      if (imported.legacyQuestOnly) {
        quests = imported.quests;
        saveQuests();
        renderQuests();
        addLog(`[Quest sheet imported: ${imported.quests.length} quest(s)]`);
        setQuestSheetStatus(
          `Imported legacy quest sheet (${imported.quests.length} quests).`,
          "ok",
        );
        return;
      }
      quests = imported.quests;
      resources = imported.resources;
      abilities = imported.abilities;
      party = imported.party;
      npcs = imported.npcs;
      rumours = imported.rumours;
      diceModifiers = imported.diceModifiers;

      saveQuests();
      saveRes();
      saveAbl();
      saveParty();
      saveNpcs();
      saveRumours();
      saveDiceMods();

      renderQuests();
      renderRes();
      renderAbl();
      renderParty();
      renderNpcs();
      renderRumours();
      renderDiceMods();

      addLog(
        `[RPG sheet imported: ${quests.length} quests, ${resources.length} resources, ${abilities.length} abilities, ${party.length} party, ${npcs.length} NPCs, ${rumours.length} rumours, ${diceModifiers.length} modifiers]`,
      );
      setQuestSheetStatus("Imported full RPG sheet.", "ok");
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
          nameSpan.style.color = q.state === "failed" ? "#563d31" : "#4d4335";
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
            nameSpan.style.color = active
              ? "#1a1209"
              : q.state === "failed"
                ? "#563d31"
                : "#4d4335";
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

        const insertQuestBtn = document.createElement("button");
        insertQuestBtn.className = "ql-insert-btn";
        insertQuestBtn.title = "Insert this quest into chat";
        insertQuestBtn.textContent = "⎘";
        insertQuestBtn.addEventListener("click", () => {
          const st =
            q.state === "done" ? "✓" : q.state === "failed" ? "✗" : "○";
          const upd = q.updates && q.updates.length ? ` > ${q.updates[0]}` : "";
          const text = `[Quest: ${st} ${q.title || "(untitled)"}${q.notes ? " \u2014 " + q.notes : ""}${upd}]`;
          document.dispatchEvent(
            new CustomEvent("sc-rp-inject", {
              detail: { text: "\n" + text, silent: true },
            }),
          );
          flashCopyBtnLabel(insertQuestBtn, "⎘");
        });

        const bottom = document.createElement("div");
        bottom.className = "ql-item-bottom";
        bottom.append(stateRow, toggleBtn, insertQuestBtn, delBtn);
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
          q.updates.unshift(txt);
          scheduleQuestSave();
          addLog(`[Quest "${q.title || "(untitled)"}": ${txt}]`);
          updateIn.value = "";
          renderUpdatesList();
        });
        updateIn.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            updateBtn.click();
          }
        });
        updateRow.append(updateIn, updateBtn);
        card.appendChild(updateRow);

        const updatesContainer = document.createElement("div");
        updatesContainer.className = "ql-updates-list";
        function renderUpdatesList() {
          updatesContainer.innerHTML = "";
          (q.updates || []).forEach((txt, i) => {
            const entry = document.createElement("div");
            entry.className = "ql-update-entry";
            const textSpan = document.createElement("span");
            textSpan.className = "ql-update-entry-text";
            textSpan.textContent = txt;
            const delBtn = document.createElement("button");
            delBtn.className = "ql-update-entry-del";
            delBtn.title = "Remove this entry";
            delBtn.textContent = "\u2715";
            delBtn.addEventListener("click", () => {
              q.updates.splice(i, 1);
              scheduleQuestSave();
              renderUpdatesList();
            });
            entry.append(textSpan, delBtn);
            updatesContainer.appendChild(entry);
          });
        }
        renderUpdatesList();
        card.appendChild(updatesContainer);

        questListEl.appendChild(card);
      });
    }

    // Quest add form (inserted before list)
    (function () {
      const form = document.createElement("div");
      form.className = "af-form ql-form";
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
        // migrate old single-update format
        quests.forEach((q) => {
          if (!Array.isArray(q.updates)) {
            q.updates = q.update ? [q.update] : [];
            delete q.update;
          }
        });
        renderQuests();
      });
    }

    if (questSheetExportBtn) {
      questSheetExportBtn.addEventListener("click", () => {
        exportQuestSheetFile();
        flashCopyBtnLabel(questSheetExportBtn, questSheetExportBtn.textContent);
      });
    }
    if (questSheetImportBtn && questSheetFileInput) {
      questSheetImportBtn.addEventListener("click", () => {
        questSheetFileInput.value = "";
        questSheetFileInput.click();
      });
      questSheetFileInput.addEventListener("change", async () => {
        const file = questSheetFileInput.files && questSheetFileInput.files[0];
        if (!file) return;
        try {
          await importQuestSheetFile(file);
          flashCopyBtnLabel(
            questSheetImportBtn,
            questSheetImportBtn.textContent,
          );
        } catch (err) {
          const msg =
            err && typeof err.message === "string"
              ? err.message
              : "Import failed.";
          setQuestSheetStatus(msg, "err");
        }
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
      const targetChecks = evaluateDiceTargets(total);

      // Breakdown text
      let breakdown = "";
      if (allRolls.length > 1) {
        if (faceArr.length === 1) {
          breakdown = "Multiple roll values: " + perDie[faceArr[0]].join(" — ");
        } else {
          breakdown = faceArr
            .map((f) => "d" + f + ": " + perDie[f].join(" — "))
            .join("  ");
          breakdown = "Multiple roll values: " + breakdown;
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
          .filter((mx) => mx.value !== 0 && mx.enabled !== false)
          .map((mx) =>
            `${mx.value > 0 ? "+" : ""}${mx.value} ${mx.name || "?"}`.trim(),
          )
          .join(", ");
        diceModDisplayEl.textContent = `${sign}${mod} mod${rawTotal !== total ? " (" + rawTotal + " raw)" : ""}${parts ? " \u2014 " + parts : ""}`;
      } else {
        diceModDisplayEl.textContent = "";
      }
      renderDiceTargetOutcomes(targetChecks);

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
          .filter((mx) => mx.value !== 0 && mx.enabled !== false)
          .map(
            (mx) => `${mx.value > 0 ? "+" : ""}${mx.value} ${mx.name || "?"}`,
          )
          .join(", ");
        modPart = ` (${modSign}${mod}${modItems ? ": " + modItems : ""})`;
      }
      const targetPart = buildDiceTargetLogPart(targetChecks);
      const logLine = ctx
        ? natMsg
          ? `[${ctx} \u2014 Roll ${chipLabel}: ${total}${modPart}${targetPart} \u2014 ${natMsg}]`
          : breakdown
            ? `[${ctx} \u2014 Roll ${chipLabel}: ${total}${modPart}${targetPart} \u2014 ${breakdown}]`
            : `[${ctx} \u2014 Roll ${chipLabel}: ${total}${modPart}${targetPart}]`
        : natMsg
          ? `[Roll ${chipLabel}: ${total}${modPart}${targetPart} \u2014 ${natMsg}]`
          : breakdown
            ? `[Roll ${chipLabel}: ${total}${modPart}${targetPart} \u2014 ${breakdown}]`
            : `[Roll ${chipLabel}: ${total}${modPart}${targetPart}]`;
      addLog(logLine);
    });

    renderDiceTargets();
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

    /* ════════════════ MODULAR TRACKER SECTIONS ════════════════ */
    const sectionFactory = window.SCRPGTrackerSections || {};
    if (
      typeof sectionFactory.createResourcesSection !== "function" ||
      typeof sectionFactory.createAbilitiesSection !== "function" ||
      typeof sectionFactory.createPartySection !== "function" ||
      typeof sectionFactory.createNpcsSection !== "function" ||
      typeof sectionFactory.createRumoursSection !== "function"
    ) {
      throw new Error("RPG tracker section modules failed to load.");
    }

    resourcesSection = sectionFactory.createResourcesSection({
      storageKey: RES_KEY,
      addLog,
      getResources: () => resources,
      setResources: (next) => {
        resources = Array.isArray(next) ? next : [];
      },
    });

    abilitiesSection = sectionFactory.createAbilitiesSection({
      storageKey: ABL_KEY,
      addLog,
      autoResizeTextarea,
      getAbilities: () => abilities,
      setAbilities: (next) => {
        abilities = Array.isArray(next) ? next : [];
      },
    });

    partySection = sectionFactory.createPartySection({
      storageKey: PARTY_KEY,
      addLog,
      getParty: () => party,
      setParty: (next) => {
        party = Array.isArray(next) ? next : [];
      },
      normalizePartyStatus,
      partyStatusToneClass,
      normalizeImportedPartyMember,
      defaultStatus: DEFAULT_PARTY_STATUS,
      statusPresets: PARTY_STATUS_PRESETS,
    });

    npcsSection = sectionFactory.createNpcsSection({
      storageKey: NPC_KEY,
      addLog,
      getNpcs: () => npcs,
      setNpcs: (next) => {
        npcs = Array.isArray(next) ? next : [];
      },
    });

    rumoursSection = sectionFactory.createRumoursSection({
      storageKey: RUMOUR_KEY,
      addLog,
      autoResizeTextarea,
      getRumours: () => rumours,
      setRumours: (next) => {
        rumours = Array.isArray(next) ? next : [];
      },
    });
    /* ── Open / close ── */
    function setOpen(val) {
      isOpen = val;
      drawer.classList.toggle("sc-np-open", val);
      document.documentElement.classList.toggle("sc-np-open", val);
    }

    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape" && isOpen) setOpen(false);
      },
      _sig,
    );

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
    let drawerPersonas = Array.from({ length: 10 }, () => ({
      label: "",
      name: "",
      description: "",
      personality: "",
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
        rpPersonaDescriptionTa.value = p.description || "";
        rpPersonaPersonalityTa.value = p.personality || "";
      }
    }

    function savePersona() {
      if (drawerActiveIdx >= 0) {
        drawerPersonas[drawerActiveIdx] = {
          label: rpPersonaLabelInput.value,
          name: rpPersonaNameInput.value,
          description: rpPersonaDescriptionTa.value,
          personality: rpPersonaPersonalityTa.value,
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
    rpPersonaDescriptionTa.addEventListener("input", schedulePersonaSave);
    rpPersonaPersonalityTa.addEventListener("input", schedulePersonaSave);

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
          drawerPersonas = data.rpPersonas.slice(0, 10).map((p) => ({
            label: p.label || "",
            name: p.name || "",
            description: p.description || p.prepend || "",
            personality: p.personality || "",
          }));
          while (drawerPersonas.length < 10)
            drawerPersonas.push({
              label: "",
              name: "",
              description: "",
              personality: "",
            });
          drawerActiveIdx =
            typeof data.rpActivePersonaIndex === "number"
              ? data.rpActivePersonaIndex
              : -1;
        } else if (data.rpPersonaName || data.rpPersonaPrepend) {
          // Migrate old single-persona storage
          drawerPersonas[0] = {
            label: data.rpPersonaName || "Persona 1",
            name: data.rpPersonaName || "",
            description: data.rpPersonaPrepend || "",
            personality: "",
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

    document.addEventListener(
      "sc-rp-rewrite-done",
      (e) => {
        showRewriteState(e.detail);
        showLogState(e.detail);
      },
      _sig,
    );
    document.addEventListener(
      "sc-rp-undo-done",
      () => clearRewriteState(),
      _sig,
    );

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

    /* ── Scene Context (per chat) ── */
    let ctxSaveTimer = null;
    let ctxAutosaveTimer = null;

    function saveSceneContext() {
      chrome.storage.local.set({
        [REWRITE_CTX_KEY]: {
          prevScene: ctxPrevSceneTa.value,
          context: ctxContextTa.value,
          location: ctxLocationInput.value,
          clothes: ctxClothesInput.value,
          status: ctxStatusInput.value,
          dialogueStyle: ctxDialogueTa.value,
        },
      });
      ctxAutosaveEl.classList.add("visible");
      clearTimeout(ctxAutosaveTimer);
      ctxAutosaveTimer = setTimeout(
        () => ctxAutosaveEl.classList.remove("visible"),
        1800,
      );
    }

    function scheduleSceneContextSave() {
      clearTimeout(ctxSaveTimer);
      ctxSaveTimer = setTimeout(saveSceneContext, 500);
    }

    [
      ctxPrevSceneTa,
      ctxContextTa,
      ctxLocationInput,
      ctxClothesInput,
      ctxStatusInput,
      ctxDialogueTa,
    ].forEach((el) => el.addEventListener("input", scheduleSceneContextSave));

    /* ── Auto-parse a [ status | location | time | clothes ] line from pasted scene ── */
    const ctxParseNotice = document.getElementById("sc-rp-ctx-parse-notice");
    let ctxParseNoticeTimer = null;

    function parseSceneBracket(text) {
      // Find a bracketed status line containing pipe separators.
      const m = text.match(/\[([^\[\]]*\|[^\[\]]*)\]/);
      if (!m) return null;
      const parts = m[1].split("|").map((s) => s.trim());
      if (parts.length < 2) return null;
      // parts[2] is time — intentionally ignored.
      return {
        status: parts[0] || "",
        location: parts[1] || "",
        clothes: parts.length >= 4 ? parts[3] : "",
      };
    }

    function showCtxParseNotice(fields, sourceLabel) {
      ctxParseNotice.textContent =
        "\u2728 Auto-filled " +
        fields.join(", ") +
        " from " +
        (sourceLabel || "pasted scene");
      ctxParseNotice.classList.add("visible");
      clearTimeout(ctxParseNoticeTimer);
      ctxParseNoticeTimer = setTimeout(
        () => ctxParseNotice.classList.remove("visible"),
        3200,
      );
    }

    function applySceneHeaderParse(sceneText, sourceLabel) {
      const parsed = parseSceneBracket(sceneText);
      if (!parsed) return;
      const changed = [];
      if (parsed.status) {
        ctxStatusInput.value = parsed.status;
        changed.push("status");
      }
      if (parsed.location) {
        ctxLocationInput.value = parsed.location;
        changed.push("location");
      }
      if (parsed.clothes) {
        ctxClothesInput.value = parsed.clothes;
        changed.push("clothes");
      }
      if (!changed.length) return;
      saveSceneContext();
      showCtxParseNotice(changed, sourceLabel);
    }

    ctxPrevSceneTa.addEventListener("paste", () => {
      // Let the pasted text land in the textarea value first.
      setTimeout(() => {
        applySceneHeaderParse(ctxPrevSceneTa.value, "pasted scene");
      }, 0);
    });

    document.addEventListener(
      "sc-rp-set-prev-scene",
      (e) => {
        const txt = String(e?.detail?.text || "").trim();
        if (!txt) return;
        ctxPrevSceneTa.value = txt;
        saveSceneContext();
        applySceneHeaderParse(txt, "chat message");
      },
      _sig,
    );

    chrome.storage.local.get(REWRITE_CTX_KEY, (data) => {
      const c = data[REWRITE_CTX_KEY] || {};
      ctxPrevSceneTa.value = c.prevScene || "";
      ctxContextTa.value = c.context || "";
      ctxLocationInput.value = c.location || "";
      ctxClothesInput.value = c.clothes || "";
      ctxStatusInput.value = c.status || "";
      ctxDialogueTa.value = c.dialogueStyle || "";
    });

    /* ── Input counter ── */
    document.addEventListener(
      "sc-rp-input-stats",
      (e) => {
        const { chars, words } = e.detail;
        rpIcStats.textContent = `${chars.toLocaleString()} chars \u00b7 ${words.toLocaleString()} words`;
        rpIcStats.classList.add("active");
      },
      _sig,
    );

    document.addEventListener(
      "sc-rp-input-blur",
      () => {
        rpIcStats.textContent = "No input focused";
        rpIcStats.classList.remove("active");
      },
      _sig,
    );

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

    /* ── Rewrites (presets) ── */
    let drawerRewrites = Array.from({ length: 5 }, () => ({
      name: "",
      prompt: "",
    }));
    let rewriteActiveIdx = -1;
    let rewriteSaveTimer = null;
    let rewriteAutosaveTimer = null;

    function buildRewritePills() {
      rewritePillsEl.innerHTML = "";
      drawerRewrites.forEach((r, idx) => {
        const btn = document.createElement("button");
        btn.className =
          "sc-persona-pill" + (idx === rewriteActiveIdx ? " active" : "");
        btn.dataset.idx = idx;
        const label = (r.name || "").trim() || String(idx + 1);
        btn.textContent =
          label.length > 9 ? label.slice(0, 8) + "\u2026" : label;
        btn.addEventListener("click", () => {
          clearTimeout(rewriteSaveTimer);
          if (rewriteActiveIdx >= 0) {
            drawerRewrites[rewriteActiveIdx] = {
              name: rewriteNameInput.value,
              prompt: rewritePromptTa.value,
            };
          }
          rewriteActiveIdx = rewriteActiveIdx === idx ? -1 : idx;
          buildRewritePills();
          showRewriteEditor();
          chrome.storage.sync.set({
            rpRewrites: drawerRewrites,
            rpActiveRewriteIndex: rewriteActiveIdx,
          });
        });
        rewritePillsEl.appendChild(btn);
      });
    }

    function showRewriteEditor() {
      if (rewriteActiveIdx < 0) {
        rewriteEditorEl.style.display = "none";
      } else {
        rewriteEditorEl.style.display = "";
        const r = drawerRewrites[rewriteActiveIdx];
        rewriteNameInput.value = r.name || "";
        rewritePromptTa.value = r.prompt || "";
        rewriteStatusEl.textContent = "";
        rewriteStatusEl.className = "rp-hint";
      }
    }

    function saveRewrites() {
      if (rewriteActiveIdx >= 0) {
        drawerRewrites[rewriteActiveIdx] = {
          name: rewriteNameInput.value,
          prompt: rewritePromptTa.value,
        };
        buildRewritePills();
      }
      chrome.storage.sync.set({
        rpRewrites: drawerRewrites,
        rpActiveRewriteIndex: rewriteActiveIdx,
      });
      rewriteAutosaveEl.classList.add("visible");
      clearTimeout(rewriteAutosaveTimer);
      rewriteAutosaveTimer = setTimeout(
        () => rewriteAutosaveEl.classList.remove("visible"),
        1800,
      );
    }

    function scheduleRewriteSave() {
      clearTimeout(rewriteSaveTimer);
      rewriteSaveTimer = setTimeout(saveRewrites, 600);
    }

    rewriteNameInput.addEventListener("input", scheduleRewriteSave);
    rewritePromptTa.addEventListener("input", scheduleRewriteSave);

    rewriteRunBtn.addEventListener("click", () => {
      if (rewriteActiveIdx < 0) {
        rewriteStatusEl.textContent = "Select a preset slot first.";
        rewriteStatusEl.className = "rp-hint rp-status-err";
        return;
      }
      if (!rewritePromptTa.value.trim()) {
        rewriteStatusEl.textContent = "Enter an instruction first.";
        rewriteStatusEl.className = "rp-hint rp-status-err";
        return;
      }
      clearTimeout(rewriteSaveTimer);
      saveRewrites();
      rewriteRunBtn.disabled = true;
      rewriteStatusEl.textContent = "Running\u2026";
      rewriteStatusEl.className = "rp-hint";
      document.dispatchEvent(
        new CustomEvent("sc-rp-run-rewrite", {
          detail: { index: rewriteActiveIdx },
        }),
      );
    });

    document.addEventListener(
      "sc-rp-rewrite-result",
      (e) => {
        rewriteRunBtn.disabled = false;
        if (e.detail.error) {
          rewriteStatusEl.textContent = e.detail.error;
          rewriteStatusEl.className = "rp-hint rp-status-err";
        } else {
          rewriteStatusEl.textContent = `\u2713 Done \u00b7 ${e.detail.model} \u00b7 ${e.detail.elapsed}s`;
          rewriteStatusEl.className = "rp-hint rp-status-ok";
        }
      },
      _sig,
    );

    chrome.storage.sync.get(["rpRewrites", "rpActiveRewriteIndex"], (data) => {
      if (Array.isArray(data.rpRewrites) && data.rpRewrites.length > 0) {
        drawerRewrites = data.rpRewrites.slice(0, 5).map((r) => ({
          name: r.name || "",
          prompt: r.prompt || "",
        }));
        while (drawerRewrites.length < 5)
          drawerRewrites.push({ name: "", prompt: "" });
      }
      rewriteActiveIdx =
        typeof data.rpActiveRewriteIndex === "number"
          ? data.rpActiveRewriteIndex
          : -1;
      buildRewritePills();
      showRewriteEditor();
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

    document.addEventListener(
      "mousemove",
      (e) => {
        if (!resizing) return;
        const delta = resizeStartX - e.clientX;
        const newW = Math.min(MAX_W, Math.max(MIN_W, resizeStartW + delta));
        DRAWER_W = newW;
        document.documentElement.style.setProperty("--sc-np-w", newW + "px");
      },
      _sig,
    );

    document.addEventListener(
      "mouseup",
      () => {
        if (!resizing) return;
        resizing = false;
        resizeHandle.classList.remove("sc-np-resizing");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        chrome.storage.local.set({ [WIDTH_KEY]: DRAWER_W });
      },
      _sig,
    );

    /* ── Formatter reference panel ── */
    const FMT_KEYS_TO_WATCH = [
      "formatterEnabled",
      "fmtShortcut",
      "fmtNoTrackerShortcut",
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
      const shortcut = "Ctrl+" + (d.fmtShortcut || "m").toUpperCase();
      const noTrackerShortcut =
        "Ctrl+Shift+" + (d.fmtNoTrackerShortcut || "m").toUpperCase();
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
          <span>shortcut</span><span class="fmt-meta-chip">${escH(shortcut)}</span>
          <span style="margin-left:4px;">no-tracker shortcut</span><span class="fmt-meta-chip">${escH(noTrackerShortcut)}</span>
          <span style="margin-left:4px;">auto after rewrite</span>
          <span class="fmt-master-badge ${autoFmt ? "on" : "off"}" style="font-size:9.5px;">${autoFmt ? "ON" : "OFF"}</span>
        </div>
        <div style="font-size:10px;color:#334155;font-style:italic;margin-top:2px;">
          ${escH(shortcut)} formats and prepends a tracker summary; ${escH(noTrackerShortcut)} formats without it.
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
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync" && FMT_KEYS_TO_WATCH.some((k) => k in changes)) {
        if (activeTab === "fmt") loadFormatterPanel();
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
        const upd = q.updates && q.updates.length ? ` > ${q.updates[0]}` : "";
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
      const parts = party.map((m) => {
        const note = m.notes ? ` (${m.notes})` : "";
        return `${m.name || "(unnamed)"} \u2014 ${m.status}${note}`;
      });
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
      const diceEntry = activityLog.find(
        (e) => e.msg.startsWith("[Roll ") || e.msg.includes(" — Roll "),
      );
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

    function bindExportButtons() {
      bindCopyBtn("sc-np-export-all", exportAll);
      bindCopyBtn("sc-np-quest-copy", exportQuests);
      bindCopyBtn("sc-np-res-copy", exportResources);
      bindCopyBtn("sc-np-abl-copy", exportAbilities);
      bindCopyBtn("sc-np-party-copy", exportParty);
      bindCopyBtn("sc-np-npc-copy", exportNpcs);
      bindCopyBtn("sc-np-rumour-copy", exportRumours);
    }

    function bindDiceExportButton() {
      const btn = document.getElementById("sc-np-dice-copy");
      if (!btn) return;
      btn.addEventListener("click", () => {
        const text = exportDiceLast();
        document.dispatchEvent(
          new CustomEvent("sc-rp-inject", {
            detail: { text: "\n" + text, silent: true },
          }),
        );
        flashCopyBtnLabel(btn, btn.textContent);
      });
    }

    function loadAllTrackerSections() {
      loadDiceMods();
      loadQuests();
      loadRes();
      loadAbl();
      loadParty();
      loadNpcs();
      loadRumours();
    }

    function bootDrawerState() {
      // Erase any legacy notes storage for this chat
      chrome.storage.local.remove([STORAGE_KEYS.legacyNote]);
      bindExportButtons();
      bindDiceExportButton();
      loadAllTrackerSections();
      setOpen(true);
    }

    bootDrawerState();

    return function teardown() {
      _ac.abort();
      document.getElementById("sc-np")?.remove();
      document.getElementById("sc-np-tab")?.remove();
      document.getElementById("sc-np-resize")?.remove();
      document.getElementById("sc-np-style")?.remove();
      document.documentElement.classList.remove("sc-np-open");
    };
  }
})();
