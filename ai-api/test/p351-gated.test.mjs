/* ============================================================
   EmTech AI API — Phase 3.5.1 Worker gated-question (showIf) safety tests

   Root cause fixed in this phase: firstBranchQuestion() (ai-api/src/
   knowledge.js) skipped already-asked question IDs but never evaluated a
   question's showIf gate. The client protocol sends ONLY the ids of
   already-asked questions ("Already asked: id; id") — never the answer
   values — so the Worker can never know whether a gate like

     crash-screen  ← showIf { q: "crash-power", is: ["black"] }

   is satisfied. The frontend evaluates gates correctly because it holds
   the user's answers (diag-engine.js); the Worker must not guess.

   Phase 3.5.1 rule — UNKNOWN GATE = DO NOT SERVE DETERMINISTICALLY:
     * a showIf-gated candidate whose gate cannot be evaluated from Worker
       context is never returned by firstBranchQuestion();
     * deterministicRoute() therefore returns null and the turn falls
       through to Qwen, which DOES see the full conversation (answers);
     * ungated questions are unaffected — normal deterministic routing
       keeps working; already-asked skipping keeps working.

   Audit defects pinned here (Phase 3.5 audit §parity):
     A. windows/crashes: after crash-power answered → Worker used to serve
        crash-screen even when the answer was NOT "black".
     B. windows/updates: after upd-what answered → Worker used to serve
        upd-stuck even when the answer was NOT "fail".
     C. mac/audio: after mac-audio-what answered with speakers/both →
        Worker used to serve mac-mic-scope (a speaker problem must never be
        routed into the microphone branch — Phase 3.4 scoping).

   The worker entry point runs in plain Node against a FakeKV stub and a
   stubbed globalThis.fetch for upstream Qwen — no network, no quota spend
   (same harness conventions as p341-quota.test.mjs / security.test.mjs).

   Run from the repo root:
     node --test ai-api/test/p351-gated.test.mjs
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";

const workerMod = await import("../src/index.js");
const worker = workerMod.default;
const K = await import("../src/knowledge.js");
const P = await import("../src/policy.js");
const diagModule = await import("../../diag-data.js");

/* Interop-safe access to the CJS-shimmed data file (same pattern as tests). */
const DIAG = diagModule && (diagModule.profiles || diagModule.questions)
  ? diagModule
  : (diagModule.default && (diagModule.default.profiles || diagModule.default.questions))
    ? diagModule.default
    : null;

assert.ok(DIAG && Array.isArray(DIAG.profiles), "diag-data.js must load with profiles");
const { firstBranchQuestion } = K;
const { deterministicRoute, extractClientContext } = P;

/* ============================================================
   Protocol fact the fix relies on: the Worker receives question IDs only.
   If a future phase adds answer values to this protocol, THIS TEST MUST
   FAIL LOUDLY so the gate handling in knowledge.js is revisited first.
   ============================================================ */
test("protocol: 'Already asked' carries ids only — no answer values reach the Worker", () => {
  const ctx = extractClientContext(
    "Platform: windows\nCategory: crashes\n" +
    "Already asked (NEVER ask these again): crash-power; crash-screen\n" +
    "Fixes already recommended: black-screen-check-the-display-signal-path-first"
  );
  assert.deepEqual(ctx.askedQuestions, ["crash-power", "crash-screen"]);
  // No field on the context object may smuggle answer values in.
  for (const key of Object.keys(ctx)) {
    const v = ctx[key];
    if (Array.isArray(v) && v.length && typeof v[0] === "object") continue; // approvedQuestions entries are {id,text}
    assert.ok(!/answer/i.test(key), `context field "${key}" looks like answer data — revisit showIf handling`);
  }
});

/* ============================================================
   TEST A — Windows crashes: crash-screen is gated on crash-power=black.
   The Worker never sees the value, so it must NOT serve crash-screen in
   either case (black or non-black) — safe fall-through to Qwen instead.
   ============================================================ */
