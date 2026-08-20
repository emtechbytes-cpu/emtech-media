/* ============================================================
   EmTech AI API — Phase 3.4.1 daily quota lifecycle tests (Node, zero deps)

   Phase 3.4.1 moved the DAILY limiter from before body validation to after
   all client-facing validations (body size → JSON parse → shape → policy),
   while the PER-MINUTE limiter deliberately stays first as the cheap abuse
   throttle. These tests pin down the exact accounting semantics:

     rejected requests  → minute slot consumed, daily NOT consumed, no Qwen
     served turns       → minute + daily consumed (deterministic router AND
                          Qwen paths; no refund when the turn later fails)

   The worker entry point runs in plain Node against a FakeKV stub that
   implements exactly the binding interface the worker uses
   (`get(key, "json")` / `put(key, value, { expirationTtl })`) so tests can
   assert on the stored counters and TTLs directly. Upstream Qwen calls are
   stubbed via globalThis.fetch — no network, no quota spend.

   Run from the repo root:
     node --test ai-api/test/p341-quota.test.mjs
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";

const workerMod = await import("../src/index.js");
const worker = workerMod.default;

/* ---------- helpers (same harness conventions as security.test.mjs) ---------- */
const BASE = "https://emtech-ai-api.test";
let ipCounter = 1000;
const freshIp = () => `10.9.${(ipCounter++ % 250) + 1}.${ipCounter}`;

/* KV stub: stores raw strings exactly like the worker writes them and
   records every put (key + TTL) so tests can assert accounting precisely. */
class FakeKV {
  constructor() { this.store = new Map(); this.puts = []; }
  async get(key, type) {
    const raw = this.store.get(key);
    if (raw === undefined) return null;
    if (type === "json") { try { return JSON.parse(raw); } catch (err) { return null; } }
    return raw;
  }
  async put(key, value, opts = {}) {
    this.store.set(key, String(value));
    this.puts.push({ key, ttl: opts && opts.expirationTtl });
  }
}

/* KV stub whose get/put always throw — exercises the worker's fail-open
   in-memory fallback path (Phase 3.4.1 §28). */
class BrokenKV {
  async get() { throw new Error("kv unavailable"); }
  async put() { throw new Error("kv unavailable"); }
}

const countOf = (kv, key) => {
  const raw = kv.store.get(key);
  if (raw === undefined) return null; // key never written
  try { return JSON.parse(raw).count; } catch (err) { return null; }
};
const ttlOfLastPut = (kv, key) => {
  for (let i = kv.puts.length - 1; i >= 0; i--) if (kv.puts[i].key === key) return kv.puts[i].ttl;
  return undefined;
};

const todayUTC = () => new Date().toISOString().slice(0, 10);
const yesterdayUTC = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const dailyKey = (ip) => `dly:${ip}:${todayUTC()}`;
const minuteKey = (ip) => `rl:${ip}`;

/* body: object → JSON-encoded; string → sent verbatim (raw/invalid bodies). */
function post(body, { ip = freshIp(), env = {} } = {}) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return worker.fetch(
    new Request(BASE + "/api/ai", { method: "POST", headers: { "Content-Type": "application/json", "cf-connecting-ip": ip }, body: raw }),
    env
  );
}

/* Stub the upstream Qwen call; `handler` returns the canned Response. */
async function withUpstream(handler, run) {
  const captured = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    captured.push({ url: String(url), body: JSON.parse(opts.body) });
    return handler(captured.length - 1);
  };
  try { await run(captured); } finally { globalThis.fetch = realFetch; }
}

const ENV_QWEN = { QWEN_API_KEY: "test-key-not-real", QWEN_MODEL: "qwen-test-model", QWEN_BASE_URL: "https://upstream.test/v1" };

/* A model answer that passes knowledge-base validation (same canned turn as
   security.test.mjs — perf-when is a real approved question). */
