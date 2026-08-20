# EmTech Media — Phase 5 SEO Content Audit

Generated from the canonical source (`tips-data.js`) and the rendered static pages (initial HTML — exactly what a no-JavaScript crawler sees). Base URL: https://emtechbytes-cpu.github.io/emtech-media

## Method

- One record per published fix; every field computed from source, none hand-entered.
- Quality score (0–100): steps ≤25 · instructional substance (step words: ≥80=30, 50–79=24, 35–49=18, <35=12) ≤30 · safety metadata completeness ≤25 · related links 2–4 = 10 · discoverability (hub link + sitemap + canonical) = 10. Substance is judged on the steps because lede/safety/verify/failure sections are shared template chrome.
- Classification is rule-based: **REVIEW** = real defect (duplicate title/description, discoverability gap) or questionable/overlapping standalone intent; **NEEDS_ENRICHMENT** = valid standalone answer with thin instructional content (<50 step words); **STRONG** = everything else. The quality score is a continuous ranking metric, not the classifier. No page is merged, deleted, redirected, or noindexed by this audit.
- Search intent / target query are derived mechanically from each tip's own title and description — nothing invented.

## Summary

| Classification | Count |
|---|---|
| STRONG | 71 |
| NEEDS_ENRICHMENT | 18 |
| REVIEW | 0 |
| **Total** | **89** (66 Windows · 23 Mac) |

- Unique titles across all 93 published pages: yes
- Unique meta descriptions: yes
- Exactly one H1 per fix page: yes (89/89)
- Canonical matches URL on every fix page: yes (89/89)
- Every fix linked from its platform hub: yes (89/89)
- Every fix in sitemap.xml: yes (89/89)
- BreadcrumbList JSON-LD valid and matching visible breadcrumbs: yes (89/89)

## Per-fix records

