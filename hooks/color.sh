#!/bin/bash
# ============================================================
# Claude Code Terminal Colors
# Dynamic terminal background colors based on Claude's activity
# https://github.com/Lukas200512/claude-terminal-colors
# ============================================================

INPUT=$(cat 2>/dev/null || true)
HOOK_TYPE="$1"

# Resolve the theme file. Priority:
#   1. $CLAUDE_TERMINAL_THEME              — explicit override (any path)
#   2. ~/.claude/terminal-colors/theme.conf — drop a theme here (plugin install)
#   3. ~/.claude/hooks/theme.conf          — legacy standalone-installer location
#   4. built-in defaults below
THEME_FILE="${CLAUDE_TERMINAL_THEME:-}"
if [ -z "$THEME_FILE" ]; then
  for _cand in "$HOME/.claude/terminal-colors/theme.conf" "$HOME/.claude/hooks/theme.conf"; do
    if [ -f "$_cand" ]; then THEME_FILE="$_cand"; break; fi
  done
fi

# Parse the theme file safely. We deliberately do NOT `source` it — a theme
# is plain config, not code, so we only accept `COLOR_<NAME>="#rrggbb"` lines
# and ignore everything else (comments, blank lines, anything malformed).
if [ -f "$THEME_FILE" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    if [[ "$line" =~ ^[[:space:]]*(COLOR_[A-Z]+)=\"?(#[0-9a-fA-F]{6})\"? ]]; then
      printf -v "${BASH_REMATCH[1]}" '%s' "${BASH_REMATCH[2]}"
    fi
  done < "$THEME_FILE"
fi

# Default colors (dark minimal theme)
COLOR_BASH="${COLOR_BASH:-#1a0a00}"
COLOR_CODE="${COLOR_CODE:-#0a0f2e}"
COLOR_READ="${COLOR_READ:-#0f0a1f}"
COLOR_AGENT="${COLOR_AGENT:-#001a1a}"
COLOR_INPUT="${COLOR_INPUT:-#2a0a0a}"
COLOR_IDLE="${COLOR_IDLE:-#0f1923}"
COLOR_DONE="${COLOR_DONE:-#0a1a0a}"
COLOR_NOTIFY="${COLOR_NOTIFY:-#2a1a00}"
COLOR_TOOL="${COLOR_TOOL:-#15151f}"

# Write an escape sequence to the controlling terminal. Inside a multiplexer
# the sequence has to be wrapped in a DCS passthrough or it never reaches the
# outer terminal:
#   - tmux  : ESC P tmux ; <payload, every ESC doubled> ESC \
#             (requires `set -g allow-passthrough on`, tmux >= 3.3)
#   - screen: ESC P <payload> ESC \
emit() {
  local seq="$1"
  if [ -n "$TMUX" ]; then
    seq="${seq//$'\033'/$'\033\033'}"
    seq=$'\033Ptmux;'"$seq"$'\033\\'
  elif [ -n "$STY" ] && [ "${TERM%%[-.]*}" = "screen" ]; then
    seq=$'\033P'"$seq"$'\033\\'
  fi
  printf '%s' "$seq" > /dev/tty 2>/dev/null || true
}

# Per-session dedup state. Each write to /dev/tty can yank the terminal out of
# scrollback (most emulators "scroll on output"), so we skip no-op repeats.
STATE_DIR="${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}}"
STATE_FILE="$STATE_DIR/.claude-terminal-color-$PPID"

# SessionStart: reset the background to the terminal's own default (OSC 111)
# so a previous session's color doesn't linger, and clear the dedup state.
if [ "$HOOK_TYPE" = "start" ]; then
  emit $'\033]111\007'
  rm -f "$STATE_FILE" 2>/dev/null || true
  exit 0
fi

case "$HOOK_TYPE" in
  stop)   COLOR="$COLOR_DONE"   ;;
  notify) COLOR="$COLOR_NOTIFY" ;;
  prompt) COLOR="$COLOR_IDLE"   ;;   # prompt submitted — Claude is thinking
  pre|*)
    # PreToolUse: set the tool's color. It persists until the next change
    # (prompt / next tool / stop), so there is no per-tool flicker.
    TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
    case "$TOOL" in
      Bash)                              COLOR="$COLOR_BASH"  ;;
      Edit|Write|MultiEdit|NotebookEdit) COLOR="$COLOR_CODE"  ;;
      Read|Glob|Grep)                    COLOR="$COLOR_READ"  ;;
      Agent|Task)                        COLOR="$COLOR_AGENT" ;;
      AskUserQuestion)                   COLOR="$COLOR_INPUT" ;;
      *)                                 COLOR="$COLOR_TOOL"  ;;
    esac
    ;;
esac

LAST_COLOR=""
[ -f "$STATE_FILE" ] && LAST_COLOR=$(cat "$STATE_FILE" 2>/dev/null)

if [ "$COLOR" != "$LAST_COLOR" ]; then
  emit "$(printf '\033]11;%s\007' "$COLOR")"
  printf '%s' "$COLOR" > "$STATE_FILE" 2>/dev/null || true
fi
