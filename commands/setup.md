---
description: Set up Claude Pulse — check environment, choose indicator features and theme
allowed-tools: Bash, AskUserQuestion
---

You are running the **claude-pulse** setup wizard. Keep it concise and
go step by step.

**Step 0 — prerequisites & paths.** The hooks and the statusline run via
`node`, so verify it exists, locate the plugin, and compute the config dir
**with node** (this respects `CLAUDE_CONFIG_DIR` and avoids the Git-Bash
`$HOME` vs Windows `USERPROFILE` mismatch — the hooks read `os.homedir()`):

```bash
command -v node >/dev/null || echo "NODE-MISSING"
ROOT="${CLAUDE_PLUGIN_ROOT:-}"
if [ -z "$ROOT" ] || [ ! -f "$ROOT/hooks/indicator.js" ]; then
  hit=$(find "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins" -path '*claude-pulse*/hooks/indicator.js' 2>/dev/null | head -n1)
  [ -n "$hit" ] && ROOT=$(dirname "$(dirname "$hit")")
fi
CFG_DIR="$(node -p 'const p=require("path"),o=require("os");p.join(process.env.CLAUDE_CONFIG_DIR||p.join(o.homedir(),".claude"),"claude-pulse")')"
echo "ROOT=$ROOT"; echo "CFG_DIR=$CFG_DIR"
```

If `NODE-MISSING` was printed, stop: explain that Claude Pulse needs Node.js
on the PATH (the hooks and badge are Node scripts) and where to get it.
If `ROOT` is empty or `$ROOT/hooks/indicator.js` is missing, say you couldn't
find the install and stop.

### Step 1 — Environment & health
Run `node "$ROOT/scripts/doctor.js"` and give a one-line friendly summary
(which channels work here; notifications depend on the terminal). If doctor
reports another (non-claude-pulse) statusline registered, remember that for
Step 2 — the user must explicitly agree before it is replaced (it is saved
and restored when the badge is later disabled).

### Step 2 — Choose features, badge size and theme
Use **AskUserQuestion**:
- **Features** (multi-select): *Statusline badge*, *Notifications* (ping on
  done / needs-input), *Mode chip*, *Subagent counter*, *Context gauge*,
  *Effort chip*, *Duration*, *Activity detail* and *Cost* — default all ON.
  *Mode chip* shows the active permission mode (PLAN / AUTO-EDIT / AUTO /
  NO-ASK / BYPASS) plus a "NEEDS OK" chip when an auto mode hits a real
  permission prompt. *Subagent counter* shows `⚙ N` while N subagents run.
  *Context gauge* shows a colored context-window usage bar. *Effort chip*
  shows the reasoning effort (LOW/MED/HIGH/XHIGH/MAX). *Duration* shows `⏱`
  elapsed since the turn started (and the total on DONE). *Activity detail*
  shows what exactly is happening (`EDITING badge.js`, `SHELL npm test`) —
  fully local, nothing leaves the machine. *Cost* shows the session cost in
  USD. *Window title* is **off by default** (Claude Code overrides the title,
  so it rarely shows); offer it as an advanced opt-in.
- **Notifications** (single, only if Notifications is ON): *both* /
  *needs-input only* / *done only*. Maps to NOTIFY_INPUT / NOTIFY_DONE.
- **Badge size** (single): *compact* / *wide* / *full* (full = the whole
  status line becomes a colored bar). Default *wide*.
- **Theme** (single): *dark-minimal* / *ocean* / *monokai*.
- If Step 1 found a foreign statusline and the badge feature is ON, ask
  explicitly whether to replace it (mention it is saved to
  `$CFG_DIR/previous-statusline.json` and restored on disable). If the user
  declines, keep the badge feature OFF.

### Step 3 — Apply
Write the config and the theme based on the answers. Set each `FEATURE_*` and
`NOTIFY_*` to `on` or `off` to match the selection, and `BADGE_STYLE` to the
chosen size:

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
cp "$ROOT/themes/<THEME>.conf" "$CFG_DIR/theme.conf"
```

Then register or remove the statusline to match the choice:

```bash
# if the Statusline badge feature is ON (registers a version-robust launcher):
node "$ROOT/scripts/register-statusline.js" on "$ROOT"
# if it is OFF:
node "$ROOT/scripts/register-statusline.js" off
```

### Done
Confirm what's active. Tell the user:
- The statusline badge appears after a **restart of Claude Code** (it's
  registered in `settings.json`).
- The window title may **alternate** with Claude Code's own title — that's
  expected.
- Notifications only show if their terminal supports OSC 9.
- They can change features anytime with `/claude-pulse:config`, the theme
  with `/claude-pulse:theme <name>`, and check health with
  `/claude-pulse:doctor`.
- Before uninstalling the plugin, run `/claude-pulse:config` and turn the
  statusline off — that removes our entry and restores any previously saved
  statusline.