| Slug | Platform | Title | Steps | Words | Risk | Related | Hub | Sitemap | Canonical | Score | Classification |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `disable-startup-bloat` | windows | Disable startup bloat \| EmTech Media | 4 | 184 | null | 2 | yes | yes | ok | 67 | **NEEDS_ENRICHMENT** |
| `switch-the-power-plan-to-best-performance` | windows | Switch the power plan to Best Performance \| EmTech Media | 4 | 190 | null | 2 | yes | yes | ok | 67 | **NEEDS_ENRICHMENT** |
| `move-your-os-or-games-to-an-ssd` | windows | Move your OS or games to an SSD \| EmTech Media | 4 | 215 | null | 2 | yes | yes | ok | 79 | **STRONG** |
| `upgrade-your-ram-and-match-it` | windows | Upgrade your RAM (and match it) \| EmTech Media | 4 | 198 | null | 2 | yes | yes | ok | 79 | **STRONG** |
| `stop-windows-updates-at-odd-hours` | windows | Stop Windows updates at odd hours \| EmTech Media | 3 | 177 | null | 2 | yes | yes | ok | 63 | **NEEDS_ENRICHMENT** |
| `fix-a-pc-that-overheats-and-fans-like-a-jet-engine` | windows | Fix a PC that overheats and fans like a jet engine \| EmTech Media | 5 | 217 | null | 2 | yes | yes | ok | 84 | **STRONG** |
| `lower-windows-transparency-and-animation-effects` | windows | Lower Windows transparency and animation effects \| EmTech Media | 3 | 183 | null | 2 | yes | yes | ok | 63 | **NEEDS_ENRICHMENT** |
| `clean-up-temp-files-and-browser-cache-properly` | windows | Clean up temp files and browser cache properly \| EmTech Media | 3 | 191 | null | 2 | yes | yes | ok | 69 | **NEEDS_ENRICHMENT** |
| `let-windows-storage-sense-do-the-work-for-you` | windows | Let Windows' Storage Sense do the work for you \| EmTech Media | 3 | 187 | null | 2 | yes | yes | ok | 63 | **NEEDS_ENRICHMENT** |
| `uninstall-the-apps-you-never-use` | windows | Uninstall the apps you never use \| EmTech Media | 4 | 191 | null | 2 | yes | yes | ok | 73 | **NEEDS_ENRICHMENT** |
| `check-for-driver-updates-in-the-right-order` | windows | Check for driver updates (in the right order) \| EmTech Media | 3 | 195 | null | 2 | yes | yes | ok | 69 | **NEEDS_ENRICHMENT** |
| `run-a-disk-health-check-before-it-s-too-late` | windows | Run a disk health check before it's too late \| EmTech Media | 4 | 212 | null | 2 | yes | yes | ok | 79 | **STRONG** |
| `back-up-properly-3-2-1-rule` | windows | Back up properly (3-2-1 rule) \| EmTech Media | 4 | 208 | null | 2 | yes | yes | ok | 79 | **STRONG** |
| `stop-games-stuttering-the-5-point-checklist` | windows | Stop games stuttering — the 5-point checklist \| EmTech Media | 5 | 204 | null | 2 | yes | yes | ok | 84 | **STRONG** |
| `raise-your-effective-fps-with-windows-game-mode` | windows | Raise your effective FPS with Windows Game Mode \| EmTech Media | 3 | 187 | null | 2 | yes | yes | ok | 69 | **NEEDS_ENRICHMENT** |
| `reduce-input-lag-in-competitive-games` | windows | Reduce input lag in competitive games \| EmTech Media | 4 | 208 | null | 2 | yes | yes | ok | 79 | **STRONG** |
| `hardening-accounts-updates-and-the-firewall` | windows | Hardening: accounts, updates, and the firewall \| EmTech Media | 4 | 218 | null | 2 | yes | yes | ok | 79 | **STRONG** |
| `kill-shady-pc-optimizer-software` | windows | Kill shady 'PC optimizer' software \| EmTech Media | 3 | 200 | null | 2 | yes | yes | ok | 75 | **STRONG** |
| `repair-corrupted-system-files` | windows | Repair corrupted system files \| EmTech Media | 4 | 181 | null | 2 | yes | yes | ok | 67 | **NEEDS_ENRICHMENT** |
| `connected-but-no-internet-the-safe-dns-and-stack-reset` | windows | Connected but no internet? The safe DNS and stack reset | 4 | 285 | null | 2 | yes | yes | ok | 85 | **STRONG** |
| `stop-your-pc-from-sleep-glitching-your-network` | windows | Stop your PC from sleep-glitching your network \| EmTech Media | 3 | 188 | null | 2 | yes | yes | ok | 69 | **NEEDS_ENRICHMENT** |
| `know-your-bios-settings-the-5-that-matter` | windows | Know your BIOS settings (the 5 that matter) \| EmTech Media | 5 | 222 | null | 2 | yes | yes | ok | 84 | **STRONG** |
| `protect-against-ransomware-before-it-s-too-late` | windows | Protect against ransomware before it's too late \| EmTech Media | 3 | 216 | null | 2 | yes | yes | ok | 75 | **STRONG** |
| `make-windows-search-actually-useful-again` | windows | Make Windows Search actually useful again \| EmTech Media | 3 | 218 | null | 4 | yes | yes | ok | 69 | **NEEDS_ENRICHMENT** |
| `save-your-games-the-right-way` | windows | Save your games the right way \| EmTech Media | 3 | 204 | null | 2 | yes | yes | ok | 69 | **NEEDS_ENRICHMENT** |
| `make-your-desktop-feel-like-a-mac-without-the-price` | windows | Make your desktop feel like a Mac (without the price) | 4 | 210 | null | 2 | yes | yes | ok | 79 | **STRONG** |
| `fix-my-pc-is-slow-all-of-a-sudden-the-order-of-attack` | windows | Fix 'My PC is slow all of a sudden' — the order of attack | 4 | 220 | null | 2 | yes | yes | ok | 79 | **STRONG** |
| `free-up-disk-space-with-storage-management` | mac | Free up disk space with Storage Management \| EmTech Media | 4 | 187 | null | 2 | yes | yes | ok | 73 | **NEEDS_ENRICHMENT** |
| `reset-nvram-when-things-misbehave` | mac | Reset NVRAM when things misbehave \| EmTech Media | 4 | 187 | null | 2 | yes | yes | ok | 73 | **NEEDS_ENRICHMENT** |
| `keep-macos-updated-the-safe-way` | mac | Keep macOS updated the safe way \| EmTech Media | 4 | 190 | null | 2 | yes | yes | ok | 73 | **NEEDS_ENRICHMENT** |
| `speed-up-a-sluggish-macbook` | mac | Speed up a sluggish MacBook \| EmTech Media | 4 | 183 | null | 2 | yes | yes | ok | 73 | **NEEDS_ENRICHMENT** |
| `hunt-down-memory-hogs` | windows | Hunt down memory hogs \| EmTech Media | 5 | 284 | null | 2 | yes | yes | ok | 90 | **STRONG** |
| `make-big-file-transfers-actually-fast` | windows | Make big file transfers actually fast \| EmTech Media | 5 | 283 | null | 2 | yes | yes | ok | 90 | **STRONG** |
| `stop-windows-tracking-your-location` | windows | Stop Windows tracking your location \| EmTech Media | 5 | 256 | null | 2 | yes | yes | ok | 90 | **STRONG** |
| `create-a-local-account-that-doesn-t-phone-home` | windows | Create a local account that doesn't phone home \| EmTech Media | 5 | 247 | null | 2 | yes | yes | ok | 90 | **STRONG** |
| `tighten-up-chrome-the-10-minute-pass` | windows | Tighten up Chrome — the 10-minute pass \| EmTech Media | 5 | 242 | null | 2 | yes | yes | ok | 90 | **STRONG** |
| `skip-paid-antivirus-and-keep-defender-sharp` | windows | Skip paid antivirus — and keep Defender sharp \| EmTech Media | 5 | 252 | null | 2 | yes | yes | ok | 90 | **STRONG** |
| `dodge-bundleware-when-you-install-anything` | windows | Dodge bundleware when you install anything \| EmTech Media | 5 | 247 | null | 2 | yes | yes | ok | 90 | **STRONG** |
| `run-drive-optimization-the-safe-way` | windows | Run drive optimization the safe way \| EmTech Media | 4 | 235 | null | 2 | yes | yes | ok | 79 | **STRONG** |
| `master-the-keyboard-shortcuts-that-save-hours` | windows | Master the keyboard shortcuts that save hours \| EmTech Media | 5 | 259 | null | 2 | yes | yes | ok | 90 | **STRONG** |
| `install-powertoys-microsoft-s-free-utility-pack` | windows | Install PowerToys — Microsoft's free utility pack \| EmTech Media | 5 | 237 | null | 2 | yes | yes | ok | 84 | **STRONG** |
| `lock-down-your-home-wi-fi-properly` | windows | Lock down your home Wi-Fi properly \| EmTech Media | 5 | 277 | null | 4 | yes | yes | ok | 90 | **STRONG** |
| `stop-emailing-passwords-and-secrets` | windows | Stop emailing passwords and secrets \| EmTech Media | 4 | 232 | null | 2 | yes | yes | ok | 79 | **STRONG** |
| `turn-on-full-disk-encryption-bitlocker` | windows | Turn on full-disk encryption (BitLocker) \| EmTech Media | 4 | 228 | null | 2 | yes | yes | ok | 79 | **STRONG** |
| `make-your-laptop-battery-last-longer` | windows | Make your laptop battery last longer \| EmTech Media | 4 | 245 | null | 2 | yes | yes | ok | 85 | **STRONG** |
| `fix-a-blue-screen-bsod-without-panicking` | windows | Fix a blue screen (BSOD) without panicking \| EmTech Media | 4 | 266 | null | 2 | yes | yes | ok | 85 | **STRONG** |
| `no-sound-the-four-minute-fix` | windows | No sound? The four-minute fix \| EmTech Media | 4 | 251 | null | 2 | yes | yes | ok | 85 | **STRONG** |
| `organise-your-work-with-virtual-desktops` | windows | Organise your work with virtual desktops \| EmTech Media | 4 | 233 | null | 2 | yes | yes | ok | 79 | **STRONG** |
| `slow-internet-run-the-five-minute-test` | windows | Slow internet? Run the five-minute test \| EmTech Media | 5 | 267 | null | 2 | yes | yes | ok | 90 | **STRONG** |
| `wi-fi-off-or-missing-the-three-switches-that-disable-it` | windows | Wi-Fi off or missing? The three switches that disable it | 4 | 288 | null | 2 | yes | yes | ok | 85 | **STRONG** |
| `force-quit-a-frozen-app` | mac | Force-quit a frozen app \| EmTech Media | 3 | 207 | null | 4 | yes | yes | ok | 69 | **NEEDS_ENRICHMENT** |
| `stop-apps-from-launching-at-login` | mac | Stop apps from launching at login \| EmTech Media | 3 | 210 | null | 2 | yes | yes | ok | 75 | **STRONG** |
| `keep-10-of-your-disk-free` | mac | Keep 10% of your disk free \| EmTech Media | 4 | 232 | null | 2 | yes | yes | ok | 79 | **STRONG** |
| `tame-spotlight-indexing-on-extra-drives` | mac | Tame Spotlight indexing on extra drives \| EmTech Media | 3 | 214 | null | 2 | yes | yes | ok | 75 | **STRONG** |
| `fix-a-mac-that-won-t-start-up` | mac | Fix a Mac that won't start up \| EmTech Media | 4 | 240 | null | 4 | yes | yes | ok | 79 | **STRONG** |
| `run-first-aid-on-external-drives` | mac | Run First Aid on external drives \| EmTech Media | 4 | 242 | null | 4 | yes | yes | ok | 79 | **STRONG** |
| `keep-your-mac-battery-healthy` | mac | Keep your Mac battery healthy \| EmTech Media | 4 | 240 | null | 4 | yes | yes | ok | 85 | **STRONG** |
| `set-up-time-machine-properly` | mac | Set up Time Machine properly \| EmTech Media | 4 | 230 | null | 2 | yes | yes | ok | 85 | **STRONG** |
| `turn-on-filevault-full-disk-encryption` | mac | Turn on FileVault full-disk encryption \| EmTech Media | 3 | 201 | null | 2 | yes | yes | ok | 75 | **STRONG** |
| `open-apps-blocked-by-gatekeeper` | mac | Open apps blocked by Gatekeeper \| EmTech Media | 3 | 231 | null | 4 | yes | yes | ok | 75 | **STRONG** |
| `fix-slow-wi-fi-on-your-mac` | mac | Fix slow Wi-Fi on your Mac \| EmTech Media | 4 | 270 | null | 4 | yes | yes | ok | 85 | **STRONG** |
| `give-safari-a-proper-clean-out` | mac | Give Safari a proper clean-out \| EmTech Media | 4 | 250 | null | 4 | yes | yes | ok | 79 | **STRONG** |
| `pick-an-ssd-that-s-actually-fast` | windows | Pick an SSD that's actually fast \| EmTech Media | 4 | 255 | null | 2 | yes | yes | ok | 85 | **STRONG** |
| `size-your-psu-before-the-next-upgrade` | windows | Size your PSU before the next upgrade \| EmTech Media | 4 | 254 | null | 2 | yes | yes | ok | 85 | **STRONG** |
| `fix-a-hot-pc-for-good-the-airflow-pass` | windows | Fix a hot PC for good: the airflow pass \| EmTech Media | 5 | 269 | null | 2 | yes | yes | ok | 90 | **STRONG** |
| `windows-10-is-past-end-of-support-what-to-do-now` | windows | Windows 10 is past end of support — what to do now \| EmTech Media | 4 | 283 | null | 2 | yes | yes | ok | 85 | **STRONG** |
| `check-whether-your-pc-can-run-windows-11` | windows | Check whether your PC can run Windows 11 \| EmTech Media | 5 | 293 | null | 2 | yes | yes | ok | 90 | **STRONG** |
| `fix-a-printer-that-won-t-print` | windows | Fix a printer that won't print \| EmTech Media | 4 | 278 | null | 4 | yes | yes | ok | 85 | **STRONG** |
| `fix-a-microphone-no-one-can-hear` | windows | Fix a microphone no one can hear \| EmTech Media | 4 | 253 | null | 2 | yes | yes | ok | 85 | **STRONG** |
| `fix-a-webcam-that-won-t-turn-on` | windows | Fix a webcam that won't turn on \| EmTech Media | 4 | 262 | null | 2 | yes | yes | ok | 85 | **STRONG** |
| `bluetooth-won-t-connect-the-pairing-reset-that-works` | windows | Bluetooth won't connect? The pairing reset that works | 4 | 260 | null | 2 | yes | yes | ok | 85 | **STRONG** |
| `usb-device-not-recognised-the-device-manager-pass` | windows | USB device not recognised? The Device Manager pass \| EmTech Media | 4 | 304 | null | 2 | yes | yes | ok | 85 | **STRONG** |
| `start-windows-in-safe-mode` | windows | Start Windows in Safe Mode \| EmTech Media | 5 | 239 | null | 2 | yes | yes | ok | 90 | **STRONG** |
| `get-back-a-file-you-deleted-by-mistake` | windows | Get back a file you deleted by mistake \| EmTech Media | 5 | 290 | null | 2 | yes | yes | ok | 90 | **STRONG** |
| `pc-won-t-turn-on-run-the-five-minute-power-check` | windows | PC won't turn on? Run the five-minute power check \| EmTech Media | 4 | 338 | null | 2 | yes | yes | ok | 85 | **STRONG** |
| `fix-a-pc-that-won-t-start-up` | windows | Fix a PC that won't start up \| EmTech Media | 5 | 345 | null | 2 | yes | yes | ok | 90 | **STRONG** |
| `black-screen-check-the-display-signal-path-first` | windows | Black screen? Check the display signal path first \| EmTech Media | 4 | 296 | null | 2 | yes | yes | ok | 85 | **STRONG** |
| `spot-a-phishing-email-before-you-click` | windows | Spot a phishing email before you click \| EmTech Media | 5 | 270 | null | 2 | yes | yes | ok | 90 | **STRONG** |
| `move-everything-to-a-new-pc` | windows | Move everything to a new PC \| EmTech Media | 5 | 290 | null | 2 | yes | yes | ok | 90 | **STRONG** |
| `tighten-up-edge-and-firefox` | windows | Tighten up Edge and Firefox \| EmTech Media | 4 | 243 | null | 2 | yes | yes | ok | 85 | **STRONG** |
| `windows-update-stuck-the-safe-retry-pass` | windows | Windows Update stuck? The safe retry pass \| EmTech Media | 4 | 326 | null | 2 | yes | yes | ok | 85 | **STRONG** |
| `cpu-pegged-at-100-find-the-culprit-in-task-manager` | windows | CPU pegged at 100%? Find the culprit in Task Manager | 4 | 285 | null | 2 | yes | yes | ok | 85 | **STRONG** |
| `connected-but-no-internet-on-your-mac-the-safe-network-reset` | mac | Connected but no internet on your Mac? The safe network reset | 4 | 294 | null | 4 | yes | yes | ok | 85 | **STRONG** |
| `no-sound-on-your-mac-check-the-output-device-first` | mac | No sound on your Mac? Check the output device first | 4 | 274 | null | 2 | yes | yes | ok | 85 | **STRONG** |
| `external-monitor-not-detected-on-your-mac` | mac | External monitor not detected on your Mac? \| EmTech Media | 4 | 263 | null | 2 | yes | yes | ok | 85 | **STRONG** |
| `bluetooth-won-t-pair-on-your-mac-reset-it-properly` | mac | Bluetooth won't pair on your Mac? Reset it properly | 4 | 251 | null | 4 | yes | yes | ok | 79 | **STRONG** |
| `trackpad-or-mouse-not-working-on-your-mac-the-safe-restart-pass` | mac | Trackpad or mouse not working on your Mac? The safe restart pass | 4 | 311 | null | 4 | yes | yes | ok | 85 | **STRONG** |
| `no-microphone-on-your-mac-check-the-input-device-first` | mac | No microphone on your Mac? Check the input device first | 4 | 282 | null | 2 | yes | yes | ok | 85 | **STRONG** |
| `microphone-permission-on-your-mac-let-the-app-use-it` | mac | Microphone permission on your Mac? Let the app use it | 4 | 270 | null | 2 | yes | yes | ok | 85 | **STRONG** |

