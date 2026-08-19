# EmTech AI API (Phase 3.1 + 3.1.1)

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
- **Rate limiting** per IP (`AI_RATE_LIMIT` / `AI_RATE_WINDOW_S`, aliases
  `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_S`) + a **daily usage ceiling**
  (`AI_DAILY_LIMIT`) as the second cost-protection layer (§16/§17)
- **Body caps**: max request bytes, message count, content length (§25/§65)
- **Request validation** before anything reaches Qwen (§26)
- **Server-owned AI contract (Phase 3.1.1)**: the worker builds its own
  system prompt. Client-supplied `system` messages are parsed for session
  facts (platform, category, asked questions, attempted fixes) and then
  discarded — a visitor cannot redefine EmTech AI's behavior, ship their own
  instructions, or turn this into a generic Qwen proxy (§5–§12). The client's
  `model` field is ignored; `temperature`/`max_tokens` are clamped to safe
  ranges. Only user/assistant turns survive as conversation history.
- **Conversation bounding**: history is trimmed to the most recent messages
  within a message-count + character budget (`MAX_CONTEXT_MESSAGES`,
  `MAX_CONTEXT_CHARS`) — long sessions can't balloon token cost (§20)
- **Pre-AI router (cost control)**: when platform + category are obvious,
  the turn is answered with an approved EmTech question from `diag-data.js`
  without calling Qwen at all. Ambiguous input, topic pivots and unknown
  platforms always go to the model (§22/§23)
- **Response validation against the real knowledge base**: fix ids must exist
  in `tips-data.js`, question ids must be approved by `diag-data.js`, and a
  Windows session can't receive a Mac fix (or vice versa) (§14–17, §47). The
  worker bundles the site's own data files — one knowledge base, two runtimes.
- **Outgoing safety scan**: model output containing credential-shaped text
  (`sk-…`, `Bearer …`) is rejected before it reaches the browser
- **Request ids**: every response carries an `X-Request-ID` header (echoed in
  error payloads) so support issues can be correlated with worker logs (§32)

## Files

```
ai-api/
├── wrangler.jsonc        Worker config (vars + KV rate-limit binding)
├── .dev.vars.example     Local-dev env template → copy to .dev.vars (git-ignored)
├── src/
│   ├── index.js          Routes, CORS, rate/daily limits, request validation
│   ├── policy.js         Server-owned contract, context extraction, bounding,
│   │                     pre-AI router, outgoing safety scan (Phase 3.1.1)
│   ├── qwen.js           Qwen cloud provider (key + model live here only)
│   ├── knowledge.js      Bundled tips-data.js / diag-data.js access
│   └── validate.js       Model-response validation against the KB
└── test/
    ├── security.test.mjs Phase 3.1.1 hardening suite (23 tests, no network)
    └── validate.test.mjs Knowledge + validation unit tests (no network)
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

### Rate limiting (KV-backed, already configured)

`wrangler.jsonc` binds a Cloudflare KV namespace (`RATE_LIMITS`) that holds the
authoritative per-IP counters — shared across all isolates in production. The
daily ceiling uses the same store with `dly:<ip>:<utc-day>` keys (self-cleaning
TTL). If the binding is missing or KV hiccups, the worker automatically falls
back to a per-isolate in-memory limiter so local dev and deploys keep working.

Consistency note: Cloudflare KV is eventually consistent, so under extreme
burst traffic (many requests from one IP within milliseconds) the per-minute
counter can briefly under-count — inherent to KV read-modify-write and
consistent with Cloudflare's own guidance that this is acceptable for abuse
prevention. The daily ceiling (`dly:*`) provides a second, longer-lived cost
layer, and the in-memory fallback keeps development working.

To set up your own namespace:

```bash
npx wrangler kv namespace create RATE_LIMITS   # copy the id it prints
# then fill in "kv_namespaces" in wrangler.jsonc and redeploy
```

## Configuration reference

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI_ENABLED` | `true` | Emergency switch: set to `false` to shut down model calls without touching the website (§38). |
| `QWEN_API_KEY` | — (required) | DashScope API key. **Secret.** Never logged, never returned (§5/§7). |
| `QWEN_MODEL` | `qwen-plus` | Production model id. Change without touching the frontend (§38). |
| `QWEN_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | OpenAI-compatible endpoint (rarely changes). |
| `ALLOWED_ORIGINS` | `https://emtechbytes-cpu.github.io` | Comma-separated CORS origins (§27). |
| `AI_RATE_LIMIT` | `30` | Requests per window per IP (alias: `RATE_LIMIT_MAX`). |
| `AI_RATE_WINDOW_S` | `60` | Window length, seconds (alias: `RATE_LIMIT_WINDOW_S`). |
| `AI_DAILY_LIMIT` | `100` | Anonymous daily usage ceiling per IP — second cost-protection layer (§17). |
| `MAX_BODY_BYTES` | `131072` | Max request body (system prompt + context can be ~40–60 KB). |
| `MAX_CONTEXT_MESSAGES` | `32` | Conversation history trimmed to the most recent N messages (§20). |
| `MAX_CONTEXT_CHARS` | `48000` | Total character budget for conversation history sent upstream (§20). |
| `MAX_SYSTEM_CHARS` | `64000` | Cap on a client system message (carries KB context); user/assistant turns stay capped at 20000. |
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
# Phase 3.1.1 security hardening suite (23 tests — runs the real worker entry
# point in Node with a stubbed upstream; asserts server-owned prompt, model/
# provider protection, rate + daily limits, bounding, router, validation,
# outgoing scan, CORS, request ids):
node --test ai-api/test/security.test.mjs

# Knowledge + response-validation unit tests (no network):
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
