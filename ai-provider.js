/* ============================================================
   EmTech Media — Phase 3.1 AI PROVIDER ADAPTER (no DOM)

   Clean separation between UI and model (§5/§9): the rest of the app only
   ever calls `provider.generate(messages, options)` and never knows which
   backend served it:

     LocalQwenProvider → local dev gateway (ai-gateway/server.mjs) → Qwen on
                         this machine. Speaks raw OpenAI chat-completions.
     CloudQwenProvider → EmTech AI API worker (ai-api/) → Qwen cloud API.
                         The worker holds the key; speaks a normalized
                         { ok, errors?, text } envelope (§11).

   Both send the same request body ({model, messages, temperature,
   max_tokens}), so switching modes never changes what the engine does (§8).
   No credentials ever live in this file or in localStorage (§5) — for cloud
   mode the key sits on the worker; for local mode it's an env var of the
   gateway.

   Exposes window.EmTechAIProvider with:
     AIProvider             (abstract base)
     LocalQwenProvider / CloudQwenProvider
     create(config)         → provider for config.mode ("cloud" default | "local")
   ============================================================ */
(function () {
  "use strict";

  class AIProvider {
    constructor(name) { this.name = name || "base"; }
    async generate(/* messages, options */) {
      throw new Error("AIProvider.generate() not implemented");
    }
  }

  /* Shared request handling for the two Qwen backends. Subclasses only
     differ in how they read the response envelope (parse). */
  class QwenBase extends AIProvider {
    constructor(name, config) {
      super(name);
      this.cfg = config || {};
    }

    async generate(messages, options) {
      const o = options || {};
      if (!this.cfg.endpoint) throw new Error("no AI endpoint configured");

      const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      let timer = null;
      if (ctrl) {
        timer = setTimeout(() => {
          try { ctrl.abort(new Error("timeout")); } catch (err) {}
        }, o.timeoutMs || this.cfg.timeoutMs || 60000);
      }

      try {
        const res = await fetch(this.cfg.endpoint, {
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
          const err = new Error("AI service responded " + res.status);
          err.status = res.status;
          throw err;
        }

        let data = null;
        try { data = await res.json(); } catch (err) { throw new Error("AI service returned non-JSON"); }

        return this.parse(data);
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

    parse(/* data */) {
      throw new Error("parse() not implemented");
    }
  }

  /* Local dev gateway: raw OpenAI chat-completions envelope. */
  class LocalQwenProvider extends QwenBase {
    constructor(config) { super("qwen-local", config); }

    parse(data) {
      const content = data && data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content : null;
      if (typeof content !== "string" || !content.trim()) throw new Error("empty model response");
      return { text: content, raw: data };
    }
  }

  /* Production worker: normalized EmTech envelope (§11). `validation` is the
     server's check of the JSON against the real knowledge base — the engine
     still re-validates locally (defense in depth, §35). */
  class CloudQwenProvider extends QwenBase {
    constructor(config) { super("qwen-cloud", config); }

    parse(data) {
      if (!data || typeof data.text !== "string" || !data.text.trim()) throw new Error("empty model response");
      return {
        text: data.text,
        validation: { ok: data.ok === true, errors: Array.isArray(data.errors) ? data.errors : [] },
        raw: data,
      };
    }
  }

  function create(config) {
    const mode = (config && config.mode) || "cloud"; // production default (§61)
    if (mode === "local") return new LocalQwenProvider(config);
    return new CloudQwenProvider(config);
  }

  window.EmTechAIProvider = { AIProvider, QwenBase, LocalQwenProvider, CloudQwenProvider, create };
})();
