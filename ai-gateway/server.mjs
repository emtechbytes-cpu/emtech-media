#!/usr/bin/env node
/* ============================================================
   EmTech Media — Local AI Gateway (Phase 3)

   A tiny, dependency-free bridge between the website and your local
   Qwen model. The browser only ever talks to THIS service (§4): no
   model endpoints, credentials or private infrastructure are exposed
   in the frontend. If you need an API key for the upstream server it
   lives here (env var), never in the site's JavaScript.

   Run:
     node ai-gateway/server.mjs

   Environment variables (all optional):
     PORT            default 8787
     QWEN_BASE_URL   OpenAI-compatible base, default http://localhost:1234/v1
                     (LM Studio) — or e.g. http://localhost:11434/v1 (Ollama)
     QWEN_MODEL      model id to use when the client doesn't send one,
                     default "ollama/qwen3.8-27b"
     API_KEY         sent as Authorization: Bearer <key> upstream, if set
     ALLOWED_ORIGINS comma-separated origins (default "*" — this is a
                     local tool; tighten it if you expose the port)
     UPSTREAM_TIMEOUT_MS  default 90000

   Endpoints:
     GET  /healthz               → { ok, upstream, model }
     POST /v1/chat/completions   → OpenAI-compatible passthrough to Qwen

   Requires Node 18+ (global fetch). No npm install needed.
   ============================================================ */
import http from "node:http";

const PORT = Number(process.env.PORT || 8787);
const BASE_URL = String(process.env.QWEN_BASE_URL || "http://localhost:1234/v1").replace(/\/+$/, "");
const MODEL = process.env.QWEN_MODEL || "ollama/qwen3.8-27b";
const API_KEY = process.env.API_KEY || "";
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || "*");
const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS || 90000);

function allowedOrigin(req) {
  if (ALLOWED_ORIGINS === "*") return "*";
  const origin = req.headers.origin || "";
  const list = ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
  return list.includes(origin) ? origin : null;
}

function corsHeaders(req) {
  const origin = allowedOrigin(req);
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function json(res, status, obj, extraHeaders) {
  const body = JSON.stringify(obj);
  // Single writeHead per response — calling it twice throws
  // ERR_HTTP_HEADERS_SENT and leaves the client with a broken reply.
  res.writeHead(status, Object.assign({ "Content-Type": "application/json; charset=utf-8" }, extraHeaders || {}));
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  const startedAt = Date.now();

  // CORS preflight.
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders(req));
    return res.end();
  }

  try {
    /* ---------- health ---------- */
    if (req.method === "GET" && url.pathname === "/healthz") {
      // CORS headers are required here: the site's availability chip
      // fetches this cross-origin (GitHub Pages → localhost gateway).
      json(res, 200, { ok: true, upstream: BASE_URL, model: MODEL }, corsHeaders(req));
      return;
    }

    /* ---------- chat completions passthrough ---------- */
    if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
      catch (err) { return json(res, 400, { error: "invalid JSON body" }, corsHeaders(req)); }

      const payload = Object.assign({}, body);
      if (!payload.model) payload.model = MODEL; // default model stays server-side (§38)

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(new Error("upstream timeout")), UPSTREAM_TIMEOUT_MS);
      req.on("close", () => { try { ctrl.abort(new Error("client disconnected")); } catch (err) {} });

      let upstream;
      try {
        upstream = await fetch(BASE_URL + "/chat/completions", {
          method: "POST",
          headers: Object.assign(
            { "Content-Type": "application/json" },
            API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}
          ),
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        const msg = /timeout/i.test(err.message || "") ? "upstream timed out" : "cannot reach the local model server";
        return json(res, 502, { error: msg }, corsHeaders(req));
      }
      clearTimeout(timer);

      const text = await upstream.text();
      const headers = Object.assign(corsHeaders(req), { "Content-Type": upstream.headers.get("content-type") || "application/json" });
      res.writeHead(upstream.status, headers);
      res.end(text);
      console.log(`[ai-gateway] POST /v1/chat/completions → ${upstream.status} (${Date.now() - startedAt} ms) model=${payload.model}`);
      return;
    }

    json(res, 404, { error: "not found" }, corsHeaders(req));
  } catch (err) {
    try { json(res, 500, { error: "gateway internal error" }, corsHeaders(req)); } catch (e) {}
    console.error("[ai-gateway] unhandled:", err.message);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[ai-gateway] EmTech AI gateway on http://localhost:${PORT}`);
  console.log(`[ai-gateway] upstream: ${BASE_URL} (model default: ${MODEL})`);
});
