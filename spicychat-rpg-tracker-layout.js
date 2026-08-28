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
      background: var(--sc-drawer-bg);
      border-left: 1px solid rgba(var(--sc-accent-rgb), 0.28);
      box-shadow: -6px 0 32px rgba(var(--sc-black-rgb), 0.55);
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
      background: var(--sc-drawer-bg-2);
      color: var(--sc-accent-2);
      border: 1px solid rgba(var(--sc-accent-rgb), 0.4);
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
    #sc-np-tab:hover { background: var(--sc-drawer-bg-2-hover); }
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
      border-left: 2px dotted rgba(var(--sc-accent-rgb), 0.45);
      border-right: 2px dotted rgba(var(--sc-accent-rgb), 0.45);
      opacity: 0;
      transition: opacity 0.15s;
      pointer-events: none;
    }
    #sc-np-resize:hover::after,
    #sc-np-resize.sc-np-resizing::after { opacity: 1; }
    #sc-np-resize:hover,
    #sc-np-resize.sc-np-resizing { background: rgba(var(--sc-accent-rgb), 0.12); }

    /* ── Header ── */
    #sc-np-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 12px 8px;
      border-bottom: 1px solid rgba(var(--sc-accent-rgb), 0.18);
      flex-shrink: 0;
    }
    #sc-np-title {
      flex: 1;
      font-size: 12px;
      font-weight: 600;
      color: var(--sc-accent-2);
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
      color: var(--sc-slate-500);
      padding: 4px 5px;
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.12s, color 0.12s;
      flex-shrink: 0;
    }
    #sc-np-header button:hover { background: rgba(var(--sc-white-rgb), 0.07); color: var(--sc-slate-200); }
    #sc-np-header button.active { color: var(--sc-accent-2); background: rgba(var(--sc-accent-rgb), 0.15); }

    /* ── Activity log strip ── */
    #sc-np-log-strip {
      flex-shrink: 0;
      background: rgba(var(--sc-black-rgb), 0.28);
      border-bottom: 1px solid rgba(var(--sc-accent-rgb), 0.14);
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
    #sc-np-log-strip-inner::-webkit-scrollbar-thumb { background: rgba(var(--sc-accent-rgb), 0.25); border-radius: 2px; }
    .log-entry {
      font-size: 10.5px; color: var(--sc-slate-500); line-height: 1.45;
      padding: 2px 0; border-bottom: 1px solid rgba(var(--sc-accent-rgb), 0.05);
      display: flex; align-items: baseline; gap: 5px; white-space: pre-wrap; word-break: break-word;
    }
    .log-entry:last-child { border-bottom: none; }
    .log-ts { font-size: 9px; color: var(--sc-slate-700); flex-shrink: 0; font-variant-numeric: tabular-nums; }
    .log-msg { flex: 1; }
    .log-copy-btn {
      flex-shrink: 0; font-size: 9px; color: var(--sc-slate-700); cursor: pointer;
      background: none; border: none; padding: 1px 3px; border-radius: 3px;
      transition: color 0.12s; font-family: inherit;
    }
    .log-copy-btn:hover { color: var(--sc-accent-2); }
    #sc-np-log-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 3px 10px; border-top: 1px solid rgba(var(--sc-accent-rgb), 0.08);
      flex-shrink: 0;
    }
    #sc-np-log-bar-label { font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sc-slate-700); }
    #sc-np-log-clear-btn {
      font-size: 9px; color: var(--sc-slate-700); cursor: pointer;
      background: none; border: none; padding: 1px 4px; font-family: inherit;
      transition: color 0.12s;
    }
    #sc-np-log-clear-btn:hover { color: var(--sc-danger-light); }

    /* ── Insert / export buttons ── */
    .ql-copy-btn {
      display: inline-flex; align-items: center; gap: 3px;
      padding: 2px 7px; border-radius: 5px; border: 1px solid rgba(var(--sc-accent-rgb), 0.22);
      background: transparent; color: var(--sc-slate-600); font-size: 9.5px;
      font-weight: 700; font-family: inherit; cursor: pointer; letter-spacing: 0.03em;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
    }
    .ql-copy-btn:hover { background: rgba(var(--sc-accent-rgb), 0.1); border-color: rgba(var(--sc-accent-rgb), 0.4); color: var(--sc-accent-2); }
    .ql-copy-btn.inserted { color: var(--sc-success); border-color: rgba(var(--sc-success-rgb), 0.35); }
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
      color: var(--sc-slate-600);
      margin-left: auto;
    }
    .ql-sheet-status.ok { color: var(--sc-success); }
    .ql-sheet-status.err { color: var(--sc-danger-light); }

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
        radial-gradient(circle at 14% 0%, rgba(var(--sc-parchment-highlight-rgb), 0.06), transparent 22%),
        linear-gradient(180deg, rgba(var(--sc-parchment-shadow-dark-rgb), 0.08), transparent 25%);
    }
    #sc-np-quests-panel.sc-np-hidden { display: none; }
    #sc-np-quests-panel::-webkit-scrollbar { width: 5px; }
    #sc-np-quests-panel::-webkit-scrollbar-track { background: transparent; }
    #sc-np-quests-panel::-webkit-scrollbar-thumb { background: rgba(var(--sc-wood-border-rgb), 0.28); border-radius: 3px; }

    /* Quest section headers */
    .ql-section-header { display: flex; align-items: center; justify-content: space-between; }
    .ql-section-label { font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--sc-gold-label); font-family: Georgia, "Times New Roman", serif; text-shadow: 0 1px 0 rgba(var(--sc-black-rgb), 0.26); }
    .ql-add-btn {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 9px; border-radius: 7px; border: 1px solid rgba(var(--sc-wood-border-rgb), 0.34);
      background: linear-gradient(180deg, rgba(var(--sc-wood-btn-rgb), 0.9), rgba(var(--sc-wood-btn-dark-rgb), 0.94)); color: var(--sc-wood-btn-text); font-size: 10px;
      font-weight: 700; font-family: Georgia, "Times New Roman", serif; cursor: pointer; letter-spacing: 0.06em;
      transition: background 0.12s, border-color 0.12s;
    }
    .ql-add-btn:hover { background: linear-gradient(180deg, rgba(var(--sc-wood-btn-hover-rgb), 0.94), rgba(var(--sc-wood-btn-hover-dark-rgb), 0.98)); border-color: rgba(var(--sc-wood-border-hover-rgb), 0.54); }
    .ql-form {
      background:
        linear-gradient(180deg, rgba(var(--sc-parchment-shadow-dark-rgb), 0.34), rgba(var(--sc-parchment-shadow-dark-rgb), 0.42)),
        radial-gradient(circle at top, rgba(var(--sc-parchment-highlight-rgb), 0.08), transparent 36%);
      border: 1px solid rgba(var(--sc-wood-border-rgb), 0.28);
      border-radius: 10px;
      box-shadow: inset 0 1px 0 rgba(var(--sc-parchment-highlight-rgb), 0.06);
    }
    .ql-form .af-input,
    .ql-form .af-textarea {
      background: rgba(var(--sc-quest-input-bg-rgb), 0.72);
      border: 1px solid rgba(var(--sc-wood-border-rgb), 0.28);
      color: var(--sc-parchment-text);
      font-family: Georgia, "Times New Roman", serif;
      caret-color: var(--sc-parchment-caret);
    }
    .ql-form .af-input:focus,
    .ql-form .af-textarea:focus {
      border-color: rgba(var(--sc-wood-border-hover-rgb), 0.52);
      box-shadow: 0 0 0 2px rgba(var(--sc-wood-border-hover-rgb), 0.08);
    }
    .ql-form .af-input::placeholder,
    .ql-form .af-textarea::placeholder {
      color: var(--sc-parchment-placeholder-5);
    }
    .ql-form .af-submit {
      background: linear-gradient(180deg, rgba(var(--sc-wood-btn-rgb), 0.96), rgba(var(--sc-wood-btn-dark-rgb), 0.98));
      border: 1px solid rgba(var(--sc-wood-border-rgb), 0.38);
      color: var(--sc-wood-btn-text);
      font-family: Georgia, "Times New Roman", serif;
      letter-spacing: 0.04em;
    }
    .ql-form .af-submit:hover {
      background: linear-gradient(180deg, rgba(var(--sc-wood-btn-hover-rgb), 0.98), rgba(var(--sc-wood-btn-hover-dark-rgb), 1));
      border-color: rgba(var(--sc-wood-border-hover-rgb), 0.56);
    }

    /* Quest item card */
    .ql-item {
      background:
        radial-gradient(circle at top, rgba(var(--sc-parchment-highlight-rgb), 0.08), transparent 42%),
        linear-gradient(180deg, rgba(var(--sc-parchment-shadow-rgb), 0.16), rgba(var(--sc-parchment-shadow-dark-rgb), 0.1)),
        linear-gradient(180deg, rgba(var(--sc-parchment-rgb), 0.96), rgba(var(--sc-parchment-dark-rgb), 0.94));
      border: 1px solid rgba(var(--sc-wood-border-rgb), 0.34);
      border-radius: 10px; padding: 11px 13px;
      display: flex; flex-direction: column; gap: 6px;
      transition: border-color 0.15s, opacity 0.15s, box-shadow 0.15s;
      position: relative;
      box-shadow: inset 0 1px 0 rgba(var(--sc-parchment-highlight-rgb), 0.5), 0 8px 18px rgba(var(--sc-parchment-shadow-dark-rgb), 0.12);
    }
    .ql-item::before {
      content: "";
      position: absolute;
      inset: 5px;
      border-radius: 7px;
      border: 1px solid rgba(var(--sc-wood-border-rgb), 0.12);
      pointer-events: none;
    }
    .ql-item.ql-done { opacity: 0.62; border-color: rgba(var(--sc-quest-done-border-rgb), 0.28); }
    .ql-item.ql-failed { opacity: 0.55; border-color: rgba(var(--sc-danger-dark-rgb), 0.28); }
    .ql-item-top { display: flex; align-items: flex-start; gap: 8px; }
    .ql-item .item-disp-name {
      color: var(--sc-ink-1);
      font-family: Georgia, "Times New Roman", serif;
      font-weight: 700;
      text-shadow: none;
    }
    .ql-item .item-disp-note {
      color: var(--sc-ink-note);
      font-family: Georgia, "Times New Roman", serif;
      font-style: normal;
      line-height: 1.45;
      opacity: 1;
      text-shadow: none;
    }
    .ql-item.ql-done .item-disp-name { color: var(--sc-ink-done); }
    .ql-item.ql-failed .item-disp-name { color: var(--sc-ink-failed); }
    .ql-item.ql-done .item-disp-note,
    .ql-item.ql-failed .item-disp-note {
      color: var(--sc-ink-muted);
    }
    .ql-status-btn {
      flex-shrink: 0; width: 18px; height: 18px; border-radius: 50%;
      border: 2px solid rgba(var(--sc-wood-border-rgb), 0.46); background: rgba(var(--sc-wood-btn-rgb), 0.08);
      cursor: pointer; padding: 0; margin-top: 2px;
      transition: background 0.15s, border-color 0.15s;
      display: flex; align-items: center; justify-content: center;
    }
    .ql-status-btn:hover { border-color: rgba(var(--sc-wood-border-rgb), 0.72); background: rgba(var(--sc-wood-btn-hover-rgb), 0.14); }
    .ql-item.ql-done .ql-status-btn { background: rgba(var(--sc-success-rgb), 0.14); border-color: var(--sc-success-mid); }
    .ql-item.ql-failed .ql-status-btn { background: rgba(var(--sc-danger-rgb), 0.12); border-color: var(--sc-quest-failed-border); }
    .ql-status-icon { width: 8px; height: 8px; pointer-events: none; }
    .ql-title-wrap { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .ql-title-input {
      width: 100%; box-sizing: border-box; background: transparent;
      border: none; outline: none; color: var(--sc-ink-1); font-size: 12.5px;
      font-weight: 700; font-family: Georgia, "Times New Roman", serif; caret-color: var(--sc-quest-caret);
      padding: 0; line-height: 1.4;
      text-shadow: none;
    }
    .ql-item.ql-done .ql-title-input { text-decoration: line-through; color: var(--sc-ink-done); }
    .ql-item.ql-failed .ql-title-input { text-decoration: line-through; color: var(--sc-ink-failed); }
    .ql-title-input::placeholder { color: var(--sc-parchment-placeholder-1); }
    .ql-notes-input {
      width: 100%; box-sizing: border-box; background: transparent;
      border: none; outline: none; resize: none; color: var(--sc-ink-2);
      font-size: 11.5px; font-family: Georgia, "Times New Roman", serif; line-height: 1.55;
      caret-color: var(--sc-quest-caret); padding: 0; overflow: hidden; min-height: 0;
    }
    .ql-notes-input::placeholder { color: var(--sc-parchment-placeholder-2); }
    .ql-update-row {
      display: flex; gap: 5px; align-items: center;
      border-top: 1px solid rgba(var(--sc-wood-border-rgb), 0.14); padding-top: 5px; margin-top: 2px;
    }
    .ql-update-input {
      flex: 1; min-width: 0; background: transparent; border: none; outline: none;
      color: var(--sc-ink-3); font-size: 11px; font-family: Georgia, "Times New Roman", serif; font-style: italic;
      caret-color: var(--sc-quest-caret);
    }
    .ql-update-input::placeholder { color: var(--sc-parchment-placeholder-3); }
    .ql-update-btn {
      flex-shrink: 0; font-size: 9.5px; font-weight: 700; font-family: inherit;
      padding: 2px 7px; border-radius: 4px; cursor: pointer;
      background: linear-gradient(180deg, rgba(var(--sc-wood-btn-rgb), 0.9), rgba(var(--sc-wood-btn-dark-rgb), 0.94)); border: 1px solid rgba(var(--sc-wood-border-rgb), 0.3); color: var(--sc-wood-btn-text);
      transition: background 0.12s, border-color 0.12s;
    }
    .ql-update-btn:hover { background: linear-gradient(180deg, rgba(var(--sc-wood-btn-hover-rgb), 0.94), rgba(var(--sc-wood-btn-hover-dark-rgb), 0.98)); border-color: rgba(var(--sc-wood-border-hover-rgb), 0.5); }
    .ql-thought-row { display: flex; gap: 5px; align-items: center; margin-bottom: 2px; }
    .ql-thought-input {
      flex: 1; min-width: 0; background: rgba(var(--sc-black-rgb), 0.14); border: 1px solid rgba(var(--sc-wood-border-rgb), 0.2); border-radius: 5px;
      color: var(--sc-wood-btn-text); font-size: 11px; font-family: Georgia, "Times New Roman", serif; font-style: italic;
      caret-color: var(--sc-quest-caret); padding: 4px 7px; outline: none;
    }
    .ql-thought-input::placeholder { color: var(--sc-parchment-placeholder-4); }
    .ql-updates-list {
      display: flex; flex-direction: column; gap: 2px;
      padding-top: 3px; margin-top: 2px;
      border-top: 1px solid rgba(var(--sc-wood-border-rgb), 0.14);
    }
    .ql-updates-list:empty { display: none; }
    .ql-update-entry {
      display: flex; align-items: flex-start; gap: 4px;
      font-size: 10.5px; font-style: italic; color: var(--sc-ink-4);
      white-space: pre-wrap; word-break: break-word;
    }
    .ql-update-entry:first-child { color: var(--sc-ink-5); }
    .ql-update-entry-text { flex: 1; min-width: 0; }
    .ql-update-entry-del {
      flex-shrink: 0; background: none; border: none; cursor: pointer;
      color: var(--sc-ink-9); font-size: 9px; line-height: 1.4; padding: 0 2px;
      transition: color 0.1s;
    }
    .ql-update-entry-del:hover { color: var(--sc-danger-light); }
    .ql-item-bottom { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
    .ql-state-btns { display: flex; gap: 4px; }
    .ql-state-chip {
      font-size: 9.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
      padding: 2px 7px; border-radius: 100px; border: 1px solid transparent;
      cursor: pointer; font-family: inherit; background: transparent;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
    }
    .ql-state-chip.active-chip { pointer-events: none; }
    .ql-state-active  { color: var(--sc-quest-active); border-color: rgba(var(--sc-quest-active-rgb), 0.35); }
    .ql-state-active.active-chip  { background: rgba(var(--sc-quest-active-rgb), 0.22); }
    .ql-state-active:not(.active-chip):hover  { background: rgba(var(--sc-quest-active-rgb), 0.08); }
    .ql-state-done    { color: var(--sc-success-dark); border-color: rgba(var(--sc-success-dark-rgb), 0.34); }
    .ql-state-done.active-chip    { background: rgba(var(--sc-success-rgb), 0.2); }
    .ql-state-done:not(.active-chip):hover    { background: rgba(var(--sc-success-rgb), 0.08); }
    .ql-state-failed  { color: var(--sc-danger-dark); border-color: rgba(var(--sc-danger-dark-rgb), 0.34); }
    .ql-state-failed.active-chip  { background: rgba(var(--sc-danger-rgb), 0.16); }
    .ql-state-failed:not(.active-chip):hover  { background: rgba(var(--sc-danger-rgb), 0.07); }
    .ql-delete-btn {
      background: none; border: none; padding: 3px 5px; cursor: pointer;
      color: var(--sc-ink-6); border-radius: 4px; transition: color 0.12s, background 0.12s;
      display: flex; align-items: center;
    }
    .ql-delete-btn:hover { color: var(--sc-danger-light); background: rgba(var(--sc-danger-rgb), 0.08); }
    .ql-insert-btn {
      background: none; border: none; padding: 3px 5px; cursor: pointer;
      color: var(--sc-ink-7); border-radius: 4px; font-size: 11px; font-family: Georgia, "Times New Roman", serif;
      transition: color 0.12s, background 0.12s;
    }
    .ql-insert-btn:hover { color: var(--sc-wood-hover-text); background: rgba(var(--sc-wood-border-rgb), 0.12); }
    .ql-empty-state { text-align: center; color: var(--sc-ink-8); font-size: 12px; padding: 16px 0; font-family: Georgia, "Times New Roman", serif; }

    /* ── Stat Tracker (gamified) ── */
    .stat-item {
      position: relative; display: flex; flex-direction: column; gap: 4px;
      padding: 7px 9px 6px; margin-bottom: 6px; border-radius: 7px;
      background: linear-gradient(160deg, rgba(var(--sc-gold-rgb), 0.09), rgba(var(--sc-quest-input-bg-rgb), 0.32));
      border: 1px solid rgba(var(--sc-gold-rgb), 0.22);
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .stat-item:last-child { margin-bottom: 0; }
    .stat-item:hover { border-color: rgba(var(--sc-gold-rgb), 0.48); box-shadow: 0 3px 10px rgba(var(--sc-black-rgb), 0.22); }
    .stat-item-top { display: flex; align-items: center; gap: 8px; width: 100%; }
    .stat-item .item-disp-name {
      flex: 1; min-width: 0; font-size: 10.5px; font-weight: 700; letter-spacing: 0.07em;
      text-transform: uppercase; color: var(--sc-gold-label); font-family: Georgia, "Times New Roman", serif;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .stat-value {
      text-align: right; font-size: 13px; font-weight: 800; color: var(--sc-gold-bright);
      font-variant-numeric: tabular-nums; flex-shrink: 0; word-break: break-all;
      padding: 2px 9px; border-radius: 999px;
      background: linear-gradient(180deg, rgba(var(--sc-gold-rgb), 0.26), rgba(var(--sc-gold-rgb), 0.09));
      border: 1px solid rgba(var(--sc-gold-rgb), 0.4);
    }
    .stat-val-input {
      width: 76px; flex-shrink: 0;
    }
    .stat-item .item-disp-note { color: var(--sc-gold-note); }
    .stat-delete-btn {
      background: none; border: none; padding: 2px 3px; cursor: pointer; flex-shrink: 0;
      color: rgba(var(--sc-gold-rgb), 0.32); border-radius: 3px; transition: color 0.12s; display: flex; align-items: center;
    }
    .stat-delete-btn:hover { color: var(--sc-danger-light); }
    .stat-item .item-toggle-btn.edit { color: rgba(var(--sc-gold-rgb), 0.45); border-color: rgba(var(--sc-gold-rgb), 0.22); }
    .stat-item .item-toggle-btn.edit:hover { color: var(--sc-gold-bright); border-color: rgba(var(--sc-gold-rgb), 0.5); }
    /* bulk stat modification panel */
    .stat-adjust-panel {
      display: flex; flex-direction: column; gap: 6px;
      border-top: 1px solid rgba(var(--sc-gold-rgb), 0.18); padding-top: 8px; margin-top: 2px;
    }
    .stat-adjust-row { display: flex; align-items: center; gap: 6px; }
    .stat-select {
      flex: 1; min-width: 0; background: rgba(var(--sc-quest-input-bg-rgb), 0.4);
      border: 1px solid rgba(var(--sc-gold-rgb), 0.28); border-radius: 5px;
      color: var(--sc-gold-bright); font-size: 11.5px; font-family: inherit;
      padding: 5px 7px; outline: none; transition: border-color 0.12s;
      appearance: none; -webkit-appearance: none;
      /* chevron stroke is baked into the SVG data URI and can't reference a CSS var — keep in sync with --sc-gold */
      background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23d9a445' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 7px center;
      padding-right: 22px; cursor: pointer;
    }
    .stat-select:focus { border-color: rgba(var(--sc-gold-rgb), 0.6); }
    .stat-select option { background: var(--sc-gold-dropdown-bg); color: var(--sc-gold-bright); }
    .stat-amount-input {
      width: 84px; flex-shrink: 0; text-align: center;
      background: rgba(var(--sc-quest-input-bg-rgb), 0.4); border: 1px solid rgba(var(--sc-gold-rgb), 0.28); border-radius: 5px;
      color: var(--sc-gold-bright); font-size: 12px; font-weight: 700; font-family: inherit;
      padding: 5px 4px; outline: none; transition: border-color 0.12s; caret-color: var(--sc-gold);
    }
    .stat-amount-input::placeholder { color: rgba(var(--sc-gold-rgb), 0.4); }
    .stat-amount-input:focus { border-color: rgba(var(--sc-gold-rgb), 0.6); }
    .stat-reason-input {
      width: 100%; box-sizing: border-box; background: rgba(var(--sc-quest-input-bg-rgb), 0.3);
      border: 1px solid rgba(var(--sc-gold-rgb), 0.18); border-radius: 5px;
      color: var(--sc-gold-muted); font-size: 11px; font-family: inherit; font-style: italic;
      padding: 5px 7px; outline: none; transition: border-color 0.12s; caret-color: var(--sc-gold);
    }
    .stat-reason-input::placeholder { color: rgba(var(--sc-gold-rgb), 0.3); }
    .stat-reason-input:focus { border-color: rgba(var(--sc-gold-rgb), 0.45); }
    .stat-op-btn {
      padding: 5px 11px; border-radius: 5px; font-size: 12px; font-weight: 700;
      font-family: inherit; cursor: pointer; border: 1px solid transparent;
      transition: background 0.12s, border-color 0.12s; flex-shrink: 0;
    }
    .stat-op-add { background: rgba(var(--sc-success-rgb), 0.12); border-color: rgba(var(--sc-success-rgb), 0.3); color: var(--sc-success); }
    .stat-op-add:hover { background: rgba(var(--sc-success-rgb), 0.22); border-color: rgba(var(--sc-success-rgb), 0.5); }
    .stat-op-sub { background: rgba(var(--sc-danger-rgb), 0.1); border-color: rgba(var(--sc-danger-rgb), 0.28); color: var(--sc-danger-light); }
    .stat-op-sub:hover { background: rgba(var(--sc-danger-rgb), 0.2); border-color: rgba(var(--sc-danger-rgb), 0.45); }
    .stat-op-set { background: rgba(var(--sc-gold-rgb), 0.14); border-color: rgba(var(--sc-gold-rgb), 0.4); color: var(--sc-gold-mid); }
    .stat-op-set:hover { background: rgba(var(--sc-gold-rgb), 0.24); border-color: rgba(var(--sc-gold-rgb), 0.6); }
    .stat-feedback { font-size: 10.5px; color: var(--sc-gold-mid); height: 14px; opacity: 0; transition: opacity 0.3s; }
    .stat-feedback.visible { opacity: 1; }

    /* ── Add form ── */
    .af-form {
      display: flex; flex-direction: column; gap: 6px;
      padding: 8px 10px 10px; margin-bottom: 8px;
      background: rgba(var(--sc-accent-rgb), 0.04); border: 1px solid rgba(var(--sc-accent-rgb), 0.18);
      border-radius: 7px;
    }
    .af-row { display: flex; gap: 5px; align-items: center; }
    .af-input {
      flex: 1; min-width: 0; background: rgba(var(--sc-black-rgb), 0.25);
      border: 1px solid rgba(var(--sc-accent-rgb), 0.18); border-radius: 5px;
      color: var(--sc-slate-200); font-size: 12px; font-family: inherit;
      padding: 5px 8px; outline: none; transition: border-color 0.12s; caret-color: var(--sc-accent-2);
    }
    .af-input:focus { border-color: rgba(var(--sc-accent-rgb), 0.45); }
    .af-input::placeholder { color: var(--sc-slate-800); }
    .af-textarea {
      width: 100%; box-sizing: border-box; resize: none;
      background: rgba(var(--sc-black-rgb), 0.25); border: 1px solid rgba(var(--sc-accent-rgb), 0.18);
      border-radius: 5px; color: var(--sc-slate-400); font-size: 11.5px; font-family: inherit;
      padding: 5px 8px; outline: none; transition: border-color 0.12s;
      caret-color: var(--sc-accent-2); overflow: hidden; min-height: 0;
    }
    .af-textarea:focus { border-color: rgba(var(--sc-accent-rgb), 0.4); }
    .af-textarea::placeholder { color: var(--sc-slate-800); }
    .af-select {
      flex: 1; min-width: 0; background: rgba(var(--sc-black-rgb), 0.25);
      border: 1px solid rgba(var(--sc-accent-rgb), 0.18); border-radius: 5px;
      color: var(--sc-slate-200); font-size: 11.5px; font-family: inherit;
      padding: 5px 7px; outline: none; transition: border-color 0.12s;
      appearance: none; -webkit-appearance: none;
      /* chevron stroke is baked into the SVG data URI and can't reference a CSS var — keep in sync with --sc-accent */
      background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236c63ff' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 7px center;
      padding-right: 22px; cursor: pointer;
    }
    .af-select:focus { border-color: rgba(var(--sc-accent-rgb), 0.45); }
    .af-select option { background: var(--sc-drawer-dropdown-bg); color: var(--sc-slate-200); }
    .af-number {
      width: 52px; flex-shrink: 0; text-align: center;
      background: rgba(var(--sc-black-rgb), 0.25); border: 1px solid rgba(var(--sc-accent-rgb), 0.18);
      border-radius: 5px; color: var(--sc-accent-2); font-size: 12px; font-weight: 700;
      font-family: inherit; padding: 5px 4px; outline: none;
      transition: border-color 0.12s; caret-color: var(--sc-accent-2);
    }
    .af-number:focus { border-color: rgba(var(--sc-accent-rgb), 0.45); }
    .af-submit {
      flex-shrink: 0; padding: 5px 12px; border-radius: 5px;
      background: rgba(var(--sc-accent-rgb), 0.15); border: 1px solid rgba(var(--sc-accent-rgb), 0.35);
      color: var(--sc-accent-2); font-size: 11px; font-weight: 700; font-family: inherit;
      cursor: pointer; transition: background 0.12s, border-color 0.12s;
    }
    .af-submit:hover { background: rgba(var(--sc-accent-rgb), 0.25); border-color: rgba(var(--sc-accent-rgb), 0.6); }

    /* ── AI Generator ── */
    .gen-card { display: flex; flex-direction: column; gap: 8px; }
    .gen-type-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .gen-type-btn {
      padding: 5px 12px; border-radius: 100px; white-space: nowrap;
      border: 1px solid rgba(var(--sc-accent-rgb), 0.18); background: rgba(var(--sc-black-rgb), 0.2);
      color: var(--sc-slate-400); font-size: 11.5px; font-weight: 600; font-family: inherit;
      cursor: pointer; transition: background 0.12s, border-color 0.12s, color 0.12s, transform 0.08s;
    }
    .gen-type-btn:hover { border-color: rgba(var(--sc-accent-rgb), 0.4); color: var(--sc-slate-200); }
    .gen-type-btn:active { transform: scale(0.94); }
    .gen-type-btn.active {
      background: rgba(var(--sc-accent-rgb), 0.18); border-color: rgba(var(--sc-accent-rgb), 0.55);
      color: var(--sc-accent-2);
    }
    .gen-actions-row { display: flex; align-items: center; gap: 10px; }
    .gen-status { font-size: 11px; color: var(--sc-slate-600); }
    .gen-status.err { color: var(--sc-danger-light); }
    .gen-result {
      display: flex; flex-direction: column; gap: 8px; padding: 8px 10px; border-radius: 6px;
      background: rgba(var(--sc-gold-rgb), 0.08); border: 1px solid rgba(var(--sc-gold-rgb), 0.28);
    }
    .gen-result-text { font-size: 12px; color: var(--sc-slate-200); line-height: 1.5; }
    .gen-result-actions { display: flex; gap: 6px; }

    /* ── Item display / edit toggle ── */
    .item-disp-name {
      flex: 1; min-width: 0; font-size: 12.5px; font-weight: 600; color: var(--sc-slate-200);
      line-height: 1.4; word-break: break-word;
    }
    .item-disp-note {
      font-size: 11.5px; color: var(--sc-slate-400); font-style: italic;
      line-height: 1.4; word-break: break-word; margin-top: 2px;
    }
    .item-edit-view { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 0; }
    .item-toggle-btn {
      flex-shrink: 0; background: none; border: 1px solid rgba(var(--sc-accent-rgb), 0.18);
      border-radius: 4px; padding: 2px 7px; cursor: pointer;
      font-size: 10.5px; font-family: inherit;
      transition: color 0.12s, border-color 0.12s, background 0.12s;
    }
    .item-toggle-btn.edit { color: var(--sc-slate-600); }
    .item-toggle-btn.edit:hover { color: var(--sc-accent-2); border-color: rgba(var(--sc-accent-rgb), 0.4); }
    .item-toggle-btn.save { color: var(--sc-success); border-color: rgba(var(--sc-success-rgb), 0.3); background: rgba(var(--sc-success-rgb), 0.07); }
    .item-toggle-btn.save:hover { background: rgba(var(--sc-success-rgb), 0.15); border-color: rgba(var(--sc-success-rgb), 0.5); }

    /* ── Collapsible quest sections ── */
    .ql-collapsible-hdr { cursor: pointer; user-select: none; }
    .ql-section-body.ql-collapsed { display: none; }
    .ql-chevron { display: flex; align-items: center; transition: transform 0.18s; color: var(--sc-slate-700); flex-shrink: 0; }
    .ql-chevron.collapsed { transform: rotate(-90deg); }

    /* ── Resource counters ── */
    .res-item {
      display: flex; flex-direction: column; gap: 4px;
      padding: 5px 0; border-bottom: 1px solid rgba(var(--sc-accent-rgb), 0.07);
    }
    .res-item:last-child { border-bottom: none; }
    .res-item-top { display: flex; align-items: center; gap: 8px; width: 100%; }
    .res-name-input {
      flex: 1; background: transparent; border: none; outline: none;
      color: var(--sc-slate-200); font-size: 12px; font-family: inherit; caret-color: var(--sc-accent-2); min-width: 0;
    }
    .res-name-input::placeholder { color: var(--sc-slate-700); }
    .res-value {
      min-width: 38px; text-align: right; font-size: 14px; font-weight: 800;
      color: var(--sc-accent-2); font-variant-numeric: tabular-nums; flex-shrink: 0;
    }
    .res-delete-btn {
      background: none; border: none; padding: 2px 3px; cursor: pointer;
      color: var(--sc-slate-800); border-radius: 3px; flex-shrink: 0;
      transition: color 0.12s; display: flex; align-items: center;
    }
    .res-delete-btn:hover { color: var(--sc-danger-light); }
    .res-note-input {
      width: 100%; box-sizing: border-box; background: transparent;
      border: none; border-top: 1px solid rgba(var(--sc-accent-rgb), 0.07); outline: none;
      color: var(--sc-slate-500); font-size: 11px; font-family: inherit; font-style: italic;
      padding: 3px 0 1px; caret-color: var(--sc-accent-2);
    }
    .res-note-input::placeholder { color: var(--sc-slate-800); }
    /* bulk adjust panel */
    .res-adjust-panel {
      display: flex; flex-direction: column; gap: 6px;
      border-top: 1px solid rgba(var(--sc-accent-rgb), 0.12); padding-top: 8px; margin-top: 2px;
    }
    .res-adjust-row { display: flex; align-items: center; gap: 6px; }
    .res-select {
      flex: 1; min-width: 0; background: rgba(var(--sc-black-rgb), 0.3);
      border: 1px solid rgba(var(--sc-accent-rgb), 0.2); border-radius: 5px;
      color: var(--sc-slate-200); font-size: 11.5px; font-family: inherit;
      padding: 5px 7px; outline: none; transition: border-color 0.12s;
      appearance: none; -webkit-appearance: none;
      /* chevron stroke is baked into the SVG data URI and can't reference a CSS var — keep in sync with --sc-accent */
      background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236c63ff' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 7px center;
      padding-right: 22px; cursor: pointer;
    }
    .res-select:focus { border-color: rgba(var(--sc-accent-rgb), 0.5); }
    .res-select option { background: var(--sc-drawer-dropdown-bg); color: var(--sc-slate-200); }
    .res-amount-input {
      width: 52px; flex-shrink: 0; text-align: center;
      background: rgba(var(--sc-black-rgb), 0.3); border: 1px solid rgba(var(--sc-accent-rgb), 0.2); border-radius: 5px;
      color: var(--sc-slate-200); font-size: 12.5px; font-weight: 700; font-family: inherit;
      padding: 5px 4px; outline: none; transition: border-color 0.12s; caret-color: var(--sc-accent-2);
    }
    .res-amount-input:focus { border-color: rgba(var(--sc-accent-rgb), 0.5); }
    .res-op-btn {
      padding: 5px 11px; border-radius: 5px; font-size: 12px; font-weight: 700;
      font-family: inherit; cursor: pointer; border: 1px solid transparent;
      transition: background 0.12s, border-color 0.12s; flex-shrink: 0;
    }
    .res-op-add { background: rgba(var(--sc-success-rgb), 0.12); border-color: rgba(var(--sc-success-rgb), 0.3); color: var(--sc-success); }
    .res-op-add:hover { background: rgba(var(--sc-success-rgb), 0.22); border-color: rgba(var(--sc-success-rgb), 0.5); }
    .res-op-sub { background: rgba(var(--sc-danger-rgb), 0.1); border-color: rgba(var(--sc-danger-rgb), 0.28); color: var(--sc-danger-light); }
    .res-op-sub:hover { background: rgba(var(--sc-danger-rgb), 0.2); border-color: rgba(var(--sc-danger-rgb), 0.45); }
    .res-op-set { background: rgba(var(--sc-accent-rgb), 0.1); border-color: rgba(var(--sc-accent-rgb), 0.28); color: var(--sc-accent-2); }
    .res-op-set:hover { background: rgba(var(--sc-accent-rgb), 0.2); border-color: rgba(var(--sc-accent-rgb), 0.5); }
    .res-feedback { font-size: 10.5px; color: var(--sc-success); height: 14px; opacity: 0; transition: opacity 0.3s; }
    .res-feedback.visible { opacity: 1; }

    /* ── NPC Tracker ── */
    .npc-item {
      display: flex; align-items: flex-start; gap: 7px; flex-direction: column;
      background: rgba(var(--sc-white-rgb), 0.025); border: 1px solid rgba(var(--sc-accent-rgb), 0.13);
      border-radius: 6px; padding: 7px 10px; transition: border-color 0.12s;
    }
    .npc-item:focus-within { border-color: rgba(var(--sc-accent-rgb), 0.35); }
    .npc-top { display: flex; align-items: center; gap: 6px; width: 100%; }
    .npc-disp-btn {
      flex-shrink: 0; padding: 2px 7px; border-radius: 100px; border: 1px solid transparent;
      font-size: 9.5px; font-weight: 700; cursor: pointer; font-family: inherit;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
    }
    .npc-disp-friendly { background: rgba(var(--sc-success-rgb), 0.12);  border-color: rgba(var(--sc-success-rgb), 0.3);  color: var(--sc-success); }
    .npc-disp-neutral  { background: rgba(var(--sc-slate-500-rgb), 0.1); border-color: rgba(var(--sc-slate-500-rgb), 0.25);color: var(--sc-slate-400); }
    .npc-disp-hostile  { background: rgba(var(--sc-danger-rgb), 0.1);   border-color: rgba(var(--sc-danger-rgb), 0.28);  color: var(--sc-danger-light); }
    .npc-name-input {
      flex: 1; background: transparent; border: none; outline: none;
      color: var(--sc-slate-200); font-size: 12.5px; font-weight: 600; font-family: inherit;
      caret-color: var(--sc-accent-2); min-width: 0;
    }
    .npc-name-input::placeholder { color: var(--sc-slate-700); }
    .npc-note-input {
      width: 100%; background: transparent; border: none; outline: none;
      color: var(--sc-slate-500); font-size: 11.5px; font-family: inherit; caret-color: var(--sc-accent-2);
    }
    .npc-note-input::placeholder { color: var(--sc-slate-800); }
    .npc-delete-btn {
      background: none; border: none; padding: 2px 3px; cursor: pointer; flex-shrink: 0;
      color: var(--sc-slate-800); border-radius: 3px; transition: color 0.12s; display: flex; align-items: center;
    }
    .npc-delete-btn:hover { color: var(--sc-danger-light); }

    /* ── Ability Uses ── */
    .abl-item {
      display: flex; align-items: center; gap: 6px;
      background: rgba(var(--sc-white-rgb), 0.025); border: 1px solid rgba(var(--sc-accent-rgb), 0.13);
      border-radius: 6px; padding: 5px 8px; transition: border-color 0.12s;
    }
    .abl-item:focus-within { border-color: rgba(var(--sc-accent-rgb), 0.35); }
    .abl-name-input {
      flex: 1; background: transparent; border: none; outline: none;
      color: var(--sc-slate-200); font-size: 12px; font-family: inherit; caret-color: var(--sc-accent-2); min-width: 0;
    }
    .abl-name-input::placeholder { color: var(--sc-slate-700); }
    .abl-use-btn {
      width: 22px; height: 22px; border-radius: 4px;
      border: 1px solid rgba(var(--sc-accent-rgb), 0.28); background: rgba(var(--sc-accent-rgb), 0.07);
      color: var(--sc-accent-2); font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.12s, border-color 0.12s;
    }
    .abl-use-btn:hover { background: rgba(var(--sc-accent-rgb), 0.2); border-color: rgba(var(--sc-accent-rgb), 0.5); }
    .abl-cur { font-size: 13px; font-weight: 700; color: var(--sc-accent-2); min-width: 18px; text-align: center; }
    .abl-sep { font-size: 11px; color: var(--sc-slate-700); }
    .abl-max-input {
      width: 28px; text-align: center; background: rgba(var(--sc-black-rgb), 0.2);
      border: 1px solid rgba(var(--sc-accent-rgb), 0.15); border-radius: 3px;
      color: var(--sc-slate-500); font-size: 11px; font-family: inherit; padding: 1px 2px; outline: none;
    }
    .abl-reset-btn {
      font-size: 9px; font-weight: 700; color: var(--sc-slate-600);
      background: none; border: 1px solid rgba(var(--sc-accent-rgb), 0.15); border-radius: 4px;
      padding: 2px 5px; cursor: pointer; font-family: inherit; flex-shrink: 0;
      transition: color 0.12s, border-color 0.12s;
    }
    .abl-reset-btn:hover { color: var(--sc-accent-2); border-color: rgba(var(--sc-accent-rgb), 0.4); }
    .abl-delete-btn {
      background: none; border: none; padding: 2px 3px; cursor: pointer; flex-shrink: 0;
      color: var(--sc-slate-800); border-radius: 3px; transition: color 0.12s; display: flex; align-items: center;
    }
    .abl-delete-btn:hover { color: var(--sc-danger-light); }
    .abl-notes-input {
      width: 100%; box-sizing: border-box; background: transparent;
      border: none; border-top: 1px solid rgba(var(--sc-accent-rgb), 0.07); outline: none; resize: none;
      color: var(--sc-slate-500); font-size: 11px; font-family: inherit; line-height: 1.4;
      caret-color: var(--sc-accent-2); overflow: hidden; min-height: 0; padding: 4px 0 2px;
    }
    .abl-notes-input::placeholder { color: var(--sc-slate-800); }
    .abl-rest-panel {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 9px;
      padding: 10px 11px 11px;
      border: 1px solid rgba(var(--sc-wood-border-rgb), 0.34);
      border-radius: 9px;
      background:
        radial-gradient(circle at top left, rgba(var(--sc-rest-highlight-rgb), 0.14), transparent 42%),
        linear-gradient(180deg, rgba(var(--sc-rest-panel-rgb), 0.48), rgba(var(--sc-rest-panel-dark-rgb), 0.72));
      box-shadow: inset 0 1px 0 rgba(var(--sc-rest-highlight-rgb), 0.08), 0 8px 18px rgba(var(--sc-black-rgb), 0.18);
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
      color: var(--sc-rest-gold-text);
      font: 700 12px/1.1 Georgia, "Times New Roman", serif;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      text-shadow: 0 1px 0 rgba(var(--sc-black-rgb), 0.35);
    }
    .abl-rest-hint {
      color: var(--sc-rest-hint);
      font-size: 10.5px;
      line-height: 1.35;
    }
    .abl-rest-btn {
      flex-shrink: 0;
      padding: 7px 14px;
      border-radius: 999px;
      border: 1px solid rgba(var(--sc-wood-border-hover-rgb), 0.54);
      background: linear-gradient(180deg, rgba(var(--sc-rest-btn-rgb), 0.95), rgba(var(--sc-rest-btn-dark-rgb), 0.95));
      color: var(--sc-rest-cream);
      font: 700 11px/1 Georgia, "Times New Roman", serif;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      cursor: pointer;
      box-shadow: inset 0 1px 0 rgba(var(--sc-rest-highlight-rgb), 0.25), 0 4px 10px rgba(var(--sc-rest-panel-rgb), 0.28);
      transition: transform 0.08s, filter 0.12s, box-shadow 0.12s;
    }
    .abl-rest-btn:hover {
      filter: brightness(1.07);
      box-shadow: inset 0 1px 0 rgba(var(--sc-rest-highlight-rgb), 0.28), 0 6px 14px rgba(var(--sc-rest-panel-rgb), 0.34);
    }
    .abl-rest-btn:active { transform: translateY(1px) scale(0.99); }
    .abl-rest-btn:disabled {
      cursor: not-allowed;
      filter: saturate(0.55) brightness(0.88);
      box-shadow: inset 0 1px 0 rgba(var(--sc-rest-highlight-rgb), 0.12);
    }
    .abl-rest-notes {
      width: 100%;
      box-sizing: border-box;
      resize: none;
      min-height: 0;
      padding: 7px 9px;
      border-radius: 7px;
      border: 1px solid rgba(var(--sc-wood-border-rgb), 0.22);
      background: rgba(var(--sc-rest-panel-rgb), 0.46);
      color: var(--sc-rest-notes-text);
      font: 11.5px/1.45 Georgia, "Times New Roman", serif;
      outline: none;
      caret-color: var(--sc-rest-gold-text);
      transition: border-color 0.12s, background 0.12s;
    }
    .abl-rest-notes:focus {
      border-color: rgba(var(--sc-wood-border-hover-rgb), 0.52);
      background: rgba(var(--sc-rest-panel-rgb), 0.58);
    }
    .abl-rest-notes::placeholder { color: var(--sc-rest-notes-placeholder); }
    .abl-rest-detail-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .abl-rest-detail-label {
      color: var(--sc-rest-hint);
      font-size: 10.5px;
      line-height: 1.3;
    }
    .abl-rest-toggle { position: relative; width: 30px; height: 17px; flex-shrink: 0; cursor: pointer; }
    .abl-rest-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
    .abl-rest-toggle-track {
      position: absolute;
      inset: 0;
      background: rgba(var(--sc-rest-panel-dark-rgb), 0.6);
      border: 1px solid rgba(var(--sc-wood-border-rgb), 0.4);
      border-radius: 999px;
      transition: background 0.15s, border-color 0.15s;
    }
    .abl-rest-toggle-track::after {
      content: "";
      position: absolute;
      width: 12px;
      height: 12px;
      left: 2px;
      top: 2px;
      border-radius: 50%;
      background: var(--sc-rest-hint);
      transition: transform 0.15s, background 0.15s;
    }
    .abl-rest-toggle input:checked ~ .abl-rest-toggle-track {
      background: linear-gradient(180deg, rgba(var(--sc-rest-btn-rgb), 0.9), rgba(var(--sc-rest-btn-dark-rgb), 0.9));
      border-color: rgba(var(--sc-wood-border-hover-rgb), 0.6);
    }
    .abl-rest-toggle input:checked ~ .abl-rest-toggle-track::after {
      transform: translateX(13px);
      background: var(--sc-rest-gold-text);
    }

    /* ── Party Tracker ── */
    .party-item {
      display: flex; align-items: flex-start; gap: 7px; flex-direction: column;
      background: rgba(var(--sc-white-rgb), 0.025); border: 1px solid rgba(var(--sc-accent-rgb), 0.13);
      border-radius: 6px; padding: 6px 10px; transition: border-color 0.12s;
    }
    .party-item:focus-within { border-color: rgba(var(--sc-accent-rgb), 0.35); }
    .party-top { display: flex; align-items: center; gap: 7px; width: 100%; }
    .party-status-pill {
      flex-shrink: 0; padding: 2px 8px; border-radius: 100px; border: 1px solid transparent;
      font-size: 9.5px; font-weight: 700; font-family: inherit; min-width: 54px;
      text-align: center; transition: background 0.12s, border-color 0.12s, color 0.12s;
    }
    .party-status-healthy { background: rgba(var(--sc-success-rgb), 0.12);  border-color: rgba(var(--sc-success-rgb), 0.3);  color: var(--sc-success); }
    .party-status-downed { background: rgba(var(--sc-warning-rgb), 0.1);  border-color: rgba(var(--sc-warning-rgb), 0.3);  color: var(--sc-warning); }
    .party-status-dead   { background: rgba(var(--sc-danger-rgb), 0.1);   border-color: rgba(var(--sc-danger-rgb), 0.28);  color: var(--sc-danger-light); }
    .party-status-absent { background: rgba(var(--sc-slate-500-rgb), 0.1); border-color: rgba(var(--sc-slate-500-rgb), 0.25);color: var(--sc-slate-500); }
    .party-status-custom { background: rgba(var(--sc-info-rgb), 0.12); border-color: rgba(var(--sc-info-rgb), 0.25); color: var(--sc-info); }
    .party-name-input {
      flex: 1; background: transparent; border: none; outline: none;
      color: var(--sc-slate-200); font-size: 12.5px; font-weight: 600; font-family: inherit;
      caret-color: var(--sc-accent-2); min-width: 0;
    }
    .party-name-input::placeholder { color: var(--sc-slate-700); }
    .party-status-input {
      flex: 0 0 104px;
      min-width: 88px;
      max-width: 128px;
      background: rgba(var(--sc-slate-900-rgb), 0.45);
      border: 1px solid rgba(var(--sc-accent-rgb), 0.24);
      border-radius: 5px;
      color: var(--sc-slate-300);
      font: 11px/1.3 inherit;
      padding: 4px 6px;
      outline: none;
    }
    .party-status-input:focus {
      border-color: rgba(var(--sc-accent-rgb), 0.45);
      background: rgba(var(--sc-slate-900-focus-rgb), 0.6);
    }
    .party-note-input {
      width: 100%; box-sizing: border-box; background: transparent;
      border: none; border-top: 1px solid rgba(var(--sc-accent-rgb), 0.07); outline: none;
      color: var(--sc-slate-500); font-size: 11px; font-family: inherit; font-style: italic;
      padding: 3px 0 1px; caret-color: var(--sc-accent-2);
    }
    .party-note-input::placeholder { color: var(--sc-slate-800); }
    .party-delete-btn {
      background: none; border: none; padding: 2px 3px; cursor: pointer; flex-shrink: 0;
      color: var(--sc-slate-800); border-radius: 3px; transition: color 0.12s; display: flex; align-items: center;
    }
    .party-delete-btn:hover { color: var(--sc-danger-light); }

    /* ── Rumours Board ── */
    .rumour-item {
      display: flex; align-items: flex-start; gap: 8px;
      padding: 6px 0; border-bottom: 1px solid rgba(var(--sc-accent-rgb), 0.07);
    }
    .rumour-item:last-child { border-bottom: none; padding-bottom: 0; }
    .rumour-check {
      flex-shrink: 0; width: 16px; height: 16px; margin-top: 2px;
      border: 1.5px solid rgba(var(--sc-accent-rgb), 0.35); border-radius: 3px;
      background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: background 0.12s, border-color 0.12s;
    }
    .rumour-check:hover { border-color: rgba(var(--sc-accent-rgb), 0.65); background: rgba(var(--sc-accent-rgb), 0.08); }
    .rumour-item.rumour-done .rumour-check { background: rgba(var(--sc-success-rgb), 0.2); border-color: var(--sc-success); }
    .rumour-text-input {
      flex: 1; background: transparent; border: none; outline: none; resize: none;
      color: var(--sc-slate-200); font-size: 12px; font-family: inherit; line-height: 1.4;
      caret-color: var(--sc-accent-2); overflow: hidden; min-height: 0;
    }
    .rumour-item.rumour-done .rumour-text-input { color: var(--sc-slate-600); text-decoration: line-through; }
    .rumour-text-input::placeholder { color: var(--sc-slate-700); }
    .rumour-delete-btn {
      background: none; border: none; padding: 2px 3px; cursor: pointer; flex-shrink: 0;
      color: var(--sc-slate-800); border-radius: 3px; transition: color 0.12s; display: flex; align-items: center; margin-top: 1px;
    }
    .rumour-delete-btn:hover { color: var(--sc-danger-light); }

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
      background: none; color: var(--sc-slate-500); font-size: 10.5px; font-weight: 600;
      cursor: pointer; letter-spacing: 0.04em; text-transform: uppercase;
      transition: background 0.12s, color 0.12s, border-color 0.12s;
      white-space: nowrap; font-family: inherit; line-height: 1;
    }
    #sc-np-tabstrip .sc-np-tab-pill:hover { color: var(--sc-accent-2); background: rgba(var(--sc-accent-rgb), 0.1); }
    #sc-np-tabstrip .sc-np-tab-pill.active {
      background: rgba(var(--sc-accent-rgb), 0.2); border-color: rgba(var(--sc-accent-rgb), 0.4); color: var(--sc-accent-2);
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
    #sc-np-rp-panel::-webkit-scrollbar-thumb { background: rgba(var(--sc-accent-rgb), 0.3); border-radius: 3px; }
    .rp-section-label { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--sc-slate-600); }
    .rp-card {
      background: rgba(var(--sc-white-rgb), 0.03); border: 1px solid rgba(var(--sc-accent-rgb), 0.18);
      border-radius: 8px; padding: 12px 14px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .rp-toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .rp-toggle-label { font-size: 12px; font-weight: 600; color: var(--sc-slate-300); }
    .rp-input {
      width: 100%; box-sizing: border-box;
      background: rgba(var(--sc-black-rgb), 0.3); border: 1px solid rgba(var(--sc-accent-rgb), 0.2);
      border-radius: 6px; color: var(--sc-slate-200); font-size: 12.5px; font-family: inherit;
      padding: 7px 10px; outline: none; transition: border-color 0.15s;
    }
    .rp-input:focus { border-color: rgba(var(--sc-accent-rgb), 0.55); }
    .rp-input::placeholder { color: var(--sc-slate-700); }
    .rp-textarea { resize: vertical; min-height: 78px; line-height: 1.5; caret-color: var(--sc-accent-2); }
    .rp-hint { font-size: 11px; color: var(--sc-slate-600); }
    .rp-autosave {
      display: flex; align-items: center; gap: 4px;
      font-size: 10.5px; color: var(--sc-success);
      opacity: 0; transition: opacity 0.3s; height: 14px;
    }
    .rp-autosave.visible { opacity: 1; }
    .rp-toggle { position: relative; width: 32px; height: 18px; flex-shrink: 0; cursor: pointer; }
    .rp-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
    .rp-toggle-track {
      position: absolute; inset: 0;
      background: rgba(var(--sc-white-rgb), 0.08); border-radius: 100px;
      border: 1px solid rgba(var(--sc-accent-rgb), 0.25);
      transition: background 0.2s, border-color 0.2s;
    }
    .rp-toggle-track::after {
      content: ''; position: absolute; top: 2px; left: 2px;
      width: 12px; height: 12px; background: var(--sc-slate-500); border-radius: 50%;
      transition: transform 0.2s, background 0.2s;
    }
    .rp-toggle input:checked ~ .rp-toggle-track { background: rgba(var(--sc-accent-rgb), 0.35); border-color: rgba(var(--sc-accent-rgb), 0.6); }
    .rp-toggle input:checked ~ .rp-toggle-track::after { transform: translateX(14px); background: var(--sc-accent-2); }
    .sc-rewrite-pill { display:inline-flex; align-items:center; justify-content:center; min-width:36px; padding:3px 9px; border-radius:16px; font-size:11.5px; font-weight:600; cursor:pointer; border:1.5px solid rgba(var(--sc-accent-rgb), 0.3); background:transparent; color:var(--sc-slate-500); transition:background 0.15s,border-color 0.15s,color 0.15s; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:82px; }
    .sc-rewrite-pill:hover { border-color:rgba(var(--sc-accent-rgb), 0.6); color:var(--sc-slate-300); background:rgba(var(--sc-accent-rgb), 0.12); }
    .sc-rewrite-pill.active { background:rgba(var(--sc-accent-rgb), 0.22); border-color:var(--sc-accent); color:var(--sc-accent-2); }
    .rp-rewrite-meta { font-size: 11px; color: var(--sc-slate-500); display: flex; align-items: center; justify-content: space-between; }
    .rp-rewrite-label { font-weight: 600; color: var(--sc-accent-2); }
    .rp-diff-block { display: flex; flex-direction: column; gap: 6px; }
    .rp-diff-before, .rp-diff-after { border-radius: 6px; padding: 8px 10px; font-size: 12px; line-height: 1.5; color: var(--sc-slate-300); }
    .rp-diff-before { background: rgba(var(--sc-danger-rgb), 0.07); border: 1px solid rgba(var(--sc-danger-rgb), 0.18); }
    .rp-diff-after  { background: rgba(var(--sc-success-rgb), 0.07);  border: 1px solid rgba(var(--sc-success-rgb), 0.18); }
    .rp-diff-cap { font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; display: block; margin-bottom: 3px; }
    .rp-diff-before .rp-diff-cap { color: rgba(var(--sc-danger-rgb), 0.55); }
    .rp-diff-after  .rp-diff-cap { color: rgba(var(--sc-success-rgb), 0.55); }
    .rp-diff-text { color: var(--sc-slate-400); font-size: 12px; word-break: break-word; }
    .rp-empty-state { text-align: center; color: var(--sc-slate-700); font-size: 12px; padding: 16px 0; }
    #sc-rp-undo-btn {
      display: flex; align-items: center; justify-content: center; gap: 7px;
      width: 100%; padding: 9px; border-radius: 7px;
      border: 1px solid rgba(var(--sc-accent-rgb), 0.35);
      background: rgba(var(--sc-accent-rgb), 0.12);
      color: var(--sc-accent-2); font-size: 13px; font-weight: 600;
      font-family: inherit; cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    #sc-rp-undo-btn:hover { background: rgba(var(--sc-accent-rgb), 0.22); border-color: rgba(var(--sc-accent-rgb), 0.55); }
    #sc-rp-undo-btn:disabled { opacity: 0.35; cursor: not-allowed; }

    /* ── Input counter ── */
    .rp-counter-stats { font-size: 12.5px; color: var(--sc-slate-700); font-weight: 500; transition: color 0.2s; }
    .rp-counter-stats.active { color: var(--sc-accent-2); }

    /* ── Snippets ── */
    .rp-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0; }
    .rp-section-header .rp-section-label { margin-bottom: 0; }
    .rp-micro-btn { font-size: 10px; font-weight: 700; letter-spacing: 0.04em; color: var(--sc-slate-500); background: none; border: 1px solid rgba(var(--sc-accent-rgb), 0.22); border-radius: 5px; padding: 2px 8px; cursor: pointer; font-family: inherit; transition: color 0.12s, border-color 0.12s, background 0.12s; }
    .rp-micro-btn:hover { color: var(--sc-accent-2); border-color: rgba(var(--sc-accent-rgb), 0.45); }
    .rp-micro-btn.active { color: var(--sc-accent-2); border-color: rgba(var(--sc-accent-rgb), 0.5); background: rgba(var(--sc-accent-rgb), 0.1); }
    .rp-snip-chips { display: flex; flex-wrap: wrap; gap: 6px; min-height: 20px; }
    .rp-snip-chip { padding: 5px 12px; border-radius: 100px; border: 1px solid rgba(var(--sc-accent-rgb), 0.3); background: rgba(var(--sc-accent-rgb), 0.1); color: var(--sc-accent-3); font-size: 11.5px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background 0.12s, border-color 0.12s, transform 0.08s; white-space: nowrap; }
    .rp-snip-chip:hover { background: rgba(var(--sc-accent-rgb), 0.22); border-color: rgba(var(--sc-accent-rgb), 0.55); }
    .rp-snip-chip:active { transform: scale(0.94); }
    .rp-snip-row { display: flex; flex-direction: column; gap: 5px; padding-bottom: 10px; border-bottom: 1px solid rgba(var(--sc-accent-rgb), 0.08); margin-bottom: 10px; }
    .rp-snip-row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .rp-snip-row-num { font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sc-slate-700); }

    /* ── One-shot + shared action button ── */
    .rp-action-btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; border-radius: 6px; border: 1px solid rgba(var(--sc-accent-rgb), 0.3); background: rgba(var(--sc-accent-rgb), 0.12); color: var(--sc-accent-2); font-size: 12px; font-weight: 600; font-family: inherit; cursor: pointer; transition: background 0.12s, border-color 0.12s; flex-shrink: 0; }
    .rp-action-btn:hover:not(:disabled) { background: rgba(var(--sc-accent-rgb), 0.22); border-color: rgba(var(--sc-accent-rgb), 0.5); }
    .rp-action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .rp-status-ok { color: var(--sc-success) !important; }
    .rp-status-err { color: var(--sc-danger-light) !important; }

    /* ── Last Log ── */
    .rp-log-model { font-size: 11px; font-weight: 600; color: var(--sc-accent-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .rp-log-sep { height: 1px; background: rgba(var(--sc-accent-rgb), 0.1); margin: 2px 0; }
    .rp-log-grid { display: flex; flex-direction: column; gap: 3px; }
    .rp-log-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 1px 0; }
    .rp-log-key { font-size: 11px; color: var(--sc-slate-600); }
    .rp-log-val { font-size: 11.5px; font-weight: 600; color: var(--sc-slate-400); font-variant-numeric: tabular-nums; }
    .rp-log-subrow .rp-log-key { padding-left: 10px; color: var(--sc-slate-700); font-size: 10.5px; }
    .rp-log-subrow .rp-log-val { font-size: 10.5px; color: var(--sc-slate-600); }
    .rp-log-total .rp-log-key, .rp-log-total .rp-log-val { color: var(--sc-slate-300); font-size: 12px; }
    .rp-log-text-block { display: flex; flex-direction: column; gap: 4px; }
    .rp-log-text-cap { font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
    .rp-log-text-cap.prompt { color: rgba(var(--sc-accent-2-rgb), 0.55); }
    .rp-log-text-cap.thinking { color: rgba(var(--sc-warning-rgb), 0.55); }
    .rp-log-text-cap.output { color: rgba(var(--sc-success-rgb), 0.55); }
    .rp-log-text-body { font-size: 11.5px; line-height: 1.55; color: var(--sc-slate-500); white-space: pre-wrap; word-break: break-word; max-height: 110px; overflow-y: auto; padding: 7px 9px; border-radius: 5px; }
    .rp-log-text-body.prompt { background: rgba(var(--sc-accent-rgb), 0.06); border: 1px solid rgba(var(--sc-accent-rgb), 0.15); }
    .rp-log-text-body.thinking { background: rgba(var(--sc-warning-rgb), 0.04); border: 1px solid rgba(var(--sc-warning-rgb), 0.15); color: var(--sc-thinking-text); font-style: italic; }
    .rp-log-text-body.output { background: rgba(var(--sc-success-rgb), 0.05); border: 1px solid rgba(var(--sc-success-rgb), 0.14); color: var(--sc-slate-400); }
    .rp-log-text-body::-webkit-scrollbar { width: 4px; }
    .rp-log-text-body::-webkit-scrollbar-track { background: transparent; }
    .rp-log-text-body::-webkit-scrollbar-thumb { background: rgba(var(--sc-accent-rgb), 0.25); border-radius: 2px; }

    /* ── Formatter reference panel ── */
    #sc-np-fmt-panel {
      position: absolute; inset: 0; overflow-y: auto;
      padding: 14px; box-sizing: border-box;
      display: none; flex-direction: column; gap: 10px;
    }
    #sc-np-fmt-panel.visible { display: flex; }
    #sc-np-fmt-panel::-webkit-scrollbar { width: 5px; }
    #sc-np-fmt-panel::-webkit-scrollbar-track { background: transparent; }
    #sc-np-fmt-panel::-webkit-scrollbar-thumb { background: rgba(var(--sc-accent-rgb), 0.3); border-radius: 3px; }

    /* ── Style injection panel ── */
    #sc-np-style-panel {
      position: absolute; inset: 0; overflow-y: auto;
      padding: 14px; box-sizing: border-box;
      display: none; flex-direction: column; gap: 10px;
    }
    #sc-np-style-panel.visible { display: flex; }
    #sc-np-style-panel::-webkit-scrollbar { width: 5px; }
    #sc-np-style-panel::-webkit-scrollbar-track { background: transparent; }
    #sc-np-style-panel::-webkit-scrollbar-thumb { background: rgba(var(--sc-accent-rgb), 0.3); border-radius: 3px; }

    /* ── Text styler panel ── */
    #sc-np-styler-panel {
      position: absolute; inset: 0; overflow-y: auto;
      padding: 14px; box-sizing: border-box;
      display: none; flex-direction: column; gap: 10px;
    }
    #sc-np-styler-panel.visible { display: flex; }
    #sc-np-styler-panel::-webkit-scrollbar { width: 5px; }
    #sc-np-styler-panel::-webkit-scrollbar-track { background: transparent; }
    #sc-np-styler-panel::-webkit-scrollbar-thumb { background: rgba(var(--sc-accent-rgb), 0.3); border-radius: 3px; }
    .style-feature-row {
      display: flex; flex-direction: column; gap: 6px;
      padding: 10px 0; border-bottom: 1px solid rgba(var(--sc-accent-rgb), 0.07);
    }
    .style-feature-row:last-child { border-bottom: none; }
    .style-feature-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .style-feature-name { font-size: 12.5px; font-weight: 600; color: var(--sc-slate-300); }
    .style-feature-desc { font-size: 11px; color: var(--sc-slate-600); line-height: 1.5; }
    .style-feature-note { font-size: 10px; color: var(--sc-slate-700); font-style: italic; }
    .fmt-master-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .fmt-master-badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 100px; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; }
    .fmt-master-badge.on { background: rgba(var(--sc-success-rgb), 0.15); color: var(--sc-success); border: 1px solid rgba(var(--sc-success-rgb), 0.3); }
    .fmt-master-badge.off { background: rgba(var(--sc-slate-500-rgb), 0.1); color: var(--sc-slate-500); border: 1px solid rgba(var(--sc-slate-500-rgb), 0.2); }
    .fmt-meta-row { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; font-size: 11px; color: var(--sc-slate-600); }
    .fmt-meta-chip { background: rgba(var(--sc-accent-rgb), 0.1); border: 1px solid rgba(var(--sc-accent-rgb), 0.2); border-radius: 5px; padding: 2px 7px; font-size: 10.5px; color: var(--sc-accent-2); font-family: ui-monospace, monospace; font-weight: 600; }
    .fmt-row { display: flex; align-items: flex-start; gap: 8px; padding: 7px 0; border-bottom: 1px solid rgba(var(--sc-accent-rgb), 0.07); transition: opacity 0.15s; }
    .fmt-row:last-child { border-bottom: none; }
    .fmt-row.off { opacity: 0.32; }
    .fmt-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }
    .fmt-dot.on { background: var(--sc-success); box-shadow: 0 0 5px rgba(var(--sc-success-rgb), 0.45); }
    .fmt-dot.off { background: var(--sc-slate-700); }
    .fmt-row-body { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
    .fmt-row-name { font-size: 11.5px; color: var(--sc-slate-300); font-weight: 500; line-height: 1.3; }
    .fmt-example { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
    .fmt-ex-before, .fmt-ex-after { font-size: 10px; padding: 1px 6px; border-radius: 3px; font-family: ui-monospace, monospace; white-space: pre; line-height: 1.6; }
    .fmt-ex-before { background: rgba(var(--sc-danger-rgb), 0.08); color: var(--sc-danger-light); border: 1px solid rgba(var(--sc-danger-rgb), 0.18); }
    .fmt-ex-after { background: rgba(var(--sc-success-rgb), 0.08); color: var(--sc-success-light); border: 1px solid rgba(var(--sc-success-rgb), 0.18); }
    .fmt-ex-arrow { color: var(--sc-slate-700); font-size: 10px; flex-shrink: 0; line-height: 1.6; }
    .fmt-disabled-notice { background: rgba(var(--sc-danger-rgb), 0.06); border: 1px solid rgba(var(--sc-danger-rgb), 0.2); border-radius: 7px; padding: 9px 12px; font-size: 11px; color: var(--sc-danger-light); text-align: center; }
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
          <!-- System Message -->
          <div class="ql-section-header" style="margin-top:4px;">
            <span class="ql-section-label">System Message</span>
          </div>
          <div class="ql-thought-row">
            <select id="sc-np-sysmsg-category" class="stat-select" style="flex:0 0 104px;" data-ai-rewriter-ignore="1">
              <option value="Scene">Scene</option>
              <option value="Time Skip">Time Skip</option>
              <option value="Status">Status</option>
              <option value="Event">Event</option>
              <option value="Combat">Combat</option>
              <option value="Note">Note</option>
            </select>
            <input id="sc-np-sysmsg-input" type="text" class="ql-thought-input" placeholder="System message text…" maxlength="240" data-ai-rewriter-ignore="1" />
            <button id="sc-np-sysmsg-insert-btn" class="ql-copy-btn">⎘ Insert</button>
          </div>
          <!-- AI Generator -->
          <div class="ql-section-header" style="margin-top:4px;">
            <span class="ql-section-label">Generator</span>
          </div>
          <div class="rp-card gen-card">
            <div class="gen-type-row">
              <button type="button" class="gen-type-btn active" data-gen-type="character">🧑 Character</button>
              <button type="button" class="gen-type-btn" data-gen-type="location">🗺️ Location</button>
              <button type="button" class="gen-type-btn" data-gen-type="item">🎒 Item</button>
              <button type="button" class="gen-type-btn" data-gen-type="equipment">⚔️ Equipment</button>
              <button type="button" class="gen-type-btn" data-gen-type="creature">🐉 Creature</button>
              <button type="button" class="gen-type-btn" data-gen-type="faction">🏴 Faction</button>
            </div>
            <input id="sc-np-gen-seed" type="text" class="af-input" placeholder="Name or idea (optional)…" maxlength="120" data-ai-rewriter-ignore="1" />
            <input id="sc-np-gen-flavor" type="text" class="af-input" placeholder="Style / flavor (optional)… e.g. elven, dwarvish, noir, German-sounding" maxlength="80" data-ai-rewriter-ignore="1" />
            <div class="gen-actions-row">
              <button id="sc-np-gen-run" class="rp-action-btn">✨ Generate</button>
              <span id="sc-np-gen-status" class="gen-status"></span>
            </div>
            <div id="sc-np-gen-result" class="gen-result" style="display:none;">
              <div id="sc-np-gen-result-text" class="gen-result-text"></div>
              <div class="gen-result-actions">
                <button id="sc-np-gen-insert" class="ql-copy-btn">⎘ Insert</button>
                <button id="sc-np-gen-regen" class="rp-action-btn">↻ Regenerate</button>
              </div>
            </div>
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
                <div class="abl-rest-detail-row">
                  <span class="abl-rest-detail-label">Detailed rest log — list every ability</span>
                  <label class="abl-rest-toggle">
                    <input type="checkbox" id="sc-np-abl-rest-detailed" data-ai-rewriter-ignore="1" />
                    <span class="abl-rest-toggle-track"></span>
                  </label>
                </div>
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
            <div class="rp-hint" style="margin-bottom:8px;">Ten saved rewrite presets. Tap a slot to make it active — Ctrl+N (or Run) applies the active preset to the focused chat input.</div>
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
