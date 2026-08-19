/* ============================================================
   EmTech Media — Phase 2: fix-page feedback loop (windows.html / mac.html)

   When a diagnostic session is waiting on this exact fix, the generic
   "Did this fix it?" widget is replaced by a banner that routes the
   answer back into the engine (§20/§45/§46):

     Yes → mark solved, record history, show success card.
     No  → record the failed attempt, jump back to diagnose.html#continue
           where the engine asks the next question (or re-ranks).

   Loaded AFTER script.js so the accordion already exists in the DOM.
   Bails out silently when there is no active session or the fix isn't
   on this page — it never breaks a plain Phase 1 visit (§27).
   ============================================================ */
(function () {
  "use strict";

  const E = window.EmTechDiag;
  if (!E || !document.querySelector(".acc-item")) return; // not a fix page / engine missing

  /* Phase 1's per-tip feedback key — keep both widgets in sync so the
     generic widget shows the same answer on later visits. */
  const FEEDBACK_KEY = "emtech-feedback-v1";

  /* ---------- helpers (same conventions as diag-ui.js) ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  const TIPS_BY_SLUG = {};
  if (typeof TIPS !== "undefined" && typeof tipSlug === "function") {
    TIPS.forEach((t) => { TIPS_BY_SLUG[tipSlug(t.title)] = t; });
  }

  const deviceLabel = (id) => ((E.data.devices.find((d) => d.id === id) || {}).label || "");
  const categoryLabel = (id) => ((E.data.categories.find((c) => c.id === id) || {}).label || "");

  /* Only a session that is literally waiting on feedback for a fix. */
  function activeSession() {
    let s = null;
    try { s = E.store.loadSession(); } catch (err) { return null; }
    if (!s || s.status !== "awaiting-feedback" || !s.activeFix) return null;
    return s;
  }

  function writeFeedback(slug, val) {
    try {
      let all = {};
      try { all = JSON.parse(window.localStorage.getItem(FEEDBACK_KEY) || "{}") || {}; } catch (err) { all = {}; }
      all[slug] = val;
      window.localStorage.setItem(FEEDBACK_KEY, JSON.stringify(all));
    } catch (err) { /* private mode — the loop still works in-memory */ }
  }

  function bannerHtml(state, tip) {
    const where = [deviceLabel(state.device), categoryLabel(state.category)].filter(Boolean).join(" — ");
    return `
      <p class="dz-fb-kicker">From your diagnosis${where ? " · " + esc(where) : ""}</p>
      <p class="dz-fb-q" id="dz-fb-h">Did this fix work?</p>
      <div class="dz-fb-actions">
        <button class="btn btn-primary" type="button" data-fb="yes"><span aria-hidden="true">✓</span> Yes — it's fixed</button>
        <button class="btn" type="button" data-fb="no">No — continue troubleshooting</button>
      </div>
      <p class="dz-fb-alt"><a href="diagnose.html#continue">Return to your diagnosis →</a></p>`;
  }

  function solvedHtml(state, tip) {
    const what = [deviceLabel(state.device), categoryLabel(state.category)].filter(Boolean).join(" — ") || "Your problem";
    const fixName = tip ? esc(tip.title) : "the recommended fix";
    const time = tip && tip.time ? ` <small>(typically ${esc(tip.time)})</small>` : "";
    return `
      <p class="dz-fb-kicker">Diagnosis complete</p>
      <h3 id="dz-fb-h" tabindex="-1"><span aria-hidden="true">🎉</span> Problem solved!</h3>
      <p>Glad we could help.</p>
      <div class="dz-solved-card">
        <div class="dz-solved-row"><span>What we fixed</span><strong>${esc(what)}</strong></div>
        <div class="dz-solved-row"><span>Fix used</span><strong>${fixName}${time}</strong></div>
      </div>
      <div class="dz-fb-actions">
        <a class="btn btn-primary" href="index.html">Back to EmTech Media</a>
        <a class="btn-link" href="diagnose.html">Diagnose another problem</a>
      </div>`;
  }

  /* ---------- boot: find the fix this session is waiting on ---------- */
  const state = activeSession();
  if (!state) return;

  let item = null;
  try { item = document.querySelector('.acc-item[data-slug="' + CSS.escape(state.activeFix) + '"]'); } catch (err) { item = null; }
  if (!item) return; // this fix lives on the other OS page — nothing to do here

  const inner = item.querySelector(".acc-inner");
  if (!inner) return;

  /* Hide Phase 1's generic widget so the user isn't asked twice. */
  item.classList.add("dz-loop-active");

  const tip = TIPS_BY_SLUG[state.activeFix] || null;
  const box = document.createElement("div");
  box.className = "dz-fb";
  box.setAttribute("role", "region");
  box.setAttribute("aria-label", "Diagnosis feedback for this fix");
  box.innerHTML = bannerHtml(state, tip);
  inner.insertBefore(box, inner.firstChild);

  /* Make sure the user actually sees it (uses script.js' toggle so the
     aria-expanded / hidden state stays in sync). */
  if (!item.classList.contains("open")) {
    const head = item.querySelector(".acc-head");
    if (head) head.click();
  }

  box.addEventListener("click", (e) => {
    const yesBtn = e.target.closest('[data-fb="yes"]');
    const noBtn = e.target.closest('[data-fb="no"]');
    if (!yesBtn && !noBtn) return;

    if (yesBtn) {
      /* Same sequence as the engine's own solved path (§21). */
      E.markSolved(state);
      try { E.store.upsertHistory(state, { fix: state.activeFix, status: "solved" }); } catch (err) {}
      writeFeedback(state.activeFix, "yes");
      try { E.store.saveSession(state); } catch (err) {}
      E.trackEvent("fix_solved", { fix: state.activeFix });

      box.className = "dz-fb dz-fb-solved"; // success variant styling (style.css)
      box.setAttribute("aria-label", "Diagnosis solved");
      box.innerHTML = solvedHtml(state, tip);
      const h = box.querySelector("#dz-fb-h");
      if (h) h.focus({ preventScroll: true });
    } else {
      /* Record the attempt, then hand back to the engine — it asks the
         next question or re-ranks with this fix excluded (§20). */
      writeFeedback(state.activeFix, "no");
      try { E.afterFailedFix(state, state.activeFix); } catch (err) {}
      try { E.store.saveSession(state); } catch (err) {}
      E.trackEvent("fix_failed", { fix: state.activeFix });
      window.location.href = "diagnose.html#continue";
    }
  });
})();
