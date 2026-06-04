#!/usr/bin/env node
/* ============================================================
 * Claude Pulse — register/unregister the statusline
 * in ~/.claude/settings.json (cross-platform, no jq).
 *   node register-statusline.js on  "<plugin root | path to badge.js>"
 *   node register-statusline.js off
 * 'on' installs a version-robust launcher to a STABLE path
 * (~/.claude/claude-pulse/statusline.js) and registers THAT, so the
 * settings entry never hardcodes a versioned plugin directory — it
 * survives version bumps and reinstalls. Backs up settings.json first.
 * ========================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
const STABLE_DIR = path.join(os.homedir(), '.claude', 'claude-pulse');
const STABLE_LAUNCHER = path.join(STABLE_DIR, 'statusline.js');
const mode = process.argv[2];
const arg = process.argv[3];

function load() {
  try { return JSON.parse(fs.readFileSync(SETTINGS, 'utf8')); } catch { return {}; }
}
function isOurs(sl) {
  const c = sl && (typeof sl === 'string' ? sl : sl.command) || '';
  return /claude-pulse|badge\.js|statusline\.js/.test(c);
}
// Accept either a plugin root or a .../statusline/badge.js path.
function pluginRoot(p) {
  if (!p) return '';
  return /badge\.js$/.test(p) ? path.resolve(p, '..', '..') : p;
}

const settings = load();
if (fs.existsSync(SETTINGS)) {
  try { fs.copyFileSync(SETTINGS, SETTINGS + '.bak'); } catch { /* ignore */ }
}

if (mode === 'on') {
  const root = pluginRoot(arg);
  if (!root) { console.error('on: missing plugin root'); process.exit(1); }
  fs.mkdirSync(STABLE_DIR, { recursive: true });
  const src = path.join(root, 'scripts', 'statusline-launcher.js');
  if (fs.existsSync(src)) fs.copyFileSync(src, STABLE_LAUNCHER);
  if (!fs.existsSync(STABLE_LAUNCHER)) {
    console.error('on: launcher not found at ' + src);
    process.exit(1);
  }
  settings.statusLine = { type: 'command', command: `node "${STABLE_LAUNCHER}"`, padding: 0 };
} else if (mode === 'off') {
  if (isOurs(settings.statusLine)) delete settings.statusLine;
} else {
  console.error('usage: register-statusline.js on <pluginRoot> | off');
  process.exit(1);
}

fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');
console.log(mode === 'on' ? 'statusLine registered' : 'statusLine removed (if it was ours)');
