/* ============================================================
   EmTech Media — Phase 3 AI PROVIDER ADAPTER (no DOM)

   Clean separation between UI and model (§5): the rest of the app only
   ever calls `provider.generate(messages, options)` and never knows
   whether the model is Qwen, another local model, or a future provider.

   The browser talks to the LOCAL EMTECH AI GATEWAY (ai-gateway/server.mjs),
   which in turn talks to Qwen (§4). No credentials ever live here — if
   the upstream needs an API key it is configured on the gateway side.

   Exposes window.EmTechAIProvider with:
     baseClass()      → AIProvider (abstract)
     create(config)   → a ready provider instance for config.provider
   ============================================================ */
(function () {
  "use strict";

  class AIProvider {
    constructor(name) { this.name = name || "base"; }
    async generate(/* messages, options */) {
      throw new Error("AIProvider.generate() not implemented");
    }
  }

  /* OpenAI-compatible chat completions (what the gateway exposes). */
  class QwenProvider extends AIProvider {
    constructor(config) {
      super("qwen");
      this.cfg = config || {};
    }

    async generate(messages, options) {
      const o = options || {};
      if (!this.cfg.gatewayUrl) throw new Error("no gateway configured");

      const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      let timer = null;
      if (ctrl) {
        timer = setTimeout(() => {
          try { ctrl.abort(new Error("timeout")); } catch (err) {}
        }, o.timeoutMs || this.cfg.timeoutMs || 60000);
      }

      try {
        const res = await fetch(this.cfg.gatewayUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: o.model || this.cfg.model,
            messages,
            temperature: typeof (o.temperature !== undefined ? o.temperature : this.cfg.temperature) === "number"
              ? (o.temperature !== undefined ? o.temperature : this.cfg.temperature) : 0.2,
            max_tokens: o.maxTokens || this.cfg.maxTokens || 900,
          }),
          signal: ctrl ? ctrl.signal : undefined,
        });

        if (!res.ok) {
          const err = new Error("gateway responded " + res.status);
          err.status = res.status;
          throw err;
        }

        let data = null;
        try { data = await res.json(); } catch (err) { throw new Error("gateway returned non-JSON"); }

        const content = data && data.choices && data.choices[0] && data.choices[0].message
          ? data.choices[0].message.content : null;
        if (typeof content !== "string" || !content.trim()) throw new Error("empty model response");

        return { text: content, raw: data };
      } catch (err) {
        // Normalize abort/timeout so the engine can treat them uniformly (§34).
        if (err && err.name === "AbortError") {
          const e = new Error((err.message || "").indexOf("timeout") !== -1 ? "request timed out" : "generation cancelled");
          e.cancelled = true;
          throw e;
        }
        throw err;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
  }

  function create(config) {
    const provider = (config && config.provider) || "qwen";
    switch (provider) {
      case "qwen":
      case "openai-compatible":
        return new QwenProvider(config);
      default:
        throw new Error("unknown AI provider: " + provider);
    }
  }

  window.EmTechAIProvider = { AIProvider, QwenProvider, create };
})();
