# Changelog

## 2.4.0-alpha.1 : 2026-06-10

Large robustness + feature release; every fix below was found and verified by
an adversarial multi-agent review.

**New**
- **Activity detail**: the badge shows *what exactly* is happening —
  `EDITING badge.js`, `SHELL npm test`, `SUBAGENT code-reviewer`
  (`FEATURE_DETAIL`, local-only; defaults off for configs created before 2.4).
- **Cost chip**: session cost in USD (`FEATURE_COST`).
- **New states**: `SEARCHING`/`FETCHING` (web), `MCP` (with server:tool
  detail), `SKILL`, `PLANNING`, `COMPACTING`, and `THINKING` between tools
  (PostToolUse) instead of a sticking last-tool badge.
- **DONE shows the turn duration**, and the done-notification includes it
  ("Claude is done (4m12s)").
- **`/claude-pulse:doctor`**: real wiring checks (statusline registered,
  launcher resolvable, hooks firing) with a computed verdict and correct
  tmux/screen/OSC-9 guidance.
- Ocean theme re-spread into distinct hues; new `COLOR_WEB`/`COLOR_MCP` slots.
- `NEEDS OK` replaces the German `WARTET AUF OK` chip label.

**Fixed**
- `settings.json` safety: unparseable files are never rewritten (previously
  all user settings could be wiped), the `.bak` backup is one-time instead of
  overwritten on every run, backups contaminated by older versions are
  cleaned, and a replaced foreign statusline is saved and **restored** when
  the badge is turned off. `isOurs()` no longer matches user-owned scripts
  that merely end in `statusline.js`/`badge.js`.
- **Per-session state**: parallel Claude Code sessions no longer repaint each
  other's badge, merge subagent counts, or reset each other's turn timer.
  Session files are cleaned on SessionEnd and garbage-collected after crashes.
- Subagent counter: honors `FEATURE_SUBAGENTS` in the badge, markers cleared
  at boundaries even when the feature is off, no phantom `⚙ N` from pre-2.4
  markers after upgrading, and no counter wipe on spurious mid-turn
  UserPromptSubmit events (anthropics/claude-code#16952).
- Turn timer survives auto-compaction (SessionStart with `source=compact`
  fires mid-turn) and never shows absurd durations after a crash.
- `CLAUDE_CONFIG_DIR` honored everywhere; Git-Bash `$HOME` vs Windows
  `USERPROFILE` mismatch fixed in the wizards.
- 256-color fallback when the terminal doesn't advertise truecolor
  (GNU screen, Apple Terminal, linux console).
- Atomic state writes use unique temp names (parallel hook processes could
  corrupt the state file).
- Setup/config wizards fit the AskUserQuestion limits (max 4 options per
  question) and offer notification granularity (done / needs-input / both).

**Dev**
- `node scripts/smoke.js`: 39-check end-to-end smoke test, no dependencies.

## 2.3.0 — 2026-06-09
- Context-window gauge (`▓▓▓▓░░░ 58%`), reasoning-effort chip, live turn
  duration in the badge.

## 2.2.0 — 2026-06-09
- Running-subagent counter chip (`⚙ N`).

## 2.1.1 — 2026-06-08
- Mode chip shown only while active; approval chip keyed precisely off
  `notification_type`.

## 2.1.0 — 2026-06-08
- Version-robust statusline launcher at a stable path — registration
  survives plugin version bumps and reinstalls.

## 2.0 — 2026-06-04
- Renamed to **Claude Pulse**; permission-mode + approval chips,
  contrast-aware badge text, privacy policy, launch assets.
- Rebuilt from the OSC-11 background-color hook (dead since Claude Code
  v2.1.139) into the statusline badge / title / notification plugin.
