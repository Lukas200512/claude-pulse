#!/usr/bin/env node
/* ============================================================
 * Claude Terminal Colors — statusline badge
 * Reads the state written by indicator.js and prints a colored
 * badge for Claude Code's status line. Cross-platform; uses
 * 24-bit ANSI which Claude Code renders itself (no /dev/tty).
 * https://github.com/Lukas200512/claude-terminal-colors
 * ========================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const STATE_FILE = path.join(os.homedir(), '.claude', 'terminal-colors', 'state');

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

// Brighten a dark theme color so it's visible as a small badge,
// preserving hue (scale up until the brightest channel is ~170).
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

function main() {
  const st = readState();
  const sess = readSession();
  const [r, g, b] = brighten(st.color);

  // black text on the brightened color for contrast
  const badge = `\x1b[48;2;${r};${g};${b}m\x1b[30m\x1b[1m ${st.icon} ${st.label.toUpperCase()} \x1b[0m`;

  // optional context tail (model · dir), best-effort from session JSON
  const model = (sess.model && (sess.model.display_name || sess.model.id)) || '';
  let dir = '';
  const cwd = (sess.workspace && (sess.workspace.current_dir || sess.workspace.cwd)) || sess.cwd || '';
  if (cwd) dir = path.basename(cwd);
  const tail = [model, dir].filter(Boolean).join(' · ');

  process.stdout.write(tail ? `${badge}  \x1b[2m${tail}\x1b[0m` : badge);
}

try { main(); } catch { process.stdout.write(''); }
process.exit(0);
