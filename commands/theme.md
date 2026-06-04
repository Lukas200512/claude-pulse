---
description: Switch the Claude Terminal Colors theme (dark-minimal, ocean, monokai, or a custom file)
argument-hint: [dark-minimal|ocean|monokai]
allowed-tools: Bash
---

You are switching the active theme for the **claude-terminal-colors** plugin.

The bundled themes live in `${CLAUDE_PLUGIN_ROOT}/themes/` (`dark-minimal.conf`,
`ocean.conf`, `monokai.conf`). The active theme is the file
`~/.claude/terminal-colors/theme.conf` — `color.sh` reads it on the next hook.

Requested theme: **$ARGUMENTS**

Do this:

1. If no theme was given, list the available `.conf` files in
   `${CLAUDE_PLUGIN_ROOT}/themes/` and ask the user which one they want. Stop here.
2. Otherwise, verify `${CLAUDE_PLUGIN_ROOT}/themes/$ARGUMENTS.conf` exists. If it
   does not, list the available themes and stop.
3. Create `~/.claude/terminal-colors/` if needed, then copy the chosen theme to
   `~/.claude/terminal-colors/theme.conf`:
   ```bash
   mkdir -p ~/.claude/terminal-colors
   cp "${CLAUDE_PLUGIN_ROOT}/themes/$ARGUMENTS.conf" ~/.claude/terminal-colors/theme.conf
   ```
4. Confirm the switch and note that it takes effect on the next tool call (no
   restart needed). Mention the user can preview colors by triggering any tool.
