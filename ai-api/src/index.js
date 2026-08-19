/* ============================================================
   EmTech AI API — Cloudflare Worker entry point (Phase 3.1 + 3.1.1)

   Secure bridge between the public GitHub Pages frontend and the Qwen
   cloud API (§4):

     Browser ──HTTPS──▶ this worker ──(key, server-side)──▶ Qwen API

   Responsibilities:
     * CORS locked to the EmTech Media origin — no `*` in production (§27)
     * per-IP rate limiting + daily usage ceiling + request size caps
       (KV-backed when the RATE_LIMITS binding exists; configurable via env)
     * strict request validation before anything reaches Qwen (§26)
     * SERVER-OWNED EmTech AI contract: client-supplied system messages are
       parsed for session facts and then discarded — the browser can no
       longer define how EmTech AI behaves, pick a model, or turn this into
       a generic Qwen proxy (Phase 3.1.1 §5–§12)
     * lightweight pre-AI router: obvious platform+category turns are
       answered from the approved question bank without calling Qwen (§22)
     * response validation against the bundled EmTech knowledge base:
       fix ids, question ids, platform guard + outgoing safety scan
     * normalized responses — no raw provider errors, keys or endpoints
       ever leave this boundary (§23/§64); every response carries an
       X-Request-ID for support correlation (Phase 3.1.1 §32)

   Routes:
     GET  /api/health → { "status": "ok" }          (no secrets, §42/§64)
     POST /api/ai     → EmTech AI turn. In: OpenAI-compatible body
                        ({model, messages, temperature, max_tokens} — model
                        is IGNORED; the server's QWEN_MODEL is authoritative).
                        Out: normalized envelope { ok, errors?, text }

   Emergency switch (§38): set AI_ENABLED=false (wrangler.jsonc vars or a
   secret) to shut down model calls without touching the website. Health
   then reports "disabled" and /api/ai answers 503 — the frontend shows its
   graceful offline state and Guided Diagnosis keeps working.

   Note on `ok:false` with HTTP 200: the model answered but its JSON failed
   knowledge-base validation (or the outgoing safety scan). The frontend uses
   `errors` for its single stricter retry (§46/§58) — so invalid output is
   data here, not a transport failure. Transport/config failures are real
   4xx/5xx errors.

   Deploy: see ai-api/README.md (wrangler + secrets).
   ============================================================ */
import { generateQwen } from "./qwen.js";
import { validateModelText, validateModelJson, platformFromMessages } from "./validate.js";
import { sanitizeMessages, boundHistory, buildServerPrompt, deterministicRoute, outgoingScanOk } from "./policy.js";

const DEFAULT_ALLOWED_ORIGINS = "https://emtechbytes-cpu.github.io";

function allowedOrigins(env) {
  return String((env && env.ALLOWED_ORIGINS) || DEFAULT_ALLOWED_ORIGINS).split(",").map((s) => s.trim()).filter(Boolean);
}

function originAllowed(request, env) {
  const o = request.headers.get("origin");
  if (!o) return true; // non-browser clients (curl/tests) — still rate-limited + validated
  return allowedOrigins(env).includes(o);
}

