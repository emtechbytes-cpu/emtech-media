/* ============================================================
   EmTech AI API — Qwen cloud provider (server-side)

   Talks to the Qwen (DashScope) OpenAI-compatible endpoint using a key
   that lives ONLY here, as a worker secret (§5/§7). The model name is
   server-configured too, so changing models never touches the frontend
   (§38): the client's `model` field is ignored on purpose.

   Configuration (wrangler secret put in production; .dev.vars for local
   dev — see .dev.vars.example):
     QWEN_API_KEY         required — DashScope API key (secret, never logged)
     QWEN_MODEL           default "qwen-plus"
     QWEN_BASE_URL        default https://dashscope.aliyuncs.com/compatible-mode/v1
     UPSTREAM_TIMEOUT_MS  default 60000 (hard ceiling per call)
   ============================================================ */

const DEFAULT_BASE = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const MAX_TOKENS_CAP = 4096; // cost ceiling per response (§65)

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

export async function generateQwen({ messages, temperature, maxTokens }, env) {
  const baseUrl = String((env && env.QWEN_BASE_URL) || DEFAULT_BASE).replace(/\/+$/, "");
  const model = String((env && env.QWEN_MODEL) || "qwen-plus").slice(0, 120);
  const apiKey = (env && env.QWEN_API_KEY) ? String(env.QWEN_API_KEY) : "";
  if (!apiKey) throw httpError(503, "QWEN_API_KEY is not configured on the server");

  const timeoutMs = Math.min(Number((env && env.UPSTREAM_TIMEOUT_MS)) || 60000, 120000);
  const ctrl = new AbortController();
  const timer = setTimeout(() => { try { ctrl.abort(new Error("upstream timeout")); } catch (err) {} }, timeoutMs);

  try {
    const res = await fetch(baseUrl + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`, // key stays on this side of the boundary (§5)
      },
      body: JSON.stringify({
        model, // server-side is authoritative (§38) — client value ignored
        messages,
        temperature: typeof temperature === "number" && Number.isFinite(temperature) ? Math.min(Math.max(temperature, 0), 2) : 0.2,
        max_tokens: Number.isInteger(maxTokens) && maxTokens > 0 ? Math.min(maxTokens, MAX_TOKENS_CAP) : 2500,
      }),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      // Never echo upstream details (endpoint, provider errors) to the client (§23).
      throw httpError(502, "qwen-upstream-" + res.status);
    }

    let data = null;
    try { data = await res.json(); } catch (err) { throw httpError(502, "upstream returned non-JSON"); }

    const content = data && Array.isArray(data.choices) && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content : null;
    if (typeof content !== "string" || !content.trim()) throw httpError(502, "empty model response");

    return { text: content, usage: data.usage || null };
  } catch (err) {
    if (err && err.name === "AbortError") throw httpError(504, "upstream timed out");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
