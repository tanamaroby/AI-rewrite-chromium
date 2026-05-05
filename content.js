// content.js — Injected into every page
// Watches textareas/contenteditable elements for rewrite keywords

(function () {
  "use strict";

  let commands = [];
  let apiKey = "";
  let model = "";

  // Load settings from storage
  function loadSettings() {
    chrome.storage.sync.get(["commands", "apiKey", "model"], (data) => {
      commands = data.commands || [];
      apiKey = data.apiKey || "";
      model =
        data.model ||
        "cognitivecomputations/dolphin-mistral-24b-venice-edition:free";
    });
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

  // ─── Main rewrite handler ───────────────────────────────────────────────────

  async function handleRewrite(el, match) {
    const overlay = createOverlay(el);
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
      replaceText(el, result.text);
      const modelShort = (result.model || model || "unknown").split("/").pop();
      showToast(
        `✓ ${match.cmd.label || match.keyword} · ${modelShort} · ${elapsedSec}s`,
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
      }
    }, 300);

    pending.set(el, timer);
  }

  function isEditableElement(el) {
    if (!el) return false;
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
})();