function corsHeaders(request, env) {
  const o = request.headers.get("origin");
  if (!o || !allowedOrigins(env).includes(o)) return {};
  return {
    "Access-Control-Allow-Origin": o,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

/* Emergency switch (§38): default ON; only an explicit "false" disables. */
function aiEnabled(env) {
  return String((env && env.AI_ENABLED) || "true").trim().toLowerCase() !== "false";
}

/* Request id for support correlation (Phase 3.1.1 §32). Never sensitive —
   echoed back in the X-Request-ID header and included in error payloads so
   a user can quote it to us; logs reference it too. */
function newRequestId() {
  return "req_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function json(status, obj, request, env, requestId) {
  const headers = Object.assign(
    { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    corsHeaders(request, env)
  );
  if (requestId) headers["X-Request-ID"] = requestId;
  return new Response(JSON.stringify(obj), { status, headers });
}

/* ---------- rate limiting (§25/§16) ----------
   KV-backed when the RATE_LIMITS binding exists (global across isolates —
   the authoritative production limiter); otherwise a per-isolate in-memory
   counter so `wrangler deploy` works out of the box. Configurable via env:
   AI_RATE_LIMIT / AI_RATE_WINDOW_S (aliases: RATE_LIMIT_MAX / _WINDOW_S). */
const mem = new Map(); // ip → { count, start }
let warnedNoKV = false;

function rateLimitConfig(env) {
  const max = Math.max(1, Number((env && (env.AI_RATE_LIMIT || env.RATE_LIMIT_MAX))) || 30);
  const windowS = Math.max(5, Number((env && (env.AI_RATE_WINDOW_S || env.RATE_LIMIT_WINDOW_S))) || 60);
  return { max, windowMs: windowS * 1000 };
}

async function rateLimitOk(env, ip) {
  const { max, windowMs } = rateLimitConfig(env);
  const now = Date.now();

  if (!env || !env.RATE_LIMITS) {
    if (!warnedNoKV) { warnedNoKV = true; console.log("[emtech-ai-api] RATE_LIMITS KV binding not present — using in-memory limiter"); }
  }

  if (env && env.RATE_LIMITS) {
    try {
      const key = "rl:" + ip;
      let entry = null;
      const raw = await env.RATE_LIMITS.get(key, "json");
      if (raw && typeof raw.count === "number" && now - raw.start < windowMs) entry = raw;
      else entry = { count: 0, start: now };
      entry.count += 1;
      await env.RATE_LIMITS.put(key, JSON.stringify(entry), { expirationTtl: Math.ceil(windowMs / 1000) + 5 });
      return { ok: entry.count <= max };
    } catch (err) {
      // KV hiccup → fall through rather than block users. Log the reason
      // (never secret material — this path only touches ip/count).
      console.log(`[emtech-ai-api] rate-limit KV error, using in-memory fallback: ${(err && err.message) || "unknown"}`);
    }
  }

  let e = mem.get(ip);
  if (!e || now - e.start >= windowMs) { e = { count: 0, start: now }; mem.set(ip, e); }
  if (mem.size > 10000) mem.clear(); // crude bound; entries expire by timestamp anyway
  e.count += 1;
  return { ok: e.count <= max };
}

/* ---------- daily usage ceiling (§17 — cost protection) ----------
   Second layer on top of the per-minute window: a configurable anonymous
   budget per IP per UTC day (AI_DAILY_LIMIT, default 100). KV-backed when
   available so it is shared across isolates; in-memory fallback for dev. */
const dailyMem = new Map(); // ip → { date, count }

function dailyLimitMax(env) {
  return Math.max(1, Number((env && env.AI_DAILY_LIMIT)) || 100);
}

async function dailyLimitOk(env, ip) {
  const max = dailyLimitMax(env);
  const day = new Date().toISOString().slice(0, 10); // UTC calendar day

  if (!env || !env.RATE_LIMITS) {
    if (!warnedNoKV) { warnedNoKV = true; console.log("[emtech-ai-api] RATE_LIMITS KV binding not present — using in-memory limiter"); }
  }

  if (env && env.RATE_LIMITS) {
    try {
      const key = "dly:" + ip + ":" + day;
      let count = 0;
      const raw = await env.RATE_LIMITS.get(key, "json");
      if (raw && typeof raw.count === "number") count = raw.count;
      count += 1;
      await env.RATE_LIMITS.put(key, JSON.stringify({ count }), { expirationTtl: 90061 }); // just over a day — self-cleaning
      return { ok: count <= max };
    } catch (err) {
      console.log(`[emtech-ai-api] daily-limit KV error, using in-memory fallback: ${(err && err.message) || "unknown"}`);
    }
  }

  let e = dailyMem.get(ip);
  if (!e || e.date !== day) { e = { date: day, count: 0 }; dailyMem.set(ip, e); }
  if (dailyMem.size > 10000) dailyMem.clear();
  e.count += 1;
  return { ok: e.count <= max };
}

/* ---------- request validation (§26) — never pass garbage to Qwen ---------- */
const ROLES = ["system", "user", "assistant"];
const USER_MSG_MAX = 20000; // user/assistant content cap (chars)

function validateChatBody(body, env) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return ["request must be a JSON object"];
  const errors = [];
  if (!Array.isArray(body.messages) || !body.messages.length) {
    errors.push("messages must be a non-empty array");
  } else {
    if (body.messages.length > 64) errors.push("too many messages (max 64)");
    // The client's system message carries the knowledge context and can be
    // large; user/assistant turns stay tightly capped.
    const sysMax = Math.max(USER_MSG_MAX, Number((env && env.MAX_SYSTEM_CHARS)) || 64000);
    for (const m of body.messages.slice(0, 64)) {
      if (!m || typeof m !== "object" || ROLES.indexOf(m.role) === -1 || typeof m.content !== "string") {
        errors.push("each message needs a valid role and string content");
        break;
      }
      const cap = m.role === "system" ? sysMax : USER_MSG_MAX;
      if (m.content.length > cap) { errors.push(`message content too long (max ${cap} chars)`); break; }
    }
  }
  // `model` is accepted for contract compatibility but IGNORED — the server's
  // QWEN_MODEL is authoritative (Phase 3.1.1 §11). temperature/max_tokens are
  // clamped to safe ranges in qwen.js (§65 cost ceiling).
  if (body.model !== undefined && (typeof body.model !== "string" || body.model.length > 120)) errors.push("model must be a short string");
  if (body.temperature !== undefined && (typeof body.temperature !== "number" || !Number.isFinite(body.temperature) || body.temperature < 0 || body.temperature > 2)) {
    errors.push("temperature must be a number between 0 and 2");
  }
  if (body.max_tokens !== undefined && (!Number.isInteger(body.max_tokens) || body.max_tokens < 1 || body.max_tokens > 4096)) {
    errors.push("max_tokens must be an integer between 1 and 4096");
  }
  return errors;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const startedAt = Date.now();
    const rid = newRequestId();

    /* CORS preflight. */
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    /* ---------- health (§42/§64): minimal, no secrets ---------- */
    if (request.method === "GET" && url.pathname === "/api/health") {
      if (!aiEnabled(env)) return json(503, { status: "disabled", requestId: rid }, request, env, rid);
      return json(200, { status: "ok", requestId: rid }, request, env, rid);
    }

    if (request.method !== "POST" || url.pathname !== "/api/ai") {
      return json(404, { error: "not found", requestId: rid }, request, env, rid);
    }

    /* ---------- emergency switch (§38): AI off → graceful 503, site stays up ---------- */
    if (!aiEnabled(env)) {
      console.log(`[emtech-ai-api] ${rid} 503 AI disabled by configuration`);
      return json(503, { error: "EmTech AI is temporarily unavailable", requestId: rid }, request, env, rid);
    }

    /* ---------- CORS (§27) ---------- */
    if (!originAllowed(request, env)) {
      console.log(`[emtech-ai-api] ${rid} 403 origin not allowed`);
      return json(403, { error: "origin not allowed", requestId: rid }, request, env, rid);
    }

    /* ---------- rate limits (§25/§16/§17) — per-minute window + daily ceiling ---------- */
    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    if (!(await rateLimitOk(env, ip)).ok) {
      console.log(`[emtech-ai-api] ${rid} 429 rate limit exceeded`);
      return json(429, { error: "too many requests — please wait a minute and try again", requestId: rid }, request, env, rid);
    }
    if (!(await dailyLimitOk(env, ip)).ok) {
      console.log(`[emtech-ai-api] ${rid} 429 daily limit reached`);
      return json(429, { error: "today's EmTech AI limit has been reached — please try again tomorrow", requestId: rid }, request, env, rid);
    }

    /* ---------- body size cap (§25/§65) ---------- */
    const maxBytes = Math.max(4096, Number((env && env.MAX_BODY_BYTES)) || 131072);
    let text;
    try { text = await request.text(); } catch (err) { return json(400, { error: "could not read request body", requestId: rid }, request, env, rid); }
    if (text.length > maxBytes) {
      console.log(`[emtech-ai-api] ${rid} 413 body too large`);
      return json(413, { error: "request too large", requestId: rid }, request, env, rid);
    }

    let body;
    try { body = JSON.parse(text || "{}"); } catch (err) { return json(400, { error: "invalid JSON body", requestId: rid }, request, env, rid); }

    const shapeErrors = validateChatBody(body, env);
    if (shapeErrors.length) {
      console.log(`[emtech-ai-api] ${rid} 400 invalid request shape`);
      return json(400, { error: "invalid request", details: shapeErrors.slice(0, 5), requestId: rid }, request, env, rid);
    }

    /* ---------- server-owned policy (Phase 3.1.1 §5–§9) ----------
       Client system messages → parsed for session facts, then discarded.
       Only user/assistant history survives; the server builds its own
       authoritative EmTech prompt around that untrusted context. */
    const { context, history } = sanitizeMessages(body.messages);
    if (!history.some((m) => m.role === "user")) {
      console.log(`[emtech-ai-api] ${rid} 400 no user message`);
      return json(400, { error: "no user message found", requestId: rid }, request, env, rid);
    }
    const bounded = boundHistory(history, env); // §20 — conversation stays bounded

    /* ---------- pre-AI router (§22/§23): obvious turns never burn a Qwen call.
       The same knowledge-base validator gates it as model output; if it fails
       we simply fall through to the normal Qwen path. */
    let lastUser = "";
    for (let i = bounded.length - 1; i >= 0; i--) { if (bounded[i].role === "user") { lastUser = bounded[i].content; break; } }

    let routed = null;
    try { routed = deterministicRoute({ context, lastUserText: lastUser }); } catch (err) {}
    if (routed) {
      const rv = validateModelJson(routed, { platform: context.platform || null });
      if (rv.ok) {
        console.log(`[emtech-ai-api] ${rid} POST /api/ai → 200 router (${Date.now() - startedAt} ms)`);
        return json(200, { ok: true, text: JSON.stringify(routed), requestId: rid }, request, env, rid);
      }
    }

    /* ---------- call Qwen (the key stays on this side of the boundary) ---------- */
    const messages = [{ role: "system", content: buildServerPrompt(context) }].concat(bounded);
    let out;
    try {
      out = await generateQwen({ messages, temperature: body.temperature, maxTokens: body.max_tokens }, env);
    } catch (err) {
      const status = err && Number.isInteger(err.status) ? err.status : 502;
      console.log(`[emtech-ai-api] ${rid} upstream failure → ${status} (${Date.now() - startedAt} ms)`);
      return json(status, { error: "EmTech AI is temporarily unavailable", requestId: rid }, request, env, rid);
    }

    /* ---------- validate against the real knowledge base (§14–17) + safety scan ---------- */
    const platform = context.platform || platformFromMessages(body.messages);
    let v = validateModelText(out.text, { platform });
    if (v.ok && !outgoingScanOk(out.text)) v = { ok: false, errors: ["response failed the outgoing safety scan"] };

    console.log(`[emtech-ai-api] ${rid} POST /api/ai → 200 validated=${v.ok} (${Date.now() - startedAt} ms)`);

    const payload = { ok: v.ok, text: out.text, requestId: rid };
    if (!v.ok) payload.errors = v.errors.slice(0, 8);
    if (env && env.DEBUG_AI === "true") { // dev-only observability (§54), off by default
      payload.debug = { platform, latencyMs: Date.now() - startedAt, usage: out.usage || null };
    }
    return json(200, payload, request, env, rid);
  },
};
