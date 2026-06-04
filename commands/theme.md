---
description: Switch the Claude Pulse theme (dark-minimal, ocean, monokai, or a custom file)
argument-hint: [dark-minimal|ocean|monokai]
allowed-tools: Bash
---

You are switching the active theme for the **claude-pulse** plugin.

The active theme is the file `~/.claude/claude-pulse/theme.conf` — the
indicator reads it to color the statusline badge. Bundled themes
(`dark-minimal.conf`, `ocean.conf`, `monokai.conf`) live in the plugin's
`themes/` directory.

Requested theme: **$ARGUMENTS**

Do this:

1. **Locate the plugin's `themes/` directory.** Prefer `${CLAUDE_PLUGIN_ROOT}/themes`
   if that variable is set in the shell. If it is empty/unset, find it instead:
   ```bash
   THEMES_DIR="${CLAUDE_PLUGIN_ROOT:-}"
   [ -n "$THEMES_DIR" ] && THEMES_DIR="$THEMES_DIR/themes"
   if [ -z "$THEMES_DIR" ] || [ ! -d "$THEMES_DIR" ]; then
     THEMES_DIR=$(dirname "$(find "$HOME/.claude/plugins" -path '*claude-pulse*/themes/dark-minimal.conf' 2>/dev/null | head -n1)")
   fi
   echo "Using themes dir: $THEMES_DIR"
   ```
2. If no theme name was given, list the `.conf` files in `$THEMES_DIR` and ask
   the user which one they want. Stop here.
3. Otherwise verify `$THEMES_DIR/$ARGUMENTS.conf` exists. If not, list the
   available themes and stop.
4. Install it as the active theme:
   ```bash
   mkdir -p ~/.claude/claude-pulse
   cp "$THEMES_DIR/$ARGUMENTS.conf" ~/.claude/claude-pulse/theme.conf
   ```
5. Confirm the switch and tell the user the new theme colors the statusline
   badge from the next hook event on (no restart needed). If they don't have the
   statusline enabled, point them to `/claude-pulse:setup`.
