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

## Install

Either run the installer:

```bash
curl -fsSL https://raw.githubusercontent.com/Lukas200512/claude-terminal-colors/main/install.sh | bash
```

…or just point Claude Code at this repo and ask it to install — it'll clone, copy the hook, set up `~/.claude/settings.json`, and pick a theme with you.

Requires `jq`. Works in iTerm2, Kitty, Alacritty, WezTerm, GNOME Terminal, Konsole, Windows Terminal, Hyper, Tabby, foot, Termux. **Not** macOS Terminal.app (no OSC 11 support).

Inside **tmux** or **screen** the color sequence is wrapped in a passthrough so it reaches the outer terminal. tmux additionally needs passthrough enabled (tmux ≥ 3.3):

```bash
tmux set -g allow-passthrough on
```

## Themes

`dark-minimal` (default), `ocean`, `monokai`. Swap:

```bash
cp ~/.claude/hooks/themes/ocean.conf ~/.claude/hooks/theme.conf
```

For a custom theme, copy any `.conf`, edit the hex values, copy it to `theme.conf`. Theme files are parsed, not executed — only `COLOR_*="#rrggbb"` lines are read, so a stray line can't run code.

To point at a theme file elsewhere, set `CLAUDE_TERMINAL_THEME` to its path; it overrides `~/.claude/hooks/theme.conf`.

## Troubleshooting

**Terminal jumps to the bottom when I scroll up.** Most terminals have a "scroll on output" setting that snaps to the prompt whenever anything is written to the TTY. The hook only writes when the color actually changes — a tool's color persists until the next state change, and consecutive identical states are deduped — so this rarely fires. To eliminate it entirely, disable that setting (iTerm2 / GNOME Terminal / Konsole: scrolling preferences; Alacritty: `scrolling.auto_scroll = false`; WezTerm: `scroll_to_bottom_on_input = false`).

## Uninstall

```bash
curl -fsSL https://raw.githubusercontent.com/Lukas200512/claude-terminal-colors/main/uninstall.sh | bash
```

## License

MIT
