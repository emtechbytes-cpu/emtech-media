/* ============================================================
   EmTech AI API — server-side unit tests (Node, zero dependencies)

   Runs the worker's knowledge + validation layers in plain Node:
     node --test ai-api/test/validate.test.mjs

   This also proves the CJS shims in tips-data.js / diag-data.js work
   outside the browser (the same code path esbuild bundles for Workers).
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";

import { TIPS, tipSlug, getFixBySlug, isMacTip, approvedQuestionIds } from "../src/knowledge.js";
import { validateModelText, platformFromMessages } from "../src/validate.js";

/* ---------- knowledge base loads in Node (§13: one source of truth) ---------- */
test("knowledge base loads outside the browser", () => {
  assert.ok(Array.isArray(TIPS) && TIPS.length >= 50, `expected a real tip library, got ${TIPS.length}`);
  assert.equal(typeof tipSlug, "function");

  const winTip = TIPS.find((t) => t.cat !== "mac");
  const macTip = TIPS.find((t) => t.cat === "mac");
  assert.ok(winTip && macTip, "expected both Windows and Mac tips in the data set");

  const winSlug = tipSlug(winTip.title);
  const macSlug = tipSlug(macTip.title);
  assert.equal(getFixBySlug(winSlug).title, winTip.title);
  assert.equal(isMacTip(getFixBySlug(macSlug)), true);
  assert.equal(getFixBySlug("no-such-fix-xyz"), null);
});

test("approved question bank is non-empty and stable", () => {
  const ids = approvedQuestionIds();
  assert.ok(ids.size >= 10, `expected a real question bank, got ${ids.size}`);
  assert.ok(ids.has("perf-when"), "perf-when should be an approved question");
});

/* ---------- response validation (§14–17/§35/§47) ---------- */
const winTip = TIPS.find((t) => t.cat !== "mac");
const macTip = TIPS.find((t) => t.cat === "mac");
const winSlug = tipSlug(winTip.title);
const macSlug = tipSlug(macTip.title);

test("valid question turn accepted", () => {
  const v = validateModelText(JSON.stringify({
    status: "question", message: "Let's narrow this down.",
    platform: "windows", confidence: null,
    question: { id: "perf-when", text: "When did it start feeling slow?", options: ["Today", "A few days ago"] },
  }), { platform: "windows" });
  assert.equal(v.ok, true, JSON.stringify(v.errors));
});

test("unknown question id rejected (no invented questions)", () => {
  const v = validateModelText(JSON.stringify({
    status: "question", message: "m",
    question: { id: "totally-bogus-id", text: "?", options: ["a", "b"] },
  }), {});
  assert.equal(v.ok, false);
});

test("free question needs at least two options", () => {
  const ok = validateModelText(JSON.stringify({
    status: "question", message: "m",
    question: { id: "free", text: "What do you see?", options: ["A black screen", "An error code"] },
  }), {});
  assert.equal(ok.ok, true, JSON.stringify(ok.errors));

  const bad = validateModelText(JSON.stringify({
    status: "question", message: "m",
    question: { id: "free", text: "What do you see?", options: ["Only one"] },
  }), {});
  assert.equal(bad.ok, false);
});

test("recommendation with a real fix passes for the right platform", () => {
  const v = validateModelText(JSON.stringify({
    status: "recommendation", message: "Try this.",
    recommended_fix: { fix_id: winSlug, reason: "likely cause" },
  }), { platform: "windows" });
  assert.equal(v.ok, true, JSON.stringify(v.errors));
});

test("platform guard: Windows fix rejected for a Mac session", () => {
  const v = validateModelText(JSON.stringify({
    status: "recommendation", message: "Try this.",
    recommended_fix: { fix_id: winSlug },
  }), { platform: "mac" });
  assert.equal(v.ok, false);
});

test("platform guard: Mac fix rejected for a Windows session", () => {
  const v = validateModelText(JSON.stringify({
    status: "recommendation", message: "Try this.",
    recommended_fix: { fix_id: macSlug },
  }), { platform: "windows" });
  assert.equal(v.ok, false);
});

test("invented fix id rejected — never a fake recommendation (§14)", () => {
  const v = validateModelText(JSON.stringify({
    status: "recommendation", message: "Try this.",
    recommended_fix: { fix_id: "some-random-fix" },
  }), {});
  assert.equal(v.ok, false);
});

test("status/question cross-rules enforced", () => {
  const noQ = validateModelText(JSON.stringify({ status: "question", message: "m" }), {});
  assert.equal(noQ.ok, false);
  const noFix = validateModelText(JSON.stringify({ status: "recommendation", message: "m" }), {});
  assert.equal(noFix.ok, false);
});

test("malformed responses rejected without crashing (§34)", () => {
  assert.equal(validateModelText("no json here at all").ok, false);
  assert.equal(validateModelText("{oops").ok, false);
  const v = validateModelText(JSON.stringify({ status: "definitely_not_a_status", message: "m" }), {});
  assert.equal(v.ok, false);
});

test("JSON wrapped in prose/fences still validated", () => {
  const v = validateModelText('Sure! ```json\n' + JSON.stringify({ status: "resolved", message: "Glad we could help." }) + '\n``` hope that helps');
  assert.equal(v.ok, true, JSON.stringify(v.errors));
});

test("platform extracted from the system prompt line", () => {
  const sys = (p) => [{ role: "system", content: `SESSION FACTS:\nPlatform: ${p}` }, { role: "user", content: "my pc is slow" }];
  assert.equal(platformFromMessages(sys("windows (never give the other OS's instructions)")), "windows");
  assert.equal(platformFromMessages(sys("mac (never give the other OS's instructions)")), "mac");
  assert.equal(platformFromMessages(sys('unknown — ask "Are you using Windows or Mac?" first')), null);
  assert.equal(platformFromMessages([]), null);
});
