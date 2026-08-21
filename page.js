/* ============================================================
   EmTech Media — page.js
   Site chrome that EVERY page needs, and nothing else:
     mobile nav · back to top · theme toggle · scroll reveal
     stat counters · scrollspy · footer year

   Deliberately free of any TIPS dependency. Static fix pages load
   ONLY this file (~4 KB) instead of tips-data.js (124 KB) + script.js
   (44 KB), which they were paying for to get a theme toggle.

   LOAD ORDER: on pages that also load script.js, this file must come
   LAST. script.js renders cards into the grids (and fills [data-count]
   from the library) — the reveal/counter observers below must not run
   until that markup exists, which is exactly the order these blocks
   ran in when they lived at the foot of script.js.
   ============================================================ */

(function () {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  /* ---------- Animated stat counters ----------
     Reads data-count, which script.js fills from the library on pages
     that have one. Static pages carry no [data-count] at all. */
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
