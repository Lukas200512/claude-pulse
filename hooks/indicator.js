#!/usr/bin/env node
/* ============================================================
 * Claude Pulse — activity indicator hook
 * Cross-platform (Node, no /dev/tty, no bash). For each event it:
 *   1. writes the current state to a per-session file (for the badge)
 *   2. returns a `terminalSequence` (window title + notification)
 * Channels used are the ones Claude Code allows from a hook:
 * OSC 2 (title) and OSC 9 (notification). Background color (OSC 11)
 * is rejected by Claude Code, so it is not attempted.
 * https://github.com/Lukas200512/claude-pulse
 * ========================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

// Honor CLAUDE_CONFIG_DIR (multi-profile setups); default ~/.claude.
const BASE = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const DIR = path.join(BASE, 'claude-pulse');
const LEGACY_DIR = path.join(os.homedir(), '.claude', 'claude-pulse');
const SUBAGENTS_BASE = path.join(DIR, 'subagents');

// All state is keyed by session so parallel Claude Code sessions never
// repaint each other's badge, merge subagent counts, or reset timers.
function sessionIdOf(payload) {
  const s = typeof payload.session_id === 'string' ? payload.session_id : '';
  return s.replace(/[^A-Za-z0-9-]/g, '').slice(0, 64);
}
const stateFile = (sid) => path.join(DIR, sid ? 'state-' + sid : 'state');
const turnFile = (sid) => path.join(DIR, sid ? 'turn-start-' + sid : 'turn-start');
const subagentsDir = (sid) => path.join(SUBAGENTS_BASE, sid || '_global');

// ---- tiny safe parsers (never execute the files) ------------
function readKV(file, allowed, validate) {
  const out = {};
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { return out; }
  for (const raw of text.split(/\r?\n/)) {
    // value may start with '#' (hex colors); stop at whitespace/quote. A
    // standalone comment line can't match because '#' isn't in [A-Z_].
    const m = raw.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\s]+)"?/);
    if (m && allowed.has(m[1]) && (!validate || validate(m[2]))) out[m[1]] = m[2];
  }
  return out;
}

// Config/theme written before the CLAUDE_CONFIG_DIR move may still live at
// the legacy ~/.claude path — keep reading it until the user re-runs /setup.
function firstExisting(cands) {
  for (const f of cands) { try { fs.accessSync(f); return f; } catch { /* next */ } }
  return cands[0];
}
const CONFIG_FILE = firstExisting([path.join(DIR, 'config.conf'), path.join(LEGACY_DIR, 'config.conf')]);

const FLAGS = new Set([
  'FEATURE_STATUSLINE', 'FEATURE_TITLE', 'FEATURE_NOTIFY', 'FEATURE_MODE', 'FEATURE_SUBAGENTS',
  'FEATURE_CONTEXT', 'FEATURE_EFFORT', 'FEATURE_DURATION', 'FEATURE_DETAIL', 'FEATURE_COST',
  'NOTIFY_DONE', 'NOTIFY_INPUT',
]);
const cfg = readKV(CONFIG_FILE, FLAGS, v => v === 'on' || v === 'off');
const on = (k, def = true) => (cfg[k] ? cfg[k] === 'on' : def);
let cfgFileExists = false;
try { fs.accessSync(CONFIG_FILE); cfgFileExists = true; } catch { /* no config yet */ }

const COLORS = new Set([
  'COLOR_BASH', 'COLOR_CODE', 'COLOR_READ', 'COLOR_AGENT', 'COLOR_INPUT',
  'COLOR_IDLE', 'COLOR_DONE', 'COLOR_TOOL', 'COLOR_WEB', 'COLOR_MCP',
]);
function loadTheme() {
  const cands = [
    process.env.CLAUDE_PULSE_THEME,
    path.join(DIR, 'theme.conf'),
    path.join(LEGACY_DIR, 'theme.conf'),
    path.join(os.homedir(), '.claude', 'hooks', 'theme.conf'),
  ].filter(Boolean);
  let t = {};
  for (const f of cands) {
    if (f && fs.existsSync(f)) { t = readKV(f, COLORS, v => /^#[0-9a-fA-F]{6}$/.test(v)); break; }
  }
  return {
    bash: t.COLOR_BASH || '#1a0a00', code: t.COLOR_CODE || '#0a0f2e',
    read: t.COLOR_READ || '#0f0a1f', agent: t.COLOR_AGENT || '#001a1a',
    input: t.COLOR_INPUT || '#2a0a0a', idle: t.COLOR_IDLE || '#0f1923',
    done: t.COLOR_DONE || '#0a1a0a', tool: t.COLOR_TOOL || '#15151f',
    web: t.COLOR_WEB || '#04202e', mcp: t.COLOR_MCP || '#240a1f',
  };
}

// ---- read the hook payload from stdin -----------------------
function readStdin() {
  try { return JSON.parse(fs.readFileSync(0, 'utf8')) || {}; } catch { return {}; }
}

// ---- previous state (to carry the last-known permission mode) ----
function readPrevState(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) || {}; } catch { return {}; }
}

