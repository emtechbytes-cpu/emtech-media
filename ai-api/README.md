# EmTech AI API (Phase 3.1)

Secure backend for **EmTech AI** — the bridge between the public GitHub Pages
frontend and the Qwen cloud API. The browser never sees an API key, a model
endpoint or any private infrastructure (§5).

```
Browser ──HTTPS──▶ this worker ──(QWEN_API_KEY, server-side)──▶ Qwen (DashScope)
```

## What it does

| Route | Purpose |
| --- | --- |
| `GET /api/health` | `{ "status": "ok" }` — no secrets, safe to poll (§42/§64) |
| `POST /api/ai` | One EmTech AI turn. In: OpenAI-compatible body (`{model, messages, temperature, max_tokens}`). Out: normalized envelope (below). |

**Response contract** (`POST /api/ai`, HTTP 200):

```json
{ "ok": true,  "text": "<raw model text>" }
{ "ok": false, "errors": ["recommended_fix.fix_id \"x\" does not exist …"], "text": "<raw model text>" }
```

`ok:false` with HTTP 200 means *the model answered but its JSON failed
knowledge-base validation*. The frontend uses `errors` for its single stricter
retry (§46/§58). Transport/config failures are real `4xx`/`5xx` errors with a
generic message — never raw provider details, keys or endpoints (§23).

Server-side guarantees:

- **CORS** locked to the origins in `ALLOWED_ORIGINS` (default: the GitHub
  Pages origin only — no `*` in production, §27)
- **Rate limiting** per IP (`RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_S`)
- **Body caps**: max request bytes, message count, content length (§25/§65)
- **Request validation** before anything reaches Qwen (§26)
- **Response validation against the real knowledge base**: fix ids must exist
  in `tips-data.js`, question ids must be approved by `diag-data.js`, and a
  Windows session can't receive a Mac fix (or vice versa) (§14–17, §47). The
  worker bundles the site's own data files — one knowledge base, two runtimes.

## Files

```
ai-api/
├── wrangler.jsonc        Worker config (name, entry point)
├── .dev.vars.example     Local-dev env template → copy to .dev.vars (git-ignored)
├── src/
│   ├── index.js          Routes, CORS, rate limit, request validation
│   ├── qwen.js           Qwen cloud provider (key + model live here only)
│   ├── knowledge.js      Bundled tips-data.js / diag-data.js access
│   └── validate.js       Model-response validation against the KB
└── test/validate.test.mjs  Node unit tests (no network, no deps)
```

## Local development (with your RTX 5090 + LM Studio)

The site's **Local mode** does not use this worker at all — it talks to the
bundled dev gateway in front of your local Qwen:

```bash
# terminal 1 — model server (LM Studio serving ollama/qwen3.8-27b on :1234)
# terminal 2 — EmTech gateway
node ai-gateway/server.mjs          # http://localhost:8787
# terminal 3 — static site
npx serve .                         # or any static server, e.g. :8123
```

Then on the AI page open ⚙ → **Mode: Local (dev gateway)** and save. This is
the exact Phase 3 setup; nothing about it changed in 3.1 (§8/§57).

To develop *this worker* locally against a real DashScope key:

```bash
cd ai-api
cp .dev.vars.example .dev.vars      # fill in QWEN_API_KEY etc. (git-ignored)
npx wrangler dev --port 8900        # avoid :8787 — that's the local AI gateway
```

## Deploying to production

Requires a free Cloudflare account. One-time setup:

```bash
cd ai-api
npx wrangler login
npx wrangler deploy                 # bundles src/ + the site's data files
# → prints your worker URL, e.g. https://emtech-ai-api.<account>.workers.dev
```

Then set the secret (stored encrypted on Cloudflare — never in this repo):

```bash
npx wrangler secret put QWEN_API_KEY   # paste when prompted
npx wrangler secret put QWEN_MODEL     # optional, default qwen-plus
```

