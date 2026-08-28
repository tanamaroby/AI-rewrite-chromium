(function () {
  "use strict";

  function createResourcesSection(deps) {
    const storageKey = deps.storageKey;
    const addLog = deps.addLog;
    const getResources = deps.getResources;
    const setResources = deps.setResources;
    const fmtVal = (v) =>
      window.AIRewriterContentUtils?.formatResourceValue(v) ?? String(v ?? "");

    const resListEl = document.getElementById("sc-np-res-list");
    const resSelectEl = document.getElementById("sc-np-res-select");
    const resAmountEl = document.getElementById("sc-np-res-amount");
    const resAdjustPanel = document.getElementById("sc-np-res-adjust");
    const resFbEl = document.getElementById("sc-np-res-fb");

    let resSaveTimer = null;
    let resFbTimer = null;

    function newRes() {
      return { id: Date.now() + Math.random(), name: "", value: 0, notes: "" };
    }

    function save() {
      chrome.storage.local.set({ [storageKey]: getResources() });
    }

    function scheduleSave() {
      clearTimeout(resSaveTimer);
      resSaveTimer = setTimeout(save, 500);
    }

    function showResFeedback(msg) {
      if (!resFbEl) return;
      resFbEl.textContent = msg;
      resFbEl.classList.add("visible");
      clearTimeout(resFbTimer);
      resFbTimer = setTimeout(() => resFbEl.classList.remove("visible"), 1600);
    }

    function rebuildResSelect(keepId) {
      if (!resSelectEl || !resAdjustPanel) return;
      const resources = getResources();
      const prev = keepId ?? resSelectEl.value;
      resSelectEl.innerHTML = "<option value=''>Select resource…</option>";
      resources.forEach((r) => {
        const opt = document.createElement("option");
        opt.value = r.id;
        opt.textContent = (r.name.trim() || "(unnamed)") + "  —  " + r.value;
        resSelectEl.appendChild(opt);
      });
      if (prev) resSelectEl.value = prev;
      resAdjustPanel.style.display = resources.length ? "" : "none";
    }

    function render() {
      const resources = getResources();
      if (!resListEl) return;
      resListEl.innerHTML = "";
      if (!resources.length) {
        const e = document.createElement("div");
        e.className = "ql-empty-state";
        e.style.padding = "6px 0";
        e.textContent = "No resources yet.";
        resListEl.appendChild(e);
        rebuildResSelect();
        return;
      }
      resources.forEach((r, idx) => {
        const row = document.createElement("div");
        row.className = "res-item";
        row.dataset.resId = r.id;

        const topRow = document.createElement("div");
        topRow.className = "res-item-top";

        const nameSpan = document.createElement("span");
        nameSpan.className = "item-disp-name";
        nameSpan.textContent = r.name || "(unnamed)";

        const nameEditIn = document.createElement("input");
        nameEditIn.type = "text";
        nameEditIn.className = "af-input";
        nameEditIn.value = r.name;
        nameEditIn.placeholder = "Resource name…";
        nameEditIn.maxLength = 40;
        nameEditIn.style.display = "none";
        nameEditIn.setAttribute("data-ai-rewriter-ignore", "1");
        nameEditIn.addEventListener("input", () => {
          r.name = nameEditIn.value;
          scheduleSave();
          rebuildResSelect(r.id);
        });

        const valEl = document.createElement("span");
        valEl.className = "res-value";
        valEl.textContent = r.value;
        row._valEl = valEl;

        const toggleBtn = document.createElement("button");
        toggleBtn.className = "item-toggle-btn edit";
        toggleBtn.textContent = "✎";
        let isEditing = false;

        const delBtn = document.createElement("button");
        delBtn.className = "res-delete-btn";
        delBtn.title = "Remove";
        delBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        delBtn.addEventListener("click", () => {
          addLog(`[Resource removed: ${r.name || "(unnamed)"}]`);
          resources.splice(idx, 1);
          save();
          render();
        });

        topRow.append(nameSpan, nameEditIn, valEl, toggleBtn, delBtn);

        const notesSpan = document.createElement("div");
        notesSpan.className = "item-disp-note";
        notesSpan.textContent = r.notes;
        notesSpan.style.display = r.notes ? "" : "none";

        const notesEditIn = document.createElement("input");
        notesEditIn.type = "text";
        notesEditIn.className = "af-input";
        notesEditIn.value = r.notes || "";
        notesEditIn.style.display = "none";
        notesEditIn.placeholder = "Notes… e.g. used for healing, max 100";
        notesEditIn.maxLength = 80;
        notesEditIn.setAttribute("data-ai-rewriter-ignore", "1");
        notesEditIn.addEventListener("input", () => {
          r.notes = notesEditIn.value;
          scheduleSave();
        });

        toggleBtn.addEventListener("click", () => {
          isEditing = !isEditing;
          if (isEditing) {
            nameSpan.style.display = "none";
            nameEditIn.style.display = "";
            notesSpan.style.display = "none";
            notesEditIn.style.display = "";
            toggleBtn.className = "item-toggle-btn save";
            toggleBtn.textContent = "✓ Save";
            nameEditIn.value = r.name;
            notesEditIn.value = r.notes || "";
            nameEditIn.focus();
          } else {
            nameEditIn.style.display = "none";
            nameSpan.style.display = "";
            notesEditIn.style.display = "none";
            toggleBtn.className = "item-toggle-btn edit";
            toggleBtn.textContent = "✎";
            nameSpan.textContent = r.name || "(unnamed)";
            notesSpan.textContent = r.notes;
            notesSpan.style.display = r.notes ? "" : "none";
          }
        });

        row.append(topRow, notesSpan, notesEditIn);
        resListEl.appendChild(row);
      });
      rebuildResSelect();
    }

    (function mountAddForm() {
      if (!resListEl || !resListEl.parentNode) return;
      const form = document.createElement("div");
      form.className = "af-form";
      const nameIn = document.createElement("input");
      nameIn.type = "text";
      nameIn.className = "af-input";
      nameIn.placeholder = "Resource name…";
      nameIn.maxLength = 40;
      nameIn.setAttribute("data-ai-rewriter-ignore", "1");
      const valIn = document.createElement("input");
      valIn.type = "number";
      valIn.className = "af-number";
      valIn.value = "0";
      valIn.min = "0";
      valIn.setAttribute("data-ai-rewriter-ignore", "1");
      const notesIn = document.createElement("input");
      notesIn.type = "text";
      notesIn.className = "af-input";
      notesIn.placeholder = "Notes (optional)…";
      notesIn.maxLength = 80;
      notesIn.setAttribute("data-ai-rewriter-ignore", "1");
      const submitBtn = document.createElement("button");
      submitBtn.className = "af-submit";
      submitBtn.textContent = "+ Add Resource";
      const row1 = document.createElement("div");
      row1.className = "af-row";
      row1.append(nameIn, valIn, submitBtn);
      form.append(row1, notesIn);
      resListEl.parentNode.insertBefore(form, resListEl);
      const doAdd = () => {
        const resources = getResources();
        const name = nameIn.value.trim();
        const value = parseInt(valIn.value, 10) || 0;
        const notes = notesIn.value.trim();
        const r = newRes();
        r.name = name;
        r.value = value;
        r.notes = notes;
        resources.push(r);
        save();
        render();
        const notesPart = notes ? ` — ${notes}` : "";
        addLog(
          `[Resource added: ${name || "(unnamed)"}${notesPart} (value: ${fmtVal(value)})]`,
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

    function applyResOp(op) {
      const resources = getResources();
      if (!resSelectEl || !resAmountEl || !resListEl) return;
      const id = resSelectEl.value;
      if (!id) {
        showResFeedback("Pick a resource first.");
        return;
      }
      const amount = Math.max(0, parseInt(resAmountEl.value, 10) || 0);
      const r = resources.find((x) => String(x.id) === id);
      if (!r) return;
      const before = r.value;
      if (op === "add") r.value += amount;
      else if (op === "sub") r.value = Math.max(0, r.value - amount);
      else if (op === "set") r.value = amount;
      const row = resListEl.querySelector(`[data-res-id="${id}"]`);
      if (row && row._valEl) row._valEl.textContent = r.value;
      rebuildResSelect(id);
      save();
      const notePart = r.notes ? ` (${r.notes})` : "";
      let logMsg;
      if (op === "add") {
        logMsg = `[${r.name || "Resource"}: gained ${fmtVal(amount)}, ${fmtVal(before)} → ${fmtVal(r.value)} total${notePart}]`;
      } else if (op === "sub") {
        logMsg = `[${r.name || "Resource"}: used ${fmtVal(amount)}, ${fmtVal(before)} → ${fmtVal(r.value)} left${notePart}]`;
      } else {
        logMsg = `[${r.name || "Resource"}: set to ${fmtVal(r.value)}${notePart}]`;
      }
      showResFeedback(
        op === "set"
          ? `= ${fmtVal(r.value)}`
          : `${op === "add" ? "+" : "−"}${fmtVal(amount)} → ${fmtVal(r.value)}`,
      );
      addLog(logMsg);
    }

    document
      .getElementById("sc-np-res-op-add")
      ?.addEventListener("click", () => applyResOp("add"));
    document
      .getElementById("sc-np-res-op-sub")
      ?.addEventListener("click", () => applyResOp("sub"));
    document
      .getElementById("sc-np-res-op-set")
      ?.addEventListener("click", () => applyResOp("set"));

    function load() {
      chrome.storage.local.get(storageKey, (d) => {
        setResources(Array.isArray(d[storageKey]) ? d[storageKey] : []);
        render();
      });
    }

    function exportLine() {
      const resources = getResources();
      if (!resources.length) return "[Resources: none]";
      const parts = resources.map((r) => {
        const note = r.notes ? ` (${r.notes})` : "";
        return `${r.name || "(unnamed)"} ${r.value}${note}`;
      });
      return `[Resources: ${parts.join(" | ")}]`;
    }

    return {
      save,
      render,
      load,
      exportLine,
    };
  }

  function createAbilitiesSection(deps) {
    const storageKey = deps.storageKey;
    const addLog = deps.addLog;
    const autoResizeTextarea = deps.autoResizeTextarea;
    const getAbilities = deps.getAbilities;
    const setAbilities = deps.setAbilities;

    const ablListEl = document.getElementById("sc-np-abl-list");
    const ablRestBtn = document.getElementById("sc-np-abl-rest-btn");
    const ablRestNotesEl = document.getElementById("sc-np-abl-rest-notes");
    const ablRestDetailedEl = document.getElementById("sc-np-abl-rest-detailed");

    let ablSaveTimer = null;

    // Global preference (not per-chat, like the abilities data itself) —
    // off by default. Off logs a single compact "all abilities restored"
    // line; on restores the previous behavior of listing every ability's
    // before/after state.
    let restDetailedLog = false;
    if (ablRestDetailedEl) {
      chrome.storage.sync.get(["scAbilityRestDetailedLog"], (d) => {
        restDetailedLog = d.scAbilityRestDetailedLog === true;
        ablRestDetailedEl.checked = restDetailedLog;
      });
      ablRestDetailedEl.addEventListener("change", () => {
        restDetailedLog = ablRestDetailedEl.checked;
        chrome.storage.sync.set({ scAbilityRestDetailedLog: restDetailedLog });
      });
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "sync" && "scAbilityRestDetailedLog" in changes) {
          restDetailedLog = changes.scAbilityRestDetailedLog.newValue === true;
          ablRestDetailedEl.checked = restDetailedLog;
        }
      });
    }

    function newAbility() {
      return {
        id: Date.now() + Math.random(),
        name: "",
        notes: "",
        current: 3,
        max: 3,
      };
    }

    function save() {
      chrome.storage.local.set({ [storageKey]: getAbilities() });
    }

    function scheduleSave() {
      clearTimeout(ablSaveTimer);
      ablSaveTimer = setTimeout(save, 500);
    }

    function formatAbilityRestLogLine(changes, note) {
      const restoredCount = changes.filter(
        (change) => change.before !== change.after,
      ).length;
      const summary = changes.length
        ? changes
            .map((change) => {
              const label = change.name || "(unnamed)";
              if (change.before === change.after) {
                return `${label} ${change.after}/${change.max}`;
              }
              return `${label} ${change.before}/${change.max} → ${change.after}/${change.max}`;
            })
            .join(" | ")
        : "No abilities tracked";
      const notePart = note ? ` — Notes: ${note}` : "";
      return `[Rest: ${restoredCount} restored — ${summary}${notePart}]`;
    }

    // Detailed rest log toggle off (default): no per-ability breakdown, just
    // the fact that everyone's topped up plus whatever notes were typed.
    function formatAbilityRestLogLineCompact(note) {
      const notePart = note ? ` — Notes: ${note}` : "";
      return `[Rest: All abilities restored${notePart}]`;
    }

    function applyAbilityRest() {
      const abilities = getAbilities();
      const note = (ablRestNotesEl?.value || "").trim();
      if (!abilities.length) {
        addLog(
          `[Rest: no abilities tracked${note ? ` — Notes: ${note}` : ""}]`,
        );
        if (ablRestNotesEl) {
          ablRestNotesEl.value = "";
          autoResizeTextarea(ablRestNotesEl);
        }
        return;
      }

      const changes = abilities.map((a) => {
        const before = Math.max(0, Number(a.current) || 0);
        const max = Math.max(1, Number(a.max) || 1);
        a.current = max;
        return {
          name: (a.name || "").trim(),
          before,
          after: max,
          max,
        };
      });

      save();
      addLog(
        restDetailedLog
          ? formatAbilityRestLogLine(changes, note)
          : formatAbilityRestLogLineCompact(note),
      );
      if (ablRestNotesEl) {
        ablRestNotesEl.value = "";
        autoResizeTextarea(ablRestNotesEl);
      }
      render();
    }

    function render() {
      const abilities = getAbilities();
      if (!ablListEl) return;

      if (ablRestBtn) {
        ablRestBtn.disabled = abilities.length === 0;
        ablRestBtn.textContent = abilities.length ? "Take Rest" : "No Rest";
      }
      ablListEl.innerHTML = "";
      if (!abilities.length) {
        const e = document.createElement("div");
        e.className = "ql-empty-state";
        e.style.padding = "6px 0";
        e.textContent = "No abilities yet.";
        ablListEl.appendChild(e);
        return;
      }
      abilities.forEach((a, idx) => {
        const wrapper = document.createElement("div");
        wrapper.style.cssText =
          "display:flex;flex-direction:column;gap:4px;padding:5px 0;border-bottom:1px solid rgba(var(--sc-accent-rgb), 0.07);";
        if (idx === abilities.length - 1) wrapper.style.borderBottom = "none";

        const topRow = document.createElement("div");
        topRow.className = "abl-item";

        const nameSpan = document.createElement("span");
        nameSpan.className = "item-disp-name";
        nameSpan.style.fontSize = "12px";
        nameSpan.textContent = a.name || "(unnamed)";

        const nameEditIn = document.createElement("input");
        nameEditIn.type = "text";
        nameEditIn.className = "af-input";
        nameEditIn.value = a.name;
        nameEditIn.placeholder = "Ability name…";
        nameEditIn.maxLength = 40;
        nameEditIn.style.display = "none";
        nameEditIn.setAttribute("data-ai-rewriter-ignore", "1");
        nameEditIn.addEventListener("input", () => {
          a.name = nameEditIn.value;
          scheduleSave();
        });

        const curEl = document.createElement("span");
        curEl.className = "abl-cur";
        curEl.textContent = a.current;
        curEl.style.opacity = a.current === 0 ? "0.35" : "1";

        const sep = document.createElement("span");
        sep.className = "abl-sep";
        sep.textContent = "/";

        const maxSpan = document.createElement("span");
        maxSpan.className = "abl-sep";
        maxSpan.textContent = a.max;

        const maxEditIn = document.createElement("input");
        maxEditIn.type = "number";
        maxEditIn.className = "abl-max-input";
        maxEditIn.value = a.max;
        maxEditIn.min = 1;
        maxEditIn.max = 99;
        maxEditIn.style.display = "none";
        maxEditIn.setAttribute("data-ai-rewriter-ignore", "1");
        maxEditIn.addEventListener("input", () => {
          a.max = Math.max(1, parseInt(maxEditIn.value, 10) || 1);
          scheduleSave();
        });

        const resetBtn = document.createElement("button");
        resetBtn.className = "abl-reset-btn";
        resetBtn.textContent = "RST";
        resetBtn.addEventListener("click", () => {
          a.current = a.max;
          save();
          const notesPart = a.notes ? ` (${a.notes})` : "";
          addLog(
            `[${a.name || "Ability"} restored — ${a.current}/${a.max}${notesPart}]`,
          );
          render();
        });

        const toggleBtn = document.createElement("button");
        toggleBtn.className = "item-toggle-btn edit";
        toggleBtn.textContent = "✎";
        let isEditing = false;

        const delBtn = document.createElement("button");
        delBtn.className = "abl-delete-btn";
        delBtn.title = "Remove";
        delBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        delBtn.addEventListener("click", () => {
          const notesPart = a.notes ? ` (${a.notes})` : "";
          addLog(`[Ability removed: ${a.name || "(unnamed)"}${notesPart}]`);
          abilities.splice(idx, 1);
          save();
          render();
        });

        topRow.append(
          nameSpan,
          nameEditIn,
          curEl,
          sep,
          maxSpan,
          maxEditIn,
          resetBtn,
          toggleBtn,
          delBtn,
        );

        const notesSpan = document.createElement("div");
        notesSpan.className = "item-disp-note";
        notesSpan.textContent = a.notes;
        notesSpan.style.display = a.notes ? "" : "none";

        const notesEditIn = document.createElement("textarea");
        notesEditIn.className = "af-textarea";
        notesEditIn.value = a.notes || "";
        notesEditIn.placeholder =
          "Describe this ability, its effect, duration…";
        notesEditIn.rows = 1;
        notesEditIn.style.display = "none";
        notesEditIn.setAttribute("data-ai-rewriter-ignore", "1");
        notesEditIn.addEventListener("input", () => {
          a.notes = notesEditIn.value;
          autoResizeTextarea(notesEditIn);
          scheduleSave();
        });

        toggleBtn.addEventListener("click", () => {
          isEditing = !isEditing;
          if (isEditing) {
            nameSpan.style.display = "none";
            nameEditIn.style.display = "";
            maxSpan.style.display = "none";
            maxEditIn.style.display = "";
            notesSpan.style.display = "none";
            notesEditIn.style.display = "";
            toggleBtn.className = "item-toggle-btn save";
            toggleBtn.textContent = "✓ Save";
            nameEditIn.value = a.name;
            maxEditIn.value = a.max;
            notesEditIn.value = a.notes || "";
            setTimeout(() => autoResizeTextarea(notesEditIn), 0);
            nameEditIn.focus();
          } else {
            nameEditIn.style.display = "none";
            nameSpan.style.display = "";
            maxEditIn.style.display = "none";
            maxSpan.style.display = "";
            notesEditIn.style.display = "none";
            toggleBtn.className = "item-toggle-btn edit";
            toggleBtn.textContent = "✎";
            nameSpan.textContent = a.name || "(unnamed)";
            maxSpan.textContent = a.max;
            notesSpan.textContent = a.notes;
            notesSpan.style.display = a.notes ? "" : "none";
          }
        });

        const useRow = document.createElement("div");
        useRow.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;";
        const useCount = Math.min(a.max, 10);
        for (let i = 0; i < useCount; i++) {
          const btn = document.createElement("button");
          btn.style.cssText =
            "flex:1;min-width:28px;padding:4px 0;border-radius:5px;font-size:10px;font-weight:700;font-family:inherit;cursor:pointer;border:1px solid;transition:background 0.12s,opacity 0.12s;";
          const used = i >= a.current;
          btn.style.background = used
            ? "rgba(var(--sc-accent-rgb), 0.04)"
            : "rgba(var(--sc-accent-rgb), 0.15)";
          btn.style.borderColor = used
            ? "rgba(var(--sc-accent-rgb), 0.1)"
            : "rgba(var(--sc-accent-rgb), 0.4)";
          btn.style.color = used ? "var(--sc-slate-700)" : "var(--sc-accent-2)";
          btn.style.opacity = used ? "0.4" : "1";
          btn.textContent = "Use";
          btn.disabled = a.current === 0;
          btn.addEventListener("click", () => {
            if (a.current <= 0) return;
            a.current--;
            curEl.textContent = a.current;
            curEl.style.opacity = a.current === 0 ? "0.35" : "1";
            save();
            const notesPart = a.notes ? ` — ${a.notes}` : "";
            addLog(
              `[${a.name || "Ability"} used — ${a.current}/${a.max} remaining${notesPart}]`,
            );
            render();
          });
          useRow.appendChild(btn);
        }
        if (a.max > 10) {
          const more = document.createElement("span");
          more.style.cssText =
            "font-size:9.5px;color:var(--sc-slate-700);align-self:center;padding:0 4px;";
          more.textContent = `+${a.max - 10} more`;
          useRow.appendChild(more);
        }

        wrapper.append(topRow, notesSpan, notesEditIn, useRow);
        ablListEl.appendChild(wrapper);
      });
    }

    (function mountAddForm() {
      if (!ablListEl || !ablListEl.parentNode) return;
      const form = document.createElement("div");
      form.className = "af-form";
      const nameIn = document.createElement("input");
      nameIn.type = "text";
      nameIn.className = "af-input";
      nameIn.placeholder = "Ability name…";
      nameIn.maxLength = 40;
      nameIn.setAttribute("data-ai-rewriter-ignore", "1");
      const maxIn = document.createElement("input");
      maxIn.type = "number";
      maxIn.className = "af-number";
      maxIn.value = "3";
      maxIn.min = "1";
      maxIn.max = "99";
      maxIn.setAttribute("data-ai-rewriter-ignore", "1");
      const notesIn = document.createElement("textarea");
      notesIn.className = "af-textarea";
      notesIn.rows = 1;
      notesIn.placeholder = "Description, effect, duration (optional)…";
      notesIn.setAttribute("data-ai-rewriter-ignore", "1");
      const submitBtn = document.createElement("button");
      submitBtn.className = "af-submit";
      submitBtn.textContent = "+ Add Ability";
      const row = document.createElement("div");
      row.className = "af-row";
      row.append(nameIn, maxIn, submitBtn);
      form.append(row, notesIn);
      ablListEl.parentNode.insertBefore(form, ablListEl);
      const doAdd = () => {
        const abilities = getAbilities();
        const name = nameIn.value.trim();
        const max = Math.max(1, parseInt(maxIn.value, 10) || 3);
        const notes = notesIn.value.trim();
        const abl = newAbility();
        abl.name = name;
        abl.max = max;
        abl.current = max;
        abl.notes = notes;
        abilities.push(abl);
        save();
        render();
        const notesPart = notes ? ` — ${notes}` : "";
        addLog(
          `[Ability added: ${name || "(unnamed)"}${notesPart} (${max}/${max} uses)]`,
        );
        nameIn.value = "";
        maxIn.value = "3";
        notesIn.value = "";
        autoResizeTextarea(notesIn);
        nameIn.focus();
      };
      submitBtn.addEventListener("click", doAdd);
      nameIn.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          doAdd();
        }
      });
      notesIn.addEventListener("input", () => autoResizeTextarea(notesIn));
    })();

    ablRestBtn?.addEventListener("click", applyAbilityRest);
    ablRestNotesEl?.addEventListener("input", () =>
      autoResizeTextarea(ablRestNotesEl),
    );

    function load() {
      chrome.storage.local.get(storageKey, (d) => {
        setAbilities(Array.isArray(d[storageKey]) ? d[storageKey] : []);
        render();
      });
    }

    function exportLine() {
      const abilities = getAbilities();
      if (!abilities.length) return "[Abilities: none]";
      const parts = abilities.map((a) => {
        const note = a.notes ? ` (${a.notes})` : "";
        return `${a.name || "(unnamed)"} ${a.current}/${a.max}${note}`;
      });
      return `[Abilities: ${parts.join(" | ")}]`;
    }

    return {
      save,
      render,
      load,
      exportLine,
    };
  }

  function createPartySection(deps) {
    const storageKey = deps.storageKey;
    const addLog = deps.addLog;
    const getParty = deps.getParty;
    const setParty = deps.setParty;
    const normalizePartyStatus = deps.normalizePartyStatus;
    const partyStatusToneClass = deps.partyStatusToneClass;
    const normalizeImportedPartyMember = deps.normalizeImportedPartyMember;
    const defaultStatus = deps.defaultStatus;
    const statusPresets = Array.isArray(deps.statusPresets)
      ? deps.statusPresets
      : [];

    const partyListEl = document.getElementById("sc-np-party-list");

    let partySaveTimer = null;

    function newPartyMember() {
      return {
        id: Date.now() + Math.random(),
        name: "",
        notes: "",
        equipment: "",
        affiliation: "",
        status: defaultStatus,
      };
    }

    function getPartyDetailsParts(member) {
      const parts = [];
      const notes = String(member?.notes || "").trim();
      const equipment = String(member?.equipment || "").trim();
      const affiliation = String(member?.affiliation || "").trim();
      if (notes) parts.push(`Notes: ${notes}`);
      if (equipment) parts.push(`Equipment: ${equipment}`);
      if (affiliation) parts.push(`Affiliation: ${affiliation}`);
      return parts;
    }

    function getPartyDetailsSuffix(member) {
      const parts = getPartyDetailsParts(member);
      return parts.length ? ` (${parts.join("; ")})` : "";
    }

    function save() {
      chrome.storage.local.set({ [storageKey]: getParty() });
    }

    function scheduleSave() {
      clearTimeout(partySaveTimer);
      partySaveTimer = setTimeout(save, 500);
    }

    function render() {
      const party = getParty();
      if (!partyListEl) return;
      partyListEl.innerHTML = "";
      if (!party.length) {
        const e = document.createElement("div");
        e.className = "ql-empty-state";
        e.style.padding = "6px 0";
        e.textContent = "No party members yet.";
        partyListEl.appendChild(e);
        return;
      }
      party.forEach((m, idx) => {
        const row = document.createElement("div");
        row.className = "party-item";
        const top = document.createElement("div");
        top.className = "party-top";
        const statusPill = document.createElement("span");
        statusPill.className =
          "party-status-pill party-status-" + partyStatusToneClass(m.status);
        statusPill.textContent = normalizePartyStatus(m.status);
        const nameSpan = document.createElement("span");
        nameSpan.className = "item-disp-name";
        nameSpan.textContent = m.name || "(unnamed)";
        const nameEditIn = document.createElement("input");
        nameEditIn.type = "text";
        nameEditIn.className = "af-input";
        nameEditIn.value = m.name;
        nameEditIn.placeholder = "Name…";
        nameEditIn.maxLength = 40;
        nameEditIn.style.display = "none";
        nameEditIn.setAttribute("data-ai-rewriter-ignore", "1");
        nameEditIn.addEventListener("input", () => {
          m.name = nameEditIn.value;
          scheduleSave();
        });
        const notesSpan = document.createElement("div");
        notesSpan.className = "item-disp-note";
        notesSpan.textContent = m.notes ? `Notes: ${m.notes}` : "";
        notesSpan.style.display = m.notes ? "" : "none";
        const notesEditIn = document.createElement("input");
        notesEditIn.type = "text";
        notesEditIn.className = "party-note-input";
        notesEditIn.value = m.notes || "";
        notesEditIn.placeholder = "Notes (optional)…";
        notesEditIn.style.display = "none";
        notesEditIn.setAttribute("data-ai-rewriter-ignore", "1");
        notesEditIn.addEventListener("input", () => {
          m.notes = notesEditIn.value;
          scheduleSave();
        });
        const equipmentSpan = document.createElement("div");
        equipmentSpan.className = "item-disp-note";
        equipmentSpan.textContent = m.equipment
          ? `Equipment: ${m.equipment}`
          : "";
        equipmentSpan.style.display = m.equipment ? "" : "none";
        const equipmentEditIn = document.createElement("input");
        equipmentEditIn.type = "text";
        equipmentEditIn.className = "party-note-input";
        equipmentEditIn.value = m.equipment || "";
        equipmentEditIn.placeholder = "Equipment (optional)…";
        equipmentEditIn.maxLength = 120;
        equipmentEditIn.style.display = "none";
        equipmentEditIn.setAttribute("data-ai-rewriter-ignore", "1");
        equipmentEditIn.addEventListener("input", () => {
          m.equipment = equipmentEditIn.value;
          scheduleSave();
        });
        const affiliationSpan = document.createElement("div");
        affiliationSpan.className = "item-disp-note";
        affiliationSpan.textContent = m.affiliation
          ? `Affiliation: ${m.affiliation}`
          : "";
        affiliationSpan.style.display = m.affiliation ? "" : "none";
        const affiliationEditIn = document.createElement("input");
        affiliationEditIn.type = "text";
        affiliationEditIn.className = "party-note-input";
        affiliationEditIn.value = m.affiliation || "";
        affiliationEditIn.placeholder = "Affiliation (optional)…";
        affiliationEditIn.maxLength = 120;
        affiliationEditIn.style.display = "none";
        affiliationEditIn.setAttribute("data-ai-rewriter-ignore", "1");
        affiliationEditIn.addEventListener("input", () => {
          m.affiliation = affiliationEditIn.value;
          scheduleSave();
        });
        const statusEditIn = document.createElement("input");
        statusEditIn.type = "text";
        statusEditIn.className = "party-status-input";
        statusEditIn.value = normalizePartyStatus(m.status);
        statusEditIn.placeholder = "Status…";
        statusEditIn.maxLength = 40;
        statusEditIn.style.display = "none";
        statusEditIn.setAttribute("data-ai-rewriter-ignore", "1");
        statusEditIn.setAttribute("list", "sc-np-party-status-list");
        statusEditIn.addEventListener("input", () => {
          m.status = normalizePartyStatus(statusEditIn.value);
          scheduleSave();
        });
        const toggleBtn = document.createElement("button");
        toggleBtn.className = "item-toggle-btn edit";
        toggleBtn.textContent = "✎";
        let isEditing = false;
        let statusBeforeEdit = normalizePartyStatus(m.status);
        toggleBtn.addEventListener("click", () => {
          isEditing = !isEditing;
          if (isEditing) {
            nameSpan.style.display = "none";
            nameEditIn.style.display = "";
            statusPill.style.display = "none";
            statusEditIn.style.display = "";
            notesSpan.style.display = "none";
            notesEditIn.style.display = "";
            equipmentSpan.style.display = "none";
            equipmentEditIn.style.display = "";
            affiliationSpan.style.display = "none";
            affiliationEditIn.style.display = "";
            toggleBtn.className = "item-toggle-btn save";
            toggleBtn.textContent = "✓ Save";
            nameEditIn.value = m.name;
            statusBeforeEdit = normalizePartyStatus(m.status);
            statusEditIn.value = statusBeforeEdit;
            notesEditIn.value = m.notes || "";
            equipmentEditIn.value = m.equipment || "";
            affiliationEditIn.value = m.affiliation || "";
            nameEditIn.focus();
          } else {
            m.status = normalizePartyStatus(statusEditIn.value);
            nameEditIn.style.display = "none";
            nameSpan.style.display = "";
            statusEditIn.style.display = "none";
            statusPill.className =
              "party-status-pill party-status-" +
              partyStatusToneClass(m.status);
            statusPill.textContent = normalizePartyStatus(m.status);
            statusPill.style.display = "";
            notesEditIn.style.display = "none";
            notesSpan.textContent = m.notes ? `Notes: ${m.notes}` : "";
            notesSpan.style.display = m.notes ? "" : "none";
            equipmentEditIn.style.display = "none";
            equipmentSpan.textContent = m.equipment
              ? `Equipment: ${m.equipment}`
              : "";
            equipmentSpan.style.display = m.equipment ? "" : "none";
            affiliationEditIn.style.display = "none";
            affiliationSpan.textContent = m.affiliation
              ? `Affiliation: ${m.affiliation}`
              : "";
            affiliationSpan.style.display = m.affiliation ? "" : "none";
            toggleBtn.className = "item-toggle-btn edit";
            toggleBtn.textContent = "✎";
            nameSpan.textContent = m.name || "(unnamed)";
            const statusAfterEdit = normalizePartyStatus(m.status);
            if (statusAfterEdit !== statusBeforeEdit) {
              addLog(
                `[Party: ${m.name || "(unnamed)"} status ${statusBeforeEdit} → ${statusAfterEdit}]`,
              );
            }
          }
        });
        const delBtn = document.createElement("button");
        delBtn.className = "party-delete-btn";
        delBtn.title = "Remove";
        delBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        delBtn.addEventListener("click", () => {
          addLog(
            `[Party: ${m.name || "(unnamed)"} removed${getPartyDetailsSuffix(m)}]`,
          );
          party.splice(idx, 1);
          save();
          render();
        });
        top.append(
          statusPill,
          nameSpan,
          nameEditIn,
          statusEditIn,
          toggleBtn,
          delBtn,
        );
        row.append(
          top,
          notesSpan,
          equipmentSpan,
          affiliationSpan,
          notesEditIn,
          equipmentEditIn,
          affiliationEditIn,
        );
        partyListEl.appendChild(row);
      });
    }

    (function mountAddForm() {
      if (!partyListEl || !partyListEl.parentNode) return;
      const form = document.createElement("div");
      form.className = "af-form";
      const nameIn = document.createElement("input");
      nameIn.type = "text";
      nameIn.className = "af-input";
      nameIn.placeholder = "Member name…";
      nameIn.maxLength = 40;
      nameIn.setAttribute("data-ai-rewriter-ignore", "1");
      const statusIn = document.createElement("input");
      statusIn.type = "text";
      statusIn.className = "af-input";
      statusIn.placeholder = "Status…";
      statusIn.maxLength = 40;
      statusIn.style.maxWidth = "120px";
      statusIn.value = defaultStatus;
      statusIn.setAttribute("data-ai-rewriter-ignore", "1");
      statusIn.setAttribute("list", "sc-np-party-status-list");
      const statusList = document.createElement("datalist");
      statusList.id = "sc-np-party-status-list";
      statusPresets.forEach((status) => {
        const opt = document.createElement("option");
        opt.value = status;
        statusList.appendChild(opt);
      });
      const notesIn = document.createElement("input");
      notesIn.type = "text";
      notesIn.className = "af-input";
      notesIn.placeholder = "Notes (optional)…";
      notesIn.setAttribute("data-ai-rewriter-ignore", "1");
      const equipmentIn = document.createElement("input");
      equipmentIn.type = "text";
      equipmentIn.className = "af-input";
      equipmentIn.placeholder = "Equipment (optional)…";
      equipmentIn.maxLength = 120;
      equipmentIn.setAttribute("data-ai-rewriter-ignore", "1");
      const affiliationIn = document.createElement("input");
      affiliationIn.type = "text";
      affiliationIn.className = "af-input";
      affiliationIn.placeholder = "Affiliation (optional)…";
      affiliationIn.maxLength = 120;
      affiliationIn.setAttribute("data-ai-rewriter-ignore", "1");
      const submitBtn = document.createElement("button");
      submitBtn.className = "af-submit";
      submitBtn.textContent = "+ Add";
      const row = document.createElement("div");
      row.className = "af-row";
      row.append(nameIn, statusIn, submitBtn);
      form.append(row, notesIn, equipmentIn, affiliationIn);
      form.appendChild(statusList);
      partyListEl.parentNode.insertBefore(form, partyListEl);
      const doAdd = () => {
        const party = getParty();
        const name = nameIn.value.trim();
        const status = normalizePartyStatus(statusIn.value);
        const notes = notesIn.value.trim();
        const equipment = equipmentIn.value.trim();
        const affiliation = affiliationIn.value.trim();
        const member = newPartyMember();
        member.name = name;
        member.status = status;
        member.notes = notes;
        member.equipment = equipment;
        member.affiliation = affiliation;
        party.push(member);
        save();
        render();
        addLog(
          `[Party: ${name || "(unnamed)"} joined — ${status}${getPartyDetailsSuffix(member)}]`,
        );
        nameIn.value = "";
        statusIn.value = defaultStatus;
        notesIn.value = "";
        equipmentIn.value = "";
        affiliationIn.value = "";
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

    function load() {
      chrome.storage.local.get(storageKey, (d) => {
        const incoming = Array.isArray(d[storageKey]) ? d[storageKey] : [];
        const next = incoming
          .map((member, idx) => normalizeImportedPartyMember(member, idx))
          .filter(Boolean);
        setParty(next);
        const migrated = JSON.stringify(incoming) !== JSON.stringify(next);
        if (migrated) save();
        render();
      });
    }

    function exportLine() {
      const party = getParty();
      if (!party.length) return "[Party: none]";
      const parts = party.map((m) => {
        return `${m.name || "(unnamed)"} — ${m.status}${getPartyDetailsSuffix(m)}`;
      });
      return `[Party: ${parts.join(" | ")}]`;
    }

    return {
      save,
      render,
      load,
      exportLine,
    };
  }

  function createNpcsSection(deps) {
    const storageKey = deps.storageKey;
    const addLog = deps.addLog;
    const getNpcs = deps.getNpcs;
    const setNpcs = deps.setNpcs;

    const NPC_DISPS = ["friendly", "neutral", "hostile"];
    const DISP_LABELS = {
      friendly: "Friendly",
      neutral: "Neutral",
      hostile: "Hostile",
    };

    const npcListEl = document.getElementById("sc-np-npc-list");

    let npcSaveTimer = null;

    function newNpc() {
      return {
        id: Date.now() + Math.random(),
        name: "",
        note: "",
        disp: "neutral",
      };
    }

    function save() {
      chrome.storage.local.set({ [storageKey]: getNpcs() });
    }

    function scheduleSave() {
      clearTimeout(npcSaveTimer);
      npcSaveTimer = setTimeout(save, 500);
    }

    function render() {
      const npcs = getNpcs();
      if (!npcListEl) return;
      npcListEl.innerHTML = "";
      if (!npcs.length) {
        const e = document.createElement("div");
        e.className = "ql-empty-state";
        e.style.padding = "6px 0";
        e.textContent = "No NPCs yet.";
        npcListEl.appendChild(e);
        return;
      }
      npcs.forEach((n, idx) => {
        const card = document.createElement("div");
        card.className = "npc-item";
        const top = document.createElement("div");
        top.className = "npc-top";
        const dispBtn = document.createElement("button");
        dispBtn.className = "npc-disp-btn npc-disp-" + n.disp;
        dispBtn.textContent = DISP_LABELS[n.disp];
        dispBtn.title = "Click to cycle disposition";
        dispBtn.addEventListener("click", () => {
          const cur = NPC_DISPS.indexOf(n.disp);
          n.disp = NPC_DISPS[(cur + 1) % NPC_DISPS.length];
          dispBtn.className = "npc-disp-btn npc-disp-" + n.disp;
          dispBtn.textContent = DISP_LABELS[n.disp];
          addLog(`[NPC ${n.name || "(unnamed)"} → ${n.disp}]`);
          save();
        });
        const nameSpan = document.createElement("span");
        nameSpan.className = "item-disp-name";
        nameSpan.textContent = n.name || "(unnamed)";
        const nameEditIn = document.createElement("input");
        nameEditIn.type = "text";
        nameEditIn.className = "af-input";
        nameEditIn.value = n.name;
        nameEditIn.placeholder = "NPC name…";
        nameEditIn.maxLength = 40;
        nameEditIn.style.display = "none";
        nameEditIn.setAttribute("data-ai-rewriter-ignore", "1");
        nameEditIn.addEventListener("input", () => {
          n.name = nameEditIn.value;
          scheduleSave();
        });
        const toggleBtn = document.createElement("button");
        toggleBtn.className = "item-toggle-btn edit";
        toggleBtn.textContent = "✎";
        let isEditing = false;
        const delBtn = document.createElement("button");
        delBtn.className = "npc-delete-btn";
        delBtn.title = "Remove";
        delBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        delBtn.addEventListener("click", () => {
          addLog(`[NPC removed: ${n.name || "(unnamed)"}]`);
          npcs.splice(idx, 1);
          save();
          render();
        });
        top.append(dispBtn, nameSpan, nameEditIn, toggleBtn, delBtn);

        const noteSpan = document.createElement("div");
        noteSpan.style.cssText =
          "color:var(--sc-slate-500);font-size:11.5px;font-family:inherit;padding:2px 0;";
        noteSpan.textContent = n.note;
        noteSpan.style.display = n.note ? "" : "none";
        const noteEditIn = document.createElement("input");
        noteEditIn.type = "text";
        noteEditIn.className = "af-input";
        noteEditIn.value = n.note;
        noteEditIn.placeholder = "Short note…";
        noteEditIn.maxLength = 80;
        noteEditIn.style.display = "none";
        noteEditIn.setAttribute("data-ai-rewriter-ignore", "1");
        noteEditIn.addEventListener("input", () => {
          n.note = noteEditIn.value;
          scheduleSave();
        });
        toggleBtn.addEventListener("click", () => {
          isEditing = !isEditing;
          if (isEditing) {
            nameSpan.style.display = "none";
            nameEditIn.style.display = "";
            noteSpan.style.display = "none";
            noteEditIn.style.display = "";
            toggleBtn.className = "item-toggle-btn save";
            toggleBtn.textContent = "✓ Save";
            nameEditIn.value = n.name;
            noteEditIn.value = n.note;
            nameEditIn.focus();
          } else {
            nameEditIn.style.display = "none";
            noteEditIn.style.display = "none";
            toggleBtn.className = "item-toggle-btn edit";
            toggleBtn.textContent = "✎";
            nameSpan.style.display = "";
            nameSpan.textContent = n.name || "(unnamed)";
            noteSpan.textContent = n.note;
            noteSpan.style.display = n.note ? "" : "none";
          }
        });
        card.append(top, noteSpan, noteEditIn);
        npcListEl.appendChild(card);
      });
    }

    (function mountAddForm() {
      if (!npcListEl || !npcListEl.parentNode) return;
      const form = document.createElement("div");
      form.className = "af-form";
      const nameIn = document.createElement("input");
      nameIn.type = "text";
      nameIn.className = "af-input";
      nameIn.placeholder = "NPC name…";
      nameIn.maxLength = 40;
      nameIn.setAttribute("data-ai-rewriter-ignore", "1");
      const noteIn = document.createElement("input");
      noteIn.type = "text";
      noteIn.className = "af-input";
      noteIn.placeholder = "Note (optional)…";
      noteIn.maxLength = 80;
      noteIn.setAttribute("data-ai-rewriter-ignore", "1");
      const dispSel = document.createElement("select");
      dispSel.className = "af-select";
      dispSel.style.maxWidth = "90px";
      dispSel.setAttribute("data-ai-rewriter-ignore", "1");
      NPC_DISPS.forEach((d) => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = DISP_LABELS[d];
        dispSel.appendChild(opt);
      });
      dispSel.value = "neutral";
      const submitBtn = document.createElement("button");
      submitBtn.className = "af-submit";
      submitBtn.textContent = "+ Add NPC";
      const row1 = document.createElement("div");
      row1.className = "af-row";
      row1.append(nameIn, dispSel, submitBtn);
      form.append(row1, noteIn);
      npcListEl.parentNode.insertBefore(form, npcListEl);
      const doAdd = () => {
        const npcs = getNpcs();
        const name = nameIn.value.trim();
        const note = noteIn.value.trim();
        const disp = dispSel.value || "neutral";
        const npc = newNpc();
        npc.name = name;
        npc.note = note;
        npc.disp = disp;
        npcs.push(npc);
        save();
        render();
        const notePart = note ? ` — ${note}` : "";
        addLog(`[NPC met: ${name || "(unnamed)"} (${disp})${notePart}]`);
        nameIn.value = "";
        noteIn.value = "";
        dispSel.value = "neutral";
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

    function load() {
      chrome.storage.local.get(storageKey, (d) => {
        setNpcs(Array.isArray(d[storageKey]) ? d[storageKey] : []);
        render();
      });
    }

    function exportLine() {
      const npcs = getNpcs();
      if (!npcs.length) return "[NPCs: none]";
      const parts = npcs.map(
        (n) =>
          `${n.name || "(unnamed)"} [${n.disp}]${n.note ? " — " + n.note : ""}`,
      );
      return `[NPCs: ${parts.join(" | ")}]`;
    }

    return {
      save,
      render,
      load,
      exportLine,
    };
  }

  function createRumoursSection(deps) {
    const storageKey = deps.storageKey;
    const addLog = deps.addLog;
    const autoResizeTextarea = deps.autoResizeTextarea;
    const getRumours = deps.getRumours;
    const setRumours = deps.setRumours;

    const rumourListEl = document.getElementById("sc-np-rumour-list");
    const rumourAddBtn = document.getElementById("sc-np-rumour-add");

    let rumourSaveTimer = null;

    function newRumour() {
      return { id: Date.now() + Math.random(), text: "", done: false };
    }

    function save() {
      chrome.storage.local.set({ [storageKey]: getRumours() });
    }

    function scheduleSave() {
      clearTimeout(rumourSaveTimer);
      rumourSaveTimer = setTimeout(save, 500);
    }

    function render() {
      const rumours = getRumours();
      if (!rumourListEl) return;
      rumourListEl.innerHTML = "";
      if (!rumours.length) {
        const e = document.createElement("div");
        e.className = "ql-empty-state";
        e.style.padding = "6px 0";
        e.textContent = "No rumours yet.";
        rumourListEl.appendChild(e);
        return;
      }
      rumours.forEach((r, idx) => {
        const row = document.createElement("div");
        row.className = "rumour-item" + (r.done ? " rumour-done" : "");
        const check = document.createElement("div");
        check.className = "rumour-check";
        check.title = "Mark as followed up";
        if (r.done)
          check.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--sc-success)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        check.addEventListener("click", () => {
          r.done = !r.done;
          addLog(
            `[Rumour ${r.done ? "followed up" : "reopened"}: "${(r.text || "(empty)").slice(0, 60)}"]`,
          );
          save();
          render();
        });
        const textIn = document.createElement("textarea");
        textIn.className = "rumour-text-input";
        textIn.value = r.text;
        textIn.placeholder = "Rumour or lead…";
        textIn.rows = 1;
        textIn.setAttribute("data-ai-rewriter-ignore", "1");
        textIn.addEventListener("input", () => {
          r.text = textIn.value;
          autoResizeTextarea(textIn);
          scheduleSave();
        });
        setTimeout(() => autoResizeTextarea(textIn), 0);
        const delBtn = document.createElement("button");
        delBtn.className = "rumour-delete-btn";
        delBtn.title = "Remove";
        delBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        delBtn.addEventListener("click", () => {
          addLog(`[Rumour removed: "${(r.text || "(empty)").slice(0, 60)}"]`);
          rumours.splice(idx, 1);
          save();
          render();
        });
        row.append(check, textIn, delBtn);
        rumourListEl.appendChild(row);
      });
    }

    rumourAddBtn?.addEventListener("click", () => {
      const rumours = getRumours();
      const rumour = newRumour();
      rumours.push(rumour);
      save();
      render();
      const inputs = rumourListEl?.querySelectorAll(".rumour-text-input") || [];
      if (inputs.length) {
        const lastInput = inputs[inputs.length - 1];
        lastInput.focus();
        const logOnBlur = () => {
          lastInput.removeEventListener("blur", logOnBlur);
          if (rumour.text.trim())
            addLog(`[Rumour added: "${rumour.text.slice(0, 60)}"]`);
        };
        lastInput.addEventListener("blur", logOnBlur);
      }
    });

    function load() {
      chrome.storage.local.get(storageKey, (d) => {
        setRumours(Array.isArray(d[storageKey]) ? d[storageKey] : []);
        render();
      });
    }

    function exportLine() {
      const rumours = getRumours();
      if (!rumours.length) return "[Rumours: none]";
      const parts = rumours.map(
        (r) => `${r.done ? "✓" : "○"} ${r.text || "(empty)"}`,
      );
      return `[Rumours: ${parts.join(" | ")}]`;
    }

    return {
      save,
      render,
      load,
      exportLine,
    };
  }

  function createStatsSection(deps) {
    const storageKey = deps.storageKey;
    const addLog = deps.addLog;
    const getStats = deps.getStats;
    const setStats = deps.setStats;

    const statsListEl = document.getElementById("sc-np-stats-list");
    const statsSelectEl = document.getElementById("sc-np-stats-select");
    const statsAmountEl = document.getElementById("sc-np-stats-amount");
    const statsReasonEl = document.getElementById("sc-np-stats-reason");
    const statsAdjustPanel = document.getElementById("sc-np-stats-adjust");
    const statsFbEl = document.getElementById("sc-np-stats-fb");

    let statsSaveTimer = null;
    let statsFbTimer = null;

    function newStat() {
      return { id: Date.now() + Math.random(), name: "", value: "", notes: "" };
    }

    function save() {
      chrome.storage.local.set({ [storageKey]: getStats() });
    }

    function scheduleSave() {
      clearTimeout(statsSaveTimer);
      statsSaveTimer = setTimeout(save, 500);
    }

    function showStatsFeedback(msg) {
      if (!statsFbEl) return;
      statsFbEl.textContent = msg;
      statsFbEl.classList.add("visible");
      clearTimeout(statsFbTimer);
      statsFbTimer = setTimeout(() => statsFbEl.classList.remove("visible"), 1600);
    }

    function rebuildStatsSelect(keepId) {
      if (!statsSelectEl || !statsAdjustPanel) return;
      const stats = getStats();
      const prev = keepId ?? statsSelectEl.value;
      statsSelectEl.innerHTML = "<option value=''>Select stat…</option>";
      stats.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent =
          (s.name.trim() || "(unnamed)") + "  —  " + (s.value || "—");
        statsSelectEl.appendChild(opt);
      });
      if (prev) statsSelectEl.value = prev;
      statsAdjustPanel.style.display = stats.length ? "" : "none";
    }

    function parseStatValue(raw) {
      const str = String(raw ?? "").trim();
      const frac = str.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)(.*)$/);
      if (frac) {
        return {
          kind: "fraction",
          current: parseFloat(frac[1]),
          max: parseFloat(frac[2]),
          suffix: frac[3] || "",
        };
      }
      const num = str.match(/^(-?\d+(?:\.\d+)?)(.*)$/);
      if (num) {
        return { kind: "number", value: parseFloat(num[1]), suffix: num[2] || "" };
      }
      return { kind: "text" };
    }

    function trimNum(n) {
      return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
    }

    function formatStatValue(parsed) {
      if (parsed.kind === "fraction")
        return `${trimNum(parsed.current)}/${trimNum(parsed.max)}${parsed.suffix}`;
      if (parsed.kind === "number")
        return `${trimNum(parsed.value)}${parsed.suffix}`;
      return null;
    }

    function render() {
      const stats = getStats();
      if (!statsListEl) return;
      statsListEl.innerHTML = "";
      if (!stats.length) {
        const e = document.createElement("div");
        e.className = "ql-empty-state";
        e.style.padding = "6px 0";
        e.textContent = "No stats yet.";
        statsListEl.appendChild(e);
        rebuildStatsSelect();
        return;
      }
      stats.forEach((s, idx) => {
        const row = document.createElement("div");
        row.className = "stat-item";
        row.dataset.statId = s.id;

        const topRow = document.createElement("div");
        topRow.className = "stat-item-top";

        const nameSpan = document.createElement("span");
        nameSpan.className = "item-disp-name";
        nameSpan.textContent = s.name || "(unnamed)";

        const nameEditIn = document.createElement("input");
        nameEditIn.type = "text";
        nameEditIn.className = "af-input";
        nameEditIn.value = s.name;
        nameEditIn.placeholder = "Stat name…";
        nameEditIn.maxLength = 40;
        nameEditIn.style.display = "none";
        nameEditIn.setAttribute("data-ai-rewriter-ignore", "1");
        nameEditIn.addEventListener("input", () => {
          s.name = nameEditIn.value;
          scheduleSave();
          rebuildStatsSelect(s.id);
        });

        const valSpan = document.createElement("span");
        valSpan.className = "stat-value";
        valSpan.textContent = s.value !== "" ? s.value : "—";
        row._valEl = valSpan;

        const valEditIn = document.createElement("input");
        valEditIn.type = "text";
        valEditIn.className = "af-input stat-val-input";
        valEditIn.value = s.value;
        valEditIn.placeholder = "Value…";
        valEditIn.maxLength = 20;
        valEditIn.style.display = "none";
        valEditIn.setAttribute("data-ai-rewriter-ignore", "1");
        valEditIn.addEventListener("input", () => {
          s.value = valEditIn.value;
          scheduleSave();
          rebuildStatsSelect(s.id);
        });
        row._valEditEl = valEditIn;

        const toggleBtn = document.createElement("button");
        toggleBtn.className = "item-toggle-btn edit";
        toggleBtn.textContent = "✎";
        let isEditing = false;

        const delBtn = document.createElement("button");
        delBtn.className = "stat-delete-btn";
        delBtn.title = "Remove";
        delBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        delBtn.addEventListener("click", () => {
          addLog(`[Stat removed: ${s.name || "(unnamed)"}]`);
          stats.splice(idx, 1);
          save();
          render();
        });

        topRow.append(nameSpan, nameEditIn, valSpan, valEditIn, toggleBtn, delBtn);

        const notesSpan = document.createElement("div");
        notesSpan.className = "item-disp-note";
        notesSpan.textContent = s.notes;
        notesSpan.style.display = s.notes ? "" : "none";

        const notesEditIn = document.createElement("input");
        notesEditIn.type = "text";
        notesEditIn.className = "af-input";
        notesEditIn.value = s.notes || "";
        notesEditIn.style.display = "none";
        notesEditIn.placeholder = "Notes… e.g. base stat before buffs";
        notesEditIn.maxLength = 80;
        notesEditIn.setAttribute("data-ai-rewriter-ignore", "1");
        notesEditIn.addEventListener("input", () => {
          s.notes = notesEditIn.value;
          scheduleSave();
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
            nameEditIn.value = s.name;
            valEditIn.value = s.value;
            notesEditIn.value = s.notes || "";
            nameEditIn.focus();
          } else {
            nameEditIn.style.display = "none";
            nameSpan.style.display = "";
            valEditIn.style.display = "none";
            valSpan.style.display = "";
            notesEditIn.style.display = "none";
            toggleBtn.className = "item-toggle-btn edit";
            toggleBtn.textContent = "✎";
            nameSpan.textContent = s.name || "(unnamed)";
            valSpan.textContent = s.value !== "" ? s.value : "—";
            notesSpan.textContent = s.notes;
            notesSpan.style.display = s.notes ? "" : "none";
          }
        });

        row.append(topRow, notesSpan, notesEditIn);
        statsListEl.appendChild(row);
      });
      rebuildStatsSelect();
    }

    (function mountAddForm() {
      if (!statsListEl || !statsListEl.parentNode) return;
      const form = document.createElement("div");
      form.className = "af-form";
      const nameIn = document.createElement("input");
      nameIn.type = "text";
      nameIn.className = "af-input";
      nameIn.placeholder = "Stat name… e.g. STR, HP, Armor";
      nameIn.maxLength = 40;
      nameIn.setAttribute("data-ai-rewriter-ignore", "1");
      const valIn = document.createElement("input");
      valIn.type = "text";
      valIn.className = "af-input stat-val-input";
      valIn.placeholder = "Value…";
      valIn.maxLength = 20;
      valIn.setAttribute("data-ai-rewriter-ignore", "1");
      const notesIn = document.createElement("input");
      notesIn.type = "text";
      notesIn.className = "af-input";
      notesIn.placeholder = "Notes (optional)…";
      notesIn.maxLength = 80;
      notesIn.setAttribute("data-ai-rewriter-ignore", "1");
      const submitBtn = document.createElement("button");
      submitBtn.className = "af-submit";
      submitBtn.textContent = "+ Add Stat";
      const row1 = document.createElement("div");
      row1.className = "af-row";
      row1.append(nameIn, valIn, submitBtn);
      form.append(row1, notesIn);
      statsListEl.parentNode.insertBefore(form, statsListEl);
      const doAdd = () => {
        const stats = getStats();
        const name = nameIn.value.trim();
        const value = valIn.value.trim();
        const notes = notesIn.value.trim();
        const stat = newStat();
        stat.name = name;
        stat.value = value;
        stat.notes = notes;
        stats.push(stat);
        save();
        render();
        const notesPart = notes ? ` — ${notes}` : "";
        addLog(`[Stat added: ${name || "(unnamed)"}${notesPart} = ${value || "—"}]`);
        nameIn.value = "";
        valIn.value = "";
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

    function applyStatOp(op) {
      const stats = getStats();
      if (!statsSelectEl || !statsAmountEl || !statsListEl) return;
      const id = statsSelectEl.value;
      if (!id) {
        showStatsFeedback("Pick a stat first.");
        return;
      }
      const s = stats.find((x) => String(x.id) === id);
      if (!s) return;
      const amountRaw = statsAmountEl.value.trim();
      const reason = statsReasonEl ? statsReasonEl.value.trim() : "";
      const before = s.value !== "" ? s.value : "—";

      if (op === "set") {
        if (!amountRaw) {
          showStatsFeedback("Type a value first.");
          return;
        }
        s.value = amountRaw;
      } else {
        const delta = parseFloat(amountRaw);
        if (!amountRaw || !isFinite(delta)) {
          showStatsFeedback("Enter a number to add/use.");
          return;
        }
        const parsed = parseStatValue(s.value);
        if (parsed.kind === "fraction") {
          parsed.current =
            op === "add"
              ? Math.min(parsed.max, parsed.current + delta)
              : Math.max(0, parsed.current - delta);
          s.value = formatStatValue(parsed);
        } else if (parsed.kind === "number") {
          parsed.value =
            op === "add"
              ? parsed.value + delta
              : Math.max(0, parsed.value - delta);
          s.value = formatStatValue(parsed);
        } else {
          showStatsFeedback("Not numeric — use Set instead.");
          return;
        }
      }

      const row = statsListEl.querySelector(`[data-stat-id="${id}"]`);
      if (row && row._valEl) row._valEl.textContent = s.value !== "" ? s.value : "—";
      if (row && row._valEditEl) row._valEditEl.value = s.value;
      rebuildStatsSelect(id);
      save();

      const notePart = s.notes ? ` (${s.notes})` : "";
      const reasonPart = reason ? ` — ${reason}` : "";
      const logMsg =
        op === "set"
          ? `[${s.name || "Stat"}: set to ${s.value}${notePart}${reasonPart}]`
          : `[${s.name || "Stat"}: ${before} → ${s.value}${notePart}${reasonPart}]`;
      showStatsFeedback(`${before} → ${s.value}`);
      addLog(logMsg);
      statsAmountEl.value = "";
      if (statsReasonEl) statsReasonEl.value = "";
    }

    document
      .getElementById("sc-np-stats-op-add")
      ?.addEventListener("click", () => applyStatOp("add"));
    document
      .getElementById("sc-np-stats-op-sub")
      ?.addEventListener("click", () => applyStatOp("sub"));
    document
      .getElementById("sc-np-stats-op-set")
      ?.addEventListener("click", () => applyStatOp("set"));

    function load() {
      chrome.storage.local.get(storageKey, (d) => {
        setStats(Array.isArray(d[storageKey]) ? d[storageKey] : []);
        render();
      });
    }

    function exportLine() {
      const stats = getStats();
      if (!stats.length) return "[Stats: none]";
      const parts = stats.map((s) => {
        const note = s.notes ? ` (${s.notes})` : "";
        return `${s.name || "(unnamed)"} ${s.value || "—"}${note}`;
      });
      return `[Stats: ${parts.join(" | ")}]`;
    }

    return {
      save,
      render,
      load,
      exportLine,
    };
  }

  window.SCRPGTrackerSections = Object.assign(
    {},
    window.SCRPGTrackerSections || {},
    {
      createResourcesSection,
      createAbilitiesSection,
      createPartySection,
      createNpcsSection,
      createRumoursSection,
      createStatsSection,
    },
  );
})();
