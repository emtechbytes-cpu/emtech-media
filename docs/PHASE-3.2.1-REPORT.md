# EmTech Media — Phase 3.2.1 Report
## Knowledge Schema + Diagnostic Foundation

**Status: IMPLEMENTED AND VERIFIED (not deployed — deployment explicitly deferred per spec §26)**
All changes are uncommitted on `main`. No production deployment was executed.

---

### A. Files inspected

| File | Role / what was checked |
|---|---|
| `tips-data.js` | Knowledge base (74 tips). Verified existing schema, CRLF integrity, metadata placement after each `title:` line, header docs |
| `diag-data.js` | Diagnostic data: 21 profiles, 60 causes, 99 cause→fix refs, 26-question bank. All references re-counted from source this session |
| `ai-knowledge.js` | Browser KB layer; `buildKnowledgeContext()` now renders safety metadata into Qwen's context; reads shared word list with graceful fallback |
| `ai-engine.js` | Engine global confirmed as `window.EmTechAI`; conversation state, provider handling untouched |
| `ai.html` | Script load order: `classification-words.js` loads before `ai-knowledge.js` (order matters) |
| `ai-api/src/index.js`, `policy.js`, `qwen.js`, `knowledge.js`, `validate.js` | Worker chain. `policy.js` imports canonical word list and exports `routerVocabulary()`; full module chain loads in Node (exercised by test suites) |
| `classification-words.js` | NEW shared canonical router vocabulary (prior session, §15) — verified consumed by both browser and worker |
| `ai-api/test/schema.test.mjs`, `validate.test.mjs`, `security.test.mjs`, `scenarios.mjs` | All four suites re-run this session: 48/48 pass |
| `docs/PHASE-3.1.1-REPORT.md` | Format reference only |
| Scratchpad artifacts (`migrate321.mjs`, `review321.txt`, `verify321-*.mjs`) | Migration record + prior browser verification scripts; re-run this session |

### B. Files modified

1. **`tips-data.js`** — 74/74 tips now carry the four new metadata fields (inserted directly after each `title:` line, CRLF preserved: 1511 CR = 1511 LF). Header comment block documents the schema, risk rubric, and REVIEW_QUEUE pointer.
2. **`ai-knowledge.js`** — `buildKnowledgeContext()` renders `Safety risk:` / `How to verify it worked:` / `If it does not work:` lines so Qwen reasons over safety metadata in both cloud and local modes; reads the shared word list with fallback if absent.
3. **`ai.html`** — loads `classification-words.js` before `ai-knowledge.js`. No visual/UI changes.
4. **`ai-api/src/policy.js`** — imports the canonical word list (single source of truth for router vocabulary); exports `routerVocabulary()` used by the drift test. Server-owned prompt and all Phase 3.1.1 hardening untouched.
5. **`ai-api/test/scenarios.mjs`** — updated to consume the shared vocabulary.

### C. Files added

1. **`classification-words.js`** (prior session) — canonical `PLATFORM_WORDS` / `CATEGORY_WORDS` shared by browser classifier and worker router.
2. **`ai-api/test/schema.test.mjs`** — 8 data-quality tests + the §23 REVIEW_QUEUE (currently empty) + router-vocabulary drift check.
3. **`docs/PHASE-3.2.1-REPORT.md`** — this report.

### D. Existing schema (before Phase 3.2.1)

Tip object fields: `title`, `updated`, `diagram`, `cat` (one of mac/speed/windows/gaming/cleaning/maintenance/hardware/security), `difficulty` (1–3), `time` (human-readable duration), `win`, `description`, `steps`.
**fix_id is not a stored field — it is derived deterministically from the title via `tipSlug()`** (e.g. "Disable startup bloat" → `disable-startup-bloat`). All 74 derived ids are unique (verified this session).

Diagnostic data: `devices` (3), `categories` (11), `starters` (8), `profiles` (21; device tags windows 10 / mac 7 / other 4), causes (60) each with a primary `fix` + optional `alt[]`, question bank (26).