`ALLOWED_ORIGINS` is a regular **var** (not a secret) and lives in the `vars`
block of `wrangler.jsonc`. After any deploy that changes config vars, verify
they actually took effect with a CORS probe:

```bash
curl -sS -D - -o /dev/null "https://<your-worker>/api/health" -H "Origin: http://localhost:8123" | grep -i access-control
```

If the `Access-Control-Allow-Origin` header is missing, redeploy with an
explicit flag:

```bash
npx wrangler deploy --var "ALLOWED_ORIGINS=https://emtechbytes-cpu.github.io,http://localhost:8123,http://127.0.0.1:8123"
```

If your worker URL differs from `CLOUD_ENDPOINT_DEFAULT` in `ai-config.js`,
either update that one line **or** — without touching code — save it once via
the AI page's ⚙ settings panel (Cloud endpoint field).

### Rate limiting (optional, recommended for public use)

Without extra setup the worker uses a per-isolate in-memory limiter. For a
global counter across all isolates:

```bash
npx wrangler kv namespace create RATE_LIMITS   # copy the id it prints
# then uncomment + fill in "kv_namespaces" in wrangler.jsonc and redeploy
```

## Configuration reference

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI_ENABLED` | `true` | Emergency switch: set to `false` to shut down model calls without touching the website (§38). |
| `QWEN_API_KEY` | — (required) | DashScope API key. **Secret.** Never logged, never returned (§5/§7). |
| `QWEN_MODEL` | `qwen-plus` | Production model id. Change without touching the frontend (§38). |
| `QWEN_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | OpenAI-compatible endpoint (rarely changes). |
| `ALLOWED_ORIGINS` | `https://emtechbytes-cpu.github.io` | Comma-separated CORS origins (§27). |
| `RATE_LIMIT_MAX` | `30` | Requests per window per IP. |
| `RATE_LIMIT_WINDOW_S` | `60` | Window length, seconds. |
| `MAX_BODY_BYTES` | `131072` | Max request body (system prompt + context can be ~40–60 KB). |
| `UPSTREAM_TIMEOUT_MS` | `60000` | Hard ceiling per model call. |
| `DEBUG_AI` | `false` | Dev-only: adds latency/usage/validation details to responses (§54). Keep off in production. |

### Emergency switch (shut down AI without taking the site down)

Set `AI_ENABLED=false` and redeploy:

```bash
# Option A — edit wrangler.jsonc vars, then:
npx wrangler deploy

# Option B — override with a secret (wins over vars):
npx wrangler secret put AI_ENABLED   # type: false
```

While disabled:
- `GET /api/health` → HTTP 503 `{ "status": "disabled" }`
- `POST /api/ai`    → HTTP 503 `{ "error": "EmTech AI is temporarily unavailable" }`
- The frontend shows its graceful offline state ("AI offline — guided
diagnosis works") and Guided Diagnosis keeps working normally.

Re-enable by setting it back to `true` and redeploying. No code change,
no frontend impact, no key rotation needed.

## Testing

```bash
# Server-side unit tests (knowledge + validation, no network):
node --test ai-api/test/validate.test.mjs

# Full site regression incl. live local Qwen E2E (gateway must be running):
node <scratchpad>/emtech-ai-tests.mjs            # see Phase 3 harness notes

# Manual API smoke test:
curl -s https://<worker>/api/health              # → {"status":"ok"}
```

## Rotating the Qwen key

1. Create a new key in your DashScope console.
2. `npx wrangler secret put QWEN_API_KEY` (new value).
3. Verify with `/api/health` + one real AI turn from the site.
4. Revoke the old key in the DashScope console.

If an old key was ever committed to this public repo, **revoke it immediately** —
deleting it from files is not enough once history is public (§29).

## Changing the production model

`npx wrangler secret put QWEN_MODEL` with a new id (e.g. `qwen-max`, or a
Qwen3 id your account can access) and redeploy nothing — secrets apply on next
request. The frontend never needs to change (§38/§66).
