#!/bin/bash
# ============================================================
# Claude Terminal Colors — Installer
# Dynamic terminal background colors for Claude Code
# ============================================================

set -e

REPO_URL="https://raw.githubusercontent.com/Lukas200512/claude-terminal-colors/main"
HOOK_DIR="$HOME/.claude/hooks"
SETTINGS_FILE="$HOME/.claude/settings.json"
THEME_DIR="$HOME/.claude/hooks/themes"

# Themes shipped with this installer. Add a new entry here and drop a
# matching <name>.conf into themes/ to ship a new theme.
THEMES=(dark-minimal ocean monokai)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Detect whether install.sh is being run from a cloned repo (use local
# files) or piped from curl (download from GitHub).
SCRIPT_DIR=""
if [ -n "${BASH_SOURCE[0]:-}" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd 2>/dev/null || echo "")"
fi

fetch_file() {
    local rel="$1" dest="$2"
    if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/$rel" ]; then
        cp "$SCRIPT_DIR/$rel" "$dest"
    else
        curl -fsSL "$REPO_URL/$rel" -o "$dest"
    fi
}

echo ""
echo -e "${CYAN}  Claude Terminal Colors${NC}"
echo -e "${CYAN}  Dynamic backgrounds for Claude Code${NC}"
echo ""

# Check dependencies
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required but not installed.${NC}"
    echo "Install it with: sudo apt install jq / brew install jq"
    exit 1
fi

# Check terminal compatibility
echo -e "${YELLOW}Supported terminals:${NC}"
echo "  iTerm2, Kitty, Alacritty, WezTerm, Windows Terminal,"
echo "  GNOME Terminal, Konsole, Hyper, Tabby, Termux, foot"
echo ""
echo -e "${RED}Not supported:${NC}"
echo "  macOS Terminal.app (does not support OSC 11)"
echo ""

# Theme selection (built from $THEMES so adding a theme = one line above)
echo -e "${YELLOW}Choose a theme:${NC}"
i=1
for t in "${THEMES[@]}"; do
    suffix=""
    [ "$i" -eq 1 ] && suffix=" (default)"
    echo "  $i) $t$suffix"
    i=$((i + 1))
done
echo ""
# Read from the controlling terminal, not stdin: when installed via
# `curl … | bash` stdin is the pipe (immediate EOF), but /dev/tty is still the
# user's terminal. Empty/no-tty input falls through to the default below.
THEME_CHOICE=""
if [ -r /dev/tty ]; then
    read -p "Theme [1-${#THEMES[@]}]: " THEME_CHOICE < /dev/tty || THEME_CHOICE=""
fi

# Default to first theme on empty / invalid input.
if [[ "$THEME_CHOICE" =~ ^[0-9]+$ ]] && [ "$THEME_CHOICE" -ge 1 ] && [ "$THEME_CHOICE" -le "${#THEMES[@]}" ]; then
    THEME="${THEMES[$((THEME_CHOICE - 1))]}"
else
    THEME="${THEMES[0]}"
fi

# Create directories
mkdir -p "$HOOK_DIR"
mkdir -p "$THEME_DIR"

# Install files
echo ""
echo -e "${CYAN}Installing...${NC}"

fetch_file "hooks/color.sh" "$HOOK_DIR/color.sh"
chmod +x "$HOOK_DIR/color.sh"

for t in "${THEMES[@]}"; do
    fetch_file "themes/${t}.conf" "$THEME_DIR/${t}.conf"
done

# Set selected theme
cp "$THEME_DIR/${THEME}.conf" "$HOOK_DIR/theme.conf"

# Hook configuration we want present. Every state goes through color.sh so a
# theme swap updates *all* of them (older versions hard-coded some colors).
# Tool colour persists until the next change, so there is no PostToolUse hook;
# UserPromptSubmit shows the "thinking" colour and SessionStart resets.
HOOKS_JSON='{
  "PreToolUse": [{"matcher": "*", "hooks": [{"type": "command", "command": "bash ~/.claude/hooks/color.sh pre"}]}],
  "UserPromptSubmit": [{"hooks": [{"type": "command", "command": "bash ~/.claude/hooks/color.sh prompt"}]}],
  "SessionStart": [{"hooks": [{"type": "command", "command": "bash ~/.claude/hooks/color.sh start"}]}],
  "Stop": [{"hooks": [{"type": "command", "command": "bash ~/.claude/hooks/color.sh stop"}]}],
  "Notification": [{"hooks": [{"type": "command", "command": "bash ~/.claude/hooks/color.sh notify"}]}]
}'

if [ -f "$SETTINGS_FILE" ]; then
    echo -e "${YELLOW}Existing settings.json found. Backing up to ${SETTINGS_FILE}.bak${NC}"
    cp "$SETTINGS_FILE" "${SETTINGS_FILE}.bak"

    # Idempotent merge: strip any old color hooks (matched by `color.sh` or the
    # legacy hard-coded OSC 11 strings) from every category — including the now
    # removed PostToolUse — then append the canonical set. Empty categories
    # (e.g. PostToolUse after cleaning) are dropped.
    jq --argjson hooks "$HOOKS_JSON" '
      def isOurs: (.hooks // []) | map(.command // "") | join(" ") | test("color\\.sh|033\\]11");
      def clean: map(select(isOurs | not));
      .hooks //= {}
      | .hooks.PostToolUse     = (((.hooks.PostToolUse     // []) | clean))
      | .hooks.PreToolUse      = (((.hooks.PreToolUse      // []) | clean) + $hooks.PreToolUse)
      | .hooks.UserPromptSubmit = (((.hooks.UserPromptSubmit // []) | clean) + $hooks.UserPromptSubmit)
      | .hooks.SessionStart    = (((.hooks.SessionStart    // []) | clean) + $hooks.SessionStart)
      | .hooks.Stop            = (((.hooks.Stop            // []) | clean) + $hooks.Stop)
      | .hooks.Notification    = (((.hooks.Notification    // []) | clean) + $hooks.Notification)
      | .hooks |= with_entries(select(.value | length > 0))
    ' "$SETTINGS_FILE" > "${SETTINGS_FILE}.tmp" \
      && mv "${SETTINGS_FILE}.tmp" "$SETTINGS_FILE"

    echo -e "${GREEN}Hooks merged into settings.json${NC}"
else
    cat > "$SETTINGS_FILE" <<SETTINGS
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.claude/hooks/color.sh pre"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.claude/hooks/color.sh prompt"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.claude/hooks/color.sh start"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.claude/hooks/color.sh stop"
          }
        ]
      }
    ],
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.claude/hooks/color.sh notify"
          }
        ]
      }
    ]
  }
}
SETTINGS
    echo -e "${GREEN}Created settings.json with hooks${NC}"
fi

echo ""
echo -e "${GREEN}Installed successfully!${NC}"
echo ""
echo -e "  Theme: ${CYAN}${THEME}${NC}"
echo -e "  Hook:  ${CYAN}${HOOK_DIR}/color.sh${NC}"
echo ""
echo "  To change theme later:"
echo "    cp ~/.claude/hooks/themes/<theme>.conf ~/.claude/hooks/theme.conf"
echo ""
echo -e "  ${YELLOW}Tip:${NC} if your terminal jumps to the bottom while scrolling,"
echo -e "  disable \"scroll on output\" / \"follow output\" in its settings."
echo ""
echo -e "  ${YELLOW}Restart Claude Code for changes to take effect.${NC}"
echo ""
