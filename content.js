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
  let fmtPreserveBlockquotes = true;
  let fmtPreserveSpeakerTags = true;
  let fmtPreserveBold = true;
  let fmtUnwrapBrackets = true;
  let fmtUnwrapParens = true;
  let fmtExtraDelimiters = "";
  let fmtRepairAsterisks = true;
  let fmtOocBrackets = true;
  let fmtActionPunctuation = true;
  let fmtCapitaliseQuotes = true;
  let fmtEmDash = true;
  let fmtNoSpaceBeforePunct = true;
  let fmtSpaceAfterPunct = true;
  let rpRewrites = Array.from({ length: 10 }, () => ({
    name: "",
    prompt: "",
  }));
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
  let scThoughtStyle = true;
  let stylerBoldEnabled = true;
  let stylerItalicEnabled = true;
  let stylerStrikethroughEnabled = true;
  let stylerEmphasizeEnabled = true;
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
    "fmtPreserveBlockquotes",
    "fmtPreserveSpeakerTags",
    "fmtPreserveBold",
    "fmtUnwrapBrackets",
    "fmtUnwrapParens",
    "fmtExtraDelimiters",
    "fmtRepairAsterisks",
    "fmtOocBrackets",
    "fmtActionPunctuation",
    "fmtCapitaliseQuotes",
    "fmtEmDash",
    "fmtNoSpaceBeforePunct",
    "fmtSpaceAfterPunct",
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
    "scThoughtStyle",
    "stylerBoldEnabled",
    "stylerItalicEnabled",
    "stylerStrikethroughEnabled",
    "stylerEmphasizeEnabled",
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
      fmtPreserveBlockquotes = data.fmtPreserveBlockquotes !== false;
      fmtPreserveSpeakerTags = data.fmtPreserveSpeakerTags !== false;
      fmtPreserveBold = data.fmtPreserveBold !== false;
      fmtUnwrapBrackets = data.fmtUnwrapBrackets !== false;
      fmtUnwrapParens = data.fmtUnwrapParens !== false;
      fmtExtraDelimiters = data.fmtExtraDelimiters || "";
      fmtRepairAsterisks = data.fmtRepairAsterisks !== false;
      fmtOocBrackets = data.fmtOocBrackets !== false;
      fmtActionPunctuation = data.fmtActionPunctuation !== false;
      fmtCapitaliseQuotes = data.fmtCapitaliseQuotes !== false;
      fmtEmDash = data.fmtEmDash !== false;
      fmtNoSpaceBeforePunct = data.fmtNoSpaceBeforePunct !== false;
      fmtSpaceAfterPunct = data.fmtSpaceAfterPunct !== false;
      if (Array.isArray(data.rpRewrites) && data.rpRewrites.length > 0) {
        rpRewrites = data.rpRewrites.slice(0, 10).map((r) => ({
          name: r.name || "",
          prompt: r.prompt || "",
        }));
        while (rpRewrites.length < 10)
          rpRewrites.push({ name: "", prompt: "" });
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
      scThoughtStyle = data.scThoughtStyle !== false;
      stylerBoldEnabled = data.stylerBoldEnabled !== false;
      stylerItalicEnabled = data.stylerItalicEnabled !== false;
      stylerStrikethroughEnabled = data.stylerStrikethroughEnabled !== false;
      stylerEmphasizeEnabled = data.stylerEmphasizeEnabled !== false;
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
        document.documentElement.classList.toggle(
          "sc-inject-thoughts-hidden",
          !scThoughtStyle,
        );
        if (scMdTables) mountAiMessageMarkdown();
        if (scBracketEmphasis) mountAiMessageBrackets();
        if (scThoughtStyle) mountAiMessageThoughts();
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
      fmtPreserveBlockquotes,
      fmtPreserveSpeakerTags,
      fmtPreserveBold,
      fmtUnwrapBrackets,
      fmtUnwrapParens,
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
      const builtPrompt = preset.prompt;
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

  // ─── Text styler (Markdown-style wrap shortcuts) ───────────────────────────

  const BOLD_MARK = "**";
  const ITALIC_MARK = "*";
  const STRIKETHROUGH_MARK = "~~";

  function countLeadingChar(str, ch) {
    let i = 0;
    while (i < str.length && str[i] === ch) i++;
    return i;
  }

  function countTrailingChar(str, ch) {
    let i = 0;
    while (i < str.length && str[str.length - 1 - i] === ch) i++;
    return i;
  }

  // Checks the text is wrapped in exactly `mark` (e.g. distinguishes a
  // single-asterisk *italic* wrap from a double-asterisk **bold** one).
  function isWrappedInMark(text, mark) {
    if (text.length < mark.length * 2) return false;
    const ch = mark[0];
    return (
      countLeadingChar(text, ch) === mark.length &&
      countTrailingChar(text, ch) === mark.length
    );
  }

  function toggleMarkContentEditable(el, mark) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return;
    const selected = sel.toString();
    if (!selected) {
      document.execCommand("insertText", false, mark + mark);
      for (let i = 0; i < mark.length; i++) {
        sel.modify("move", "backward", "character");
      }
    } else if (isWrappedInMark(selected, mark)) {
      document.execCommand(
        "insertText",
        false,
        selected.slice(mark.length, -mark.length),
      );
    } else {
      document.execCommand("insertText", false, mark + selected + mark);
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function toggleMarkTextInput(el, mark) {
    const { selectionStart: start, selectionEnd: end, value } = el;
    const selected = value.slice(start, end);
    let newValue, newStart, newEnd;
    if (start === end) {
      newValue = value.slice(0, start) + mark + mark + value.slice(end);
      newStart = newEnd = start + mark.length;
    } else if (isWrappedInMark(selected, mark)) {
      const unwrapped = selected.slice(mark.length, -mark.length);
      newValue = value.slice(0, start) + unwrapped + value.slice(end);
      newStart = start;
      newEnd = start + unwrapped.length;
    } else {
      newValue =
        value.slice(0, start) + mark + selected + mark + value.slice(end);
      newStart = start + mark.length;
      newEnd = end + mark.length;
    }
    el.value = newValue;
    el.selectionStart = newStart;
    el.selectionEnd = newEnd;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function toggleMark(el, mark) {
    if (el.isContentEditable) toggleMarkContentEditable(el, mark);
    else toggleMarkTextInput(el, mark);
  }

  function toggleBold(el) {
    toggleMark(el, BOLD_MARK);
  }

  function toggleItalic(el) {
    toggleMark(el, ITALIC_MARK);
  }

  function toggleStrikethrough(el) {
    toggleMark(el, STRIKETHROUGH_MARK);
  }

  // ─── Emphasize paragraph (strip asterisks + terminal punctuation, no selection needed) ──

  // Strips markdown emphasis markers, collapses internal line breaks into
  // spaces, and trims only the terminal punctuation run at the very start/end
  // (leaving mid-sentence punctuation like commas and apostrophes intact) —
  // the manual cleanup the user does right before bolding a whole line/paragraph.
  function cleanEmphasizeText(text) {
    let out = text.replace(/\*/g, "");
    out = out.replace(/\n+/g, " ");
    out = out.replace(/[ \t]+/g, " ").trim();
    out = out.replace(/^[.,!?]+\s*/, "");
    out = out.replace(/\s*[.,!?]+$/, "");
    return out.trim();
  }

  function emphasizeParagraphTextInput(el) {
    const { value } = el;
    const cursor = el.selectionStart;
    const breakRe = /\n{2,}/g;
    let start = 0;
    let end = value.length;
    let m;
    while ((m = breakRe.exec(value)) !== null) {
      const bStart = m.index;
      const bEnd = m.index + m[0].length;
      if (bEnd <= cursor) {
        start = bEnd;
      } else if (bStart >= cursor) {
        end = bStart;
        break;
      } else {
        start = bEnd;
        end = bEnd;
        break;
      }
    }
    const cleaned = cleanEmphasizeText(value.slice(start, end));
    el.value = value.slice(0, start) + cleaned + value.slice(end);
    el.selectionStart = start;
    el.selectionEnd = start + cleaned.length;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // Maps a contenteditable's text nodes to offsets in a flattened plain-text
  // coordinate space, and records the offsets where a run of 2+ <br> (a real
  // blank-line paragraph break, matching the convention used elsewhere in
  // this file) sits. A single <br> is just a soft line wrap and isn't a break.
  function buildParagraphTextMap(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL, {
      acceptNode(n) {
        if (n.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
        if (n.nodeType === Node.ELEMENT_NODE && n.tagName === "BR")
          return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_SKIP;
      },
    });
    const segments = [];
    const breaks = [];
    let offset = 0;
    let brRun = 0;
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (brRun >= 2) breaks.push(offset);
        brRun = 0;
        const len = node.textContent.length;
        segments.push({ node, start: offset, end: offset + len });
        offset += len;
      } else {
        brRun++;
      }
    }
    if (brRun >= 2) breaks.push(offset);
    return { segments, breaks, length: offset };
  }

  // Locates a flat-text offset back to a DOM node+offset. Boundary offsets
  // that sit exactly between two segments (e.g. either side of a <br> run)
  // are ambiguous; preferLater picks the start of the later segment instead
  // of the end of the earlier one, so a paragraph's start doesn't reach
  // backward into the previous paragraph's break.
  function locateParagraphOffset(segments, offset, preferLater) {
    for (let idx = 0; idx < segments.length; idx++) {
      const seg = segments[idx];
      const isLast = idx === segments.length - 1;
      if (preferLater) {
        if (offset >= seg.start && (offset < seg.end || isLast))
          return { node: seg.node, offset: offset - seg.start };
      } else if (offset >= seg.start && offset <= seg.end) {
        return { node: seg.node, offset: offset - seg.start };
      }
    }
    if (!segments.length) return null;
    const last = segments[segments.length - 1];
    return { node: last.node, offset: last.node.textContent.length };
  }

  // Flattens a cloned paragraph fragment to plain text, turning each <br>
  // (necessarily a soft break within the paragraph, since the range was cut
  // at the real 2+ break points) into a space rather than dropping it.
  function flattenParagraphFragment(node) {
    let out = "";
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        out += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        out += child.tagName === "BR" ? " " : flattenParagraphFragment(child);
      }
    }
    return out;
  }

  function emphasizeParagraphContentEditable(el) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const caretRange = sel.getRangeAt(0);
    if (!el.contains(caretRange.startContainer)) return;

    const { segments, breaks, length } = buildParagraphTextMap(el);
    if (!segments.length) return;

    const preRange = document.createRange();
    preRange.selectNodeContents(el);
    preRange.setEnd(caretRange.startContainer, caretRange.startOffset);
    const caretOffset = preRange.toString().length;

    let start = 0;
    let end = length;
    for (const b of breaks) {
      if (b <= caretOffset) start = b;
      else {
        end = b;
        break;
      }
    }

    const startLoc = locateParagraphOffset(segments, start, true);
    const endLoc = locateParagraphOffset(segments, end, false);
    if (!startLoc || !endLoc) return;

    const range = document.createRange();
    range.setStart(startLoc.node, startLoc.offset);
    range.setEnd(endLoc.node, endLoc.offset);

    const cleaned = cleanEmphasizeText(
      flattenParagraphFragment(range.cloneContents()),
    );

    range.deleteContents();
    const textNode = document.createTextNode(cleaned);
    range.insertNode(textNode);

    const newSel = window.getSelection();
    newSel.removeAllRanges();
    const selRange = document.createRange();
    selRange.selectNodeContents(textNode);
    newSel.addRange(selRange);

    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function emphasizeParagraph(el) {
    if (el.isContentEditable) emphasizeParagraphContentEditable(el);
    else emphasizeParagraphTextInput(el);
  }

  // ─── Keyboard shortcuts (format + rewrite) ────────────────────────────────────

  document.addEventListener(
    "keydown",
    (e) => {
      if (!isEditableElement(document.activeElement)) return;
      if (stylerBoldEnabled && matchShortcut(e, "b", false)) {
        e.preventDefault();
        toggleBold(document.activeElement);
        return;
      }
      if (stylerItalicEnabled && matchShortcut(e, "i", false)) {
        e.preventDefault();
        toggleItalic(document.activeElement);
        return;
      }
      if (stylerStrikethroughEnabled && matchShortcut(e, "x", true)) {
        e.preventDefault();
        toggleStrikethrough(document.activeElement);
        return;
      }
      if (stylerEmphasizeEnabled && matchShortcut(e, "e", true)) {
        e.preventDefault();
        emphasizeParagraph(document.activeElement);
        return;
      }
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

  // ─── AI Generator (triggered by RPG tracker drawer) ─────────────────────────

  document.addEventListener("sc-rp-run-generate", async (e) => {
    if (!isSpicyChat) return;
    const { prompt, text, maxTokens } = e.detail || {};
    try {
      const result = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: "REWRITE_TEXT",
            text: text || ".",
            prompt,
            apiKey,
            model,
            maxTokens,
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
      document.dispatchEvent(
        new CustomEvent("sc-rp-generate-result", {
          detail: { ok: true, text: result.text, model: result.model },
        }),
      );
    } catch (err) {
      document.dispatchEvent(
        new CustomEvent("sc-rp-generate-result", {
          detail: { ok: false, error: err.message },
        }),
      );
    }
  });

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

  // ─── Bracket / thought-paren emphasis in AI messages ───────────────────────

  // [Scene bracket] annotations — always wrapped, whether they share a line
  // with other text (inline chip) or stand alone (full-width block card).
  const BRACKET_CFG = {
    openChar: "[",
    regex: /\[([^\[\]]+)\]/g,
    blockClass: "ai-bracket-scene",
    inlineClass: "ai-bracket-scene ai-bracket-scene--inline",
    allowInline: true,
    dataKey: "bracketRaw",
    formatText: (raw) => (scBracketPipeNewline ? raw.replace(/ \| /g, "\n") : raw),
  };

  // (Thought) parentheses — only wrapped when the parenthetical is alone on
  // its own line. Round brackets are common inside ordinary prose (a quick
  // aside mid-sentence), so a match sharing its line with other text is left
  // completely untouched rather than downgraded to an inline chip — unlike
  // [brackets], which are an unambiguous signal wherever they appear.
  const THOUGHT_CFG = {
    openChar: "(",
    regex: /\(([^()]+)\)/g,
    blockClass: "ai-thought-bubble",
    allowInline: false,
    dataKey: "thoughtRaw",
  };

  // Wraps [bracket] content in a span, spanning across any em/q/strong
  // elements SpicyChat's own markdown inserts mid-bracket (e.g. a quoted
  // word inside a scene annotation). A bracket said entirely *within* one
  // of those elements — i.e. actual in-character dialogue/emphasis that
  // happens to contain literal brackets — is left untouched.
  function enclosingInlineMarkup(node, root) {
    let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    while (el && el !== root) {
      if (el.tagName === "EM" || el.tagName === "Q" || el.tagName === "STRONG")
        return el;
      el = el.parentElement;
    }
    return null;
  }

  // Flattens a cloned DOM fragment to plain text for bracketRaw/thoughtRaw/
  // textContent. A single <br> is a soft break (e.g. one raw newline in the
  // AI's text) — those read as visually "broken" lines for no reason, so
  // it's joined back onto one line with a separator. A run of 2+ <br> is a
  // real paragraph break (a blank line) and is kept as one. <q> quote marks,
  // stripped by SpicyChat and normally re-drawn via CSS, are restored as
  // literal text.
  function flattenInlineFragment(node) {
    let out = "";
    const children = Array.from(node.childNodes);
    let i = 0;
    while (i < children.length) {
      const child = children[i];
      if (child.nodeType === Node.TEXT_NODE) {
        out += child.textContent;
        i++;
        continue;
      }
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (child.tagName === "BR") {
          let j = i;
          while (j < children.length && children[j].nodeType === Node.ELEMENT_NODE && children[j].tagName === "BR")
            j++;
          out += j - i === 1 ? " · " : "\n\n";
          i = j;
          continue;
        }
        if (child.tagName === "Q") {
          out += '"' + flattenInlineFragment(child) + '"';
          i++;
          continue;
        }
        out += flattenInlineFragment(child);
      }
      i++;
    }
    return out;
  }

  // Generic version of the bracket-wrapping algorithm, parameterized by a
  // config (see BRACKET_CFG / THOUGHT_CFG above) so [square brackets] and
  // (round-bracket thoughts) share one implementation instead of two nearly
  // identical copies.
  function wrapDelimitedInNode(root, cfg) {
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    if (root.classList.contains(cfg.blockClass)) return;
    if (!root.textContent.includes(cfg.openChar)) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let n;
    while ((n = walker.nextNode())) textNodes.push(n);
    if (!textNodes.length) return;

    let fullText = "";
    const segments = [];
    for (const tn of textNodes) {
      const t = tn.textContent;
      segments.push({ node: tn, start: fullText.length, end: fullText.length + t.length });
      fullText += t;
    }
    if (!fullText.includes(cfg.openChar)) return;

    cfg.regex.lastIndex = 0;
    const matches = [];
    let m;
    while ((m = cfg.regex.exec(fullText)) !== null) matches.push(m);
    if (!matches.length) return;

    // When an offset falls exactly on the shared boundary between two text
    // nodes (e.g. two matches separated only by a zero-width <br>), which
    // node "owns" that point is ambiguous. preferLater picks the start of
    // the later node instead of the end of the earlier one — needed for a
    // match's *start* boundary, so its Range doesn't reach backward and
    // swallow whatever (like a <br> pair) sits between it and the previous
    // match. The end boundary keeps the default (earlier-segment) behavior
    // so it doesn't reach forward and swallow what follows.
    function locate(offset, preferLater) {
      for (let idx = 0; idx < segments.length; idx++) {
        const seg = segments[idx];
        const isLast = idx === segments.length - 1;
        if (preferLater) {
          if (offset >= seg.start && (offset < seg.end || isLast))
            return { node: seg.node, offset: offset - seg.start };
        } else if (offset >= seg.start && offset <= seg.end) {
          return { node: seg.node, offset: offset - seg.start };
        }
      }
      const last = segments[segments.length - 1];
      return { node: last.node, offset: last.node.textContent.length };
    }

    function buildRawText(startLoc, endLoc) {
      const r = document.createRange();
      r.setStart(startLoc.node, startLoc.offset);
      r.setEnd(endLoc.node, endLoc.offset);
      return flattenInlineFragment(r.cloneContents());
    }

    // Process in reverse so earlier match offsets stay valid as the DOM mutates.
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      const startLoc = locate(match.index, true);
      const endLoc = locate(match.index + match[0].length);

      const startMarkup = enclosingInlineMarkup(startLoc.node, root);
      const endMarkup = enclosingInlineMarkup(endLoc.node, root);
      if (startMarkup && startMarkup === endMarkup) continue;

      const isInline =
        hasInlineTextBefore(startLoc.node, startLoc.offset, root) ||
        hasInlineTextAfter(endLoc.node, endLoc.offset, root);
      if (isInline && !cfg.allowInline) continue;

      const range = document.createRange();
      try {
        range.setStart(startLoc.node, startLoc.offset);
        range.setEnd(endLoc.node, endLoc.offset);
      } catch {
        continue;
      }

      const innerStartLoc = locate(match.index + 1, true);
      const innerEndLoc = locate(match.index + match[0].length - 1);
      const rawText = buildRawText(innerStartLoc, innerEndLoc);

      const span = document.createElement("span");
      span.className = isInline ? cfg.inlineClass : cfg.blockClass;
      span.dataset[cfg.dataKey] = rawText;
      span.textContent = cfg.formatText ? cfg.formatText(rawText) : rawText;

      range.deleteContents();
      range.insertNode(span);
    }
  }

  // True if there's real (non-whitespace) content sharing the same source
  // line before `offset` in `node`, walking back through preceding siblings
  // up to `root` and stopping at the first <br> (a real line break). Used to
  // tell a [bracket] or (thought) that shares its line with other text
  // (brackets: rendered as an inline chip, see .ai-bracket-scene--inline;
  // thoughts: left untouched entirely, see THOUGHT_CFG.allowInline) from one
  // alone on its own line (rendered as the full-width block card).
  function hasInlineTextBefore(node, offset, root) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.slice(0, offset).trim()) return true;
    let cur = node;
    while (cur && cur !== root) {
      let sib = cur.previousSibling;
      while (sib) {
        if (sib.nodeType === Node.ELEMENT_NODE && sib.tagName === "BR") return false;
        if (sib.textContent && sib.textContent.trim()) return true;
        sib = sib.previousSibling;
      }
      cur = cur.parentNode;
    }
    return false;
  }

  function hasInlineTextAfter(node, offset, root) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.slice(offset).trim()) return true;
    let cur = node;
    while (cur && cur !== root) {
      let sib = cur.nextSibling;
      while (sib) {
        if (sib.nodeType === Node.ELEMENT_NODE && sib.tagName === "BR") return false;
        if (sib.textContent && sib.textContent.trim()) return true;
        sib = sib.nextSibling;
      }
      cur = cur.parentNode;
    }
    return false;
  }

  function processAiMessageBrackets(messageRoot) {
    if (!messageRoot) return;

    messageRoot
      .querySelectorAll("span.leading-6:not([data-ai-bracket])")
      .forEach((span) => {
        span.dataset.aiBracket = "1";
        if (!span.isConnected || !span.parentNode) return;
        try {
          wrapDelimitedInNode(span, BRACKET_CFG);
        } catch {
          // Span may be detached mid-stream
        }
      });
  }

  function processAiMessageThoughts(messageRoot) {
    if (!messageRoot) return;

    messageRoot
      .querySelectorAll("span.leading-6:not([data-ai-thought])")
      .forEach((span) => {
        span.dataset.aiThought = "1";
        if (!span.isConnected || !span.parentNode) return;
        try {
          wrapDelimitedInNode(span, THOUGHT_CFG);
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

  function mountAiMessageThoughts(roots) {
    if (!scThoughtStyle) return;
    (roots ?? document.querySelectorAll('div[id^="message-"]'))
      .forEach(processAiMessageThoughts);
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

        mountAiMessageMarkdown(roots);
        mountAiMessageBrackets(roots);
        mountAiMessageThoughts(roots);

        if (atBottom && scroller) scroller.scrollTop = scroller.scrollHeight;
      });
    };

    mountAiMessageMarkdown();
    mountAiMessageBrackets();
    mountAiMessageThoughts();
    const obs = new MutationObserver(scheduleMount);
    obs.observe(document.body, { childList: true, subtree: true });
  }
})();
