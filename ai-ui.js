/* ============================================================
   EmTech Media — Phase 3 AI UI (DOM only)

   Renders turns from window.EmTechAI into #ai-thread and keeps the
   diagnosis panel (#ai-panel-body) in sync. All user/model text is
   escaped before insertion (§48). No business logic lives here —
   state, validation and fallback all belong to ai-engine.js.

   Message types rendered: intro · user · AI question (option cards) ·
   recommendation (fix card + feedback row) · resolved (success + stars
   + summary report) · safety warning · insufficient info · unsupported ·
   unavailable/error · cancelled (§30).
   ============================================================ */
(function () {
  "use strict";

  const E = window.EmTechAI;
  if (!E) return; // engine missing — page degrades to its static links

  const LEVELS = { 1: "Easy", 2: "Medium", 3: "Advanced" };
  const FEEDBACK_KEY = "emtech-ai-feedback-v1";

  /* ---------- DOM refs (all null-guarded) ---------- */
  const thread = document.getElementById("ai-thread");
  const form = document.getElementById("ai-form");
  const input = document.getElementById("ai-input");
  const sendBtn = document.getElementById("ai-send");
  const stopBtn = document.getElementById("ai-stop");
  const startersEl = document.getElementById("ai-starters");
  const chip = document.getElementById("ai-chip");
  const settingsForm = document.getElementById("ai-settings");
  const settingsBtn = document.getElementById("ai-settings-btn");
  const setMode = document.getElementById("ai-set-mode");
  const setUrlLabel = document.getElementById("ai-set-url-label");
  const setModelWrap = document.getElementById("ai-set-model-wrap");
  const setUrl = document.getElementById("ai-set-url");
  const setModel = document.getElementById("ai-set-model");
  const setReset = document.getElementById("ai-set-reset");
  const panelBody = document.getElementById("ai-panel-body");
  const panelDetails = document.getElementById("ai-panel-details");
  const newDiagBtn = document.getElementById("ai-new-diag");

  if (!thread || !form || !input) return;

  let busy = false;      // one in-flight turn at a time (§31: disable Send while waiting)
  let lastTurn = null;   // most recent turn (drives the panel + feedback row)

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function osLabel(tip) {
    if (!tip) return "";
    return tip.cat === "mac" ? "macOS" : (esc(tip.win || "Windows"));
  }

  function questionText(qid) {
    try {
      const D = window.EMTECH_DIAG_DATA;
      if (D && D.questions && D.questions[qid]) return D.questions[qid].q;
    } catch (err) {}
    return null;
  }

  /* ============================================================
     Turn rendering
     ============================================================ */
  function fixCardHtml(fix, ctaLabel) {
    const tip = fix.tip;
    if (!tip) return "";
    const K = window.EmTechAIKnowledge;
    const href = K ? K.fixHref(tip) : "#";
    return `
      <div class="ai-fixcard">
        <p class="ai-fixcard-label">${ctaLabel || "Recommended fix"}</p>
        <h3 class="ai-fixcard-title">${esc(tip.title)}</h3>
        <p class="ai-fixcard-desc">${esc(tip.description || "")}</p>
        <p class="ai-fixcard-meta">${osLabel(tip)} · ${LEVELS[tip.difficulty] || ""} · ${esc(tip.time || "")}${fix.reason ? " — " + esc(fix.reason) : ""}</p>
        <a class="btn btn-primary ai-btn-sm" href="${href}">Start Fix<span aria-hidden="true"> →</span></a>
      </div>`;
  }

  function relatedHtml(slugs) {
    if (!slugs || !slugs.length) return "";
    const K = window.EmTechAIKnowledge;
    const items = slugs.map((slug) => {
      const tip = K ? K.getFixBySlug(slug) : null;
      if (!tip) return "";
      return `<li><a href="${K.fixHref(tip)}">${esc(tip.title)}</a></li>`;
    }).filter(Boolean).join("");
    if (!items) return "";
    return `<p class="ai-related-label">Also worth checking</p><ul class="ai-related">${items}</ul>`;
  }

  function feedbackRowHtml(fixId) {
    return `
      <div class="ai-fbrow" role="group" aria-label="Did the fix work?">
        <span class="ai-fbq">Did that solve it?</span>
        <button type="button" class="btn ai-btn-sm ai-fb-yes" data-fix="${esc(fixId)}">Yes — it's fixed</button>
        <button type="button" class="btn ai-btn-sm ai-fb-no" data-fix="${esc(fixId)}">No, still broken</button>
        <button type="button" class="btn ai-btn-sm ai-fb-partial" data-fix="${esc(fixId)}">It helped, but it remains</button>
      </div>`;
  }

  function linksHtml() {
    return `
      <div class="ai-links">
        <a class="btn btn-primary ai-btn-sm" href="diagnose.html">Start guided diagnosis</a>
        <a class="btn-link ai-btn-sm" href="windows/">Browse Windows fixes</a>
        <a class="btn-link ai-btn-sm" href="mac/">Browse Mac fixes</a>
      </div>`;
  }

  function reportHtml(session) {
    const K = window.EmTechAIKnowledge;
    const problem = session.problemSummary || (session.conversation[0] ? session.conversation[0].text : "—");
    const cause = lastTurn && lastTurn.recommendedFix ? (lastTurn.recommendedFix.reason || lastTurn.recommendedFix.tip.title) : (session.solvedFix && K.getFixBySlug(session.solvedFix) ? K.getFixBySlug(session.solvedFix).title : "—");
    const checked = (session.askedQuestions || []).map(questionText).filter(Boolean);
    const tried = (session.attemptedFixes || []).map((s) => { const t = K.getFixBySlug(s); return t ? t.title : null; }).filter(Boolean);

    const row = (label, value) => `<p class="ai-report-row"><span>${esc(label)}</span><b>${value}</b></p>`;
    return `
      <div class="ai-report">
        <h3>Troubleshooting Summary</h3>
        ${row("Problem", esc(problem))}
        ${row("Likely cause", esc(cause))}
        ${row("What we checked", checked.length ? esc(checked.join("; ")) : "—")}
        ${row("What we tried", tried.length ? esc(tried.join("; ")) : "—")}
        <p class="ai-report-row"><span>Result</span><b>Problem solved 🎉</b></p>
      </div>`;
  }

  function starsHtml(session) {
    return `
      <div class="ai-stars" role="group" aria-label="How helpful was EmTech AI?">
        <span class="ai-stars-q">How helpful was EmTech AI?</span>
        ${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="ai-star" data-stars="${n}" aria-label="${n} star${n > 1 ? "s" : ""}">★</button>`).join("")}
        <span class="ai-stars-thanks" hidden>Thanks — saved on this device.</span>
      </div>`;
  }

  /* One AI/model turn → DOM. Appended to the thread. */
  function renderTurn(turn) {
    if (!turn || !thread) return null;
    lastTurn = turn;

    let node;
    const label = turn.kind === "fallback" ? "BUILT-IN TROUBLESHOOTER" : "EMTECH AI";

    /* ---- resolved (success state, §21/§54/§55) ---- */
    if (turn.status === "resolved") {
      node = el(`
        <div class="ai-msg ai-resolved">
          <p class="ai-resolved-emoji" aria-hidden="true">🎉</p>
          <h3>Problem solved!</h3>
          <p>${esc(turn.message || "Glad we could help.")}</p>
          ${turn.recommendedFix ? fixCardHtml(turn.recommendedFix, "What we fixed") : ""}
          ${reportHtml(turn.session || E.store.loadSession() || {})}
          ${starsHtml(turn.session || {})}
        </div>`);
    }

    /* ---- question (option cards) ---- */
    else if (turn.status === "question" && turn.question) {
      const opts = (turn.question.options || []).map((o, i) =>
        `<button type="button" class="ai-qopt" data-opt="${esc(o.label)}">${esc(o.label)}</button>`).join("");
      node = el(`
        <div class="ai-msg ai-ai">
          <p class="ai-msg-label">${label}</p>
          ${turn.safetyNote ? `<p class="ai-warn" role="alert"><b>Heads up:</b> ${esc(turn.safetyNote)}</p>` : ""}
          <p class="ai-text">${esc(turn.message || "")}</p>
          <div class="ai-qopts" role="group" aria-label="${esc(turn.question.text)}">
            <span class="ai-qtext">${esc(turn.question.text)}</span>
            ${opts}
          </div>
        </div>`);
    }

    /* ---- recommendation (fix card + feedback loop, §26) ---- */
    else if (turn.status === "recommendation" && turn.recommendedFix) {
      node = el(`
        <div class="ai-msg ai-ai">
          <p class="ai-msg-label">${label}</p>
          ${turn.safetyNote ? `<p class="ai-warn" role="alert"><b>Heads up:</b> ${esc(turn.safetyNote)}</p>` : ""}
          <p class="ai-text">${esc(turn.message || "")}</p>
          ${turn.candidateCauses && turn.candidateCauses.length ? `<ul class="ai-causes" aria-label="Likely causes">${turn.candidateCauses.map((c) => `<li>${esc(c.label)}</li>`).join("")}</ul>` : ""}
          ${fixCardHtml(turn.recommendedFix)}
          ${relatedHtml(turn.relatedFixes)}
          ${feedbackRowHtml(turn.recommendedFix.fixId)}
        </div>`);
    }

    /* ---- safety warning without a fix (§18) ---- */
    else if (turn.status === "safety_warning") {
      node = el(`
        <div class="ai-msg ai-ai">
          <p class="ai-msg-label">${label}</p>
          ${turn.safetyNote ? `<p class="ai-warn" role="alert"><b>Please be careful:</b> ${esc(turn.safetyNote)}</p>` : ""}
          <p class="ai-text">${esc(turn.message || "")}</p>
          ${linksHtml()}
        </div>`);
    }

    /* ---- insufficient information (§17/§22) ---- */
    else if (turn.status === "insufficient_information") {
      node = el(`
        <div class="ai-msg ai-ai">
          <p class="ai-msg-label">${label}</p>
          <p class="ai-text">${esc(turn.message || "I don't have enough information to safely recommend a fix yet.")}</p>
          ${relatedHtml(turn.relatedFixes)}
          ${linksHtml()}
        </div>`);
    }

    /* ---- unsupported (§66) ---- */
    else if (turn.status === "unsupported") {
      node = el(`
        <div class="ai-msg ai-ai">
          <p class="ai-msg-label">${label}</p>
          <p class="ai-text">${esc(turn.message || "I wouldn't want to guess about that one.")}</p>
          ${linksHtml()}
        </div>`);
    }

    /* ---- cancelled (§61) ---- */
    else if (turn.kind === "cancelled") {
      node = el(`<div class="ai-msg ai-note"><span aria-hidden="true">⏹</span> ${esc(turn.message || "Stopped.")}</div>`);
    }

    /* ---- error / unavailable (§32/§34) ---- */
    else if (turn.kind === "error") {
      const offline = /unavailable|offline|not-configured|bad-url/i.test((turn.code || "") + " " + (turn.message || ""));
      node = el(`
        <div class="ai-msg ai-error">
          <p class="ai-msg-label">EMTECH AI</p>
          ${offline ? `<h3>EmTech AI is currently unavailable.</h3>` : `<h3>Something went wrong.</h3>`}
          <p>${esc(turn.message || "You can still use our built-in troubleshooting system.")}</p>
          ${offline ? `<p class="ai-error-hint">If you run the local AI server, start it with <code>node ai-gateway/server.mjs</code>, or check the connection settings (⚙ above).</p>` : ""}
          ${linksHtml()}
        </div>`);
    }

    /* ---- generic text turn (defensive) ---- */
    else {
      node = el(`
        <div class="ai-msg ai-ai">
          <p class="ai-msg-label">${label}</p>
          <p class="ai-text">${esc(turn.message || "")}</p>
          ${turn.recommendedFix ? fixCardHtml(turn.recommendedFix) : ""}
          ${relatedHtml(turn.relatedFixes)}
        </div>`);
    }

    thread.appendChild(node);
    scrollToEnd();
    return node;
  }

  function renderUser(text) {
    const node = el(`<div class="ai-msg ai-user">${esc(text)}</div>`);
    thread.appendChild(node);
    scrollToEnd();
    return node;
  }

  /* Rebuild an AI turn from its compact stored form on resume (§47).
     Stored text looks like: "message [question:perf-when]" or
     "message [fix:hunt-down-memory-hogs]" — restore the interactive
     question card / fix card instead of showing raw markers. */
  function renderStoredAi(m) {
    let text = String(m.text || "");
    let qid = null, slug = null;

    const qm = /\s*\[question:([^\]]+)\]$/.exec(text);
    if (qm) { qid = qm[1]; text = text.slice(0, qm.index).trim(); }
    else {
      const fm = /\s*\[fix:([^\]]+)\]$/.exec(text);
      if (fm) { slug = fm[1]; text = text.slice(0, fm.index).trim(); }
    }

    let extra = "";
    if (qid && qid !== "free") {
      const D = window.EMTECH_DIAG_DATA;
      const q = D && D.questions ? D.questions[qid] : null;
      if (q) {
        const opts = (q.options || []).map((o) =>
          `<button type="button" class="ai-qopt" data-opt="${esc(o.label)}">${esc(o.label)}</button>`).join("");
        extra += `<div class="ai-qopts" role="group" aria-label="${esc(q.q)}"><span class="ai-qtext">${esc(q.q)}</span>${opts}</div>`;
      }
    } else if (qid === "free") {
      // Model-written clarification: its options were never stored, so the
      // question text alone is all we can restore.
    }

    const K = window.EmTechAIKnowledge;
    if (slug) {
      const tip = K ? K.getFixBySlug(slug) : null;
      if (tip) extra += fixCardHtml({ tip, reason: "" }) + feedbackRowHtml(slug);
    }

    const node = el(`
      <div class="ai-msg ai-ai">
        <p class="ai-msg-label">EMTECH AI</p>
        ${text ? `<p class="ai-text">${esc(text)}</p>` : ""}
        ${extra}
      </div>`);
    thread.appendChild(node);
  }

  function renderIntro() {
    if (thread.querySelector(".ai-intro")) return;
    const node = el(`
      <div class="ai-msg ai-intro">
        <p>Hi — tell me what's going on with your computer, in your own words. No technical terms needed.</p>
        <p class="ai-intro-sub">I'll ask one thing at a time and point you to the tested fix that fits.</p>
      </div>`);
    thread.appendChild(node);
  }

  function scrollToEnd() {
    const last = thread.lastElementChild;
    if (last && last.scrollIntoView) last.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  function prefersReducedMotion() {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (err) { return false; }
  }

  /* ============================================================
     Thinking state (§31/§60) — UI stays responsive while waiting.
     ============================================================ */
  let thinkingNode = null;
  function showThinking() {
    hideThinking();
    thinkingNode = el(`
      <div class="ai-msg ai-thinking" role="status">
        <span class="ai-think-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        EmTech is thinking…
      </div>`);
    thread.appendChild(thinkingNode);
    scrollToEnd();
  }
  function hideThinking() {
    if (thinkingNode && thinkingNode.parentNode) thinkingNode.parentNode.removeChild(thinkingNode);
    thinkingNode = null;
  }

  function setBusy(on) {
    busy = on;
    sendBtn.disabled = on;
    input.disabled = false; // keep typing queued text while waiting (§60)
    if (stopBtn) stopBtn.hidden = !on;
  }

  /* ============================================================
     Turn dispatch — every path ends with a rendered turn.
     ============================================================ */
  async function runTurn(text, via) {
    setBusy(true);
    showThinking();
    let turn;
    try {
      if (via === "answer") turn = await E.answerQuestion(text);
      else turn = await E.sendUserMessage(text);
    } catch (err) {
      // Engine should never throw — but the UI must survive anyway (§34).
      turn = { kind: "error", code: "unexpected", message: String((err && err.message) || err) };
    }
    hideThinking();
    setBusy(false);

    const node = renderTurn(turn);
    updatePanel(turn.session || E.store.loadSession(), turn);

    // Move focus to the first actionable control for keyboard users.
    if (node) {
      const target = node.querySelector(".ai-qopt, .ai-fb-yes, a.btn");
      if (target && !prefersReducedMotion()) { try { target.focus({ preventScroll: true }); } catch (err) {} }
    }
  }

  /* ============================================================
     Diagnosis panel (§28/§29)
     ============================================================ */
  function updatePanel(session, turn) {
    if (!panelBody || !session) return;
    const K = window.EmTechAIKnowledge;

    const rows = [];
    if (session.platform) rows.push(`<p class="ai-p-row"><span>Platform</span><b>${esc(session.platform === "mac" ? "Mac" : "Windows PC")}</b></p>`);
    if (session.category) rows.push(`<p class="ai-p-row"><span>Category</span><b>${esc(session.category)}</b></p>`);

    const causes = turn && Array.isArray(turn.candidateCauses) && turn.candidateCauses.length
      ? `<h3>Likely causes</h3><ul class="ai-p-list">${turn.candidateCauses.map((c) => `<li>${esc(c.label)}</li>`).join("")}</ul>` : "";

    const checked = (session.askedQuestions || []).map(questionText).filter(Boolean);
    const checkedHtml = checked.length ? `<h3>Checked</h3><ul class="ai-p-list">${checked.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "";

    const tried = (session.attemptedFixes || []).map((s) => { const t = K.getFixBySlug(s); return t ? t.title : null; }).filter(Boolean);
    const triedHtml = tried.length
      ? `<h3>Tried</h3><ul class="ai-p-list">${tried.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "";

    let recHtml = "";
    if (turn && turn.recommendedFix && turn.recommendedFix.tip) {
      const tip = turn.recommendedFix.tip;
      recHtml = `<h3>Recommended fix</h3><p class="ai-p-rec"><a href="${K.fixHref(tip)}">${esc(tip.title)}</a></p>`;
    }

    if (!rows.length && !causes && !checkedHtml && !triedHtml && !recHtml) {
      panelBody.innerHTML = `<p class="ai-panel-empty">Your diagnosis will appear here as we talk — platform, likely causes, what's been checked and tried.</p>`;
      return;
    }

    panelBody.innerHTML = rows.join("") + recHtml + causes + checkedHtml + triedHtml;
  }

  /* ============================================================
     Status chip + settings (§32/§38)
     ============================================================ */
  function setChip(state, text) {
    if (!chip) return;
    chip.className = "ai-chip ai-chip-" + state;
    chip.textContent = text;
  }

  async function refreshHealth() {
    try {
      const h = await E.healthCheck();
      if (h.ok) setChip("ok", "AI connected");
      else setChip("off", "AI offline — guided diagnosis works");
    } catch (err) {
      setChip("off", "AI offline — guided diagnosis works");
    }
  }

  /* Mode switch (§30): cloud is the production default; local points at the
     dev gateway. The URL field's meaning follows the mode, and in cloud mode
     the model name is hidden — it's configured server-side (§38). */
  const setWarn = document.getElementById("ai-set-warn");

  /* Local mode means "the dev gateway on this machine" — a non-local URL in
     that slot is almost always a copy-paste of the cloud endpoint. */
  function looksLocal(u) {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?([/?#]|$)/i.test(String(u || ""));
  }

  function showSetWarn(msg) { if (setWarn) { setWarn.textContent = msg; setWarn.hidden = false; } }
  function hideSetWarn() { if (setWarn) { setWarn.hidden = true; setWarn.textContent = ""; } }

  function applyModeUi() {
    if (!setMode) return;
    const cloud = setMode.value !== "local";
    if (setUrlLabel) setUrlLabel.textContent = cloud ? "Cloud endpoint" : "Gateway URL";
    if (setUrl) {
      setUrl.placeholder = cloud
        ? "https://…workers.dev/api/ai"
        : "http://localhost:8787/v1/chat/completions";
      // Re-populate with this mode's saved value or its default, so switching
      // modes never leaves the other mode's URL in the field. A non-local
      // gatewayUrl is stale (e.g. a pasted cloud endpoint) → local default.
      const C = window.EmTechAIConfig;
      if (C) {
        const saved = C.loadSettings();
        setUrl.value = cloud
          ? (saved.cloudEndpoint || C.defaults.cloudEndpoint)
          : (looksLocal(saved.gatewayUrl) ? saved.gatewayUrl : C.defaults.gatewayUrl);
      }
    }
    if (setModelWrap) setModelWrap.hidden = cloud;
    hideSetWarn();
  }

  function openSettings(open) {
    if (!settingsForm || !settingsBtn) return;
    settingsForm.hidden = !open;
    settingsBtn.setAttribute("aria-expanded", String(open));
    const cfg = window.EmTechAIConfig ? window.EmTechAIConfig.resolveConfig() : {};
    if (setMode) setMode.value = cfg.mode === "local" ? "local" : "cloud";
    applyModeUi(); // label + placeholder + URL value for the active mode
    if (setModel) setModel.value = cfg.model || "";
  }

  /* ============================================================
     Starters (from diag-data.js — real content only, §28)
     ============================================================ */
  function renderStarters() {
    if (!startersEl) return;
    let starters = [];
    try { starters = (window.EMTECH_DIAG_DATA && window.EMTECH_DIAG_DATA.starters) || []; } catch (err) {}
    if (!starters.length) { startersEl.hidden = true; return; }
    startersEl.innerHTML = `<span class="ai-starters-label">Popular problems</span>` +
      starters.map((s, i) => `<button type="button" class="ai-starter" data-i="${i}">${esc(s.label)}</button>`).join("");
  }

  /* ============================================================
     New diagnosis (§52) — inline confirm so progress is never lost.
     ============================================================ */
  let confirmingReset = false;
  function onNewDiagnosis() {
    if (!newDiagBtn) return;
    const session = E.store.loadSession();
    const hasContent = session && session.conversation.length > 0;

    if (confirmingReset) {
      confirmingReset = false;
      newDiagBtn.textContent = "New diagnosis";
      newDiagBtn.classList.remove("ai-confirm");
      doReset();
      return;
    }

    if (!hasContent) { doReset(); return; }

    confirmingReset = true;
    newDiagBtn.textContent = "Start over? This clears the conversation. Confirm →";
    newDiagBtn.classList.add("ai-confirm");
  }

  function doReset() {
    E.reset();
    thread.innerHTML = "";
    renderIntro();
    lastTurn = null;
    updatePanel(E.store.loadSession(), null);
    input.focus();
  }

  /* ============================================================
     Wire-up
     ============================================================ */
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (busy) return;
    const text = input.value.trim();
    if (!text) { input.focus(); return; }
    renderUser(text);
    input.value = "";
    runTurn(text, "message");
  });

  // Enter → send, Shift+Enter → newline (§31).
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit"));
    }
  });

  // Option cards + feedback buttons (event delegation — nodes are dynamic).
  thread.addEventListener("click", async (e) => {
    const opt = e.target.closest(".ai-qopt");
    if (opt && !busy) {
      renderUser(opt.dataset.opt || opt.textContent);
      runTurn(opt.dataset.opt || opt.textContent, "answer");
      return;
    }

    const fbYes = e.target.closest(".ai-fb-yes");
    const fbNo = e.target.closest(".ai-fb-no");
    const fbPartial = e.target.closest(".ai-fb-partial");
    if ((fbYes || fbNo || fbPartial) && !busy) {
      const fixId = (fbYes || fbNo || fbPartial).dataset.fix;
      const result = fbYes ? "yes" : fbNo ? "no" : "partial";
      renderUser(result === "yes" ? "Yes — it's fixed." : result === "no" ? "No, still broken." : "It helped, but the problem remains.");
      setBusy(true); showThinking();
      let turn;
      try { turn = await E.fixResult(fixId, result); }
      catch (err) { turn = { kind: "error", code: "unexpected", message: String((err && err.message) || err) }; }
      hideThinking(); setBusy(false);
      const node = renderTurn(turn);
      updatePanel(turn.session || E.store.loadSession(), turn);
      if (node) {
        const t2 = node.querySelector(".ai-star, a.btn");
        if (t2 && !prefersReducedMotion()) { try { t2.focus({ preventScroll: true }); } catch (err) {} }
      }
      return;
    }

    // Stars (§55 — local only).
    const star = e.target.closest(".ai-star");
    if (star && !busy) {
      const n = Number(star.dataset.stars);
      try {
        const session = E.store.loadSession() || {};
        window.localStorage.setItem(FEEDBACK_KEY, JSON.stringify({ sessionId: session.id || null, stars: n, date: new Date().toISOString() }));
      } catch (err) {}
      E.trackEvent("ai_feedback_stars", { stars: n });
      const thanks = star.closest(".ai-stars").querySelector(".ai-stars-thanks");
      if (thanks) thanks.hidden = false;
    }
  });

  // Starters.
  startersEl && startersEl.addEventListener("click", (e) => {
    const b = e.target.closest(".ai-starter");
    if (!b || busy) return;
    let label = "";
    try { label = ((window.EMTECH_DIAG_DATA.starters)[Number(b.dataset.i)] || {}).label || ""; } catch (err) {}
    if (!label) return;
    renderUser(label);
    runTurn(label, "message");
  });

  // Settings popover.
  settingsBtn && settingsBtn.addEventListener("click", () => openSettings(settingsForm.hidden));
  setMode && setMode.addEventListener("change", applyModeUi);
  setUrl && setUrl.addEventListener("input", hideSetWarn);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && settingsForm && !settingsForm.hidden) openSettings(false);
  });
  settingsForm && settingsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const mode = setMode ? setMode.value : "cloud";
    const url = setUrl ? setUrl.value.trim() : "";
    if (mode === "local" && url && !looksLocal(url)) {
      // Don't persist a broken combination — Local mode must point at this machine (§30).
      showSetWarn("Local mode expects your dev gateway on this machine, e.g. http://localhost:8787/v1/chat/completions");
      return;
    }
    hideSetWarn();
    const patch = { mode };
    if (url) patch[mode === "local" ? "gatewayUrl" : "cloudEndpoint"] = url;
    if (mode === "local" && setModel && setModel.value.trim()) patch.model = setModel.value.trim();
    window.EmTechAIConfig.saveSettings(patch);
    openSettings(false);
    refreshHealth();
  });
  setReset && setReset.addEventListener("click", () => {
    window.EmTechAIConfig.clearSettings();
    openSettings(true); // re-populate with defaults
    refreshHealth();
  });

  newDiagBtn && newDiagBtn.addEventListener("click", onNewDiagnosis);

  /* ---------- boot: resume session or intro; health check ---------- */
  (function boot() {
    renderStarters();
    const session = E.store.loadSession();
    if (session && session.conversation.length) {
      // Re-render the conversation so a refresh restores context (§47).
      for (const m of session.conversation) {
        if (m.role === "user") renderUser(m.text);
        else renderStoredAi(m); // restores question cards + fix cards
      }
      if (session.status === "resolved") {
        const node = el(`<div class="ai-msg ai-resolved"><h3>Problem solved!</h3><p>Glad we could help. Start a new diagnosis any time.</p></div>`);
        thread.appendChild(node);
      }
    } else {
      renderIntro();
    }
    updatePanel(session, null);

    // Mobile: keep the panel collapsed by default (§29).
    if (panelDetails) {
      try { if (window.matchMedia("(max-width: 900px)").matches) panelDetails.open = false; } catch (err) {}
    }

    refreshHealth();
  })();
})();
