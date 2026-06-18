(function () {
  "use strict";

  function createRpToolsModule(deps) {
    const listenerOptions = deps.signal ? { signal: deps.signal } : undefined;
    const REWRITE_CTX_KEY = deps.rewriteCtxKey;
    const autoResizeTextarea = deps.autoResizeTextarea;

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

    const rpRewriteInfo = document.getElementById("sc-rp-rewrite-info");
    const rpRewriteLabelEl = document.getElementById("sc-rp-rewrite-label");
    const rpRewriteTsEl = document.getElementById("sc-rp-rewrite-ts");
    const rpBeforeTextEl = document.getElementById("sc-rp-before-text");
    const rpAfterTextEl = document.getElementById("sc-rp-after-text");
    const rpUndoBtn = document.getElementById("sc-rp-undo-btn");
    const rpEmptyEl = document.getElementById("sc-rp-empty");

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
    const ctxParseNotice = document.getElementById("sc-rp-ctx-parse-notice");

    let rpSaveTimer = null;
    let rpAutosaveTimer = null;

    let drawerPersonas = Array.from({ length: 10 }, () => ({
      label: "",
      name: "",
      description: "",
      personality: "",
    }));
    let drawerActiveIdx = -1;

    function buildDrawerPersonaPills() {
      if (!rpPersonaPillsEl) return;
      rpPersonaPillsEl.innerHTML = "";
      drawerPersonas.forEach((p, idx) => {
        const btn = document.createElement("button");
        btn.className =
          "sc-persona-pill" + (idx === drawerActiveIdx ? " active" : "");
        btn.dataset.idx = idx;
        const label = (p.label || "").trim() || String(idx + 1);
        btn.textContent = label.length > 9 ? label.slice(0, 8) + "…" : label;
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
      if (!rpPersonaEditorEl) return;
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
          ? detail.before.slice(0, cap) + "…"
          : detail.before;
      rpAfterTextEl.textContent =
        detail.after.length > cap
          ? detail.after.slice(0, cap) + "…"
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
      listenerOptions,
    );
    document.addEventListener(
      "sc-rp-undo-done",
      () => clearRewriteState(),
      listenerOptions,
    );

    rpUndoBtn.addEventListener("click", () => {
      rpUndoBtn.disabled = true;
      document.dispatchEvent(new CustomEvent("sc-rp-undo"));
    });

    chrome.storage.local.get("sc_last_rewrite", (data) => {
      if (data.sc_last_rewrite) {
        showRewriteState(data.sc_last_rewrite);
        showLogState(data.sc_last_rewrite);
      }
    });

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

    let ctxParseNoticeTimer = null;

    function parseSceneBracket(text) {
      const m = text.match(/\[([^\[\]]*\|[^\[\]]*)\]/);
      if (!m) return null;
      const parts = m[1].split("|").map((s) => s.trim());
      if (parts.length < 2) return null;
      return {
        status: parts[0] || "",
        location: parts[1] || "",
        clothes: parts.length >= 4 ? parts[3] : "",
      };
    }

    function showCtxParseNotice(fields, sourceLabel) {
      ctxParseNotice.textContent =
        "✨ Auto-filled " +
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
      listenerOptions,
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

    document.addEventListener(
      "sc-rp-input-stats",
      (e) => {
        const { chars, words } = e.detail;
        rpIcStats.textContent = `${chars.toLocaleString()} chars · ${words.toLocaleString()} words`;
        rpIcStats.classList.add("active");
      },
      listenerOptions,
    );

    document.addEventListener(
      "sc-rp-input-blur",
      () => {
        rpIcStats.textContent = "No input focused";
        rpIcStats.classList.remove("active");
      },
      listenerOptions,
    );

    const MAX_SNIPPETS = 5;
    let rpSnippets = Array.from({ length: MAX_SNIPPETS }, () => ({
      label: "",
      text: "",
    }));
    let snipEditMode = false;

    function renderSnippetChips() {
      snipChipsEl.innerHTML = "";
      const hasSome = rpSnippets.some((s) => s.label.trim() || s.text.trim());
      if (!hasSome) {
        const empty = document.createElement("span");
        empty.className = "rp-empty-state";
        empty.style.padding = "8px 0";
        empty.textContent = "No snippets — click Edit to add.";
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
        textTa.placeholder = "Text to insert…";
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
        btn.textContent = label.length > 9 ? label.slice(0, 8) + "…" : label;
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
      rewriteStatusEl.textContent = "Running…";
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
          rewriteStatusEl.textContent = `✓ Done · ${e.detail.model} · ${e.detail.elapsed}s`;
          rewriteStatusEl.className = "rp-hint rp-status-ok";
        }
      },
      listenerOptions,
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
  }

  window.SCRPGTrackerRpTools = Object.assign(
    {},
    window.SCRPGTrackerRpTools || {},
    {
      createRpToolsModule,
    },
  );
})();
