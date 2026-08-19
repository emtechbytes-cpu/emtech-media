/* ============================================================
   EmTech Media — PC & Mac Problems, Solved
   01 Diagnose (symptom → matched fix + first steps)
   02/03 Windows & Mac fixes as expandable accordion lists
   04 Monthly routine checklist (progress saved in localStorage)
   Deep-link openers · nav toggle · reveals · counters
   Scrollspy · footer year
   ============================================================ */

(function () {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const LEVELS = { 1: "Easy", 2: "Medium", 3: "Advanced" };
  const ROUTINE_KEY = "emtech-routine-v1";

  /* ---------- Helpers ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  const TIPS_BY_SLUG = new Map(
    (typeof TIPS !== "undefined" ? TIPS : []).map((t) => [tipSlug(t.title), t])
  );
  const findTip = (slug) => TIPS_BY_SLUG.get(slug);

  /* ---------- Library counts ----------
     TIPS is the single source of truth. Any element carrying
     data-tip-count has its number filled from the data, so page copy
     can't drift as the library grows. The markup keeps a correct value
     inline as the no-JS fallback. Elements that also carry data-count
     get their animation target set instead of their text. */
  const TIP_COUNTS = (() => {
    const all = typeof TIPS !== "undefined" ? TIPS : [];
    const mac = all.filter((t) => t.cat === "mac");
    const win = all.filter((t) => t.cat !== "mac");
    return {
      all: all.length,
      win: win.length,
      mac: mac.length,
      "win-cats": new Set(win.map((t) => t.cat)).size,
      "mac-groups": new Set(mac.map((t) => t.group).filter(Boolean)).size,
    };
  })();

  document.querySelectorAll("[data-tip-count]").forEach((el) => {
    const n = TIP_COUNTS[el.dataset.tipCount];
    if (n === undefined) return;
    if (el.hasAttribute("data-count")) el.dataset.count = String(n);
    else el.textContent = String(n);
  });

  /* ---------- Mobile navigation ---------- */
  const navToggle = document.getElementById("nav-toggle");
  const primaryNav = document.getElementById("primary-nav");

  if (navToggle && primaryNav) {
    navToggle.addEventListener("click", () => {
      const open = primaryNav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(open));
    });

    primaryNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        primaryNav.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && primaryNav.classList.contains("open")) {
        primaryNav.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.focus();
      }
    });
  }

  /* ---------- 01 Diagnose: symptom → matched fix ---------- */
  const SYMPTOMS = [
    {
      id: "slow-pc",
      label: "PC suddenly slow",
      blurb: "A fast machine crawling for no obvious reason.",
      tips: [
        { slug: "fix-my-pc-is-slow-all-of-a-sudden-the-order-of-attack", tag: "Windows" },
        { slug: "hunt-down-memory-hogs", tag: "Windows · also try" },
        { slug: "speed-up-a-sluggish-macbook", tag: "Mac" },
      ],
    },
    {
      id: "overheating",
      label: "Fans like a jet engine",
      blurb: "Overheating, loud fans, or thermal throttling.",
      tips: [
        { slug: "fix-a-pc-that-overheats-and-fans-like-a-jet-engine", tag: "Windows" },
      ],
    },
    {
      id: "update-chaos",
      label: "Update chaos",
      blurb: "Restarts at 3am, updates that never finish.",
      tips: [
        { slug: "stop-windows-updates-at-odd-hours", tag: "Windows" },
      ],
    },
    {
      id: "gaming-stutter",
      label: "Gaming stutter",
      blurb: "Random lag spikes and dropped frames in games.",
      tips: [
        { slug: "stop-games-stuttering-the-5-point-checklist", tag: "Windows" },
        { slug: "raise-your-effective-fps-with-windows-game-mode", tag: "Windows · also try" },
      ],
    },
    {
      id: "disk-full",
      label: "Disk full",
      blurb: "Storage warnings, or apps complaining about space.",
      tips: [
        { slug: "clean-up-temp-files-and-browser-cache-properly", tag: "Windows" },
        { slug: "free-up-disk-space-with-storage-management", tag: "Mac" },
      ],
    },
    {
      id: "mac-sluggish",
      label: "Mac sluggish",
      blurb: "An older MacBook feeling slow and unresponsive.",
      tips: [
        { slug: "speed-up-a-sluggish-macbook", tag: "Mac" },
      ],
    },
    {
      id: "security",
      label: "Security worries",
      blurb: "Ransomware, sketchy software, or just hardening up.",
      tips: [
        { slug: "protect-against-ransomware-before-it-s-too-late", tag: "Windows" },
        { slug: "hardening-accounts-updates-and-the-firewall", tag: "Windows · also try" },
      ],
    },
    {
      id: "corrupted",
      label: "Something's corrupted",
      blurb: "Glitches, failed updates, weird misbehaviour.",
      tips: [
        { slug: "repair-corrupted-system-files", tag: "Windows" },
        { slug: "start-windows-in-safe-mode", tag: "Windows · also try" },
        { slug: "reset-nvram-when-things-misbehave", tag: "Mac" },
      ],
    },
    {
      id: "wifi-drops",
      label: "Wi-Fi keeps dropping",
      blurb: "Connection flaps out, or speeds crawl for no reason.",
      tips: [
        { slug: "stop-your-pc-from-sleep-glitching-your-network", tag: "Windows" },
        { slug: "slow-internet-run-the-five-minute-test", tag: "Windows · also try" },
        { slug: "fix-slow-wi-fi-on-your-mac", tag: "Mac" },
      ],
    },
    {
      id: "battery-drain",
      label: "Battery draining fast",
      blurb: "A laptop that used to last all day now dies by lunch.",
      tips: [
        { slug: "make-your-laptop-battery-last-longer", tag: "Windows" },
        { slug: "keep-your-mac-battery-healthy", tag: "Mac" },
      ],
    },
    {
      id: "no-sound",
      label: "No sound at all",
      blurb: "Silent speakers, or audio that vanished after an update.",
      tips: [
        { slug: "no-sound-the-four-minute-fix", tag: "Windows" },
      ],
    },
    {
      id: "mic-webcam",
      label: "Mic or webcam not working",
      blurb: "'You're on mute', black camera squares, calls that go one way.",
      tips: [
        { slug: "fix-a-microphone-no-one-can-hear", tag: "Windows" },
        { slug: "fix-a-webcam-that-won-t-turn-on", tag: "Windows · also try" },
      ],
    },
    {
      id: "printer",
      label: "Printer won't print",
      blurb: "Stuck queues, missing pages, or the wrong default printer.",
      tips: [
        { slug: "fix-a-printer-that-won-t-print", tag: "Windows" },
      ],
    },
    {
      id: "blue-screen",
      label: "Blue screen of death",
      blurb: "Random crashes with a scary code on a blue background.",
      tips: [
        { slug: "fix-a-blue-screen-bsod-without-panicking", tag: "Windows" },
        { slug: "start-windows-in-safe-mode", tag: "Windows · also try" },
      ],
    },
    {
      id: "pc-wont-boot",
      label: "PC won't start up",
      blurb: "Dead screen at boot, or it spins on the logo and gives up.",
      tips: [
        { slug: "fix-a-pc-that-won-t-start-up", tag: "Windows" },
        { slug: "start-windows-in-safe-mode", tag: "Windows · also try" },
      ],
    },
    {
      id: "mac-wont-boot",
      label: "Mac won't start up",
      blurb: "Black screen at boot, or it just sits there.",
      tips: [
        { slug: "fix-a-mac-that-won-t-start-up", tag: "Mac" },
      ],
    },
    {
      id: "app-frozen",
      label: "App frozen / beachball",
      blurb: "Spinning wheel, unresponsive windows.",
      tips: [
        { slug: "force-quit-a-frozen-app", tag: "Mac" },
        { slug: "speed-up-a-sluggish-macbook", tag: "Mac · also try" },
      ],
    },
    {
      id: "gatekeeper",
      label: "Mac blocks an app I need",
      blurb: "'Developer cannot be verified', or Gatekeeper saying no.",
      tips: [
        { slug: "open-apps-blocked-by-gatekeeper", tag: "Mac" },
      ],
    },
    {
      id: "junk-apps",
      label: "Pop-ups and junk apps",
      blurb: "Bundleware, 'PC optimizers', and things you never installed.",
      tips: [
        { slug: "kill-shady-pc-optimizer-software", tag: "Windows" },
        { slug: "dodge-bundleware-when-you-install-anything", tag: "Windows · also try" },
        { slug: "uninstall-the-apps-you-never-use", tag: "Windows · also try" },
      ],
    },
    {
      id: "cant-find-files",
      label: "Can't find my files",
      blurb: "Search that returns nothing, or takes forever to answer.",
      tips: [
        { slug: "make-windows-search-actually-useful-again", tag: "Windows" },
        { slug: "tame-spotlight-indexing-on-extra-drives", tag: "Mac" },
      ],
    },
    {
      id: "deleted-file",
      label: "Deleted a file by mistake",
      blurb: "Gone from the folder — and probably not gone for good.",
      tips: [
        { slug: "get-back-a-file-you-deleted-by-mistake", tag: "Windows" },
      ],
    },
  ];

  const symptomGrid = document.getElementById("symptom-grid");
  const diagResult = document.getElementById("diag-result");

  function renderSymptoms() {
    if (!symptomGrid) return;
    symptomGrid.innerHTML = SYMPTOMS.map((s, i) => `
      <button class="symptom-btn" type="button" data-symptom="${esc(s.id)}" aria-pressed="false">
        <span class="s-num" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>
        <span class="s-label">${esc(s.label)}</span>
        <span class="s-blurb">${esc(s.blurb)}</span>
      </button>`).join("");

    symptomGrid.addEventListener("click", (e) => {
      const btn = e.target.closest(".symptom-btn");
      if (!btn) return;
      showDiagnosis(btn.dataset.symptom);
    });
  }

  function diagBlock(tip, tag) {
    const target = tip.cat === "mac" ? "mac.html" : "windows.html";
    const slug = tipSlug(tip.title);
    return `
      <div class="diag-tip">
        <header class="diag-head">
          <h3 class="diag-title">${esc(tip.title)}</h3>
          <p class="diag-meta"><span>${esc(tag)}</span><span>${esc(tip.time)}</span><span>${LEVELS[tip.difficulty] || ""}</span></p>
        </header>
        <ol class="tip-steps diag-steps">
          ${tip.steps.slice(0, 3).map((s) => `<li>${esc(s)}</li>`).join("")}
        </ol>
        <a class="btn-link" href="${target}#${esc(slug)}">Read the full fix <span aria-hidden="true">↗</span></a>
      </div>`;
  }

  function showDiagnosis(symptomId) {
    const sym = SYMPTOMS.find((s) => s.id === symptomId);
    if (!sym || !diagResult) return;

    symptomGrid.querySelectorAll(".symptom-btn").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.symptom === symptomId));
    });

    const blocks = sym.tips
      .map((m) => {
        const tip = findTip(m.slug);
        return tip ? diagBlock(tip, m.tag) : "";
      })
      .join("");

    // Re-trigger the entrance animation on every new diagnosis.
    diagResult.classList.remove("diag-in");
    void diagResult.offsetWidth;
    diagResult.innerHTML = blocks || "<p class=\"diag-prompt\">No fix matched that symptom yet — try the lists below.</p>";
    diagResult.classList.add("diag-in");
  }

  renderSymptoms();

  /* ---------- 02/03 Windows & Mac accordions ---------- */
  const WIN_ORDER = ["speed", "windows", "gaming", "cleaning", "maintenance", "hardware", "security"];

  function relatedTips(t) {
    const pool = TIPS.filter((o) => o !== t && o.cat === t.cat);
    const inGroup = t.group ? pool.filter((o) => o.group === t.group) : [];
    return (inGroup.length >= 3 ? inGroup : pool).slice(0, 3);
  }

  function accItem(t) {
    const slug = tipSlug(t.title);
    const related = relatedTips(t);
    return `
      <div class="acc-item" data-slug="${esc(slug)}">
        <button class="acc-head" type="button" aria-expanded="false" aria-controls="body-${esc(slug)}">
          <span class="acc-title">${esc(t.title)}</span>
          <span class="acc-meta"><span>${esc(CAT_LABELS[t.cat] || t.cat)}</span><span>${esc(t.time)}</span><span>${LEVELS[t.difficulty] || ""}</span></span>
          <span class="acc-icon" aria-hidden="true">+</span>
        </button>
        <div class="acc-body" id="body-${esc(slug)}" hidden>
          <div class="acc-inner">
            <p class="acc-desc">${esc(t.description)}</p>
            ${t.diagram ? `<div class="tip-diagram-scroll"><img class="tip-diagram" src="${esc(t.diagram)}" alt="${esc(t.title)} — schematic diagram" loading="lazy" width="800" height="540"></div>` : ""}
            <ol class="tip-steps">${t.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
            <div class="fix-feedback">
              <p class="ff-q">Did this fix your problem?</p>
              <div class="ff-actions">
                <button class="ff-btn ff-yes" type="button" aria-pressed="false"><span class="ff-mark" aria-hidden="true">✓</span>Yes, it's fixed</button>
                <button class="ff-btn ff-no" type="button" aria-pressed="false"><span class="ff-mark" aria-hidden="true">✕</span>No, I still need help</button>
              </div>
              <p class="ff-state" role="status"></p>
            </div>
            ${related.length ? `
            <div class="acc-related">
              <span class="rel-label">Pairs well with</span>
              <ul>${related.map((r) => `<li><a href="#${esc(tipSlug(r.title))}">${esc(r.title)}</a></li>`).join("")}</ul>
            </div>` : ""}
            <div class="acc-actions">
              <button class="done-btn" type="button" aria-pressed="false"><span class="tick" aria-hidden="true"></span><span class="lbl">Mark as done</span></button>
              <button class="print-btn" type="button">Print this fix</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  const GROUP_LABELS = { speed: "Speed & performance", fixes: "Everyday fixes", security: "Security & backups" };

  function renderAccordion(elId, tips, order) {
    const el = document.getElementById(elId);
    if (!el || !tips.length) return;

    let html = "";
    order.forEach((cat) => {
      const group = tips.filter((t) => t.cat === cat);
      if (!group.length) return;
      html += `<h3 class="acc-group" id="cat-${esc(cat)}"><span>${esc(CAT_LABELS[cat] || cat)}</span><i aria-hidden="true">·</i><span>${group.length} fix${group.length > 1 ? "es" : ""}</span></h3>`;
      const subKeys = [...new Set(group.map((t) => t.group).filter(Boolean))];
      if (subKeys.length) {
        subKeys.forEach((g) => {
          const sub = group.filter((t) => t.group === g);
          html += `<h4 class="acc-subgroup" id="sub-${esc(g)}"><span>${esc(GROUP_LABELS[g] || g)}</span><i aria-hidden="true">·</i><span>${sub.length} fix${sub.length > 1 ? "es" : ""}</span></h4>`;
          sub.forEach((t) => { html += accItem(t); });
        });
      } else {
        group.forEach((t) => { html += accItem(t); });
      }
    });
    el.innerHTML = html;
  }

  /* Smooth expand/collapse: CSS animates the grid row (0fr ↔ 1fr), JS keeps
     [hidden] in sync for accessibility and clears pending close timers so
     rapid toggles stay interruptible. `instant` skips animation (search filter,
     reduced motion). */
  const ACC_CLOSE_MS = 360;

  function setAcc(item, open, instant) {
    if (!item) return;
    const head = item.querySelector(".acc-head");
    const body = item.querySelector(".acc-body");
    head.setAttribute("aria-expanded", String(open));

    if (body._closeTimer) { clearTimeout(body._closeTimer); body._closeTimer = null; }

    if (open) {
      body.hidden = false;
      if (!item.classList.contains("open")) {
        void body.offsetHeight; // commit the collapsed row so the transition runs
        item.classList.add("open");
      }
      return;
    }

    item.classList.remove("open");
    if (instant || prefersReducedMotion) { body.hidden = true; return; }
    body._closeTimer = setTimeout(() => {
      body._closeTimer = null;
      if (!item.classList.contains("open")) body.hidden = true;
    }, ACC_CLOSE_MS);
  }

  function toggleAcc(item, forceOpen) {
    if (!item) return;
    setAcc(item, forceOpen === true ? true : !item.classList.contains("open"));
  }

  renderAccordion("win-acc", TIPS.filter((t) => t.cat !== "mac"), WIN_ORDER);
  renderAccordion("mac-acc", TIPS.filter((t) => t.cat === "mac"), ["mac"]);

  /* Breadcrumb + <title> follow the fix that's open (fix pages only —
     index.html has no #bc-tip, so this is a no-op there). */
  function setCrumb(tip) {
    const bcTip = document.getElementById("bc-tip");
    if (!tip || !bcTip) return;
    const bcPage = document.getElementById("bc-page");
    bcTip.textContent = tip.title;
    bcTip.hidden = false;
    if (bcPage) bcPage.removeAttribute("aria-current");
    bcTip.setAttribute("aria-current", "page");
    document.title = `${tip.title} — ${tip.cat === "mac" ? "Mac" : "Windows"} Fixes · EmTech Media`;
  }

  document.addEventListener("click", (e) => {
    const head = e.target.closest(".acc-head");
    if (!head) return;
    const item = head.closest(".acc-item");
    toggleAcc(item);
    if (item && item.classList.contains("open")) setCrumb(findTip(item.dataset.slug));
  });

  /* ---------- Homepage: popular problems · categories · recently updated ----------
     All three derive from TIPS at render time, so counts and links stay
     honest as the library grows. The slug lists are curated; every label,
     time and difficulty shown comes straight from the data. */

  const POPULAR_SLUGS = [
    "fix-my-pc-is-slow-all-of-a-sudden-the-order-of-attack",
    "fix-a-pc-that-overheats-and-fans-like-a-jet-engine",
    "stop-your-pc-from-sleep-glitching-your-network",
    "no-sound-the-four-minute-fix",
    "speed-up-a-sluggish-macbook",
    "stop-games-stuttering-the-5-point-checklist",
    "clean-up-temp-files-and-browser-cache-properly",
    "fix-a-blue-screen-bsod-without-panicking",
  ];

  const RECENT_SLUGS = [
    "fix-a-pc-that-won-t-start-up",
    "get-back-a-file-you-deleted-by-mistake",
    "spot-a-phishing-email-before-you-click",
    "windows-10-is-past-end-of-support-what-to-do-now",
  ];

  function tipHref(tip) {
    return `${tip.cat === "mac" ? "mac.html" : "windows.html"}#${esc(tipSlug(tip.title))}`;
  }

  function fmtUpdated(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return "";
    try {
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch (err) { return iso; }
  }

  function popCard(tip, opts) {
    const o = opts || {};
    let dateLine = "";
    if (o.date) {
      const label = fmtUpdated(tip.updated);
      if (label) dateLine = `<time class="pop-date" datetime="${esc(tip.updated)}">Updated ${esc(label)}</time>`;
    }
    return `
      <li class="pop-card">
        <p class="pop-kicker">${esc(tip.win || (tip.cat === "mac" ? "macOS" : "Windows"))} · ${esc(CAT_LABELS[tip.cat] || tip.cat)}</p>
        <h3 class="pop-title"><a href="${tipHref(tip)}">${esc(tip.title)}</a></h3>
        <p class="pop-desc">${esc(tip.description)}</p>
        ${dateLine}
        <div class="pop-foot">
          <span class="pop-meta"><i class="dot dot-${tip.difficulty}" aria-hidden="true"></i>${LEVELS[tip.difficulty] || ""} · ${esc(tip.time)}</span>
          <a class="pop-cta" href="${tipHref(tip)}">${o.cta || "Fix this problem"}<span aria-hidden="true"> →</span></a>
        </div>
      </li>`;
  }

  function renderPopGrid(elId, slugs, opts) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = slugs.map((s) => (findTip(s) ? popCard(findTip(s), opts) : "")).join("");
  }

  renderPopGrid("popular-grid", POPULAR_SLUGS, {});
  renderPopGrid("recent-grid", RECENT_SLUGS, { cta: "Start fix", date: true });

  function renderCatGrid(elId, entries) {
    const el = document.getElementById(elId);
    if (!el || !entries.length) return;
    el.innerHTML = entries.map((c) => `
      <li><a class="cat-link" href="${esc(c.href)}"><span>${esc(c.label)}</span><i aria-hidden="true">${c.count}</i></a></li>`).join("");
  }

  const winTipsAll = TIPS.filter((t) => t.cat !== "mac");
  renderCatGrid("cat-win-grid", WIN_ORDER.map((c) => ({
    label: CAT_LABELS[c] || c,
    count: winTipsAll.filter((t) => t.cat === c).length,
    href: `windows.html#cat-${c}`,
  })).filter((e) => e.count > 0));

  const macTipsAll = TIPS.filter((t) => t.cat === "mac");
  renderCatGrid("cat-mac-grid", ["speed", "fixes", "security"].map((g) => ({
    label: GROUP_LABELS[g] || g,
    count: macTipsAll.filter((t) => t.group === g).length,
    href: `mac.html#sub-${g}`,
  })).filter((e) => e.count > 0));

  /* ---------- Homepage: global fix search (static, no backend) ---------- */
  const gsInput = document.getElementById("global-search");
  const gsResults = document.getElementById("gs-results");
  const gsCount = document.getElementById("gs-count");

  function scoreTip(tip, tokens, phrase) {
    const title = tip.title.toLowerCase();
    const desc = (tip.description || "").toLowerCase();
    const catLabel = ((CAT_LABELS[tip.cat] || "") + " " + (tip.win || "")).toLowerCase();
    let score = 0;

    for (const tok of tokens) {
      if (title.includes(tok)) score += 3;
      else if (desc.includes(tok)) score += 2;
      else if (catLabel.includes(tok)) score += 1.5;
      // Platform words rank the right OS higher, even on their own.
      if (/^mac/.test(tok) && tip.cat === "mac") score += 2;
      if ((tok === "windows" || tok === "win") && tip.cat !== "mac") score += 2;
    }

    // Whole-phrase bonus: "slow laptop" beats scattered single-word hits.
    if (phrase.length > 3) {
      if (title.includes(phrase)) score += 4;
      else if (desc.includes(phrase)) score += 2;
    }
    return score;
  }

  function gsItem(tip) {
    const os = tip.cat === "mac" ? "macOS" : esc(tip.win || "Windows");
    return `
      <li>
        <a class="gs-item" href="${tipHref(tip)}">
          <span class="gs-top"><span class="gs-title">${esc(tip.title)}</span><span class="gs-meta">${os} · ${LEVELS[tip.difficulty] || ""} · ${esc(tip.time)}</span></span>
          <span class="gs-desc">${esc(tip.description)}</span>
          <span class="gs-go">View fix →</span>
        </a>
      </li>`;
  }

  function runGlobalSearch() {
    if (!gsInput || !gsResults) return;
    const q = gsInput.value.trim();

    if (!q) {
      gsResults.hidden = true;
      gsResults.innerHTML = "";
      if (gsCount) gsCount.textContent = "";
      return;
    }

    const tokens = q.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const phrase = q.toLowerCase();
    const hits = TIPS
      .map((tip) => ({ tip, score: scoreTip(tip, tokens, phrase) }))
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    if (hits.length) {
      gsResults.innerHTML = `<ul class="gs-list">${hits.map((h) => gsItem(h.tip)).join("")}</ul>`;
      if (gsCount) gsCount.textContent = `${hits.length} fix${hits.length > 1 ? "es" : ""} found — best matches first`;
    } else {
      gsResults.innerHTML = `
        <div class="search-empty">
          <h3>We couldn't find that problem.</h3>
          <p>Try describing it differently — e.g. "my laptop is overheating" instead of "computer broken".</p>
          <a class="btn btn-primary" href="diagnose.html">Start diagnosis<span aria-hidden="true"> →</span></a>
          <p class="search-empty-alt"><a class="btn-link" href="ai.html">Or describe it to EmTech AI <span aria-hidden="true">↗</span></a></p>
        </div>`;
      if (gsCount) gsCount.textContent = "No matches — try the diagnosis instead";
    }
    gsResults.hidden = false;
  }

  if (gsInput && gsResults) {
    let debounce;
    gsInput.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(runGlobalSearch, 120);
    });
    gsInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        gsInput.value = "";
        runGlobalSearch();
      }
    });

    /* Nav "Search" item → focus the box instead of a dead anchor scroll. */
    document.querySelectorAll("[data-focus-search]").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        gsInput.focus({ preventScroll: false });
        if (gsInput.select) gsInput.select();
      });
    });

    /* Landing on index.html#search (from the fix pages' nav) → focus it. */
    if (location.hash === "#search") {
      gsInput.focus({ preventScroll: true });
    }
  }

  /* ---------- Fix list: live search + category jumps ---------- */
  const fixSearch = document.getElementById("fix-search");
  const fixCount = document.getElementById("fix-count");
  const accListEl = document.querySelector(".acc-list");

  function applyFilter(query) {
    if (!accListEl) return;
    const q = query.trim().toLowerCase();
    const items = Array.from(accListEl.querySelectorAll(".acc-item"));
    let shown = 0;
    items.forEach((item) => {
      const title = (item.querySelector(".acc-title") || {}).textContent || "";
      const desc = (item.querySelector(".acc-desc") || {}).textContent || "";
      const match = !q || (title + " " + desc).toLowerCase().includes(q);
      item.classList.toggle("hidden-fix", !match);
      if (q) setAcc(item, match, true); // while searching: open matches, close the rest (instant)
      if (match) shown++;
    });
    // Hide group / subgroup headings that no longer have a visible fix under them
    const kids = Array.from(accListEl.children);
    kids.forEach((el, i) => {
      if (!/^(H3|H4)$/.test(el.tagName)) return;
      let hasVisible = false;
      for (let j = i + 1; j < kids.length && !/^(H3|H4)$/.test(kids[j].tagName); j++) {
        if (kids[j].classList.contains("acc-item") && !kids[j].classList.contains("hidden-fix")) { hasVisible = true; break; }
      }
      el.classList.toggle("hidden-fix", !hasVisible);
    });
    if (fixCount) fixCount.textContent = q ? `${shown} of ${items.length} fixes match` : "";
    const emptyEl = document.getElementById("fix-search-empty");
    if (emptyEl) emptyEl.hidden = !(q && shown === 0);
  }

  if (fixSearch && accListEl) {
    fixSearch.addEventListener("input", () => applyFilter(fixSearch.value));
    document.addEventListener("keydown", (e) => {
      const tag = document.activeElement ? document.activeElement.tagName : "";
      if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) {
        e.preventDefault();
        fixSearch.focus();
      }
    });
  }

  /* ---------- Mark fixes as done (saved on this device) ---------- */
  const DONE_KEY = "emtech-done-v1";
  function loadDone() { try { return new Set(JSON.parse(localStorage.getItem(DONE_KEY) || "[]")); } catch (err) { return new Set(); } }
  function saveDone(set) { try { localStorage.setItem(DONE_KEY, JSON.stringify(Array.from(set))); } catch (err) {} }

  const doneSet = loadDone();
  function syncDoneBtn(item) {
    const btn = item.querySelector(".done-btn");
    if (!btn) return;
    const on = item.classList.contains("done");
    btn.setAttribute("aria-pressed", String(on));
    btn.querySelector(".lbl").textContent = on ? "Done — tap to undo" : "Mark as done";
  }

  document.querySelectorAll(".acc-item").forEach((item) => {
    if (doneSet.has(item.dataset.slug)) item.classList.add("done");
    syncDoneBtn(item);
  });

  /* ---------- "Did this fix it?" feedback (saved on this device) ---------- */
  const FEEDBACK_KEY = "emtech-feedback-v1";
  function loadFeedback() {
    try { return JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "{}") || {}; }
    catch (err) { return {}; }
  }
  function saveFeedback(map) {
    try { localStorage.setItem(FEEDBACK_KEY, JSON.stringify(map)); } catch (err) {}
  }

  const feedback = loadFeedback();

  function applyFeedbackState(item) {
    const box = item.querySelector(".fix-feedback");
    if (!box) return;
    const val = feedback[item.dataset.slug];
    box.querySelector(".ff-yes").setAttribute("aria-pressed", String(val === "yes"));
    box.querySelector(".ff-no").setAttribute("aria-pressed", String(val === "no"));
    const state = box.querySelector(".ff-state");
    if (val === "yes") {
      state.innerHTML = `<strong>Great — problem solved.</strong> Glad we could help. <a href="index.html#routine">Keep it that way with the monthly routine →</a>`;
    } else if (val === "no") {
      state.innerHTML = `<strong>Let's try another approach.</strong> The related fixes below are a good next stop, or <a href="diagnose.html">start a diagnosis →</a>`;
    } else {
      state.textContent = "";
    }
  }

  document.querySelectorAll(".acc-item").forEach(applyFeedbackState);

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".ff-btn");
    if (!btn) return;
    const item = btn.closest(".acc-item");
    if (!item) return;
    feedback[item.dataset.slug] = btn.classList.contains("ff-yes") ? "yes" : "no";
    saveFeedback(feedback);
    applyFeedbackState(item);
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".done-btn");
    if (!btn) return;
    const item = btn.closest(".acc-item");
    if (item.classList.contains("done")) doneSet.delete(item.dataset.slug);
    else doneSet.add(item.dataset.slug);
    saveDone(doneSet);
    item.classList.toggle("done", doneSet.has(item.dataset.slug));
    syncDoneBtn(item);
  });

  /* ---------- Print a single fix ---------- */
  function markPrintHeading(item) {
    // Keep the nearest group / subgroup heading above this fix so the
    // printout has context (e.g. "Speed · 8 fixes") without the whole list.
    let el = item.previousElementSibling;
    while (el && !/^(H3|H4)$/.test(el.tagName)) el = el.previousElementSibling;
    if (el) el.classList.add("print-keep");
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".print-btn");
    if (!btn) return;
    const item = btn.closest(".acc-item");
    setAcc(item, true);
    markPrintHeading(item);
    document.body.classList.add("printing-single");
    item.classList.add("print-target");
    window.print();
  });

  window.addEventListener("afterprint", () => {
    document.body.classList.remove("printing-single");
    document.querySelectorAll(".acc-item.print-target").forEach((i) => i.classList.remove("print-target"));
    document.querySelectorAll(".print-keep").forEach((h) => h.classList.remove("print-keep"));
  });

  /* ---------- Back to top ---------- */
  const toTop = document.getElementById("to-top");
  if (toTop) {
    const onScroll = () => toTop.classList.toggle("show", window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" }));
  }

  /* ---------- Theme toggle (light / dark) ---------- */
  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    const themeColorMeta = document.getElementById("meta-theme-color");
    const setTheme = (t) => {
      document.documentElement.dataset.theme = t;
      if (themeColorMeta) themeColorMeta.content = t === "dark" ? "#131210" : "#F1EEE6";
      try { localStorage.setItem("emtech-theme", t); } catch (err) {}
      themeToggle.setAttribute("aria-pressed", String(t === "dark"));
    };
    themeToggle.addEventListener("click", () => {
      setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    });
    themeToggle.setAttribute("aria-pressed", String(document.documentElement.dataset.theme === "dark"));
  }

  /* ---------- 04 Monthly routine checklist ---------- */
  const ROUTINE = [
    "disable-startup-bloat",
    "clean-up-temp-files-and-browser-cache-properly",
    "check-for-driver-updates-in-the-right-order",
    "run-a-disk-health-check-before-it-s-too-late",
    "back-up-properly-3-2-1-rule",
    "fix-a-pc-that-overheats-and-fans-like-a-jet-engine",
  ];

  /* Bind the homepage "Step monthly routine" stat to the actual routine
     length — same data-driven pattern as [data-tip-count] above, so the
     number can't drift if steps are added or removed. */
  document.querySelectorAll("[data-routine-count]").forEach((el) => {
    if (el.hasAttribute("data-count")) el.dataset.count = String(ROUTINE.length);
    else el.textContent = String(ROUTINE.length);
  });

  const checklistEl = document.getElementById("checklist");
  const progressEl = document.getElementById("routine-progress");
  const fillEl = document.getElementById("routine-fill");
  const resetBtn = document.getElementById("routine-reset");

  function loadRoutine() {
    try { return new Set(JSON.parse(localStorage.getItem(ROUTINE_KEY) || "[]")); }
    catch (err) { return new Set(); }
  }

  function saveRoutine(done) {
    try { localStorage.setItem(ROUTINE_KEY, JSON.stringify(Array.from(done))); }
    catch (err) { /* private mode — progress just won't persist */ }
  }

  function renderChecklist() {
    if (!checklistEl) return;
    const done = loadRoutine();

    checklistEl.innerHTML = ROUTINE.map((slug, i) => {
      const tip = findTip(slug);
      if (!tip) return "";
      return `
        <li class="check-item">
          <label>
            <input type="checkbox" data-slug="${esc(slug)}" ${done.has(slug) ? "checked" : ""} />
            <span class="box" aria-hidden="true"></span>
            <span class="check-num" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>
            <span class="check-text"><strong>${esc(tip.title)}</strong><small>${esc(tip.time)} · ${LEVELS[tip.difficulty] || ""}</small></span>
          </label>
        </li>`;
    }).join("");

    updateProgress();
  }

  // Delegated, and bound exactly once. Binding this inside renderChecklist()
  // meant a second render would stack a duplicate handler on the same
  // container, and every tick would then be counted twice.
  if (checklistEl) {
    checklistEl.addEventListener("change", (e) => {
      const input = e.target.closest('input[type="checkbox"]');
      if (!input) return;
      const current = loadRoutine();
      if (input.checked) current.add(input.dataset.slug);
      else current.delete(input.dataset.slug);
      saveRoutine(current);
      updateProgress();
    });
  }

  function updateProgress() {
    if (!checklistEl || !progressEl) return;
    const boxes = checklistEl.querySelectorAll('input[type="checkbox"]');
    const n = Array.from(boxes).filter((b) => b.checked).length;
    const total = boxes.length;
    progressEl.textContent = n === total && total > 0
      ? `All ${ROUTINE.length} done — nice work. See you next month.`
      : `${n} of ${total} done`;
    if (fillEl) fillEl.style.width = total ? ((n / total) * 100).toFixed(1) + "%" : "0%";
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      saveRoutine(new Set());
      checklistEl.querySelectorAll('input[type="checkbox"]').forEach((b) => { b.checked = false; });
      updateProgress();
    });
  }

  renderChecklist();

  /* ---------- Deep-link opener: windows.html#slug / mac.html#slug ---------- */
  function openHashedTip() {
    const slug = location.hash.slice(1);
    if (!slug) return;
    const item = document.querySelector(`.acc-item[data-slug="${CSS.escape(slug)}"]`);
    if (item) {
      toggleAcc(item, true);
      setCrumb(findTip(slug));
      // Let the expand animation settle before scrolling + flashing.
      setTimeout(() => {
        item.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
        item.classList.add("flash");
        setTimeout(() => item.classList.remove("flash"), 1400);
      }, prefersReducedMotion ? 60 : ACC_CLOSE_MS + 80);
      return;
    }
    // Category / group anchors (#cat-speed, #sub-fixes) — scroll to the heading.
    const target = document.getElementById(slug);
    if (!target) return;
    target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
  }

  openHashedTip();
  window.addEventListener("hashchange", openHashedTip);

  /* ---------- Scroll reveal + staggered lists ---------- */
  const revealEls = document.querySelectorAll(".reveal");

  document
    .querySelectorAll(".index-list > li, .process-list > li")
    .forEach((el) => {
      const idx = Array.from(el.parentElement.children).indexOf(el);
      el.style.transitionDelay = (idx * 60) + "ms";
    });

  if ("IntersectionObserver" in window && !prefersReducedMotion) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -36px 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in-view"));
  }

  /* ---------- Animated stat counters ---------- */
  const counters = document.querySelectorAll("[data-count]");
  const animateCount = (el) => {
    const target = parseInt(el.dataset.count, 10);
    if (prefersReducedMotion || !("requestAnimationFrame" in window)) {
      el.textContent = String(target);
      return;
    }
    const duration = 1300; // ms
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      el.textContent = String(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  if ("IntersectionObserver" in window) {
    const cio = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            cio.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    counters.forEach((el) => cio.observe(el));
  } else {
    counters.forEach(animateCount);
  }

  /* ---------- Scrollspy: underline the active nav link ---------- */
  const spyLinks = Array.from(document.querySelectorAll(".primary-nav a[href^='#']"));
  if ("IntersectionObserver" in window && spyLinks.length) {
    const sectionToLink = new Map();
    spyLinks.forEach((a) => {
      const sec = document.querySelector(a.getAttribute("href"));
      if (sec) sectionToLink.set(sec, a);
    });
    const sio = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          spyLinks.forEach((a) => a.classList.remove("active"));
          const link = sectionToLink.get(entry.target);
          if (link) link.classList.add("active");
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    sectionToLink.forEach((_link, sec) => sio.observe(sec));
  }

  /* ---------- Footer year ---------- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
