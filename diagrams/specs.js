/* ============================================================
   EmTech Media — diagrams/specs.js
   Figure specs for every tip that does not yet have a hand-crafted SVG.

   Canonical wiring lives in tips-data.js (`diagram` field). This file is
   pure data consumed by build/diagrams.mjs, which renders each spec into
   an 800×540 SVG matching the existing visual language (see
   diagrams/win-startup-bloat.svg for the reference figure):

     paper #f1eee6 · panels #e9e5d8 / #f7f5ee · ink #131210
     muted #5f5b50 · hairline rgba(19,18,16,.18) · accent lime #c8f03c
     IBM Plex Mono labels + Instrument Serif italic title (fallbacks only —
     SVG-in-<img> blocks external font fetches)

   Layouts: steps | window | flow | versus | device | bars | keys
   FIG numbers are assigned by build/diagrams.mjs in tips-data.js order,
   continuing after the hand-crafted figures (which use FIG. 01–23).

   Text budget rules (enforced by the renderer — fail fast, never clip):
     steps row ≤ 64 chars · window label ≤ 40 · chip state ≤ 9
     flow node line ≤ 20 (n=3) / ≤ 15 (n=4) · versus line ≤ 28
     bars label ≤ 22 · keys desc ≤ 36 · serif title ≤ 40
   ============================================================ */

