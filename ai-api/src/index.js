/* ============================================================
   EmTech AI API — Cloudflare Worker entry point (Phase 3.1)

   Secure bridge between the public GitHub Pages frontend and the Qwen
   cloud API (§4):

     Browser ──HTTPS──▶ this worker ──(key, server-side)──▶ Qwen API

   Responsibilities:
     * CORS locked to the EmTech Media origin — no `*` in production (§27)
     * per-IP rate limiting + request size caps (§25/§65)
     * strict request validation before anything reaches Qwen (§26)
     * response validation against the bundled EmTech knowledge base:
       fix ids, question ids, platform guard (§14–17, §47)
     * normalized responses — no raw provider errors, keys or endpoints
       ever leave this boundary (§23/§64)

   Routes:
     GET  /api/health → { "status": "ok" }          (no secrets, §42/§64)
     POST /api/ai     → EmTech AI turn. In: OpenAI-compatible body
                        ({model, messages, temperature, max_tokens}).
                        Out: normalized envelope { ok, errors?, text }

   Emergency switch (§38): set AI_ENABLED=false (wrangler.jsonc vars or a
   secret) to shut down model calls without touching the website. Health
   then reports "disabled" and /api/ai answers 503 — the frontend shows its
   graceful offline state and Guided Diagnosis keeps working.

   Note on `ok:false` with HTTP 200: the model answered but its JSON failed
   knowledge-base validation. The frontend uses `errors` for its single
   stricter retry (§46/§58) — so invalid output is data here, not a
   transport failure. Transport/config failures are real 4xx/5xx errors.

   Deploy: see ai-api/README.md (wrangler + secrets).
   ============================================================ */
import { generateQwen } from "./qwen.js";
import { validateModelText, platformFromMessages } from "./validate.js";

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

function json(status, obj, request, env) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: Object.assign(
      { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      corsHeaders(request, env)
    ),
  });
}

/* ---------- rate limiting (§25) ----------
   KV-backed when the RATE_LIMITS binding exists (global across isolates);
   otherwise a per-isolate in-memory counter so `wrangler deploy` works out
   of the box. Both are configurable via env. */
const mem = new Map(); // ip → { count, start }

async function rateLimitOk(env, ip) {
  const max = Math.max(1, Number((env && env.RATE_LIMIT_MAX)) || 30);
  const windowMs = Math.max(5, Number((env && env.RATE_LIMIT_WINDOW_S)) || 60) * 1000;
  const now = Date.now();

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
    } catch (err) { /* KV hiccup → fall through rather than block users */ }
  }

  let e = mem.get(ip);
  if (!e || now - e.start >= windowMs) { e = { count: 0, start: now }; mem.set(ip, e); }
  if (mem.size > 10000) mem.clear(); // crude bound; entries expire by timestamp anyway
  e.count += 1;
  return { ok: e.count <= max };
}

/* ---------- request validation (§26) — never pass garbage to Qwen ---------- */
const ROLES = ["system", "user", "assistant"];

function validateChatBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return ["request must be a JSON object"];
  const errors = [];
  if (!Array.isArray(body.messages) || !body.messages.length) {
    errors.push("messages must be a non-empty array");
  } else {
    if (body.messages.length > 64) errors.push("too many messages (max 64)");
    for (const m of body.messages.slice(0, 64)) {
      if (!m || typeof m !== "object" || ROLES.indexOf(m.role) === -1 || typeof m.content !== "string") {
        errors.push("each message needs a valid role and string content");
        break;
      }
      if (m.content.length > 20000) { errors.push("message content too long (max 20000 chars)"); break; }
    }
  }
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

    /* CORS preflight. */
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    /* ---------- health (§42/§64): minimal, no secrets ---------- */
    if (request.method === "GET" && url.pathname === "/api/health") {
      if (!aiEnabled(env)) return json(503, { status: "disabled" }, request, env);
      return json(200, { status: "ok" }, request, env);
    }

    if (request.method !== "POST" || url.pathname !== "/api/ai") {
      return json(404, { error: "not found" }, request, env);
    }

    /* ---------- emergency switch (§38): AI off → graceful 503, site stays up ---------- */
    if (!aiEnabled(env)) {
      console.log("[emtech-ai-api] 503 AI disabled by configuration");
      return json(503, { error: "EmTech AI is temporarily unavailable" }, request, env);
    }

    /* ---------- CORS (§27) ---------- */
    if (!originAllowed(request, env)) {
      console.log("[emtech-ai-api] 403 origin not allowed");
      return json(403, { error: "origin not allowed" }, request, env);
    }

    /* ---------- rate limit (§25) ---------- */
    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    if (!(await rateLimitOk(env, ip)).ok) {
      console.log("[emtech-ai-api] 429 rate limit exceeded");
      return new Response(
        JSON.stringify({ error: "too many requests — please wait a minute and try again" }),
        {
          status: 429,
          headers: Object.assign(
            { "Content-Type": "application/json; charset=utf-8", "Retry-After": String(Math.max(1, Number((env && env.RATE_LIMIT_WINDOW_S)) || 60)) },
            corsHeaders(request, env)
          ),
        }
      );
    }

    /* ---------- body size cap (§25/§65) ---------- */
    const maxBytes = Math.max(4096, Number((env && env.MAX_BODY_BYTES)) || 131072);
    let text;
    try { text = await request.text(); } catch (err) { return json(400, { error: "could not read request body" }, request, env); }
    if (text.length > maxBytes) {
      console.log("[emtech-ai-api] 413 body too large");
      return json(413, { error: "request too large" }, request, env);
    }

    let body;
    try { body = JSON.parse(text || "{}"); } catch (err) { return json(400, { error: "invalid JSON body" }, request, env); }

    const shapeErrors = validateChatBody(body);
    if (shapeErrors.length) {
      console.log("[emtech-ai-api] 400 invalid request shape");
      return json(400, { error: "invalid request", details: shapeErrors.slice(0, 5) }, request, env);
    }

    /* ---------- call Qwen (the key stays on this side of the boundary) ---------- */
    let out;
    try {
      out = await generateQwen({ messages: body.messages, temperature: body.temperature, maxTokens: body.max_tokens }, env);
    } catch (err) {
      const status = err && Number.isInteger(err.status) ? err.status : 502;
      console.log(`[emtech-ai-api] upstream failure → ${status} (${Date.now() - startedAt} ms)`);
      return json(status, { error: "EmTech AI is temporarily unavailable" }, request, env);
    }

    /* ---------- validate against the real knowledge base (§14–17) ---------- */
    const platform = platformFromMessages(body.messages);
    const v = validateModelText(out.text, { platform });
    console.log(`[emtech-ai-api] POST /api/ai → 200 validated=${v.ok} (${Date.now() - startedAt} ms)`);

    const payload = { ok: v.ok, text: out.text };
    if (!v.ok) payload.errors = v.errors.slice(0, 8);
    if (env && env.DEBUG_AI === "true") { // dev-only observability (§54), off by default
      payload.debug = { platform, latencyMs: Date.now() - startedAt, usage: out.usage || null };
    }
    return json(200, payload, request, env);
  },
};
