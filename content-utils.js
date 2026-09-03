// content-utils.js
// Pure utility functions shared by content runtime paths.

(function () {
  "use strict";

  function isListLine(line) {
    const t = line.trimStart();
    return /^-\s/.test(t) || /^\d+\.\s/.test(t);
  }

  function isBlockquoteLine(line) {
    const t = line.trimStart();
    return /^>/.test(t);
  }

  function isSpeakerTagLine(line) {
    const t = line.trimStart();
    return /^\*\*[^*\n]+:\*\*/.test(t);
  }

  // A standalone --- (3+ hyphens, nothing else on the line) — a markdown
  // thematic-break divider, not prose. Wrapping it in asterisks would turn
  // it into what looks like italicized text instead of a scene break.
  function isSeparatorLine(line) {
    const t = line.trim();
    return /^-{3,}$/.test(t);
  }

  // Strips stray single asterisks from a line while leaving any **bold**
  // pairs fully intact — used by fmtStripAsterisks when fmtPreserveBold is
  // on, so mid-sentence emphasis survives even outside a speaker-tag line.
  function stripAsterisksPreservingBold(line) {
    return line.replace(
      /\*\*[^*\n]+\*\*|\*/g,
      (m) => (m.length > 1 ? m : ""),
    );
  }

  // Wraps `line` in single asterisks while leaving any **bold** pair(s)
  // inside it completely untouched. Splits on the bold spans first and
  // wraps only the plain-text runs between them — gluing a fresh wrap
  // boundary directly onto a bold pair's own ** (e.g. one continuous wrap
  // with the bold "poking through") would produce an ambiguous run of 3+
  // asterisks, so each run is wrapped independently instead.
  function wrapPreservingBold(line) {
    return line
      .split(/(\*\*[^*\n]+\*\*)/)
      .map((part) => {
        if (/^\*\*[^*\n]+\*\*$/.test(part)) return part;
        if (!part.trim()) return part;
        const lead = part.slice(0, part.length - part.trimStart().length);
        const trail = part.slice(part.trimEnd().length);
        return lead + "*" + part.trim() + "*" + trail;
      })
      .join("");
  }

  function wrapOutsideText(str, opts) {
    return str.replace(/[^\n]+/g, (chunk) => {
      const trimmed = chunk.trim();
      if (!trimmed) return chunk;
      if (opts && opts.fmtPreserveLists && isListLine(trimmed)) return chunk;
      if (opts && opts.fmtPreserveBlockquotes && isBlockquoteLine(trimmed))
        return chunk;
      if (opts && opts.fmtPreserveSpeakerTags && isSpeakerTagLine(trimmed))
        return chunk;
      if (opts && opts.fmtPreserveSeparator && isSeparatorLine(trimmed))
        return chunk;
      const leadWS = chunk.slice(0, chunk.length - chunk.trimStart().length);
      const trailWS = chunk.slice(chunk.trimEnd().length);
      if (opts && opts.fmtPreserveBold && /\*\*[^*\n]+\*\*/.test(trimmed)) {
        return leadWS + wrapPreservingBold(trimmed) + trailWS;
      }
      return leadWS + "*" + trimmed + "*" + trailWS;
    });
  }

  function capitaliseSentences(text) {
    text = text.replace(
      /(^|\n\n)([a-z])/g,
      (_, sep, ch) => sep + ch.toUpperCase(),
    );
    text = text.replace(
      /([^.…])([.!?]) +([a-z])/g,
      (_, pre, punc, ch) => pre + punc + " " + ch.toUpperCase(),
    );
    return text;
  }

  function parseDelimiterPairs(str) {
    const pairs = [];
    for (let i = 0; i + 1 < str.length; i += 2) {
      pairs.push([str[i], str[i + 1]]);
    }
    return pairs;
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function escapeForCharClass(ch) {
    return ch.replace(/[\\^\]]/g, "\\$&");
  }

  function formatText(text, opts) {
    const options = opts || {};

    if (options.fmtOocBrackets) {
      text = text.replace(/\(\(\s*([\s\S]*?)\s*\)\)/g, "($1)");
    }

    if (options.fmtRepairAsterisks) {
      text = text
        .split("\n")
        .map((line) => {
          const count = (line.match(/\*/g) || []).length;
          return count % 2 !== 0 ? line + "*" : line;
        })
        .join("\n");
    }

    if (options.fmtStripAsterisks) {
      text = text
        .split("\n")
        .map((line) => {
          if (options.fmtPreserveSpeakerTags && isSpeakerTagLine(line))
            return line;
          return options.fmtPreserveBold
            ? stripAsterisksPreservingBold(line)
            : line.replace(/\*/g, "");
        })
        .join("\n");
    }
    if (options.fmtNormaliseQuotes) text = text.replace(/[\u201C\u201D]/g, '"');
    if (options.fmtNormaliseApostrophes)
      text = text.replace(/[\u2018\u2019]/g, "'");
    if (options.fmtEmDash) text = text.replace(/(?<!-)--(?!-)/g, "\u2014");

    if (options.fmtNoSpaceBeforePunct) {
      text = text.replace(/ +([,!?:;])/g, "$1").replace(/ +(\.)(?!\d)/g, "$1");
    }

    if (options.fmtNormaliseEllipsis) {
      text = text.replace(/\.{2,}/g, "...");
      text = text.replace(/\.{3}/g, "\u2026");
    }

    if (options.fmtSpaceAfterPunct) {
      text = text.replace(/(?<=[^\d\s.!?,;:\u2026])\.(?=[A-Za-z])/g, ". ");
      text = text.replace(/([,!?:;])(?=[A-Za-z])/g, "$1 ");
    }

    if (options.fmtCollapseSpaces) text = text.replace(/[ \t]{2,}/g, " ");
    if (options.fmtCapitaliseI) text = text.replace(/\bi\b/g, "I");

    if (options.fmtTrimLines) {
      text = text
        .split("\n")
        .map((line) => line.trim())
        .join("\n");
    }

    if (options.fmtNormaliseNewlines) {
      if (
        options.fmtPreserveLists ||
        options.fmtPreserveBlockquotes ||
        options.fmtPreserveSpeakerTags
      ) {
        const rawLines = text.split("\n");
        const outLines = [];
        for (let i = 0; i < rawLines.length; i++) {
          const cur = rawLines[i];
          if (outLines.length === 0) { outLines.push(cur); continue; }
          const prev = outLines[outLines.length - 1];
          const curBlank = cur.trim() === "";
          const prevBlank = prev.trim() === "";
          if (curBlank && prevBlank) continue;
          const sameList =
            options.fmtPreserveLists && isListLine(cur) && isListLine(prev);
          const sameQuote =
            options.fmtPreserveBlockquotes &&
            isBlockquoteLine(cur) &&
            isBlockquoteLine(prev);
          const sameSpeakerTag =
            options.fmtPreserveSpeakerTags &&
            isSpeakerTagLine(cur) &&
            isSpeakerTagLine(prev);
          if (!curBlank && !prevBlank && (sameList || sameQuote || sameSpeakerTag)) {
            outLines.push(cur);
          } else if (!curBlank && !prevBlank) {
            outLines.push("");
            outLines.push(cur);
          } else {
            outLines.push(cur);
          }
        }
        text = outLines.join("\n");
      } else {
        text = text.replace(/\n+/g, "\n\n");
      }
    }
    if (options.fmtCapitaliseSentences) text = capitaliseSentences(text);

    if (options.fmtCapitaliseQuotes) {
      text = text.replace(/"([a-z])/g, (_, ch) => '"' + ch.toUpperCase());
    }

    const patterns = ['"[^"]*"'];
    if (options.fmtUnwrapBrackets) patterns.push("\\[[^\\]]*\\]");
    if (options.fmtUnwrapParens) patterns.push("\\([^)]*\\)");
    if (options.fmtPreserveBold) {
      // Matched here (not just left to wrapPreservingBold below) so a bold
      // pair whose *entire* inner content is itself a quoted/bracketed span
      // — e.g. **"Testing"** or **[Testing]** — is captured as one atomic
      // unit before the quote/bracket pattern above can split it in two.
      // Splitting left two bare "**" fragments behind, each of which then
      // got individually re-wrapped in fresh asterisks by wrapOutsideText,
      // doubling them into "****...****" — the reported bug.
      //
      // A **Word:** pair (ending in ":" right before the close) is excluded
      // here whenever fmtPreserveSpeakerTags is on: matching it at this
      // whole-text stage would strip that prefix off a speaker-tag line
      // before wrapOutsideText's own isSpeakerTagLine check ever sees the
      // full line, breaking that feature. It's left for wrapPreservingBold
      // to handle per-line instead, which doesn't have that blind spot.
      patterns.push(
        options.fmtPreserveSpeakerTags
          ? "\\*\\*(?:[^*\\n]*[^:*\\n])\\*\\*"
          : "\\*\\*[^*\\n]+\\*\\*",
      );
    }

    for (const [open, close] of parseDelimiterPairs(
      options.fmtExtraDelimiters || "",
    )) {
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
        parts.push(wrapOutsideText(text.slice(lastIndex, match.index), options));
      }
      parts.push(match[0]);
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(wrapOutsideText(text.slice(lastIndex), options));
    }

    let result = parts.join("");

    if (options.fmtActionPunctuation) {
      // Lookaround excludes the inner span of a **bold** pair \u2014 without it,
      // the single-* half of each ** would match on its own and could pick
      // up a stray period, corrupting the pair (see fmtPreserveBold).
      result = result.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, (_, inner) => {
        const t = inner.trimEnd();
        return /[.!?,:\u2026\u2014\-_]$/.test(t) ? `*${inner}*` : `*${t}.*`;
      });
    }

    if (options.fmtActionPunctuation || options.fmtCapitaliseSentences) {
      result = result.replace(
        /([.!?\u2026\u2014\-_]\*)([^*]*)\*([a-z])/g,
        (_, end, mid, ch) => end + mid + "*" + ch.toUpperCase(),
      );
    }

    return result;
  }

  // Formats a numeric resource value with thousand separators and compact
  // suffix notation for large numbers, keeping raw strings as-is.
  function formatResourceValue(raw) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return String(raw ?? "");
    return n.toLocaleString();
  }

  const api = {
    formatText,
    formatResourceValue,
  };

  const root = typeof window !== "undefined" ? window : globalThis;

  root.AIRewriterContentUtils = Object.assign(
    {},
    root.AIRewriterContentUtils || {},
    api,
  );

  // Optional export path for lightweight script-based tests.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