test("A: windows/crashes after crash-power answered → null, never crash-screen", () => {
  const r = firstBranchQuestion("windows", "crashes", ["crash-power"]);
  assert.equal(r, null, `must not serve a gated question from unknown context (got ${r && r.id})`);
  // Explicit parity assertion required by the phase spec:
  assert.ok(!(r && r.id === "crash-screen"), "crash-screen must never leak into deterministic routing");

  // Same through the router entry point with session context.
  const route = deterministicRoute({
    context: { platform: "windows", category: "crashes", askedQuestions: ["crash-power"] },
    lastUserText: "my pc crashed again last night",
  });
  assert.equal(route, null, "deterministicRoute must fall through to Qwen (null)");
});

/* ============================================================
   TEST B — Windows updates: upd-stuck is gated on upd-what=fail.
   Non-fail answers (or unknown ones) must never yield upd-stuck.
   ============================================================ */
test("B: windows/updates after upd-what answered → null, never upd-stuck", () => {
  const r = firstBranchQuestion("windows", "updates", ["upd-what"]);
  assert.equal(r, null, `must not serve a gated question from unknown context (got ${r && r.id})`);
  assert.ok(!(r && r.id === "upd-stuck"), "upd-stuck must never leak into deterministic routing");

  const route = deterministicRoute({
    context: { platform: "windows", category: "updates", askedQuestions: ["upd-what"] },
    lastUserText: "windows update is failing again",
  });
  assert.equal(route, null, "deterministicRoute must fall through to Qwen (null)");
});

/* ============================================================
   TEST C — Mac audio: mac-mic-scope is gated on mac-audio-what=mic and
   mac-audio-where on speakers/both. A speaker/output complaint must NEVER
   be deterministically routed into the microphone branch (Phase 3.4).
   The Worker cannot tell which answer was given → null either way, and it
   must not skip past one gate to serve the other gated question.
   ============================================================ */
test("C: mac/audio after mac-audio-what answered → null; neither mic-scope nor audio-where", () => {
  const r = firstBranchQuestion("mac", "audio", ["mac-audio-what"]);
  assert.equal(r, null, `must not serve a gated question from unknown context (got ${r && r.id})`);
  assert.ok(!(r && r.id === "mac-mic-scope"), "mac-mic-scope must never leak into deterministic routing");
  assert.ok(!(r && r.id === "mac-audio-where"), "mac-audio-where is gated too — no skip-past-gate serving");

  const route = deterministicRoute({
    context: { platform: "mac", category: "audio", askedQuestions: ["mac-audio-what"] },
    lastUserText: "my mac microphone is still silent",
  });
  assert.equal(route, null, "deterministicRoute must fall through to Qwen (null)");
});

/* ============================================================
   Structural sweep — every showIf-gated question in the data bank.
   Invariant: when all questions preceding a gated one have been asked,
   deterministic routing stops at the gate and returns null. The gated id
   is never served and never skipped over to reach a later question whose
   relevance also depends on the unknown answer. This generalizes A/B/C
   and auto-covers any future gated question added to diag-data.js.
   ============================================================ */
test("sweep: every showIf-gated question blocks deterministic routing at its gate", () => {
  let checked = 0;
  for (const p of DIAG.profiles) {
    const device = Array.isArray(p.devices) ? p.devices[0] : null;
    if (!device || !p.category) continue;
    const qs = p.questions || [];
    for (let i = 0; i < qs.length; i++) {
      const q = DIAG.questions[qs[i]];
      if (!q || !q.showIf) continue;
      checked++;
      const exclude = qs.slice(0, i); // everything before the gate (incl. its prerequisite)
      const r = firstBranchQuestion(device, p.category, exclude);
      assert.equal(r, null, `${p.id}: gated ${qs[i]} must stop routing at its gate (got ${r && r.id})`);
    }
  }
  assert.ok(checked >= 5, `expected the known ≥5 showIf-gated questions in the bank, saw ${checked}`);
});

