#!/usr/bin/env node
/* ============================================================
 * Claude Terminal Colors — statusline badge
 * Reads the state written by indicator.js and prints a colored
 * badge for Claude Code's status line. Cross-platform; uses
 * 24-bit ANSI which Claude Code renders itself (no /dev/tty).
 * Style is configurable: compact | wide | full.
 * https://github.com/Lukas200512/claude-terminal-colors
 * ========================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIR = path.join(os.homedir(), '.claude', 'terminal-colors');
const STATE_FILE = path.join(DIR, 'state');
const CONFIG_FILE = path.join(DIR, 'config.conf');

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
function brighten(hex) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || '');
  let r = 80, g = 90, b = 110;
  if (m) {
    r = parseInt(m[1].slice(0, 2), 16);
    g = parseInt(m[1].slice(2, 4), 16);
    b = parseInt(m[1].slice(4, 6), 16);
  }
  const max = Math.max(r, g, b, 1);
  const k = max < 170 ? 170 / max : 1;
  return [Math.min(255, Math.round(r * k)), Math.min(255, Math.round(g * k)), Math.min(255, Math.round(b * k))];
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
  const onColor = (text) => `\x1b[48;2;${r};${g};${b}m\x1b[30m\x1b[1m${text}\x1b[0m`;
  const dim = (text) => `\x1b[2m${text}\x1b[0m`;

  const label = st.label.toUpperCase();
  const model = (sess.model && (sess.model.display_name || sess.model.id)) || '';
  let dir = '';
  const cwd = (sess.workspace && (sess.workspace.current_dir || sess.workspace.cwd)) || sess.cwd || '';
  if (cwd) dir = path.basename(cwd);
  const tail = [model, dir].filter(Boolean).join(' · ');

  let out;
  if (style === 'compact') {
    out = onColor(` ${st.icon} ${label} `) + (tail ? '  ' + dim(tail) : '');
  } else if (style === 'full') {
    let inner = ` ${st.icon} ${label}` + (tail ? `  ·  ${tail} ` : ' ');
    const w = termWidth(sess);
    if (inner.length < w) inner += ' '.repeat(w - inner.length);
    out = onColor(inner);
  } else { // wide (default)
    out = onColor(`    ${st.icon}  ${label}    `) + (tail ? '  ' + dim(tail) : '');
  }
  process.stdout.write(out);
}

try { main(); } catch { process.stdout.write(''); }
process.exit(0);
