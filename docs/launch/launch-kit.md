# Claude Pulse — Launch Kit

Ready-to-use copy for distribution. Replace the GIF link once a real terminal
recording exists (the README's `assets/demo.svg` works until then).

Repo: https://github.com/Lukas200512/claude-pulse

---

## 1. Awesome-list entry (one line)

Submit as a PR to lists like `hesreallyhim/awesome-claude-code`,
`ccplugins/awesome-claude-code-plugins`, `Chat2AnyLLM/awesome-claude-plugins`.

```markdown
- [Claude Pulse](https://github.com/Lukas200512/claude-pulse) — At-a-glance activity indicator for Claude Code: a colored statusline badge (plus optional window title and notifications) showing whether Claude is running a shell command, editing, reading, or done. Cross-platform, zero dependencies.
```

---

## 2. Community-marketplace submission

- **Name:** claude-pulse
- **Category:** UI / productivity
- **One-liner:** See what Claude Code is doing at a glance.
- **Description:**
  > Claude Pulse shows Claude Code's current activity as a colored badge in your
  > status line — shell, editing, reading, subagent, done — plus optional
  > notifications when Claude finishes or needs your input. Pure Node, no
  > dependencies, works on Linux, macOS, WSL, SSH, and native Windows. Install,
  > run `/claude-pulse:setup`, done.

---

## 3. Reddit — r/ClaudeAI

**Title:** I built Claude Pulse: a statusline badge that shows what Claude Code is doing at a glance

**Body:**
> I kept losing track of what Claude Code was doing in long sessions — is it
> running a command, editing, waiting on me? So I made **Claude Pulse**: a
> colored badge in the status line that reflects the current activity
> (`SHELL` / `EDITING` / `READING` / `SUBAGENT` / `DONE`), with optional
> notifications when Claude is done or needs input.
>
> - Install as a plugin, run `/claude-pulse:setup`, pick your features + theme.
> - Pure Node, zero dependencies. Works on Linux, macOS, WSL, SSH, and native Windows.
> - MIT, fully open source.
>
> Fun backstory: it started as a plugin that recolored the whole terminal
> *background* per activity — until Claude Code v2.1.139 stopped letting hooks
> write to the terminal directly. I rebuilt it on the channels that still work
> (the statusline, which Claude Code renders itself). Details in the README.
>
> Repo + demo: https://github.com/Lukas200512/claude-pulse
> Feedback very welcome.

---

## 4. X / Twitter thread

**1/**
> Lost track of what Claude Code is doing in long sessions?
>
> I built **Claude Pulse** — a colored status-line badge showing the live
> activity: SHELL · EDITING · READING · DONE. + a ping when it's done or needs you.
>
> Plugin, zero deps, MIT. 👇 (demo)
> [attach demo.svg/GIF]

**2/**
> Install in 2 lines:
>
> /plugin marketplace add Lukas200512/claude-pulse
> /plugin install claude-pulse@claude-pulse
>
> then /claude-pulse:setup to pick features + theme. Works on Linux, macOS, WSL,
> SSH, and native Windows.

**3/**
> Backstory: it used to recolor the whole terminal background per activity —
> until Claude Code v2.1.139 stopped hooks from writing to the terminal.
>
> So I rebuilt it on the status line (which Claude renders itself). Same idea,
> works everywhere now.
>
> ⭐ https://github.com/Lukas200512/claude-pulse

---

## 5. Dev.to / Hacker News article

**Title (HN):** Show HN: Claude Pulse – a status-line badge showing what Claude Code is doing
**Title (Dev.to):** When Claude Code removed terminal background colors from hooks, I rebuilt the indicator the way that still works

**Body:**

> ## The idea
> In long Claude Code sessions I kept losing track of what it was doing — running
> a shell command? editing? waiting for me? I wanted an ambient, at-a-glance
> signal. My first version recolored the **terminal background** per activity:
> brown for shell, blue for editing, green for done.
>
> ## What broke
> It worked great — until it didn't. As of **Claude Code v2.1.139**, command
> hooks run without a controlling terminal, so writing the `OSC 11` background
> escape to `/dev/tty` just fails (`No such device or address`). Anthropic added
> a sanctioned channel for hooks to emit escape sequences — the `terminalSequence`
> field — but it allowlists only titles, notifications, and the bell. **Color
> sequences like OSC 11 are rejected, and there's no setting to change it.** I
> confirmed this straight from the binary.
>
> Translation: no plugin can repaint the terminal background on current Claude
> Code, on any OS.
>
> ## The rebuild
> So I moved to the channels that *do* work:
> - **Statusline badge** — a hook writes the current state to a file; a small
>   statusline script renders a colored badge. Claude Code renders the status line
>   itself, so this works on every platform, including native Windows (no
>   `/dev/tty` needed).
> - **Window title** and **notifications** via the allowlisted `terminalSequence`.
>
> Each is independently toggleable. The whole thing is plain Node — no bash, no
> jq — so it runs wherever Claude Code runs.
>
> ## Try it
> ```
> /plugin marketplace add Lukas200512/claude-pulse
> /plugin install claude-pulse@claude-pulse
> /claude-pulse:setup
> ```
> MIT, source + design notes: https://github.com/Lukas200512/claude-pulse
>
> Happy to answer questions about the hook model — the "hooks have no controlling
> terminal" change trips up a lot of plugin authors.
