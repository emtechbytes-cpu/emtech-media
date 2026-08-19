/* ============================================================
   EmTech Media — Phase 2 diagnostic data layer (no DOM, no logic)

   This file is pure data. The engine (diag-engine.js) reads it; the UI
   (diag-ui.js) renders from engine state. To add a new diagnostic path:
     1. Add causes + questions below (or reuse existing question ids).
     2. Point cause.fix / cause.alt at real tip slugs (tips-data.js).
   Nothing else needs to change — the engine and UI are generic.

   Cause ids are globally unique ("profileId-key") so shared questions can
   score causes from any profile without collisions. Question option scores
   reference these full ids; the engine ignores ids outside the active
   profile, so one question set can safely serve several profiles.

   A future AI classification layer (Phase 3+) replaces only the scoring
   step in diag-engine.js — this data shape is what it would consume.
   ============================================================ */

(typeof window !== "undefined" ? window : globalThis).EMTECH_DIAG_DATA = {
  version: "2026-08",

  /* ---------- Step 1: device ---------- */
  devices: [
    { id: "windows", label: "Windows PC", sub: "Windows 11 · Windows 10" },
    { id: "mac", label: "Mac", sub: "MacBook · iMac / Mac desktop" },
    { id: "other", label: "Other computer", sub: "Linux, Chromebook — or not sure" },
  ],

  /* ---------- Step 2: problem category ----------
     `platforms` = which device selections this category is offered for.
     A category only appears when real fixes exist behind it (spec §5). */
  categories: [
    { id: "performance", label: "Performance", icon: "⚡", platforms: ["windows", "mac", "other"] },
    { id: "overheating", label: "Overheating", icon: "🔥", platforms: ["windows"] },
    { id: "network", label: "Internet / Wi-Fi", icon: "📶", platforms: ["windows", "mac", "other"] },
    { id: "storage", label: "Storage", icon: "💾", platforms: ["windows", "mac", "other"] },
    { id: "audio", label: "Audio & camera", icon: "🔊", platforms: ["windows"] },
    { id: "updates", label: "Updates", icon: "🔄", platforms: ["windows", "mac"] },
    { id: "crashes", label: "Crashes / Errors", icon: "💥", platforms: ["windows", "mac", "other"] },
    { id: "gaming", label: "Gaming", icon: "🎮", platforms: ["windows"] },
    { id: "security", label: "Security", icon: "🛡", platforms: ["windows", "mac"] },
    { id: "hardware", label: "Hardware & upgrades", icon: "🔌", platforms: ["windows", "mac"] },
    { id: "something-else", label: "Something else", icon: "❓", platforms: ["windows", "mac", "other"] },
  ],

  /* ---------- Landing screen: popular problem starters (spec §3) ---------- */
  starters: [
    { label: "My PC is slow", device: "windows", category: "performance" },
    { label: "My computer is overheating", device: "windows", category: "overheating" },
    { label: "Wi-Fi isn't working", category: "network" },
    { label: "Windows keeps crashing", device: "windows", category: "crashes" },
    { label: "My Mac is slow", device: "mac", category: "performance" },
    { label: "Games are lagging", device: "windows", category: "gaming" },
    { label: "My computer won't start", category: "crashes" },
    { label: "I'm running out of storage", category: "storage" },
  ],

  /* ---------- Problem profiles (one per device × category) ----------
     causes[].fix / alt must be real slugs from tips-data.js.
     keywords are matched against the user's free-text description. */
  profiles: [
    /* ============ WINDOWS ============ */
    {
      id: "win-performance", devices: ["windows"], category: "performance",
      causes: [
        { id: "win-performance-memory", label: "Memory pressure — too much running at once", fix: "hunt-down-memory-hogs", alt: ["fix-my-pc-is-slow-all-of-a-sudden-the-order-of-attack", "disable-startup-bloat"], keywords: ["slow", "slower", "lag", "freez", "tabs", "apps", "browser"] },
        { id: "win-performance-background", label: "Background processes or a recent change eating resources", fix: "fix-my-pc-is-slow-all-of-a-sudden-the-order-of-attack", alt: ["hunt-down-memory-hogs"], keywords: ["suddenly", "recently", "days", "after update"] },
        { id: "win-performance-startup", label: "Apps launching at boot are slowing everything down", fix: "disable-startup-bloat", alt: ["switch-the-power-plan-to-best-performance"], keywords: ["startup", "boot", "start up", "restart"] },
        { id: "win-performance-disk", label: "The drive is nearly full or struggling", fix: "let-windows-storage-sense-do-the-work-for-you", alt: ["clean-up-temp-files-and-browser-cache-properly"], keywords: ["storage", "space", "disk", "full"] },
      ],
      questions: ["perf-when", "perf-scope", "perf-worsens", "perf-change"],
    },
    {
      id: "win-overheating", devices: ["windows"], category: "overheating",
      causes: [
        { id: "win-overheat-dust", label: "Dust and heat buildup — the usual suspect", fix: "fix-a-pc-that-overheats-and-fans-like-a-jet-engine", alt: ["fix-a-hot-pc-for-good-the-airflow-pass"], keywords: ["hot", "overheat", "fans", "loud"] },
        { id: "win-overheat-airflow", label: "Blocked airflow or a failing fan", fix: "fix-a-hot-pc-for-good-the-airflow-pass", alt: ["fix-a-pc-that-overheats-and-fans-like-a-jet-engine"], keywords: ["fan", "vent", "air"] },
        { id: "win-overheat-load", label: "Something is working hard in the background", fix: "hunt-down-memory-hogs", alt: ["switch-the-power-plan-to-best-performance"], keywords: ["slow when hot", "throttl", "slower when"] },
        { id: "win-overheat-battery", label: "Battery wear making a laptop run hotter", fix: "make-your-laptop-battery-last-longer", alt: [], keywords: ["battery", "laptop"] },
      ],
      questions: ["heat-idle", "heat-where", "heat-history"],
    },
    {
      id: "win-network", devices: ["windows"], category: "network",
      causes: [
        { id: "win-net-off", label: "Wi-Fi is switched off or the adapter is disabled", fix: "wi-fi-off-or-missing-the-three-switches-that-disable-it", alt: ["slow-internet-run-the-five-minute-test"], keywords: ["wifi off", "no wifi", "wireless missing", "adapter disabled"] },
        { id: "win-net-dns", label: "Connected to Wi-Fi but no internet — DNS or network stack", fix: "connected-but-no-internet-the-safe-dns-and-stack-reset", alt: ["slow-internet-run-the-five-minute-test"], keywords: ["no internet", "connected but", "dns", "pages won't load"] },
        { id: "win-net-sleep", label: "Sleep/wake is glitching the network adapter", fix: "stop-your-pc-from-sleep-glitching-your-network", alt: ["slow-internet-run-the-five-minute-test"], keywords: ["disconnect", "drops", "after sleep", "wake"] },
        { id: "win-net-speed", label: "The connection itself is slow or unstable", fix: "slow-internet-run-the-five-minute-test", alt: [], keywords: ["slow internet", "speed", "buffering", "streaming"] },
        { id: "win-net-router", label: "Router or Wi-Fi setup affecting several devices", fix: "lock-down-your-home-wi-fi-properly", alt: ["slow-internet-run-the-five-minute-test"], keywords: ["router", "all devices", "whole house"] },
      ],
      questions: ["net-state", "net-when", "net-scope", "net-wired"],
    },
    {
      id: "win-storage", devices: ["windows"], category: "storage",
      causes: [
        { id: "win-store-temp", label: "Temp files and browser cache piling up", fix: "clean-up-temp-files-and-browser-cache-properly", alt: ["let-windows-storage-sense-do-the-work-for-you"], keywords: ["full", "space", "temp"] },
        { id: "win-store-sense", label: "No automatic cleanup running at all", fix: "let-windows-storage-sense-do-the-work-for-you", alt: ["run-drive-optimization-the-safe-way"], keywords: ["storage sense", "cleanup", "clean up"] },
        { id: "win-store-apps", label: "Apps you never use taking the space", fix: "uninstall-the-apps-you-never-use", alt: [], keywords: ["apps", "programs", "bloatware"] },
        { id: "win-store-recover", label: "A deleted file you want back", fix: "get-back-a-file-you-deleted-by-mistake", alt: [], keywords: ["deleted", "lost a file", "recycle bin"] },
        { id: "win-store-fail", label: "The drive itself is failing or acting up", fix: "run-a-disk-health-check-before-it-s-too-late", alt: ["back-up-properly-3-2-1-rule"], keywords: ["clicking", "drive failing", "disk errors", "slow reads"] },
      ],
      questions: ["store-space", "store-what", "store-lost"],
    },
    {
      id: "win-audio", devices: ["windows"], category: "audio",
      causes: [
        { id: "win-audio-sound", label: "Audio output has gone quiet", fix: "no-sound-the-four-minute-fix", alt: [], keywords: ["sound", "silent", "speakers", "headphones"] },
        { id: "win-audio-mic", label: "Your microphone isn't being heard", fix: "fix-a-microphone-no-one-can-hear", alt: [], keywords: ["microphone", "mic", "mute"] },
        { id: "win-audio-cam", label: "The camera won't turn on", fix: "fix-a-webcam-that-won-t-turn-on", alt: [], keywords: ["camera", "webcam", "black square"] },
      ],
      questions: ["audio-what", "audio-when"],
    },
    {
      id: "win-updates", devices: ["windows"], category: "updates",
      causes: [
        { id: "win-upd-odd", label: "Windows restarting you at odd hours", fix: "stop-windows-updates-at-odd-hours", alt: [], keywords: ["restarts", "3am", "night", "active hours"] },
        { id: "win-upd-fail", label: "Updates stuck or failing to install", fix: "repair-corrupted-system-files", alt: ["start-windows-in-safe-mode"], keywords: ["stuck", "failing", "error", "loop"] },
        { id: "win-upd-eol", label: "Running Windows 10 past end of support", fix: "windows-10-is-past-end-of-support-what-to-do-now", alt: ["check-whether-your-pc-can-run-windows-11"], keywords: ["windows 10", "end of support", "upgrade"] },
      ],
      questions: ["upd-what", "upd-version"],
    },
    {
      id: "win-crashes", devices: ["windows"], category: "crashes",
      causes: [
        { id: "win-crash-power", label: "No power at all — the PC isn't even trying to start", fix: "pc-won-t-turn-on-run-the-five-minute-power-check", alt: ["fix-a-pc-that-won-t-start-up"], keywords: ["won't turn on", "no power", "dead pc", "no lights", "no fans"] },
        { id: "win-crash-signal", label: "The display signal path — cable, input source or projection mode", fix: "black-screen-check-the-display-signal-path-first", alt: ["check-for-driver-updates-in-the-right-order"], keywords: ["no signal", "external monitor", "second screen"] },
        { id: "win-crash-gpu", label: "A GPU or display driver fault, often after an update", fix: "check-for-driver-updates-in-the-right-order", alt: ["start-windows-in-safe-mode"], keywords: ["after update", "gpu", "graphics driver"] },
        { id: "win-crash-bsod", label: "Blue screens (BSOD) — a driver or memory issue", fix: "fix-a-blue-screen-bsod-without-panicking", alt: ["start-windows-in-safe-mode"], keywords: ["blue screen", "bsod", "crash code"] },
        { id: "win-crash-boot", label: "The PC won't get past startup", fix: "fix-a-pc-that-won-t-start-up", alt: ["start-windows-in-safe-mode"], keywords: ["won't start", "black screen", "logo", "spinning"] },
        { id: "win-corrupt-files", label: "Corrupted system files causing glitches", fix: "repair-corrupted-system-files", alt: ["start-windows-in-safe-mode"], keywords: ["glitch", "corrupt", "weird", "misbehav"] },
      ],
      questions: ["crash-power", "crash-screen", "crash-what", "crash-when"],
    },
    {
      id: "win-gaming", devices: ["windows"], category: "gaming",
      causes: [
        { id: "win-game-stutter", label: "Random stuttering and lag spikes in games", fix: "stop-games-stuttering-the-5-point-checklist", alt: ["raise-your-effective-fps-with-windows-game-mode"], keywords: ["stutter", "lag spike", "freezes in game"] },
        { id: "win-game-fps", label: "Low frame rates overall", fix: "raise-your-effective-fps-with-windows-game-mode", alt: ["stop-games-stuttering-the-5-point-checklist"], keywords: ["fps", "frames", "low performance"] },
        { id: "win-game-lag", label: "Input lag — actions feel delayed", fix: "reduce-input-lag-in-competitive-games", alt: [], keywords: ["input lag", "delay", "responsive"] },
      ],
      questions: ["game-what", "game-where"],
    },
    {
      id: "win-security", devices: ["windows"], category: "security",
      causes: [
        { id: "win-sec-optimizer", label: "'PC optimizer' or bundleware acting up", fix: "kill-shady-pc-optimizer-software", alt: ["dodge-bundleware-when-you-install-anything", "uninstall-the-apps-you-never-use"], keywords: ["pop-up", "popup", "virus claim", "optimizer", "junk"] },
        { id: "win-sec-phish", label: "Suspicious emails and links", fix: "spot-a-phishing-email-before-you-click", alt: ["tighten-up-edge-and-firefox"], keywords: ["phishing", "suspicious email", "scam"] },
        { id: "win-sec-harden", label: "General hardening — accounts, firewall, backups", fix: "hardening-accounts-updates-and-the-firewall", alt: ["protect-against-ransomware-before-it-s-too-late"], keywords: ["ransomware", "secure", "safe", "privacy"] },
      ],
      questions: ["sec-what", "sec-history"],
    },
    {
      id: "win-hardware", devices: ["windows"], category: "hardware",
      causes: [
        { id: "win-hw-ram", label: "Not enough RAM for what you run", fix: "upgrade-your-ram-and-match-it", alt: [], keywords: ["ram", "memory upgrade"] },
        { id: "win-hw-ssd", label: "A slow hard drive holding everything back", fix: "move-your-os-or-games-to-an-ssd", alt: ["pick-an-ssd-that-s-actually-fast"], keywords: ["ssd", "hard drive", "slow loading"] },
        { id: "win-hw-battery", label: "Battery life has dropped off", fix: "make-your-laptop-battery-last-longer", alt: [], keywords: ["battery", "charge", "laptop"] },
        { id: "win-hw-device", label: "A peripheral (printer, mic, camera) not working", fix: "fix-a-printer-that-won-t-print", alt: ["fix-a-microphone-no-one-can-hear", "fix-a-webcam-that-won-t-turn-on"], keywords: ["printer", "usb", "device"] },
        { id: "win-hw-bt", label: "A Bluetooth device won't pair or keeps dropping", fix: "bluetooth-won-t-connect-the-pairing-reset-that-works", alt: ["check-for-driver-updates-in-the-right-order"], keywords: ["bluetooth", "headset", "earbuds"] },
        { id: "win-hw-monitor", label: "An external monitor isn't detected or shows no signal", fix: "black-screen-check-the-display-signal-path-first", alt: ["check-for-driver-updates-in-the-right-order"], keywords: ["external monitor", "second screen", "monitor not detected"] },
        { id: "win-hw-usb", label: "A USB device (keyboard, mouse, drive) isn't recognised", fix: "usb-device-not-recognised-the-device-manager-pass", alt: [], keywords: ["not recognised", "keyboard stopped", "mouse stopped"] },
      ],
      questions: ["hw-what"],
    },

    /* ============ MAC ============ */
    {
      id: "mac-performance", devices: ["mac"], category: "performance",
      causes: [
        { id: "mac-perf-apps", label: "Too much running in the background", fix: "speed-up-a-sluggish-macbook", alt: [], keywords: ["slow", "sluggish", "lag", "freez"] },
        { id: "mac-perf-login", label: "Apps launching at login adding up", fix: "stop-apps-from-launching-at-login", alt: ["speed-up-a-sluggish-macbook"], keywords: ["login", "startup", "boot"] },
        { id: "mac-perf-disk", label: "The drive is nearly full", fix: "free-up-disk-space-with-storage-management", alt: ["keep-10-of-your-disk-free"], keywords: ["storage", "space", "disk", "full"] },
        { id: "mac-perf-index", label: "Spotlight or background indexing working hard", fix: "tame-spotlight-indexing-on-extra-drives", alt: [], keywords: ["spotlight", "search", "external drive"] },
      ],
      questions: ["perf-when", "perf-scope", "mac-space"],
    },
    {
      id: "mac-network", devices: ["mac"], category: "network",
      causes: [
        { id: "mac-net-wifi", label: "Wi-Fi performance on this Mac", fix: "fix-slow-wi-fi-on-your-mac", alt: [], keywords: ["wifi", "wi-fi", "disconnect", "slow internet"] },
      ],
      questions: ["net-when", "net-scope"],
    },
    {
      id: "mac-storage", devices: ["mac"], category: "storage",
      causes: [
        { id: "mac-store-space", label: "The internal drive is running low on space", fix: "free-up-disk-space-with-storage-management", alt: ["keep-10-of-your-disk-free"], keywords: ["full", "space", "storage"] },
        { id: "mac-store-safari", label: "Safari cache and downloads piling up", fix: "give-safari-a-proper-clean-out", alt: [], keywords: ["safari", "cache", "downloads"] },
        { id: "mac-store-drives", label: "An external drive acting up", fix: "run-first-aid-on-external-drives", alt: [], keywords: ["external", "usb drive", "time machine disk"] },
      ],
      questions: ["store-space", "store-what"],
    },
    {
      id: "mac-updates", devices: ["mac"], category: "updates",
      causes: [
        { id: "mac-upd-safe", label: "Keeping macOS current without surprises", fix: "keep-macos-updated-the-safe-way", alt: [], keywords: ["update", "upgrade", "new version"] },
        { id: "mac-upd-backup", label: "Backing up before an update (or in general)", fix: "set-up-time-machine-properly", alt: [], keywords: ["backup", "time machine", "lose data"] },
      ],
      questions: ["upd-what"],
    },
    {
      id: "mac-crashes", devices: ["mac"], category: "crashes",
      causes: [
        { id: "mac-crash-frozen", label: "Apps freezing or beachballing", fix: "force-quit-a-frozen-app", alt: ["speed-up-a-sluggish-macbook"], keywords: ["frozen", "beachball", "not responding"] },
        { id: "mac-crash-boot", label: "The Mac won't start up properly", fix: "fix-a-mac-that-won-t-start-up", alt: ["reset-nvram-when-things-misbehave"], keywords: ["won't start", "black screen", "boot"] },
        { id: "mac-crash-gatekeeper", label: "An app blocked by Gatekeeper", fix: "open-apps-blocked-by-gatekeeper", alt: [], keywords: ["gatekeeper", "unverified developer", "blocked"] },
      ],
      questions: ["crash-what"],
    },
    {
      id: "mac-security", devices: ["mac"], category: "security",
      causes: [
        { id: "mac-sec-backup", label: "A backup that actually works (Time Machine)", fix: "set-up-time-machine-properly", alt: [], keywords: ["backup", "time machine", "lose data"] },
        { id: "mac-sec-encrypt", label: "Full-disk encryption for lost/stolen protection", fix: "turn-on-filevault-full-disk-encryption", alt: [], keywords: ["encryption", "filevault", "stolen", "lost"] },
        { id: "mac-sec-updates", label: "Staying patched against known issues", fix: "keep-macos-updated-the-safe-way", alt: [], keywords: ["updates", "security update", "patched"] },
      ],
      questions: ["sec-what"],
    },
    {
      id: "mac-hardware", devices: ["mac"], category: "hardware",
      causes: [
        { id: "mac-hw-battery", label: "Battery health and longevity", fix: "keep-your-mac-battery-healthy", alt: [], keywords: ["battery", "charge"] },
        { id: "mac-hw-drives", label: "External drives — First Aid and setup", fix: "run-first-aid-on-external-drives", alt: [], keywords: ["external drive", "usb", "time machine disk"] },
      ],
      questions: ["hw-mac-what"],
    },

    /* ============ OTHER DEVICE (merged, both platforms tagged in UI) ============ */
    {
      id: "oth-performance", devices: ["other"], category: "performance",
      causes: [
        { id: "oth-perf-memory", label: "Too much running at once — memory pressure", fix: "hunt-down-memory-hogs", alt: ["speed-up-a-sluggish-macbook"], keywords: ["slow", "slower", "lag", "freez"] },
        { id: "oth-perf-startup", label: "Apps launching at boot adding up", fix: "disable-startup-bloat", alt: ["stop-apps-from-launching-at-login"], keywords: ["startup", "boot", "login"] },
        { id: "oth-perf-disk", label: "The drive is nearly full", fix: "clean-up-temp-files-and-browser-cache-properly", alt: ["free-up-disk-space-with-storage-management"], keywords: ["storage", "space", "disk", "full"] },
      ],
      questions: ["perf-when", "perf-scope"],
    },
    {
      id: "oth-network", devices: ["other"], category: "network",
      causes: [
        { id: "oth-net-wifi", label: "Wi-Fi dropping or slowing down", fix: "stop-your-pc-from-sleep-glitching-your-network", alt: ["fix-slow-wi-fi-on-your-mac"], keywords: ["wifi", "wi-fi", "disconnect", "drops"] },
        { id: "oth-net-speed", label: "The connection itself is slow", fix: "slow-internet-run-the-five-minute-test", alt: [], keywords: ["slow internet", "speed", "buffering"] },
      ],
      questions: ["net-when", "net-scope"],
    },
    {
      id: "oth-storage", devices: ["other"], category: "storage",
      causes: [
        { id: "oth-store-temp", label: "Temp files, cache and unused apps piling up", fix: "clean-up-temp-files-and-browser-cache-properly", alt: ["free-up-disk-space-with-storage-management", "uninstall-the-apps-you-never-use"], keywords: ["full", "space", "storage"] },
      ],
      questions: ["store-space"],
    },
    {
      id: "oth-crashes", devices: ["other"], category: "crashes",
      causes: [
        { id: "oth-crash-bsod", label: "Crashes, blue screens or failed startups", fix: "fix-a-blue-screen-bsod-without-panicking", alt: ["fix-a-mac-that-won-t-start-up"], keywords: ["blue screen", "crash", "won't start"] },
        { id: "oth-crash-corrupt", label: "Corrupted files or odd misbehaviour", fix: "repair-corrupted-system-files", alt: ["reset-nvram-when-things-misbehave"], keywords: ["glitch", "corrupt", "weird"] },
      ],
      questions: ["crash-what"],
    },
  ],

  /* ---------- Question bank (shared across profiles) ----------
     score maps use full cause ids. `reason` (optional) is shown under
     "Why we think this" only when that option was actually chosen. */
  questions: {
    "perf-when": {
      q: "When did it start feeling slow?",
      desc: "This helps us guess what changed.",
      options: [
        { label: "Today", value: "today", score: { "win-performance-background": 2, "oth-perf-memory": 1 }, reason: "It started suddenly — that usually points to a recent change." },
        { label: "A few days ago", value: "days", score: { "win-performance-memory": 1, "win-performance-background": 1, "mac-perf-apps": 1 }, reason: "A gradual slowdown over days often means background load is building up." },
        { label: "A few weeks or more", value: "weeks", score: { "win-performance-startup": 1, "win-performance-memory": 1, "oth-perf-startup": 1 }, reason: "Longer-term drift commonly traces back to startup apps and accumulated load." },
        { label: "It's always been slow", value: "always", score: { "win-performance-disk": 2, "mac-perf-disk": 1, "oth-perf-disk": 1 }, reason: "Long-standing slowness often traces back to the drive itself." },
        { label: "I'm not sure", value: "unsure" },
      ],
    },
    "perf-scope": {
      q: "Is everything slow, or only certain things?",
      desc: "",
      options: [
        { label: "Everything is slow", value: "everything", score: { "win-performance-memory": 2, "win-performance-background": 2, "mac-perf-apps": 2, "oth-perf-memory": 2 }, reason: "You said everything feels affected — that points at system-wide load." },
        { label: "Only certain apps", value: "apps", score: { "win-performance-memory": 1, "mac-perf-apps": 1 } },
        { label: "Mainly when starting the computer", value: "startup", score: { "win-performance-startup": 3, "oth-perf-startup": 2, "mac-perf-login": 2 }, reason: "Slow starts point at what launches at boot." },
        { label: "Only when gaming", value: "gaming" },
      ],
    },
    "perf-worsens": {
      q: "Does it get worse after you've been using it for a while?",
      desc: "",
      options: [
        { label: "Yes, it creeps slower over time", value: "yes", score: { "win-performance-memory": 3 }, reason: "Getting slower the longer it runs is a classic sign of memory pressure." },
        { label: "No, it's slow from the moment I start it", value: "no", score: { "win-performance-disk": 2, "win-performance-startup": 1 } },
        { label: "Not sure", value: "unsure" },
      ],
    },
    "perf-change": {
      q: "Did you install anything or make changes before it happened?",
      desc: "",
      showIf: { q: "perf-when", is: ["today", "days"] },
      options: [
        { label: "Yes, I installed something new", value: "yes", score: { "win-performance-background": 2, "win-performance-startup": 1 }, reason: "A recent install is a strong candidate for the slowdown." },
        { label: "There was an update", value: "update", score: { "win-performance-background": 2 } },
        { label: "No changes that I know of", value: "no", score: { "win-performance-memory": 1, "win-performance-disk": 1 } },
      ],
    },

    "heat-idle": {
      q: "Does it get hot even when you're not doing much?",
      desc: "",
      options: [
        { label: "Yes, hot and loud at idle", value: "yes", score: { "win-overheat-dust": 2, "win-overheat-airflow": 1 }, reason: "Heat at idle usually means dust or a struggling fan." },
        { label: "Only when I'm using it hard", value: "load", score: { "win-overheat-load": 3 }, reason: "Heat under load can be normal — but something working harder than it should is worth checking." },
        { label: "Not sure", value: "unsure" },
      ],
    },
    "heat-where": {
      q: "Where do you feel the heat most?",
      desc: "",
      options: [
        { label: "Bottom and around the vents", value: "vents", score: { "win-overheat-airflow": 2, "win-overheat-dust": 1 }, reason: "Hot vents suggest airflow is being blocked." },
        { label: "Everywhere, including the keyboard", value: "everywhere", score: { "win-overheat-dust": 1, "win-overheat-load": 1 } },
        { label: "I haven't checked", value: "unsure" },
      ],
    },
    "heat-history": {
      q: "Has it been cleaned or opened up before?",
      desc: "",
      options: [
        { label: "Never — it's had no service", value: "never", score: { "win-overheat-dust": 2 }, reason: "A machine that's never been cleaned is the most common overheating case." },
        { label: "It was cleaned but still runs hot", value: "cleaned", score: { "win-overheat-airflow": 2, "win-overheat-battery": 1 } },
        { label: "Not sure / it's a laptop I bought used", value: "unsure" },
      ],
    },

    "net-state": {
      q: "Is Wi-Fi completely off or missing — or are you connected but can't get online?",
      desc: "This splits 'no Wi-Fi at all' from 'connected but no internet'.",
      options: [
        { label: "Wi-Fi is off / the option is missing", value: "off", score: { "win-net-off": 3 }, reason: "A switched-off or vanished adapter has three usual culprits — and they're all quick to check." },
        { label: "I'm connected, but pages won't load", value: "connected-nointernet", score: { "win-net-dns": 3 }, reason: "Connected-but-no-internet usually means DNS or the network stack needs a safe reset." },
        { label: "It drops in and out", value: "drops", score: { "win-net-sleep": 2, "win-net-speed": 1 } },
        { label: "Not sure", value: "unsure" },
      ],
    },
    "net-when": {
      q: "When does the connection drop or slow down?",
      desc: "",
      options: [
        { label: "After sleep or waking up", value: "sleep", score: { "win-net-sleep": 3, "oth-net-wifi": 1 }, reason: "Drops after wake-up point at the network adapter resetting." },
        { label: "Randomly, at any time", value: "random", score: { "win-net-speed": 1, "win-net-router": 1, "mac-net-wifi": 2, "oth-net-wifi": 1 } },
        { label: "It's just always slow now", value: "always", score: { "win-net-speed": 2, "mac-net-wifi": 1, "oth-net-speed": 2 } },
      ],
    },
    "net-scope": {
      q: "Does it affect other devices too?",
      desc: "",
      options: [
        { label: "Just this computer", value: "one", score: { "win-net-sleep": 2, "win-net-speed": 1, "mac-net-wifi": 2 }, reason: "If only one device is affected, the problem lives on that machine." },
        { label: "Several devices are affected", value: "many", score: { "win-net-router": 3 }, reason: "Multiple devices dropping points at the router or Wi-Fi setup." },
        { label: "Not sure", value: "unsure" },
      ],
    },
    "net-wired": {
      q: "Does a wired (Ethernet) connection work fine?",
      desc: "",
      options: [
        { label: "Yes, wired is fine — only Wi-Fi misbehaves", value: "wired-ok", score: { "win-net-sleep": 2 }, reason: "Wired working while Wi-Fi fails narrows it to the wireless adapter." },
        { label: "No, both are slow or dropping", value: "both-bad", score: { "win-net-router": 2 } },
        { label: "I don't use wired", value: "none" },
      ],
    },

    "store-space": {
      q: "How much free storage do you have?",
      desc: "",
      options: [
        { label: "Less than 10 GB", value: "low", score: { "win-store-temp": 2, "win-store-sense": 2, "mac-store-space": 3, "oth-store-temp": 2 }, reason: "Under ~10 GB free, the system starts struggling — cleanup is step one." },
        { label: "10–50 GB", value: "mid", score: { "win-store-sense": 1, "win-store-temp": 1, "mac-store-space": 1 } },
        { label: "More than 50 GB", value: "high", score: { "win-store-apps": 1, "mac-store-safari": 1 } },
        { label: "I don't know", value: "unsure" },
      ],
    },
    "store-what": {
      q: "What's the main symptom?",
      desc: "",
      options: [
        { label: "'Not enough space' warnings everywhere", value: "warnings", score: { "win-store-temp": 2, "mac-store-space": 1 } },
        { label: "Apps complaining or refusing to save", value: "apps", score: { "win-store-apps": 2, "mac-store-safari": 1 } },
        { label: "An external drive acting up", value: "external", score: { "mac-store-drives": 3 } },
        { label: "The drive is slow, clicking or throwing errors", value: "failing", score: { "win-store-fail": 3 } },
      ],
    },
    "store-lost": {
      q: "Did you delete something by mistake that you want back?",
      desc: "",
      options: [
        { label: "Yes — I need to recover a file", value: "yes", score: { "win-store-recover": 3 }, reason: "Recovery works best the sooner you start, so this comes first." },
        { label: "No, just running out of space", value: "no" },
      ],
    },

    "audio-what": {
      q: "What exactly isn't working?",
      desc: "",
      options: [
        { label: "Speakers or headphones are silent", value: "sound", score: { "win-audio-sound": 3 }, reason: "Silent output has a short, well-tested fix list." },
        { label: "My microphone isn't being heard", value: "mic", score: { "win-audio-mic": 3 }, reason: "Mic issues are usually a device or permission setting." },
        { label: "The camera shows a black square", value: "cam", score: { "win-audio-cam": 3 }, reason: "Camera failures are usually privacy settings or the driver." },
        { label: "All of it — calls go one way", value: "all", score: { "win-audio-sound": 2, "win-audio-mic": 1, "win-audio-cam": 1 } },
      ],
    },
    "audio-when": {
      q: "Did it stop working after an update or restart?",
      desc: "",
      options: [
        { label: "Yes, right after a change", value: "yes", score: { "win-audio-sound": 1 } },
        { label: "No, it just stopped one day", value: "no" },
        { label: "Not sure", value: "unsure" },
      ],
    },

    "upd-what": {
      q: "What's the update situation?",
      desc: "",
      options: [
        { label: "It restarts me at odd hours", value: "odd", score: { "win-upd-odd": 3 }, reason: "Unwanted restarts are a scheduling problem — and an easy one to fix." },
        { label: "Updates are stuck or failing", value: "fail", score: { "win-upd-fail": 2 } },
        { label: "I want to stay current without surprises", value: "safe", score: { "mac-upd-safe": 3, "win-upd-eol": 1 } },
        { label: "I'm worried about losing data when updating", value: "data", score: { "mac-upd-backup": 2, "win-sec-harden": 1 } },
      ],
    },
    "upd-version": {
      q: "Which version of Windows are you on?",
      desc: "",
      options: [
        { label: "Windows 10", value: "win10", score: { "win-upd-eol": 3 }, reason: "Windows 10 is past end of support — that changes what 'updates' means for you." },
        { label: "Windows 11", value: "win11" },
        { label: "Not sure how to check", value: "unsure", score: { "win-upd-eol": 1 } },
      ],
    },

    "crash-power": {
      q: "Is there any sign the PC is powered on?",
      desc: "This splits 'no power at all' from problems that happen after it starts.",
      options: [
        { label: "No — no lights, no fans, nothing at all", value: "dead", score: { "win-crash-power": 3 }, reason: "No sign of life points at the power path first — and that has a short, safe check list." },
        { label: "Yes — it powers on but the screen stays black", value: "black", score: { "win-crash-signal": 2, "win-crash-gpu": 1 }, reason: "Power is fine, so this is about getting an image to the display." },
        { label: "It gets partway (logo or spinner) then stops", value: "partway", score: { "win-crash-boot": 3 }, reason: "Getting stuck at startup has its own well-tested fix path." },
        { label: "It reaches the desktop and then crashes or blue-screens", value: "desktop-crash", score: { "win-crash-bsod": 2, "win-corrupt-files": 1 } },
        { label: "Not sure what I'm seeing", value: "unsure" },
      ],
    },
    "crash-screen": {
      q: "What does the monitor itself show?",
      desc: "",
      showIf: { q: "crash-power", is: ["black"] },
      options: [
        { label: "'No signal' or a similar message", value: "nosignal", score: { "win-crash-signal": 3 }, reason: "'No signal' means the display isn't receiving a picture — cable, port and input source are the usual culprits." },
        { label: "I can see a cursor but nothing else", value: "cursor", score: { "win-crash-gpu": 2, "win-corrupt-files": 1 }, reason: "A visible cursor means Windows is running — this points at the display driver or shell." },
        { label: "It's an external monitor that won't show up", value: "external", score: { "win-crash-signal": 3 } },
        { label: "Just black — no message, no cursor", value: "pureblack" },
      ],
    },
    "crash-what": {
      q: "What exactly happens when it crashes?",
      desc: "",
      options: [
        { label: "A blue screen with a code (Windows)", value: "bsod", score: { "win-crash-bsod": 3, "oth-crash-bsod": 2 }, reason: "Blue screens have codes — and the codes point at the cause." },
        { label: "It won't get past startup / black screen", value: "boot", score: { "win-crash-boot": 3, "mac-crash-boot": 3, "oth-crash-bsod": 1 } },
        { label: "Apps freeze but the computer keeps running", value: "frozen", score: { "mac-crash-frozen": 3, "win-corrupt-files": 2 } },
        { label: "An app is blocked — 'unverified developer'", value: "gatekeeper", score: { "mac-crash-gatekeeper": 3 } },
        { label: "Random restarts with no warning", value: "restarts", score: { "win-crash-bsod": 1, "win-corrupt-files": 1, "oth-crash-corrupt": 1 } },
      ],
    },
    "crash-when": {
      q: "Did it start after an update or a change?",
      desc: "",
      options: [
        { label: "Yes, right after something changed", value: "yes", score: { "win-corrupt-files": 2, "win-crash-bsod": 1 } },
        { label: "No — it's been happening for a while", value: "no", score: { "win-crash-bsod": 1 } },
        { label: "Not sure", value: "unsure" },
      ],
    },

    "game-what": {
      q: "What do you notice in games?",
      desc: "",
      options: [
        { label: "Random stutters and lag spikes", value: "stutter", score: { "win-game-stutter": 3 }, reason: "Sudden spikes usually trace back to one of five mundane causes." },
        { label: "Low frame rates overall", value: "fps", score: { "win-game-fps": 2, "win-game-stutter": 1 } },
        { label: "My inputs feel delayed", value: "lag", score: { "win-game-lag": 3 }, reason: "Input lag is its own problem — and it has a specific fix." },
      ],
    },
    "game-where": {
      q: "Does it happen in every game or just one?",
      desc: "",
      options: [
        { label: "Every game", value: "all", score: { "win-game-stutter": 1, "win-game-fps": 1 } },
        { label: "Just one specific game", value: "one", score: { "win-game-stutter": 2 } },
      ],
    },

    "sec-what": {
      q: "What's worrying you most?",
      desc: "",
      options: [
        { label: "Scary pop-ups or 'virus' claims from software", value: "popups", score: { "win-sec-optimizer": 3 }, reason: "'PC optimizer' software is the most common source of scary pop-ups." },
        { label: "Suspicious emails and links", value: "email", score: { "win-sec-phish": 3, "mac-sec-updates": 1 } },
        { label: "I just want to be safer in general", value: "general", score: { "win-sec-harden": 2, "mac-sec-backup": 1, "mac-sec-updates": 1 } },
        { label: "Ransomware / data loss fears", value: "ransom", score: { "win-sec-harden": 2, "mac-sec-backup": 2 } },
      ],
    },
    "sec-history": {
      q: "Have you installed anything from an unfamiliar source recently?",
      desc: "",
      options: [
        { label: "Yes — something I'm not sure about", value: "yes", score: { "win-sec-optimizer": 2 } },
        { label: "No, only official stores and sites", value: "no", score: { "win-sec-harden": 1 } },
      ],
    },

    "hw-what": {
      q: "What do you want to improve or fix?",
      desc: "",
      options: [
        { label: "The whole PC feels limited — more speed", value: "speed", score: { "win-hw-ram": 2, "win-hw-ssd": 1 } },
        { label: "Slow loading and saving", value: "storage", score: { "win-hw-ssd": 3 }, reason: "A slow drive is the single biggest upgrade most PCs can get." },
        { label: "Battery life has dropped off", value: "battery", score: { "win-hw-battery": 3 } },
        { label: "A device (printer, mic, camera) isn't working", value: "device", score: { "win-hw-device": 3 } },
        { label: "Bluetooth won't connect or keeps dropping", value: "bluetooth", score: { "win-hw-bt": 3 } },
        { label: "An external monitor isn't detected", value: "monitor", score: { "win-hw-monitor": 3 } },
        { label: "A USB keyboard, mouse or drive isn't recognised", value: "usb", score: { "win-hw-usb": 3 } },
      ],
    },

    "hw-mac-what": {
      q: "What do you want to improve or fix?",
      desc: "",
      options: [
        { label: "Battery life has dropped off", value: "battery", score: { "mac-hw-battery": 3 } },
        { label: "An external drive is acting up", value: "drives", score: { "mac-hw-drives": 3 } },
        { label: "Both, honestly", value: "both", score: { "mac-hw-battery": 2, "mac-hw-drives": 2 } },
      ],
    },

    "mac-space": {
      q: "How much free space does your Mac show?",
      desc: "",
      options: [
        { label: "Less than 10 GB", value: "low", score: { "mac-perf-disk": 3 }, reason: "A nearly full drive slows a Mac down more than almost anything else." },
        { label: "10–50 GB", value: "mid", score: { "mac-perf-disk": 1, "mac-perf-apps": 1 } },
        { label: "More than 50 GB", value: "high", score: { "mac-perf-apps": 2 } },
        { label: "I don't know where to look", value: "unsure" },
      ],
    },
  },

  /* ---------- Confidence thresholds (spec §17/§30) ---------- */
  confidence: { highMin: 6, highMargin: 2, mediumMin: 3 },
};

/* Server-side export for the EmTech AI API worker (ai-api/), which validates
   question ids against this exact bank. No-op in the browser, where `module`
   is undefined. */
if (typeof module !== "undefined") {
  module.exports = (typeof window !== "undefined" ? window : globalThis).EMTECH_DIAG_DATA;
}