/* ============================================================
   TEST D — normal ungated deterministic routing is UNCHANGED.
   The fix must not turn the whole router into a Qwen fallback: branches
   whose next unasked question has no gate keep being served.
   ============================================================ */
test("D: ungated first questions and ungated follow-ups still route deterministically", () => {
  // First turns of gated profiles are themselves ungated → still served.
  assert.equal(firstBranchQuestion("windows", "crashes").id, "crash-power");
  assert.equal(firstBranchQuestion("windows", "updates").id, "upd-what");
  assert.equal(firstBranchQuestion("mac", "audio").id, "mac-audio-what");

  // Multi-question fully-ungated profiles advance past an asked question.
  const net = firstBranchQuestion("windows", "network", ["net-state"]);
  assert.ok(net && net.id === "net-when", `win-network should serve net-when next (got ${net && net.id})`);

  const macPerf = firstBranchQuestion("mac", "performance", ["perf-when"]);
  assert.ok(macPerf && macPerf.id === "mac-freeze", `mac-performance should serve mac-freeze next (got ${macPerf && macPerf.id})`);

  // Router entry point, fresh branch + clear phrase → deterministic question.
  const route = deterministicRoute({ context: {}, lastUserText: "my windows pc won't turn on at all" });
  assert.ok(route, "fresh crashes branch must still be deterministic-routable");
  assert.equal(route.question.id, "crash-power", `expected crash-power (got ${route && route.question && route.question.id})`);
});

/* ============================================================
   TEST E — no reliable platform → null (no OS guessing), unchanged.
   ============================================================ */
test("E: unknown/missing platform never routes deterministically", () => {
  assert.equal(firstBranchQuestion(null, "audio"), null);
  assert.equal(firstBranchQuestion("", "crashes"), null);
  assert.equal(firstBranchQuestion("linux", "crashes"), null, "non mac/windows device must not map to a profile");

  const route = deterministicRoute({ context: {}, lastUserText: "it's still not working" });
  assert.equal(route, null, "no platform signal → Qwen fallback (null)");
});

/* ============================================================
   TEST F — already-asked questions are still skipped (existing behavior).
   ============================================================ */
test("F: asked questions are never re-served; skipping logic intact", () => {
  // Asked first question of an ungated branch → next one served.
  assert.equal(firstBranchQuestion("windows", "network", ["net-state"]).id, "net-when");

  // Asked first question of a gated branch → gate stops routing (null),
  // and the asked question itself is of course not re-served either way.
  const r = firstBranchQuestion("mac", "audio", ["mac-audio-what"]);
  assert.ok(!r || r.id !== "mac-audio-what", "already-asked question must never be re-served");

  // All questions of a small profile asked → exhausted → null (unchanged).
  const macCrashes = DIAG.profiles.find((p) => p.id === "mac-crashes");
  assert.equal(firstBranchQuestion("mac", "crashes", macCrashes.questions), null, "exhausted branch stays null");
});

/* ============================================================
   End-to-end through the worker entry point (index.js):
   router returns null → turn falls through to Qwen (exactly one upstream
   call) — and a fresh ungated branch is still served with ZERO Qwen calls.
   FakeKV + stubbed fetch: no network, no quota spend.
   ============================================================ */
const BASE = "https://emtech-ai-api.test";
let ipCounter = 5000;
const freshIp = () => `10.8.${(ipCounter++ % 250) + 1}.${ipCounter}`;

class FakeKV {
  constructor() { this.store = new Map(); }
  async get(key, type) { const raw = this.store.get(key); if (raw === undefined) return null; return type === "json" ? JSON.parse(raw) : raw; }
  async put(key, value) { this.store.set(key, String(value)); }
}

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

/* Canned model answer built from the REAL question bank (approved id +
   real text/options) so it passes knowledge-base validation. */
