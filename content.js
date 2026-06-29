// content.js — Injected into every page
// Runs local formatter everywhere; AI rewrites are gated to SpicyChat only

(function () {
  "use strict";

  let apiKey = "";
  let model = "";
  let formatterEnabled = true;
  let autoFormatAfterRewrite = true;
  let fmtStripAsterisks = true;
  let fmtNormaliseQuotes = true;
  let fmtNormaliseApostrophes = true;
  let fmtNormaliseEllipsis = true;
  let fmtCollapseSpaces = true;
  let fmtCapitaliseI = true;
  let fmtTrimLines = true;
  let fmtNormaliseNewlines = true;
  let fmtCapitaliseSentences = true;
  let fmtPreserveLists = true;
  let fmtUnwrapBrackets = true;
  let fmtExtraDelimiters = "";
  let fmtRepairAsterisks = true;
  let fmtOocBrackets = true;
  let fmtActionPunctuation = true;
  let fmtCapitaliseQuotes = true;
  let fmtEmDash = true;
  let fmtNoSpaceBeforePunct = true;
  let fmtSpaceAfterPunct = true;
  let rpPersonas = Array.from({ length: 10 }, () => ({
    label: "",
    name: "",
    description: "",
    personality: "",
  }));
  let rpActivePersonaIndex = -1;
  let rpRewrites = Array.from({ length: 5 }, () => ({ name: "", prompt: "" }));
  let rpActiveRewriteIndex = -1;
  let lastRewrite = null; // { el, before, after, label, ts }
  let lastFocusedEl = null; // last focused SpicyChat input
  let fmtShortcut = "m"; // keyboard shortcut key for format (Ctrl+key)
  let fmtNoTrackerShortcut = "m"; // keyboard shortcut key for no-tracker format (Ctrl+Shift+key)
  let scMdTables = true;
  let scBracketEmphasis = true;
  let scBracketPipeNewline = true;
  let scActionStyle = true;
  let scDialogueStyle = true;
  let scBoldStyle = true;
  let scBulletStyle = true;
  let scBlockquoteStyle = true;
  let scNumberedListStyle = true;
  let scSeparatorStyle = true;
  const isSpicyChat = location.hostname.includes("spicychat.ai");
  const REWRITE_SHORTCUT_KEY = "n";
  const SYNC_SETTINGS_KEYS = [
    "apiKey",
    "model",
    "formatterEnabled",
    "autoFormatAfterRewrite",
    "fmtStripAsterisks",
    "fmtNormaliseQuotes",
    "fmtNormaliseApostrophes",
    "fmtNormaliseEllipsis",
    "fmtCollapseSpaces",
    "fmtCapitaliseI",
    "fmtTrimLines",
    "fmtNormaliseNewlines",
    "fmtCapitaliseSentences",
    "fmtPreserveLists",
    "fmtUnwrapBrackets",
    "fmtExtraDelimiters",
    "fmtRepairAsterisks",
    "fmtOocBrackets",
    "fmtActionPunctuation",
    "fmtCapitaliseQuotes",
    "fmtEmDash",
    "fmtNoSpaceBeforePunct",
    "fmtSpaceAfterPunct",
    "rpPersonas",
    "rpActivePersonaIndex",
    "rpPersonaEnabled",
    "rpPersonaName",
    "rpPersonaPrepend",
    "rpRewrites",
    "rpActiveRewriteIndex",
    "fmtShortcut",
    "fmtNoTrackerShortcut",
    "scMdTables",
    "scBracketEmphasis",
    "scBracketPipeNewline",
    "scActionStyle",
    "scDialogueStyle",
    "scBoldStyle",
    "scBulletStyle",
    "scBlockquoteStyle",
    "scNumberedListStyle",
    "scSeparatorStyle",
  ];
  const SYNC_SETTINGS_KEY_SET = new Set(SYNC_SETTINGS_KEYS);
  let settingsReloadTimer = null;

  function scheduleSettingsReload(delayMs = 50) {
    clearTimeout(settingsReloadTimer);
    settingsReloadTimer = setTimeout(() => {
      settingsReloadTimer = null;
      loadSettings();
    }, delayMs);
  }

  // Load settings from storage
  function loadSettings() {
    chrome.storage.sync.get(SYNC_SETTINGS_KEYS, (data) => {
      apiKey = data.apiKey || "";
      model = data.model || "openrouter/free";
      formatterEnabled = data.formatterEnabled !== false;
      autoFormatAfterRewrite = data.autoFormatAfterRewrite !== false;
      fmtStripAsterisks = data.fmtStripAsterisks !== false;
      fmtNormaliseQuotes = data.fmtNormaliseQuotes !== false;
      fmtNormaliseApostrophes = data.fmtNormaliseApostrophes !== false;
      fmtNormaliseEllipsis = data.fmtNormaliseEllipsis !== false;
      fmtCollapseSpaces = data.fmtCollapseSpaces !== false;
      fmtCapitaliseI = data.fmtCapitaliseI !== false;
      fmtTrimLines = data.fmtTrimLines !== false;
      fmtNormaliseNewlines = data.fmtNormaliseNewlines !== false;
      fmtCapitaliseSentences = data.fmtCapitaliseSentences !== false;
      fmtPreserveLists = data.fmtPreserveLists !== false;
      fmtUnwrapBrackets = data.fmtUnwrapBrackets !== false;
      fmtExtraDelimiters = data.fmtExtraDelimiters || "";
      fmtRepairAsterisks = data.fmtRepairAsterisks !== false;
      fmtOocBrackets = data.fmtOocBrackets !== false;
      fmtActionPunctuation = data.fmtActionPunctuation !== false;
      fmtCapitaliseQuotes = data.fmtCapitaliseQuotes !== false;
      fmtEmDash = data.fmtEmDash !== false;
      fmtNoSpaceBeforePunct = data.fmtNoSpaceBeforePunct !== false;
      fmtSpaceAfterPunct = data.fmtSpaceAfterPunct !== false;
      if (Array.isArray(data.rpPersonas) && data.rpPersonas.length > 0) {
        rpPersonas = data.rpPersonas.slice(0, 10).map((p) => ({
          label: p.label || "",
          name: p.name || "",
          description: p.description || p.prepend || "",
          personality: p.personality || "",
        }));
        while (rpPersonas.length < 10)
          rpPersonas.push({
            label: "",
            name: "",
            description: "",
            personality: "",
          });
        rpActivePersonaIndex =
          typeof data.rpActivePersonaIndex === "number"
            ? data.rpActivePersonaIndex
            : -1;
      } else {
        // Migrate old single-persona storage
        rpPersonas[0] = {
          label: data.rpPersonaName || "Persona 1",
          name: data.rpPersonaName || "",
          description: data.rpPersonaPrepend || "",
          personality: "",
        };
        rpActivePersonaIndex = data.rpPersonaEnabled === true ? 0 : -1;
      }
      if (Array.isArray(data.rpRewrites) && data.rpRewrites.length > 0) {
        rpRewrites = data.rpRewrites.slice(0, 5).map((r) => ({
          name: r.name || "",
          prompt: r.prompt || "",
        }));
        while (rpRewrites.length < 5) rpRewrites.push({ name: "", prompt: "" });
      }
      rpActiveRewriteIndex =
        typeof data.rpActiveRewriteIndex === "number"
          ? data.rpActiveRewriteIndex
          : -1;
      fmtShortcut = data.fmtShortcut || "m";
      fmtNoTrackerShortcut = data.fmtNoTrackerShortcut || "m";
      scMdTables = data.scMdTables !== false;
      scBracketEmphasis = data.scBracketEmphasis !== false;
      scBracketPipeNewline = data.scBracketPipeNewline !== false;
      document.querySelectorAll(".ai-bracket-scene[data-bracket-raw]").forEach((s) => {
        s.textContent = scBracketPipeNewline
          ? s.dataset.bracketRaw.replace(/ \| /g, "\n")
          : s.dataset.bracketRaw;
      });
      scActionStyle = data.scActionStyle !== false;
      scDialogueStyle = data.scDialogueStyle !== false;
      scBoldStyle = data.scBoldStyle !== false;
      scBulletStyle = data.scBulletStyle !== false;
      scBlockquoteStyle = data.scBlockquoteStyle !== false;
      scNumberedListStyle = data.scNumberedListStyle !== false;
      scSeparatorStyle = data.scSeparatorStyle !== false;
      if (isSpicyChat) {
        document.documentElement.classList.toggle(
          "sc-inject-brackets-hidden",
          !scBracketEmphasis,
        );
        document.documentElement.classList.toggle("sc-style-actions", scActionStyle);
        document.documentElement.classList.toggle("sc-style-dialogue", scDialogueStyle);
        document.documentElement.classList.toggle("sc-style-bold", scBoldStyle);
        document.documentElement.classList.toggle("sc-style-bullets", scBulletStyle);
        document.documentElement.classList.toggle("sc-style-blockquote", scBlockquoteStyle);
        document.documentElement.classList.toggle("sc-style-numbered", scNumberedListStyle);
        document.documentElement.classList.toggle("sc-style-separator", scSeparatorStyle);
        if (scMdTables) mountAiMessageMarkdown();
        if (scBracketEmphasis) mountAiMessageBrackets();
      }
    });
  }

  loadSettings();

  // Re-load if settings change (e.g. user saves options)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync" || !changes) return;
    const hasRelevantChange = Object.keys(changes).some((key) =>
      SYNC_SETTINGS_KEY_SET.has(key),
    );
    if (hasRelevantChange) scheduleSettingsReload();
  });

  // ─── Overlay / indicator helpers ───────────────────────────────────────────

  let activeOverlay = null;

  function createOverlay(targetEl) {
    removeOverlay();
    const rect = targetEl.getBoundingClientRect();
    const overlay = document.createElement("div");
    overlay.className = "ai-rewriter-overlay";
    overlay.innerHTML = `
      <div class="ai-rewriter-spinner"></div>
      <span>Rewriting…</span>
    `;

    // Position over the element
    Object.assign(overlay.style, {
      position: "fixed",
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      zIndex: "2147483647",
      pointerEvents: "none",
    });

    document.body.appendChild(overlay);
    activeOverlay = overlay;
    targetEl.classList.add("ai-rewriter-loading");
    return overlay;
  }

  function removeOverlay(targetEl) {
    if (activeOverlay) {
      activeOverlay.remove();
      activeOverlay = null;
    }
    if (targetEl) targetEl.classList.remove("ai-rewriter-loading");
  }

  // ─── Toast notification ─────────────────────────────────────────────────────

  function showToast(message, isError = false) {
    const existing = document.querySelector(".ai-rewriter-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = `ai-rewriter-toast${isError ? " ai-rewriter-toast-error" : ""}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() =>
      toast.classList.add("ai-rewriter-toast-visible"),
    );

    setTimeout(() => {
      toast.classList.remove("ai-rewriter-toast-visible");
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  // ─── Text replacement ──────────────────────────────────────────────────────

  function replaceText(el, newText) {
    if (el.isContentEditable) {
      el.innerText = newText;
      // Move cursor to end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      el.value = newText;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      // Move cursor to end
      el.selectionStart = el.selectionEnd = newText.length;
    }
  }

  function getSpicyChatChatId() {
    if (!isSpicyChat) return "";
    return location.pathname.replace(/^\/chat\//, "").replace(/\/$/, "");
  }

  function getSpicyChatStorageKeys(chatId) {
    return {
      stats: "sc_stats_v1_" + chatId,
      party: "sc_party_v1_" + chatId,
      resources: "sc_res_v1_" + chatId,
      rewriteCtx: "sc_rpctx_v1_" + chatId,
    };
  }

  function formatPartyStatusLabel(status) {
    const raw = String(status || "").trim();
    if (!raw) return "Healthy";
    const s = raw.toLowerCase();
    if (s === "healthy" || s === "active") return "Healthy";
    if (s === "downed") return "Downed";
    if (s === "dead") return "Dead";
    if (s === "absent") return "Absent";
    return raw;
  }

  function hasTrackerHeaderAtTop(text) {
    if (!text) return false;
    // Matches both legacy multi-line [TRACKER] and new single-line [TRACKER | ...]
    return /^\s*\[TRACKER(?:\]|\s*\|)/.test(String(text));
  }

  function formatResourceValue(raw) {
    return window.AIRewriterContentUtils?.formatResourceValue(raw) ?? String(raw ?? "");
  }

  function buildTrackerSummaryForFormat(done) {
    if (!isSpicyChat) {
      done("");
      return;
    }
    const chatId = getSpicyChatChatId();
    if (!chatId) {
      done("");
      return;
    }

    const keys = getSpicyChatStorageKeys(chatId);
    chrome.storage.local.get([keys.stats, keys.party, keys.resources], (data) => {
      const stats = Array.isArray(data[keys.stats]) ? data[keys.stats] : [];
      const party = Array.isArray(data[keys.party]) ? data[keys.party] : [];
      const resources = Array.isArray(data[keys.resources])
        ? data[keys.resources]
        : [];
      const parts = [];

      // Stats — first, name: value (notes)
      stats.forEach((s) => {
        const name = String(s?.name || "").trim() || "(unnamed)";
        const value = String(s?.value ?? "").trim() || "—";
        const notes = String(s?.notes || "").trim();
        parts.push(notes ? `${name}: ${value} (${notes})` : `${name}: ${value}`);
      });

      // Party members — all fields packed into parentheses, pipe-separated
      party.forEach((m) => {
        const name = String(m?.name || "").trim() || "(unnamed)";
        const notes = String(m?.notes || "").trim();
        const equipment = String(m?.equipment || "").trim();
        const affiliation = String(m?.affiliation || "").trim();
        const detail = [formatPartyStatusLabel(m?.status)];
        if (equipment) detail.push(`equip: ${equipment}`);
        if (affiliation) detail.push(`aff: ${affiliation}`);
        if (notes) detail.push(notes);
        parts.push(`${name} (${detail.join("; ")})`);
      });

      // Resources — formatted value with thousand separators / compact suffix
      resources.forEach((r) => {
        const name = String(r?.name || "").trim() || "(unnamed)";
        const value = formatResourceValue(r?.value);
        const notes = String(r?.notes || "").trim();
        parts.push(notes ? `${name}: ${value} (${notes})` : `${name}: ${value}`);
      });

      done(parts.length ? `[TRACKER | ${parts.join(" | ")}]` : "");
    });
  }

  // ─── Text formatter (no AI) ─────────────────────────────────────────────────

  function formatText(text) {
    const utils = window.AIRewriterContentUtils;
    if (!utils || typeof utils.formatText !== "function") {
      return text;
    }
    return utils.formatText(text, {
      fmtStripAsterisks,
      fmtNormaliseQuotes,
      fmtNormaliseApostrophes,
      fmtNormaliseEllipsis,
      fmtCollapseSpaces,
      fmtCapitaliseI,
      fmtTrimLines,
      fmtNormaliseNewlines,
      fmtCapitaliseSentences,
      fmtPreserveLists,
      fmtUnwrapBrackets,
      fmtExtraDelimiters,
      fmtRepairAsterisks,
      fmtOocBrackets,
      fmtActionPunctuation,
      fmtCapitaliseQuotes,
      fmtEmDash,
      fmtNoSpaceBeforePunct,
      fmtSpaceAfterPunct,
    });
  }

  // ─── Format overlay ──────────────────────────────────────────────────────────

  let formatOverlay = null;

  function createFormatOverlay(targetEl) {
    removeFormatOverlay();
    const rect = targetEl.getBoundingClientRect();
    const overlay = document.createElement("div");
    overlay.className = "ai-formatter-overlay";
    overlay.innerHTML = `
      <div class="ai-formatter-spinner"></div>
      <span>Formatting…</span>
    `;
    Object.assign(overlay.style, {
      position: "fixed",
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      zIndex: "2147483647",
      pointerEvents: "none",
    });
    document.body.appendChild(overlay);
    formatOverlay = overlay;
    targetEl.classList.add("ai-formatter-loading");
  }

  function removeFormatOverlay(targetEl) {
    if (formatOverlay) {
      formatOverlay.remove();
      formatOverlay = null;
    }
    if (targetEl) targetEl.classList.remove("ai-formatter-loading");
  }

  function handleFormat(el, textOverride, opts = {}) {
    const includeTrackerSummary = opts.includeTrackerSummary !== false;
    const original =
      textOverride !== undefined
        ? textOverride
        : el.isContentEditable
          ? el.innerText || el.textContent || ""
          : el.value || "";
    if (!original.trim()) return;
    createFormatOverlay(el);
    const formatted = formatText(original);
    setTimeout(() => {
      if (!includeTrackerSummary) {
        replaceText(el, formatted);
        removeFormatOverlay(el);
        showToast("✓ Formatted (no tracker)");
        return;
      }
      buildTrackerSummaryForFormat((summary) => {
        const hasExistingTracker = hasTrackerHeaderAtTop(formatted);
        const shouldPrependSummary = !!summary && !hasExistingTracker;
        const finalText = shouldPrependSummary
          ? `${summary}\n\n${formatted}`
          : formatted;
        replaceText(el, finalText);
        removeFormatOverlay(el);
        if (shouldPrependSummary) {
          showToast("✓ Formatted + tracker summary");
        } else if (summary && hasExistingTracker) {
          showToast("✓ Formatted (tracker already present)");
        } else {
          showToast("✓ Formatted");
        }
      });
    }, 250);
  }

  // ─── Rewrite prompt builder ──────────────────────────────────────────────

  function getSceneContext() {
    return new Promise((resolve) => {
      const chatId = getSpicyChatChatId();
      if (!chatId) {
        resolve({});
        return;
      }
      const keys = getSpicyChatStorageKeys(chatId);
      chrome.storage.local.get(keys.rewriteCtx, (d) => {
        const c = d[keys.rewriteCtx];
        resolve(c && typeof c === "object" ? c : {});
      });
    });
  }

  async function buildRewritePrompt(presetPrompt) {
    const utils = window.AIRewriterContentUtils;
    if (!utils || typeof utils.composeRewritePrompt !== "function") {
      return presetPrompt;
    }

    const persona =
      rpActivePersonaIndex >= 0 && rpActivePersonaIndex < rpPersonas.length
        ? rpPersonas[rpActivePersonaIndex]
        : null;
    const sceneContext = await getSceneContext();
    return utils.composeRewritePrompt({
      presetPrompt,
      persona,
      sceneContext,
    });
  }

  // ─── Input stats for RP Tools (SpicyChat) ────────────────────────────────

  function dispatchInputStats(el) {
    const text = el.isContentEditable
      ? el.innerText || el.textContent || ""
      : el.value || "";
    const chars = text.length;
    const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
    document.dispatchEvent(
      new CustomEvent("sc-rp-input-stats", { detail: { chars, words } }),
    );
  }

  // ─── Event listeners ────────────────────────────────────────────────────────

  function onInput(e) {
    const el = e.target;
    if (!isEditableElement(el)) return;
    if (isSpicyChat) dispatchInputStats(el);
  }

  function isEditableElement(el) {
    if (!el) return false;
    if (el.dataset.aiRewriterIgnore) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName?.toLowerCase();
    if (tag === "textarea") return true;
    if (tag === "input") {
      const type = (el.type || "text").toLowerCase();
      return ["text", "search", "email", "url", "tel", ""].includes(type);
    }
    return false;
  }

  document.addEventListener("input", onInput, true);

  // ─── Focused-input tracking (SpicyChat) ────────────────────────────────────

  document.addEventListener(
    "focusin",
    (e) => {
      if (isEditableElement(e.target) && isSpicyChat) {
        lastFocusedEl = e.target;
        dispatchInputStats(e.target);
      }
    },
    true,
  );

  document.addEventListener(
    "focusout",
    (e) => {
      if (isSpicyChat && isEditableElement(e.target)) {
        setTimeout(() => {
          const active = document.activeElement;
          const drawer = document.getElementById("sc-np");
          if (
            !isEditableElement(active) &&
            !(drawer && drawer.contains(active))
          ) {
            document.dispatchEvent(new CustomEvent("sc-rp-input-blur"));
          }
        }, 200);
      }
    },
    true,
  );

  function matchShortcut(e, key, requireShift) {
    if (!key) return false;
    return (
      e.ctrlKey &&
      e.shiftKey === requireShift &&
      !e.altKey &&
      !e.metaKey &&
      e.key.toLowerCase() === key.toLowerCase()
    );
  }

  function getShortcutAction(e) {
    if (matchShortcut(e, fmtNoTrackerShortcut, true)) return "formatNoTracker";
    if (matchShortcut(e, fmtShortcut, false)) return "format";
    if (
      isSpicyChat &&
      matchShortcut(e, REWRITE_SHORTCUT_KEY, false) &&
      (!fmtShortcut || fmtShortcut.toLowerCase() !== REWRITE_SHORTCUT_KEY)
    ) {
      return "rewrite";
    }
    return null;
  }

  async function runRewrite(index) {
    if (!isSpicyChat) return;
    const preset = rpRewrites[index];
    if (!preset || !preset.prompt || !preset.prompt.trim()) {
      document.dispatchEvent(
        new CustomEvent("sc-rp-rewrite-result", {
          detail: { error: "This Rewrite has no prompt yet." },
        }),
      );
      showToast("Add a prompt to this Rewrite first.", true);
      return;
    }
    if (!lastFocusedEl || !document.contains(lastFocusedEl)) {
      document.dispatchEvent(
        new CustomEvent("sc-rp-rewrite-result", {
          detail: {
            error: "No input focused — click inside the chat box first.",
          },
        }),
      );
      return;
    }
    const el = lastFocusedEl;
    const rawText = el.isContentEditable
      ? el.innerText || el.textContent || ""
      : el.value || "";
    const trimmed = rawText.trim();
    if (!trimmed) {
      document.dispatchEvent(
        new CustomEvent("sc-rp-rewrite-result", {
          detail: { error: "Input is empty." },
        }),
      );
      return;
    }
    const label = (preset.name && preset.name.trim()) || "Rewrite";
    createOverlay(el);
    const startTime = Date.now();
    try {
      const builtPrompt = await buildRewritePrompt(preset.prompt);
      const result = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: "REWRITE_TEXT",
            text: trimmed,
            prompt: builtPrompt,
            apiKey,
            model,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (response.success) {
              resolve(response);
            } else {
              reject(new Error(response.error));
            }
          },
        );
      });
      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
      let finalText = result.text;
      if (autoFormatAfterRewrite && formatterEnabled)
        finalText = formatText(result.text);
      replaceText(el, finalText);
      const rewriteDetail = {
        before: trimmed,
        after: finalText,
        label,
        ts: Date.now(),
        model: result.model || model,
        usage: result.usage || null,
        elapsed: parseFloat(elapsedSec),
        promptText: builtPrompt,
        reasoning: result.reasoning || null,
      };
      lastRewrite = { el, ...rewriteDetail };
      chrome.storage.local.set({ sc_last_rewrite: rewriteDetail });
      document.dispatchEvent(
        new CustomEvent("sc-rp-rewrite-done", { detail: rewriteDetail }),
      );
      const modelShort = (result.model || model || "unknown").split("/").pop();
      document.dispatchEvent(
        new CustomEvent("sc-rp-rewrite-result", {
          detail: { ok: true, elapsed: elapsedSec, model: modelShort, label },
        }),
      );
      showToast(`✓ ${label} · ${modelShort} · ${elapsedSec}s`);
    } catch (err) {
      replaceText(el, trimmed);
      document.dispatchEvent(
        new CustomEvent("sc-rp-rewrite-result", {
          detail: { error: err.message },
        }),
      );
      showToast(`✗ ${label} — ${err.message}`, true);
    } finally {
      removeOverlay(el);
    }
  }

  // ─── Keyboard shortcuts (format + rewrite) ────────────────────────────────────

  document.addEventListener(
    "keydown",
    (e) => {
      if (!isEditableElement(document.activeElement)) return;
      const action = getShortcutAction(e);
      if (!action) return;
      e.preventDefault();
      if (action === "formatNoTracker") {
        handleFormat(document.activeElement, undefined, {
          includeTrackerSummary: false,
        });
        return;
      }
      if (action === "format") {
        handleFormat(document.activeElement);
        return;
      }
      if (action === "rewrite") {
        if (e.repeat) return;
        if (rpActiveRewriteIndex < 0) {
          showToast("Pick an active Rewrite in RP Tools first.", true);
          return;
        }
        runRewrite(rpActiveRewriteIndex);
      }
    },
    true,
  );

  // ─── Rewrite undo (triggered by RP Tools drawer) ────────────────────────────

  document.addEventListener("sc-rp-undo", () => {
    if (!lastRewrite) return;
    if (!document.contains(lastRewrite.el)) {
      showToast("\u21a9 Element no longer in page — can't undo", true);
      lastRewrite = null;
      chrome.storage.local.remove("sc_last_rewrite");
      document.dispatchEvent(new CustomEvent("sc-rp-undo-done"));
      return;
    }
    replaceText(lastRewrite.el, lastRewrite.before);
    showToast("\u21a9 Undone");
    lastRewrite = null;
    chrome.storage.local.remove("sc_last_rewrite");
    document.dispatchEvent(new CustomEvent("sc-rp-undo-done"));
  });

  document.addEventListener("sc-rp-inject", (e) => {
    if (!isSpicyChat) return;
    const silent = !!e.detail.silent;
    if (!lastFocusedEl || !document.contains(lastFocusedEl)) {
      if (!silent)
        showToast("Click the chat input first, then inject a snippet.", true);
      return;
    }
    const text = e.detail.text || "";
    if (!text) return;
    const el = lastFocusedEl;
    if (el.isContentEditable) {
      el.focus();
      const existing = (el.innerText || el.textContent || "").trimEnd();
      const insert = existing ? text : text.replace(/^\n+/, "");
      el.innerText = existing ? existing + insert : insert;
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      el.focus();
      const existing = (el.value || "").trimEnd();
      const insert = existing ? text : text.replace(/^\n+/, "");
      el.value = existing ? existing + insert : insert;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.selectionStart = el.selectionEnd = el.value.length;
    }
    if (!silent) showToast("✓ Snippet inserted");
  });

  // ─── Rewrite (triggered by RP Tools drawer) ─────────────────────────────────

  document.addEventListener("sc-rp-run-rewrite", async (e) => {
    const idx =
      typeof e?.detail?.index === "number"
        ? e.detail.index
        : rpActiveRewriteIndex;
    if (idx < 0 || idx >= rpRewrites.length) {
      showToast("Pick an active Rewrite first.", true);
      return;
    }
    await runRewrite(idx);
  });

  // ─── SpicyChat AI-message quick action: send message to Previous Scene ─────

  function parseSceneBracket(text) {
    const m = String(text || "").match(/\[([^\[\]]*\|[^\[\]]*)\]/);
    if (!m) return null;
    const parts = m[1].split("|").map((s) => s.trim());
    if (parts.length < 2) return null;
    return {
      status: parts[0] || "",
      location: parts[1] || "",
      clothes: parts.length >= 4 ? parts[3] : "",
    };
  }

  function getMessageTextForScene(messageRoot) {
    const lines = Array.from(messageRoot.querySelectorAll("span.leading-6"))
      .map((el) => (el.innerText || el.textContent || "").trim())
      .filter(Boolean);
    return lines.join("\n").trim();
  }

  function saveSceneContextFromMessage(sceneText) {
    return new Promise((resolve) => {
      const chatId = getSpicyChatChatId();
      if (!chatId) {
        resolve({ ok: false, changed: [] });
        return;
      }
      const key = getSpicyChatStorageKeys(chatId).rewriteCtx;
      chrome.storage.local.get(key, (d) => {
        const current = d && d[key] && typeof d[key] === "object" ? d[key] : {};
        const next = {
          prevScene: sceneText,
          context: current.context || "",
          location: current.location || "",
          clothes: current.clothes || "",
          status: current.status || "",
          dialogueStyle: current.dialogueStyle || "",
        };

        const parsed = parseSceneBracket(sceneText);
        const changed = [];
        if (parsed) {
          if (parsed.status) {
            next.status = parsed.status;
            changed.push("status");
          }
          if (parsed.location) {
            next.location = parsed.location;
            changed.push("location");
          }
          if (parsed.clothes) {
            next.clothes = parsed.clothes;
            changed.push("clothes");
          }
        }

        chrome.storage.local.set({ [key]: next }, () => {
          // Keep the drawer UI in sync if it is mounted.
          document.dispatchEvent(
            new CustomEvent("sc-rp-set-prev-scene", {
              detail: { text: sceneText },
            }),
          );
          resolve({ ok: true, changed });
        });
      });
    });
  }

  function isAiMessageBlock(messageRoot) {
    if (!messageRoot) return false;
    const hasVoiceBtn = !!messageRoot.querySelector(
      'button[aria-label="Volume2-button"]',
    );
    const hasBotLink = !!messageRoot.querySelector('a[href^="/chatbot/"]');
    return hasVoiceBtn && hasBotLink;
  }

  // ─── Markdown rendering in AI messages ─────────────────────────────────────

  function escapeHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function buildMarkdownTable(lines) {
    const rows = [];
    let pastSeparator = false;

    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("|")) continue;
      if (/^\|[\s\-:|]+\|$/.test(t)) {
        pastSeparator = true;
        continue;
      }
      const cells = t
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim());
      rows.push({ cells, isHead: !pastSeparator });
    }

    if (rows.length < 2) return null;

    const heads = rows.filter((r) => r.isHead);
    const body = rows.filter((r) => !r.isHead);

    let html = '<table class="ai-md-table">';
    if (heads.length) {
      html +=
        "<thead><tr>" +
        heads[0].cells.map((c) => `<th>${escapeHtml(c)}</th>`).join("") +
        "</tr></thead>";
    }
    if (body.length) {
      html +=
        "<tbody>" +
        body
          .map(
            (r) =>
              "<tr>" +
              r.cells.map((c) => `<td>${escapeHtml(c)}</td>`).join("") +
              "</tr>",
          )
          .join("") +
        "</tbody>";
    }
    html += "</table>";
    return html;
  }

  function processAiMessageMarkdown(messageRoot) {
    if (!isAiMessageBlock(messageRoot)) return;

    messageRoot
      .querySelectorAll("span.leading-6:not([data-ai-md])")
      .forEach((span) => {
        span.dataset.aiMd = "1";

        if (!span.isConnected) return;

        const lines = span.innerHTML
          .split(/<br\s*\/?>/gi)
          .map((l) => {
            const tmp = document.createElement("span");
            tmp.innerHTML = l;
            return tmp.textContent;
          });

        const pipeCount = lines.filter((l) => l.trim().startsWith("|")).length;
        const hasSep = lines.some((l) => /^\s*\|[\s\-:|]+\|\s*$/.test(l));
        if (pipeCount < 2 || !hasSep) return;

        const tableHtml = buildMarkdownTable(lines);
        if (!tableHtml) return;

        // Mutate the span's children rather than replacing the span node itself.
        // SpicyChat is a React app — removing a React-owned element node causes
        // its reconciler to throw "removeChild: node is not a child" when it
        // later tries to clean up the same node from its virtual DOM. Clearing
        // innerHTML and appending inside keeps the span reference intact.
        const wrapper = document.createElement("div");
        wrapper.className = "ai-md-table-wrapper";
        wrapper.innerHTML = tableHtml;
        try {
          span.innerHTML = "";
          span.appendChild(wrapper);
          span.dataset.aiMdTable = "1";
        } catch {
          span.dataset.aiMd = "0"; // allow retry on next scan
        }
      });
  }

  function mountAiMessageMarkdown(roots) {
    if (!scMdTables) return;
    (roots ?? document.querySelectorAll('div[id^="message-"]'))
      .forEach(processAiMessageMarkdown);
  }

  // ─── Bracket emphasis in AI messages ───────────────────────────────────────

  // Walks text nodes inside an element and wraps [bracket] content in a span.
  // Skips em/q/strong to avoid double-styling SpicyChat's own markdown.
  function wrapBracketsInNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (!text.includes("[")) return;
      const re = /\[([^\[\]]+)\]/g;
      if (!re.test(text)) return;
      re.lastIndex = 0;

      const frag = document.createDocumentFragment();
      let last = 0;
      let m;
      while ((m = re.exec(text)) !== null) {
        if (m.index > last)
          frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const span = document.createElement("span");
        span.className = "ai-bracket-scene";
        span.dataset.bracketRaw = m[1];
        span.textContent = scBracketPipeNewline ? m[1].replace(/ \| /g, "\n") : m[1];
        frag.appendChild(span);
        last = m.index + m[0].length;
      }
      if (last < text.length)
        frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName;
      if (
        tag === "EM" ||
        tag === "Q" ||
        tag === "STRONG" ||
        node.classList.contains("ai-bracket-scene")
      )
        return;
      Array.from(node.childNodes).forEach(wrapBracketsInNode);
    }
  }

  function processAiMessageBrackets(messageRoot) {
    if (!messageRoot) return;

    messageRoot
      .querySelectorAll("span.leading-6:not([data-ai-bracket])")
      .forEach((span) => {
        span.dataset.aiBracket = "1";
        if (!span.isConnected || !span.parentNode) return;
        try {
          wrapBracketsInNode(span);
        } catch {
          // Span may be detached mid-stream
        }
      });
  }

  function mountAiMessageBrackets(roots) {
    if (!scBracketEmphasis) return;
    (roots ?? document.querySelectorAll('div[id^="message-"]'))
      .forEach(processAiMessageBrackets);
  }

  async function onSceneFillButtonClick(messageRoot) {
    const sceneText = getMessageTextForScene(messageRoot);
    if (!sceneText) {
      showToast("No message text found to save.", true);
      return;
    }
    const result = await saveSceneContextFromMessage(sceneText);
    if (!result.ok) {
      showToast("Could not save Previous scene for this chat.", true);
      return;
    }
    if (result.changed.length) {
      showToast(
        "\u2713 Previous scene saved + auto-filled " +
          result.changed.join(", ") +
          ".",
      );
    } else {
      showToast("\u2713 Previous scene saved.");
    }
  }

  function mountSceneFillButtons() {
    if (!isSpicyChat) return;
    const messages = document.querySelectorAll('div[id^="message-"]');
    messages.forEach((messageRoot) => {
      if (!(messageRoot instanceof HTMLElement)) return;
      if (messageRoot.dataset.aiSceneFillMounted === "1") return;
      if (!isAiMessageBlock(messageRoot)) return;

      const controlRow = messageRoot.querySelector(
        "div.flex.justify-between.items-center",
      );
      if (!controlRow) return;

      const rightSlot =
        controlRow.lastElementChild instanceof HTMLElement
          ? controlRow.lastElementChild
          : controlRow;
      rightSlot.classList.add("ai-scene-action-slot");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ai-scene-fill-btn";
      btn.textContent = "\u2b73 Use As Previous Scene";
      btn.title = "Send this AI message to Previous scene context";
      btn.addEventListener("click", () => onSceneFillButtonClick(messageRoot));
      rightSlot.appendChild(btn);

      messageRoot.dataset.aiSceneFillMounted = "1";
    });
  }

  if (isSpicyChat) {
    let mountQueued = false;
    const changedRoots = new Set();

    let chatScroller = null;
    function getChatScroller() {
      if (chatScroller?.isConnected) return chatScroller;
      const msg = document.querySelector('div[id^="message-"]');
      if (!msg) return null;
      let el = msg.parentElement;
      while (el && el !== document.body) {
        const style = getComputedStyle(el);
        if (
          el.scrollHeight > el.clientHeight &&
          (style.overflowY === "auto" || style.overflowY === "scroll")
        ) {
          chatScroller = el;
          return el;
        }
        el = el.parentElement;
      }
      return null;
    }

    const scheduleMount = (mutations) => {
      // Collect the specific message containers that actually mutated so
      // downstream processors only touch changed nodes rather than rescanning
      // the entire conversation on every streaming tick.
      for (const m of mutations) {
        // Target's ancestor — covers mutations inside an existing message node
        const root = m.target.closest('div[id^="message-"]');
        if (root) changedRoots.add(root);

        // Added nodes — catches SpicyChat replacing the pending user message
        // node with its confirmed version after the AI responds. The mutation
        // target in that case is the parent container, so closest() above
        // misses the freshly inserted child.
        for (const node of m.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (/^message-/.test(node.id)) {
            changedRoots.add(node);
          } else {
            const r = node.closest?.('div[id^="message-"]');
            if (r) changedRoots.add(r);
          }
        }
      }
      if (mountQueued) return;
      mountQueued = true;
      requestAnimationFrame(() => {
        mountQueued = false;
        const roots = changedRoots.size ? [...changedRoots] : null;
        changedRoots.clear();

        const scroller = getChatScroller();
        const atBottom =
          scroller &&
          scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;

        mountSceneFillButtons();
        mountAiMessageMarkdown(roots);
        mountAiMessageBrackets(roots);

        if (atBottom && scroller) scroller.scrollTop = scroller.scrollHeight;
      });
    };

    mountSceneFillButtons();
    mountAiMessageMarkdown();
    mountAiMessageBrackets();
    const obs = new MutationObserver(scheduleMount);
    obs.observe(document.body, { childList: true, subtree: true });
  }
})();