## Non-STRONG classifications — reasoning

- **disable-startup-bloat** (NEEDS_ENRICHMENT, score 67): thin instructional content (30 step words). Action: Valid standalone answer but thin (30 step words) — optional enrichment candidate (one more concrete check or edge case); do not pad.
- **switch-the-power-plan-to-best-performance** (NEEDS_ENRICHMENT, score 67): thin instructional content (29 step words). Action: Valid standalone answer but thin (29 step words) — optional enrichment candidate (one more concrete check or edge case); do not pad.
- **stop-windows-updates-at-odd-hours** (NEEDS_ENRICHMENT, score 63): thin instructional content (30 step words). Action: Valid standalone answer but thin (30 step words) — optional enrichment candidate (one more concrete check or edge case); do not pad.
- **lower-windows-transparency-and-animation-effects** (NEEDS_ENRICHMENT, score 63): thin instructional content (25 step words). Action: Valid standalone answer but thin (25 step words) — optional enrichment candidate (one more concrete check or edge case); do not pad.
- **clean-up-temp-files-and-browser-cache-properly** (NEEDS_ENRICHMENT, score 69): see recommended action. Action: Valid standalone answer but thin (35 step words) — optional enrichment candidate (one more concrete check or edge case); do not pad.
- **let-windows-storage-sense-do-the-work-for-you** (NEEDS_ENRICHMENT, score 63): thin instructional content (32 step words). Action: Valid standalone answer but thin (32 step words) — optional enrichment candidate (one more concrete check or edge case); do not pad.
- **uninstall-the-apps-you-never-use** (NEEDS_ENRICHMENT, score 73): see recommended action. Action: Valid standalone answer but thin (39 step words) — optional enrichment candidate (one more concrete check or edge case); do not pad.
- **check-for-driver-updates-in-the-right-order** (NEEDS_ENRICHMENT, score 69): see recommended action. Action: Valid standalone answer but thin (40 step words) — optional enrichment candidate (one more concrete check or edge case); do not pad.
- **raise-your-effective-fps-with-windows-game-mode** (NEEDS_ENRICHMENT, score 69): see recommended action. Action: Valid standalone answer but thin (43 step words) — optional enrichment candidate (one more concrete check or edge case); do not pad.
- **repair-corrupted-system-files** (NEEDS_ENRICHMENT, score 67): thin instructional content (31 step words). Action: Valid standalone answer but thin (31 step words) — optional enrichment candidate (one more concrete check or edge case); do not pad.
- **stop-your-pc-from-sleep-glitching-your-network** (NEEDS_ENRICHMENT, score 69): see recommended action. Action: Valid standalone answer but thin (37 step words) — optional enrichment candidate (one more concrete check or edge case); do not pad.
- **make-windows-search-actually-useful-again** (NEEDS_ENRICHMENT, score 69): see recommended action. Action: Valid standalone answer but thin (44 step words) — optional enrichment candidate (one more concrete check or edge case); do not pad.
- **save-your-games-the-right-way** (NEEDS_ENRICHMENT, score 69): see recommended action. Action: Valid standalone answer but thin (46 step words) — optional enrichment candidate (one more concrete check or edge case); do not pad.
- **free-up-disk-space-with-storage-management** (NEEDS_ENRICHMENT, score 73): see recommended action. Action: Valid standalone answer but thin (42 step words) — optional enrichment candidate (one more concrete check or edge case); do not pad.
- **reset-nvram-when-things-misbehave** (NEEDS_ENRICHMENT, score 73): see recommended action. Action: Valid standalone answer but thin (40 step words) — optional enrichment candidate (one more concrete check or edge case); do not pad.
- **keep-macos-updated-the-safe-way** (NEEDS_ENRICHMENT, score 73): see recommended action. Action: Valid standalone answer but thin (44 step words) — optional enrichment candidate (one more concrete check or edge case); do not pad.
- **speed-up-a-sluggish-macbook** (NEEDS_ENRICHMENT, score 73): see recommended action. Action: Valid standalone answer but thin (39 step words) — optional enrichment candidate (one more concrete check or edge case); do not pad.
- **force-quit-a-frozen-app** (NEEDS_ENRICHMENT, score 69): see recommended action. Action: Valid standalone answer but thin (43 step words) — optional enrichment candidate (one more concrete check or edge case); do not pad.