### E. New schema (Phase 3.2.1)

Four optional fields added to every tip, inserted after `title`:

```js
{
  title: "...",
  risk_level: "low" | "medium" | "high",   // spec §9 rubric
  reversible: true | false,                // can the user reasonably undo it?
  verification: "How to confirm it worked (specific to this fix)",
  failure_conditions: "What indicates it did not work / stop here",
  ...existing fields unchanged
}
```

**Deliberately NOT added** (minimum-useful-schema principle, spec §3): `prerequisites` (steps already imply them), `likely_causes`/`symptoms` (diag-data.js cause→fix refs + tip description already cover this; adding would duplicate the KB), `related_fixes` (`alt[]` arrays already exist in diag-data.js). Existing `difficulty` (1–3) and `time` fields were **reused** instead of duplicating them as `easy/moderate/advanced` + `estimated_time`.

### F. Why each new field exists

- **risk_level** — lets the AI/validation layer prefer safe fixes and warn before high-risk ones; enables future SAFE→REVERSIBLE→LIKELY→INVASIVE ordering (spec §19).
- **reversible** — distinguishes undoable settings changes from data-destructive actions; feeds safety warnings.
- **verification** — turns "user performed steps" into "fix confirmed"; specific per-fix check, not generic "check if it works" (spec §7).
- **failure_conditions** — gives the system a defined signal to move to the next fix instead of looping (spec §8, §20 verification-loop preparation).

### G–J. Migration and completeness counts (actual, verified this session)

| Metric | Value |
|---|---|
| Tips migrated (G) | **74 / 74** |
| Complete metadata (H) | **74** |
| Partial (I) | **0** |
| Review required (J) | **0** — REVIEW_QUEUE mechanism exists in `schema.test.mjs` (§23) and is empty; any future tip missing fields must be listed there or the completeness test fails |

No metadata was fabricated: every verification/failure_condition references content actually present in that tip's steps/goal (side-by-side review performed prior session, artifact `review321.txt`; structural validity + coverage re-verified this session by tests and browser probe).

### K. Broken references

