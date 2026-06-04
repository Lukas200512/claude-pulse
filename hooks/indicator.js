#!/usr/bin/env node
/* ============================================================
 * Claude Terminal Colors — activity indicator hook
 * Cross-platform (Node, no /dev/tty, no bash). For each event it:
 *   1. writes the current state to a file (for the statusline badge)
 *   2. returns a `terminalSequence` (window title + notification)
 * Channels used are the ones Claude Code allows from a hook:
 * OSC 2 (title) and OSC 9 (notification). Background color (OSC 11)
 * is rejected by Claude Code, so it is not attempted.
 * https://github.com/Lukas200512/claude-terminal-colors
 * ========================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIR = path.join(os.homedir(), '.claude', 'terminal-colors');
const STATE_FILE = path.join(DIR, 'state');
const CONFIG_FILE = path.join(DIR, 'config.conf');

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
  'FEATURE_STATUSLINE', 'FEATURE_TITLE', 'FEATURE_NOTIFY',
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
    process.env.CLAUDE_TERMINAL_THEME,
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
  const toolName = payload && typeof payload.tool_name === 'string' ? payload.tool_name : '';
  const theme = loadTheme();
  const state = deriveState(event, toolName, theme);

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
