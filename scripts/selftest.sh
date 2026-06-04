#!/bin/bash
# ============================================================
# Claude Terminal Colors — live self-test
# Cycles the active theme's state colors so you can see them,
# then resets the terminal to its default. POSIX-only (same
# limitation as the hook: it writes OSC 11 to the terminal).
# ============================================================

DELAY="${1:-1}"   # seconds to show each color

# --- Resolve the active theme (same priority as the hook) ----
THEME_FILE="${CLAUDE_TERMINAL_THEME:-}"
if [ -z "$THEME_FILE" ]; then
  for _cand in "$HOME/.claude/terminal-colors/theme.conf" "$HOME/.claude/hooks/theme.conf"; do
    [ -f "$_cand" ] && { THEME_FILE="$_cand"; break; }
  done
fi
if [ -n "$THEME_FILE" ] && [ -f "$THEME_FILE" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    if [[ "$line" =~ ^[[:space:]]*(COLOR_[A-Z]+)=\"?(#[0-9a-fA-F]{6})\"? ]]; then
      printf -v "${BASH_REMATCH[1]}" '%s' "${BASH_REMATCH[2]}"
    fi
  done < "$THEME_FILE"
fi

COLOR_BASH="${COLOR_BASH:-#1a0a00}"
COLOR_CODE="${COLOR_CODE:-#0a0f2e}"
COLOR_READ="${COLOR_READ:-#0f0a1f}"
COLOR_AGENT="${COLOR_AGENT:-#001a1a}"
COLOR_INPUT="${COLOR_INPUT:-#2a0a0a}"
COLOR_IDLE="${COLOR_IDLE:-#0f1923}"
COLOR_DONE="${COLOR_DONE:-#0a1a0a}"
COLOR_NOTIFY="${COLOR_NOTIFY:-#2a1a00}"
COLOR_TOOL="${COLOR_TOOL:-#15151f}"

# --- emit() — multiplexer-aware write to the terminal --------
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

show() {
  printf '  %-22s %s\n' "$1" "$2"
  emit "$(printf '\033]11;%s\007' "$2")"
  sleep "$DELAY"
}

echo "Cycling theme: ${THEME_FILE:-built-in defaults}"
echo "Watch the background — each state shows for ${DELAY}s:"
show "Thinking"            "$COLOR_IDLE"
show "Shell command"       "$COLOR_BASH"
show "Writing code"        "$COLOR_CODE"
show "Reading / searching" "$COLOR_READ"
show "Subagent working"    "$COLOR_AGENT"
show "Needs your input"    "$COLOR_INPUT"
show "Notification"        "$COLOR_NOTIFY"
show "Other tool"          "$COLOR_TOOL"
show "Done"                "$COLOR_DONE"

# Reset to the terminal's own default.
emit $'\033]111\007'
echo "Done — terminal reset to its default."
