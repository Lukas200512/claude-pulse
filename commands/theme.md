---
description: Switch the Claude Pulse theme (dark-minimal, ocean, monokai, or a custom file)
argument-hint: [dark-minimal|ocean|monokai]
allowed-tools: Bash
---

You are switching the active theme for the **claude-pulse** plugin.

The active theme is the file `theme.conf` in the claude-pulse config dir —
the indicator reads it to color the statusline badge. Bundled themes
(`dark-minimal.conf`, `ocean.conf`, `monokai.conf`) live in the plugin's
`themes/` directory.

Requested theme: **$ARGUMENTS**

Do this:

1. **Locate the plugin's `themes/` directory and the config dir.** Prefer
   `${CLAUDE_PLUGIN_ROOT}/themes` if that variable is set in the shell. If it
   is empty/unset, find it instead. The config dir is computed with node so it
   matches what the hooks read (respects `CLAUDE_CONFIG_DIR` and Windows home
   dirs):
   ```bash
   THEMES_DIR="${CLAUDE_PLUGIN_ROOT:-}"
   [ -n "$THEMES_DIR" ] && THEMES_DIR="$THEMES_DIR/themes"
   if [ -z "$THEMES_DIR" ] || [ ! -d "$THEMES_DIR" ]; then
     THEMES_DIR=$(dirname "$(find "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins" -path '*claude-pulse*/themes/dark-minimal.conf' 2>/dev/null | head -n1)")
   fi
   CFG_DIR="$(node -p 'const p=require("path"),o=require("os");p.join(process.env.CLAUDE_CONFIG_DIR||p.join(o.homedir(),".claude"),"claude-pulse")')"
   echo "Using themes dir: $THEMES_DIR"; echo "Config dir: $CFG_DIR"
   ```
2. If no theme name was given, list the `.conf` files in `$THEMES_DIR` and ask
   the user which one they want. Stop here.
3. Otherwise verify `$THEMES_DIR/$ARGUMENTS.conf` exists. If not, list the
   available themes and stop.
4. Install it as the active theme:
   ```bash
   mkdir -p "$CFG_DIR"
   cp "$THEMES_DIR/$ARGUMENTS.conf" "$CFG_DIR/theme.conf"
   ```
5. Confirm the switch and tell the user the new theme colors the statusline
   badge from the next hook event on (no restart needed). If they don't have
   the statusline enabled, point them to `/claude-pulse:setup`.