const CANNED_OK = JSON.stringify({
  status: "question", message: "Let's narrow this down.", platform: "windows", category: "performance",
  confidence: null, candidate_causes: [],
  question: { id: "perf-when", text: "When did it start feeling slow?", options: ["Today", "A few days ago"] },
  recommended_fix: null, related_fixes: [],
});

const okUpstream = () => new Response(
  JSON.stringify({ choices: [{ message: { content: CANNED_OK } }], usage: { total_tokens: 10 } }),
  { status: 200, headers: { "Content-Type": "application/json" } }
);

/* Input the pre-AI router WILL intercept (platform + clear category winner). */
const DETERMINISTIC = "My Windows PC has low storage.";
/* Input the router will NOT intercept — forces the Qwen path. */
const AMBIGUOUS = "My computer is acting weird.";

/* ============================================================
   Rejected requests: minute YES · daily NO · Qwen NO (§22, §13–§15)
   ============================================================ */
test("empty body → 400; burns a minute slot but NOT the daily budget", async () => {
  const ip = freshIp(); const kv = new FakeKV();
  await withUpstream(okUpstream, async (captured) => {
    const res = await post("", { ip, env: Object.assign({}, ENV_QWEN, { RATE_LIMITS: kv }) });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error || (body.details && body.details.length), "client-facing error present");
    assert.equal(countOf(kv, minuteKey(ip)), 1, "per-minute slot consumed (throttle stays first)");
    assert.equal(countOf(kv, dailyKey(ip)), null, "daily budget untouched by a rejected body");
    assert.equal(captured.length, 0, "no Qwen call");
  });
});

test("invalid JSON → 400; minute consumed, daily NOT (§15)", async () => {
  const ip = freshIp(); const kv = new FakeKV();
  await withUpstream(okUpstream, async (captured) => {
    const res = await post("{not valid json", { ip, env: Object.assign({}, ENV_QWEN, { RATE_LIMITS: kv }) });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /invalid JSON/);
    assert.equal(countOf(kv, minuteKey(ip)), 1);
    assert.equal(countOf(kv, dailyKey(ip)), null, "malformed JSON must not consume a daily slot");
    assert.equal(captured.length, 0);
  });
});

test("oversized body → 413; minute consumed, daily NOT (§14)", async () => {
  const ip = freshIp(); const kv = new FakeKV();
  await withUpstream(okUpstream, async (captured) => {
    const res = await post({ messages: [{ role: "user", content: "a".repeat(6000) }] },
      { ip, env: Object.assign({}, ENV_QWEN, { RATE_LIMITS: kv, MAX_BODY_BYTES: 5000 }) });
    assert.equal(res.status, 413);
    assert.match((await res.json()).error, /too large/);
    assert.equal(countOf(kv, minuteKey(ip)), 1);
    assert.equal(countOf(kv, dailyKey(ip)), null, "oversized bodies must not consume a daily slot");
    assert.equal(captured.length, 0);
  });
});

test("missing required fields → 400; minute consumed, daily NOT", async () => {
  const ip = freshIp(); const kv = new FakeKV();
  await withUpstream(okUpstream, async (captured) => {
    const res = await post({}, { ip, env: Object.assign({}, ENV_QWEN, { RATE_LIMITS: kv }) });
    assert.equal(res.status, 400);
    assert.match((await res.json()).details.join(" "), /messages/);
    assert.equal(countOf(kv, minuteKey(ip)), 1);
    assert.equal(countOf(kv, dailyKey(ip)), null);
    assert.equal(captured.length, 0);
  });
});

test("invalid field types → 400; minute consumed, daily NOT", async () => {
  const ip = freshIp(); const kv = new FakeKV();
  await withUpstream(okUpstream, async (captured) => {
    const res = await post({ messages: [{ role: "user", content: 123 }] }, { ip, env: Object.assign({}, ENV_QWEN, { RATE_LIMITS: kv }) });
    assert.equal(res.status, 400);
    assert.match((await res.json()).details.join(" "), /string content/);
    assert.equal(countOf(kv, minuteKey(ip)), 1);
    assert.equal(countOf(kv, dailyKey(ip)), null);
    assert.equal(captured.length, 0);
  });
});

