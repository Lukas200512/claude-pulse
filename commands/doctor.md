---
description: Diagnose Claude Pulse — environment, statusline registration, hook activity
allowed-tools: Bash
---

You are running the **claude-pulse** health check.

**Locate the plugin:**

```bash
ROOT="${CLAUDE_PLUGIN_ROOT:-}"
if [ -z "$ROOT" ] || [ ! -f "$ROOT/scripts/doctor.js" ]; then
  hit=$(find "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins" -path '*claude-pulse*/scripts/doctor.js' 2>/dev/null | head -n1)
  [ -n "$hit" ] && ROOT=$(dirname "$(dirname "$hit")")
fi
```

If `ROOT` is empty, say you couldn't find the install and stop. Otherwise run:

```bash
node "$ROOT/scripts/doctor.js"
```

Summarize the output for the user in a few friendly lines:
- whether the badge/statusline is wired up and hooks are firing,
- whether notifications are likely to work in this terminal,
- and for every issue in the VERDICT, the concrete next step
  (usually `/claude-pulse:setup`, a Claude Code restart, or a tmux/screen
  config line — quote it exactly as doctor printed it).
