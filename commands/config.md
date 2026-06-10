---
description: Turn Claude Pulse features on or off (statusline, notifications, chips)
allowed-tools: Bash, AskUserQuestion
---

You are toggling **claude-pulse** features. Keep it concise.

**Locate the plugin and the config dir** (computed with node so it matches
what the hooks read — respects `CLAUDE_CONFIG_DIR` and Windows home dirs):

```bash
ROOT="${CLAUDE_PLUGIN_ROOT:-}"
if [ -z "$ROOT" ] || [ ! -f "$ROOT/hooks/indicator.js" ]; then
  hit=$(find "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins" -path '*claude-pulse*/hooks/indicator.js' 2>/dev/null | head -n1)
  [ -n "$hit" ] && ROOT=$(dirname "$(dirname "$hit")")
fi
CFG_DIR="$(node -p 'const p=require("path"),o=require("os");p.join(process.env.CLAUDE_CONFIG_DIR||p.join(o.homedir(),".claude"),"claude-pulse")')"
```

**Show the current config**, then collect the choices with
**AskUserQuestion**. The tool allows at most 4 questions per call and 4
options per question, so use ONE call with 4 questions (defaults = the
current config):
- **Core** (multi-select): *Statusline badge*, *Notifications*, *Mode chip*
  (permission mode PLAN/AUTO-EDIT/AUTO/NO-ASK/BYPASS + "NEEDS OK" chip on a
  real permission prompt), *Subagent counter* (`⚙ N` while N subagents run).
- **Chips** (multi-select): *Context gauge* (colored context-usage bar),
  *Effort chip* (LOW…MAX), *Duration* (`⏱` since turn start, total on DONE),
  *Activity detail* (what exactly is happening: `EDITING badge.js`,
  `SHELL npm test` — fully local).
- **Extras** (multi-select): *Cost* (session cost in USD), *Window title*
  (off by default — Claude Code usually overrides it).
- **Badge size** (single): *compact* / *wide* / *full*.

If Notifications ended up ON, ask one follow-up (single): *both* /
*needs-input only* / *done only* → NOTIFY_INPUT / NOTIFY_DONE. The current
state:

```bash
cat "$CFG_DIR/config.conf" 2>/dev/null || echo "(no config yet — defaults: everything on except title, badge wide)"
```

**Write the new config** (set each `FEATURE_*`/`NOTIFY_*` to `on`/`off` and
`BADGE_STYLE` from the selection):

```bash
mkdir -p "$CFG_DIR"
cat > "$CFG_DIR/config.conf" <<EOF
FEATURE_STATUSLINE=<on|off>
FEATURE_TITLE=<on|off>
FEATURE_NOTIFY=<on|off>
FEATURE_MODE=<on|off>
FEATURE_SUBAGENTS=<on|off>
FEATURE_CONTEXT=<on|off>
FEATURE_EFFORT=<on|off>
FEATURE_DURATION=<on|off>
FEATURE_DETAIL=<on|off>
FEATURE_COST=<on|off>
NOTIFY_DONE=<on|off>
NOTIFY_INPUT=<on|off>
BADGE_STYLE=<compact|wide|full>
EOF
```

**Sync the statusline registration** to the Statusline-badge choice. Note: if
the user is switching the badge ON and `settings.json` already has a
non-claude-pulse statusline, ask before replacing it (it is saved to
`$CFG_DIR/previous-statusline.json` and restored when switched off).

```bash
# if Statusline badge is now ON (registers a version-robust launcher):
node "$ROOT/scripts/register-statusline.js" on "$ROOT"
# if it is now OFF (restores a previously saved statusline, if any):
node "$ROOT/scripts/register-statusline.js" off
```

Confirm the new state. Remind the user that statusline changes take effect
after the next Claude Code **restart**; title and notification changes apply
on the next hook event.
