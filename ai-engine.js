/* ============================================================
   EmTech Media — Phase 3 AI ENGINE / ORCHESTRATOR (no DOM)

   Sits between the UI (ai-ui.js) and everything else (§3):

     user text → normalize/classify → retrieve knowledge → build prompt
               → provider.generate() → validate JSON → safety scan
               → turn object for the UI

   Rules enforced here:
     * The model may only recommend fixes that exist in tips-data.js
       (getFixBySlug) — invalid ids are rejected, never rendered (§36).
     * Platform guard: a Mac session can't receive Windows-only fixes
       and vice versa (§20), even if the model slips.
     * One retry with stricter instructions on invalid output, then a
       deterministic Phase 2 fallback (EmTechDiag.analyze) — never a
       broken page (§34/§58).
     * Risky language is flagged for a confirmation banner (§18/§19).
     * "Yes, it's fixed" is answered locally — no inference call needed.

   Exposes window.EmTechAI. Load order: tips-data → diag-data →
   diag-engine → ai-config → ai-knowledge → ai-prompt → ai-provider → this.
   ============================================================ */
(function () {
  "use strict";

  const K = window.EmTechAIKnowledge;
  if (!K) return; // knowledge layer missing — stay silent, page degrades to Phase 2 links

  const PROMPT = window.EmTechAIPrompt || null;
  const PROVIDERS = window.EmTechAIProvider || null;
  const CFG = window.EmTechAIConfig || null;

  const SESSION_KEY = "emtech-ai-session-v1";
  const HISTORY_KEY = "emtech-ai-history-v1";
  const CONVO_CAP = 40;      // conversation entries kept in the session (UI + context)
  const CONTEXT_MSGS = 16;   // raw messages sent to the model per turn (§62: bounded context)
  const HISTORY_MAX = 8;

  /* ============================================================
     Events (§41/§59) — reuse Phase 2's ring buffer when available.
     Nothing is transmitted anywhere.
     ============================================================ */
  function trackEvent(name, payload) {
    try {
      if (window.EmTechDiag && typeof window.EmTechDiag.trackEvent === "function") {
        return window.EmTechDiag.trackEvent(name, payload);
      }
    } catch (err) {}
    try {
      const buf = (window.__emtechAiEvents = window.__emtechAiEvents || []);
      buf.push({ t: Date.now(), name: String(name), payload: payload || null });
      if (buf.length > 200) buf.splice(0, buf.length - 200);
    } catch (err) {} // telemetry must never break the flow
  }

  /* ============================================================
     Session state (§24/§53 — serializable for a future share feature)
     {
       v: 3, id, startedAt, updatedAt,
       platform: "windows"|"mac"|null,
       category: string|null,
       problemSummary: "",
       level: "beginner"|"intermediate"|"advanced",
       conversation: [{role:"user"|"ai", kind, text, ts}],
       askedQuestions: [],      // approved question ids already asked (§25)
       attemptedFixes: [],      // fix slugs we recommended
       failedFixes: [],         // user said "no"
       partialFixes: [],        // user said "helped but remains"
       solvedFix: null,
       status: "active"|"resolved",
     }
     ============================================================ */
  function uid() { return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8); }
  const nowIso = () => new Date().toISOString();

  function freshSession() {
    return {
      v: 3, id: uid(), startedAt: nowIso(), updatedAt: nowIso(),
      platform: null, category: null, problemSummary: "", level: "beginner",
      conversation: [], askedQuestions: [], attemptedFixes: [], failedFixes: [], partialFixes: [],
      solvedFix: null, status: "active",
    };
  }

  const VALID_PLATFORMS = ["windows", "mac"];
  const VALID_LEVELS = ["beginner", "intermediate", "advanced"];

  function validateState(s) {
    try {
      if (!s || typeof s !== "object" || s.v !== 3 || typeof s.id !== "string") return null;
      const out = freshSession();
      out.id = s.id;
      if (typeof s.startedAt === "string") out.startedAt = s.startedAt;
      if (typeof s.updatedAt === "string") out.updatedAt = s.updatedAt;
      if (VALID_PLATFORMS.indexOf(s.platform) !== -1) out.platform = s.platform;
      if (typeof s.category === "string" && s.category.length <= 40) out.category = s.category;
      if (typeof s.problemSummary === "string") out.problemSummary = s.problemSummary.slice(0, 200);
      if (VALID_LEVELS.indexOf(s.level) !== -1) out.level = s.level;

      if (Array.isArray(s.conversation)) {
        out.conversation = s.conversation.filter((m) => m && typeof m === "object" && (m.role === "user" || m.role === "ai") && typeof m.text === "string")
          .map((m) => ({ role: m.role, kind: typeof m.kind === "string" ? m.kind.slice(0, 40) : "", text: String(m.text).slice(0, 1200), ts: typeof m.ts === "string" ? m.ts : nowIso() }))
          .slice(-CONVO_CAP);
      }

      const cleanList = (arr, max) => Array.isArray(arr) ? arr.map(String).filter(Boolean).slice(0, max) : [];
      out.askedQuestions = cleanList(s.askedQuestions, 30);
      out.attemptedFixes = cleanList(s.attemptedFixes, 20);
      out.failedFixes = cleanList(s.failedFixes, 20);
      out.partialFixes = cleanList(s.partialFixes, 20);
      if (typeof s.solvedFix === "string" && K.getFixBySlug(s.solvedFix)) out.solvedFix = s.solvedFix;
      out.status = s.status === "resolved" ? "resolved" : "active";
      return out;
    } catch (err) {
      return null; // corrupted → fresh session, never a crash (§27/§36)
    }
  }

  /* ---------- localStorage service (all try/catch, §27) ---------- */
  const store = {
    loadSession() {
      let raw = null;
      try { raw = window.localStorage.getItem(SESSION_KEY); } catch (err) { return null; }
      if (!raw) return null;
      try { return validateState(JSON.parse(raw)); } catch (err) { return null; }
    },
    saveSession(state) {
      try { state.updatedAt = nowIso(); window.localStorage.setItem(SESSION_KEY, JSON.stringify(state)); } catch (err) {}
    },
    clearSession() {
      try { window.localStorage.removeItem(SESSION_KEY); } catch (err) {}
    },
    loadHistory() {
      let raw = null;
      try { raw = window.localStorage.getItem(HISTORY_KEY); } catch (err) { return []; }
      if (!raw) return [];
      let list = null;
      try { list = JSON.parse(raw); } catch (err) { return []; }
      if (!Array.isArray(list)) return [];
      return list.filter((e) => e && typeof e === "object" && typeof e.id === "string").slice(0, HISTORY_MAX);
    },
    upsertHistory(entry) {
      const list = store.loadHistory();
      const i = list.findIndex((e) => e.id === entry.id);
      if (i !== -1) list[i] = Object.assign({}, list[i], entry);
      else list.unshift(entry);
      try { window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX))); } catch (err) {}
    },
  };

  /* ============================================================
     Safety layer (§18/§19) — flag risky language for a confirmation
     banner. The knowledge base itself is trusted; this guards the
     model's free text.
     ============================================================ */
  const RISKY_PATTERNS = [
    { re: /\bregistry\b/i, note: "Editing the Windows registry can break system updates and is hard to undo." },
    { re: /format(ted|ting)?\s+(the\s+)?(drive|disk|c:\s*drive)/i, note: "Formatting a drive permanently deletes everything on it." },
    { re: /\bdelete (all |every )?(system files?|files?)\b/i, note: "Deleting system files can make Windows unbootable." },
    { re: /disable[sd]?\s+(windows security|defender|antivirus|firewall)/i, note: "Disabling security software leaves the machine exposed while it's off." },
    { re: /\bbios\b|\buefi\b/i, note: "BIOS/UEFI changes can make a PC unbootable if set wrong — only touch settings you understand." },
    { re: /firmware flash/i, note: "Flashing firmware with the wrong file can permanently brick hardware." },
    { re: /partition table|delete partition/i, note: "Partition changes can wipe data on adjacent partitions." },
  ];

  function safetyScan(text) {
    const t = String(text || "");
    for (const p of RISKY_PATTERNS) {
      if (p.re.test(t)) return { pattern: p.re.source, note: p.note };
    }
    return null;
  }

  /* ============================================================
     Structured response validation (§35/§36) — never trust model JSON.
     ============================================================ */
  const STATUSES = ["question", "recommendation", "resolved", "insufficient_information", "unsupported", "safety_warning"];
  const CONFIDENCES = ["low", "medium", "high"];

  /* Find the first balanced {...} block in free text and parse it.
     Models occasionally wrap JSON in prose or fences despite instructions. */
  function extractJson(text) {
    if (typeof text !== "string") return null;
    const start = text.indexOf("{");
    if (start === -1) return null;
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") { depth--; if (depth === 0) { try { return JSON.parse(text.slice(start, i + 1)); } catch (err) { return null; } } }
    }
    return null;
  }

  function str(v, max) {
    if (typeof v !== "string") return null;
    const t = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
    return t.length <= max ? t : t.slice(0, max);
  }

  function validateResponse(raw, session) {
    const errors = [];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, errors: ["response is not a JSON object"] };

    const status = raw.status;
    if (STATUSES.indexOf(status) === -1) errors.push(`status must be one of ${STATUSES.join(", ")}`);

    const message = str(raw.message, 800);
    if (!message) errors.push("message is required and must be a non-empty string");

    let platform = null;
    if (raw.platform !== undefined && raw.platform !== null) {
      if (VALID_PLATFORMS.indexOf(raw.platform) === -1) errors.push('platform must be "windows", "mac" or null');
      else platform = raw.platform;
    }

    let category = null;
    if (raw.category !== undefined && raw.category !== null) {
      const c = str(raw.category, 40);
      if (!c) errors.push("category must be a short string or null");
      else category = c;
    }

    const problemSummary = str(raw.problem_summary, 200) || "";

    let confidence = null;
    if (raw.confidence !== undefined && raw.confidence !== null) {
      if (CONFIDENCES.indexOf(raw.confidence) === -1) errors.push('confidence must be "low", "medium", "high" or null');
      else confidence = raw.confidence;
    }

    // candidate_causes — drop entries with invalid fix ids, keep labels.
    const candidateCauses = [];
    if (raw.candidate_causes !== undefined) {
      if (!Array.isArray(raw.candidate_causes)) errors.push("candidate_causes must be an array");
      else for (const c of raw.candidate_causes.slice(0, 6)) {
        if (!c || typeof c !== "object") continue;
        const label = str(c.label, 140);
        if (!label) continue;
        const entry = { label };
        if (c.fix_id !== undefined && c.fix_id !== null) {
          const tip = K.getFixBySlug(String(c.fix_id));
          if (tip) entry.fixId = String(c.fix_id); // invalid id → dropped, not fatal for a cause
        }
        candidateCauses.push(entry);
      }
    }

    // question — must be an approved one or "free"; never already asked.
    let question = null;
    if (raw.question !== undefined && raw.question !== null) {
      const q = raw.question;
      if (!q || typeof q !== "object") errors.push("question must be an object");
      else {
        const text = str(q.text, 300);
        let id = typeof q.id === "string" ? q.id.trim() : "";
        if (!text) errors.push("question.text is required");

        // Validation universe: branch questions + the full bank (early turns
        // happen before platform/category are known — don't reject valid ids).
        const branchQs = K.approvedQuestions(session.platform, session.category, []);
        const approved = branchQs.concat(
          K.allApprovedQuestions().filter((a) => !branchQs.some((x) => x.id === a.id))
        );
        const match = approved.find((a) => a.id === id);
        if (match) {
          // Map the model's option labels onto the approved values.
          const wanted = Array.isArray(q.options) ? q.options.map((o) => String(o).toLowerCase()).filter(Boolean) : [];
          let options = match.options.filter((o) => !wanted.length || wanted.indexOf(String(o.label).toLowerCase()) !== -1);
          if (options.length < 2) {
            // Model omitted/renamed labels — fall back to the full approved set.
            options = match.options;
          }
          question = { id: match.id, text: match.text, options: options.slice(0, 6).map((o) => ({ label: o.label, value: o.value })) };
        } else if (id === "free") {
          const opts = Array.isArray(q.options) ? q.options.map((o) => str(o, 80)).filter(Boolean).slice(0, 6) : [];
          if (opts.length < 2) errors.push("question.options needs at least 2 short labels");
          else question = { id: "free", text, options: opts.map((label, i) => ({ label, value: "opt-" + i })) };
        } else if (id) {
          // Unknown id that isn't "free": reject so the model retries with a real one.
          errors.push(`question.id "${id}" is not an approved question and not "free"`);
        }

        if (question && session.askedQuestions.indexOf(question.id) !== -1) {
          errors.push(`question "${question.id}" was already asked — never repeat a question`);
          question = null;
        }
      }
    }

    // recommended_fix — must exist in the knowledge base + platform guard.
    let recommendedFix = null;
    if (raw.recommended_fix !== undefined && raw.recommended_fix !== null) {
      const rf = raw.recommended_fix;
      if (!rf || typeof rf !== "object") errors.push("recommended_fix must be an object");
      else {
        const slug = String(rf.fix_id || "");
        const tip = K.getFixBySlug(slug);
        if (!tip) errors.push(`recommended_fix.fix_id "${slug}" does not exist in the EmTech knowledge base`);
        else {
          // Platform guard (§20): never recommend the other OS's fix.
          const isMacTip = tip.cat === "mac";
          if (session.platform === "mac" && !isMacTip) errors.push("recommended a Windows fix for a Mac session");
          else if (session.platform === "windows" && isMacTip) errors.push("recommended a Mac fix for a Windows session");
          else recommendedFix = { fixId: slug, tip, reason: str(rf.reason, 300) || "" };
        }
      }
    }

    // related_fixes — filter to real slugs only (§36).
    const relatedFixes = [];
    if (Array.isArray(raw.related_fixes)) {
      for (const slug of raw.related_fixes.slice(0, 4)) {
        const s = String(slug || "");
        if (!s) continue;
        if (recommendedFix && s === recommendedFix.fixId) continue;
        const tip = K.getFixBySlug(s);
        if (tip && relatedFixes.indexOf(s) === -1) relatedFixes.push(s);
      }
    }

    // Cross-status rules.
    if (!errors.length) {
      if (status === "question" && !question) errors.push('status "question" requires a question object');
      if (status === "recommendation" && !recommendedFix) errors.push('status "recommendation" requires recommended_fix with a valid fix_id');
    }

    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      value: { status, message, platform, category, problemSummary, confidence, candidateCauses, question, recommendedFix, relatedFixes },
    };
  }

  /* ============================================================
     Safety scan of a validated turn (§18/§19)
     ============================================================ */
  function applySafety(turnValue) {
    const texts = [turnValue.message];
    if (turnValue.question) texts.push(turnValue.question.text);
    for (const t of texts) {
      const hit = safetyScan(t);
      if (hit) return Object.assign({}, turnValue, { status: "safety_warning", safetyNote: hit.note });
    }
    return turnValue;
  }

  /* ============================================================
     Phase 2 deterministic fallback (§32/§57/§58).
     Reuses EmTechDiag.analyze() over the same knowledge base — this is
     what keeps the site useful when Qwen is offline.
     ============================================================ */
  function firstUserText(session) {
    for (const m of session.conversation) if (m.role === "user") return m.text;
    return "";
  }

  function fallbackDiagnosis(session, reason) {
    const D = window.EmTechDiag;
    if (!D || typeof D.analyze !== "function") return null;

    let platform = session.platform;
    let category = session.category;
    // Still unknown? Classify locally from what the user said (§57).
    if (!platform || !category) {
      const guess = K.classifyProblem(firstUserText(session) + " " + (session.problemSummary || ""));
      platform = platform || guess.platform;
      category = category || guess.category;
    }

    const device = platform === "mac" ? "mac" : platform === "windows" ? "windows" : null;
    if (!device) return null; // can't run the deterministic engine without a platform

    let state = null;
    try {
      state = D.newSession({ device, category });
      if (state.category && firstUserText(session)) D.setDescription(state, firstUserText(session));
      // Map AI-asked answers onto Phase 2 question values where the ids overlap.
      const profile = D.getProfile ? D.getProfile(state) : null;
      if (profile) {
        for (const qid of session.askedQuestions) {
          if ((profile.questions || []).indexOf(qid) === -1) continue;
          // Find the user's answer text in the conversation.
          const idx = session.conversation.findIndex((m) => m.role === "ai" && m.kind === "question" && (m.metaQuestionId === qid));
          if (idx === -1) continue;
          const ans = session.conversation[idx + 1];
          if (!ans || ans.role !== "user") continue;
          const q = D.data.questions[qid];
          const opt = (q && q.options || []).find((o) => o.label.toLowerCase() === ans.text.trim().toLowerCase());
          if (opt) { try { D.answer(state, qid, opt.value); } catch (err) {} }
        }
      }
      const result = D.analyze(state);
      if (!result || result.status === "no_match") return null;

      const recSlug = result.recommendedFix || (Array.isArray(result.alternativeFixes) ? result.alternativeFixes[0] : null);
      const tip = recSlug ? K.getFixBySlug(recSlug) : null;
      if (!tip) {
        // No single fix — still surface the ranked list honestly.
        return {
          kind: "fallback", status: "insufficient_information",
          message: (reason || "EmTech AI is unavailable") + " — here's what our built-in troubleshooter found worth checking.",
          relatedFixes: (result.alternativeFixes || []).filter((s) => K.getFixBySlug(s)).slice(0, 4),
          confidence: null, fallbackReason: reason || "ai-unavailable",
        };
      }

      return {
        kind: "fallback", status: "recommendation",
        message: (reason || "EmTech AI is unavailable") + ". Based on what you've told us, this is the most likely fix from our library.",
        recommendedFix: { fixId: recSlug, tip, reason: result.primary ? result.primary.label : "" },
        relatedFixes: (result.alternativeFixes || []).filter((s) => K.getFixBySlug(s) && s !== recSlug).slice(0, 3),
        confidence: result.confidence || null, fallbackReason: reason || "ai-unavailable",
      };
    } catch (err) {
      return null; // fallback must never throw either (§34)
    }
  }

  /* ============================================================
     Prompt assembly (§8/§15/§21/§62)
     ============================================================ */
  function inferLevel(session, text) {
    const t = " " + String(text || "").toLowerCase() + " ";
    if (/\b(task manager|activity monitor|terminal|command prompt|driver|gpu|nvme|ssd|registry)\b/.test(t)) {
      session.level = session.level === "beginner" ? "intermediate" : session.level;
    }
  }

  function compactAiText(m) {
    // Assistant turns are stored pre-rendered in m.text — use as-is.
    return String(m.text || "");
  }

  function buildMessages(session, knowledgeHits, retryErrors) {
    const cfg = CFG ? CFG.resolveConfig() : {};
    // Branch questions when known; otherwise the full bank (capped) so the
    // model still has real question ids to reference on early turns.
    let approved = K.approvedQuestions(session.platform, session.category, session.askedQuestions);
    if (!approved.length) approved = K.allApprovedQuestions().filter((q) => !session.askedQuestions.includes(q.id)).slice(0, 12);

    let systemText;
    if (PROMPT && typeof PROMPT.buildSystemPrompt === "function") {
      systemText = PROMPT.buildSystemPrompt({
        platform: session.platform,
        category: session.category,
        problemSummary: session.problemSummary,
        level: session.level,
        askedQuestions: session.askedQuestions,
        attemptedFixes: session.attemptedFixes,
        failedFixes: session.failedFixes,
        approvedQuestions: approved,
        knowledgeContext: K.buildKnowledgeContext(knowledgeHits),
      });
    } else {
      systemText = "You are EmTech AI. Respond with one JSON object only.";
    }

    const messages = [{ role: "system", content: systemText }];
    for (const m of session.conversation.slice(-CONTEXT_MSGS)) {
      if (m.role === "user") messages.push({ role: "user", content: m.text });
      else messages.push({ role: "assistant", content: compactAiText(m) });
    }

    if (retryErrors && PROMPT && typeof PROMPT.buildRetryInstruction === "function") {
      messages.push({ role: "user", content: PROMPT.buildRetryInstruction(retryErrors) });
    }
    return messages;
  }

  /* ============================================================
     Turn finalization — update session facts, persist, emit events.
     ============================================================ */
  function finalizeTurn(session, value, meta) {
    // Adopt platform/category the model confirmed (only if consistent).
    if (value.platform && (!session.platform || session.platform === value.platform)) session.platform = value.platform;
    if (value.category && !session.category) session.category = value.category;
    if (value.problemSummary) session.problemSummary = value.problemSummary;

    if (value.question && value.question.id !== "free" && session.askedQuestions.indexOf(value.question.id) === -1) {
      session.askedQuestions.push(value.question.id);
    }
    if (value.recommendedFix && session.attemptedFixes.indexOf(value.recommendedFix.fixId) === -1) {
      session.attemptedFixes.push(value.recommendedFix.fixId);
    }

    // Store a compact rendering of the AI turn for context + resume.
    let compact = value.message;
    if (value.question) compact += " [question:" + value.question.id + "]";
    if (value.recommendedFix) compact += " [fix:" + value.recommendedFix.fixId + "]";

    session.conversation.push({ role: "ai", kind: value.status, text: compact.slice(0, 1200), ts: nowIso(), metaQuestionId: value.question ? value.question.id : null });
    if (session.conversation.length > CONVO_CAP) session.conversation.splice(0, session.conversation.length - CONVO_CAP);

    store.saveSession(session);
    trackEvent("ai_turn", { status: value.status, kind: meta.kind || "ai", fixId: value.recommendedFix ? value.recommendedFix.fixId : null });
    return Object.assign({}, value, { kind: meta.kind || "ai", meta: meta.meta || {} });
  }

  /* ============================================================
     The main pipeline (§41) — one user input → one validated turn.
     ============================================================ */
  async function runTurn(session, opts) {
    const o = opts || {};
    trackEvent("ai_turn_started", { via: o.via || "message" });

    // Local understanding first (deterministic, free): platform/category/level.
    if (!session.platform || !session.category) {
      const guess = K.classifyProblem(o.text + " " + (session.problemSummary || ""));
      if (!session.platform && guess.platform) session.platform = guess.platform;
      if (!session.category && guess.category) session.category = guess.category;
    }
    inferLevel(session, o.text);

    // Retrieve relevant knowledge only (§8/§40).
    let hits = [];
    try { hits = K.searchKnowledgeBase({ query: (o.text || "") + " " + (session.problemSummary || ""), platform: session.platform, limit: 6 }); } catch (err) {}

    const cfg = CFG ? CFG.resolveConfig() : {};
    if (!PROVIDERS || !cfg.gatewayUrl) {
      // No provider configured at all — straight to the deterministic path.
      return fallbackDiagnosis(session, "EmTech AI is not configured on this device") || errorTurn("ai-not-configured");
    }

    const provider = PROVIDERS.create(cfg);
    let lastErrors = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      let out;
      try {
        out = await provider.generate(buildMessages(session, hits, lastErrors), {});
      } catch (err) {
        if (err && err.cancelled && /cancelled/i.test(err.message || "")) {
          trackEvent("ai_cancelled", {});
          return { kind: "cancelled", message: "Stopped. Send your message again whenever you're ready." };
        }
        // Network/timeout/gateway down → deterministic fallback (§32).
        const fb = fallbackDiagnosis(session, err && err.message ? "EmTech AI is currently unavailable (" + err.message + ")" : "EmTech AI is currently unavailable");
        trackEvent("ai_fallback", { reason: (err && err.message) || "network" });
        return fb || errorTurn("ai-unavailable");
      }

      const parsed = extractJson(out.text);
      if (!parsed) { lastErrors = ["response was not valid JSON"]; continue; }

      const v = validateResponse(parsed, session);
      if (v.ok) {
        trackEvent("ai_validated", { attempt });
        return finalizeTurn(session, applySafety(v.value), { kind: "ai", meta: { kbVersion: K.version, model: cfg.model, attempt } });
      }

      lastErrors = v.errors; // retry once with stricter instructions (§58)
    }

    trackEvent("ai_fallback", { reason: "invalid-response" });
    return fallbackDiagnosis(session, "EmTech AI gave an answer we couldn't verify") || errorTurn("ai-invalid");
  }

  function errorTurn(code) {
    return { kind: "error", code, message: "Something went wrong on our side. The built-in troubleshooter still works — or try again in a moment." };
  }

  /* ============================================================
     Public API (UI renders turns; engine owns state + rules)
     ============================================================ */
  function sendUserMessage(text) {
    const clean = String(text == null ? "" : text).replace(/\s+/g, " ").trim().slice(0, 500);
    if (!clean) return Promise.resolve({ kind: "error", code: "empty-message", message: "Tell me a little more about what's happening." });

    const session = store.loadSession() || freshSession();
    session.conversation.push({ role: "user", text: clean, ts: nowIso() });
    if (session.conversation.length > CONVO_CAP) session.conversation.splice(0, session.conversation.length - CONVO_CAP);
    store.saveSession(session);
    trackEvent("ai_message_sent", { len: clean.length });

    return runTurn(session, { text: clean, via: "message" }).then((turn) => {
      // Keep the canonical session object in sync for the UI.
      const fresh = store.loadSession() || session;
      return Object.assign({ session: fresh }, turn);
    });
  }

  /* User picked an answer card (or typed a free answer). */
  function answerQuestion(label) {
    return sendUserMessage(String(label));
  }

  /* Fix feedback loop (§26/§27). "yes" is answered locally — no inference. */
  function fixResult(fixId, result) {
    const session = store.loadSession() || freshSession();
    const tip = K.getFixBySlug(String(fixId));

    if (result === "yes") {
      const slug = String(fixId);
      session.status = "resolved";
      session.solvedFix = tip ? slug : null;
      if (!session.attemptedFixes.includes(slug)) session.attemptedFixes.push(slug);
      store.saveSession(session);
      store.upsertHistory({ id: session.id, date: nowIso(), platform: session.platform || "", category: session.category || "", summary: session.problemSummary || firstUserText(session).slice(0, 120), fix: session.solvedFix, status: "solved" });
      trackEvent("ai_fix_solved", { fixId: String(fixId) });
      return Promise.resolve({
        kind: "resolved", status: "resolved",
        message: "Problem solved — glad we could help.",
        recommendedFix: tip ? { fixId: String(fixId), tip, reason: "" } : null,
        session,
      });
    }

    if (result === "no" || result === "partial") {
      const slug = String(fixId);
      if (tip && session.attemptedFixes.indexOf(slug) === -1) session.attemptedFixes.push(slug);
      if (result === "no") {
        if (!session.failedFixes.includes(slug)) session.failedFixes.push(slug);
      } else {
        if (!session.partialFixes.includes(slug)) session.partialFixes.push(slug);
      }
      store.saveSession(session);
      trackEvent(result === "no" ? "ai_fix_failed" : "ai_fix_partial", { fixId: slug });

      const note = result === "no"
        ? `I tried the "${tip ? tip.title : fixId}" fix and it did NOT solve the problem. Please continue investigating other likely causes.`
        : `I tried the "${tip ? tip.title : fixId}" fix — it helped, but the problem remains. Treat that cause as only part of the story and keep investigating.`;

      const s2 = store.loadSession() || session;
      s2.conversation.push({ role: "user", text: note, ts: nowIso() });
      if (s2.conversation.length > CONVO_CAP) s2.conversation.splice(0, s2.conversation.length - CONVO_CAP);
      store.saveSession(s2);

      return runTurn(s2, { text: note, via: "fix-result" }).then((turn) => Object.assign({ session: store.loadSession() || s2 }, turn));
    }

    return Promise.resolve({ kind: "error", code: "bad-fix-result", message: "Please choose one of the options." });
  }

  /* New diagnosis (§52): archive current, start fresh. */
  function reset() {
    const session = store.loadSession();
    if (session && session.conversation.length) {
      store.upsertHistory({
        id: session.id, date: nowIso(),
        platform: session.platform || "", category: session.category || "",
        summary: session.problemSummary || firstUserText(session).slice(0, 120),
        fix: session.solvedFix, status: session.status === "resolved" ? "solved" : "open",
      });
    }
    store.clearSession();
    trackEvent("ai_session_reset", {});
    return freshSession();
  }

  /* Preflight connectivity check (§32) — short timeout, never blocks. */
  function healthCheck() {
    const cfg = CFG ? CFG.resolveConfig() : {};
    if (!cfg.gatewayUrl) return Promise.resolve({ ok: false, reason: "not-configured" });
    let base;
    try {
      const u = new URL(cfg.gatewayUrl);
      base = u.origin + "/healthz";
    } catch (err) {
      return Promise.resolve({ ok: false, reason: "bad-url" });
    }

    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => { try { ctrl.abort(); } catch (e) {} }, cfg.healthTimeoutMs || 2500) : null;

    return fetch(base, { method: "GET", signal: ctrl ? ctrl.signal : undefined })
      .then((res) => ({ ok: res.ok || res.status === 404, reason: res.ok ? "connected" : "reachable" })) // 404 = server up but no /healthz (e.g. direct LM Studio)
      .catch(() => ({ ok: false, reason: "offline" }))
      .finally(() => { if (timer) clearTimeout(timer); });
  }

  window.EmTechAI = {
    version: "3",
    knowledgeVersion: K.version,
    STATUSES,
    trackEvent,
    safetyScan,
    validateResponse,
    extractJson,
    freshSession,
    validateState,
    store,
    sendUserMessage,
    answerQuestion,
    fixResult,
    reset,
    healthCheck,
  };
})();
