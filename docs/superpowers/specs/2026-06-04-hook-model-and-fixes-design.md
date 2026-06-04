# Design: Hook-Modell-Überarbeitung & Bugfixes

Date: 2026-06-04
Project: claude-terminal-colors

## Problem

Review of the current implementation surfaced six issues, two of which
contradict the project's own advertised behavior:

1. **Dedup defeated.** `PostToolUse` unconditionally writes `COLOR_IDLE`
   after every tool, so the background alternates tool-colour ↔ idle on
   every step. The `if [ "$COLOR" != "$LAST_COLOR" ]` dedup (added to stop
   the terminal jumping out of scrollback) therefore almost never fires.
2. **Theme chooser broken in the documented install path.** `read -p` reads
   from stdin, but `curl … | bash` makes stdin the pipe, so the prompt gets
   EOF and silently defaults to theme 1.
3. **No tmux/screen support.** Inside a multiplexer the OSC 11 sequence is
   swallowed and never reaches the outer terminal.
4. **Uninstall hardcodes black** (`#000000`) instead of resetting to the
   terminal's configured default.
5. **No session reset.** A previous session's colour (green/red) lingers
   until the next tool runs.
6. **`source theme.conf`** executes the theme file as bash — arbitrary code
   execution from a config file.

## Decisions (agreed)

- **Colour behaviour:** tool colour *persists* until the next change. Drop the
  per-tool idle write. This makes the dedup meaningful again.
- **tmux/screen:** add passthrough support.
- **Scope:** fix all six issues plus sensible improvements (session reset,
  env-var docs, safe theme parsing). No new features.
- **SessionStart:** reset to terminal default (OSC 111), not a theme colour.

## New state model (`color.sh`)

| Event             | Hook arg | Colour                         | Behaviour                                  |
|-------------------|----------|--------------------------------|--------------------------------------------|
| Session start     | `start`  | reset to default (OSC 111)     | clean slate, clears dedup state file       |
| Prompt submitted  | `prompt` | `COLOR_IDLE` (midnight blue)   | "Claude is thinking" — gives idle a moment |
| Tool about to run | `pre`    | per-tool colour                | **persists** until next change             |
| Stop              | `stop`   | `COLOR_DONE` (green)           |                                            |
| Notification      | `notify` | `COLOR_NOTIFY` (orange)        |                                            |
| ~~after tool~~    | removed  | —                              | `PostToolUse` write removed                |

Per-tool mapping (unchanged): Bash→`BASH`, Edit/Write/MultiEdit/NotebookEdit→
`CODE`, Read/Glob/Grep→`READ`, Agent/Task→`AGENT`, AskUserQuestion→`INPUT`,
other→`TOOL`.

## Component changes

### `hooks/color.sh`
- New dispatch: `start` (reset+clear state, exit), `prompt` (IDLE);
  remove `post`.
- `emit()` helper centralises the TTY write and wraps for multiplexers:
  - tmux (`$TMUX` set): `\033Ptmux;<payload with every ESC doubled>\033\\`
  - screen (`$TERM` = `screen*` and `$STY` set): `\033P<payload>\033\\`
- Safe theme loader: parse the file line-by-line with a bash regex that only
  accepts `COLOR_<NAME>="#rrggbb"` and assigns via `printf -v`. No `source`.
- Keep PPID-keyed dedup; it now actually suppresses repeats.

### `install.sh`
- Read the theme choice from `/dev/tty` (guarded; empty → default) so the
  `curl | bash` path works.
- Emit the new hook set (`PreToolUse`, `UserPromptSubmit`, `SessionStart`,
  `Stop`, `Notification`) in both the fresh-write and jq-merge paths.
- Merge also strips legacy `PostToolUse` colour hooks and drops the key if it
  becomes empty, so upgrades are clean and idempotent.

### `uninstall.sh`
- Reset via OSC 111 (terminal default), multiplexer-aware.
- Strip all our categories incl. `PostToolUse`, `UserPromptSubmit`,
  `SessionStart`.

### `README.md`
- State table updated to the new model.
- Document `CLAUDE_TERMINAL_THEME` env var.
- Note tmux requires `set -g allow-passthrough on` (tmux ≥ 3.3).
- Correct the dedup explanation in Troubleshooting.

## Testing / verification

- `bash -n` on all three scripts (syntax).
- `jq -e` validation that the merge/uninstall filters parse and that a merged
  settings.json round-trips (simulate with a temp file).
- Manual emit check: run `color.sh pre` with a `Bash` payload and confirm a
  single OSC 11 write; run twice and confirm the second is deduped.
- tmux wrap: assert the emitted bytes start with `\033Ptmux;` when `$TMUX`
  is set.

## Out of scope

New themes, live theme-switch command, config-validation UX. (Can follow in a
separate cycle.)
