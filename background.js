// background.js — Service Worker
// Handles AI API calls to keep API keys secure and avoid CORS issues

const MAX_DIAGNOSTIC_EVENTS = 40;

function newRuntimeDiagnostics() {
  return {
    since: new Date().toISOString(),
    requests: 0,
    successes: 0,
    failures: 0,
    retries: 0,
    networkErrors: 0,
    timeouts: 0,
    rateLimits: 0,
    transientHttpErrors: 0,
    nonRetryableHttpErrors: 0,
    emptyResponses: 0,
    lastModel: null,
    lastSuccessAt: null,
    lastErrorAt: null,
    lastError: null,
    recentEvents: [],
  };
}

const runtimeDiagnostics = newRuntimeDiagnostics();

function addDiagnosticEvent(type, details = {}) {
  runtimeDiagnostics.recentEvents.unshift({
    ts: new Date().toISOString(),
    type,
    ...details,
  });
  if (runtimeDiagnostics.recentEvents.length > MAX_DIAGNOSTIC_EVENTS) {
    runtimeDiagnostics.recentEvents.length = MAX_DIAGNOSTIC_EVENTS;
  }
}

function setLastError(message, details = {}) {
  runtimeDiagnostics.lastErrorAt = new Date().toISOString();
  runtimeDiagnostics.lastError = message;
  addDiagnosticEvent("error", { message, ...details });
}

function getDiagnosticsSnapshot() {
  return {
    ...runtimeDiagnostics,
    recentEvents: runtimeDiagnostics.recentEvents.slice(),
  };
}

function resetRuntimeDiagnostics() {
  const next = newRuntimeDiagnostics();
  Object.keys(runtimeDiagnostics).forEach((k) => delete runtimeDiagnostics[k]);
  Object.assign(runtimeDiagnostics, next);
}

// Initialize defaults on install
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.sync.get(["model", "commands"]);
  if (!data.model) {
    await chrome.storage.sync.set({
      model: "openrouter/free",
    });
  }
  // Clean up legacy keyword commands (Rewrites replaced them)
  if (data.commands !== undefined) {
    await chrome.storage.sync.remove("commands");
  }
});

// Listen for rewrite requests from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "REWRITE_TEXT") {
    runtimeDiagnostics.requests += 1;
    handleRewrite(message.text, message.prompt, message.apiKey, message.model)
      .then((result) => {
        runtimeDiagnostics.successes += 1;
        runtimeDiagnostics.lastSuccessAt = new Date().toISOString();
        runtimeDiagnostics.lastModel = result.model || message.model || null;
        addDiagnosticEvent("success", {
          model: runtimeDiagnostics.lastModel,
        });
        sendResponse({
          success: true,
          text: result.text,
          model: result.model,
          usage: result.usage,
          reasoning: result.reasoning,
        });
      })
      .catch((err) => {
        runtimeDiagnostics.failures += 1;
        setLastError(err.message, {
          model: message.model || "openrouter/free",
        });
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep channel open for async response
  }

  if (message.type === "GET_RUNTIME_DIAGNOSTICS") {
    sendResponse({
      success: true,
      diagnostics: getDiagnosticsSnapshot(),
    });
    return false;
  }

  if (message.type === "RESET_RUNTIME_DIAGNOSTICS") {
    resetRuntimeDiagnostics();
    sendResponse({
      success: true,
      diagnostics: getDiagnosticsSnapshot(),
    });
    return false;
  }

  return false;
});

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000; // base delay; doubles each attempt
const REQUEST_TIMEOUT_MS = 45000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBackoffMs(attempt) {
  return RETRY_DELAY_MS * Math.pow(2, attempt);
}

function parseRetryAfterMs(retryAfterValue) {
  if (!retryAfterValue) return null;
  const seconds = Number.parseFloat(retryAfterValue);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }
  const parsedDate = Date.parse(retryAfterValue);
  if (Number.isFinite(parsedDate)) {
    const delta = parsedDate - Date.now();
    return delta > 0 ? delta : 0;
  }
  return null;
}

function isRetryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(
        `Request timed out after ${Math.round(timeoutMs / 1000)}s.`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function handleRewrite(text, prompt, apiKey, model) {
  if (!apiKey) {
    throw new Error(
      "No API key set. Please configure your OpenRouter API key in the extension options.",
    );
  }

  const resolvedModel = model || "openrouter/free";
  let lastError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    let response;
    try {
      response = await fetchWithTimeout(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": "chrome-extension://ai-rewriter",
            "X-Title": "AI Rewriter Extension",
          },
          body: JSON.stringify({
            model: resolvedModel,
            messages: [
              { role: "system", content: prompt },
              { role: "user", content: text },
            ],
            temperature: 0.7,
            max_tokens: 2048,
          }),
        },
        REQUEST_TIMEOUT_MS,
      );
    } catch (err) {
      runtimeDiagnostics.networkErrors += 1;
      if (/timed out/i.test(String(err?.message || ""))) {
        runtimeDiagnostics.timeouts += 1;
      }
      lastError = new Error(
        `Network/request error (attempt ${attempt + 1}/${MAX_RETRIES}): ${err.message}`,
      );
      addDiagnosticEvent("network_error", {
        attempt: attempt + 1,
        model: resolvedModel,
        message: err.message,
      });
      if (attempt < MAX_RETRIES - 1) {
        runtimeDiagnostics.retries += 1;
        await sleep(getBackoffMs(attempt));
        continue;
      }
      break;
    }

    if (response.status === 429) {
      runtimeDiagnostics.rateLimits += 1;
      // Respect Retry-After header if present
      const retryAfterMs = parseRetryAfterMs(
        response.headers.get("Retry-After"),
      );
      const waitMs = retryAfterMs ?? getBackoffMs(attempt);
      addDiagnosticEvent("rate_limit", {
        attempt: attempt + 1,
        model: resolvedModel,
        waitMs,
      });
      lastError = new Error(
        `Rate limit hit (attempt ${attempt + 1}/${MAX_RETRIES}). Retrying in ${Math.round(waitMs / 1000)}s…`,
      );
      runtimeDiagnostics.retries += 1;
      await sleep(waitMs);
      continue;
    }

    if (!response.ok && isRetryableStatus(response.status)) {
      runtimeDiagnostics.transientHttpErrors += 1;
      const errBody = await response.json().catch(() => ({}));
      const detail = errBody?.error?.message || response.statusText;
      addDiagnosticEvent("transient_http_error", {
        attempt: attempt + 1,
        model: resolvedModel,
        status: response.status,
        detail,
      });
      lastError = new Error(
        `Transient API error ${response.status} (attempt ${attempt + 1}/${MAX_RETRIES}): ${detail}`,
      );
      if (attempt < MAX_RETRIES - 1) {
        runtimeDiagnostics.retries += 1;
        await sleep(getBackoffMs(attempt));
        continue;
      }
      break;
    }

    if (!response.ok) {
      runtimeDiagnostics.nonRetryableHttpErrors += 1;
      const errBody = await response.json().catch(() => ({}));
      const detail = errBody?.error?.message || response.statusText;
      throw new Error(`API error ${response.status}: ${detail}`);
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content?.trim();
    const reasoning = data.choices?.[0]?.message?.reasoning?.trim() || null;
    const usedModel = data.model || resolvedModel;
    if (!result) {
      runtimeDiagnostics.emptyResponses += 1;
      // Empty response — treat like a retryable failure
      lastError = new Error(
        `Empty response from AI (attempt ${attempt + 1}/${MAX_RETRIES}).`,
      );
      addDiagnosticEvent("empty_response", {
        attempt: attempt + 1,
        model: resolvedModel,
      });
      if (attempt < MAX_RETRIES - 1) {
        runtimeDiagnostics.retries += 1;
        await sleep(getBackoffMs(attempt));
      }
      continue;
    }
    return {
      text: result,
      reasoning,
      model: usedModel,
      usage: data.usage || null,
    };
  }

  // All retries exhausted
  throw (
    lastError ||
    new Error(
      `Request failed after ${MAX_RETRIES} attempts. Try again or switch models in options.`,
    )
  );
}
