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
      quests: "sc_quests_v1_" + chatId,
      resources: "sc_res_v1_" + chatId,
      abilities: "sc_abl_v1_" + chatId,
      party: "sc_party_v1_" + chatId,
      npcs: "sc_npc_v1_" + chatId,
      rumours: "sc_rumour_v1_" + chatId,
      stats: "sc_stats_v1_" + chatId,
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
    const thoughtInput = document.getElementById("sc-np-thought-input");
    const thoughtInsertBtn = document.getElementById(
      "sc-np-thought-insert-btn",
    );
    const sysMsgCategory = document.getElementById("sc-np-sysmsg-category");
    const sysMsgInput = document.getElementById("sc-np-sysmsg-input");
    const sysMsgInsertBtn = document.getElementById(
      "sc-np-sysmsg-insert-btn",
    );
    const rpPanel = document.getElementById("sc-np-rp-panel");
    const fmtPanel = document.getElementById("sc-np-fmt-panel");
    const stylePanel = document.getElementById("sc-np-style-panel");
    const stylerPanel = document.getElementById("sc-np-styler-panel");

    /* ── State ── */
    let isOpen = false;
    let activeTab = "quests";

    /* Storage keys */
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
    const STATS_KEY = STORAGE_KEYS.stats;
    const DEFAULT_PARTY_STATUS = "Healthy";
    const PARTY_STATUS_PRESETS = ["Healthy", "Downed", "Dead", "Absent"];
    const NPC_DISPS = ["friendly", "neutral", "hostile"];

    let quests = [];
    let resources = [];
    let abilities = [];
    let party = [];
    let npcs = [];
    let rumours = [];
    let stats = [];
    let questSaveTimer = null;
    let questSheetStatusTimer = null;

    let resourcesSection = null;
    let abilitiesSection = null;
    let partySection = null;
    let npcsSection = null;
    let rumoursSection = null;
    let statsSection = null;

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

    function saveStats() {
      if (statsSection) {
        statsSection.save();
        return;
      }
      chrome.storage.local.set({ [STATS_KEY]: stats });
    }

    function renderStats() {
      if (statsSection) statsSection.render();
    }

    function loadStats() {
      if (statsSection) {
        statsSection.load();
        return;
      }
      chrome.storage.local.get(STATS_KEY, (d) => {
        stats = Array.isArray(d[STATS_KEY]) ? d[STATS_KEY] : [];
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
      const equipment = typeof raw.equipment === "string" ? raw.equipment : "";
      const affiliation =
        typeof raw.affiliation === "string" ? raw.affiliation : "";
      const status = normalizePartyStatus(raw.status);
      return {
        id: normalizeId(raw.id, idx),
        name,
        notes,
        equipment,
        affiliation,
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

    function normalizeImportedStat(raw, idx) {
      if (!raw || typeof raw !== "object") return null;
      const name = typeof raw.name === "string" ? raw.name : "";
      const value = typeof raw.value === "string" ? raw.value : String(raw.value ?? "");
      const notes = typeof raw.notes === "string" ? raw.notes : "";
      return {
        id: normalizeId(raw.id, idx),
        name,
        value,
        notes,
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
        stats: Array.isArray(parsed.stats)
          ? parsed.stats.map((s, i) => normalizeImportedStat(s, i)).filter(Boolean)
          : [],
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
            equipment: m.equipment,
            affiliation: m.affiliation,
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

    function getCleanStats() {
      return stats.map((s, idx) =>
        normalizeImportedStat(
          { id: s.id, name: s.name, value: s.value, notes: s.notes },
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
      const cleanedStats = getCleanStats();
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
          stats: cleanedStats.length,
        },
        quests: cleanedQuests,
        resources: cleanedResources,
        abilities: cleanedAbilities,
        party: cleanedParty,
        npcs: cleanedNpcs,
        rumours: cleanedRumours,
        stats: cleanedStats,
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
      stats = imported.stats;

      saveQuests();
      saveRes();
      saveAbl();
      saveParty();
      saveNpcs();
      saveRumours();
      saveStats();

      renderQuests();
      renderRes();
      renderAbl();
      renderParty();
      renderNpcs();
      renderRumours();
      renderStats();

      addLog(
        `[RPG sheet imported: ${quests.length} quests, ${resources.length} resources, ${abilities.length} abilities, ${party.length} party, ${npcs.length} NPCs, ${rumours.length} rumours, ${stats.length} stats]`,
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
          nameSpan.style.color = q.state === "failed" ? "var(--sc-ink-failed)" : "var(--sc-ink-done)";
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
              ? "var(--sc-ink-1)"
              : q.state === "failed"
                ? "var(--sc-ink-failed)"
                : "var(--sc-ink-done)";
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

    // Quick Thought insert — round brackets, not [square brackets], so
    // thoughts never get mixed up with the [Category: ...] system-message
    // format below (see fmtUnwrapParens in content-utils.js and the
    // "Thought Parentheses" Style toggle, which render (this) as an
    // inner-monologue bubble in the chat).
    (function () {
      if (!thoughtInput || !thoughtInsertBtn) return;
      const doInsert = () => {
        const txt = thoughtInput.value.trim();
        if (!txt) return;
        addLog(`(${txt})`);
        flashCopyBtnLabel(thoughtInsertBtn);
        thoughtInput.value = "";
      };
      thoughtInsertBtn.addEventListener("click", doInsert);
      thoughtInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          doInsert();
        }
      });
    })();

    // System Message insert — [Category: text], the [square bracket] format
    // Thoughts used to share before it moved to round brackets above.
    (function () {
      if (!sysMsgCategory || !sysMsgInput || !sysMsgInsertBtn) return;
      const doInsert = () => {
        const txt = sysMsgInput.value.trim();
        if (!txt) return;
        addLog(`[${sysMsgCategory.value}: ${txt}]`);
        flashCopyBtnLabel(sysMsgInsertBtn);
        sysMsgInput.value = "";
      };
      sysMsgInsertBtn.addEventListener("click", doInsert);
      sysMsgInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          doInsert();
        }
      });
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
      typeof sectionFactory.createRumoursSection !== "function" ||
      typeof sectionFactory.createStatsSection !== "function"
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

    statsSection = sectionFactory.createStatsSection({
      storageKey: STATS_KEY,
      addLog,
      getStats: () => stats,
      setStats: (next) => {
        stats = Array.isArray(next) ? next : [];
      },
    });

    /* ── AI Generator ── */
    const generatorFactory = window.SCRPGTrackerGenerators || {};
    if (typeof generatorFactory.createGeneratorSection !== "function") {
      throw new Error("RPG tracker generator module failed to load.");
    }
    generatorFactory.createGeneratorSection({ flashCopyBtnLabel });

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
      stylePanel.classList.toggle("visible", t === "style");
      stylerPanel.classList.toggle("visible", t === "styler");
      if (t === "fmt") loadFormatterPanel();
      if (t === "style") loadStylePanel();
      if (t === "styler") loadStylerPanel();
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
      "fmtPreserveLists",
      "fmtPreserveBlockquotes",
      "fmtPreserveSpeakerTags",
      "fmtPreserveBold",
      "fmtUnwrapBrackets",
      "fmtUnwrapParens",
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
            key: "fmtPreserveLists",
            name: "Preserve lists (- and 1. items)",
            b: "- item one",
            a: "- item one",
            hint: "Bullet and numbered list lines are left unwrapped and paragraph-spacing won't insert blank lines between them",
          },
          {
            key: "fmtPreserveBlockquotes",
            name: "Preserve blockquotes (> lines)",
            b: "> she said quietly",
            a: "> she said quietly",
            hint: "Lines starting with > are left unwrapped and paragraph-spacing won't insert blank lines between them",
          },
          {
            key: "fmtPreserveSpeakerTags",
            name: "Preserve speaker tags (**Name:**)",
            b: "**Aria:** Hello there",
            a: "**Aria:** Hello there",
            hint: "Lines starting with a **Name:** tag keep their asterisks, aren't wrapped in extra asterisks, and paragraph-spacing won't insert blank lines between consecutive tagged lines",
          },
          {
            key: "fmtPreserveBold",
            name: "Preserve **bold** words",
            b: "This is **important**.",
            a: "This is **important**.",
            hint: "A **bold** pair anywhere in a line — mid-sentence too — keeps its asterisks: immune to fmtStripAsterisks and never absorbed into the surrounding single-*wrap*",
          },
          {
            key: "fmtUnwrapBrackets",
            name: "Leave [ ] square brackets unwrapped",
            b: "[aside] walk",
            a: "[aside] *walk.*",
          },
          {
            key: "fmtUnwrapParens",
            name: "Leave ( ) round brackets unwrapped",
            b: "(quiet thought) walk",
            a: "(quiet thought) *walk.*",
            hint: "Used by Thoughts and OOC asides so they never get swallowed into an *action* wrap",
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
          <span style="font-size:12px;font-weight:600;color:var(--sc-slate-300);">Auto-formatter</span>
          <span class="fmt-master-badge ${enabled ? "on" : "off"}">${enabled ? "ENABLED" : "DISABLED"}</span>
        </div>
        <div class="fmt-meta-row">
          <span>shortcut</span><span class="fmt-meta-chip">${escH(shortcut)}</span>
          <span style="margin-left:4px;">no-tracker shortcut</span><span class="fmt-meta-chip">${escH(noTrackerShortcut)}</span>
          <span style="margin-left:4px;">auto after rewrite</span>
          <span class="fmt-master-badge ${autoFmt ? "on" : "off"}" style="font-size:9.5px;">${autoFmt ? "ON" : "OFF"}</span>
        </div>
        <div style="font-size:10px;color:var(--sc-slate-700);font-style:italic;margin-top:2px;">
          ${escH(shortcut)} formats and prepends a tracker summary; ${escH(noTrackerShortcut)} formats without it.
          Text outside quotes &amp; [brackets] is wrapped in
          <span style="color:var(--sc-accent);font-family:ui-monospace,monospace;">*asterisks*</span> automatically.
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
              "height:1px;background:rgba(var(--sc-accent-rgb), 0.07);margin:2px 0;";
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
              "color:var(--sc-accent-2);background:rgba(var(--sc-accent-rgb), 0.1);border-color:rgba(var(--sc-accent-rgb), 0.25);";
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

    /* ════════════════ STYLE INJECTION PANEL ════════════════ */

    const STYLE_KEYS_TO_WATCH = [
      "scMdTables",
      "scBracketEmphasis",
      "scBracketPipeNewline",
      "scPlainStyle",
      "scActionStyle",
      "scDialogueStyle",
      "scBoldStyle",
      "scBulletStyle",
      "scBlockquoteStyle",
      "scNumberedListStyle",
      "scSeparatorStyle",
      "scThoughtStyle",
    ];

    // Each entry describes one injectable style feature and maps to a storage key.
    const STYLE_FEATURES = [
      {
        key: "scMdTables",
        name: "Markdown Tables",
        description:
          "Renders pipe-delimited tables in AI responses as styled HTML tables with a header row and striped body.",
        note: "Tables already rendered in this session stay rendered if the toggle is turned off.",
      },
      {
        key: "scBracketEmphasis",
        name: "Bracket Emphasis",
        description:
          "Highlights [scene bracket] content — location, outfit, time, status — as a dark card with a cool cyan corner-frame and a faint scanline texture, set in a sharp monospace so it reads as a system readout rather than prose. Deliberately colder than the violet used everywhere else.",
        note: "Toggling off instantly collapses existing brackets back to plain text via CSS.",
      },
      {
        key: "scBracketPipeNewline",
        name: "Expand pipes as lines",
        description:
          "Renders \" | \" separators inside brackets as newlines so [TRACKER | Dani | Mimi] displays as a multi-line block instead of a single dense line.",
        subOf: "scBracketEmphasis",
      },
      {
        key: "scThoughtStyle",
        name: "Thought Parentheses",
        description:
          "Highlights a standalone (round bracket) thought with a soft, italic literary-serif inner-monologue bubble — a different voice from both narration and spoken dialogue below. Only applies when the parenthetical is alone on its own line; parentheses used mid-sentence are always left untouched.",
        note: "Toggling off instantly collapses existing thought bubbles back to plain text via CSS.",
      },
      {
        key: "scPlainStyle",
        name: "Plain Text Style",
        description:
          "Gives ordinary, unmarked text — no *action*, no \"quotes\", no **bold** — a clean neutral sans and a near-white cyan tint, lighter and airier than the bracket system-voice cyan, instead of whatever SpicyChat's default happens to be. Covers things like a plain reply after a **Sender:** tag.",
      },
      {
        key: "scActionStyle",
        name: "Action Text Style",
        description:
          "Replaces SpicyChat's sky-blue italic for *action* narration with an upright geometric sans in muted lavender — a distinct 'stage direction' voice, easier to read across long passages.",
      },
      {
        key: "scDialogueStyle",
        name: "Dialogue Style",
        description:
          "Renders \"quoted dialogue\" (rendered by SpicyChat as <q> elements) in a warmer literary serif at a slightly larger size, with glowing curly quotes for a spoken-aloud feel.",
      },
      {
        key: "scBoldStyle",
        name: "Bold Glow",
        description:
          "Adds a soft ambient blue glow and firmer weight to **bold** text — a different hue from the violet used elsewhere, so emphasis stands out as its own thing instead of blending in.",
        note: "With Dialogue Style also on, bolded dialogue keeps this blue glow instead of Dialogue's usual violet one, so a bolded quote never quietly blends back into an ordinary one.",
      },
      {
        key: "scBulletStyle",
        name: "Bullet Style",
        description:
          "Replaces plain list bullets with a small glowing lavender diamond ◆, matching the extension's visual palette.",
      },
      {
        key: "scBlockquoteStyle",
        name: "Blockquote Style",
        description:
          "Styles > blockquotes as an incoming transmission feed — the same sharp monospace as scene brackets, dark background, glowing ▶ marker — for system updates and log entries.",
      },
      {
        key: "scNumberedListStyle",
        name: "Numbered List Style",
        description:
          "Replaces plain 1. 2. 3. counters with glowing monospace [01] [02] [03] brackets, in the same system-voice font as brackets and blockquotes.",
      },
      {
        key: "scSeparatorStyle",
        name: "Separator Style",
        description:
          "Renders --- dividers as a glowing purple gradient rule instead of the blank space SpicyChat shows by default.",
      },
    ];

    function renderStylePanel(d) {
      stylePanel.innerHTML = "";

      // ── Header card ──
      const hCard = document.createElement("div");
      hCard.className = "rp-card";
      hCard.style.cssText = "padding:10px 14px;gap:8px;";
      hCard.innerHTML = `
        <div class="fmt-master-row">
          <span style="font-size:12px;font-weight:600;color:var(--sc-slate-300);">Chat Injection</span>
        </div>
        <div style="font-size:11px;color:var(--sc-slate-600);line-height:1.55;">
          Enhances SpicyChat AI messages in-place with rendering and visual styling
          the platform doesn't provide by default. Features apply to new messages
          automatically; bracket toggling is instant on all existing messages.
        </div>`;
      stylePanel.appendChild(hCard);

      // ── Feature rows ──
      const sec = document.createElement("div");
      sec.className = "rp-section-label";
      sec.textContent = "FEATURES";
      stylePanel.appendChild(sec);

      const card = document.createElement("div");
      card.className = "rp-card";
      card.style.padding = "4px 14px";

      STYLE_FEATURES.forEach(
        ({ key, name, description, note, subOf }) => {
          const parentOn = subOf ? d[subOf] !== false : true;

          const row = document.createElement("div");
          row.className = "style-feature-row";
          if (subOf) {
            row.style.cssText =
              "margin-left:14px;padding-left:10px;border-left:2px solid rgba(var(--sc-accent-violet-rgb), 0.22);" +
              (parentOn ? "" : "opacity:0.45;pointer-events:none;");
          }

          const top = document.createElement("div");
          top.className = "style-feature-top";

          const nameEl = document.createElement("span");
          nameEl.className = "style-feature-name";
          nameEl.textContent = name;

          const on = d[key] !== false;
          const toggle = document.createElement("label");
          toggle.className = "rp-toggle";
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = on;
          checkbox.disabled = subOf ? !parentOn : false;
          checkbox.setAttribute("data-ai-rewriter-ignore", "1");
          checkbox.addEventListener("change", () => {
            chrome.storage.sync.set({ [key]: checkbox.checked });
          });
          const track = document.createElement("span");
          track.className = "rp-toggle-track";
          toggle.append(checkbox, track);
          top.append(nameEl, toggle);

          const desc = document.createElement("span");
          desc.className = "style-feature-desc";
          desc.textContent = description;

          row.append(top, desc);

          if (note) {
            const noteEl = document.createElement("span");
            noteEl.className = "style-feature-note";
            noteEl.textContent = note;
            row.appendChild(noteEl);
          }

          card.appendChild(row);
        },
      );

      stylePanel.appendChild(card);
    }

    function loadStylePanel() {
      chrome.storage.sync.get(STYLE_KEYS_TO_WATCH, renderStylePanel);
    }

    // Live-reload when settings change while Style tab is active
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync" && STYLE_KEYS_TO_WATCH.some((k) => k in changes)) {
        if (activeTab === "style") loadStylePanel();
      }
    });

    /* ════════════════ TEXT STYLER PANEL ════════════════ */

    const STYLER_KEYS_TO_WATCH = [
      "stylerBoldEnabled",
      "stylerItalicEnabled",
      "stylerStrikethroughEnabled",
      "stylerEmphasizeEnabled",
    ];

    const STYLER_FEATURES = [
      {
        key: "stylerBoldEnabled",
        name: "Bold Selection",
        shortcut: "Ctrl+B",
        description:
          "Wraps the selected text in **double asterisks** so it renders bold. Press again on bolded text to remove it. With no selection, drops markers at the cursor so you can type straight into them.",
      },
      {
        key: "stylerItalicEnabled",
        name: "Italic Selection",
        shortcut: "Ctrl+I",
        description:
          "Wraps the selected text in *single asterisks* so it renders italic. Press again on italicised text to remove it. With no selection, drops markers at the cursor.",
      },
      {
        key: "stylerStrikethroughEnabled",
        name: "Strikethrough Selection",
        shortcut: "Ctrl+Shift+X",
        description:
          "Wraps the selected text in ~~double tildes~~ so it renders struck through. Press again on struck-through text to remove it. With no selection, drops markers at the cursor.",
      },
      {
        key: "stylerEmphasizeEnabled",
        name: "Emphasize Paragraph",
        shortcut: "Ctrl+Shift+E",
        description:
          "No selection needed — cleans up whichever paragraph the cursor is in: strips every asterisk, trims leading/trailing terminal punctuation (. , ! ?), and joins any wrapped lines back into one. Selects the cleaned paragraph afterward so a follow-up Ctrl+B bolds it right away.",
      },
    ];

    function renderStylerPanel(d) {
      stylerPanel.innerHTML = "";

      // ── Header card ──
      const hCard = document.createElement("div");
      hCard.className = "rp-card";
      hCard.style.cssText = "padding:10px 14px;gap:8px;";
      hCard.innerHTML = `
        <div class="fmt-master-row">
          <span style="font-size:12px;font-weight:600;color:var(--sc-slate-300);">Text Styler</span>
        </div>
        <div style="font-size:11px;color:var(--sc-slate-600);line-height:1.55;">
          Keyboard shortcuts that apply Markdown-style formatting to whatever
          text you've selected in any text box — not just SpicyChat.
        </div>`;
      stylerPanel.appendChild(hCard);

      // ── Feature rows ──
      const sec = document.createElement("div");
      sec.className = "rp-section-label";
      sec.textContent = "SHORTCUTS";
      stylerPanel.appendChild(sec);

      const card = document.createElement("div");
      card.className = "rp-card";
      card.style.padding = "4px 14px";

      STYLER_FEATURES.forEach(({ key, name, shortcut, description }) => {
        const on = d[key] !== false;

        const row = document.createElement("div");
        row.className = "style-feature-row";

        const top = document.createElement("div");
        top.className = "style-feature-top";

        const nameWrap = document.createElement("span");
        nameWrap.style.cssText = "display:flex;align-items:center;gap:7px;";
        const nameEl = document.createElement("span");
        nameEl.className = "style-feature-name";
        nameEl.textContent = name;
        const chip = document.createElement("span");
        chip.className = "fmt-meta-chip";
        chip.textContent = shortcut;
        nameWrap.append(nameEl, chip);

        const toggle = document.createElement("label");
        toggle.className = "rp-toggle";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = on;
        checkbox.setAttribute("data-ai-rewriter-ignore", "1");
        checkbox.addEventListener("change", () => {
          chrome.storage.sync.set({ [key]: checkbox.checked });
        });
        const track = document.createElement("span");
        track.className = "rp-toggle-track";
        toggle.append(checkbox, track);

        top.append(nameWrap, toggle);

        const desc = document.createElement("span");
        desc.className = "style-feature-desc";
        desc.textContent = description;

        row.append(top, desc);
        card.appendChild(row);
      });

      stylerPanel.appendChild(card);
    }

    function loadStylerPanel() {
      chrome.storage.sync.get(STYLER_KEYS_TO_WATCH, renderStylerPanel);
    }

    // Live-reload when settings change while Styler tab is active
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync" && STYLER_KEYS_TO_WATCH.some((k) => k in changes)) {
        if (activeTab === "styler") loadStylerPanel();
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
      getStats: () => stats,
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

    function loadAllTrackerSections() {
      loadQuests();
      loadRes();
      loadAbl();
      loadParty();
      loadNpcs();
      loadRumours();
      loadStats();
    }

    function bootDrawerState() {
      // Erase any legacy notes storage for this chat
      chrome.storage.local.remove([STORAGE_KEYS.legacyNote]);
      bindExportButtons();
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
