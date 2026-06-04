# Design: cross-platform activity indicator (post-OSC-11)

Date: 2026-06-04
Project: claude-terminal-colors

## Why this exists

Background-color changes via OSC 11 are **dead** on current Claude Code:
- As of CC **v2.1.139** command hooks run without a controlling terminal, so
  writing OSC 11 to `/dev/tty` fails (empirically: `No such device or address`).
- The sanctioned replacement, the hook JSON `terminalSequence` field (v2.1.141+),
  allowlists only **OSC 0/1/2/9/99/777 and BEL** — color sequences like OSC 11 are
  rejected. Verified in the 2.1.162 binary; no setting overrides it.

So we rebuild the "see at a glance what Claude is doing" idea on the channels that
*do* work, and make each independently toggleable.

## Approved decisions

- Use **all three** methods, each on/off via config: **statusline badge**,
  **tab/window title**, **notifications/bell**.
- Hook is rewritten in **Node.js** (no `/dev/tty`, no bash) so it runs on every OS
  Claude Code runs on, **including native Windows**.
- Repo stays **public** (intended for public install — explicit exception).
- The dead OSC-11 path is removed/retired.

## How each channel works (no controlling terminal needed)

| Method | Mechanism | Color? | Notes |
|---|---|---|---|
| Statusline badge | hook writes a **state file**; a statusline script reads it and prints a colored badge (CC renders the statusline itself) | ✅ | needs `statusLine` registered in settings.json |
| Tab/window title | hook returns `terminalSequence` OSC 2 | ❌ | CC also sets its own title (OSC 0) — possible tug-of-war, must test |
| Notification/bell | hook returns `terminalSequence` OSC 9/99/777 / BEL | ❌ | terminal-dependent; fires on done / needs-input |

Both the state-file write and the JSON output work without a tty and on Windows.

## Components

### `hooks/indicator.js` (Node) — replaces `hooks/color.sh`
Invoked as `node "${CLAUDE_PLUGIN_ROOT}/hooks/indicator.js" <event>` where event ∈
`pre|post|prompt|start|end|stop|notify`. Per call:
1. Read stdin JSON (tool_name etc.) and the event arg.
2. Load `~/.claude/terminal-colors/config.conf` (feature flags) and the active
   theme (same resolution as today: `$CLAUDE_TERMINAL_THEME` →
   `~/.claude/terminal-colors/theme.conf` → defaults). Safe key/value parse.
3. Derive the current **state**: `{key,label,icon,color}` from event + tool
   (Bash→shell, Edit/Write→editing, Read/Glob/Grep→reading, Task/Agent→subagent,
   AskUserQuestion→input, prompt→thinking, stop→done, …).
4. **Side effect:** if `FEATURE_STATUSLINE`, write the state as JSON to
   `~/.claude/terminal-colors/state` (atomic write: temp + rename).
5. Build a `terminalSequence` string from enabled features:
   - `FEATURE_TITLE` → OSC 2 `\x1b]2;<icon> Claude ▸ <label>\x07`
   - `FEATURE_NOTIFY` + event qualifies → OSC 9 `\x1b]9;<message>\x07`
     (`stop`+`NOTIFY_DONE` → "Claude is done"; `notify`/AskUserQuestion +
     `NOTIFY_INPUT` → "Claude needs your input"); optional trailing BEL.
6. Output `{"terminalSequence":"…","suppressOutput":true}` on stdout (omit the
   field when empty). Always exit 0. Never touch `/dev/tty`.

### `statusline/badge.js` (Node)
Registered as CC's `statusLine` command. Reads the stdin session JSON (for model
+ cwd), reads `~/.claude/terminal-colors/state` + theme, prints one line:
`<colored block> <icon> <LABEL>   ·  <model> · <dir>` using 24-bit ANSI
(`\x1b[48;2;r;g;bm`) from the state color. If no state file yet, shows a neutral
idle badge. It **replaces** any existing statusline, so `/setup` backs up and
warns before registering it.

### Config — `~/.claude/terminal-colors/config.conf`
```
FEATURE_STATUSLINE=on
FEATURE_TITLE=on
FEATURE_NOTIFY=on
NOTIFY_DONE=on
NOTIFY_INPUT=on
```
Safe-parsed: only these keys, values `on`/`off`. Missing file → all on by default.

### Commands
- `commands/setup.md` (rewrite): pick theme → choose which features to enable
  (AskUserQuestion) → write `config.conf` → if statusline enabled, register
  `statusLine` in `~/.claude/settings.json` (backup first) → short confirmation.
- `commands/config.md` (new): `/claude-terminal-colors:config` toggles features
  later and keeps the statusline registration in sync.
- `commands/theme.md` (keep): still valid — writes `theme.conf`.

### `hooks/hooks.json`
Point every event at `node …/indicator.js <event>`:
`PreToolUse, UserPromptSubmit, SessionStart, SessionEnd, Stop, Notification`.

### Distribution: plugin-only
This is **always a Claude Code plugin** — there is no manual install. Remove the
whole standalone path:
- `hooks/color.sh`, `scripts/selftest.sh` — OSC-11 based, removed.
- `install.sh`, `uninstall.sh` — removed (no manual install/uninstall).
- `scripts/detect-env.sh` — kept, verdict rewritten around title/notification
  support (OSC-11 no longer the criterion).
- Cleanup of the `settings.json` `statusLine` we register is handled inside the
  plugin: `/claude-terminal-colors:config` can turn the statusline off (which
  unregisters it and restores the backup). README documents: disable the
  statusline via `/…:config` before `/plugin uninstall` so no dangling
  `statusLine` entry remains.

## Error handling & boundaries

- `indicator.js` is fully defensive: any error → exit 0 with no output (never
  block a tool, never crash a hook). State write failures are swallowed.
- Each unit is independently testable: indicator (event→state+sequence), badge
  (state→ANSI line), config parse, detect-env verdict.

## Testing

- **indicator.js**: feed event + stdin JSON under each config permutation
  (all on / title-only / notify-only / statusline-only / all off) → assert the
  state file content and the exact `terminalSequence` string; assert it never
  opens `/dev/tty`; assert valid JSON on stdout.
- **badge.js**: given a state file + theme → assert the ANSI line (correct
  truecolor for the theme color, correct label); empty/missing state → idle badge.
- **config**: unknown keys ignored; `off` disables; missing file → defaults.
- **Cannot test here, needs a real CC session** (flagged for the user to verify):
  (a) does the title actually update / lose a tug-of-war with CC's own title;
  (b) does the registered statusline render the badge and how live it refreshes;
  (c) do OSC 9 notifications fire in the target terminals;
  (d) confirm `terminalSequence` JSON on `SessionStart`/`UserPromptSubmit` is
  parsed as JSON and NOT injected into context (fallback: state-file-only for
  those two events).

## Open risks (honest)

- Title vs CC's own OSC-0 title — may flicker/override; test before promising it.
- Statusline registration replaces an existing user statusline (mitigated: backup
  + warn; offer to restore on uninstall).
- Notification (OSC 9) support is terminal-dependent.

## Out of scope

Background color (impossible now), custom theme editor, a desktop-notifier
fallback via `notify-send`/`osascript`/PowerShell (possible later if OSC 9 proves
too terminal-dependent).
