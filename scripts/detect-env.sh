#!/bin/bash
# ============================================================
# Claude Terminal Colors — environment probe (read-only)
# Prints "key: value" lines, then one VERDICT: line and TIP: lines.
# Never writes to the terminal.
# ============================================================

uname_s=$(uname -s 2>/dev/null || echo unknown)

# OS classification
case "$uname_s" in
  Linux)               os="Linux" ;;
  Darwin)              os="macOS" ;;
  MINGW*|MSYS*|CYGWIN*) os="Windows (Git Bash/MSYS)" ;;
  *)                   os="$uname_s" ;;
esac

# WSL detection
is_wsl=no
if grep -qiE 'microsoft|wsl' /proc/version 2>/dev/null; then
  is_wsl=yes
  os="Linux (WSL)"
fi

# SSH session?
is_ssh=no
{ [ -n "$SSH_CONNECTION" ] || [ -n "$SSH_TTY" ]; } && is_ssh=yes

# Native Windows = MSYS/MINGW and NOT WSL
is_native_win=no
case "$uname_s" in
  MINGW*|MSYS*|CYGWIN*) [ "$is_wsl" = no ] && is_native_win=yes ;;
esac

# Multiplexer
mux="none"
[ -n "$TMUX" ] && mux="tmux"
[ -n "$STY" ] && mux="screen"

# /dev/tty writable?
tty_ok=no
if { : > /dev/tty; } 2>/dev/null; then tty_ok=yes; fi

term_prog="${TERM_PROGRAM:-${WT_SESSION:+Windows Terminal}}"
term_prog="${term_prog:-unknown}"

echo "os: $os"
echo "wsl: $is_wsl"
echo "ssh: $is_ssh"
echo "native_windows: $is_native_win"
echo "terminal: $term_prog"
echo "TERM: ${TERM:-unset}"
echo "multiplexer: $mux"
echo "dev_tty_writable: $tty_ok"

# ---- Verdict -------------------------------------------------
if [ "$term_prog" = "Apple_Terminal" ]; then
  echo "VERDICT: NO — macOS Terminal.app does not support OSC 11 background colors."
  echo "TIP: Use iTerm2, Kitty, WezTerm, Alacritty, or Ghostty instead."
elif [ "$is_native_win" = yes ]; then
  echo "VERDICT: NO — native Windows has no /dev/tty and Claude Code cannot emit OSC 11 from a hook here."
  echo "TIP: Run Claude Code inside WSL, or SSH into a Linux/macOS host — both work fully."
elif [ "$tty_ok" = no ]; then
  echo "VERDICT: MAYBE — no writable /dev/tty was found from this process; colors may not appear."
  echo "TIP: This can happen in detached/non-interactive contexts; in a normal interactive session it usually works."
elif [ "$mux" = tmux ]; then
  echo "VERDICT: OK — tmux detected."
  echo "TIP: tmux must allow passthrough:  tmux set -g allow-passthrough on   (tmux >= 3.3)"
elif [ "$mux" = screen ]; then
  echo "VERDICT: OK — GNU screen detected; the color sequence is wrapped for screen automatically."
else
  echo "VERDICT: OK — this environment should display background colors."
fi
