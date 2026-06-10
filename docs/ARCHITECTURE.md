# Architecture — Claude Pulse

One-page orientation for contributors. User-facing docs live in README.md.

## Data flow

```
Claude Code events                      statusline render (~300ms debounce)
       │                                            │
       ▼                                            ▼
hooks/indicator.js  ──writes──►  state files  ◄──reads──  statusline/badge.js
 (one node process               (per session)             (registered via the
  per hook event)                                           stable launcher)
       │
       └─returns──►  terminalSequence (OSC 2 title, OSC 9 notification)
```

- **`hooks/indicator.js`** — registered in `hooks/hooks.json` for PreToolUse,
  PostToolUse, UserPromptSubmit, SessionStart/End, Stop, Notification,
  PreCompact/PostCompact, SubagentStart/Stop. Derives a state
  (`{key,label,icon,color,detail?,mode?,needsApproval?,duration?}`) and writes
  it atomically. Must **never fail or block** — every I/O path is wrapped.
- **`statusline/badge.js`** — reads the state for *its* session (the
  statusline stdin JSON carries `session_id`) plus live fields from that JSON
  (model, context_window, cost, effort) and prints one ANSI line. 24-bit
  color when `COLORTERM` advertises it, 256-color cube otherwise.
- **`scripts/statusline-launcher.js`** — copied to a stable path at setup;
  resolves the currently installed badge.js (installed_plugins.json → cache →
  marketplace) so `settings.json` never hardcodes a versioned path.
- **`scripts/register-statusline.js`** — edits `settings.json`: one-time
  `.bak`, saves a foreign statusLine to `previous-statusline.json` and
  restores it on `off`, refuses to touch unparseable JSON.
- **`commands/*.md`** — `/setup`, `/config`, `/theme`, `/doctor` wizards;
  `scripts/doctor.js` does the actual health checks.

## State on disk

Everything lives under `<CLAUDE_CONFIG_DIR|~/.claude>/claude-pulse/`:

| File | Writer | Purpose |
|---|---|---|
| `state-<sid>` | hook | current badge state (JSON, atomic tmp+rename) |
| `turn-start-<sid>` | hook | epoch-ms stamp for the ⏱ duration |
| `subagents/<sid>/<agent_id>` | hook | one marker file per running subagent |
| `config.conf`, `theme.conf` | wizards | `KEY=value`, parsed — never executed |
| `statusline.js` | register | stable launcher copy |
| `previous-statusline.json` | register | foreign statusline saved for restore |

Per-session keying is what lets parallel sessions coexist. Cleanup: SessionEnd
removes its session's files; SessionStart garbage-collects anything older than
72 h (crashed sessions). Legacy (pre-2.4) global files are still read as
fallbacks and cleared at boundaries.

## Invariants worth keeping

1. Hooks never crash, never block, never print to stderr — Claude Code runs
   them on *every* tool call.
2. The badge renders something sensible from any state-file generation
   (upgrades happen while sessions are live — keep the legacy fallbacks).
3. Config and theme files are parsed with an allowlist, never executed.
4. `settings.json` is only modified by register-statusline.js, and only when
   it parses cleanly.
5. SessionStart with `source=compact` fires **mid-turn** — don't treat it as
   a session boundary. UserPromptSubmit can fire spuriously when a subagent
   completes (claude-code#16952) — don't clear counters on it.

## Testing & releasing

- `node scripts/smoke.js` — 39 end-to-end checks in a sandboxed
  `CLAUDE_CONFIG_DIR`, < 2 s, no dependencies. Run before every commit.
- Versioning: `alpha` branch carries `x.y.z-alpha.N` builds; merging to
  `main` publishes (the marketplace tracks `main`). Bump the version in
  `.claude-plugin/plugin.json` and add a CHANGELOG entry.
