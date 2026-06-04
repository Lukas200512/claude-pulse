#!/usr/bin/env node
/* ============================================================
 * Claude Pulse — statusline badge
 * Reads the state written by indicator.js and prints a colored
 * badge for Claude Code's status line. Cross-platform; uses
 * 24-bit ANSI which Claude Code renders itself (no /dev/tty).
 * Style is configurable: compact | wide | full.
 * https://github.com/Lukas200512/claude-pulse
 * ========================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIR = path.join(os.homedir(), '.claude', 'claude-pulse');
const STATE_FILE = path.join(DIR, 'state');
const CONFIG_FILE = path.join(DIR, 'config.conf');
const SUBAGENTS_DIR = path.join(DIR, 'subagents');

// Number of subagents currently running = marker files written by the hook.
function subagentCount() {
  try { return fs.readdirSync(SUBAGENTS_DIR).length; } catch { return 0; }
}

function readState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (s && typeof s.label === 'string') return s;
  } catch { /* fall through */ }
  return { label: 'Idle', icon: '.', color: '#0f1923' };
}

function readSession() {
  try { return JSON.parse(fs.readFileSync(0, 'utf8')) || {}; } catch { return {}; }
}

function readStyle() {
  try {
    const t = fs.readFileSync(CONFIG_FILE, 'utf8');
    const m = t.match(/^\s*BADGE_STYLE\s*=\s*"?(compact|wide|full)"?/m);
    if (m) return m[1];
  } catch { /* default below */ }
  return 'wide';
}

// Brighten a dark theme color so it reads as a small badge, preserving hue.
// Target is high enough that the label always pops as a vivid chip.
function brighten(hex) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || '');
  let r = 80, g = 90, b = 110;
  if (m) {
    r = parseInt(m[1].slice(0, 2), 16);
    g = parseInt(m[1].slice(2, 4), 16);
    b = parseInt(m[1].slice(4, 6), 16);
  }
  const max = Math.max(r, g, b, 1);
  const target = 210;
  const k = max < target ? target / max : 1;
  return [Math.min(255, Math.round(r * k)), Math.min(255, Math.round(g * k)), Math.min(255, Math.round(b * k))];
}

// Pick black or white text for maximum contrast on the badge background,
// so the label stays crisp on any hue (white on orange, black on green, ...).
function fgCode([r, g, b]) {
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b; // perceived, 0..255
  return lum > 140 ? 30 : 97; // 30 = black, 97 = bright white
}

// Permission modes → short label + fixed vivid colour (theme-independent so
// they stay legible on any theme). 'default' is intentionally absent: no chip.
const MODES = {
  plan:              { label: 'PLAN',      color: '#4a3aff' },
  acceptEdits:       { label: 'AUTO-EDIT', color: '#1f8f3a' },
  auto:              { label: 'AUTO',      color: '#00a0a0' },
  dontAsk:           { label: 'NO-ASK',    color: '#c08000' },
  bypassPermissions: { label: 'BYPASS',    color: '#c01818' },
};
const APPROVAL_COLOR = '#ff8c00'; // amber — "auto on, but this needs you"
const SUBAGENT_COLOR = '#c83ab0'; // magenta — N subagents currently running

// The mode chip is shown only in these "actively working" states, where the
// hook just wrote a fresh permission mode. It is hidden when idle/done: a mode
// toggle while idle reaches neither the statusline JSON nor any hook, so an
// idle value could be stale — better to show nothing than something wrong.
const ACTIVE_KEYS = new Set(['thinking', 'shell', 'editing', 'reading', 'subagent', 'tool']);

// A small colored chip with contrast-aware, always-crisp text.
function chip(text, hex) {
  const [r, g, b] = brighten(hex);
  return `\x1b[48;2;${r};${g};${b}m\x1b[${fgCode([r, g, b])}m\x1b[1m ${text} \x1b[0m`;
}

function termWidth(sess) {
  const w = sess.width || sess.cols || (sess.terminal && sess.terminal.width) ||
            parseInt(process.env.COLUMNS || '', 10);
  return Number.isFinite(w) && w > 20 ? w : 80;
}

function main() {
  const st = readState();
  const sess = readSession();
  const style = readStyle();
  const [r, g, b] = brighten(st.color);
  const fg = fgCode([r, g, b]);
  const onColor = (text) => `\x1b[48;2;${r};${g};${b}m\x1b[${fg}m\x1b[1m${text}\x1b[0m`;
  // Readable mid-grey for the secondary tail; raw ANSI dim renders too faint on some terminals.
  const dim = (text) => `\x1b[38;5;250m${text}\x1b[0m`;

  const label = st.label.toUpperCase();
  const model = (sess.model && (sess.model.display_name || sess.model.id)) || '';
  let dir = '';
  const cwd = (sess.workspace && (sess.workspace.current_dir || sess.workspace.cwd)) || sess.cwd || '';
  if (cwd) dir = path.basename(cwd);
  const tail = [model, dir].filter(Boolean).join(' · ');

  // Permission mode: prefer the live statusline field (absent in current CC),
  // fall back to the last value the hook persisted into state. Only surfaced
  // while actively working (see ACTIVE_KEYS) so it is never shown stale.
  const mode = (typeof sess.permission_mode === 'string' && sess.permission_mode) || st.mode || 'default';
  const modeInfo = ACTIVE_KEYS.has(st.key) ? MODES[mode] : null;

  // Coloured chips for compact/wide; plain bracketed text for the full bar
  // (a single-colour bar can't show separate chip backgrounds).
  let chips = '', inlineChips = '';
  if (modeInfo) { chips += '  ' + chip(modeInfo.label, modeInfo.color); inlineChips += `  [ ${modeInfo.label} ]`; }
  if (st.needsApproval) { chips += '  ' + chip('WARTET AUF OK', APPROVAL_COLOR); inlineChips += '  [ WARTET AUF OK ]'; }
  const agents = subagentCount(); // independent of activity — shown whenever subagents run
  if (agents > 0) { chips += '  ' + chip(`⚙ ${agents}`, SUBAGENT_COLOR); inlineChips += `  [ ⚙ ${agents} ]`; }

  let out;
  if (style === 'compact') {
    out = onColor(` ${st.icon} ${label} `) + chips + (tail ? '  ' + dim(tail) : '');
  } else if (style === 'full') {
    let inner = ` ${st.icon} ${label}` + inlineChips + (tail ? `  ·  ${tail} ` : ' ');
    const w = termWidth(sess);
    if (inner.length < w) inner += ' '.repeat(w - inner.length);
    out = onColor(inner);
  } else { // wide (default)
    out = onColor(`    ${st.icon}  ${label}    `) + chips + (tail ? '  ' + dim(tail) : '');
  }
  process.stdout.write(out);
}

try { main(); } catch { process.stdout.write(''); }
process.exit(0);
