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
| 🔍 **Activity detail** | *what exactly* is happening, next to the badge: `EDITING badge.js`, `SHELL npm test`, `SUBAGENT code-reviewer` — fully local |
| 🟪 **Mode chip** | the active permission mode next to the badge while Claude is working: `PLAN` / `AUTO-EDIT` / `AUTO` / `NO-ASK` / `BYPASS`, plus `NEEDS OK` when an auto mode hits a real permission prompt. (Shown only during activity — Claude Code gives the status line no way to read the mode when idle, so it is hidden then rather than risk showing a stale value.) |
| ⚙️ **Subagent counter** | `⚙ N` while N subagents are running — disappears when none are |
| 📊 **Context gauge** | a colored bar of context-window usage (`▓▓▓▓░░░ 58%`), green→amber→red toward the limit |
| 🧠 **Effort chip** | the current reasoning effort (`LOW`/`MED`/`HIGH`/`XHIGH`/`MAX`) |
| ⏱️ **Duration** | `⏱` elapsed since the current turn started — and the total turn time on `DONE` (also in the done-notification) |
| 💵 **Cost** | the session's API cost so far (`$0.42`) |
| 🏷️ **Window title** | the current activity in your tab/window title (`> Claude > Editing: badge.js`) |
| 🔔 **Notifications** | a ping when Claude is **done** (with the turn duration) or **needs your input** |

Works on Linux, macOS, WSL, SSH, and **native Windows** — it never writes to
`/dev/tty`, so it isn't tied to one platform. Multiple Claude Code sessions on
the same machine each get their own badge (state is kept per session).

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

**Requirement:** Node.js on your PATH — the hooks and the badge are Node
scripts. `/claude-pulse:setup` checks this for you.

## Stay up to date

By default, third-party marketplaces don't auto-update, so you'd otherwise have to
pull new versions by hand. To get updates automatically, **enable auto-update for
this marketplace once**: open `/plugin`, select the `claude-pulse` marketplace, and
turn on auto-update. After that, Claude Code refreshes and updates the plugin **on
startup** — no manual command, no guessing whether you're on the latest version.

(Without it, you'd update manually with `/plugin marketplace update claude-pulse`
followed by reinstalling — which is exactly what auto-update saves you from.)

## States
:)

The badge color and label reflect what Claude is doing:

| State | Label | Color (theme) |
|---|---|---|
| Shell command | `SHELL` | warm brown |
| Writing code | `EDITING` | deep blue |
| Reading / searching files | `READING` | dark violet |
| Web search / fetch | `SEARCHING` / `FETCHING` | azure |
| Subagent working | `SUBAGENT` | dark teal |
| MCP tool | `MCP` | magenta |
| Running a skill | `SKILL` | dark teal |
| Updating the plan | `PLANNING` | slate |
| Compacting context | `COMPACTING` | midnight blue |
| Needs your input | `NEEDS INPUT` | dark red |
| Thinking | `THINKING` | midnight blue |
| Done | `DONE` | dark green |
| Session started | `READY` | midnight blue |
| No activity yet | `IDLE` | midnight blue |
| Other tool | `WORKING` | slate |

Theme colors are brightened for the small badge so they stay readable. On
terminals without 24-bit color support (GNU screen, Apple Terminal, the Linux
console) the badge automatically falls back to the closest 256-color palette
entry.

## Configure

Turn individual features on or off anytime:

```text
/claude-pulse:config
```

Settings live in `claude-pulse/config.conf` inside your Claude config directory
(`~/.claude/` by default; `CLAUDE_CONFIG_DIR` is honored):

```
FEATURE_STATUSLINE=on
FEATURE_TITLE=off       # off by default — Claude Code overrides the title
FEATURE_NOTIFY=on
FEATURE_MODE=on         # permission-mode chip + "NEEDS OK" on auto modes
FEATURE_SUBAGENTS=on    # "⚙ N" while N subagents are running
FEATURE_CONTEXT=on      # context-window usage bar
FEATURE_EFFORT=on       # reasoning-effort chip (LOW…MAX)
FEATURE_DURATION=on     # "⏱" elapsed since the turn started; total on DONE
FEATURE_DETAIL=on       # what exactly is happening (file, command, agent type)
                        # (defaults to off for configs created before 2.4)
FEATURE_COST=on         # session cost in USD
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

…or drop a custom theme at `claude-pulse/theme.conf` in your Claude config
directory (only `COLOR_*="#rrggbb"` lines are read — the file is parsed, never
executed). Resolution order: `$CLAUDE_PULSE_THEME` → `theme.conf` → built-in
defaults.

## Health check

```text
/claude-pulse:doctor
```

…verifies the whole chain: statusline registered, plugin resolvable, hooks
firing, and which channels your terminal/multiplexer actually supports
(including the tmux passthrough settings notifications need).

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

- **Statusline** is registered in `settings.json` by `/setup`. A one-time backup
  of your pre-install settings is kept at `settings.json.bak`, and if you had
  your own statusline before, it is saved and **restored automatically** when
  you turn the badge off. (Both apply to statuslines replaced from **2.4.0 on**;
  versions before that overwrote the backup on every change — if such a backup
  contains the claude-pulse entry, it is cleaned up on the next change.)
  **Before uninstalling the plugin**, run `/claude-pulse:config` and turn the
  statusline off, so no dangling entry is left behind.
- **Window title** is **off by default**: Claude Code sets its own window title
  and overwrites ours, so it rarely shows. Enable it via `/…:config` if your
  setup happens to keep it.
- **Notifications** (OSC 9) are terminal-dependent: known to work in Windows
  Terminal, iTerm2, WezTerm, ConEmu, Ghostty. Apple Terminal ignores them. In
  tmux you need `set -g allow-passthrough on` (tmux ≥ 3.3) for them to reach
  your terminal — `/claude-pulse:doctor` tells you exactly what's needed.

## License

MIT
