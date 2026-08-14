(function () {
  "use strict";

  const TYPE_LABELS = {
    character: "Character",
    location: "Location",
    item: "Item",
    equipment: "Equipment",
    creature: "Creature",
    faction: "Faction",
  };

  const SYSTEM_PROMPTS = {
    character:
      'You invent a single character concept for a tabletop-style roleplay tracker. Reply with exactly one line in the form "Name — description". The description is at most 2 sentences, vivid and specific, no markdown, no quotation marks, no preamble or extra commentary. If the user gives a name, use it as given; if they give a short idea instead, build the character around it. If neither is given, invent one freely in the requested style.',
    location:
      'You invent a single location for a tabletop-style roleplay tracker — a place, room, building, or landmark worth visiting. Reply with exactly one line in the form "Location name — description". The description is at most 2 sentences, vivid and specific (mood plus one notable detail), no markdown, no quotation marks, no preamble or extra commentary. Build around any name or idea the user gives; otherwise invent freely in the requested style.',
    item:
      'You invent a single notable item for a tabletop-style roleplay tracker — a general object, trinket, tool, curiosity, or quest object (not weapons or armor). Reply with exactly one line in the form "Item name — description". The description is at most 2 sentences, vivid and specific, no markdown, no quotation marks, no preamble or extra commentary. Build around any name or idea the user gives; otherwise invent freely in the requested style.',
    equipment:
      'You invent a single piece of wearable gear or a weapon for a tabletop-style roleplay tracker. Reply with exactly one line in the form "Equipment name — description". The description is at most 2 sentences covering what it is and one notable trait, no markdown, no quotation marks, no preamble or extra commentary. Build around any name or idea the user gives; otherwise invent freely in the requested style.',
    creature:
      'You invent a single creature or monster for a tabletop-style roleplay tracker. Reply with exactly one line in the form "Creature name — description". The description is at most 2 sentences covering appearance and one notable trait or threat, no markdown, no quotation marks, no preamble or extra commentary. Build around any name or idea the user gives; otherwise invent freely in the requested style.',
    faction:
      'You invent a single faction, guild, or organization for a tabletop-style roleplay tracker. Reply with exactly one line in the form "Faction name — description". The description is at most 2 sentences covering what they do and one notable trait, no markdown, no quotation marks, no preamble or extra commentary. Build around any name or idea the user gives; otherwise invent freely in the requested style.',
  };

  const MAX_TOKENS = 150;

  function buildUserMessage(seed, flavor) {
    const seedTrim = (seed || "").trim();
    const flavorTrim = (flavor || "").trim();
    if (!seedTrim && !flavorTrim) return "No specific idea — invent freely.";
    const parts = [];
    if (seedTrim) parts.push(`Idea or name: ${seedTrim}`);
    if (flavorTrim) parts.push(`Style/flavor: ${flavorTrim}`);
    return parts.join("\n");
  }

  function cleanResult(raw) {
    return String(raw || "")
      .replace(/\s*\n+\s*/g, " ")
      .trim()
      .replace(/^["'“]+|["'”]+$/g, "")
      .trim();
  }

  function createGeneratorSection(deps) {
    const flashCopyBtnLabel = deps.flashCopyBtnLabel;

    const typeButtons = Array.from(
      document.querySelectorAll(".gen-type-btn"),
    );
    const seedInput = document.getElementById("sc-np-gen-seed");
    const flavorInput = document.getElementById("sc-np-gen-flavor");
    const runBtn = document.getElementById("sc-np-gen-run");
    const regenBtn = document.getElementById("sc-np-gen-regen");
    const insertBtn = document.getElementById("sc-np-gen-insert");
    const statusEl = document.getElementById("sc-np-gen-status");
    const resultEl = document.getElementById("sc-np-gen-result");
    const resultTextEl = document.getElementById("sc-np-gen-result-text");

    if (!runBtn || !seedInput || !flavorInput) return {};

    let activeType = "character";
    let lastResultText = "";
    let requestInFlight = false;

    typeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        activeType = btn.dataset.genType;
        typeButtons.forEach((b) => b.classList.toggle("active", b === btn));
      });
    });

    function setStatus(msg, isErr) {
      statusEl.textContent = msg || "";
      statusEl.classList.toggle("err", !!isErr);
    }

    function setLoading(loading) {
      requestInFlight = loading;
      runBtn.disabled = loading;
      if (regenBtn) regenBtn.disabled = loading;
    }

    function runGenerate() {
      if (requestInFlight) return;
      setLoading(true);
      setStatus("Generating…", false);

      const prompt = SYSTEM_PROMPTS[activeType];
      const text = buildUserMessage(seedInput.value, flavorInput.value);

      document.addEventListener(
        "sc-rp-generate-result",
        (e) => {
          setLoading(false);
          const detail = e.detail || {};
          if (!detail.ok) {
            setStatus(detail.error || "Generation failed.", true);
            return;
          }
          lastResultText = cleanResult(detail.text);
          resultTextEl.textContent = lastResultText;
          resultEl.style.display = "";
          setStatus("", false);
        },
        { once: true },
      );

      document.dispatchEvent(
        new CustomEvent("sc-rp-run-generate", {
          detail: { prompt, text, maxTokens: MAX_TOKENS },
        }),
      );
    }

    runBtn.addEventListener("click", runGenerate);
    if (regenBtn) regenBtn.addEventListener("click", runGenerate);

    if (insertBtn) {
      insertBtn.addEventListener("click", () => {
        if (!lastResultText) return;
        const label = TYPE_LABELS[activeType] || "Generated";
        const line = `[${label}: ${lastResultText}]`;
        document.dispatchEvent(
          new CustomEvent("sc-rp-inject", {
            detail: { text: "\n" + line, silent: true },
          }),
        );
        flashCopyBtnLabel(insertBtn);
      });
    }

    return {};
  }

  window.SCRPGTrackerGenerators = { createGeneratorSection };
})();
