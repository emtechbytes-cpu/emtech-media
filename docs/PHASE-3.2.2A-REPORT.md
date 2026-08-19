# EmTech Media — Phase 3.2.2A Report

**Windows P0 troubleshooting knowledge expansion**
Date: 2026-08-19 · Status: **IMPLEMENTED + TESTED + BROWSER-VERIFIED — NOT COMMITTED, NOT DEPLOYED** (awaiting explicit deployment approval per spec §29)

Baseline before this phase (Phase 3.2.1, deployed): 74 tips · 60 causes · 26 questions · 99 cause→fix references · 48/48 tests passing.
After this phase: **80 tips · 69 causes · 29 questions · 116 cause→fix references (0 broken) · 57/57 tests passing.**

---

## A. P0 areas audited

All 20 candidate P0 areas from the spec were verified against the actual knowledge base
(tips-data.js, diag-data.js profiles/causes/questions, ai-knowledge.js search, classification-words.js):

1. PC won't turn on · 2. Won't boot · 3. Stuck loading · 4. Black screen · 5. Blue screen ·
6. Extremely slow · 7. Freezing · 8. High CPU · 9. High RAM · 10. Low storage ·
11. Disk problems · 12. Windows Update · 13. Wi-Fi not working · 14. Connected but no internet ·
15. Bluetooth · 16. Audio · 17. Microphone · 18. External monitor · 19. Screen/display · 20. Keyboard/mouse/USB

## B. P0 areas already covered (no change)

- **Won't boot / stuck loading** — `fix-a-pc-that-won-t-start-up` + `win-crash-boot` cause; regression-tested via the new `crash-power=partway` branch.
- **Blue screen** — `fix-a-blue-screen-bsod-without-panicking` + `win-crash-bsod`.
- **Extremely slow / high CPU / high RAM** — performance profile + `hunt-down-memory-hogs`, `disable-startup-bloat`, `switch-the-power-plan-to-best-performance`; RAM upgrade path via `win-hw-ram`.
- **Freezing** — `crash-what=frozen` → `win-corrupt-files` branch (existing).
- **Low storage basics** — win-storage profile: temp files, Storage Sense, unused apps, deleted-file recovery.
- **Windows Update** — updates profile + `stop-windows-updates-at-odd-hours`.
- **Audio / microphone** — `no-sound-the-four-minute-fix`, `fix-a-microphone-no-one-can-hear` (audio profile).

## C. P0 areas partially covered → EXTENDED (no duplicate fixes)

| Area | What existed | What was added |
|---|---|---|
| PC won't turn on | boot-failure fix only | `win-crash-power` cause + new power-check tip + decisive first question `crash-power` |
| Black screen / display | driver-update tip only | `win-crash-signal`, `win-crash-gpu` causes + signal-path tip + conditional `crash-screen` question (showIf) |
| Disk problems | disk-health tip, no "failing drive" branch | `win-store-fail` cause → existing disk-health tip + `store-what=failing` option |
| Wi-Fi not working | sleep-glitch / slow / router tips only | `win-net-off` cause + new three-switches tip + decisive first question `net-state` |
| Keyboard/mouse/USB | printer/mic/webcam device branch only | `win-hw-usb` cause + new Device Manager tip + `hw-what=usb` option |

## D. P0 areas newly implemented (were missing entirely)

- **Connected but no internet** — `win-net-dns` cause + new safe DNS/stack-reset tip (`net-state=connected-nointernet`).
- **Bluetooth not working** — `win-hw-bt` cause + new pairing-reset tip (`hw-what=bluetooth`).
- **External monitor not detected** — `win-hw-monitor` cause (`hw-what=monitor`) sharing the signal-path fix (one tip, two entry points — matches existing data pattern).

## E. Number of new tips: **6**

1. PC won't turn on? Run the five-minute power check *(maintenance, low)*
2. Black screen? Check the display signal path first *(maintenance, low)*
3. Wi-Fi off or missing? The three switches that disable it *(windows, low)*
4. Connected but no internet? The safe DNS and stack reset *(maintenance, medium)*
5. Bluetooth won't connect? The pairing reset that works *(windows, low)*
6. USB device not recognised? The Device Manager pass *(windows, medium)*

All six carry the full Phase 3.2.1 metadata set (risk_level, reversible, verification, failure_conditions) with concrete, problem-specific verification and failure conditions — no fabricated fields, nothing deferred to a review queue.

## F. Number of existing tips modified: **0**

Verified by the new `ORIGINAL_74` regression guard in schema.test.mjs: all 74 pre-existing fix ids (slugs) still resolve; titles/steps untouched (git diff shows additions only).

## G. Number of new causes: **9**

`win-crash-power`, `win-crash-signal`, `win-crash-gpu`, `win-net-off`, `win-net-dns`,
`win-hw-bt`, `win-hw-monitor`, `win-hw-usb`, `win-store-fail`. All globally unique (tested).

## H. Number of new questions: **3** (+ 4 options on existing questions)

New: `crash-power` (first in win-crashes), `crash-screen` (conditional via showIf crash-power=black),
`net-state` (first in win-network).
Extended existing: `hw-what` + bluetooth/monitor/usb, `store-what` + failing.
All integrate into the existing scoring model; option scores follow the established ≥3 = medium-confidence pattern.

## I. Number of new diagnostic profiles: **0**

Every pathway fits the existing win-crashes / win-network / win-hardware / win-storage profiles — spec §17 respected, no engine redesign.

## J. New cause→fix relationships: **+17** (99 → 116 total, 0 broken)

