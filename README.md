# Claude Pulse

See what [Claude Code](https://claude.ai/code) is doing at a glance — through a
**colored statusline badge**, your **window title**, and **notifications**. Each
is independently toggleable.

<p align="center">
  <img src="assets/demo.svg" alt="Claude Pulse badge cycling through THINKING, SHELL, EDITING, READING, SUBAGENT, DONE" width="720">
</p>

| Method | What you get |
|---|---|
| 🟦 **Statusline badge** | a colored badge in the status bar: `SHELL` / `EDITING` / `READING` / `SUBAGENT` / `DONE` … |
| 🟪 **Mode chip** | the active permission mode next to the badge while Claude is working: `PLAN` / `AUTO-EDIT` / `AUTO` / `NO-ASK` / `BYPASS`, plus `WARTET AUF OK` when an auto mode hits a real permission prompt. (Shown only during activity — Claude Code gives the status line no way to read the mode when idle, so it is hidden then rather than risk showing a stale value.) |
| ⚙️ **Subagent counter** | `⚙ N` while N subagents are running — disappears when none are |
| 📊 **Context gauge** | a colored bar of context-window usage (`▓▓▓▓░░░ 58%`), green→amber→red toward the limit |
| 🧠 **Effort chip** | the current reasoning effort (`LOW`/`MED`/`HIGH`/`XHIGH`/`MAX`) |
| ⏱️ **Duration** | `⏱` elapsed since the current turn started (updates as Claude acts) |
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
/plugin marketplace add Lukas200512/claude-pulse
/plugin install claude-pulse@claude-pulse
```

Then run the wizard to pick your features and theme:

```text
/claude-pulse:setup
```

Restart Claude Code afterwards so the statusline badge appears. Enable or disable
the whole thing anytime from `/plugin`:

```text
/plugin disable claude-pulse@claude-pulse
/plugin enable  claude-pulse@claude-pulse
```

## Stay up to date

By default, third-party marketplaces don't auto-update, so you'd otherwise have to
pull new versions by hand. To get updates automatically, **enable auto-update for
this marketplace once**: open `/plugin`, select the `claude-pulse` marketplace, and
turn on auto-update. After that, Claude Code refreshes and updates the plugin **on
startup** — no manual command, no guessing whether you're on the latest version.

(Without it, you'd update manually with `/plugin marketplace update claude-pulse`
followed by reinstalling — which is exactly what auto-update saves you from.)

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
/claude-pulse:config
```

Settings live in `~/.claude/claude-pulse/config.conf`:

```
FEATURE_STATUSLINE=on
FEATURE_TITLE=off       # off by default — Claude Code overrides the title
FEATURE_NOTIFY=on
FEATURE_MODE=on         # permission-mode chip + "WARTET AUF OK" on auto modes
FEATURE_SUBAGENTS=on    # "⚙ N" while N subagents are running
FEATURE_CONTEXT=on      # context-window usage bar
FEATURE_EFFORT=on       # reasoning-effort chip (LOW…MAX)
FEATURE_DURATION=on     # "⏱" elapsed since the turn started
NOTIFY_DONE=on
NOTIFY_INPUT=on
BADGE_STYLE=wide        # compact | wide | full (full = whole status line)
```

`BADGE_STYLE` controls how prominent the badge is — `compact` is a small badge,
`wide` a larger colored block, `full` turns the entire status line into a colored
bar in the current state's color.

## Themes

`dark-minimal` (default), `ocean`, `monokai`. Switch in-session:

```text
/claude-pulse:theme ocean
```

…or drop a custom theme at `~/.claude/claude-pulse/theme.conf` (only
`COLOR_*="#rrggbb"` lines are read — the file is parsed, never executed).
Resolution order: `$CLAUDE_PULSE_THEME` → `~/.claude/claude-pulse/theme.conf`
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
  **Before uninstalling the plugin**, run `/claude-pulse:config` and
  turn the statusline off, so no dangling entry is left behind.
- **Window title** is **off by default**: Claude Code sets its own window title
  and overwrites ours, so it rarely shows. Enable it via `/…:config` if your
  setup happens to keep it.
- **Notifications** (OSC 9) are terminal-dependent: known to work in Windows
  Terminal, iTerm2, WezTerm, ConEmu, Ghostty. Other terminals may ignore them.

## License

MIT
