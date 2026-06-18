(function () {
  "use strict";

  function createActivityExports(deps) {
    const maxLog =
      typeof deps.maxLog === "number" && deps.maxLog > 0 ? deps.maxLog : 10;

    const logStripEl = document.getElementById("sc-np-log-strip");
    const logInnerEl = document.getElementById("sc-np-log-strip-inner");
    const logClearBtn = document.getElementById("sc-np-log-clear-btn");

    let activityLog = [];

    function fmtTs() {
      return new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    function flashCopyBtnLabel(btn) {
      if (!btn) return;
      btn.classList.add("inserted");
      const orig = btn.textContent;
      btn.textContent = "\u2714 Inserted";
      setTimeout(() => {
        btn.classList.remove("inserted");
        btn.textContent = orig;
      }, 1400);
    }

    function injectLogLine(msg) {
      document.dispatchEvent(
        new CustomEvent("sc-rp-inject", {
          detail: { text: "\n" + msg, silent: true },
        }),
      );
    }

    function renderLog() {
      if (!logInnerEl || !logStripEl) return;
      logInnerEl.innerHTML = "";
      logStripEl.classList.toggle("has-entries", activityLog.length > 0);
      activityLog.forEach(({ ts, msg }) => {
        const row = document.createElement("div");
        row.className = "log-entry";
        const tsEl = document.createElement("span");
        tsEl.className = "log-ts";
        tsEl.textContent = ts;
        const msgEl = document.createElement("span");
        msgEl.className = "log-msg";
        msgEl.textContent = msg;
        const cpBtn = document.createElement("button");
        cpBtn.className = "log-copy-btn";
        cpBtn.textContent = "\u2398";
        cpBtn.title = "Insert into chat";
        cpBtn.addEventListener("click", () => {
          injectLogLine(msg);
          cpBtn.textContent = "\u2714";
          setTimeout(() => {
            cpBtn.textContent = "\u2398";
          }, 1000);
        });
        row.append(tsEl, msgEl, cpBtn);
        logInnerEl.appendChild(row);
      });
    }

    function addLog(msg) {
      const ts = fmtTs();
      activityLog.unshift({ ts, msg });
      if (activityLog.length > maxLog) activityLog.pop();
      renderLog();
      injectLogLine(msg);
    }

    function exportQuests() {
      const quests = deps.getQuests();
      if (!quests.length) return "[Quests: none]";
      const parts = quests.map((q) => {
        const st =
          q.state === "done"
            ? "\u2713"
            : q.state === "failed"
              ? "\u2717"
              : "\u25cb";
        const upd = q.updates && q.updates.length ? ` > ${q.updates[0]}` : "";
        return `${st} ${q.title || "(untitled)"}${q.notes ? " \u2014 " + q.notes : ""}${upd}`;
      });
      return `[Quests: ${parts.join(" | ")}]`;
    }

    function exportResources() {
      const resources = deps.getResources();
      if (!resources.length) return "[Resources: none]";
      const parts = resources.map((r) => {
        const note = r.notes ? ` (${r.notes})` : "";
        return `${r.name || "(unnamed)"} ${r.value}${note}`;
      });
      return `[Resources: ${parts.join(" | ")}]`;
    }

    function exportAbilities() {
      const abilities = deps.getAbilities();
      if (!abilities.length) return "[Abilities: none]";
      const parts = abilities.map((a) => {
        const note = a.notes ? ` (${a.notes})` : "";
        return `${a.name || "(unnamed)"} ${a.current}/${a.max}${note}`;
      });
      return `[Abilities: ${parts.join(" | ")}]`;
    }

    function exportParty() {
      const party = deps.getParty();
      if (!party.length) return "[Party: none]";
      const parts = party.map((m) => {
        const details = [];
        if (m.notes) details.push(`Notes: ${m.notes}`);
        if (m.equipment) details.push(`Equipment: ${m.equipment}`);
        if (m.affiliation) details.push(`Affiliation: ${m.affiliation}`);
        const suffix = details.length ? ` (${details.join("; ")})` : "";
        return `${m.name || "(unnamed)"} \u2014 ${m.status}${suffix}`;
      });
      return `[Party: ${parts.join(" | ")}]`;
    }

    function exportNpcs() {
      const npcs = deps.getNpcs();
      if (!npcs.length) return "[NPCs: none]";
      const parts = npcs.map(
        (n) =>
          `${n.name || "(unnamed)"} [${n.disp}]${n.note ? " \u2014 " + n.note : ""}`,
      );
      return `[NPCs: ${parts.join(" | ")}]`;
    }

    function exportRumours() {
      const rumours = deps.getRumours();
      if (!rumours.length) return "[Rumours: none]";
      const parts = rumours.map(
        (r) => `${r.done ? "\u2713" : "\u25cb"} ${r.text || "(empty)"}`,
      );
      return `[Rumours: ${parts.join(" | ")}]`;
    }

    function exportDiceLast() {
      if (!activityLog.length) return "[Dice: no roll yet]";
      const diceEntry = activityLog.find(
        (e) => e.msg.startsWith("[Roll ") || e.msg.includes(" \u2014 Roll "),
      );
      return diceEntry ? diceEntry.msg : "[Dice: no roll yet]";
    }

    function exportAll() {
      return [
        exportQuests(),
        exportResources(),
        exportAbilities(),
        exportParty(),
        exportNpcs(),
        exportRumours(),
      ].join("\n");
    }

    function bindCopyBtn(id, exportFn) {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener("click", () => {
        const text = exportFn();
        injectLogLine(text);
        flashCopyBtnLabel(btn);
      });
    }

    function bindExportButtons() {
      bindCopyBtn("sc-np-export-all", exportAll);
      bindCopyBtn("sc-np-quest-copy", exportQuests);
      bindCopyBtn("sc-np-res-copy", exportResources);
      bindCopyBtn("sc-np-abl-copy", exportAbilities);
      bindCopyBtn("sc-np-party-copy", exportParty);
      bindCopyBtn("sc-np-npc-copy", exportNpcs);
      bindCopyBtn("sc-np-rumour-copy", exportRumours);
    }

    function bindDiceExportButton() {
      const btn = document.getElementById("sc-np-dice-copy");
      if (!btn) return;
      btn.addEventListener("click", () => {
        const text = exportDiceLast();
        injectLogLine(text);
        flashCopyBtnLabel(btn);
      });
    }

    if (logClearBtn) {
      logClearBtn.addEventListener("click", () => {
        activityLog = [];
        renderLog();
      });
    }

    return {
      addLog,
      flashCopyBtnLabel,
      bindExportButtons,
      bindDiceExportButton,
    };
  }

  window.SCRPGTrackerActivityExports = Object.assign(
    {},
    window.SCRPGTrackerActivityExports || {},
    {
      createActivityExports,
    },
  );
})();