**0 broken.** Verified from source this session: 60 primary cause→fix refs + 39 alternate refs = **99 total**, all resolve; 41 profile→question refs, all resolve in the approved bank of 26 questions. (Phase 3.2.0's "54" was a counting subset; the schema test asserts ≥54 and 0 broken.)

### L–M. Test results (re-run this session)

| Suite | Result |
|---|---|
| `ai-api/test/schema.test.mjs` (new, §21) | **8 / 8 pass** — unique ids + all 74 accessible; cause→fix refs resolve (0 broken); profile question ids resolve; valid platforms/categories; difficulty/time well-formed; metadata types where present; completeness-or-REVIEW_QUEUE; worker↔browser router vocabulary drift check |
| `ai-api/test/validate.test.mjs` | **13 / 13 pass** |
| `ai-api/test/security.test.mjs` (Phase 3.1.1 hardening) | **23 / 23 pass** — incl. AI_ENABLED=false, prompt injection, system-prompt override rejection, rate limit, router scenarios |
| `ai-api/test/scenarios.mjs` | **4 / 4 pass** |
| **Total (M)** | **48 passed, 0 failed (L = 0)** |

### N. Router duplication status — RESOLVED

One canonical source: `classification-words.js`. Browser (`ai-knowledge.js`, with graceful fallback) and worker (`policy.js`) both consume it; `routerVocabulary()` exposes the worker's copy for testing. A dedicated drift test fails CI if the two ever diverge again. No parallel word lists remain.

### O–R. Metadata coverage (all 74/74, verified this session by grep + tests + browser probe)

| Field | Coverage | Detail |
|---|---|---|
| Verification (O) | **74 / 74** | specific per-fix checks rendered into Qwen context (`How to verify it worked:` confirmed in real Chrome output, ctx length 3067) |
| Risk classification (P) | **74 / 74** | low **52** / medium **20** / high **2** — the two highs: "Move your OS or games to an SSD" (cloning + shred, `reversible:false`) and "Know your BIOS settings" (UEFI changes). High-risk list re-confirmed in browser this session |
| Reversibility (Q) | **74 / 74** | boolean on every tip |
| Failure conditions (R) | **74 / 74** | present on every tip |

### S. Backward compatibility status — INTACT, verified

- All 74 tips render: real-Chrome probe of `windows.html` this session → 74 tips in data layer, all 74 with complete metadata, **58 cards rendered**, zero console/page errors.
- AI page intact (real Chrome, robust probe this session): `EmTechAIKnowledge`, `EmTechDiag.analyze()`, `EmTechAIPrompt.buildSystemPrompt()`, `window.EmTechAI` all present; `searchForSession()` returns 3 hits for "move windows to ssd"; classifier returns `{platform:"mac", category:"performance"}` for "my macbook is slow"; zero page errors.
- Worker module chain (index→policy→qwen→knowledge→validate) loads and passes its full test suites in Node.
- No API contract changes, no new environment variables, no frontend redesign, no duplicate KB or diagnosis engine.

### T. Security impact — NONE introduced; Phase 3.1.1 hardening intact

Changes are data-only metadata plus a shared vocabulary file consumed server-side and client-side. Fresh secret scan of the working tree this session: **no real secrets** (only an intentional fake-key fixture inside the sanitizer test, and slug false-positives like "di**sk-space**"). All 23 Phase 3.1.1 security tests still pass (server-owned system prompt, model/provider/endpoint lock-in, AI_ENABLED switch, rate limiting, no key fragments in logs).

### U. Deployment readiness — READY (not executed)

Per spec §26, **no deployment was performed**. Exact commands when you are ready:

```powershell
# 1) Worker (bundles tips-data.js via esbuild — metadata ships automatically; NO new env vars needed)
cd ai-api
npx wrangler deploy

# 2) Frontend (GitHub Pages auto-deploys on push to main)
git add -A
git commit -m "Phase 3.2.1: safety metadata schema (risk/reversible/verification/failure), canonical router vocabulary, data-quality tests"
git push origin main
```

Nothing in this phase requires new secrets or configuration.

### V. Remaining work (deferred by design)

- Knowledge base expansion (new fixes/categories — next content phase; spec §24 explicitly defers it).
- Next-best-question engine (architecture prepared via question bank + cause refs, not implemented per spec §13–14).
- Risk-based fix ordering in the recommendation layer (metadata is now available for it; spec §11 says make metadata available first).
- Evaluation benchmark set and feedback analytics (future phases).

---

## Verification evidence ledger

**Re-verified personally this session:** git state; 74/74 metadata counts + risk distribution; full test suite 48/48 (fresh runs); real-Chrome probes of `windows.html` and `ai.html` (including the safety-metadata-in-Qwen-context check); KB inventory re-counted from source (74 tips / 58+16 split / 21 profiles / 60 causes / 99 fix refs / 26 questions / 41 profile→question refs); secret scan; `tipSlug` id derivation + uniqueness.

**Verified by prior session (evidence retained, not re-run):** the migration run itself (`migrate321.mjs`, output "74/74 valid"); side-by-side no-fabrication review of all 74 metadata entries (`review321.txt`).

## Definition of Done (spec §28) — checklist

- [x] Existing 74 tips still work · [x] Diagnosis engine intact · [x] Frontend intact
- [x] Worker validation intact · [x] Qwen security architecture intact (23/23 security tests)
- [x] New metadata schema defined + validated · [x] No fabricated metadata
- [x] 0 broken cause→fix references (99 total) · [x] Verification/risk/reversibility/failure-condition metadata supported
- [x] Router vocabulary duplication resolved with drift test
- [x] Automated tests for new data structure (8/8) · [x] All existing tests pass (48/48 total)
- [x] No production deployment without explicit instruction
