# Claude Terminal Colors

See what [Claude Code](https://claude.ai/code) is doing at a glance — through a
**colored statusline badge**, your **window title**, and **notifications**. Each
is independently toggleable.

| Method | What you get |
|---|---|
| 🟦 **Statusline badge** | a colored badge in the status bar: `SHELL` / `EDITING` / `READING` / `SUBAGENT` / `DONE` … |
| 🏷️ **Window title** | the current activity in your tab/window title (`> Claude > Editing`) |
| 🔔 **Notifications** | a ping when Claude is **done** or **needs your input** |

Works on Linux, macOS, WSL, SSH, and **native Windows** — it never writes to
`/dev/tty`, so it isn't tied to one platform.

> **Heads up — no more background colors.** Earlier versions of this project
> repainted the terminal *background*. As of Claude Code **v2.1.139** that's no
> longer possible (see [Why not background colors?](#why-not-background-colors)).
> The badge / title / notifications above are the supported replacement.

## Install

This is a Claude Code **plugin** — no scripts, no manual install:

```text
/plugin marketplace add Lukas200512/claude-terminal-colors
/plugin install claude-terminal-colors@claude-terminal-colors
```

Then run the wizard to pick your features and theme:

```text
/claude-terminal-colors:setup
```

Restart Claude Code afterwards so the statusline badge appears. Enable or disable
the whole thing anytime from `/plugin`:

```text
/plugin disable claude-terminal-colors@claude-terminal-colors
/plugin enable  claude-terminal-colors@claude-terminal-colors
```

## States

The badge color and label reflect what Claude is doing:

| State | Label | Color (theme) |
|---|---|---|
| Shell command | `SHELL` | warm brown |
| Writing code | `EDITING` | deep blue |
| Reading / searching | `READING` | dark violet |
| Subagent working | `SUBAGENT` | dark teal |
| Needs your input | `NEEDS INPUT` | dark red |
| Thinking | `THINKING` | midnight blue |
| Done | `DONE` | dark green |
| Other tool | `WORKING` | slate |

Theme colors are brightened for the small badge so they stay readable.

## Configure

Turn individual features on or off anytime:

```text
/claude-terminal-colors:config
```

Settings live in `~/.claude/terminal-colors/config.conf`:

```
FEATURE_STATUSLINE=on
FEATURE_TITLE=on
FEATURE_NOTIFY=on
NOTIFY_DONE=on
NOTIFY_INPUT=on
```

## Themes

`dark-minimal` (default), `ocean`, `monokai`. Switch in-session:

```text
/claude-terminal-colors:theme ocean
```

…or drop a custom theme at `~/.claude/terminal-colors/theme.conf` (only
`COLOR_*="#rrggbb"` lines are read — the file is parsed, never executed).
Resolution order: `$CLAUDE_TERMINAL_THEME` → `~/.claude/terminal-colors/theme.conf`
→ built-in defaults.

## Why not background colors?

The terminal background is set with an [OSC 11](https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Operating-System-Commands)
escape sequence. Two things make that impossible from a hook on current Claude
Code:

1. **No controlling terminal.** As of Claude Code **v2.1.139**, command hooks run
   in their own session without a controlling terminal, so writing escape
   sequences directly to `/dev/tty` fails (`No such device or address`).
2. **Allowlisted output channel.** The sanctioned replacement — the hook
   `terminalSequence` field — only permits **OSC 0/1/2/9/99/777 and BEL** (titles,
   notifications, bell). Color sequences like OSC 11 are rejected, and there's no
   setting to change it.

So no plugin can repaint the background on current Claude Code, on any OS. This
plugin uses the channels that *do* work: the statusline (which Claude Code renders
itself, in color), the window title, and notifications.

## Notes & limitations

- **Statusline** is registered in `~/.claude/settings.json` by `/setup` (your
  existing one is backed up to `settings.json.bak`) and appears after a restart.
  **Before uninstalling the plugin**, run `/claude-terminal-colors:config` and
  turn the statusline off, so no dangling entry is left behind.
- **Window title** may alternate with Claude Code's own title — that's expected.
- **Notifications** (OSC 9) are terminal-dependent: known to work in Windows
  Terminal, iTerm2, WezTerm, ConEmu, Ghostty. Other terminals may ignore them.

## License

MIT
