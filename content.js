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
    const btnH = 26;
    const gap = 5;
    const top = Math.max(rect.top - btnH - gap, 4);
    const left = rect.right - 26;
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
            prompt: match.cmd.prompt,
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

  // ─── Event listeners ────────────────────────────────────────────────────────

  // Debounce to avoid triggering on every keystroke
  const pending = new WeakMap();

  function onInput(e) {
    const el = e.target;
    if (!isEditableElement(el)) return;

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
      }
    },
    true,
  );

  document.addEventListener(
    "focusout",
    () => {
      removeFormatButton(false);
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
})();