const AUTO_MODES = new Set(['acceptEdits', 'auto', 'bypassPermissions', 'dontAsk']);

// Resolve the permission mode + the "auto on but this needs approval" flag.
// permission_mode isn't on every event, so we persist the last value seen.
function resolveMode(event, payload, prev) {
  const mode = (typeof payload.permission_mode === 'string' && payload.permission_mode) ||
               prev.mode || 'default';
  let needsApproval = false;
  if (event === 'notify' && AUTO_MODES.has(mode)) {
    const ntype = typeof payload.notification_type === 'string' ? payload.notification_type : '';
    const msg = (typeof payload.message === 'string' ? payload.message : '').toLowerCase();
    // Only a real permission prompt counts — never idle/auth/other notifications.
    // Newer CC exposes notification_type; older builds fall back to the message
    // text (English/German keywords only — other locales just miss the chip).
    needsApproval = ntype ? ntype === 'permission_prompt'
                          : /permission|approv|erlaub|freigab/.test(msg);
  }
  return { mode, needsApproval };
}

// ---- running-subagent counter (one marker file per subagent) ----
// Race-free: each subagent owns a distinct file keyed by agent_id, so parallel
// starts/stops never collide on a shared counter. The badge counts the files.
function markerName(id) {
  const s = String(id || '').replace(/[^A-Za-z0-9._-]/g, '');
  return s || ('a' + process.pid + '-' + Date.now()); // fallback when agent_id is absent
}
function addSubagent(dir, id) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, markerName(id)), '');
  } catch { /* never fail a hook */ }
}
function removeSubagent(dir, id) {
  if (id) {
    // Marker already gone (boundary clear, race) → nothing left to decrement;
    // never fall through to deleting some other agent's marker.
    try { fs.unlinkSync(path.join(dir, markerName(id))); } catch { /* gone */ }
    return;
  }
  // no agent_id (older CC): drop the oldest marker as a best-effort decrement,
  // skipping files that vanish mid-scan instead of aborting the decrement.
  try {
    const files = [];
    for (const f of fs.readdirSync(dir)) {
      try { files.push({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }); } catch { /* vanished */ }
    }
    files.sort((a, b) => a.t - b.t);
    for (const e of files) {
      try { fs.unlinkSync(path.join(dir, e.f)); return; } catch { /* try next-oldest */ }
    }
  } catch { /* dir missing */ }
}
function clearSubagents(dir) {
  try { for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f)); } catch { /* none */ }
}
// Pre-2.4 hooks wrote markers as loose files directly in subagents/ — the
// badge still counts them as a fallback, so clear them at boundaries too or
// upgraders see a phantom "⚙ N" until GC.
function clearLooseMarkers() {
  try {
    for (const e of fs.readdirSync(SUBAGENTS_BASE, { withFileTypes: true })) {
      if (e.isFile()) { try { fs.unlinkSync(path.join(SUBAGENTS_BASE, e.name)); } catch { /* gone */ } }
    }
  } catch { /* dir missing */ }
}

// ---- garbage-collect leftovers of dead sessions --------------
// Sessions that crash (SIGKILL, closed terminal) never fire SessionEnd, so
// their per-session files linger. Anything untouched for 3 days is dead.
function gcStale() {
  const cutoff = Date.now() - 72 * 3600 * 1000;
  try {
    for (const f of fs.readdirSync(DIR)) {
      const isOurs = f === 'state' || f === 'turn-start' ||
        f.startsWith('state-') || f.startsWith('turn-start-') || f.endsWith('.tmp');
      if (!isOurs) continue;
      const p = path.join(DIR, f);
      try { if (fs.statSync(p).mtimeMs < cutoff) fs.rmSync(p, { force: true }); } catch { /* vanished */ }
    }
  } catch { /* dir missing */ }
  try {
    for (const d of fs.readdirSync(SUBAGENTS_BASE)) {
      const p = path.join(SUBAGENTS_BASE, d);
      try { if (fs.statSync(p).mtimeMs < cutoff) fs.rmSync(p, { recursive: true, force: true }); } catch { /* vanished */ }
    }
  } catch { /* dir missing */ }
}

