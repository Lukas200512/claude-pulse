---
description: Set up Claude Pulse — check environment, choose indicator features and theme
allowed-tools: Bash, AskUserQuestion
---

You are running the **claude-pulse** setup wizard. Keep it concise and
go step by step.

**Locate the plugin directory first.** Prefer `${CLAUDE_PLUGIN_ROOT}`; otherwise
find it:

```bash
ROOT="${CLAUDE_PLUGIN_ROOT:-}"
if [ -z "$ROOT" ] || [ ! -f "$ROOT/hooks/indicator.js" ]; then
  hit=$(find "$HOME/.claude/plugins" -path '*claude-pulse*/hooks/indicator.js' 2>/dev/null | head -n1)
  [ -n "$hit" ] && ROOT=$(dirname "$(dirname "$hit")")
fi
echo "ROOT=$ROOT"
```

If `ROOT` is empty or `$ROOT/hooks/indicator.js` is missing, say you couldn't find
the install and stop.

### Step 1 — Environment
Run `node "$ROOT/scripts/doctor.js"` and give a one-line friendly summary
(which channels work here; notifications depend on the terminal).

### Step 2 — Choose features, badge size and theme
Use **AskUserQuestion**:
- **Features** (multi-select): *Statusline badge*, *Notifications* (ping on
  done / needs-input), *Mode chip* and *Subagent counter* — default all ON.
  *Mode chip* shows the active permission mode (PLAN / AUTO-EDIT / AUTO / NO-ASK /
  BYPASS) next to the badge, plus a "WARTET AUF OK" chip when an auto mode still
  needs approval. *Subagent counter* shows `⚙ N` while N subagents are running.
  *Window title* is **off by default** (Claude Code overrides the title, so it
  rarely shows); offer it as an advanced opt-in.
- **Badge size** (single): *compact* / *wide* / *full* (full = the whole status
  line becomes a colored bar). Default *wide*.
- **Theme** (single): *dark-minimal* / *ocean* / *monokai*.

### Step 3 — Apply
Write the config and the theme based on the answers. Set each `FEATURE_*` to `on`
or `off` to match the selection, and `BADGE_STYLE` to the chosen size:

```bash
mkdir -p ~/.claude/claude-pulse
cat > ~/.claude/claude-pulse/config.conf <<EOF
FEATURE_STATUSLINE=<on|off>
FEATURE_TITLE=<on|off>
FEATURE_NOTIFY=<on|off>
FEATURE_MODE=<on|off>
FEATURE_SUBAGENTS=<on|off>
NOTIFY_DONE=on
NOTIFY_INPUT=on
BADGE_STYLE=<compact|wide|full>
EOF
cp "$ROOT/themes/<THEME>.conf" ~/.claude/claude-pulse/theme.conf
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
- They can change features anytime with `/claude-pulse:config` and the
  theme with `/claude-pulse:theme <name>`.
- Before uninstalling the plugin, run `/claude-pulse:config` and turn
  the statusline off so no leftover entry remains in `settings.json`.