## Search-intent mapping (derived from canonical data)

| Fix | Likely problem phrase | Intent type | Example target query |
|---|---|---|---|
| `disable-startup-bloat` | Disable startup bloat | how-to / prevention | “disable startup bloat windows” |
| `switch-the-power-plan-to-best-performance` | Switch the power plan to Best Performance | how-to / prevention | “switch the power plan to best performance windows” |
| `move-your-os-or-games-to-an-ssd` | Move your OS or games to an SSD | how-to / prevention | “move your os or games to an ssd windows” |
| `upgrade-your-ram-and-match-it` | Upgrade your RAM (and match it) | how-to / prevention | “upgrade your ram (and match it) windows” |
| `stop-windows-updates-at-odd-hours` | Stop Windows updates at odd hours | how-to / prevention | “stop windows updates at odd hours windows” |
| `fix-a-pc-that-overheats-and-fans-like-a-jet-engine` | a PC that overheats and fans like a jet engine | troubleshoot | “a pc that overheats and fans like a jet engine windows” |
| `lower-windows-transparency-and-animation-effects` | Lower Windows transparency and animation effects | how-to / prevention | “lower windows transparency and animation effects windows” |
| `clean-up-temp-files-and-browser-cache-properly` | Clean up temp files and browser cache properly | how-to / prevention | “clean up temp files and browser cache properly windows” |
| `let-windows-storage-sense-do-the-work-for-you` | Let Windows' Storage Sense do the work for you | how-to / prevention | “let windows' storage sense do the work for you windows” |
| `uninstall-the-apps-you-never-use` | Uninstall the apps you never use | how-to / prevention | “uninstall the apps you never use windows” |
| `check-for-driver-updates-in-the-right-order` | Check for driver updates (in the right order) | how-to / prevention | “check for driver updates (in the right order) windows” |
| `run-a-disk-health-check-before-it-s-too-late` | Run a disk health check before it's too late | how-to / prevention | “run a disk health check before it's too late windows” |
| `back-up-properly-3-2-1-rule` | Back up properly (3-2-1 rule) | how-to / prevention | “back up properly (3-2-1 rule) windows” |
| `stop-games-stuttering-the-5-point-checklist` | Stop games stuttering | how-to / prevention | “stop games stuttering windows” |
| `raise-your-effective-fps-with-windows-game-mode` | Raise your effective FPS with Windows Game Mode | how-to / prevention | “raise your effective fps with windows game mode windows” |
| `reduce-input-lag-in-competitive-games` | Reduce input lag in competitive games | how-to / prevention | “reduce input lag in competitive games windows” |
| `hardening-accounts-updates-and-the-firewall` | Hardening: accounts, updates, and the firewall | how-to / prevention | “hardening: accounts, updates, and the firewall windows” |
| `kill-shady-pc-optimizer-software` | Kill shady 'PC optimizer' software | how-to / prevention | “kill shady 'pc optimizer' software windows” |
| `repair-corrupted-system-files` | Repair corrupted system files | how-to / prevention | “repair corrupted system files windows” |
| `connected-but-no-internet-the-safe-dns-and-stack-reset` | Connected but no internet | troubleshoot | “connected but no internet windows” |
| `stop-your-pc-from-sleep-glitching-your-network` | Stop your PC from sleep-glitching your network | how-to / prevention | “stop your pc from sleep-glitching your network windows” |
| `know-your-bios-settings-the-5-that-matter` | Know your BIOS settings (the 5 that matter) | how-to / prevention | “know your bios settings (the 5 that matter) windows” |
| `protect-against-ransomware-before-it-s-too-late` | Protect against ransomware before it's too late | how-to / prevention | “protect against ransomware before it's too late windows” |
| `make-windows-search-actually-useful-again` | Make Windows Search actually useful again | how-to / prevention | “make windows search actually useful again windows” |
| `save-your-games-the-right-way` | Save your games the right way | how-to / prevention | “save your games the right way windows” |
| `make-your-desktop-feel-like-a-mac-without-the-price` | Make your desktop feel like a Mac (without the price) | how-to / prevention | “make your desktop feel like a mac (without the price) windows” |
| `fix-my-pc-is-slow-all-of-a-sudden-the-order-of-attack` | Fix 'My PC is slow all of a sudden' | troubleshoot | “fix 'my pc is slow all of a sudden' windows” |
| `free-up-disk-space-with-storage-management` | Free up disk space with Storage Management | how-to / prevention | “free up disk space with storage management on my mac” |
| `reset-nvram-when-things-misbehave` | Reset NVRAM when things misbehave | how-to / prevention | “reset nvram when things misbehave on my mac” |
| `keep-macos-updated-the-safe-way` | Keep macOS updated the safe way | how-to / prevention | “keep macos updated the safe way on my mac” |
| `speed-up-a-sluggish-macbook` | Speed up a sluggish MacBook | how-to / prevention | “speed up a sluggish macbook on my mac” |
| `hunt-down-memory-hogs` | Hunt down memory hogs | how-to / prevention | “hunt down memory hogs windows” |
| `make-big-file-transfers-actually-fast` | Make big file transfers actually fast | how-to / prevention | “make big file transfers actually fast windows” |
| `stop-windows-tracking-your-location` | Stop Windows tracking your location | how-to / prevention | “stop windows tracking your location windows” |
| `create-a-local-account-that-doesn-t-phone-home` | Create a local account that doesn't phone home | how-to / prevention | “create a local account that doesn't phone home windows” |
| `tighten-up-chrome-the-10-minute-pass` | Tighten up Chrome | how-to / prevention | “tighten up chrome windows” |
| `skip-paid-antivirus-and-keep-defender-sharp` | Skip paid antivirus | how-to / prevention | “skip paid antivirus windows” |
| `dodge-bundleware-when-you-install-anything` | Dodge bundleware when you install anything | how-to / prevention | “dodge bundleware when you install anything windows” |
| `run-drive-optimization-the-safe-way` | Run drive optimization the safe way | how-to / prevention | “run drive optimization the safe way windows” |
| `master-the-keyboard-shortcuts-that-save-hours` | Master the keyboard shortcuts that save hours | how-to / prevention | “master the keyboard shortcuts that save hours windows” |
| `install-powertoys-microsoft-s-free-utility-pack` | Install PowerToys | how-to / prevention | “install powertoys windows” |
| `lock-down-your-home-wi-fi-properly` | Lock down your home Wi-Fi properly | how-to / prevention | “lock down your home wi-fi properly windows” |
| `stop-emailing-passwords-and-secrets` | Stop emailing passwords and secrets | how-to / prevention | “stop emailing passwords and secrets windows” |
| `turn-on-full-disk-encryption-bitlocker` | Turn on full-disk encryption (BitLocker) | how-to / prevention | “turn on full-disk encryption (bitlocker) windows” |
| `make-your-laptop-battery-last-longer` | Make your laptop battery last longer | how-to / prevention | “make your laptop battery last longer windows” |
| `fix-a-blue-screen-bsod-without-panicking` | a blue screen (BSOD) without panicking | troubleshoot | “a blue screen (bsod) without panicking windows” |
| `no-sound-the-four-minute-fix` | No sound | troubleshoot | “no sound windows” |
| `organise-your-work-with-virtual-desktops` | Organise your work with virtual desktops | how-to / prevention | “organise your work with virtual desktops windows” |
| `slow-internet-run-the-five-minute-test` | Slow internet | troubleshoot | “slow internet windows” |
| `wi-fi-off-or-missing-the-three-switches-that-disable-it` | Wi-Fi off or missing | troubleshoot | “wi-fi off or missing windows” |
| `force-quit-a-frozen-app` | Force-quit a frozen app | how-to / prevention | “force-quit a frozen app on my mac” |
| `stop-apps-from-launching-at-login` | Stop apps from launching at login | how-to / prevention | “stop apps from launching at login on my mac” |
| `keep-10-of-your-disk-free` | Keep 10% of your disk free | how-to / prevention | “keep 10% of your disk free on my mac” |
| `tame-spotlight-indexing-on-extra-drives` | Tame Spotlight indexing on extra drives | how-to / prevention | “tame spotlight indexing on extra drives on my mac” |
| `fix-a-mac-that-won-t-start-up` | a Mac that won't start up | troubleshoot | “a mac that won't start up on my mac” |
| `run-first-aid-on-external-drives` | Run First Aid on external drives | how-to / prevention | “run first aid on external drives on my mac” |
| `keep-your-mac-battery-healthy` | Keep your Mac battery healthy | how-to / prevention | “keep your mac battery healthy on my mac” |
| `set-up-time-machine-properly` | Set up Time Machine properly | how-to / prevention | “set up time machine properly on my mac” |
| `turn-on-filevault-full-disk-encryption` | Turn on FileVault full-disk encryption | how-to / prevention | “turn on filevault full-disk encryption on my mac” |
| `open-apps-blocked-by-gatekeeper` | Open apps blocked by Gatekeeper | how-to / prevention | “open apps blocked by gatekeeper on my mac” |
| `fix-slow-wi-fi-on-your-mac` | slow Wi-Fi on your Mac | troubleshoot | “slow wi-fi on your mac on my mac” |
| `give-safari-a-proper-clean-out` | Give Safari a proper clean-out | how-to / prevention | “give safari a proper clean-out on my mac” |
| `pick-an-ssd-that-s-actually-fast` | Pick an SSD that's actually fast | how-to / prevention | “pick an ssd that's actually fast windows” |
| `size-your-psu-before-the-next-upgrade` | Size your PSU before the next upgrade | how-to / prevention | “size your psu before the next upgrade windows” |
| `fix-a-hot-pc-for-good-the-airflow-pass` | a hot PC for good: the airflow pass | troubleshoot | “a hot pc for good: the airflow pass windows” |
| `windows-10-is-past-end-of-support-what-to-do-now` | Windows 10 is past end of support | how-to / prevention | “windows 10 is past end of support windows” |
| `check-whether-your-pc-can-run-windows-11` | Check whether your PC can run Windows 11 | how-to / prevention | “check whether your pc can run windows 11 windows” |
| `fix-a-printer-that-won-t-print` | a printer that won't print | troubleshoot | “a printer that won't print windows” |
| `fix-a-microphone-no-one-can-hear` | a microphone no one can hear | troubleshoot | “a microphone no one can hear windows” |
| `fix-a-webcam-that-won-t-turn-on` | a webcam that won't turn on | troubleshoot | “a webcam that won't turn on windows” |
| `bluetooth-won-t-connect-the-pairing-reset-that-works` | Bluetooth won't connect | troubleshoot | “bluetooth won't connect windows” |
| `usb-device-not-recognised-the-device-manager-pass` | USB device not recognised | troubleshoot | “usb device not recognised windows” |
| `start-windows-in-safe-mode` | Start Windows in Safe Mode | how-to / prevention | “start windows in safe mode windows” |
| `get-back-a-file-you-deleted-by-mistake` | Get back a file you deleted by mistake | how-to / prevention | “get back a file you deleted by mistake windows” |
| `pc-won-t-turn-on-run-the-five-minute-power-check` | PC won't turn on | troubleshoot | “pc won't turn on windows” |
| `fix-a-pc-that-won-t-start-up` | a PC that won't start up | troubleshoot | “a pc that won't start up windows” |
| `black-screen-check-the-display-signal-path-first` | Black screen | troubleshoot | “black screen windows” |
| `spot-a-phishing-email-before-you-click` | Spot a phishing email before you click | how-to / prevention | “spot a phishing email before you click windows” |
| `move-everything-to-a-new-pc` | Move everything to a new PC | how-to / prevention | “move everything to a new pc windows” |
| `tighten-up-edge-and-firefox` | Tighten up Edge and Firefox | how-to / prevention | “tighten up edge and firefox windows” |
| `windows-update-stuck-the-safe-retry-pass` | Windows Update stuck | troubleshoot | “windows update stuck windows” |
| `cpu-pegged-at-100-find-the-culprit-in-task-manager` | CPU pegged at 100% | troubleshoot | “cpu pegged at 100% windows” |
| `connected-but-no-internet-on-your-mac-the-safe-network-reset` | Connected but no internet on your Mac | troubleshoot | “connected but no internet on your mac on my mac” |
| `no-sound-on-your-mac-check-the-output-device-first` | No sound on your Mac | troubleshoot | “no sound on your mac on my mac” |
| `external-monitor-not-detected-on-your-mac` | External monitor not detected on your Mac | troubleshoot | “external monitor not detected on your mac on my mac” |
| `bluetooth-won-t-pair-on-your-mac-reset-it-properly` | Bluetooth won't pair on your Mac | troubleshoot | “bluetooth won't pair on your mac on my mac” |
| `trackpad-or-mouse-not-working-on-your-mac-the-safe-restart-pass` | Trackpad or mouse not working on your Mac | troubleshoot | “trackpad or mouse not working on your mac on my mac” |
| `no-microphone-on-your-mac-check-the-input-device-first` | No microphone on your Mac | troubleshoot | “no microphone on your mac on my mac” |
| `microphone-permission-on-your-mac-let-the-app-use-it` | Microphone permission on your Mac | troubleshoot | “microphone permission on your mac on my mac” |

