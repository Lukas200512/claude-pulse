#!/usr/bin/env node
/* ============================================================
 * Claude Pulse — activity indicator hook
 * Cross-platform (Node, no /dev/tty, no bash). For each event it:
 *   1. writes the current state to a file (for the statusline badge)
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

const DIR = path.join(os.homedir(), '.claude', 'claude-pulse');
const STATE_FILE = path.join(DIR, 'state');
const CONFIG_FILE = path.join(DIR, 'config.conf');
const SUBAGENTS_DIR = path.join(DIR, 'subagents'); // one marker file per running subagent

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

const FLAGS = new Set([
  'FEATURE_STATUSLINE', 'FEATURE_TITLE', 'FEATURE_NOTIFY', 'FEATURE_MODE', 'FEATURE_SUBAGENTS',
  'NOTIFY_DONE', 'NOTIFY_INPUT',
]);
const cfg = readKV(CONFIG_FILE, FLAGS, v => v === 'on' || v === 'off');
const on = (k, def = true) => (cfg[k] ? cfg[k] === 'on' : def);

const COLORS = new Set([
  'COLOR_BASH', 'COLOR_CODE', 'COLOR_READ', 'COLOR_AGENT', 'COLOR_INPUT',
  'COLOR_IDLE', 'COLOR_DONE', 'COLOR_NOTIFY', 'COLOR_TOOL',
]);
function loadTheme() {
  const cands = [
    process.env.CLAUDE_PULSE_THEME,
    path.join(DIR, 'theme.conf'),
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
    done: t.COLOR_DONE || '#0a1a0a', notify: t.COLOR_NOTIFY || '#2a1a00',
    tool: t.COLOR_TOOL || '#15151f',
  };
}

// ---- read the hook payload from stdin -----------------------
function readStdin() {
  try { return JSON.parse(fs.readFileSync(0, 'utf8')); } catch { return {}; }
}

// ---- previous state (to carry the last-known permission mode) ----
function readPrevState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) || {}; } catch { return {}; }
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
    // Newer CC exposes notification_type; older builds fall back to the message.
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
function addSubagent(id) {
  try {
    fs.mkdirSync(SUBAGENTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(SUBAGENTS_DIR, markerName(id)), '');
  } catch { /* never fail a hook */ }
}
function removeSubagent(id) {
  try {
    if (id) { fs.unlinkSync(path.join(SUBAGENTS_DIR, markerName(id))); return; }
    // no agent_id (older CC): drop the oldest marker as a best-effort decrement
    const files = fs.readdirSync(SUBAGENTS_DIR)
      .map(f => ({ f, t: fs.statSync(path.join(SUBAGENTS_DIR, f)).mtimeMs }))
      .sort((a, b) => a.t - b.t);
    if (files.length) fs.unlinkSync(path.join(SUBAGENTS_DIR, files[0].f));
  } catch { /* marker already gone / dir missing */ }
}
function clearSubagents() {
  try { for (const f of fs.readdirSync(SUBAGENTS_DIR)) fs.unlinkSync(path.join(SUBAGENTS_DIR, f)); } catch { /* none */ }
}

// ---- derive the current state -------------------------------
function deriveState(event, toolName, theme) {
  switch (event) {
    case 'prompt': return { key: 'thinking', label: 'Thinking', icon: '*', color: theme.idle };
    case 'stop':   return { key: 'done',     label: 'Done',     icon: 'v', color: theme.done };
    case 'notify': return { key: 'input',    label: 'Needs input', icon: '!', color: theme.notify };
    case 'start':  return { key: 'ready',    label: 'Ready',    icon: '.', color: theme.idle };
    case 'end':    return { key: 'idle',     label: 'Idle',     icon: '.', color: theme.idle };
    case 'pre':
    default:
      switch (toolName) {
        case 'Bash':             return { key: 'shell',    label: 'Shell',    icon: '>', color: theme.bash };
        case 'Edit': case 'Write': case 'MultiEdit': case 'NotebookEdit':
                                 return { key: 'editing',  label: 'Editing',  icon: '~', color: theme.code };
        case 'Read': case 'Glob': case 'Grep':
                                 return { key: 'reading',  label: 'Reading',  icon: '?', color: theme.read };
        case 'Agent': case 'Task':
                                 return { key: 'subagent', label: 'Subagent', icon: '@', color: theme.agent };
        case 'AskUserQuestion':  return { key: 'input',    label: 'Needs input', icon: '?', color: theme.input };
        default:                 return { key: 'tool',     label: 'Working',  icon: '+', color: theme.tool };
      }
  }
}

// ---- main ---------------------------------------------------
function main() {
  const event = process.argv[2] || 'pre';
  const payload = readStdin();

  // Subagent counter events: manage marker files only, never touch the badge
  // state or emit a notification.
  if (event === 'subagent-start' || event === 'subagent-stop') {
    if (on('FEATURE_SUBAGENTS')) {
      if (event === 'subagent-start') addSubagent(payload.agent_id);
      else removeSubagent(payload.agent_id);
    }
    process.stdout.write(JSON.stringify({ suppressOutput: true }));
    return;
  }
  // Reset the counter at turn/session boundaries — clears any orphaned markers
  // if a SubagentStop was ever missed.
  if (on('FEATURE_SUBAGENTS') && (event === 'stop' || event === 'start' || event === 'end')) {
    clearSubagents();
  }

  const toolName = payload && typeof payload.tool_name === 'string' ? payload.tool_name : '';
  const theme = loadTheme();
  const state = deriveState(event, toolName, theme);

  // attach permission mode + approval flag (gated by FEATURE_MODE, default on)
  if (on('FEATURE_MODE')) {
    const { mode, needsApproval } = resolveMode(event, payload, readPrevState());
    state.mode = mode;
    if (needsApproval) state.needsApproval = true;
  }

  // 1) state file for the statusline badge
  if (on('FEATURE_STATUSLINE')) {
    try {
      fs.mkdirSync(DIR, { recursive: true });
      const tmp = STATE_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(state));
      fs.renameSync(tmp, STATE_FILE);
    } catch { /* never fail a hook */ }
  }

  // 2) terminalSequence: window title (OSC 2) + notification (OSC 9).
  // Each is a full OSC sequence: ESC ] <n> ; <text> BEL.
  const ESC = '\x1b', BEL = '\x07';
  let seq = '';
  if (on('FEATURE_TITLE', false)) { // default off: Claude Code overrides the title
    seq += ESC + ']2;' + state.icon + ' Claude > ' + state.label + BEL;
  }
  if (on('FEATURE_NOTIFY')) {
    let msg = '';
    if (event === 'stop' && on('NOTIFY_DONE')) msg = 'Claude is done';
    else if (event === 'notify' && on('NOTIFY_INPUT')) msg = 'Claude needs your input';
    if (msg) seq += ESC + ']9;' + msg + BEL;
  }

  const out = { suppressOutput: true };
  if (seq) out.terminalSequence = seq;
  process.stdout.write(JSON.stringify(out));
}

try { main(); } catch { /* swallow — a hook must never crash */ }
process.exit(0);