function cannedQuestion(platform, category, qid) {
  const q = DIAG.questions[qid];
  assert.ok(q && typeof q.q === "string", `canned question ${qid} must exist in the bank`);
  return JSON.stringify({
    status: "question", message: "Let's narrow this down.", platform, category,
    confidence: null, candidate_causes: [],
    question: { id: qid, text: q.q, options: (q.options || []).slice(0, 6).map((o) => o.label) },
    recommended_fix: null, related_fixes: [],
  });
}

function post(messages, { ip = freshIp(), env = {} } = {}) {
  return worker.fetch(
    new Request(BASE + "/api/ai", { method: "POST", headers: { "Content-Type": "application/json", "cf-connecting-ip": ip }, body: JSON.stringify({ messages }) }),
    Object.assign({}, ENV_QWEN, { RATE_LIMITS: new FakeKV() }, env)
  );
}

test("e2e A: crashes session after crash-power → Qwen fallback (1 call), no crash-screen served", async () => {
  await withUpstream(() => new Response(
    JSON.stringify({ choices: [{ message: { content: cannedQuestion("windows", "crashes", "crash-what") } }], usage: { total_tokens: 10 } }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  ), async (captured) => {
    const res = await post([
      { role: "system", content: "Platform: windows\nCategory: crashes\nAlready asked (NEVER ask these again): crash-power" },
      { role: "user", content: "my pc crashed again last night" },
    ]);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true, `expected a valid Qwen-served turn: ${JSON.stringify(body.errors || [])}`);
    assert.equal(captured.length, 1, "gate unknown → exactly one Qwen call (pre-fix this was 0 with crash-screen served)");
    assert.ok(!body.text.includes("crash-screen"), "response must not contain the gated question id");
  });
});

test("e2e B: updates session after upd-what → Qwen fallback (1 call), no upd-stuck served", async () => {
  await withUpstream(() => new Response(
    JSON.stringify({ choices: [{ message: { content: cannedQuestion("windows", "updates", "upd-version") } }], usage: { total_tokens: 10 } }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  ), async (captured) => {
    const res = await post([
      { role: "system", content: "Platform: windows\nCategory: updates\nAlready asked (NEVER ask these again): upd-what" },
      { role: "user", content: "windows update is failing again" },
    ]);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true, `expected a valid Qwen-served turn: ${JSON.stringify(body.errors || [])}`);
    assert.equal(captured.length, 1, "gate unknown → exactly one Qwen call (pre-fix this was 0 with upd-stuck served)");
    assert.ok(!body.text.includes("upd-stuck"), "response must not contain the gated question id");
  });
});

test("e2e C: mac audio session after mac-audio-what → Qwen fallback (1 call), no mic-scope served", async () => {
  await withUpstream(() => new Response(
    JSON.stringify({ choices: [{ message: { content: cannedQuestion("mac", "audio", "mac-audio-where") } }], usage: { total_tokens: 10 } }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  ), async (captured) => {
    const res = await post([
      { role: "system", content: "Platform: mac\nCategory: audio\nAlready asked (NEVER ask these again): mac-audio-what" },
      { role: "user", content: "my mac microphone is still silent" },
    ]);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true, `expected a valid Qwen-served turn: ${JSON.stringify(body.errors || [])}`);
    assert.equal(captured.length, 1, "gate unknown → exactly one Qwen call (pre-fix this was 0 with mac-mic-scope served)");
    assert.ok(!body.text.includes("mac-mic-scope"), "response must not contain the gated question id");
  });
});

test("e2e D: fresh ungated branch still deterministic — ZERO Qwen calls", async () => {
  await withUpstream(() => new Response(
    JSON.stringify({ choices: [{ message: { content: cannedQuestion("mac", "audio", "mac-audio-where") } }], usage: { total_tokens: 10 } }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  ), async (captured) => {
    const res = await post([
      { role: "user", content: "my mac microphone isn't working" },
    ]);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(captured.length, 0, "fresh branch must be served by the deterministic router — no Qwen call");
    assert.ok(body.text.includes("mac-audio-what"), `router should serve mac-audio-what (got: ${body.text.slice(0, 120)})`);
  });
});
