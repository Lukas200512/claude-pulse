# Privacy Policy — Claude Pulse

_Last updated: 2026-06-04_

**Claude Pulse runs entirely on your machine. It does not collect, store, or
transmit any personal data — to the author or to any third party.**

## What it does, locally only

- Reads the name of the tool Claude Code is about to run (e.g. `Bash`, `Edit`,
  `Read`) to decide which state/badge to show.
- Writes the current state and your settings to local files under
  `~/.claude/claude-pulse/`, and registers a status line in
  `~/.claude/settings.json`.
- Emits terminal escape sequences (the status line, and — if you enable them —
  the window title and notifications) through Claude Code's own output.

## What it does NOT do

- No network requests, ever. No telemetry, analytics, tracking, or accounts.
- Nothing leaves your machine. The author receives no data of any kind.

## Permissions

Claude Pulse only reads/writes files inside your `~/.claude/` directory and emits
terminal sequences. It runs no external services.

## Contact

Questions or concerns: please open an issue at
<https://github.com/Lukas200512/claude-pulse/issues>.
