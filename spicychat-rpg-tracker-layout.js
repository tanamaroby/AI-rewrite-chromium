(function () {
  "use strict";

  function getDrawerStyles(defaultWidth) {
    return `
    /* ── Drawer panel ── */
    #sc-np {
      position: fixed;
      top: 0; right: 0;
      width: var(--sc-np-w, ${defaultWidth}px);
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
    html.sc-np-open #sc-np-tab { right: var(--sc-np-w, ${defaultWidth}px); }

    /* ── Resize handle (fixed, above everything) ── */
    #sc-np-resize {
      position: fixed;
      top: 0;
      right: var(--sc-np-w, ${defaultWidth}px);
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
    .ql-thought-row { display: flex; gap: 5px; align-items: center; margin-bottom: 2px; }
    .ql-thought-input {
      flex: 1; min-width: 0; background: rgba(0,0,0,0.14); border: 1px solid rgba(153,114,54,0.2); border-radius: 5px;
      color: #f4e4bf; font-size: 11px; font-family: Georgia, "Times New Roman", serif; font-style: italic;
      caret-color: #b87d2e; padding: 4px 7px; outline: none;
    }
    .ql-thought-input::placeholder { color: #8a7358; }
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

    /* ── Stat Tracker (gamified) ── */
    .stat-item {
      position: relative; display: flex; flex-direction: column; gap: 4px;
      padding: 7px 9px 6px; margin-bottom: 6px; border-radius: 7px;
      background: linear-gradient(160deg, rgba(217,164,65,0.09), rgba(20,16,10,0.32));
      border: 1px solid rgba(217,164,65,0.22);
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .stat-item:last-child { margin-bottom: 0; }
    .stat-item:hover { border-color: rgba(217,164,65,0.48); box-shadow: 0 3px 10px rgba(0,0,0,0.22); }
    .stat-item-top { display: flex; align-items: center; gap: 8px; width: 100%; }
    .stat-item .item-disp-name {
      flex: 1; min-width: 0; font-size: 10.5px; font-weight: 700; letter-spacing: 0.07em;
      text-transform: uppercase; color: #d9c39c; font-family: Georgia, "Times New Roman", serif;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .stat-value {
      text-align: right; font-size: 13px; font-weight: 800; color: #f3d8a3;
      font-variant-numeric: tabular-nums; flex-shrink: 0; word-break: break-all;
      padding: 2px 9px; border-radius: 999px;
      background: linear-gradient(180deg, rgba(217,164,65,0.26), rgba(217,164,65,0.09));
      border: 1px solid rgba(217,164,65,0.4);
    }
    .stat-val-input {
      width: 76px; flex-shrink: 0;
    }
    .stat-item .item-disp-note { color: #a08a63; }
    .stat-delete-btn {
      background: none; border: none; padding: 2px 3px; cursor: pointer; flex-shrink: 0;
      color: rgba(217,164,65,0.32); border-radius: 3px; transition: color 0.12s; display: flex; align-items: center;
    }
    .stat-delete-btn:hover { color: #f87171; }
    .stat-item .item-toggle-btn.edit { color: rgba(217,164,65,0.45); border-color: rgba(217,164,65,0.22); }
    .stat-item .item-toggle-btn.edit:hover { color: #f3d8a3; border-color: rgba(217,164,65,0.5); }
    /* bulk stat modification panel */
    .stat-adjust-panel {
      display: flex; flex-direction: column; gap: 6px;
      border-top: 1px solid rgba(217,164,65,0.18); padding-top: 8px; margin-top: 2px;
    }
    .stat-adjust-row { display: flex; align-items: center; gap: 6px; }
    .stat-select {
      flex: 1; min-width: 0; background: rgba(20,16,10,0.4);
      border: 1px solid rgba(217,164,65,0.28); border-radius: 5px;
      color: #f3d8a3; font-size: 11.5px; font-family: inherit;
      padding: 5px 7px; outline: none; transition: border-color 0.12s;
      appearance: none; -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23d9a445' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 7px center;
      padding-right: 22px; cursor: pointer;
    }
    .stat-select:focus { border-color: rgba(217,164,65,0.6); }
    .stat-select option { background: #241a0e; color: #f3d8a3; }
    .stat-amount-input {
      width: 84px; flex-shrink: 0; text-align: center;
      background: rgba(20,16,10,0.4); border: 1px solid rgba(217,164,65,0.28); border-radius: 5px;
      color: #f3d8a3; font-size: 12px; font-weight: 700; font-family: inherit;
      padding: 5px 4px; outline: none; transition: border-color 0.12s; caret-color: #d9a445;
    }
    .stat-amount-input::placeholder { color: rgba(217,164,65,0.4); }
    .stat-amount-input:focus { border-color: rgba(217,164,65,0.6); }
    .stat-reason-input {
      width: 100%; box-sizing: border-box; background: rgba(20,16,10,0.3);
      border: 1px solid rgba(217,164,65,0.18); border-radius: 5px;
      color: #c9b08a; font-size: 11px; font-family: inherit; font-style: italic;
      padding: 5px 7px; outline: none; transition: border-color 0.12s; caret-color: #d9a445;
    }
    .stat-reason-input::placeholder { color: rgba(217,164,65,0.3); }
    .stat-reason-input:focus { border-color: rgba(217,164,65,0.45); }
    .stat-op-btn {
      padding: 5px 11px; border-radius: 5px; font-size: 12px; font-weight: 700;
      font-family: inherit; cursor: pointer; border: 1px solid transparent;
      transition: background 0.12s, border-color 0.12s; flex-shrink: 0;
    }
    .stat-op-add { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.3); color: #22c55e; }
    .stat-op-add:hover { background: rgba(34,197,94,0.22); border-color: rgba(34,197,94,0.5); }
    .stat-op-sub { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.28); color: #f87171; }
    .stat-op-sub:hover { background: rgba(239,68,68,0.2); border-color: rgba(239,68,68,0.45); }
    .stat-op-set { background: rgba(217,164,65,0.14); border-color: rgba(217,164,65,0.4); color: #e8bd6c; }
    .stat-op-set:hover { background: rgba(217,164,65,0.24); border-color: rgba(217,164,65,0.6); }
    .stat-feedback { font-size: 10.5px; color: #e8bd6c; height: 14px; opacity: 0; transition: opacity 0.3s; }
    .stat-feedback.visible { opacity: 1; }

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
      width: calc(100vw - var(--sc-np-w, ${defaultWidth}px));
      max-width: calc(100vw - var(--sc-np-w, ${defaultWidth}px));
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

    /* ── Style injection panel ── */
    #sc-np-style-panel {
      position: absolute; inset: 0; overflow-y: auto;
      padding: 14px; box-sizing: border-box;
      display: none; flex-direction: column; gap: 10px;
    }
    #sc-np-style-panel.visible { display: flex; }
    #sc-np-style-panel::-webkit-scrollbar { width: 5px; }
    #sc-np-style-panel::-webkit-scrollbar-track { background: transparent; }
    #sc-np-style-panel::-webkit-scrollbar-thumb { background: rgba(108,99,255,0.3); border-radius: 3px; }

    /* ── Text styler panel ── */
    #sc-np-styler-panel {
      position: absolute; inset: 0; overflow-y: auto;
      padding: 14px; box-sizing: border-box;
      display: none; flex-direction: column; gap: 10px;
    }
    #sc-np-styler-panel.visible { display: flex; }
    #sc-np-styler-panel::-webkit-scrollbar { width: 5px; }
    #sc-np-styler-panel::-webkit-scrollbar-track { background: transparent; }
    #sc-np-styler-panel::-webkit-scrollbar-thumb { background: rgba(108,99,255,0.3); border-radius: 3px; }
    .style-feature-row {
      display: flex; flex-direction: column; gap: 6px;
      padding: 10px 0; border-bottom: 1px solid rgba(108,99,255,0.07);
    }
    .style-feature-row:last-child { border-bottom: none; }
    .style-feature-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .style-feature-name { font-size: 12.5px; font-weight: 600; color: #cbd5e1; }
    .style-feature-desc { font-size: 11px; color: #475569; line-height: 1.5; }
    .style-feature-note { font-size: 10px; color: #334155; font-style: italic; }
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
  }

  function getDrawerMarkup() {
    return `
      <div id="sc-np-header">
        <div id="sc-np-tabstrip">
          <button class="sc-np-tab-pill active" data-tab="quests">Quest Log</button>
          <button class="sc-np-tab-pill" data-tab="rp">RP Tools</button>
          <button class="sc-np-tab-pill" data-tab="fmt">Formatter</button>
          <button class="sc-np-tab-pill" data-tab="style">Style</button>
          <button class="sc-np-tab-pill" data-tab="styler">Styler</button>
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
          <!-- Quick Thought -->
          <div class="ql-section-header">
            <span class="ql-section-label">Thoughts</span>
          </div>
          <div class="ql-thought-row">
            <input id="sc-np-thought-input" type="text" class="ql-thought-input" placeholder="Jot a quick thought…" maxlength="240" data-ai-rewriter-ignore="1" />
            <button id="sc-np-thought-insert-btn" class="ql-copy-btn">⎘ Insert</button>
          </div>
          <!-- Quest Log -->
          <div class="ql-section-header" style="margin-top:4px;">
            <span class="ql-section-label">Quests</span>
            <button id="sc-np-quest-copy" class="ql-copy-btn">⎘ Insert</button>
          </div>
          <div id="sc-np-quest-list"></div>
          <!-- Character Stats -->
          <div class="ql-section-header ql-collapsible-hdr" data-section="sc-np-stats-body" style="margin-top:4px;">
            <span class="ql-section-label">Stats</span>
            <div style="display:flex;gap:5px;align-items:center;">
              <button id="sc-np-stats-copy" class="ql-copy-btn">⎘ Insert</button>
              <span class="ql-chevron"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
            </div>
          </div>
          <div id="sc-np-stats-body" class="ql-section-body">
            <div class="rp-card" style="padding:8px 10px;gap:6px;">
              <div id="sc-np-stats-list"></div>
              <div class="stat-adjust-panel" id="sc-np-stats-adjust">
                <div class="stat-adjust-row">
                  <select id="sc-np-stats-select" class="stat-select" data-ai-rewriter-ignore="1"><option value="">Select stat…</option></select>
                  <input id="sc-np-stats-amount" type="text" class="stat-amount-input" placeholder="Amount / value" data-ai-rewriter-ignore="1" />
                </div>
                <input id="sc-np-stats-reason" type="text" class="stat-reason-input" maxlength="80" placeholder="Reason (optional)… e.g. fell into a trap" data-ai-rewriter-ignore="1" />
                <div class="stat-adjust-row">
                  <button id="sc-np-stats-op-add" class="stat-op-btn stat-op-add">+ Add</button>
                  <button id="sc-np-stats-op-sub" class="stat-op-btn stat-op-sub">− Use</button>
                  <button id="sc-np-stats-op-set" class="stat-op-btn stat-op-set">= Set</button>
                  <span class="stat-feedback" id="sc-np-stats-fb"></span>
                </div>
              </div>
            </div>
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
        <div id="sc-np-style-panel"></div>
        <div id="sc-np-styler-panel"></div>
      </div>
    `;
  }

  window.SCRPGTrackerLayout = Object.assign({}, window.SCRPGTrackerLayout || {}, {
    getDrawerStyles,
    getDrawerMarkup,
  });
})();