Measured against HEAD via git stash comparison. Includes primary fixes + alt references
(e.g. `win-crash-power` alt → existing boot fix; `win-store-fail` alt → 3-2-1 backup tip).

## K. Duplicate fixes prevented

- No second "low storage" / "slow internet" / "boot failure" tip — new causes point at the best existing tip where one already solved the problem (GPU/driver → driver-update; failing drive → disk-health; boot → won't-start-up).
- External-monitor entry reuses the signal-path fix instead of a near-duplicate.

## L. Duplicate questions prevented

Peripheral and storage branches extended `hw-what` / `store-what` with options rather than new questions; only genuinely new decision points got new questions (power state, monitor output, Wi-Fi state).

## M. Verification coverage: **80/80 tips** have a specific verification step (6/6 new ones problem-specific, e.g. "reconnect the device and confirm it stays connected for at least five minutes").

## N. Failure-condition coverage: **80/80 tips** define what failure looks like + next action (e.g. signal-path tip → "move to driver updates before considering hardware replacement").

## O. Risk distribution (all 80): low **56** · medium **22** · high **2**.
New tips: 4 low, 2 medium, 0 high — deliberately safe-first ordering per spec §13.

## P. High-risk fixes (unchanged from baseline)

- Move your OS or games to an SSD *(data-destructive if done wrong; carries warnings in its steps)*
- Know your BIOS settings (the 5 that matter)

No new high-risk fix was introduced this phase.

## Q. Test results — **57 passed / 0 failed** (fresh runs, 2026-08-19)

| Suite | Result |
|---|---|
| `node --test ai-api/test/schema.test.mjs` | **9/9 pass** (baseline bumped 74→80 + new ORIGINAL_74 regression guard) |
| `node --test ai-api/test/p322a-paths.test.mjs` *(new)* | **8/8 pass** — router phrases, question order, showIf gating, all 10 pathway resolutions, platform guard (data + engine), failed-fix progression, exhaustion, data integrity |
| `node --test ai-api/test/validate.test.mjs` | **13/13 pass** |
| `node --test ai-api/test/security.test.mjs` | **23/23 pass** |
| `node ai-api/test/scenarios.mjs` | **4/4 pass** (all 32 classification scenarios still route correctly with the new router words) |

## R. Browser results — real headless Chrome via CDP, zero console/page errors on both pages

- **windows.html**: 80 tips in data · **64 Windows-side cards rendered** · all 6 new tips present as DOM cards (`.acc-item[data-slug=…]`) with deep-link anchors working · 80/80 carry full safety metadata.
- **ai.html**: classifier routes "won't turn on" → windows/crashes and "bluetooth won't connect" → windows/hardware; `searchForSession` finds the new black-screen and Wi-Fi tips; `buildKnowledgeContext` carries their risk + verification metadata into the Qwen context; full deterministic engine flow (black screen → no signal) resolves in-browser to the approved fix with medium confidence.

## S. Security regression results — **intact**

- security.test.mjs 23/23 and validate.test.mjs 13/13 pass unchanged: server-owned system prompt, AI_ENABLED switch, rate limiting, daily ceiling, fix/question/platform validation all still enforced.
- No worker code was modified (knowledge.js / policy.js / validate.js are fully data-driven). The worker's approved question set now automatically includes the 3 new questions (verified: 29 approved ids), and invented fix/question ids are still rejected because validation runs against the same tips-data/diag-data files.
- Phase 3.1.1 guarantees (no API-key logging, no browser model/provider/endpoint selection) untouched — zero changes under ai-api/src/.

## T. Files modified (7)

`tips-data.js` (+6 tips), `diag-data.js` (+9 causes, +3 questions, +4 options, question order in 2 profiles),
`classification-words.js` (v1.0.0→1.1.0, +8 precise router phrases), `ai-api/test/schema.test.mjs` (baseline + regression guard),
`index.html`, `windows.html`, `mac.html` (hardcoded no-JS fallback counts 74→80 / 58→64).

## U. Files added (2)

`ai-api/test/p322a-paths.test.mjs` (new pathway test suite), `docs/PHASE-3.2.2A-REPORT.md` (this report).

## V. Deployment status: **NOT DEPLOYED, NOT COMMITTED** — working tree holds the full change set; awaiting explicit approval per spec §29.

## W. Remaining P0 gaps (honest list)

- **Windows Update failing/stuck**: tips + updates profile exist, but no dedicated "update keeps failing" diagnostic branch (reinstall/repair path).
- **Freezing/hangs on Windows**: routed via crash-what=frozen → corrupt-files; a dedicated hang/freeze cause with its own safe-first fix is still thin.
- **High CPU / high RAM**: covered by tips, but no profile question that distinguishes "one app" vs "system-wide" load.
- **Keyboard-specific** (key repeat, ghost keys) folds into the USB/peripheral branch; acceptable for P0, candidate for P1.

## X. Recommended next phase

**Phase 3.2.2B — Windows Update + freezing/hangs diagnostic branches (P0 completion), then macOS P1 expansion.**
Alternatively, start the next-best-question metadata work (affected_causes per question) now that all new questions are structured for it. Either way: commit + deploy this phase first so the 80-tip baseline is live and regression-guarded in production.

---

### Deployment commands (for when approved — NOT executed)

```bash
# frontend (GitHub Pages, auto on push to main):
git add -A && git commit -m "Phase 3.2.2A: Windows P0 diagnostic pathways"
git push origin main

# worker (no code changes this phase; redeploy only if you want the new data bundled now — it is already served from the same files at bundle time):
cd ai-api && npx wrangler deploy
```