// ---- derive the current state -------------------------------
function deriveState(event, toolName, theme) {
  switch (event) {
    case 'prompt':  return { key: 'thinking',   label: 'Thinking',   icon: '*', color: theme.idle };
    case 'post':    return { key: 'thinking',   label: 'Thinking',   icon: '*', color: theme.idle };
    case 'stop':    return { key: 'done',       label: 'Done',       icon: 'v', color: theme.done };
    case 'notify':  return { key: 'input',      label: 'Needs input', icon: '!', color: theme.input };
    case 'compact': return { key: 'compacting', label: 'Compacting', icon: '%', color: theme.idle };
    case 'start':   return { key: 'ready',      label: 'Ready',      icon: '.', color: theme.idle };
    case 'end':     return { key: 'idle',       label: 'Idle',       icon: '.', color: theme.idle };
    case 'pre':
    default:
      if (/^mcp__/.test(toolName)) return { key: 'mcp', label: 'MCP', icon: '&', color: theme.mcp };
      switch (toolName) {
        case 'Bash':             return { key: 'shell',    label: 'Shell',    icon: '>', color: theme.bash };
        case 'Edit': case 'Write': case 'MultiEdit': case 'NotebookEdit':
                                 return { key: 'editing',  label: 'Editing',  icon: '~', color: theme.code };
        case 'Read': case 'Glob': case 'Grep':
                                 return { key: 'reading',  label: 'Reading',  icon: '?', color: theme.read };
        case 'Agent': case 'Task':
                                 return { key: 'subagent', label: 'Subagent', icon: '@', color: theme.agent };
        case 'WebSearch':        return { key: 'web',      label: 'Searching', icon: 'o', color: theme.web };
        case 'WebFetch':         return { key: 'web',      label: 'Fetching', icon: 'o', color: theme.web };
        case 'TodoWrite':        return { key: 'planning', label: 'Planning', icon: '#', color: theme.tool };
        case 'Skill':            return { key: 'skill',    label: 'Skill',    icon: '/', color: theme.agent };
        case 'AskUserQuestion':  return { key: 'input',    label: 'Needs input', icon: '?', color: theme.input };
        default:                 return { key: 'tool',     label: 'Working',  icon: '+', color: theme.tool };
      }
  }
}

// A short "what exactly" string from tool_input: the edited file's basename,
// the shell command, the subagent type, … Local-only, truncated, one line.
function deriveDetail(toolName, input) {
  if (!input || typeof input !== 'object') return '';
  const base = (p) => { try { return path.basename(String(p)); } catch { return ''; } };
  let d = '';
  if (/^mcp__/.test(toolName)) {
    const parts = toolName.split('__');
    d = parts[1] ? parts[1] + (parts[2] ? ':' + parts[2] : '') : '';
  } else switch (toolName) {
    case 'Bash': d = String(input.command || input.description || '').split('\n')[0]; break;
    case 'Edit': case 'Write': case 'MultiEdit': case 'Read':
      d = base(input.file_path); break;
    case 'NotebookEdit': d = base(input.notebook_path || input.file_path); break;
    case 'Glob': case 'Grep': d = String(input.pattern || ''); break;
    case 'Agent': case 'Task': d = String(input.subagent_type || input.description || ''); break;
    case 'Skill': d = String(input.skill || input.command || ''); break;
    case 'WebFetch': try { d = new URL(String(input.url)).hostname; } catch { d = ''; } break;
    case 'WebSearch': d = String(input.query || ''); break;
  }
  d = d.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim();
  return d.length > 32 ? d.slice(0, 31) + '…' : d;
}

function fmtDuration(ms) {
  let s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm' + (s % 60) + 's';
  return Math.floor(s / 3600) + 'h' + Math.floor((s % 3600) / 60) + 'm';
}

// Atomic state write with a per-process temp name: concurrent hook processes
// (parallel tool calls) must never interleave writes on a shared temp file.
function writeState(file, state) {
  const tmp = file + '.' + process.pid + '.tmp';
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(state));
    fs.renameSync(tmp, file);
  } catch {
    try { fs.unlinkSync(tmp); } catch { /* never fail a hook */ }
  }
}

