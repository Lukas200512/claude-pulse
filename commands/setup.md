---
description: Set up Claude Terminal Colors — check environment, choose indicator features and theme
allowed-tools: Bash, AskUserQuestion
---

You are running the **claude-terminal-colors** setup wizard. Keep it concise and
go step by step.

**Locate the plugin directory first.** Prefer `${CLAUDE_PLUGIN_ROOT}`; otherwise
find it:

```bash
ROOT="${CLAUDE_PLUGIN_ROOT:-}"
if [ -z "$ROOT" ] || [ ! -f "$ROOT/hooks/indicator.js" ]; then
  hit=$(find "$HOME/.claude/plugins" -path '*claude-terminal-colors*/hooks/indicator.js' 2>/dev/null | head -n1)
  [ -n "$hit" ] && ROOT=$(dirname "$(dirname "$hit")")
fi
echo "ROOT=$ROOT"
```

If `ROOT` is empty or `$ROOT/hooks/indicator.js` is missing, say you couldn't find
the install and stop.

### Step 1 — Environment
Run `node "$ROOT/scripts/doctor.js"` and give a one-line friendly summary
(which channels work here; notifications depend on the terminal).

### Step 2 — Choose features and theme
Use **AskUserQuestion** with two questions:
- **Features** (multi-select): *Statusline badge* (colored badge in the status
  bar), *Window title* (shows the activity in the tab title), *Notifications*
  (ping on done / needs-input). Default: all three.
- **Theme** (single): *dark-minimal* / *ocean* / *monokai*.

### Step 3 — Apply
Write the config and the theme based on the answers. Set each `FEATURE_*` to `on`
or `off` to match the feature selection:

```bash
mkdir -p ~/.claude/terminal-colors
cat > ~/.claude/terminal-colors/config.conf <<EOF
FEATURE_STATUSLINE=<on|off>
FEATURE_TITLE=<on|off>
FEATURE_NOTIFY=<on|off>
NOTIFY_DONE=on
NOTIFY_INPUT=on
EOF
cp "$ROOT/themes/<THEME>.conf" ~/.claude/terminal-colors/theme.conf
```

Then register or remove the statusline to match the choice:

```bash
# if the Statusline badge feature is ON:
node "$ROOT/scripts/register-statusline.js" on "$ROOT/statusline/badge.js"
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
- They can change features anytime with `/claude-terminal-colors:config` and the
  theme with `/claude-terminal-colors:theme <name>`.
- Before uninstalling the plugin, run `/claude-terminal-colors:config` and turn
  the statusline off so no leftover entry remains in `settings.json`.
