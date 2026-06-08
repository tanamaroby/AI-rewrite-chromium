// content.js — Injected into every page
// Watches textareas/contenteditable elements for rewrite keywords

(function () {
  "use strict";

  let commands = [];
  let apiKey = "";
  let model = "";
  let formatterEnabled = true;
  let formatterKeyword = "//format";
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
  let fmtUnwrapBrackets = true;
  let fmtExtraDelimiters = "";
  let rpPersonaEnabled = false;
  let rpPersonaName = "";
  let rpPersonaPrepend = "";
  let rpGlobalStyle = "";
  let lastRewrite = null; // { el, before, after, label, ts }
  let lastFocusedEl = null; // last focused SpicyChat input
  let fmtShortcut = "m"; // keyboard shortcut key for format (Ctrl+key)
  const isSpicyChat = location.hostname.includes("spicychat.ai");

  // Load settings from storage
  function loadSettings() {
    chrome.storage.sync.get(
      [
        "commands",
        "apiKey",
        "model",
        "formatterEnabled",
        "formatterKeyword",
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
        "fmtUnwrapBrackets",
        "fmtExtraDelimiters",
        "rpPersonaEnabled",
        "rpPersonaName",
        "rpPersonaPrepend",
        "rpGlobalStyle",
        "fmtShortcut",
      ],
      (data) => {
        commands = data.commands || [];
        apiKey = data.apiKey || "";
        model = data.model || "openrouter/free";
        formatterEnabled = data.formatterEnabled !== false;
        formatterKeyword = data.formatterKeyword || "//format";
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
        fmtUnwrapBrackets = data.fmtUnwrapBrackets !== false;
        fmtExtraDelimiters = data.fmtExtraDelimiters || "";
        rpPersonaEnabled = data.rpPersonaEnabled === true;
        rpPersonaName = data.rpPersonaName || "";
        rpPersonaPrepend = data.rpPersonaPrepend || "";
        rpGlobalStyle = data.rpGlobalStyle || "";
        fmtShortcut = data.fmtShortcut || "m";
      },
    );
  }

  loadSettings();

  // Re-load if settings change (e.g. user saves options)
  chrome.storage.onChanged.addListener(() => loadSettings());

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

  // ─── Text extraction & replacement ─────────────────────────────────────────

  function getTextAndKeyword(el) {
    let fullText = "";
    if (el.isContentEditable) {
      fullText = el.innerText || el.textContent || "";
    } else {
      fullText = el.value || "";
    }

    for (const cmd of commands) {
      const kw = cmd.keyword;
      const idx = fullText.indexOf(kw);
      if (idx !== -1) {
        // Text before the keyword is the content to rewrite
        const textToRewrite = fullText.slice(0, idx).trimEnd();
        if (textToRewrite.length > 0) {
          return { textToRewrite, keyword: kw, cmd, fullText };
        }
      }
    }
    return null;
  }

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

  // ─── Text formatter (no AI) ─────────────────────────────────────────────────

  function formatText(text) {
    if (fmtStripAsterisks) text = text.replace(/\*/g, "");
    if (fmtNormaliseQuotes) text = text.replace(/[""]/g, '"');
    if (fmtNormaliseApostrophes) text = text.replace(/['']/g, "'");
    if (fmtNormaliseEllipsis) text = text.replace(/\.{3}/g, "…");
    if (fmtCollapseSpaces) text = text.replace(/[ \t]{2,}/g, " ");
    if (fmtCapitaliseI) text = text.replace(/\bi\b/g, "I");
    if (fmtTrimLines) {
      text = text
        .split("\n")
        .map((line) => line.trim())
        .join("\n");
    }
    if (fmtNormaliseNewlines) text = text.replace(/\n+/g, "\n\n");
    if (fmtCapitaliseSentences) text = capitaliseSentences(text);

    const patterns = ['"[^"]*"'];
    if (fmtUnwrapBrackets) patterns.push("\\[[^\\]]*\\]");
    for (const [open, close] of parseDelimiterPairs(fmtExtraDelimiters)) {
      patterns.push(
        `${escapeRegex(open)}[^${escapeForCharClass(close)}]*${escapeRegex(close)}`,
      );
    }
    const regex = new RegExp(patterns.join("|"), "g");

    const parts = [];
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(wrapOutsideText(text.slice(lastIndex, match.index)));
      }
      parts.push(match[0]);
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push(wrapOutsideText(text.slice(lastIndex)));
    }
    return parts.join("");
  }

  function wrapOutsideText(str) {
    return str.replace(/[^\n]+/g, (chunk) => {
      const trimmed = chunk.trim();
      if (!trimmed) return chunk;
      const leadWS = chunk.slice(0, chunk.length - chunk.trimStart().length);
      const trailWS = chunk.slice(chunk.trimEnd().length);
      return leadWS + "*" + trimmed + "*" + trailWS;
    });
  }

  function capitaliseSentences(text) {
    // Capitalise first letter of each paragraph
    text = text.replace(
      /(^|\n\n)([a-z])/g,
      (_, sep, ch) => sep + ch.toUpperCase(),
    );
    // Capitalise after .  ! or ? but NOT after … or ...
    text = text.replace(
      /([^.…])([.!?]) +([a-z])/g,
      (_, pre, punc, ch) => pre + punc + " " + ch.toUpperCase(),
    );
    return text;
  }

  function parseDelimiterPairs(str) {
    const pairs = [];
    for (let i = 0; i + 1 < str.length; i += 2)
      pairs.push([str[i], str[i + 1]]);
    return pairs;
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function escapeForCharClass(ch) {
    return ch.replace(/[\\^\]]/g, "\\$&");
  }

  // ─── Format button & overlay ─────────────────────────────────────────────────

  let formatBtn = null;
  let formatBtnTarget = null;
  let formatBtnBlurTimer = null;
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

  function handleFormat(el, textOverride) {
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
      replaceText(el, formatted);
      removeFormatOverlay(el);
      showToast("✓ Formatted");
    }, 250);
  }

  function getFormatterMatch(el) {
    if (!formatterEnabled) return null;
    const kw = formatterKeyword;
    if (!kw) return null;
    const fullText = el.isContentEditable
      ? el.innerText || el.textContent || ""
      : el.value || "";
    const idx = fullText.indexOf(kw);
    if (idx !== -1) {
      const textToFormat = fullText.slice(0, idx).trimEnd();
      if (textToFormat.length > 0) return { textToFormat };
    }
    return null;
  }

  function positionFormatButton(btn, el) {
    const rect = el.getBoundingClientRect();
    const btnW = 26;
    const btnH = 26;
    const gap = 5;
    // Try to sit above the element; if too close to the top (e.g. behind a fixed header), sit inside
    let top = rect.top - btnH - gap;
    if (top < 62) top = rect.top + gap;
    top = Math.min(top, window.innerHeight - btnH - 8);
    // Right-align to element, clamped to viewport edges
    let left = rect.right - btnW - gap;
    left = Math.max(4, Math.min(left, window.innerWidth - btnW - 4));
    Object.assign(btn.style, {
      top: `${top}px`,
      left: `${left}px`,
    });
  }

  function showFormatButton(el) {
    if (!formatterEnabled) return;
    clearTimeout(formatBtnBlurTimer);
    if (formatBtn && formatBtnTarget === el) return;
    removeFormatButton(true);

    const btn = document.createElement("button");
    btn.className = "ai-formatter-btn";
    btn.title = "Format text";
    btn.setAttribute("aria-label", "Format text");
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>`;
    Object.assign(btn.style, {
      position: "fixed",
      zIndex: "2147483646",
    });
    positionFormatButton(btn, el);
    document.body.appendChild(btn);
    formatBtn = btn;
    formatBtnTarget = el;

    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      clearTimeout(formatBtnBlurTimer);
    });
    btn.addEventListener("click", () => {
      handleFormat(el);
    });
  }

  function removeFormatButton(instant) {
    clearTimeout(formatBtnBlurTimer);
    if (!formatBtn) return;
    if (instant) {
      formatBtn.remove();
      formatBtn = null;
      formatBtnTarget = null;
    } else {
      formatBtnBlurTimer = setTimeout(() => {
        if (formatBtn) {
          formatBtn.remove();
          formatBtn = null;
          formatBtnTarget = null;
        }
      }, 200);
    }
  }

  // ─── Persona prompt builder ─────────────────────────────────────────────────

  function buildPrompt(basePrompt) {
    if (!isSpicyChat) return basePrompt;
    const parts = [];

    // 1. Persona context (who is writing — always 1st person)
    if (rpPersonaEnabled && rpPersonaPrepend.trim()) {
      const name = rpPersonaName || "the user";
      const resolved = rpPersonaPrepend.replace(/\{\{user\}\}/gi, name);
      parts.push(
        `[Character context: The text you are rewriting is written in first-person by ${name}. ` +
          `You are rewriting their words — stay in their voice and perspective throughout. ` +
          `${name}'s persona:\n${resolved.trim()}]`,
      );
    }

    // 2. Global style rules (how to write)
    if (rpGlobalStyle.trim()) {
      parts.push(rpGlobalStyle.trim());
    }

    // 3. Specific command prompt
    parts.push(basePrompt);

    return parts.join("\n\n");
  }

  // ─── Main rewrite handler ───────────────────────────────────────────────────

  async function handleRewrite(el, match) {
    createOverlay(el);
    const startTime = Date.now();

    try {
      const result = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: "REWRITE_TEXT",
            text: match.textToRewrite,
            prompt: buildPrompt(match.cmd.prompt),
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
      let wasFormatted = false;
      if (autoFormatAfterRewrite && formatterEnabled) {
        finalText = formatText(result.text);
        wasFormatted = true;
      }
      replaceText(el, finalText);
      lastRewrite = {
        el,
        before: match.textToRewrite,
        after: finalText,
        label: match.cmd.label || match.keyword,
        ts: Date.now(),
      };
      const rewriteDetail = {
        before: match.textToRewrite,
        after: finalText,
        label: match.cmd.label || match.keyword,
        ts: lastRewrite.ts,
      };
      chrome.storage.local.set({ sc_last_rewrite: rewriteDetail });
      document.dispatchEvent(
        new CustomEvent("sc-rp-rewrite-done", { detail: rewriteDetail }),
      );
      const modelShort = (result.model || model || "unknown").split("/").pop();
      const formattedSuffix = wasFormatted ? " + formatted" : "";
      showToast(
        `✓ ${match.cmd.label || match.keyword}${formattedSuffix} · ${modelShort} · ${elapsedSec}s`,
      );
    } catch (err) {
      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
      // Restore original text without keyword on error
      replaceText(el, match.textToRewrite);
      showToast(`✗ Failed after ${elapsedSec}s — ${err.message}`, true);
      console.error("[AI Rewriter]", err);
    } finally {
      removeOverlay(el);
    }
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

  // Debounce to avoid triggering on every keystroke
  const pending = new WeakMap();

  function onInput(e) {
    const el = e.target;
    if (!isEditableElement(el)) return;
    if (isSpicyChat) dispatchInputStats(el);

    // Clear any existing pending check for this element
    if (pending.has(el)) {
      clearTimeout(pending.get(el));
    }

    // Small delay so the keyword is fully typed
    const timer = setTimeout(() => {
      pending.delete(el);
      const match = getTextAndKeyword(el);
      if (match) {
        handleRewrite(el, match);
        return;
      }
      const fmatch = getFormatterMatch(el);
      if (fmatch) {
        handleFormat(el, fmatch.textToFormat);
      }
    }, 300);

    pending.set(el, timer);
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

  // ─── Format button focus tracking ───────────────────────────────────────────

  document.addEventListener(
    "focusin",
    (e) => {
      if (isEditableElement(e.target)) {
        showFormatButton(e.target);
        if (isSpicyChat) {
          lastFocusedEl = e.target;
          dispatchInputStats(e.target);
        }
      }
    },
    true,
  );

  document.addEventListener(
    "focusout",
    (e) => {
      removeFormatButton(false);
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

  document.addEventListener(
    "scroll",
    () => {
      if (formatBtn && formatBtnTarget) {
        positionFormatButton(formatBtn, formatBtnTarget);
      }
    },
    { passive: true, capture: true },
  );

  window.addEventListener(
    "resize",
    () => {
      if (formatBtn && formatBtnTarget) {
        positionFormatButton(formatBtn, formatBtnTarget);
      }
    },
    { passive: true },
  );

  // ─── Format keyboard shortcut ───────────────────────────────────────────────────

  document.addEventListener(
    "keydown",
    (e) => {
      if (!fmtShortcut || !isEditableElement(document.activeElement)) return;
      if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
        if (e.key.toLowerCase() === fmtShortcut.toLowerCase()) {
          e.preventDefault();
          handleFormat(document.activeElement);
        }
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
    if (!lastFocusedEl || !document.contains(lastFocusedEl)) {
      showToast("Click the chat input first, then inject a snippet.", true);
      return;
    }
    const text = e.detail.text || "";
    if (!text) return;
    const el = lastFocusedEl;
    if (el.isContentEditable) {
      el.focus();
      const existing = (el.innerText || el.textContent || "").trimEnd();
      el.innerText = existing ? existing + text : text;
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      el.focus();
      el.value = (el.value || "").trimEnd() + text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.selectionStart = el.selectionEnd = el.value.length;
    }
    showToast("\u2713 Snippet inserted");
  });

  // ─── One-shot rewrite (triggered by RP Tools drawer) ────────────────────────

  document.addEventListener("sc-rp-run-oneshot", async (e) => {
    if (!isSpicyChat) return;
    if (!lastFocusedEl || !document.contains(lastFocusedEl)) {
      document.dispatchEvent(
        new CustomEvent("sc-rp-oneshot-result", {
          detail: {
            error: "No input focused \u2014 click inside the chat box first.",
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
        new CustomEvent("sc-rp-oneshot-result", {
          detail: { error: "Input is empty." },
        }),
      );
      return;
    }
    createOverlay(el);
    const startTime = Date.now();
    try {
      const result = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: "REWRITE_TEXT",
            text: trimmed,
            prompt: buildPrompt(e.detail.prompt),
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
        label: "One-Shot",
        ts: Date.now(),
      };
      lastRewrite = { el, ...rewriteDetail };
      chrome.storage.local.set({ sc_last_rewrite: rewriteDetail });
      document.dispatchEvent(
        new CustomEvent("sc-rp-rewrite-done", { detail: rewriteDetail }),
      );
      const modelShort = (result.model || model || "unknown").split("/").pop();
      document.dispatchEvent(
        new CustomEvent("sc-rp-oneshot-result", {
          detail: { ok: true, elapsed: elapsedSec, model: modelShort },
        }),
      );
      showToast(`\u2713 One-Shot \u00b7 ${modelShort} \u00b7 ${elapsedSec}s`);
    } catch (err) {
      replaceText(el, trimmed);
      document.dispatchEvent(
        new CustomEvent("sc-rp-oneshot-result", {
          detail: { error: err.message },
        }),
      );
      showToast(`\u2717 One-Shot \u2014 ${err.message}`, true);
    } finally {
      removeOverlay(el);
    }
  });
})();