// ---- main ---------------------------------------------------
function main() {
  const event = process.argv[2] || 'pre';
  const payload = readStdin();
  const sid = sessionIdOf(payload);
  const SUB_DIR = subagentsDir(sid);

  // Subagent counter events: manage marker files only, never touch the badge
  // state or emit a notification.
  if (event === 'subagent-start' || event === 'subagent-stop') {
    if (on('FEATURE_SUBAGENTS')) {
      if (event === 'subagent-start') addSubagent(SUB_DIR, payload.agent_id);
      else removeSubagent(SUB_DIR, payload.agent_id);
    }
    process.stdout.write(JSON.stringify({ suppressOutput: true }));
    return;
  }

  // SessionStart also fires mid-turn when the context is compacted
  // (source === 'compact') — the turn keeps running, so don't reset the
  // timer, the subagent markers, or the state (PreCompact already set it).
  if (event === 'start' && payload.source === 'compact') {
    process.stdout.write(JSON.stringify({ suppressOutput: true }));
    return;
  }

  // Session over: remove every trace of this session (badge won't render for
  // it anymore) and skip the usual state write.
  if (event === 'end') {
    try { fs.rmSync(stateFile(sid), { force: true }); } catch { /* fine */ }
    try { fs.rmSync(turnFile(sid), { force: true }); } catch { /* fine */ }
    try { fs.rmSync(SUB_DIR, { recursive: true, force: true }); } catch { /* fine */ }
    process.stdout.write(JSON.stringify({ suppressOutput: true }));
    return;
  }

  // Reset the counter at turn/session boundaries — clears any orphaned markers
  // if a SubagentStop was ever missed. Unconditional (not gated by the feature
  // flag) so toggling the feature off can never freeze a stale "⚙ N".
  // NOT on prompt: Claude Code fires UserPromptSubmit spuriously when a
  // subagent completes (anthropics/claude-code#16952), which would wipe the
  // counter for still-running agents mid-turn.
  if (event === 'stop' || event === 'start') {
    clearSubagents(SUB_DIR);
    clearLooseMarkers();
  }
  if (event === 'start') gcStale();

  // Turn timer: stamp the start on prompt submit; on stop, read the elapsed
  // time (for the DONE badge + notification) before clearing the stamp.
  // Clearing happens regardless of FEATURE_DURATION so no stale stamp survives
  // a feature toggle, and also on session start (crashed sessions never stop).
  let turnDuration = null;
  try {
    if (event === 'prompt') {
      fs.mkdirSync(DIR, { recursive: true });
      fs.writeFileSync(turnFile(sid), String(Date.now()));
    } else if (event === 'stop' || event === 'start') {
      if (event === 'stop') {
        const ts = parseInt(fs.readFileSync(turnFile(sid), 'utf8'), 10);
        if (Number.isFinite(ts)) turnDuration = fmtDuration(Date.now() - ts);
      }
      fs.rmSync(turnFile(sid), { force: true });
    }
  } catch { /* never fail a hook */ }

  const toolName = payload && typeof payload.tool_name === 'string' ? payload.tool_name : '';
  const theme = loadTheme();
  const state = deriveState(event, toolName, theme);

  // Detail default: on for fresh installs (no config.conf), but OFF when a
  // pre-2.4 config exists without the key — those users never opted in to
  // command lines / file names appearing in their statusline.
  if (event === 'pre' && on('FEATURE_DETAIL', !cfgFileExists)) {
    const detail = deriveDetail(toolName, payload.tool_input);
    if (detail) state.detail = detail;
  }
  if (turnDuration && on('FEATURE_DURATION')) state.duration = turnDuration;

  // attach permission mode + approval flag (gated by FEATURE_MODE, default on)
  if (on('FEATURE_MODE')) {
    const { mode, needsApproval } = resolveMode(event, payload, readPrevState(stateFile(sid)));
    state.mode = mode;
    if (needsApproval) state.needsApproval = true;
  }

  // 1) state file for the statusline badge
  if (on('FEATURE_STATUSLINE')) writeState(stateFile(sid), state);

  // 2) terminalSequence: window title (OSC 2) + notification (OSC 9).
  // Each is a full OSC sequence: ESC ] <n> ; <text> BEL.
  const ESC = '\x1b', BEL = '\x07';
  let seq = '';
  if (on('FEATURE_TITLE', false)) { // default off: Claude Code overrides the title
    const tail = state.detail ? ': ' + state.detail : '';
    seq += ESC + ']2;' + state.icon + ' Claude > ' + state.label + tail + BEL;
  }
  if (on('FEATURE_NOTIFY')) {
    let msg = '';
    if (event === 'stop' && on('NOTIFY_DONE')) {
      msg = 'Claude is done' +
        (turnDuration && on('FEATURE_DURATION') ? ' (' + turnDuration + ')' : '');
    } else if (event === 'notify' && on('NOTIFY_INPUT')) {
      msg = 'Claude needs your input';
    }
    if (msg) seq += ESC + ']9;' + msg + BEL;
  }

  const out = { suppressOutput: true };
  if (seq) out.terminalSequence = seq;
  process.stdout.write(JSON.stringify(out));
}

try { main(); } catch { /* swallow — a hook must never crash */ }
process.exit(0);
