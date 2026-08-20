/* ============================================================
   EmTech Media — Phase 2 diagnostic UI (diagnose.html only)

   Renders screens from window.EmTechDiag state; never owns logic.
   Every user-supplied string passes through esc() before it is put
   into markup (§48). All persistence goes through EmTechDiag.store,
   so the fix pages' feedback banner stays in sync with this page.

   Screens: landing · device · category · description · question ·
            analyzing · result (success / insufficient / exhausted /
            no_match) · solved
   ============================================================ */

(function () {
  "use strict";

  const E = window.EmTechDiag;
  if (!E) return; // engine missing — page degrades to its static shell

  const stage = document.getElementById("diag-stage");
  if (!stage) return;

  const DATA = E.data;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const LEVELS = { 1: "Easy", 2: "Medium", 3: "Advanced" };

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  const TIPS_BY_SLUG = new Map(
    (typeof TIPS !== "undefined" ? TIPS : []).map((t) => [tipSlug(t.title), t])
  );
  function findTip(slug) { return TIPS_BY_SLUG.get(slug); }
  function tipHref(slug) {
    const t = findTip(slug);
    if (!t) return null;
    // Phase 4: canonical static fix page (windows/<slug>/ or mac/<slug>/).
    return (t.cat === "mac" ? "mac/" : "windows/") + esc(tipSlug(t.title)) + "/";
  }
  function platformLabel(tip) {
    if (!tip) return "";
    return tip.cat === "mac" ? "macOS" : (tip.win || "Windows");
  }

  const deviceLabel = (id) => ((DATA.devices.find((d) => d.id === id) || {}).label || "");
  const categoryLabel = (id) => ((DATA.categories.find((c) => c.id === id) || {}).label || "");

  function fmtRel(iso) {
    try {
      const then = new Date(iso).getTime();
      if (isNaN(then)) return "";
      const days = Math.floor((Date.now() - then) / 86400000);
      if (days <= 0) return "Today";
      if (days === 1) return "Yesterday";
      if (days < 30) return days + " days ago";
      const months = Math.floor(days / 30);
      return months === 1 ? "About a month ago" : months + " months ago";
    } catch (err) { return ""; }
  }

  function track(name, payload) { E.trackEvent(name, payload); }

  /* ---------- session lifecycle ---------- */
  let state = null;          // active diagnostic session
  let analyzingTimer = null; // pending auto-advance from the analysis screen

  function persist() { if (state) E.store.saveSession(state); }

  function clearTimers() {
    if (analyzingTimer) { clearTimeout(analyzingTimer); analyzingTimer = null; }
  }

  /* ---------- landing: resume + history ---------- */
  function activeSessionForLanding() {
    // A session is "active" until it's solved or abandoned — and only once the
    // user has actually started (device picked), so a blank fresh session never
    // shows an empty "continue where you left off" card.
    return state && state.device && ["in-progress", "result", "awaiting-feedback"].indexOf(state.status) !== -1 ? state : null;
  }

  function resumeCardHtml(active) {
    if (!active) return "";
    const dev = deviceLabel(active.device);
    const cat = categoryLabel(active.category);
    const where = [dev, cat].filter(Boolean).join(" · ");

    if (active.status === "awaiting-feedback" && active.activeFix) {
      const tip = findTip(active.activeFix);
      return `
        <div class="dz-resume">
          <p class="dz-resume-title"><span aria-hidden="true">↩</span> Still working on this?</p>
          <p class="dz-resume-sub">${where ? esc(where) + " — " : ""}You were checking <strong>${tip ? esc(tip.title) : "a fix"}</strong>.</p>
          <div class="dz-resume-actions">
            <button class="btn btn-primary" type="button" data-act="fb-yes"><span aria-hidden="true">✓</span> Yes — it's fixed</button>
            <button class="btn" type="button" data-act="fb-no">No, still broken</button>
          </div>
        </div>`;
    }

    return `
      <div class="dz-resume">
        <p class="dz-resume-title"><span aria-hidden="true">↩</span> Continue where you left off</p>
        <p class="dz-resume-sub">${esc(where || "Your diagnosis")} · ${esc(fmtRel(active.updatedAt) || "recently")}</p>
        <div class="dz-resume-actions">
          <button class="btn btn-primary" type="button" data-act="resume">Continue diagnosis</button>
          <button class="btn-link" type="button" data-act="restart-confirm">Start over</button>
        </div>
      </div>`;
  }

  function historyHtml() {
    let list = [];
    try { list = E.store.loadHistory(); } catch (err) { list = []; }
    if (!list.length) {
      return `
        <section class="dz-history" aria-label="Your recent troubleshooting">
          <h2>Your recent troubleshooting</h2>
          <p class="dz-history-empty">Your troubleshooting history will appear here after you run a diagnosis.</p>
        </section>`;
    }

    const rows = list.map((h) => {
      const dev = deviceLabel(h.device);
      const cat = categoryLabel(h.category);
      const title = [dev, cat].filter(Boolean).join(" — ") || "Diagnosis";
      let action = "";
      if (h.status === "solved" && h.fix) {
        const href = tipHref(h.fix);
        if (href) action = `<a class="dz-hist-act" href="${href}">View fix <span aria-hidden="true">→</span></a>`;
      } else if (h.snapshot) {
        action = `<button class="dz-hist-act dz-hist-btn" type="button" data-resume-id="${esc(h.id)}">Continue <span aria-hidden="true">→</span></button>`;
      }
      return `
        <li class="dz-hist-row">
          <div>
            <p class="dz-hist-title">${esc(title)}</p>
            ${h.description ? `<p class="dz-hist-desc">${esc(h.description)}…</p>` : ""}
            <p class="dz-hist-meta"><span class="dz-dot dz-dot-${h.status === "solved" ? "ok" : "open"}" aria-hidden="true"></span>${h.status === "solved" ? "Solved" : "Not solved yet"} · ${esc(fmtRel(h.date))}</p>
          </div>
          ${action}
        </li>`;
    }).join("");

    return `
      <section class="dz-history" aria-label="Your recent troubleshooting">
        <h2>Your recent troubleshooting</h2>
        <ul>${rows}</ul>
      </section>`;
  }

  function screenLanding() {
    const starters = DATA.starters.map((s, i) => `
      <button class="dz-chip" type="button" data-starter="${i}">${esc(s.label)}</button>`).join("");

    return `
      <div class="dz-screen dz-landing">
        <p class="kicker">EmTech Troubleshooter</p>
        <h1 id="dz-h1" tabindex="-1">What's wrong with your computer?</h1>
        <p class="dz-sub">Don't worry if you don't know the technical cause. Tell us what you're experiencing and we'll guide you through it — no jargon, no sign-up.</p>

        ${resumeCardHtml(activeSessionForLanding())}

        ${activeSessionForLanding()
          ? `<button class="btn dz-start" type="button" data-act="restart-confirm">Start a new diagnosis</button>`
          : `<button class="btn btn-primary dz-start" type="button" data-act="start">Start diagnosis <span aria-hidden="true">→</span></button>`}

        <div class="dz-starters" role="group" aria-label="Popular problems">
          <span class="dz-starters-label">Popular problems</span>
          <div class="dz-chips">${starters}</div>
        </div>

        ${historyHtml()}

        <p class="dz-fineprint">Runs entirely on this device — your answers never leave the browser.</p>
        <p class="dz-ai-alt">Prefer to just describe what's happening? <a href="ai.html">Try EmTech AI <span aria-hidden="true">↗</span></a></p>
      </div>`;
  }

  /* ---------- step screens ---------- */
  function screenDevice() {
    const cards = DATA.devices.map((d, i) => `
      <button class="dz-card" type="button" data-device="${esc(d.id)}">
        <span class="dz-card-num" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>
        <span class="dz-card-body"><strong>${esc(d.label)}</strong><small>${esc(d.sub)}</small></span>
        <span class="dz-card-go" aria-hidden="true">→</span>
      </button>`).join("");

    return `
      <div class="dz-screen dz-step">
        ${stepKicker("Step 1")}
        <h1 id="dz-h1" tabindex="-1">What are you using?</h1>
        <p class="dz-sub">We'll tailor the questions and fixes to your machine.</p>
        <div class="dz-cards" role="group" aria-label="Choose your device">${cards}</div>
        ${exitLine()}
      </div>`;
  }

  function screenCategory() {
    const cats = DATA.categories
      .filter((c) => c.platforms.indexOf(state.device) !== -1)
      .map((c, i) => `
      <button class="dz-cat" type="button" data-category="${esc(c.id)}">
        <span class="dz-cat-icon" aria-hidden="true">${esc(c.icon)}</span>
        <strong>${esc(c.label)}</strong>
      </button>`).join("");

    return `
      <div class="dz-screen dz-step">
        ${stepKicker("Step 2 · " + deviceLabel(state.device))}
        <h1 id="dz-h1" tabindex="-1">What seems to be wrong?</h1>
        <p class="dz-sub">Pick the closest match — you can describe it in your own words next.</p>
        <div class="dz-catgrid" role="group" aria-label="Choose a problem area">${cats}</div>
        ${backLine("device")}
      </div>`;
  }

  function screenDescription() {
    const isSearch = state.category === "something-else";
    return `
      <div class="dz-screen dz-step">
        ${stepKicker("Step 3 · " + deviceLabel(state.device) + (state.category ? " — " + categoryLabel(state.category) : ""))}
        <h1 id="dz-h1" tabindex="-1">${isSearch ? "Tell us what's happening" : "Anything else we should know?"}</h1>
        <p class="dz-sub">${isSearch
          ? "Describe it in your own words — we'll search every fix in the library."
          : 'Optional, but helpful. Example: "My laptop has become very slow over the last few days."'}</p>

        <label class="dz-field-label" for="dz-desc">Describe the problem</label>
        <textarea id="dz-desc" rows="4" maxlength="${E.limits.descriptionMax}"
          placeholder="Describe the problem in your own words…"
          ${state.description ? "" : "autofocus"}></textarea>

        <div class="dz-actions">
          ${backLine("category")}
          <span class="dz-actions-right">
            <button class="btn btn-primary" type="button" id="dz-desc-next" ${isSearch && !state.description ? "disabled" : ""}>${isSearch ? "Find fixes →" : "Continue →"}</button>
            ${isSearch ? "" : `<button class="btn-link dz-skip" type="button">I'd rather choose from a list</button>`}
          </span>
        </div>
      </div>`;
  }

  function screenQuestion(q, n) {
    const opts = q.options.map((o) => `
      <button class="dz-opt" type="button" data-value="${esc(o.value)}" aria-pressed="false">
        <span class="dz-opt-dot" aria-hidden="true"></span>${esc(o.label)}
      </button>`).join("");

    return `
      <div class="dz-screen dz-step">
        ${stepKicker("Diagnosing your " + deviceLabel(state.device) + (state.category ? " · " + categoryLabel(state.category) : "") + " · Question " + n)}
        <h1 id="dz-h1" tabindex="-1">${esc(q.q)}</h1>
        ${q.desc ? `<p class="dz-sub">${esc(q.desc)}</p>` : ""}
        <div class="dz-opts" role="group" aria-label="${esc(q.q)}">${opts}</div>
        <div class="dz-actions">
          ${backLine("question")}
          <span class="dz-actions-right"><button class="btn btn-primary" type="button" id="dz-q-next" disabled>Continue →</button></span>
        </div>
        ${exitLine()}
      </div>`;
  }

  function screenAnalyzing() {
    const steps = ["Device type", "Your answers", "Matching fixes in the library"];
    return `
      <div class="dz-screen dz-step">
        ${stepKicker("Diagnosing your " + deviceLabel(state.device))}
        <h1 id="dz-h1" tabindex="-1">Analyzing your problem…</h1>
        <ul class="dz-checklist" role="status" aria-live="polite">
          ${steps.map((s) => `<li data-step><span class="dz-check-mark" aria-hidden="true"></span>${esc(s)}</li>`).join("")}
        </ul>
        <p class="dz-analyze-done" hidden>We've narrowed it down.</p>
      </div>`;
  }

  /* ---------- result screens ---------- */
  function confBadge(conf) {
    if (conf === "high") return `<p class="dz-conf dz-conf-high"><span aria-hidden="true">●</span> High confidence — most likely cause</p>`;
    if (conf === "medium") return `<p class="dz-conf dz-conf-med"><span aria-hidden="true">●</span> Possible cause — worth checking first</p>`;
    return "";
  }

  function fixCardHtml(slug, cta) {
    const tip = findTip(slug);
    if (!tip) return "";
    const href = tipHref(slug);
    if (!href) return "";
    return `
      <div class="dz-fixcard">
        <p class="dz-fixcard-kicker">${esc(platformLabel(tip))} · ${LEVELS[tip.difficulty] || ""} · ⏱ ${esc(tip.time)}</p>
        <h3>${esc(tip.title)}</h3>
        <p class="dz-fixcard-desc">${esc(tip.description)}</p>
        <a class="btn btn-primary" href="${href}" data-act="openfix" data-slug="${esc(slug)}">${cta || "Start Fix"} <span aria-hidden="true">→</span></a>
      </div>`;
  }

  function altListHtml(slugs, heading) {
    const rows = (slugs || [])
      .map((slug) => {
        const tip = findTip(slug);
        if (!tip) return "";
        const href = tipHref(slug);
        if (!href) return "";
        return `
          <li>
            <a class="dz-alt" href="${href}" data-act="openfix" data-slug="${esc(slug)}">
              <span class="dz-alt-title">${esc(tip.title)}</span>
              <span class="dz-alt-meta">${esc(platformLabel(tip))} · ${LEVELS[tip.difficulty] || ""} · ⏱ ${esc(tip.time)}</span>
            </a>
          </li>`;
      })
      .join("");
    if (!rows) return "";
    return `
      <section class="dz-alts">
        <h2>${esc(heading || "Other things worth checking")}</h2>
        <ul>${rows}</ul>
      </section>`;
  }

  function resultActionsHtml() {
    return `
      <div class="dz-result-actions">
        <button class="btn-link" type="button" data-act="restart-confirm">Start over</button>
        <a class="btn-link" href="index.html">Back to EmTech Media</a>
      </div>`;
  }

  function screenResult(res) {
    /* --- success: profile diagnosis or search match --- */
    if (res.status === "success") {
      const isSearch = res.mode === "search";
      let head, body = "";

      if (!isSearch && res.primary) {
        head = res.confidence === "high" ? "We found a likely cause" : "A possible cause";
        body = `<p class="dz-cause">${esc(res.primary.label)}</p>`;
      } else if (res.recommendedFix) {
        head = isSearch ? "A likely match in the library" : "We found a likely cause";
      } else {
        head = isSearch ? "Some potentially relevant fixes" : "Things worth checking";
      }

      const reasons = (res.reasons || []).length
        ? `<section class="dz-why"><h2>Why we think this</h2><ul>${res.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></section>`
        : "";

      return `
        <div class="dz-screen dz-step">
          ${stepKicker("Diagnosis complete")}
          <h1 id="dz-h1" tabindex="-1">${esc(head)}</h1>
          ${confBadge(res.confidence)}
          ${body}
          ${reasons}
          ${res.recommendedFix ? `<section class="dz-reco"><h2>${isSearch && res.confidence !== "high" ? "Start with this one" : "Recommended fix"}</h2>${fixCardHtml(res.recommendedFix, isSearch ? "View this fix" : "Start Fix")}</section>` : ""}
          ${altListHtml(res.alternativeFixes)}
          <p class="dz-honest">This is a best guess from your answers — not a certainty. If it doesn't work, tell us and we'll go deeper.</p>
          ${resultActionsHtml()}
        </div>`;
    }

    /* --- insufficient: need more signal (§22) --- */
    if (res.status === "insufficient") {
      return `
        <div class="dz-screen dz-step">
          ${stepKicker("Diagnosis")}
          <h1 id="dz-h1" tabindex="-1">We need a little more information.</h1>
          <p class="dz-sub">We couldn't narrow this down enough from the answers so far. That's normal — one or two extra details usually does it.</p>
          ${altListHtml(res.alternativeFixes, "While you're here, these are the closest fixes")}
          <div class="dz-result-actions dz-result-actions-col">
            <button class="btn btn-primary" type="button" data-act="more-info">Answer a few more questions</button>
            <button class="btn-link" type="button" data-act="restart-confirm">Start a new diagnosis</button>
          </div>
        </div>`;
    }

    /* --- exhausted: every fix in this profile was tried (§20) --- */
    if (res.status === "exhausted") {
      const all = (res.alternativeFixes || []).map((slug) => {
        const tip = findTip(slug);
        if (!tip) return "";
        const href = tipHref(slug);
        const tried = state.triedFixes.indexOf(slug) !== -1;
        return `
          <li>
            ${href ? `<a class="dz-alt" href="${href}"><span class="dz-alt-title">${esc(tip.title)}</span><span class="dz-alt-meta">${tried ? "Tried — worth a second look" : esc(platformLabel(tip)) + " · ⏱ " + esc(tip.time)}</span></a>` : `<span class="dz-alt"><span class="dz-alt-title">${esc(tip.title)}</span></span>`}
          </li>`;
      }).join("");

      const browseHref = state.device === "mac" ? "mac/" : "windows/";
      return `
        <div class="dz-screen dz-step">
          ${stepKicker("Diagnosis complete")}
          <h1 id="dz-h1" tabindex="-1">We've covered the main possibilities.</h1>
          <p class="dz-sub">You've tried every fix we have for this on a ${esc(deviceLabel(state.device))}. Here's the full set — one may still help, or it's time to look at a different angle.</p>
          <section class="dz-alts"><h2>All fixes in this area</h2><ul>${all}</ul></section>
          <div class="dz-result-actions dz-result-actions-col">
            <a class="btn btn-primary" href="${browseHref}">Browse all ${state.device === "mac" ? "Mac" : "Windows"} fixes <span aria-hidden="true">→</span></a>
            <button class="btn-link" type="button" data-act="change-category">Try a different category</button>
            <button class="btn-link" type="button" data-act="restart-confirm">Start over</button>
          </div>
        </div>`;
    }

    /* --- no_match (§23) --- */
    return `
      <div class="dz-screen dz-step">
        ${stepKicker("Diagnosis")}
        <h1 id="dz-h1" tabindex="-1">We couldn't find a close match.</h1>
        <p class="dz-sub">That's okay. Try describing it differently — e.g. "my laptop is overheating" instead of "computer broken" — or browse the full library.</p>
        <div class="dz-result-actions dz-result-actions-col">
          <a class="btn btn-primary" href="${state.device === "mac" ? "mac/" : "windows/"}">Browse all fixes <span aria-hidden="true">→</span></a>
          <button class="btn-link" type="button" data-act="retry-description">Try again with different words</button>
          <button class="btn-link" type="button" data-act="restart-confirm">Start over</button>
        </div>
      </div>`;
  }

  function screenSolved() {
    const cat = categoryLabel(state.category);
    let fixLine = "";
    if (state.activeFix) {
      const tip = findTip(state.activeFix);
      if (tip) fixLine = `<div class="dz-solved-row"><span>Fix used</span><strong>${esc(tip.title)} <small>(typically ${esc(tip.time)})</small></strong></div>`;
    }
    return `
      <div class="dz-screen dz-step">
        ${stepKicker("Diagnosis complete")}
        <h1 id="dz-h1" tabindex="-1"><span aria-hidden="true">🎉</span> Problem solved!</h1>
        <p class="dz-sub">Glad we could help.</p>
        <div class="dz-solved-card">
          ${cat ? `<div class="dz-solved-row"><span>What we fixed</span><strong>${esc(cat)}</strong></div>` : ""}
          ${fixLine}
        </div>
        <div class="dz-result-actions dz-result-actions-col">
          <a class="btn btn-primary" href="index.html">Back to EmTech Media <span aria-hidden="true">→</span></a>
          <button class="btn-link" type="button" data-act="restart">Diagnose another problem</button>
        </div>
      </div>`;
  }

  /* ---------- shared bits ---------- */
  function stepKicker(text) {
    return `<p class="kicker dz-kicker">${esc(text)}</p>`;
  }
  function backLine(target) {
    return `<a class="btn-link dz-back" href="#" data-act="back" data-target="${target}">← Back</a>`;
  }
  function exitLine() {
    return `<p class="dz-exit"><button class="btn-link" type="button" data-act="exit-confirm">Exit diagnosis</button></p>`;
  }

  /* ---------- render + focus ---------- */
  function render(html) {
    clearTimers();
    stage.innerHTML = html;
    const h1 = document.getElementById("dz-h1");
    if (h1) h1.focus({ preventScroll: true });
  }

  function renderScreen(name, extra) {
    switch (name) {
      case "device": return render(screenDevice());
      case "category": return render(screenCategory());
      case "description": {
        const html = screenDescription();
        render(html);
        const ta = document.getElementById("dz-desc");
        if (ta && state.description) ta.value = state.description; // restore draft on re-entry
        return;
      }
      case "question": {
        const q = E.nextQuestion(state);
        if (!q) return renderResult(); // defensive: nothing left to ask
        return render(screenQuestion(q, state.askedOrder.length + 1));
      }
      case "result": return runAnalysis();
      default: return renderLanding();
    }
  }

  function renderLanding() {
    render(screenLanding());
  }

  /* ---------- analysis flow (analyzing screen → result) ---------- */
  function runAnalysis() {
    const res = E.analyze(state);
    state.result = res;
    if (res.status === "success" || res.status === "insufficient") {
      // Record the outcome for history + feedback loop.
      E.store.upsertHistory(state, { fix: res.recommendedFix || null });
    }
    persist();
    track("diagnosis_completed", { status: res.status, confidence: res.confidence || null });

    if (prefersReducedMotion) { renderResult(res); return; }

    render(screenAnalyzing());
    const items = stage.querySelectorAll(".dz-checklist li");
    let i = 0;
    const stepMs = 320;
    const tick = () => {
      if (i < items.length) {
        items[i].classList.add("done");
        i += 1;
        analyzingTimer = setTimeout(tick, stepMs);
      } else {
        const done = stage.querySelector(".dz-analyze-done");
        if (done) done.hidden = false;
        analyzingTimer = setTimeout(() => renderResult(res), 420);
      }
    };
    tick();
  }

  function renderResult(res) {
    res = res || state.result || E.analyze(state);
    if (state.status === "solved") return render(screenSolved());
    render(screenResult(res));
  }

  /* ---------- actions (delegated on #diag-stage) ---------- */
  function startFresh(preselect, opts) {
    state = E.newSession(preselect || null);
    persist();
    track("diagnosis_started", preselect ? { device: preselect.device || null, category: preselect.category || null } : {});
    renderScreen(E.currentScreen(state));
  }

  function resumeFromHistory(id) {
    let list = [];
    try { list = E.store.loadHistory(); } catch (err) { list = []; }
    const entry = list.find((h) => h.id === id && h.snapshot);
    if (!entry) return;
    state = entry.snapshot; // already validated by the store
    persist();
    track("diagnosis_resumed", {});
    renderScreen(E.currentScreen(state));
  }

  function handleBack(target) {
    if (target === "question") {
      if (state.askedOrder.length <= 1) {
        // Back from the first question → re-edit the description step
        // (its text is preserved; Continue will ask Q1 again).
        if (state.askedOrder.length === 1) E.goBack(state); // drop Q1's answer
        persist();
        renderScreen("description");
        return;
      }
      E.goBack(state);
      persist();
      renderScreen(E.currentScreen(state));
      return;
    }
    if (target === "device") {
      // Back from the category step → re-pick the device. Nothing else has
      // been recorded yet, so a fresh session is exactly equivalent.
      state = E.newSession(null);
      persist();
      renderScreen("device");
      return;
    }
    // target === "category": engine drops the description step (§13).
    E.goBack(state);
    persist();
    renderScreen(E.currentScreen(state));
  }

  function confirmPanel(message, onConfirmAct) {
    // Inline confirmation (no window.confirm — keeps the flow in-page).
    const wrap = document.createElement("div");
    wrap.className = "dz-confirm";
    wrap.setAttribute("role", "alertdialog");
    wrap.setAttribute("aria-modal", "false");
    wrap.innerHTML = `
      <p>${esc(message)}</p>
      <div class="dz-confirm-actions">
        <button class="btn" type="button" data-cf="stay">Continue diagnosis</button>
        <button class="btn btn-primary dz-confirm-danger" type="button" data-cf="go">Exit</button>
      </div>`;
    stage.appendChild(wrap);

    const stay = wrap.querySelector('[data-cf="stay"]');
    const go = wrap.querySelector('[data-cf="go"]');
    stay.addEventListener("click", () => {
      wrap.remove();
      const h1 = document.getElementById("dz-h1");
      if (h1) h1.focus({ preventScroll: true });
    });
    go.addEventListener("click", () => { wrap.remove(); onConfirmAct(); });
    wrap.addEventListener("keydown", (e) => { if (e.key === "Escape") { wrap.remove(); } });
    stay.focus({ preventScroll: true }); // never pre-focus the destructive action
  }

  function doExit() {
    if (state) E.abandon(state);
    track("diagnosis_abandoned", {});
    state = null;
    E.store.clearSession();
    renderLanding();
  }

  stage.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act], [data-device], [data-category], [data-starter], [data-value], .dz-hist-btn");
    if (!el || !stage.contains(el)) return;

    /* --- starters: jump straight into the relevant flow (§3) --- */
    const starterIdx = el.getAttribute("data-starter");
    if (starterIdx !== null) {
      e.preventDefault();
      const s = DATA.starters[Number(starterIdx)];
      if (!s) return;
      // Starters preselect device+category → startFresh lands on the
      // description step directly (§3: immediately start the flow).
      startFresh({ device: s.device || null, category: s.category || null });
      track("starter_selected", { label: s.label });
      return;
    }

    /* --- device cards --- */
    const devId = el.getAttribute("data-device");
    if (devId) {
      e.preventDefault();
      const r = E.selectDevice(state, devId);
      if (!r.ok) return;
      persist();
      track("device_selected", { device: devId });
      renderScreen(E.currentScreen(state));
      return;
    }

    /* --- category cards --- */
    const catId = el.getAttribute("data-category");
    if (catId) {
      e.preventDefault();
      const r = E.selectCategory(state, catId);
      if (!r.ok) return;
      persist();
      track("category_selected", { category: catId });
      renderScreen(E.currentScreen(state));
      return;
    }

    /* --- question options: select (Continue advances) --- */
    const optVal = el.getAttribute("data-value");
    if (optVal !== null && el.classList.contains("dz-opt")) {
      stage.querySelectorAll(".dz-opt").forEach((b) => b.setAttribute("aria-pressed", "false"));
      el.setAttribute("aria-pressed", "true");
      const next = document.getElementById("dz-q-next");
      if (next) next.disabled = false;
      return;
    }

    /* --- history: continue an open session --- */
    const resumeId = el.getAttribute("data-resume-id");
    if (resumeId) { e.preventDefault(); resumeFromHistory(resumeId); return; }

    switch (el.dataset.act) {
      case "back": {
        e.preventDefault();
        handleBack(el.dataset.target || "question");
        break;
      }

      case "fb-yes": {
        const fix = state.activeFix;
        E.markSolved(state);
        if (fix) E.store.upsertHistory(state, { fix: fix, status: "solved" });
        persist();
        track("fix_solved", { fix: fix || null });
        render(screenSolved());
        break;
      }

      case "fb-no": {
        const fix = state.activeFix;
        track("fix_failed", { fix: fix || null });
        const out = E.afterFailedFix(state, fix);
        persist();
        if (out.status === "continue") renderScreen("question");
        else runAnalysis();
        break;
      }

      case "resume": {
        track("diagnosis_resumed", {});
        renderScreen(E.currentScreen(state));
        break;
      }

      case "restart-confirm": {
        e.preventDefault();
        confirmPanel("Start over? Your current diagnosis progress will be lost.", () => startFresh(null));
        break;
      }

      case "exit-confirm": {
        e.preventDefault();
        confirmPanel("Leave diagnosis? Your progress will be lost.", doExit);
        break;
      }

      case "start": {
        startFresh(null); // landing CTA → device step (§3)
        break;
      }

      case "restart": {
        startFresh(null);
        break;
      }

      case "more-info": {
        // Re-open the description step for extra detail (re-scores keywords),
        // or continue asking if questions remain.
        const q = E.nextQuestion(state);
        if (q) renderScreen("question");
        else {
          state.descSkipped = false;
          state.description = "";
          persist();
          renderScreen("description");
        }
        break;
      }

      case "change-category": {
        state.category = null;
        state.description = "";
        state.descSkipped = false;
        state.answers = {};
        state.askedOrder = [];
        state.triedFixes = [];
        state.round = 1;
        state.status = "in-progress";
        state.result = null;
        persist();
        renderScreen("category");
        break;
      }

      case "retry-description": {
        state.description = "";
        state.descSkipped = false;
        persist();
        renderScreen("description");
        break;
      }

      default:
        break;
    }
  });

  /* Buttons that are identified by id (Continue on description/question). */
  stage.addEventListener("click", (e) => {
    const btn = e.target.closest("#dz-desc-next, #dz-q-next");
    if (!btn || !stage.contains(btn)) return;
    e.preventDefault();

    if (btn.id === "dz-desc-next") {
      const ta = document.getElementById("dz-desc");
      const text = ta ? ta.value.trim() : "";
      if (text) {
        E.setDescription(state, text);
        track("description_entered", {});
      } else {
        // Empty → treat as "I'd rather choose from a list".
        E.skipDescription(state);
      }
      persist();
      renderScreen(E.currentScreen(state));
      return;
    }

    if (btn.id === "dz-q-next") {
      const sel = stage.querySelector('.dz-opt[aria-pressed="true"]');
      if (!sel) return;
      const q = E.nextQuestion(state);
      if (!q) return;
      const r = E.answer(state, q.id, sel.dataset.value);
      if (!r.ok) return;
      persist();
      track("question_answered", { question: q.id });
      renderScreen(E.currentScreen(state));
    }
  });

  /* "I'd rather choose from a list" */
  stage.addEventListener("click", (e) => {
    const btn = e.target.closest(".dz-skip");
    if (!btn || !stage.contains(btn)) return;
    e.preventDefault();
    E.skipDescription(state);
    persist();
    renderScreen(E.currentScreen(state));
  });

  /* "Something else" requires a description — enable Continue as they type. */
  stage.addEventListener("input", (e) => {
    const ta = e.target.closest && e.target.closest("#dz-desc");
    if (!ta || !stage.contains(ta)) return;
    const next = document.getElementById("dz-desc-next");
    if (next && state.category === "something-else") {
      next.disabled = !ta.value.trim();
    }
  });

  /* Opening a fix: record the awaiting-feedback state BEFORE navigating,
     so the fix page's banner can pick it up (§20/§45/§46). */
  stage.addEventListener("click", (e) => {
    const link = e.target.closest('[data-act="openfix"]');
    if (!link || !stage.contains(link)) return;
    const slug = link.dataset.slug;
    E.openFix(state, slug);
    persist();
    track("fix_recommended", { fix: slug });
    track("fix_opened", { fix: slug });
    /* let the anchor navigate naturally */
  }, true);

  /* ---------- boot ---------- */
  function boot() {
    const saved = E.store.loadSession();
    if (saved && ["in-progress", "result", "awaiting-feedback"].indexOf(saved.status) !== -1) {
      state = saved; // resume across refreshes (§6/§47)
      if (location.hash === "#continue") {
        renderScreen(E.currentScreen(state)); // jump straight back into the flow from a fix page
      } else {
        renderLanding(); // landing shows the continue card + history
      }
      return;
    }
    // Terminal sessions (solved / abandoned) live on in the history list —
    // a fresh visit starts from the landing screen.
    state = E.newSession(null);
    renderLanding(); // don't persist a blank session — it would look resumable on other pages
  }

  boot();
})();
