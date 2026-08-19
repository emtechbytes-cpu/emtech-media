# EmTech AI Gateway

A tiny, dependency-free bridge between the EmTech Media website and your local Qwen model. The browser only ever talks to this service — no model endpoints or credentials are exposed in the site's JavaScript (Phase 3 spec §4).

## Run it

```bash
node ai-gateway/server.mjs
```

Requires Node 18+ (global `fetch`). No `npm install` needed.

By default it listens on **http://localhost:8787** and proxies to LM Studio at **http://localhost:1234/v1**. Ollama works too — set `QWEN_BASE_URL=http://localhost:11434/v1`.

## Configuration (environment variables)

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8787` | Gateway port |
| `QWEN_BASE_URL` | `http://localhost:1234/v1` | OpenAI-compatible base URL of your model server (LM Studio, Ollama, vLLM…) |
| `QWEN_MODEL` | `ollama/qwen3.8-27b` | Model id used when the client doesn't send one — keep it here, not in the site |
| `API_KEY` | *(empty)* | Sent as `Authorization: Bearer <key>` upstream if your server needs one |
| `ALLOWED_ORIGINS` | `*` | Comma-separated CORS origins. Tighten this if you expose the port beyond localhost |
| `UPSTREAM_TIMEOUT_MS` | `90000` | Hard ceiling for a single model call |

Example:

```bash
QWEN_BASE_URL=http://localhost:11434/v1 QWEN_MODEL=qwen3.8:27b node ai-gateway/server.mjs
```

## Endpoints

- `GET /healthz` → `{ "ok": true, "upstream": "...", "model": "..." }` — used by the site's status chip.
- `POST /v1/chat/completions` → OpenAI-compatible passthrough to Qwen (the site sends structured JSON-contract prompts and validates every response).

## Using it from another machine on your LAN

Run the gateway on the machine with the GPU, then in the website's AI settings panel (gear icon on the EmTech AI page) set the gateway URL to `http://<that-machine-ip>:8787/v1/chat/completions`. Set `ALLOWED_ORIGINS` to include the site's origin if you want CORS tightened.

## Notes

- The gateway adds no intelligence — all reasoning happens in Qwen, and all validation (fix ids, platform guard, schema) happens client-side in `ai-engine.js`.
- If the model server is down, the gateway returns a clean 502 and the website falls back to its built-in Phase 2 troubleshooter automatically.
