# Design: Interactive /setup wizard

Date: 2026-06-04
Project: claude-terminal-colors

## Goal

A one-shot, in-Claude-Code wizard that gets a new user from "plugin installed"
to "colors working with my theme" in under a minute, and is honest about
environments where it can't work.

Slash command: `/claude-terminal-colors:setup`.

## Decisions (agreed)

- Form: an **interactive slash command** (not a static doc, not a `read`-based
  shell wizard — `read` prompts behave badly inside Claude's Bash tool).
- Steps: **environment check → pick & set theme → live color test**. No custom
  theme editor (out of scope).
- Approach: **command-orchestrated with thin helper scripts** — theme choice via
  `AskUserQuestion` (native UI), the mechanical work in small testable scripts.

## Components

### `commands/setup.md` — the wizard
`/claude-terminal-colors:setup`. Allowed tools: `Bash`, `AskUserQuestion`.
Resolves the plugin root the same robust way `theme.md` does (`${CLAUDE_PLUGIN_ROOT}`
with a fallback that locates the install under `~/.claude/plugins`). Flow:

1. **Environment** — run `scripts/detect-env.sh`, show the report, interpret the
   `VERDICT:` line. If the verdict is ❌, use `AskUserQuestion` to ask whether to
   continue anyway.
2. **Theme** — `AskUserQuestion` (dark-minimal / ocean / monokai) → `mkdir -p
   ~/.claude/terminal-colors` and copy the chosen `themes/<name>.conf` to
   `~/.claude/terminal-colors/theme.conf` (same active-theme path as `/theme`,
   effective on the next hook).
3. **Live test** — run `scripts/selftest.sh`, tell the user what they should see.
4. **Done** — summary + "change later with `/claude-terminal-colors:theme <name>`".

### `scripts/detect-env.sh` — read-only environment probe
Detects and prints, as `key: value` lines:
- OS via `uname -s` (Linux / Darwin / MINGW*/MSYS*/CYGWIN* = native Windows Git Bash)
- WSL: `microsoft` in `/proc/version`
- SSH: `$SSH_CONNECTION` / `$SSH_TTY`
- terminal: `$TERM_PROGRAM`, `$WT_SESSION` (Windows Terminal), `$TERM`
- multiplexer: `$TMUX` (tmux) / `$STY` (screen)
- `/dev/tty` writable?

Ends with one `VERDICT:` line and optional `TIP:` lines:
- macOS Terminal.app (`TERM_PROGRAM=Apple_Terminal`) → ❌ no OSC 11
- native Windows (MINGW/MSYS and not WSL) → ❌ use WSL or SSH
- tmux → ⚠️ ensure `tmux set -g allow-passthrough on`
- otherwise → ✅ should work

Pure read-only; never writes the terminal.

### `scripts/selftest.sh` — live color cycle
Resolves the active theme with the same priority/safe-parse as `color.sh`
(self-contained ~15-line copy of the parse + `emit`, deliberately not refactoring
the well-tested hook into a shared lib — YAGNI). Then for each of the 9 states it
echoes a label to stdout and emits the OSC 11 color to the terminal (tmux/screen
aware), sleeping ~1s between, and finally emits OSC 111 to reset to default.

## Boundaries & error handling

- Each script is defensive: `|| true`, no `set -e` abort; failing to find the
  plugin root makes the command report it cleanly rather than crashing.
- The wizard is abortable at any step; a ❌ verdict offers "continue anyway".
- `selftest.sh` writing OSC to the terminal has the same POSIX-only limitation as
  the hook — consistent with what the environment check reports.

## Testing

- `bash -n` on both scripts.
- PTY test for `selftest.sh`: exactly 9 OSC-11 writes in theme order + a final
  OSC-111 reset; honors the active theme file.
- `detect-env.sh` against simulated environments (inject `$TMUX`, `$SSH_CONNECTION`,
  fake `uname`) → correct `VERDICT:` line.

## Out of scope

Custom-theme creation/editing, a static SETUP.md (can follow later), and any
attempt to make background colors work on native Windows (documented as
impossible via hooks).