const SPECS = {
  /* ---------------- WINDOWS — SPEED & HARDWARE ---------------- */

  "move-your-os-or-games-to-an-ssd": {
    file: "win-ssd-upgrade.svg", kicker: "HARDWARE", title: "The upgrade that pays for itself",
    layout: "flow",
    nodes: [
      { k: "BEFORE", l: ["HDD", "minutes to boot"] },
      { k: "CLONE", l: ["maker's free tool", "drive → drive"] },
      { k: "AFTER", l: ["SSD", "seconds to boot"] },
    ],
    hl: 2, capL: "HDD → SSD · CLONE, SWAP, BOOT",
  },

  "upgrade-your-ram-and-match-it": {
    file: "win-ram-dual-channel.svg", kicker: "HARDWARE", title: "Matched pairs, dual channel",
    layout: "device",
    parts: [
      { t: "slot", x: 190, y: 200, w: 46, h: 150, state: "filled" },
      { t: "slot", x: 258, y: 200, w: 46, h: 150, state: "filled" },
      { t: "slot", x: 326, y: 200, w: 46, h: 150, state: "hl" },
      { t: "slot", x: 394, y: 200, w: 46, h: 150, state: "empty" },
    ],
    callsR: [
      { y: 210, text: "type + speed first (DDR4 / DDR5)" },
      { y: 275, text: "identical stick = dual channel" },
      { y: 340, text: "one firm click means seated" },
    ],
    note: ["16 GB is the comfortable minimum"],
  },

  "lower-windows-transparency-and-animation-effects": {
    file: "win-transparency-off.svg", kicker: "SPEED", title: "Turn off what you can't see",
    layout: "window", winTitle: "Settings — Visual effects",
    rows: [
      { label: "Transparency effects", state: "OFF" },
      { label: "Animation effects", state: "OFF" },
      { label: "Performance options", state: "BEST" },
    ],
    hl: 0, capL: "PERSONALISATION → COLOURS · ACCESSIBILITY → VISUAL EFFECTS",
  },

  /* ---------------- WINDOWS — CLEANING ---------------- */

  "clean-up-temp-files-and-browser-cache-properly": {
    file: "win-temp-files-clean.svg", kicker: "CLEANING", title: "Junk that's safe to delete",
    layout: "window", winTitle: "What piles up over months",
    rows: [
      { label: "%TEMP% folder", state: "REMOVE" },
      { label: "Browser cache", state: "REMOVE" },
      { label: "Downloads clutter", state: "REVIEW" },
    ],
    hl: 0, capL: "STORAGE SETTINGS · %TEMP% · BROWSER PRIVACY",
  },

  "uninstall-the-apps-you-never-use": {
    file: "win-uninstall-unused.svg", kicker: "CLEANING", title: "Remove what you never open",
    layout: "window", winTitle: "Installed apps — sorted by size",
    rows: [
      { label: "Abandoned game · 84 GB", state: "UNINSTALL" },
      { label: "Trial 'security' app", state: "UNINSTALL" },
      { label: "App you use daily", state: "KEEP" },
    ],
    hl: 0, capL: "SETTINGS → APPS · SORT BY SIZE · 6-MONTH RULE",
  },

  "dodge-bundleware-when-you-install-anything": {
    file: "win-bundleware-dodge.svg", kicker: "CLEANING", title: "One extra minute per install",
    layout: "steps",
    rows: [
      "Custom install — untick the extras",
      "Uninstall OEM bloat first on new PCs",
      "No download managers or 'boosters'",
      "uBlock Origin over ad-network extensions",
      "Free/open-source over cracked copies",
    ],
    hl: 0, capL: "INSTALLERS · BLOATWARE · ADWARE — THE USUAL SUSPECTS",
  },

  /* ---------------- WINDOWS — MAINTENANCE ---------------- */

  "check-for-driver-updates-in-the-right-order": {
    file: "win-driver-order.svg", kicker: "MAINTENANCE", title: "Update in the right order",
    layout: "flow", branches: ["FIRST", "THEN", "AVOID"],
    nodes: [
      { k: "GPU", l: ["maker's tool —", "not Win Update"] },
      { k: "CHIPSET + AUDIO", l: ["OEM support page", "only safe source"] },
      { k: "UPDATERS", l: ["third-party tools", "mostly adware ✕"] },
    ],
    hl: 1, capL: "GPU FIRST · OEM PAGE SECOND · UPDATERS NEVER",
  },

  "run-a-disk-health-check-before-it-s-too-late": {
    file: "win-disk-health.svg", kicker: "MAINTENANCE", title: "Ten minutes, once a month",
    layout: "window", winTitle: "Drive health — S.M.A.R.T.",
    rows: [
      { label: "Re-allocated sectors", state: "0 = OK" },
      { label: "Pending / bad sectors", state: "0 = OK" },
      { label: "SSD wear leveling", state: "92%" },
    ],
    hl: 1, note: { title: "ANY BAD SECTORS?", lines: ["back up NOW,", "then replace"] },
    capL: "TASK MANAGER → PERFORMANCE → STORAGE",
  },

  "repair-corrupted-system-files": {
    file: "win-system-file-repair.svg", kicker: "MAINTENANCE", title: "Two commands, in order",
    layout: "flow",
    nodes: [
      { k: "STEP 1", l: ["DISM", "/RestoreHealth"] },
      { k: "STEP 2", l: ["sfc /scannow", "~15 min"] },
      { k: "THEN", l: ["restart", "run sfc again"] },
    ],
    hl: 1, capL: "ADMIN COMMAND PROMPT · ~20 MIN TOTAL",
  },

  "run-drive-optimization-the-safe-way": {
    file: "win-drive-optimize.svg", kicker: "MAINTENANCE", title: "Right tool for each drive",
    layout: "window", winTitle: "Defragment and optimize drives",
    rows: [
      { label: "HDD — C:", state: "DEFRAG" },
      { label: "SSD — D:", state: "TRIM" },
      { label: "Optimize on a schedule", state: "ON" },
    ],
    hl: 1, note: { title: "KEEP FREE", lines: ["10–20% of the", "main disk"] },
    capL: "DFRGUI · SSDs GET TRIM, NEVER DEFRAG",
  },

  "windows-update-stuck-the-safe-retry-pass": {
    file: "win-update-stuck-retry.svg", kicker: "UPDATES", title: "Three boring causes, ten minutes",
    layout: "steps",
    rows: [
      "Restart — let it sit after boot",
      "Free space on C:? need 10–20 GB",
      "Does the internet actually work?",
      "Re-check updates, then leave it alone",
    ],
    hl: 0, capL: "RESTART · DISK SPACE · NETWORK — IN THAT ORDER",
  },

  /* ---------------- WINDOWS — SECURITY & BACKUPS ---------------- */

  "back-up-properly-3-2-1-rule": {
    file: "win-backup-321.svg", kicker: "SECURITY", title: "Three copies, two media, one away",
    layout: "flow",
    nodes: [
      { k: "COPY 1", l: ["local — File", "History / NAS"] },
      { k: "COPY 2", l: ["external drive,", "different media"] },
      { k: "COPY 3", l: ["cloud — off-site", "OneDrive / B2"] },
    ],
    hl: 2, note: ["test a restore once a year — an untested backup is a rumour"],
    capL: "3 · 2 · 1 — BORING UNTIL YOU NEED IT",
  },

  "hardening-accounts-updates-and-the-firewall": {
    file: "win-account-hardening.svg", kicker: "SECURITY", title: "Twenty minutes of hygiene",
    layout: "window", winTitle: "The pass most people skip",
    rows: [
      { label: "Unique passwords + manager", state: "DO" },
      { label: "Windows Hello PIN daily", state: "ON" },
      { label: "Automatic updates", state: "ON" },
      { label: "Sign-in options reviewed", state: "CHECK" },
    ],
    hl: 0, capL: "ACCOUNTS · WINDOWS UPDATE · SIGN-IN OPTIONS",
  },

  "kill-shady-pc-optimizer-software": {
    file: "win-no-pc-optimizers.svg", kicker: "SECURITY", title: "No magic pill exists",
    layout: "versus",
    left: { title: "'PC OPTIMIZER'", verdict: "✕ SCAM", lines: ["nags about 'errors'", "registry 'cleaning'", "adware in a suit"] },
    right: { title: "BUILT-INS", verdict: "✓ FREE", lines: ["sfc /scannow · DISM", "Disk Cleanup", "Storage Sense"] },
    capL: "UNINSTALL THE NAGS — KEEP THE BUILT-INS",
  },

  "protect-against-ransomware-before-it-s-too-late": {
    file: "win-ransomware-shield.svg", kicker: "SECURITY", title: "Almost unkillable",
    layout: "steps",
    rows: [
      "Controlled folder access — ON",
      "Memory integrity (VBS) — ON",
      "Keep the 3-2-1 backup",
    ],
    hl: 2, note: { title: "THE TRUTH", lines: ["the backup is", "what saves you"] },
    capL: "WINDOWS SECURITY · DEVICE SECURITY",
  },

  "stop-windows-tracking-your-location": {
    file: "win-location-off.svg", kicker: "PRIVACY", title: "Cut it off at the source",
    layout: "window", winTitle: "Privacy & Security — Location",
    rows: [
      { label: "Location services", state: "OFF" },
      { label: "Per-app access", state: "REVIEW" },
      { label: "Location history", state: "CLEAR" },
      { label: "Browser site prompts", state: "BLOCK" },
    ],
    hl: 0, capL: "SETTINGS → PRIVACY & SECURITY → LOCATION",
  },

  "create-a-local-account-that-doesn-t-phone-home": {
    file: "win-local-account.svg", kicker: "PRIVACY", title: "Everything stays on the machine",
    layout: "steps",
    rows: [
      "Add account without a Microsoft Account",
      "Username + password, standard level",
      "Admin only when genuinely needed",
      "Verify files stay isolated from yours",
    ],
    hl: 0, capL: "SETTINGS → ACCOUNTS → OTHER USERS",
  },

  "tighten-up-chrome-the-10-minute-pass": {
    file: "win-chrome-tighten.svg", kicker: "PRIVACY", title: "Ten toggles, ten minutes",
    layout: "window", winTitle: "Chrome — Privacy and security",
    rows: [
      { label: "Third-party cookies", state: "BLOCK" },
      { label: "Safe Browsing", state: "ENHANCED" },
      { label: "Use secure DNS", state: "ON" },
      { label: "Background apps after close", state: "OFF" },
    ],
    hl: 0, capL: "CHROME → PRIVACY AND SECURITY · SYSTEM",
  },

  "skip-paid-antivirus-and-keep-defender-sharp": {
    file: "win-defender-sharp.svg", kicker: "SECURITY", title: "One engine, properly on",
    layout: "versus",
    left: { title: "PAID SUITE", verdict: "✕ GAPS", lines: ["Defender sits passive", "two engines fight", "gaps in between"] },
    right: { title: "DEFENDER", verdict: "✓ SHARP", lines: ["real-time protection ON", "reputation-based checks", "memory integrity + blocklist"] },
    capL: "UNINSTALL THE SUITE FIRST — appwiz.cpl",
  },

  "lock-down-your-home-wi-fi-properly": {
    file: "win-wifi-lockdown.svg", kicker: "NETWORK", title: "Fifteen minutes, five switches",
    layout: "steps",
    rows: [
      "Admin password first — the door to all",
      "Rename the SSID — no names or numbers",
      "WPA3 (or WPA2) + 12-char passphrase",
      "WPS off — crackable for years",
      "Guest network for visitors + smart home",
    ],
    hl: 0, capL: "ROUTER ADMIN · SSID · WPA3 · WPS · GUEST",
  },

  "stop-emailing-passwords-and-secrets": {
    file: "win-no-email-secrets.svg", kicker: "PRIVACY", title: "Email is not a vault",
    layout: "flow",
    nodes: [
      { k: "TODAY", l: ["passwords + OTPs", "sitting in inbox"] },
      { k: "MOVE", l: ["manager + 2FA,", "authenticator app"] },
      { k: "CLEAN", l: ["search 'password',", "delete the threads"] },
    ],
    hl: 1, note: ["no 2FA option at all? that's a signal to find another service"],
    capL: "MANAGER · TWO-FACTOR · INBOX CLEAN-OUT",
  },

  "turn-on-full-disk-encryption-bitlocker": {
    file: "win-bitlocker-on.svg", kicker: "SECURITY", title: "A stolen laptop, unreadable drive",
    layout: "window", winTitle: "Device encryption",
    rows: [
      { label: "Laptop — Device encryption", state: "ON" },
      { label: "Desktop — Manage BitLocker", state: "ON" },
      { label: "Recovery key stored off-PC", state: "✓" },
    ],
    hl: 2, capL: "SETTINGS → PRIVACY & SECURITY → DEVICE ENCRYPTION",
  },

  "spot-a-phishing-email-before-you-click": {
    file: "win-phishing-spot.svg", kicker: "SECURITY", title: "You beat it on process",
    layout: "steps",
    rows: [
      "Read the real domain, not display name",
      "Hover links — see where they truly go",
      "Urgency is the alarm bell",
      "Act outside the message — type it yourself",
      "Never open unexpected attachments",
    ],
    hl: 0, capL: "DOMAIN · HOVER · URGENCY · NEW TAB · ATTACHMENTS",
  },

  /* ---------------- WINDOWS — GAMING ---------------- */

  "stop-games-stuttering-the-5-point-checklist": {
    file: "win-game-stutter-checklist.svg", kicker: "GAMING", title: "Five mundane causes",
    layout: "steps",
    rows: [
      "GPU driver — clean install if it persists",
      "Verify game files in the launcher",
      "DirectX + VCRedist packs installed",
      "One overlay max — drop the rest",
      "Game Bar + Game DVR off",
    ],
    hl: 0, capL: "DRIVER · FILES · RUNTIME · OVERLAYS · GAME BAR",
  },

  "raise-your-effective-fps-with-windows-game-mode": {
    file: "win-game-mode.svg", kicker: "GAMING", title: "Let Windows prioritise the game",
    layout: "window", winTitle: "Settings — Gaming",
    rows: [
      { label: "Game Mode", state: "ON" },
      { label: "Limit background bandwidth", state: "ON" },
    ],
    hl: 0, note: { title: "HYBRID CPU?", lines: ["pin the game", "to P-cores"] },
    capL: "SETTINGS → GAMING · LEAVE IT ON, ALWAYS",
  },

  "reduce-input-lag-in-competitive-games": {
    file: "win-input-lag.svg", kicker: "GAMING", title: "Cut between hand and screen",
    layout: "steps",
    rows: [
      "Monitor at native refresh rate",
      "GPU power — Prefer Maximum Performance",
      "In-game FPS uncapped to your refresh",
      "Wired mouse; Bluetooth is out",
    ],
    hl: 0, capL: "REFRESH · GPU POWER · IN-GAME CAP · MOUSE",
  },

  "save-your-games-the-right-way": {
    file: "win-game-saves.svg", kicker: "GAMING", title: "Find the saves first",
    layout: "flow",
    nodes: [
      { k: "FIND", l: ["each game's save", "folder — AppData /"] },
      { k: "COPY", l: ["monthly →", "external drive"] },
      { k: "SYNC", l: ["Steam Cloud sync", "where offered"] },
    ],
    hl: 1, capL: "APPDATA · DOCUMENTS · STEAM CLOUD SYNC",
  },

  /* ---------------- WINDOWS — EVERYDAY FIXES ---------------- */

  "make-windows-search-actually-useful-again": {
    file: "win-search-index.svg", kicker: "WINDOWS", title: "Rebuild the index",
    layout: "window", winTitle: "Settings — Search",
    rows: [
      { label: "Search online sources", state: "OFF" },
      { label: "Rebuild search index", state: "DO" },
      { label: "Exclude heavy folders", state: "ADD" },
    ],
    hl: 1, capL: "SEARCH → ADVANCED INDEX OPTIONS · REBUILD 5–20 MIN",
  },

  "make-your-desktop-feel-like-a-mac-without-the-price": {
    file: "win-desktop-pass.svg", kicker: "WINDOWS", title: "A fifteen-minute pass",
    layout: "window", winTitle: "Personalisation — the clean look",
    rows: [
      { label: "Accent colour — auto", state: "ON" },
      { label: "Transparency effects", state: "OFF" },
      { label: "Modern font installed", state: "DO" },
      { label: "Taskbar centred, uncombined", state: "SET" },
    ],
    hl: 0, capL: "COLOURS · FONTS · TASKBAR SETTINGS",
  },

  "fix-my-pc-is-slow-all-of-a-sudden-the-order-of-attack": {
    file: "win-slow-order-of-attack.svg", kicker: "SPEED", title: "Check them in this order",
    layout: "steps",
    rows: [
      "Disk at 100%? That's the answer",
      "Unknown process eating CPU / RAM",
      "Bad update last night?",
      "sfc /scannow — random slowness",
    ],
    hl: 0, note: { title: "WHY ORDER?", lines: ["each check", "rules one out"] },
    capL: "TASK MANAGER · UPDATE HISTORY · SFC",
  },

  "hunt-down-memory-hogs": {
    file: "win-memory-hogs.svg", kicker: "SPEED", title: "Find it, then cap it",
    layout: "steps",
    rows: [
      "Sort Processes by Memory — close the top",
      "Background app permissions → off",
      "Perfmon: Private Bytes climbing?",
      "Pagefile 1.5×–3× RAM",
      "Full scan — malware hides as hogs",
    ],
    hl: 0, capL: "TASK MANAGER · PERFMON · PAGEFILE · FULL SCAN",
  },

  "make-big-file-transfers-actually-fast": {
    file: "win-fast-transfers.svg", kicker: "SPEED", title: "Same bytes, half the time",
    layout: "steps",
    rows: [
      "SSD or HDD? Check Task Manager → Disk",
      "USB 3.x port — blue/teal inside",
      "FAT32? Convert to NTFS",
      "Robocopy /mt:16 over drag-and-drop",
      "Compress first when you can",
    ],
    hl: 3, capL: "ROBOCOPY · USB 3.X · NTFS · COMPRESS",
  },

  "organise-your-work-with-virtual-desktops": {
    file: "win-virtual-desktops.svg", kicker: "WINDOWS", title: "One job per desktop",
    layout: "flow",
    nodes: [
      { k: "CREATE", l: ["Win + Ctrl + D", "new desktop"] },
      { k: "ARRANGE", l: ["Open with Win+Tab", "move windows over"] },
      { k: "FOCUS", l: ["work / research /", "music — no mixing"] },
    ],
    hl: 2, note: ["Win + Ctrl + F4 closes the current desktop"],
    capL: "WIN+CTRL+D · WIN+TAB · ONE JOB PER DESKTOP",
  },

  "wi-fi-off-or-missing-the-three-switches-that-disable-it": {
    file: "win-wifi-three-switches.svg", kicker: "NETWORK", title: "The three switches that kill Wi-Fi",
    layout: "window", winTitle: "Quick settings + Device Manager",
    rows: [
      { label: "Airplane mode", state: "OFF ✓" },
      { label: "Wi-Fi toggle", state: "ON" },
      { label: "Adapter enabled", state: "✓" },
    ],
    hl: 0, note: { title: "STILL MISSING?", lines: ["Action → Scan for", "hardware changes"] },
    capL: "QUICK SETTINGS · NETWORK & INTERNET · DEVICE MANAGER",
  },

  "master-the-keyboard-shortcuts-that-save-hours": {
    file: "win-shortcuts.svg", kicker: "WINDOWS", title: "Ten keys, minutes saved daily",
    layout: "keys",
    rows: [
      { keys: ["Win", "V"], desc: "clipboard history — last ~25 copies" },
      { keys: ["Win", "Shift", "S"], desc: "snip exactly what you want" },
      { keys: ["Alt", "Tab"], desc: "cycle + preview open apps" },
      { keys: ["Win", "D"], desc: "show desktop instantly" },
      { keys: ["Win", "E/I/L"], desc: "Explorer · Settings · Lock" },
    ],
    hl: 0, capL: "CLIPBOARD · SNIP · SWITCH · DESKTOP · LAUNCH",
  },

  "install-powertoys-microsoft-s-free-utility-pack": {
    file: "win-powertoys.svg", kicker: "WINDOWS", title: "Microsoft's own utility pack",
    layout: "window", winTitle: "PowerToys — the useful five",
    rows: [
      { label: "PowerToys Run", state: "ALT+SPACE" },
      { label: "FancyZones", state: "LAYOUTS" },
      { label: "Awake", state: "NO SLEEP" },
      { label: "Color Picker", state: "WIN+SHIFT+C" },
      { label: "Text Extractor", state: "WIN+SHIFT+T" },
    ],
    hl: 0, note: { title: "GET IT FROM", lines: ["Microsoft Store", "or GitHub — only"] },
    capL: "OFFICIAL · FREE · BETTER THAN MOST PAID TOOLS",
  },

  "bluetooth-won-t-connect-the-pairing-reset-that-works": {
    file: "win-bt-pairing-reset.svg", kicker: "BLUETOOTH", title: "Reset the pairing, not the hardware",
    layout: "steps",
    rows: [
      "Both ends on + discoverable",
      "Forget it, then pair from scratch",
      "Restart PC and device",
      "Update — or roll back — the driver",
    ],
    hl: 1, capL: "FORGET → RE-PAIR · STALE DATA IS USUAL CULPRIT",
  },

  "usb-device-not-recognised-the-device-manager-pass": {
    file: "win-usb-device-manager.svg", kicker: "HARDWARE", title: "Port, cable, driver state — in order",
    layout: "steps",
    rows: [
      "Different port · cable · no hub",
      "Power-cycle with device unplugged",
      "Device Manager: update → uninstall + reboot",
      "USB selective suspend → off",
    ],
    hl: 0, capL: "PHYSICAL PASS FIRST — THEN DEVICE MANAGER",
  },

  "pc-won-t-turn-on-run-the-five-minute-power-check": {
    file: "win-power-check.svg", kicker: "MAINTENANCE", title: "'Dead' is usually one boring thing",
    layout: "steps",
    rows: [
      "Socket · cable · PSU rocker switch",
      "Standby light? alive = display problem",
      "Laptop: charger LED, boot on battery",
      "Drain: unplug 30 s + hold power 15 s",
    ],
    hl: 0, note: { title: "PROMISE", lines: ["nothing here", "can damage it"] },
    capL: "SOCKET · CABLE · SWITCH · DRAIN — FIVE MINUTES",
  },

  "black-screen-check-the-display-signal-path-first": {
    file: "win-black-screen-path.svg", kicker: "DISPLAY", title: "Follow the signal path",
    layout: "flow",
    nodes: [
      { k: "SOURCE", l: ["GPU port — not", "the motherboard"] },
      { k: "PATH", l: ["check the cable", "then input source"] },
      { k: "PANEL", l: ["power light on?", "correct input?"] },
    ],
    hl: 0, note: ["Win + P → Duplicate / Extend · Display → Detect displays"],
    capL: "CABLE · INPUT SOURCE · GPU PORT — BEFORE YOU BLAME THE GPU",
  },

  "move-everything-to-a-new-pc": {
    file: "win-new-pc-move.svg", kicker: "WINDOWS", title: "Sort the hard parts before the wipe",
    layout: "flow",
    nodes: [
      { k: "OLD PC", l: ["Windows Backup +", "copy files over"] },
      { k: "NEW PC", l: ["sign in · verify", "browser, 2FA codes"] },
      { k: "AFTER", l: ["keep old drive", "for a month"] },
    ],
    hl: 1, note: ["move authenticator / recovery codes BEFORE you wipe anything"],
    capL: "BACKUP · BROWSER PROFILE · LICENCES · TWO-FACTOR",
  },

  "tighten-up-edge-and-firefox": {
    file: "win-edge-firefox-tighten.svg", kicker: "PRIVACY", title: "The same ten minutes, two browsers",
    layout: "window", winTitle: "Edge + Firefox — the pass",
    rows: [
      { label: "Edge tracking prevention", state: "STRICT" },
      { label: "Edge shopping/sidebar extras", state: "OFF" },
      { label: "Firefox ETP", state: "STRICT" },
      { label: "HTTPS-Only Mode (both)", state: "ON" },
    ],
    hl: 0, capL: "EDGE · FIREFOX — PRIVACY & SECURITY PAGES",
  },

  "cpu-pegged-at-100-find-the-culprit-in-task-manager": {
    file: "win-cpu-pegged.svg", kicker: "SPEED", title: "Task Manager names the culprit",
    layout: "window", winTitle: "Processes — sorted by CPU",
    rows: [
      { label: "chrome.exe · 40 tabs", state: "CLOSE ✓" },
      { label: "svchost / system-looking", state: "CHECK" },
    ],
    hl: 0, note: { title: "SYSTEM-LOOKING?", lines: ["boot-time hogs live", "in Startup apps"] },
    capL: "CTRL+SHIFT+ESC → PROCESSES → SORT BY CPU",
  },

  /* ---------------- WINDOWS — HARDWARE PICKS & POWER ---------------- */

  "pick-an-ssd-that-s-actually-fast": {
    file: "win-ssd-pick-fast.svg", kicker: "HARDWARE", title: "The label lies — the interface doesn't",
    layout: "bars",
    rows: [
      { label: "NVMe (M.2)", w: 1, chip: "MAIN DRIVE", hl: true },
      { label: "SATA SSD", w: 0.58, chip: "STILL GREAT" },
      { label: "QLC NAND", w: 0.3, chip: "AVOID DAILY" },
    ],
    note: ["TLC is the sweet spot for price + endurance"],
    capL: "NVMe IS 3–5× SATA · CHECK SUSTAINED WRITE FOR BIG FILES",
  },

  "size-your-psu-before-the-next-upgrade": {
    file: "win-psu-sizing.svg", kicker: "HARDWARE", title: "Headroom is the quiet fix",
    layout: "steps",
    rows: [
      "Add up CPU + GPU draw (80% of it)",
      "Buy ~30% headroom over that total",
      "80 Plus Bronze or better",
      "Native GPU cables — no daisy-chains",
    ],
    hl: 1, note: { title: "EXAMPLE", lines: ["450 W system", "→ 600–650 W unit"] },
    capL: "CALCULATE · +30% HEADROOM · NATIVE CABLES",
  },

  "fix-a-hot-pc-for-good-the-airflow-pass": {
    file: "win-airflow-pass.svg", kicker: "HARDWARE", title: "Cool in one side, hot out the other",
    layout: "device",
    parts: [
      { t: "fan", x: 205, y: 210, r: 34 },
      { t: "fin", x: 290, y: 180, w: 130, h: 60 },
      { t: "drive", x: 290, y: 270, w: 130, h: 46 },
    ],
    arrows: [
      { x1: 108, y1: 250, x2: 168, y2: 250, label: "IN" },
      { x1: 130, y1: 470, x2: 130, y2: 420, label: "IN" },
      { x1: 480, y1: 250, x2: 540, y2: 250, label: "OUT" },
    ],
    callsR: [
      { y: 190, text: "intake: front + bottom fans" },
      { y: 300, text: "exhaust: rear + top fans" },
      { y: 380, text: "5–10 cm clearance behind the case" },
    ],
    note: ["idle CPU < 45°C · GPU < 50°C = the pass worked"],
  },

  /* ---------------- MACOS — SPEED & FIXES ---------------- */

  "keep-macos-updated-the-safe-way": {
    file: "mac-updates-safe-way.svg", kicker: "UPDATES", title: "Back up first, then update",
    layout: "flow",
    nodes: [
      { k: "FIRST", l: ["Time Machine —", "fresh backup"] },
      { k: "THEN", l: ["install the", "update"] },
      { k: "AFTER", l: ["check daily apps", "still behave"] },
    ],
    hl: 0, note: ["something broke after a big one? restore from Time Machine"],
    capL: "SOFTWARE UPDATE · TIME MACHINE FIRST — ALWAYS",
  },

  "speed-up-a-sluggish-macbook": {
    file: "mac-sluggish-macbook.svg", kicker: "SPEED", title: "Boring reasons, easy taming",
    layout: "steps",
    rows: [
      "Activity Monitor — sort by CPU, quit junk",
      "Reduce motion — Accessibility → Display",
      "Close the hoarded tabs (40 = 40 apps)",
    ],
    hl: 0, capL: "ACTIVITY MONITOR · REDUCE MOTION · TABS",
  },

  "tame-spotlight-indexing-on-extra-drives": {
    file: "mac-spotlight-indexing.svg", kicker: "SPEED", title: "Tell Spotlight which drives to skip",
    layout: "window", winTitle: "Siri & Spotlight — Privacy list",
    rows: [
      { label: "External HDD", state: "EXCLUDED ✓" },
      { label: "Backup drive", state: "EXCLUDED" },
      { label: "Main drive", state: "INDEXED" },
    ],
    hl: 0, note: { title: "STALE RESULTS?", lines: ["remove + re-add", "to force a rebuild"] },
    capL: "SPOTLIGHT PRIVACY · DISK LIGHT GOES QUIET",
  },

  "fix-a-mac-that-won-t-start-up": {
    file: "mac-wont-start-up.svg", kicker: "BOOT", title: "Recovery mode, no erasing",
    layout: "steps",
    rows: [
      "Apple Silicon: hold power → Options",
      "Intel: restart, hold Cmd+R",
      "Recovery → Disk Utility → First Aid",
      "Still stuck? Reinstall macOS (keeps files)",
    ],
    hl: 2, capL: "RECOVERY · FIRST AID · REINSTALL OVER THE TOP",
  },

  "run-first-aid-on-external-drives": {
    file: "mac-first-aid-drives.svg", kicker: "STORAGE", title: "Catch it while it's fixable",
    layout: "window", winTitle: "Disk Utility — First Aid",
    rows: [
      { label: "External SSD", state: "RUN ✓" },
      { label: "Backup HDD — errors found", state: "BACK UP NOW" },
    ],
    hl: 1, note: { title: "CADENCE + FORMAT", lines: ["Monthly on key drives", "Pick APFS or exFAT"] },
    capL: "DISK UTILITY → FIRST AID · TEN MINUTES BEATS A RECOVERY QUOTE",
  },

  "open-apps-blocked-by-gatekeeper": {
    file: "mac-gatekeeper-open.svg", kicker: "FIXES", title: "The safe way past the block",
    layout: "steps",
    rows: [
      "Right-click app → Open → confirm",
      "Privacy & Security → 'Open Anyway'",
      "Only for apps from sources you trust",
    ],
    hl: 0, note: { title: "WHY IT EXISTS", lines: ["unsigned software is", "where malware hides"] },
    capL: "FINDER · PRIVACY & SECURITY — FIRST LAUNCH ONLY",
  },

  "fix-slow-wi-fi-on-your-mac": {
    file: "mac-slow-wifi.svg", kicker: "NETWORK", title: "Rule out the Mac side first",
    layout: "steps",
    rows: [
      "Forget the network, reconnect fresh",
      "Prefer 5 GHz if offered (Home-5G)",
      "Reboot the router — clogged memory",
      "Wired test: fast? placement/interference",
    ],
    hl: 0, capL: "FORGET + RECONNECT · 5 GHZ · ROUTER · WIRED TEST",
  },

  "give-safari-a-proper-clean-out": {
    file: "mac-safari-clean-out.svg", kicker: "SPEED", title: "Five minutes back to January speed",
    layout: "window", winTitle: "Safari — Settings",
    rows: [
      { label: "Website data", state: "REMOVE ALL ✓" },
      { label: "Unused extensions", state: "OFF" },
      { label: "Hoarded tabs (40 = 40 mini-apps)", state: "CLOSE" },
    ],
    hl: 0, note: { title: "STILL SLOW?", lines: ["Develop menu →", "Empty Caches"] },
    capL: "PRIVACY · EXTENSIONS · TABS · DEVELOP → EMPTY CACHES",
  },

  /* ---------------- MACOS — EVERYDAY FIXES (INPUT / AUDIO / DISPLAY) ---------------- */

  "connected-but-no-internet-on-your-mac-the-safe-network-reset": {
    file: "mac-network-reset.svg", kicker: "NETWORK", title: "Fresh lease, clean cache",
    layout: "steps",
    rows: [
      "Other devices online? isolate first",
      "Network → Details → Renew DHCP Lease",
      "Terminal: flush DNS (nothing deleted)",
      "Toggle Wi-Fi, verify two sites load",
    ],
    hl: 1, capL: "RENEW LEASE · FLUSH DNS · TOGGLE — FULLY REVERSIBLE",
  },

  "no-sound-on-your-mac-check-the-output-device-first": {
    file: "mac-no-sound-output.svg", kicker: "AUDIO", title: "The wrong output, not a broken Mac",
    layout: "window", winTitle: "System Settings — Sound → Output",
    rows: [
      { label: "MacBook Speakers", state: "SELECT ✓" },
      { label: "Bluetooth speaker", state: "" },
      { label: "External display audio", state: "" },
    ],
    hl: 0, note: { title: "FIRST CHECK", lines: ["not muted +", "slider up"] },
    capL: "VOLUME MENU · SOUND → OUTPUT — A SETTINGS CHECK, NOT A RESET",
  },

  "external-monitor-not-detected-on-your-mac": {
    file: "mac-monitor-not-detected.svg", kicker: "DISPLAY", title: "Rotate through the path in order",
    layout: "flow",
    nodes: [
      { k: "CABLE", l: ["both ends +", "another port"] },
      { k: "ADAPTER", l: ["bypass dock —", "direct cable"] },
      { k: "REPLUG", l: ["wait ~10 s,", "re-detects"] },
      { k: "DISPLAYS", l: ["Settings →", "arrange it"] },
    ],
    hl: 3, capL: "CABLE · ADAPTER · PORT — USUALLY ONE OF THE THREE",
  },

  "bluetooth-won-t-pair-on-your-mac-reset-it-properly": {
    file: "mac-bt-pairing-reset.svg", kicker: "BLUETOOTH", title: "A clean re-pair fixes most of it",
    layout: "steps",
    rows: [
      "Bluetooth off and back on",
      "Forget device, re-pair from scratch",
      "Within ~1 m — keep stealers away",
      "Restart both (power-cycle the accessory)",
    ],
    hl: 1, capL: "FORGET → RE-PAIR · DISTANCE · POWER-CYCLE",
  },

  "trackpad-or-mouse-not-working-on-your-mac-the-safe-restart-pass": {
    file: "mac-input-restart-pass.svg", kicker: "INPUT", title: "Isolate before you replace",
    layout: "steps",
    rows: [
      "Clean restart first — clears stuck processes",
      "External? new port, no hub, test on another PC",
      "Built-in? check surface + Tap to click",
      "Verify device listed in Settings",
    ],
    hl: 0, capL: "RESTART · PORTS · SURFACE · SETTINGS — IN THAT ORDER",
  },

  "no-microphone-on-your-mac-check-the-input-device-first": {
    file: "mac-mic-input-first.svg", kicker: "INPUT", title: "The wrong input, not a dead mic",
    layout: "window", winTitle: "System Settings — Sound → Input", meter: true,
    rows: [
      { label: "MacBook Microphone", state: "SELECT ✓" },
      { label: "Other input device", state: "" },
    ],
    hl: 0, note: { title: "PROOF IT'S LIVE", lines: ["record 10 s in", "Voice Memos"] },
    capL: "SOUND → INPUT · WATCH THE LEVEL METER MOVE AS YOU TALK",
  },

  "microphone-permission-on-your-mac-let-the-app-use-it": {
    file: "mac-mic-permission.svg", kicker: "PRIVACY", title: "One denied prompt, one silent app",
    layout: "window", winTitle: "Privacy & Security — Microphone",
    rows: [
      { label: "Zoom (the affected app)", state: "ON ✓" },
      { label: "Slack — switch off?", state: "CHECK" },
      { label: "Missing from list? trigger prompt", state: "TRIGGER" },
    ],
    hl: 0, note: { title: "AFTER FLIPPING", lines: ["Cmd+Q the app —", "takes effect at launch"] },
    capL: "PRIVACY & SECURITY → MICROPHONE · PER-APP SWITCHES",
  },

  /* ---------------- WINDOWS — REMAINING COVERAGE ---------------- */

  "connected-but-no-internet-the-safe-dns-and-stack-reset": {
    file: "win-dns-stack-reset.svg", kicker: "NETWORK", title: "The safe stack reset",
    layout: "steps",
    rows: [
      "Other devices online? Router/ISP first",
      "ipconfig /release then /renew",
      "flushdns + winsock + int ip reset",
      "Restart, then DNS Automatic or 1.1.1.1",
    ],
    hl: 2, note: ["Resets need a restart", "1.1.1.1 proves it's DNS"],
    capL: "ISOLATE → RENEW → RESET → RESTART — FULLY REVERSIBLE",
  },

  "stop-your-pc-from-sleep-glitching-your-network": {
    file: "win-nic-power.svg", kicker: "NETWORK", title: "Stop the power-save drops",
    layout: "window", winTitle: "NIC Properties — Power Management",
    rows: [
      { label: "Allow PC to turn off device", state: "OFF" },
      { label: "Green Ethernet", state: "DISABLED" },
      { label: "Energy Efficient Ethernet", state: "DISABLED" },
    ],
    hl: 0, note: ["NIC saves power on sleep", "Next stop: NIC driver"],
    capL: "DEVICE MANAGER → NETWORK ADAPTERS → POWER MANAGEMENT",
  },

  "know-your-bios-settings-the-5-that-matter": {
    file: "win-bios-five.svg", kicker: "HARDWARE", title: "The five UEFI switches",
    layout: "steps",
    rows: [
      "XMP/EXPO on — RAM at rated speed",
      "Resizable BAR: on for GPU",
      "C-States off for low latency",
      "Boot order: SSD first",
      "VT-x/SVM only if you run VMs",
    ],
    hl: 0, note: ["One change at a time", "Load optimized defaults"],
    capL: "F2 / DEL AT BOOT · ONE CHANGE AT A TIME",
  },

  "make-your-laptop-battery-last-longer": {
    file: "win-battery-age.svg", kicker: "POWER", title: "Slow the ageing down",
    layout: "window", winTitle: "Settings — Power & battery",
    rows: [
      { label: "Battery saver threshold", state: "EARLY" },
      { label: "Optimised charging", state: "ON" },
      { label: "Vents + surface", state: "COOL" },
      { label: "Wear level (Task Mgr)", state: "> 80%" },
    ],
    hl: 1, note: ["Heat and 100% age cells", "~80% wear = replace soon"],
    capL: "SETTINGS → POWER & BATTERY · MAKER'S TOOL · TASK MANAGER",
  },

  "windows-10-is-past-end-of-support-what-to-do-now": {
    file: "win-win10-eol.svg", kicker: "SUPPORT", title: "The patch gap widens",
    layout: "flow",
    branches: ["FIRST", "BEST", "LAST"],
    nodes: [
      { k: "CHECK", l: ["winver: Windows 10", "patches stopped"] },
      { k: "UPGRADE", l: ["Windows 11, free", "if it qualifies"] },
      { k: "BRIDGE", l: ["ESU to Oct 2026", "then replace"] },
    ],
    hl: 1, note: ["Neither option? Keep it away from online banking"],
    capL: "WINVER → UPGRADE → ESU → REPLACE",
  },
};

module.exports = { SPECS };
