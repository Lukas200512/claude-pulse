---
description: Set up Claude Terminal Colors — check your environment, pick a theme, and see a live color test
allowed-tools: Bash, AskUserQuestion
---

You are running the **claude-terminal-colors** setup wizard. Walk the user
through it conversationally, one step at a time. Be concise.

**First, locate the plugin directory.** Prefer `${CLAUDE_PLUGIN_ROOT}`; if it is
unset or has no `scripts/` folder, find the install:

```bash
ROOT="${CLAUDE_PLUGIN_ROOT:-}"
if [ -z "$ROOT" ] || [ ! -d "$ROOT/scripts" ]; then
  hit=$(find "$HOME/.claude/plugins" -path '*claude-terminal-colors*/scripts/detect-env.sh' 2>/dev/null | head -n1)
  [ -n "$hit" ] && ROOT=$(dirname "$(dirname "$hit")")
fi
echo "ROOT=$ROOT"
```

If `ROOT` is empty or `$ROOT/scripts/detect-env.sh` does not exist, tell the user
you couldn't find the plugin install and stop.

Then do these steps:

### Step 1 — Environment check
Run `bash "$ROOT/scripts/detect-env.sh"` and show the user a short, friendly
summary of the report. Read the `VERDICT:` line:
- **OK** → say it looks good, continue.
- **MAYBE** → mention colors might not show and relay the TIP.
- **NO** → explain the limitation plainly (relay the TIP, e.g. native Windows →
  use WSL/SSH). Then use **AskUserQuestion** to ask whether to continue setting a
  theme anyway ("Continue anyway" / "Stop here"). If they stop, end politely.

### Step 2 — Pick a theme
Use **AskUserQuestion** to let the user choose: **dark-minimal** (default),
**ocean**, or **monokai**. Then install it as the active theme:

```bash
mkdir -p ~/.claude/terminal-colors
cp "$ROOT/themes/<CHOICE>.conf" ~/.claude/terminal-colors/theme.conf
```

Replace `<CHOICE>` with their selection. Confirm it's set.

### Step 3 — Live color test
Run `bash "$ROOT/scripts/selftest.sh"` and tell the user to watch their terminal
background — it cycles through every state color for the theme they just picked,
then resets to the terminal default. Ask if the colors looked right.

### Done
Summarize: theme is active now and takes effect on the next tool call. Tell them
they can switch anytime with `/claude-terminal-colors:theme <name>`, and that
disabling the whole thing is `/plugin disable claude-terminal-colors@claude-terminal-colors`.
