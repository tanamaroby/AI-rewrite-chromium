// content.js — Injected into every page
// Watches textareas/contenteditable elements for rewrite keywords

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
  const isSpicyChat = location.hostname.includes("spicychat.ai");
  const REWRITE_SHORTCUT_KEY = "n";

  // Load settings from storage
  function loadSettings() {
    chrome.storage.sync.get(
      [
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
      ],
      (data) => {
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
          while (rpRewrites.length < 5)
            rpRewrites.push({ name: "", prompt: "" });
        }
        rpActiveRewriteIndex =
          typeof data.rpActiveRewriteIndex === "number"
            ? data.rpActiveRewriteIndex
            : -1;
        fmtShortcut = data.fmtShortcut || "m";
        fmtNoTrackerShortcut = data.fmtNoTrackerShortcut || "m";
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

  function formatPartyStatusLabel(status) {
    const s = String(status || "active").toLowerCase();
    if (s === "downed") return "Downed";
    if (s === "dead") return "Dead";
    if (s === "absent") return "Absent";
    return "Active";
  }

  function hasTrackerHeaderAtTop(text) {
    if (!text) return false;
    // Ignore leading whitespace/newlines and check if top header is exactly [TRACKER]
    return /^\s*\[TRACKER\](?:\r?\n|$)/.test(String(text));
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

    const partyKey = "sc_party_v1_" + chatId;
    const resourcesKey = "sc_res_v1_" + chatId;
    chrome.storage.local.get([partyKey, resourcesKey], (data) => {
      const party = Array.isArray(data[partyKey]) ? data[partyKey] : [];
      const resources = Array.isArray(data[resourcesKey])
        ? data[resourcesKey]
        : [];
      const lines = [];

      if (party.length) {
        const partyParts = party.map((m) => {
          const name = String(m?.name || "").trim() || "(unnamed)";
          const notes = String(m?.notes || "").trim();
          return notes
            ? `${name} (${formatPartyStatusLabel(m?.status)}; ${notes})`
            : `${name} (${formatPartyStatusLabel(m?.status)})`;
        });
        lines.push(`Party: ${partyParts.join(" | ")}`);
      }

      if (resources.length) {
        const resourceParts = resources.map((r) => {
          const name = String(r?.name || "").trim() || "(unnamed)";
          const value = Number.isFinite(Number(r?.value))
            ? Number(r.value)
            : String(r?.value || "0").trim() || "0";
          const notes = String(r?.notes || "").trim();
          return notes ? `${name}: ${value} (${notes})` : `${name}: ${value}`;
        });
        lines.push(`Resources: ${resourceParts.join(" | ")}`);
      }

      done(lines.length ? `[TRACKER]\n${lines.join("\n")}` : "");
    });
  }

  // ─── Text formatter (no AI) ─────────────────────────────────────────────────

  function formatText(text) {
    if (fmtOocBrackets)
      text = text.replace(/\(\(\s*([\s\S]*?)\s*\)\)/g, "($1)");
    // Repair/strip any pre-existing asterisks before processing
    if (fmtRepairAsterisks) {
      text = text
        .split("\n")
        .map((line) => {
          const count = (line.match(/\*/g) || []).length;
          return count % 2 !== 0 ? line + "*" : line;
        })
        .join("\n");
    }
    if (fmtStripAsterisks) text = text.replace(/\*/g, "");
    if (fmtNormaliseQuotes) text = text.replace(/[\u201C\u201D]/g, '"');
    if (fmtNormaliseApostrophes) text = text.replace(/[\u2018\u2019]/g, "'");
    // Em-dash: exactly two hyphens between word-chars or spaces → —
    // Exclude --- (horizontal rules / longer runs)
    if (fmtEmDash) text = text.replace(/(?<!-)--(?!-)/g, "\u2014");
    // Remove space(s) immediately before , . ! ? : ;
    // but not before … (already an ellipsis character) and not mid-number periods
    if (fmtNoSpaceBeforePunct)
      text = text.replace(/ +([,!?:;])/g, "$1").replace(/ +(\.)(?!\d)/g, "$1");
    if (fmtNormaliseEllipsis) {
      text = text.replace(/\.{2,}/g, "...");
      text = text.replace(/\.{3}/g, "\u2026");
    }
    // Ensure exactly one space after , . ! ? : ; when followed directly by a letter
    // Exceptions: skip digits after period (decimals), skip when char before is also punctuation
    if (fmtSpaceAfterPunct) {
      // Period: skip if preceded by a digit (decimal) or followed by a digit
      text = text.replace(/(?<=[^\d\s.!?,;:\u2026])\.(?=[A-Za-z])/g, ". ");
      // Other punctuation (,!?:;) always safe
      text = text.replace(/([,!?:;])(?=[A-Za-z])/g, "$1 ");
    }
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
    // Capitalise first letter of dialogue inside straight quotes
    if (fmtCapitaliseQuotes)
      text = text.replace(/"([a-z])/g, (_, ch) => '"' + ch.toUpperCase());

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
    let result = parts.join("");

    // Action punctuation runs after wrapping so it sees the new *...* pairs
    if (fmtActionPunctuation) {
      result = result.replace(/\*([^*\n]+)\*/g, (_, inner) => {
        const t = inner.trimEnd();
        return /[.!?,:\u2026\u2014\-_]$/.test(t) ? `*${inner}*` : `*${t}.*`;
      });
    }
    // Capitalise the first letter of each *action* that follows a sentence end:
    // handles patterns like  .*  "quote"  *next action*
    if (fmtActionPunctuation || fmtCapitaliseSentences) {
      result = result.replace(
        /([.!?\u2026\u2014\-_]\*)([^*]*)\*([a-z])/g,
        (_, end, mid, ch) => end + mid + "*" + ch.toUpperCase(),
      );
    }
    return result;
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
      chrome.storage.local.get("sc_rpctx_v1_" + chatId, (d) => {
        const c = d["sc_rpctx_v1_" + chatId];
        resolve(c && typeof c === "object" ? c : {});
      });
    });
  }

  async function buildRewritePrompt(presetPrompt) {
    const parts = [];
    const persona =
      rpActivePersonaIndex >= 0 && rpActivePersonaIndex < rpPersonas.length
        ? rpPersonas[rpActivePersonaIndex]
        : null;
    const name = (persona && persona.name && persona.name.trim()) || "the user";

    if (
      persona &&
      (persona.name?.trim() ||
        persona.description?.trim() ||
        persona.personality?.trim())
    ) {
      let block =
        `[Roleplay context — the text you are rewriting is written in first person by ${name}. ` +
        `Preserve their voice, intent and point of view; never break character or narrate for other characters.`;
      if (persona.description && persona.description.trim()) {
        const resolvedDesc = persona.description
          .replace(/\{\{user\}\}/gi, name)
          .trim();
        block += ` Who ${name} is: ${resolvedDesc}`;
      }
      if (persona.personality && persona.personality.trim()) {
        const resolved = persona.personality
          .replace(/\{\{user\}\}/gi, name)
          .trim();
        block += ` ${name}'s personality: ${resolved}`;
      }
      block += `]`;
      parts.push(block);
    }

    const ctx = await getSceneContext();
    if (ctx.context && ctx.context.trim()) {
      const resolvedBg = ctx.context.replace(/\{\{user\}\}/gi, name).trim();
      parts.push(
        `[Character background & long-term events — established facts and history that stay true across the whole story. Never contradict them: ${resolvedBg}]`,
      );
    }
    if (ctx.prevScene && ctx.prevScene.trim()) {
      parts.push(
        `[Previous scene — what happened just before, for immediate context. Continue naturally from it but do not rewrite or repeat it:\n${ctx.prevScene.trim()}]`,
      );
    }
    const scene = [];
    if (ctx.location && ctx.location.trim())
      scene.push(`Location: ${ctx.location.trim()}`);
    if (ctx.clothes && ctx.clothes.trim())
      scene.push(`${name}'s clothing / appearance: ${ctx.clothes.trim()}`);
    if (ctx.status && ctx.status.trim())
      scene.push(`${name}'s current status / condition: ${ctx.status.trim()}`);
    if (scene.length) {
      parts.push(
        `[Scene details — keep these consistent and never contradict them, but only surface a detail when it is naturally relevant to the text:\n${scene.join("\n")}]`,
      );
    }

    if (ctx.dialogueStyle && ctx.dialogueStyle.trim()) {
      parts.push(
        `[Spoken dialogue only (text inside quotation marks) must follow this voice and style: ${ctx.dialogueStyle.trim()}. Do not apply it to narration or actions.]`,
      );
    }

    parts.push(presetPrompt);
    return parts.join("\n\n");
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
})();