## Title audit (RULE 7)

- Longest title: 65 chars; shortest: 36.
- Titles over 60 chars (SERP truncation risk): 16 — all are natural question-style titles, none keyword-stuffed.
- No title reads like an internal database name; every title states the problem or outcome in plain English.
- **Verdict: no title changes justified.** Changing already-good titles would churn permanent URLs' visible text for no search benefit (slugs are unaffected either way).

## Meta description audit (RULE 8)

- Length range: 71–159 chars. All unique across the site.
- Each description is the tip's own pitch from canonical data — problem + outcome, no template repetition.
- 14 descriptions are under 105 chars; each was checked and is deliberately punchy rather than padded — left as is.

## Introduction / lede audit (RULE 9)

- 89/89 fix pages open with a lede paragraph that states the problem in the user's own words (derived from canonical description data).
- No generic SEO filler detected; ledes are the tip's pitch, not boilerplate.

## Internal linking (RULE 11)

- Every fix is linked from its platform hub via a crawlable <a href> (89/89 verified above).
- Related-fix curation: 76/89 tips carry an explicit same-platform related list in canonical data; the remaining 13 use the group/category fallback. Fallback slugs: <code>make-windows-search-actually-useful-again</code>, <code>lock-down-your-home-wi-fi-properly</code>, <code>force-quit-a-frozen-app</code>, <code>fix-a-mac-that-won-t-start-up</code>, <code>run-first-aid-on-external-drives</code>, <code>keep-your-mac-battery-healthy</code>, <code>open-apps-blocked-by-gatekeeper</code>, <code>fix-slow-wi-fi-on-your-mac</code>, <code>give-safari-a-proper-clean-out</code>, <code>fix-a-printer-that-won-t-print</code>, <code>connected-but-no-internet-on-your-mac-the-safe-network-reset</code>, <code>bluetooth-won-t-pair-on-your-mac-reset-it-properly</code>, <code>trackpad-or-mouse-not-working-on-your-mac-the-safe-restart-pass</code>.
- All curated pairs were reviewed for topical relevance and platform consistency (build fails on cross-platform or unresolvable slugs). No artificial reciprocal-link padding was added.