test("invalid enum (unknown role) → 400; minute consumed, daily NOT", async () => {
  const ip = freshIp(); const kv = new FakeKV();
  await withUpstream(okUpstream, async (captured) => {
    const res = await post({ messages: [{ role: "hacker", content: "hi" }] }, { ip, env: Object.assign({}, ENV_QWEN, { RATE_LIMITS: kv }) });
    assert.equal(res.status, 400);
    assert.match((await res.json()).details.join(" "), /valid role/);
    assert.equal(countOf(kv, minuteKey(ip)), 1);
    assert.equal(countOf(kv, dailyKey(ip)), null);
    assert.equal(captured.length, 0);
  });
});

test("system-only request → 400 'no user message'; minute consumed, daily NOT (§13)", async () => {
  const ip = freshIp(); const kv = new FakeKV();
  await withUpstream(okUpstream, async (captured) => {
    const res = await post({ messages: [{ role: "system", content: "Platform: windows\nCategory: storage" }] },
      { ip, env: Object.assign({}, ENV_QWEN, { RATE_LIMITS: kv }) });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /no user message/);
    assert.equal(countOf(kv, minuteKey(ip)), 1, "still throttled by the per-minute limiter");
    assert.equal(countOf(kv, dailyKey(ip)), null, "policy rejection must not consume a daily slot");
    assert.equal(captured.length, 0);
  });
});

test("policy rejection (whitespace-only user turn) → 400; minute consumed, daily NOT", async () => {
  const ip = freshIp(); const kv = new FakeKV();
  await withUpstream(okUpstream, async (captured) => {
    const res = await post({ messages: [{ role: "user", content: "   \n\t  " }] }, { ip, env: Object.assign({}, ENV_QWEN, { RATE_LIMITS: kv }) });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /no user message/);
    assert.equal(countOf(kv, minuteKey(ip)), 1);
    assert.equal(countOf(kv, dailyKey(ip)), null);
    assert.equal(captured.length, 0);
  });
});

/* ============================================================
   Valid requests: minute YES · daily YES (§22, §16–§18)
   ============================================================ */
test("valid deterministic route → 200; minute + daily consumed, ZERO Qwen calls (§16)", async () => {
  const ip = freshIp(); const kv = new FakeKV();
  await withUpstream(okUpstream, async (captured) => {
    const res = await post({ messages: [{ role: "user", content: DETERMINISTIC }] }, { ip, env: Object.assign({}, ENV_QWEN, { RATE_LIMITS: kv }) });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(countOf(kv, minuteKey(ip)), 1);
    assert.equal(countOf(kv, dailyKey(ip)), 1, "served deterministic turns consume the daily budget");
    assert.equal(captured.length, 0, "zero Qwen calls — but not a free daily slot");
  });
});

test("valid Qwen route → 200; minute + daily consumed, exactly one Qwen call (§17)", async () => {
  const ip = freshIp(); const kv = new FakeKV();
  await withUpstream(okUpstream, async (captured) => {
    const res = await post({ messages: [{ role: "user", content: AMBIGUOUS }] }, { ip, env: Object.assign({}, ENV_QWEN, { RATE_LIMITS: kv }) });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ok, true);
    assert.equal(countOf(kv, minuteKey(ip)), 1);
    assert.equal(countOf(kv, dailyKey(ip)), 1);
    assert.equal(captured.length, 1, "exactly one upstream call");
  });
});

