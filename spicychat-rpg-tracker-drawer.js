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
    const layoutFactory = window.SCRPGTrackerLayout || {};
    if (
      typeof layoutFactory.getDrawerStyles !== "function" ||
      typeof layoutFactory.getDrawerMarkup !== "function"
    ) {
      throw new Error("RPG tracker layout module failed to load.");
    }

    const style = document.createElement("style");
    style.textContent = layoutFactory.getDrawerStyles(DEFAULT_W);
    style.id = "sc-np-style";
    document.head.appendChild(style);

    /* ── DOM ── */
    const drawer = document.createElement("div");
    drawer.id = "sc-np";
    drawer.innerHTML = layoutFactory.getDrawerMarkup();

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

    /* ── RP tools module ── */
    const rpToolsFactory = window.SCRPGTrackerRpTools || {};
    if (typeof rpToolsFactory.createRpToolsModule !== "function") {
      throw new Error("RPG tracker RP tools module failed to load.");
    }
    rpToolsFactory.createRpToolsModule({
      signal: _ac.signal,
      rewriteCtxKey: STORAGE_KEYS.rewriteCtx,
      autoResizeTextarea,
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

    /* ════════════════ ACTIVITY LOG + EXPORTS MODULE ════════════════ */
    const activityFactory = window.SCRPGTrackerActivityExports || {};
    if (typeof activityFactory.createActivityExports !== "function") {
      throw new Error("RPG tracker activity/export module failed to load.");
    }

    const activityExports = activityFactory.createActivityExports({
      maxLog: 10,
      getQuests: () => quests,
      getResources: () => resources,
      getAbilities: () => abilities,
      getParty: () => party,
      getNpcs: () => npcs,
      getRumours: () => rumours,
    });

    function flashCopyBtnLabel(btn) {
      activityExports.flashCopyBtnLabel(btn);
    }

    function addLog(msg) {
      activityExports.addLog(msg);
    }

    function bindExportButtons() {
      activityExports.bindExportButtons();
    }

    function bindDiceExportButton() {
      activityExports.bindDiceExportButton();
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
