---
description: Turn Claude Pulse features on or off (statusline, title, notifications)
allowed-tools: Bash, AskUserQuestion
---

You are toggling **claude-pulse** features. Concise, one round.

**Locate the plugin directory:**

```bash
ROOT="${CLAUDE_PLUGIN_ROOT:-}"
if [ -z "$ROOT" ] || [ ! -f "$ROOT/hooks/indicator.js" ]; then
  hit=$(find "$HOME/.claude/plugins" -path '*claude-pulse*/hooks/indicator.js' 2>/dev/null | head -n1)
  [ -n "$hit" ] && ROOT=$(dirname "$(dirname "$hit")")
fi
```

**Show the current config**, then via **AskUserQuestion** let the user pick which
features should be ON (multi-select: *Statusline badge*, *Window title*,
*Notifications*, *Mode chip*) and the **badge size** (*compact* / *wide* / *full*).
*Mode chip* shows the active permission mode (PLAN / AUTO-EDIT / AUTO / NO-ASK /
BYPASS) plus a "WARTET AUF OK" chip when an auto mode still needs your approval.
The current state is in `~/.claude/claude-pulse/config.conf` (missing file =
statusline + notifications + mode on, title off, badge wide):

```bash
cat ~/.claude/claude-pulse/config.conf 2>/dev/null || echo "(no config yet — defaults: statusline+notify on, title off, badge wide)"
```

**Write the new config** (set each `FEATURE_*` to `on`/`off` and `BADGE_STYLE`
from the selection):

```bash
mkdir -p ~/.claude/claude-pulse
cat > ~/.claude/claude-pulse/config.conf <<EOF
FEATURE_STATUSLINE=<on|off>
FEATURE_TITLE=<on|off>
FEATURE_NOTIFY=<on|off>
FEATURE_MODE=<on|off>
NOTIFY_DONE=on
NOTIFY_INPUT=on
BADGE_STYLE=<compact|wide|full>
EOF
```

**Sync the statusline registration** to the Statusline-badge choice:

```bash
# if Statusline badge is now ON (registers a version-robust launcher):
node "$ROOT/scripts/register-statusline.js" on "$ROOT"
# if it is now OFF:
node "$ROOT/scripts/register-statusline.js" off
```

Confirm the new state. Remind the user that statusline changes take effect after
the next Claude Code **restart**; title and notification changes apply on the next
hook event.