test("Qwen failure → existing sanitized error; daily slot stays consumed (no refund)", async () => {
  const ip = freshIp(); const kv = new FakeKV();
  await withUpstream(() => new Response("upstream exploded", { status: 500 }), async (captured) => {
    const res = await post({ messages: [{ role: "user", content: AMBIGUOUS }] }, { ip, env: Object.assign({}, ENV_QWEN, { RATE_LIMITS: kv }) });
    assert.equal(res.status, 502); // existing sanitized upstream-failure status
    assert.match((await res.json()).error, /temporarily unavailable/);
    assert.equal(countOf(kv, minuteKey(ip)), 1);
    assert.equal(countOf(kv, dailyKey(ip)), 1, "a valid turn that reached Qwen consumes the budget even when it fails");
    assert.equal(captured.length, 1);
  });
});

test("response validation failure → HTTP 200 ok:false; daily slot stays consumed", async () => {
  const ip = freshIp(); const kv = new FakeKV();
  await withUpstream(() => new Response(JSON.stringify({ choices: [{ message: { content: "Sorry, I cannot help you with that." } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } }), async (captured) => {
    const res = await post({ messages: [{ role: "user", content: AMBIGUOUS }] }, { ip, env: Object.assign({}, ENV_QWEN, { RATE_LIMITS: kv }) });
    assert.equal(res.status, 200); // invalid output is data, not a transport failure
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.match(body.errors.join(" "), /not valid JSON/);
    assert.equal(countOf(kv, minuteKey(ip)), 1);
    assert.equal(countOf(kv, dailyKey(ip)), 1, "outbound-validation failure still consumed the budget");
    assert.equal(captured.length, 1);
  });
});

/* ============================================================
   Limiters keep working after the lifecycle move (§22)
   ============================================================ */
test("minute limit: N+1th request → 429; blocked turn never reaches router/Qwen", async () => {
  const ip = freshIp(); const kv = new FakeKV();
  await withUpstream(okUpstream, async (captured) => {
    for (let i = 0; i < 2; i++) {
      const res = await post({ messages: [{ role: "user", content: AMBIGUOUS }] },
        { ip, env: Object.assign({}, ENV_QWEN, { RATE_LIMITS: kv, AI_RATE_LIMIT: 2 }) });
      assert.equal(res.status, 200, `request ${i + 1} should pass`);
    }
    const blocked = await post({ messages: [{ role: "user", content: AMBIGUOUS }] },
      { ip, env: Object.assign({}, ENV_QWEN, { RATE_LIMITS: kv, AI_RATE_LIMIT: 2 }) });
    assert.equal(blocked.status, 429);
    assert.match((await blocked.json()).error, /wait a minute/);
    assert.equal(countOf(kv, dailyKey(ip)), 2, "only the two validated turns consumed daily slots");
    assert.equal(captured.length, 2, "blocked request never reaches Qwen");
  });
});

test("daily limit: N+1th VALID request → 429; blocked turn never reaches router/Qwen (§18)", async () => {
  const ip = freshIp(); const kv = new FakeKV();
  await withUpstream(okUpstream, async (captured) => {
    for (let i = 0; i < 2; i++) {
      const res = await post({ messages: [{ role: "user", content: AMBIGUOUS }] },
        { ip, env: Object.assign({}, ENV_QWEN, { RATE_LIMITS: kv, AI_DAILY_LIMIT: 2 }) });
      assert.equal(res.status, 200);
    }
    const blocked = await post({ messages: [{ role: "user", content: AMBIGUOUS }] },
      { ip, env: Object.assign({}, ENV_QWEN, { RATE_LIMITS: kv, AI_DAILY_LIMIT: 2 }) });
    assert.equal(blocked.status, 429);
    assert.match((await blocked.json()).error, /today/i);
    assert.equal(countOf(kv, dailyKey(ip)), 3, "the over-budget attempt is recorded but rejected");
    assert.equal(captured.length, 2, "over-daily-limit request never reaches Qwen");
  });
});

/* ============================================================
   Accounting proofs (§23–§26) — the heart of Phase 3.4.1
   ============================================================ */
test("accounting delta: malformed leaves daily untouched; next valid turn consumes exactly one slot (§23)", async () => {
  const ip = freshIp(); const kv = new FakeKV();
  const env = Object.assign({}, ENV_QWEN, { RATE_LIMITS: kv, AI_DAILY_LIMIT: 10 });
  await withUpstream(okUpstream, async (captured) => {
    const bad = await post("{not valid json", { ip, env });
    assert.equal(bad.status, 400);
    assert.equal(countOf(kv, dailyKey(ip)), null, "daily remaining still N after the malformed request");

    const good = await post({ messages: [{ role: "user", content: DETERMINISTIC }] }, { ip, env });
    assert.equal(good.status, 200);
    assert.equal(countOf(kv, dailyKey(ip)), 1, "daily remaining now N-1");
    assert.equal(captured.length, 0);
  });
});

test("mixed sequence: 4 rejected + 1 deterministic + 1 Qwen → daily count exactly 2, Qwen once (§24)", async () => {
  const ip = freshIp(); const kv = new FakeKV();
  const env = Object.assign({}, ENV_QWEN, { RATE_LIMITS: kv, AI_DAILY_LIMIT: 10 });
  await withUpstream(okUpstream, async (captured) => {
    assert.equal((await post("{not valid json", { ip, env })).status, 400);
    const oversized = await post({ messages: [{ role: "user", content: "a".repeat(6000) }] }, { ip, env: Object.assign(env, { MAX_BODY_BYTES: 5000 }) });
    assert.equal(oversized.status, 413);
    assert.equal((await post({}, { ip, env })).status, 400);
    assert.equal((await post({ messages: [{ role: "system", content: "Platform: windows" }] }, { ip, env })).status, 400);

    const det = await post({ messages: [{ role: "user", content: DETERMINISTIC }] }, { ip, env });
    assert.equal(det.status, 200);
    const qwen = await post({ messages: [{ role: "user", content: AMBIGUOUS }] }, { ip, env });
    assert.equal(qwen.status, 200);

    assert.equal(countOf(kv, dailyKey(ip)), 2, "daily counter increased exactly twice — not six");
    assert.equal(countOf(kv, minuteKey(ip)), 6, "every request still burned a cheap per-minute slot");
    assert.equal(captured.length, 1, "Qwen invoked exactly once (only the ambiguous turn)");
  });
});

test("daily limit edge: AI_DAILY_LIMIT=2 — malformed cannot eat the budget (§25)", async () => {
  const ip = freshIp(); const kv = new FakeKV();
  const env = Object.assign({}, ENV_QWEN, { RATE_LIMITS: kv, AI_DAILY_LIMIT: 2 });
  await withUpstream(okUpstream, async (captured) => {
    assert.equal((await post("{not valid json", { ip, env })).status, 400);
    assert.equal(countOf(kv, dailyKey(ip)), null, "daily budget still fully intact");

    assert.equal((await post({ messages: [{ role: "user", content: DETERMINISTIC }] }, { ip, env })).status, 200);
    assert.equal(countOf(kv, dailyKey(ip)), 1);

    assert.equal((await post({ messages: [{ role: "user", content: DETERMINISTIC }] }, { ip, env })).status, 200);
    assert.equal(countOf(kv, dailyKey(ip)), 2);

    const blocked = await post({ messages: [{ role: "user", content: DETERMINISTIC }] }, { ip, env });
    assert.equal(blocked.status, 429);
    assert.match((await blocked.json()).error, /today/i);
    assert.equal(captured.length, 0, "all served turns were deterministic — zero Qwen calls");
  });
});

test("minute limit edge: AI_RATE_LIMIT=2 — malformed requests still hit the minute limiter (§26)", async () => {
  const ip = freshIp(); const kv = new FakeKV();
  const env = Object.assign({}, ENV_QWEN, { RATE_LIMITS: kv, AI_RATE_LIMIT: 2 });
  await withUpstream(okUpstream, async (captured) => {
    assert.equal((await post("{not valid json", { ip, env })).status, 400);
    assert.equal(countOf(kv, minuteKey(ip)), 1, "first malformed request consumed a minute slot");
    assert.equal(countOf(kv, dailyKey(ip)), null);

    assert.equal((await post("{not valid json", { ip, env })).status, 400);
    assert.equal(countOf(kv, minuteKey(ip)), 2, "second malformed request consumed the last slot");
    assert.equal(countOf(kv, dailyKey(ip)), null, "daily untouched by both malformed requests");

    const blocked = await post({ messages: [{ role: "user", content: DETERMINISTIC }] }, { ip, env });
    assert.equal(blocked.status, 429);
    assert.match((await blocked.json()).error, /wait a minute/);
    assert.equal(countOf(kv, dailyKey(ip)), null, "the valid request was throttled before the daily budget");
    assert.equal(captured.length, 0);
  });
});

/* ============================================================
   Daily key format / TTL / UTC-day lifecycle (§27) — unchanged by design
   ============================================================ */
test("daily key uses dly:<ip>:<UTC date> with ~25h TTL; minute key keeps window+5s TTL", async () => {
  const ip = freshIp(); const kv = new FakeKV();
  await withUpstream(okUpstream, async (captured) => {
    const res = await post({ messages: [{ role: "user", content: DETERMINISTIC }] },
      { ip, env: Object.assign({}, ENV_QWEN, { RATE_LIMITS: kv, AI_RATE_WINDOW_S: 30 }) });
    assert.equal(res.status, 200);

    const key = dailyKey(ip);
    assert.ok(kv.store.has(key), "daily counter written under the canonical key");
    assert.match(key, new RegExp(`^dly:${ip.replace(/\./g, "\\.")}:\\d{4}-\\d{2}-\\d{2}$`));
    assert.equal(key.slice(-10), todayUTC(), "key carries the current UTC calendar day");
    assert.equal(ttlOfLastPut(kv, key), 90061, "TTL stays just over a day (self-cleaning)");

    assert.ok(kv.store.has(minuteKey(ip)), "minute counter written under rl:<ip>");
    assert.equal(ttlOfLastPut(kv, minuteKey(ip)), 35, "minute TTL = window + 5s (unchanged semantics)");
    assert.equal(captured.length, 0);
  });
});

test("new UTC day: yesterday's usage does not carry into today's budget", async () => {
  const ip = freshIp(); const kv = new FakeKV();
  // Pre-seed a fully-used counter for YESTERDAY under the same IP.
  kv.store.set(`dly:${ip}:${yesterdayUTC()}`, JSON.stringify({ count: 2 }));
  await withUpstream(okUpstream, async (captured) => {
    const res = await post({ messages: [{ role: "user", content: DETERMINISTIC }] },
      { ip, env: Object.assign({}, ENV_QWEN, { RATE_LIMITS: kv, AI_DAILY_LIMIT: 2 }) });
    assert.equal(res.status, 200, "a new UTC day starts with a fresh budget");
    assert.equal(countOf(kv, dailyKey(ip)), 1, "today's counter starts at 1 — no reset mechanism needed");
    assert.equal(captured.length, 0);
  });
});

/* ============================================================
   KV failure fallback (§28) — fail-open behavior preserved
   ============================================================ */
test("KV unavailable → in-memory fallback still serves a valid deterministic turn", async () => {
  const ip = freshIp();
  await withUpstream(okUpstream, async (captured) => {
    const res = await post({ messages: [{ role: "user", content: DETERMINISTIC }] },
      { ip, env: Object.assign({}, ENV_QWEN, { RATE_LIMITS: new BrokenKV() }) });
    assert.equal(res.status, 200, "limiter KV hiccup must not block users (fail-open)");
    assert.equal((await res.json()).ok, true);
    assert.equal(captured.length, 0);
  });
});
