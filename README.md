# Claude Terminal Colors

Terminal background changes color based on what [Claude Code](https://claude.ai/code) is doing. Bash command? Brown. Editing? Blue. Reading? Violet. Done? Green. So you always know at a glance.

Implemented as Claude Code [hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) that emit [OSC 11](https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Operating-System-Commands) escape sequences.

| State | Color |
|---|---|
| Shell command | Warm brown |
| Writing code | Deep blue |
| Reading / searching | Dark violet |
| Subagent working | Dark teal |
| Needs your input | Dark red |
| Thinking | Midnight blue |
| Done | Dark green |
| Notification | Warm orange |
| Other tool | Slate |

A tool's color stays until the next state change, so the background doesn't flicker. Starting or quitting Claude Code resets the terminal to its own default, so no color lingers between sessions.

## Install as a Claude Code plugin (recommended)

No scripts, no editing `settings.json` — install once and toggle it from `/plugin`:

```text
/plugin marketplace add Lukas200512/claude-terminal-colors
/plugin install claude-terminal-colors@claude-terminal-colors
```

Enable, disable, or remove it anytime:

```text
/plugin disable claude-terminal-colors@claude-terminal-colors
/plugin enable  claude-terminal-colors@claude-terminal-colors
```

Disabling stops the hooks from firing; your own `settings.json` is never touched.

Switch theme from inside Claude Code:

```text
/claude-terminal-colors:theme ocean
```

## Install manually (standalone)

Prefer not to use the plugin system? Run the installer:

```bash
curl -fsSL https://raw.githubusercontent.com/Lukas200512/claude-terminal-colors/main/install.sh | bash
```

…or just point Claude Code at this repo and ask it to install — it'll clone, copy the hook, set up `~/.claude/settings.json`, and pick a theme with you.

The standalone installer needs `jq` (to merge into `settings.json`); the hook itself does not — it falls back to plain bash, so the plugin runs with no external dependencies. Works in iTerm2, Kitty, Alacritty, WezTerm, GNOME Terminal, Konsole, Windows Terminal, Hyper, Tabby, foot, Termux. **Not** macOS Terminal.app (no OSC 11 support).

Inside **tmux** or **screen** the color sequence is wrapped in a passthrough so it reaches the outer terminal. tmux additionally needs passthrough enabled (tmux ≥ 3.3):

```bash
tmux set -g allow-passthrough on
```

## Platform support

The background color is set by writing an [OSC 11](https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Operating-System-Commands) sequence to the terminal. That works wherever the hook can reach a real terminal device, which is **where Claude Code runs**, not necessarily where you sit:

| Where Claude Code runs | Background colors |
|---|---|
| Linux | ✅ |
| macOS (in an OSC 11 terminal — iTerm2, Kitty, WezTerm, …) | ✅ |
| Windows via **WSL** | ✅ |
| **SSH** into a Linux/macOS host (e.g. from Windows Terminal) | ✅ — the sequence travels over SSH and colors your local terminal |
| **Native Windows** (Claude Code in PowerShell, no WSL) | ❌ — see below |
| macOS Terminal.app | ❌ — no OSC 11 support |

**Why native Windows can't do background colors.** On native Windows there is no `/dev/tty`, and Claude Code's only sanctioned cross-platform channel for a hook to emit escape sequences (the `terminalSequence` hook field) **allowlists titles, notifications, and the bell — but explicitly rejects color sequences like OSC 11**. So no plugin can repaint the background from a hook there. If you're on Windows, run Claude Code inside **WSL** or over **SSH** and it works fully. (The terminal renders fine either way — it's the hook-side write that's blocked on native Windows.)

## Themes

`dark-minimal` (default), `ocean`, `monokai`.

**Plugin install** — switch from inside Claude Code:

```text
/claude-terminal-colors:theme ocean
```

…or drop a theme file at `~/.claude/terminal-colors/theme.conf`.

**Standalone install** — copy a bundled theme over the active one:

```bash
cp ~/.claude/hooks/themes/ocean.conf ~/.claude/hooks/theme.conf
```

For a custom theme, copy any `.conf`, edit the hex values, and put it at your active-theme path. Theme files are parsed, not executed — only `COLOR_*="#rrggbb"` lines are read, so a stray line can't run code.

`color.sh` looks for a theme in this order: `$CLAUDE_TERMINAL_THEME` → `~/.claude/terminal-colors/theme.conf` → `~/.claude/hooks/theme.conf` → built-in defaults.

## Troubleshooting

**Terminal jumps to the bottom when I scroll up.** Most terminals have a "scroll on output" setting that snaps to the prompt whenever anything is written to the TTY. The hook only writes when the color actually changes — a tool's color persists until the next state change, and consecutive identical states are deduped — so this rarely fires. To eliminate it entirely, disable that setting (iTerm2 / GNOME Terminal / Konsole: scrolling preferences; Alacritty: `scrolling.auto_scroll = false`; WezTerm: `scroll_to_bottom_on_input = false`).

## Uninstall

```bash
curl -fsSL https://raw.githubusercontent.com/Lukas200512/claude-terminal-colors/main/uninstall.sh | bash
```

## License

MIT
