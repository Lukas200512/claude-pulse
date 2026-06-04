---
description: Turn Claude Terminal Colors features on or off (statusline, title, notifications)
allowed-tools: Bash, AskUserQuestion
---

You are toggling **claude-terminal-colors** features. Concise, one round.

**Locate the plugin directory:**

```bash
ROOT="${CLAUDE_PLUGIN_ROOT:-}"
if [ -z "$ROOT" ] || [ ! -f "$ROOT/hooks/indicator.js" ]; then
  hit=$(find "$HOME/.claude/plugins" -path '*claude-terminal-colors*/hooks/indicator.js' 2>/dev/null | head -n1)
  [ -n "$hit" ] && ROOT=$(dirname "$(dirname "$hit")")
fi
```

**Show the current config**, then via **AskUserQuestion** let the user pick which
features should be ON (multi-select: *Statusline badge*, *Window title*,
*Notifications*) and the **badge size** (*compact* / *wide* / *full*). The current
state is in `~/.claude/terminal-colors/config.conf` (missing file = statusline +
notifications on, title off, badge wide):

```bash
cat ~/.claude/terminal-colors/config.conf 2>/dev/null || echo "(no config yet — defaults: statusline+notify on, title off, badge wide)"
```

**Write the new config** (set each `FEATURE_*` to `on`/`off` and `BADGE_STYLE`
from the selection):

```bash
mkdir -p ~/.claude/terminal-colors
cat > ~/.claude/terminal-colors/config.conf <<EOF
FEATURE_STATUSLINE=<on|off>
FEATURE_TITLE=<on|off>
FEATURE_NOTIFY=<on|off>
NOTIFY_DONE=on
NOTIFY_INPUT=on
BADGE_STYLE=<compact|wide|full>
EOF
```

**Sync the statusline registration** to the Statusline-badge choice:

```bash
# if Statusline badge is now ON:
node "$ROOT/scripts/register-statusline.js" on "$ROOT/statusline/badge.js"
# if it is now OFF:
node "$ROOT/scripts/register-statusline.js" off
```

Confirm the new state. Remind the user that statusline changes take effect after
the next Claude Code **restart**; title and notification changes apply on the next
hook event.