## Public-facing fix counts (RULE 12)

- ✅ index.html says "89 tested fixes"
- ✅ windows/ hub says "66 tested fixes"
- ✅ mac.html stub says "23 Mac fixes"
- No stale counts (58/74/82/16-Mac era strings) found in any public-facing page.

## Trust & credibility (RULES 13/14) — recommendations only

- About page: does not exist. How We Test page: does not exist. Contact page: does not exist.
- The footer already carries the site identity line ("EmTech Media — PC & Mac problems, solved in plain English") and every fix exposes risk level, reversibility, verification and failure conditions — real E-E-A-T signals for a troubleshooting site.
- **Recommendation (not implemented this phase):** add an About page stating who runs the site and that fixes are written from hands-on testing of the described procedures; a How We Test page describing the deterministic diagnostic engine, safety-metadata requirements and test suites behind each fix; and a contact method for corrections. All three must state only facts supported by this repository — no invented credentials, certifications, or reviewer names.

## Technical SEO findings (RULES 15–18)

- Canonical URLs: all trailing-slash, absolute, unique; every fix page's canonical matches its URL.
- Structured data: BreadcrumbList JSON-LD on every fix page and hub; no HowTo schema (deliberately excluded — Google retired the rich result). All JSON-LD parses and matches visible breadcrumbs.
- Sitemap: 93 URLs, all absolute/canonical/indexable; no windows.html/mac.html legacy entries, no test or 404 URLs.
- robots.txt: allows crawling and references the production sitemap (yes).
- 404 page: all href/src references production-safe (root-anchored) — Phase 4.1 deep-path contract holds (yes).
- Mobile: responsive layout shared across pages; verified at 390×844 in browser checks (no horizontal overflow).

## Deferred items (intentionally untouched this phase)

- Phase 3.4 microphone structured-flow refinement; daily-limit lifecycle ordering; deeper trackpad/mouse triage.
- Content enrichment of the 18 NEEDS_ENRICHMENT pages above — flagged, not padded (RULE 5/10).
- About / How We Test / Contact pages — recommended only (see above).
- Any Cloudflare Worker change; any diagnostic-engine logic change.
