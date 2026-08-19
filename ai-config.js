/* ============================================================
   EmTech Media — Phase 3 AI configuration (no DOM, no logic)

   Single place where the local Qwen endpoint is configured (§38).
   Nothing here holds credentials: if your model server needs an API
   key it belongs on the gateway side (ai-gateway/server.mjs), never
   in this file or in localStorage.

   Resolution order for gatewayUrl / model:
     1. Settings saved from the AI page's settings panel
        (localStorage "emtech-ai-settings-v1") — so you can point a
        deployed site at your own machine without editing code.
     2. The defaults below.

   Defaults assume the bundled local gateway (ai-gateway/server.mjs)
   running on this machine, which in turn proxies to LM Studio /
   Ollama where Qwen is loaded.
   ============================================================ */
(function () {
  "use strict";

  const SETTINGS_KEY = "emtech-ai-settings-v1";

  const DEFAULTS = Object.freeze({
    provider: "qwen",
    gatewayUrl: "http://localhost:8787/v1/chat/completions",
    model: "ollama/qwen3.8-27b",
    temperature: 0.2,      // low on purpose — troubleshooting wants consistency (§39)
    // Qwen3-style models spend part of the budget on internal reasoning before
    // emitting the JSON answer — leave headroom or `content` comes back empty.
    maxTokens: 2500,
    timeoutMs: 60000,      // hard ceiling per request (§33) — local inference is much faster
    healthTimeoutMs: 2500, // preflight check only; never blocks the page
  });

  function isHttpUrl(v) {
    try {
      const u = new URL(String(v));
      return u.protocol === "http:" || u.protocol === "https:";
    } catch (err) {
      return false;
    }
  }

  /* Read + sanitize saved settings. Corrupted values are dropped, not fatal (§27). */
  function loadSettings() {
    let raw = null;
    try { raw = window.localStorage.getItem(SETTINGS_KEY); } catch (err) { return {}; }
    if (!raw) return {};
    let s = null;
    try { s = JSON.parse(raw); } catch (err) { return {}; }
    if (!s || typeof s !== "object") return {};

    const out = {};
    if (isHttpUrl(s.gatewayUrl)) out.gatewayUrl = String(s.gatewayUrl).slice(0, 300);
    if (typeof s.model === "string" && s.model.trim()) out.model = s.model.trim().slice(0, 120);
    return out;
  }

  function saveSettings(patch) {
    const current = loadSettings();
    const next = Object.assign({}, current, patch || {});
    if (next.gatewayUrl !== undefined && !isHttpUrl(next.gatewayUrl)) delete next.gatewayUrl;
    if (next.model !== undefined && typeof next.model !== "string") delete next.model;
    try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch (err) {}
    return loadSettings();
  }

  function clearSettings() {
    try { window.localStorage.removeItem(SETTINGS_KEY); } catch (err) {}
    return {};
  }

  /* Effective config for a call: defaults ← saved settings. */
  function resolveConfig() {
    const s = loadSettings();
    return Object.assign({}, DEFAULTS, s);
  }

  window.EmTechAIConfig = {
    SETTINGS_KEY,
    defaults: DEFAULTS,
    loadSettings,
    saveSettings,
    clearSettings,
    resolveConfig,
  };
})();
